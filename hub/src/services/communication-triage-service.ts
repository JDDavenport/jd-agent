/**
 * JD Agent - Communication Triage Service
 *
 * Unified AI-powered importance detection for all communication channels:
 * - Gmail, Outlook (emails)
 * - iMessage, SMS (text messages)
 * - Phone calls (missed call detection)
 *
 * Determines importance level and whether to send SMS notification.
 */

import OpenAI from 'openai';
import { db } from '../db/client';
import {
  communicationMessages,
  communicationVipContacts,
  tasks,
} from '../db/schema';
import { eq } from 'drizzle-orm';
import { notificationService } from './notification-service';

// ============================================
// Types
// ============================================

export type CommunicationChannel =
  | 'gmail'
  | 'outlook'
  | 'imessage'
  | 'sms'
  | 'phone_call';

export type ImportanceLevel = 'critical' | 'urgent' | 'normal' | 'low';

export type MessageCategory =
  | 'action_required'
  | 'fyi'
  | 'social'
  | 'spam'
  | 'personal';

export interface CommunicationItem {
  id: string;
  channel: CommunicationChannel;
  externalId: string;
  from: string;
  fromName?: string;
  to?: string;
  subject?: string; // For emails
  content: string;
  receivedAt: Date;
  callType?: 'incoming' | 'outgoing' | 'missed'; // For phone calls
  callDuration?: number; // For phone calls (seconds)
  metadata?: Record<string, unknown>;
}

export interface TriageResult {
  itemId: string;
  channel: CommunicationChannel;
  importance: ImportanceLevel;
  category: MessageCategory;
  requiresAction: boolean;
  reasoning: string;
  suggestedResponse?: string;
  shouldNotify: boolean;
  notificationPriority: 'immediate' | 'batch' | 'none';
  taskToCreate?: string;
}

// ============================================
// AI Triage Prompt
// ============================================

const COMMUNICATION_TRIAGE_PROMPT = `You are an expert communication assistant analyzing incoming messages for a busy professional.

Your job is to determine the IMPORTANCE of each message and whether it requires immediate notification via SMS.

CRITICAL: The user only wants to be notified for TRULY important items. False positives (unnecessary notifications) waste their attention and are worse than missing something.

Importance Levels:
- "critical": Life safety, legal deadlines, financial emergencies, immediate family emergencies
- "urgent": Same-day response needed, important professional contacts, time-sensitive opportunities
- "normal": Routine business (24-48 hours), non-urgent requests
- "low": FYI only, newsletters, social updates, automated notifications

Categories:
- "action_required": User must respond or do something
- "fyi": Informational only, no action needed
- "social": Personal/social communication
- "spam": Promotional, junk, or unwanted
- "personal": Personal matters (family, health, etc.)

Notification Rules:
- "immediate": Critical importance OR urgent + action_required
- "batch": Normal importance + action_required (collect for digest)
- "none": Low importance OR fyi/social/spam categories

Analyze the message and respond with JSON:
{
  "importance": "critical" | "urgent" | "normal" | "low",
  "category": "action_required" | "fyi" | "social" | "spam" | "personal",
  "requiresAction": true | false,
  "reasoning": "Brief explanation (1-2 sentences)",
  "suggestedResponse": "Optional brief response if action needed" | null,
  "shouldNotify": true | false,
  "notificationPriority": "immediate" | "batch" | "none",
  "taskToCreate": "Task description starting with verb" | null
}`;

// ============================================
// Service
// ============================================

export class CommunicationTriageService {
  private openai: OpenAI | null = null;
  private vipContacts: Map<string, { priority: string; name?: string }> =
    new Map();
  private vipContactsLoaded = false;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
      console.log('[CommunicationTriage] OpenAI initialized');
    } else {
      console.log('[CommunicationTriage] OpenAI not configured');
    }
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return !!this.openai;
  }

  /**
   * Load VIP contacts from database
   */
  private async loadVipContacts(): Promise<void> {
    if (this.vipContactsLoaded) return;

    try {
      const contacts = await db
        .select()
        .from(communicationVipContacts)
        .where(eq(communicationVipContacts.alwaysNotify, true));

      this.vipContacts.clear();
      for (const contact of contacts) {
        this.vipContacts.set(contact.identifier.toLowerCase(), {
          priority: contact.priority,
          name: contact.name ?? undefined,
        });
      }

      this.vipContactsLoaded = true;
      console.log(`[CommunicationTriage] Loaded ${contacts.length} VIP contacts`);
    } catch (error) {
      console.error('[CommunicationTriage] Failed to load VIP contacts:', error);
    }
  }

  /**
   * Refresh VIP contacts cache
   */
  async refreshVipContacts(): Promise<void> {
    this.vipContactsLoaded = false;
    await this.loadVipContacts();
  }

  /**
   * Check if sender is a VIP contact
   */
  private isVipContact(from: string): {
    isVip: boolean;
    priority?: string;
    name?: string;
  } {
    const normalizedFrom = from.toLowerCase();

    // Check exact match
    if (this.vipContacts.has(normalizedFrom)) {
      const vip = this.vipContacts.get(normalizedFrom)!;
      return { isVip: true, priority: vip.priority, name: vip.name };
    }

    // Check if email is in the format "Name <email@domain.com>"
    const emailMatch = from.match(/<([^>]+)>/);
    if (emailMatch) {
      const email = emailMatch[1].toLowerCase();
      if (this.vipContacts.has(email)) {
        const vip = this.vipContacts.get(email)!;
        return { isVip: true, priority: vip.priority, name: vip.name };
      }
    }

    return { isVip: false };
  }

  /**
   * Triage a communication item
   */
  async triageItem(item: CommunicationItem): Promise<TriageResult> {
    // Ensure VIP contacts are loaded
    await this.loadVipContacts();

    // Check VIP status first for instant notification
    const vipStatus = this.isVipContact(item.from);
    if (vipStatus.isVip) {
      console.log(
        `[CommunicationTriage] VIP contact detected: ${vipStatus.name || item.from}`
      );
      return this.createVipTriageResult(item, vipStatus);
    }

    // Run AI analysis
    if (!this.openai) {
      return this.createDefaultTriageResult(item, 'OpenAI not configured');
    }

    try {
      const result = await this.analyzeWithAI(item);
      return result;
    } catch (error) {
      console.error('[CommunicationTriage] AI analysis failed:', error);
      return this.createDefaultTriageResult(item, String(error));
    }
  }

  /**
   * Create triage result for VIP contacts (bypass AI)
   */
  private createVipTriageResult(
    item: CommunicationItem,
    vipStatus: { priority?: string; name?: string }
  ): TriageResult {
    const importance: ImportanceLevel =
      vipStatus.priority === 'critical' ? 'critical' : 'urgent';

    return {
      itemId: item.id,
      channel: item.channel,
      importance,
      category: 'action_required',
      requiresAction: true,
      reasoning: `VIP contact: ${vipStatus.name || item.from}`,
      shouldNotify: true,
      notificationPriority: 'immediate',
    };
  }

  /**
   * Create default triage result (fallback)
   */
  private createDefaultTriageResult(
    item: CommunicationItem,
    reason: string
  ): TriageResult {
    return {
      itemId: item.id,
      channel: item.channel,
      importance: 'normal',
      category: 'fyi',
      requiresAction: false,
      reasoning: `Default classification: ${reason}`,
      shouldNotify: false,
      notificationPriority: 'none',
    };
  }

  /**
   * Analyze communication with AI
   */
  private async analyzeWithAI(item: CommunicationItem): Promise<TriageResult> {
    const channelLabel = this.getChannelLabel(item.channel);

    // Build context based on channel type
    let messageContext: string;

    if (item.channel === 'phone_call') {
      messageContext = `
Channel: ${channelLabel}
From: ${item.fromName || item.from}
Call Type: ${item.callType || 'unknown'}
Duration: ${item.callDuration ? `${item.callDuration} seconds` : 'N/A'}
Time: ${item.receivedAt.toLocaleString()}
`;
    } else if (item.channel === 'gmail' || item.channel === 'outlook') {
      const truncatedContent =
        item.content.length > 3000
          ? item.content.substring(0, 3000) + '...'
          : item.content;
      messageContext = `
Channel: ${channelLabel}
From: ${item.fromName || item.from}
Subject: ${item.subject || '(no subject)'}
Time: ${item.receivedAt.toLocaleString()}

${truncatedContent}
`;
    } else {
      // iMessage/SMS
      const truncatedContent =
        item.content.length > 1000
          ? item.content.substring(0, 1000) + '...'
          : item.content;
      messageContext = `
Channel: ${channelLabel}
From: ${item.fromName || item.from}
Time: ${item.receivedAt.toLocaleString()}

${truncatedContent}
`;
    }

    const response = await this.openai!.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: COMMUNICATION_TRIAGE_PROMPT },
        { role: 'user', content: messageContext },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 500,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);

    console.log(
      `[CommunicationTriage] ${item.channel}: ${parsed.importance}/${parsed.category}, notify: ${parsed.shouldNotify}`
    );

    return {
      itemId: item.id,
      channel: item.channel,
      importance: parsed.importance,
      category: parsed.category,
      requiresAction: parsed.requiresAction,
      reasoning: parsed.reasoning,
      suggestedResponse: parsed.suggestedResponse || undefined,
      shouldNotify: parsed.shouldNotify,
      notificationPriority: parsed.notificationPriority,
      taskToCreate: parsed.taskToCreate || undefined,
    };
  }

  /**
   * Get human-readable channel label
   */
  private getChannelLabel(channel: CommunicationChannel): string {
    const labels: Record<CommunicationChannel, string> = {
      gmail: 'Email (Gmail)',
      outlook: 'Email (Outlook)',
      imessage: 'iMessage',
      sms: 'Text Message (SMS)',
      phone_call: 'Phone Call',
    };
    return labels[channel] || channel;
  }

  /**
   * Process a triaged item: save to DB, send notification, create task
   */
  async processTriagedItem(
    item: CommunicationItem,
    result: TriageResult
  ): Promise<{
    saved: boolean;
    notified: boolean;
    taskCreated: boolean;
    notificationChannel?: string;
    error?: string;
  }> {
    let saved = false;
    let notified = false;
    let taskCreated = false;
    let notificationChannel: string | undefined;

    try {
      // 1. Save to database
      await db.insert(communicationMessages).values({
        channel: item.channel,
        externalId: item.externalId,
        threadId: item.metadata?.threadId as string | undefined,
        fromAddress: item.from,
        fromName: item.fromName,
        toAddress: item.to,
        subject: item.subject,
        preview: item.content.substring(0, 200),
        fullContent: item.content,
        callType: item.callType,
        callDuration: item.callDuration,
        receivedAt: item.receivedAt,
        triaged: true,
        triagedAt: new Date(),
        importance: result.importance,
        category: result.category,
        requiresAction: result.requiresAction,
        triageReasoning: result.reasoning,
        metadata: item.metadata as Record<string, unknown>,
      });
      saved = true;

      // 2. Send notification if needed
      if (result.shouldNotify && result.notificationPriority === 'immediate') {
        const notifyResult = await this.sendNotification(item, result);
        notified = notifyResult.success;
        notificationChannel = notifyResult.channel;

        // Update notification status in DB
        if (notified) {
          await db
            .update(communicationMessages)
            .set({
              notified: true,
              notifiedAt: new Date(),
              notificationChannel,
              updatedAt: new Date(),
            })
            .where(eq(communicationMessages.externalId, item.externalId));
        }
      }

      // 3. Create task if needed
      if (result.requiresAction && result.taskToCreate) {
        const senderName = item.fromName || item.from;
        const channelLabel = this.getChannelLabel(item.channel);

        await db.insert(tasks).values({
          title: result.taskToCreate,
          description: `From: ${senderName} (${channelLabel})\n${item.subject ? `Subject: ${item.subject}\n` : ''}${result.suggestedResponse ? `\nSuggested response: ${result.suggestedResponse}` : ''}`,
          status: result.importance === 'critical' ? 'today' : 'inbox',
          priority:
            result.importance === 'critical'
              ? 3
              : result.importance === 'urgent'
                ? 2
                : 1,
          source: item.channel,
          sourceRef: `${item.channel}:${item.externalId}`,
          context: channelLabel,
          dueDate:
            result.importance === 'critical' ||
            result.importance === 'urgent'
              ? new Date()
              : null,
        });

        taskCreated = true;
        console.log(`[CommunicationTriage] Created task: ${result.taskToCreate}`);
      }

      return { saved, notified, taskCreated, notificationChannel };
    } catch (error) {
      console.error('[CommunicationTriage] Failed to process item:', error);
      return { saved, notified, taskCreated, error: String(error) };
    }
  }

  /**
   * Send SMS notification for important communications
   */
  private async sendNotification(
    item: CommunicationItem,
    result: TriageResult
  ): Promise<{ success: boolean; channel?: string }> {
    if (!notificationService.isConfigured()) {
      console.log('[CommunicationTriage] Notification service not configured');
      return { success: false };
    }

    const channelEmoji = this.getChannelEmoji(item.channel);
    const urgencyPrefix = result.importance === 'critical' ? '🚨 URGENT: ' : '';
    const senderName = item.fromName || item.from;

    let message: string;

    if (item.channel === 'phone_call') {
      message = `${urgencyPrefix}${channelEmoji} Missed call from ${senderName}`;
    } else {
      const preview = item.subject || item.content.substring(0, 80);
      message = `${urgencyPrefix}${channelEmoji} ${senderName}\n${preview}${item.content.length > 80 ? '...' : ''}`;
    }

    if (result.requiresAction) {
      message += '\n⚡ Action needed';
    }

    try {
      // Always use SMS for immediate notifications
      const smsResult = await notificationService.sendSms(message);

      if (smsResult.success) {
        return { success: true, channel: 'sms' };
      }

      // Fallback to Telegram if SMS fails
      const telegramResult = await notificationService.sendTelegram(message);
      return {
        success: telegramResult.success,
        channel: telegramResult.success ? 'telegram' : undefined,
      };
    } catch (error) {
      console.error('[CommunicationTriage] Notification failed:', error);
      return { success: false };
    }
  }

  /**
   * Get emoji for channel type
   */
  private getChannelEmoji(channel: CommunicationChannel): string {
    const emojis: Record<CommunicationChannel, string> = {
      gmail: '📧',
      outlook: '📨',
      imessage: '💬',
      sms: '📱',
      phone_call: '📞',
    };
    return emojis[channel] || '📩';
  }

  /**
   * Add a VIP contact
   */
  async addVipContact(
    identifier: string,
    options: {
      identifierType: 'email' | 'phone';
      name?: string;
      priority?: 'critical' | 'high' | 'normal';
      notifyOnEmail?: boolean;
      notifyOnMessage?: boolean;
      notifyOnCall?: boolean;
    }
  ): Promise<void> {
    await db.insert(communicationVipContacts).values({
      identifier: identifier.toLowerCase(),
      identifierType: options.identifierType,
      name: options.name,
      priority: options.priority || 'high',
      notifyOnEmail: options.notifyOnEmail ?? true,
      notifyOnMessage: options.notifyOnMessage ?? true,
      notifyOnCall: options.notifyOnCall ?? true,
    });

    // Refresh cache
    await this.refreshVipContacts();
  }

  /**
   * Remove a VIP contact
   */
  async removeVipContact(identifier: string): Promise<void> {
    await db
      .delete(communicationVipContacts)
      .where(eq(communicationVipContacts.identifier, identifier.toLowerCase()));

    // Refresh cache
    await this.refreshVipContacts();
  }

  /**
   * Get all VIP contacts
   */
  async getVipContacts(): Promise<
    Array<{
      identifier: string;
      identifierType: string;
      name: string | null;
      priority: string;
    }>
  > {
    return await db.select().from(communicationVipContacts);
  }
}

// Export singleton instance
export const communicationTriageService = new CommunicationTriageService();

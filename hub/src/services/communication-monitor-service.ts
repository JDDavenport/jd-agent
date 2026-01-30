/**
 * JD Agent - Communication Monitor Service
 *
 * Central orchestrator for all communication monitoring:
 * - Gmail (via existing integration)
 * - Outlook (via Playwright scraper)
 * - iMessage (via SQLite database)
 * - Phone calls (via CallKit database)
 *
 * Coordinates checking, triage, and notification across all channels.
 */

import { db } from '../db/client';
import { communicationMonitorStatus } from '../db/schema';
import { eq } from 'drizzle-orm';

import { outlookScraper, type OutlookEmail } from '../integrations/outlook-scraper';
import { imessageIntegration, type iMessage } from '../integrations/imessage';
import { phoneCallsIntegration, type PhoneCall } from '../integrations/phone-calls';
import {
  communicationTriageService,
  type CommunicationItem,
  type CommunicationChannel,
} from './communication-triage-service';

// ============================================
// Types
// ============================================

export interface ChannelStatus {
  enabled: boolean;
  status: 'healthy' | 'degraded' | 'error' | 'disabled';
  lastCheckAt: Date | null;
  lastSuccessAt: Date | null;
  unreadCount: number;
  urgentCount: number;
  error?: string;
  sessionValid?: boolean; // For Outlook
  hasAccess?: boolean; // For iMessage/Phone
}

export interface MonitorStatus {
  gmail: ChannelStatus;
  outlook: ChannelStatus;
  imessage: ChannelStatus;
  phoneCalls: ChannelStatus;
  lastTriageRun: Date | null;
  alertsSentToday: number;
  pendingInTriage: number;
}

export interface CheckResult {
  channel: CommunicationChannel;
  new: number;
  urgent: number;
  processed: number;
  notified: number;
  error?: string;
}

// ============================================
// Service
// ============================================

export class CommunicationMonitorService {
  private initialized = false;
  private alertsSentToday = 0;
  private lastAlertReset: Date = new Date();

  constructor() {
    console.log('[CommunicationMonitor] Service initialized');
  }

  /**
   * Initialize all integrations
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('[CommunicationMonitor] Initializing integrations...');

    // Set checkpoints for incremental monitoring
    if (imessageIntegration.isConfigured()) {
      await imessageIntegration.setCheckpoint();
    }

    if (phoneCallsIntegration.isConfigured()) {
      await phoneCallsIntegration.setCheckpoint();
    }

    // Initialize status records in database
    await this.initializeStatusRecords();

    this.initialized = true;
    console.log('[CommunicationMonitor] Initialization complete');
  }

  /**
   * Initialize status records for each channel
   */
  private async initializeStatusRecords(): Promise<void> {
    const channels: CommunicationChannel[] = [
      'gmail',
      'outlook',
      'imessage',
      'phone_call',
    ];

    for (const channel of channels) {
      try {
        // Check if record exists
        const existing = await db
          .select()
          .from(communicationMonitorStatus)
          .where(eq(communicationMonitorStatus.channel, channel))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(communicationMonitorStatus).values({
            channel,
            status: 'unknown',
            enabled: false,
          });
        }
      } catch (error) {
        console.error(`[CommunicationMonitor] Failed to init status for ${channel}:`, error);
      }
    }
  }

  /**
   * Reset daily alert counter
   */
  private resetDailyAlertsIfNeeded(): void {
    const now = new Date();
    if (now.getDate() !== this.lastAlertReset.getDate()) {
      this.alertsSentToday = 0;
      this.lastAlertReset = now;
    }
  }

  /**
   * Update channel status in database
   */
  private async updateChannelStatus(
    channel: CommunicationChannel,
    status: Partial<ChannelStatus>
  ): Promise<void> {
    try {
      await db
        .update(communicationMonitorStatus)
        .set({
          status: status.status,
          enabled: status.enabled,
          lastCheckAt: status.lastCheckAt,
          lastSuccessAt: status.lastSuccessAt,
          unreadCount: status.unreadCount,
          urgentCount: status.urgentCount,
          lastErrorMessage: status.error,
          sessionValid: status.sessionValid,
          hasAccess: status.hasAccess,
          updatedAt: new Date(),
        })
        .where(eq(communicationMonitorStatus.channel, channel));
    } catch (error) {
      console.error(`[CommunicationMonitor] Failed to update status for ${channel}:`, error);
    }
  }

  // ----------------------------------------
  // Channel Check Methods
  // ----------------------------------------

  /**
   * Check Outlook for new emails
   */
  async checkOutlook(): Promise<CheckResult> {
    const result: CheckResult = {
      channel: 'outlook',
      new: 0,
      urgent: 0,
      processed: 0,
      notified: 0,
    };

    if (!outlookScraper.isConfigured()) {
      await this.updateChannelStatus('outlook', {
        enabled: false,
        status: 'disabled',
        lastCheckAt: new Date(),
      });
      return result;
    }

    try {
      console.log('[CommunicationMonitor] Checking Outlook...');

      // Get new unread emails
      const emails = await outlookScraper.getNewEmails();
      result.new = emails.length;

      if (emails.length === 0) {
        await this.updateChannelStatus('outlook', {
          enabled: true,
          status: 'healthy',
          lastCheckAt: new Date(),
          lastSuccessAt: new Date(),
          sessionValid: true,
        });
        return result;
      }

      // Process each email through triage
      for (const email of emails) {
        const item = this.outlookEmailToItem(email);
        const triageResult = await communicationTriageService.triageItem(item);

        if (triageResult.importance === 'critical' || triageResult.importance === 'urgent') {
          result.urgent++;
        }

        const processResult = await communicationTriageService.processTriagedItem(
          item,
          triageResult
        );

        result.processed++;
        if (processResult.notified) {
          result.notified++;
          this.alertsSentToday++;
        }
      }

      await this.updateChannelStatus('outlook', {
        enabled: true,
        status: 'healthy',
        lastCheckAt: new Date(),
        lastSuccessAt: new Date(),
        unreadCount: result.new,
        urgentCount: result.urgent,
        sessionValid: true,
      });

      console.log(
        `[CommunicationMonitor] Outlook: ${result.new} new, ${result.urgent} urgent, ${result.notified} notified`
      );
    } catch (error) {
      result.error = String(error);
      console.error('[CommunicationMonitor] Outlook check failed:', error);

      await this.updateChannelStatus('outlook', {
        enabled: true,
        status: 'error',
        lastCheckAt: new Date(),
        error: result.error,
        sessionValid: false,
      });
    }

    return result;
  }

  /**
   * Check iMessage for new messages
   */
  async checkIMessage(): Promise<CheckResult> {
    const result: CheckResult = {
      channel: 'imessage',
      new: 0,
      urgent: 0,
      processed: 0,
      notified: 0,
    };

    if (!imessageIntegration.isConfigured()) {
      await this.updateChannelStatus('imessage', {
        enabled: false,
        status: 'disabled',
        lastCheckAt: new Date(),
      });
      return result;
    }

    try {
      console.log('[CommunicationMonitor] Checking iMessage...');

      // Check access
      const accessCheck = await imessageIntegration.checkAccess();
      if (!accessCheck.hasAccess) {
        await this.updateChannelStatus('imessage', {
          enabled: true,
          status: 'error',
          lastCheckAt: new Date(),
          error: accessCheck.error,
          hasAccess: false,
        });
        result.error = accessCheck.error;
        return result;
      }

      // Get new messages
      const messages = await imessageIntegration.getNewMessages();
      result.new = messages.length;

      if (messages.length === 0) {
        const stats = await imessageIntegration.getStats();
        await this.updateChannelStatus('imessage', {
          enabled: true,
          status: 'healthy',
          lastCheckAt: new Date(),
          lastSuccessAt: new Date(),
          unreadCount: stats.unreadCount,
          hasAccess: true,
        });
        return result;
      }

      // Process each message through triage
      for (const message of messages) {
        const item = this.imessageToItem(message);
        const triageResult = await communicationTriageService.triageItem(item);

        if (triageResult.importance === 'critical' || triageResult.importance === 'urgent') {
          result.urgent++;
        }

        const processResult = await communicationTriageService.processTriagedItem(
          item,
          triageResult
        );

        result.processed++;
        if (processResult.notified) {
          result.notified++;
          this.alertsSentToday++;
        }
      }

      const stats = await imessageIntegration.getStats();
      await this.updateChannelStatus('imessage', {
        enabled: true,
        status: 'healthy',
        lastCheckAt: new Date(),
        lastSuccessAt: new Date(),
        unreadCount: stats.unreadCount,
        urgentCount: result.urgent,
        hasAccess: true,
      });

      console.log(
        `[CommunicationMonitor] iMessage: ${result.new} new, ${result.urgent} urgent, ${result.notified} notified`
      );
    } catch (error) {
      result.error = String(error);
      console.error('[CommunicationMonitor] iMessage check failed:', error);

      await this.updateChannelStatus('imessage', {
        enabled: true,
        status: 'error',
        lastCheckAt: new Date(),
        error: result.error,
      });
    }

    return result;
  }

  /**
   * Check phone calls for missed calls
   */
  async checkPhoneCalls(): Promise<CheckResult> {
    const result: CheckResult = {
      channel: 'phone_call',
      new: 0,
      urgent: 0,
      processed: 0,
      notified: 0,
    };

    if (!phoneCallsIntegration.isConfigured()) {
      await this.updateChannelStatus('phone_call', {
        enabled: false,
        status: 'disabled',
        lastCheckAt: new Date(),
      });
      return result;
    }

    try {
      console.log('[CommunicationMonitor] Checking phone calls...');

      // Check access
      const accessCheck = await phoneCallsIntegration.checkAccess();
      if (!accessCheck.hasAccess) {
        await this.updateChannelStatus('phone_call', {
          enabled: true,
          status: 'error',
          lastCheckAt: new Date(),
          error: accessCheck.error,
          hasAccess: false,
        });
        result.error = accessCheck.error;
        return result;
      }

      // Get new missed calls
      const missedCalls = await phoneCallsIntegration.getNewMissedCalls();
      result.new = missedCalls.length;

      if (missedCalls.length === 0) {
        const stats = await phoneCallsIntegration.getStats();
        await this.updateChannelStatus('phone_call', {
          enabled: true,
          status: 'healthy',
          lastCheckAt: new Date(),
          lastSuccessAt: new Date(),
          unreadCount: stats.missedToday,
          hasAccess: true,
        });
        return result;
      }

      // Process each missed call through triage
      for (const call of missedCalls) {
        const item = this.phoneCallToItem(call);
        const triageResult = await communicationTriageService.triageItem(item);

        // Missed calls from VIP contacts are always urgent
        if (triageResult.importance === 'critical' || triageResult.importance === 'urgent') {
          result.urgent++;
        }

        const processResult = await communicationTriageService.processTriagedItem(
          item,
          triageResult
        );

        result.processed++;
        if (processResult.notified) {
          result.notified++;
          this.alertsSentToday++;
        }
      }

      const stats = await phoneCallsIntegration.getStats();
      await this.updateChannelStatus('phone_call', {
        enabled: true,
        status: 'healthy',
        lastCheckAt: new Date(),
        lastSuccessAt: new Date(),
        unreadCount: stats.missedToday,
        urgentCount: result.urgent,
        hasAccess: true,
      });

      console.log(
        `[CommunicationMonitor] Phone: ${result.new} missed, ${result.urgent} urgent, ${result.notified} notified`
      );
    } catch (error) {
      result.error = String(error);
      console.error('[CommunicationMonitor] Phone calls check failed:', error);

      await this.updateChannelStatus('phone_call', {
        enabled: true,
        status: 'error',
        lastCheckAt: new Date(),
        error: result.error,
      });
    }

    return result;
  }

  // ----------------------------------------
  // Item Conversion Methods
  // ----------------------------------------

  private outlookEmailToItem(email: OutlookEmail): CommunicationItem {
    return {
      id: `outlook-${email.id}`,
      channel: 'outlook',
      externalId: email.id,
      from: email.fromEmail || email.from,
      fromName: email.from,
      subject: email.subject,
      content: email.preview,
      receivedAt: email.receivedAt,
      metadata: {
        conversationId: email.conversationId,
        hasAttachments: email.hasAttachments,
      },
    };
  }

  private imessageToItem(message: iMessage): CommunicationItem {
    return {
      id: `imessage-${message.id}`,
      channel: message.serviceName === 'SMS' ? 'sms' : 'imessage',
      externalId: message.guid,
      from: message.fromHandle,
      fromName: message.fromName,
      content: message.text,
      receivedAt: message.date,
      metadata: {
        chatId: message.chatId,
        hasAttachments: message.hasAttachments,
        serviceName: message.serviceName,
      },
    };
  }

  private phoneCallToItem(call: PhoneCall): CommunicationItem {
    return {
      id: `call-${call.id}`,
      channel: 'phone_call',
      externalId: String(call.id),
      from: call.callerId,
      fromName: call.callerName,
      content: `Missed call from ${call.callerName || call.callerId}`,
      receivedAt: call.timestamp,
      callType: call.callType,
      callDuration: call.duration,
      metadata: {
        serviceName: call.serviceName,
        answered: call.answered,
      },
    };
  }

  // ----------------------------------------
  // Status Methods
  // ----------------------------------------

  /**
   * Get complete monitor status
   */
  async getStatus(): Promise<MonitorStatus> {
    this.resetDailyAlertsIfNeeded();

    const statuses = await db.select().from(communicationMonitorStatus);

    const statusMap = new Map<string, typeof statuses[0]>();
    for (const s of statuses) {
      statusMap.set(s.channel, s);
    }

    const getChannelStatus = (channel: string): ChannelStatus => {
      const s = statusMap.get(channel);
      if (!s) {
        return {
          enabled: false,
          status: 'disabled',
          lastCheckAt: null,
          lastSuccessAt: null,
          unreadCount: 0,
          urgentCount: 0,
        };
      }

      return {
        enabled: s.enabled,
        status: s.status as ChannelStatus['status'],
        lastCheckAt: s.lastCheckAt,
        lastSuccessAt: s.lastSuccessAt,
        unreadCount: s.unreadCount || 0,
        urgentCount: s.urgentCount || 0,
        error: s.lastErrorMessage || undefined,
        sessionValid: s.sessionValid ?? undefined,
        hasAccess: s.hasAccess ?? undefined,
      };
    };

    return {
      gmail: getChannelStatus('gmail'),
      outlook: getChannelStatus('outlook'),
      imessage: getChannelStatus('imessage'),
      phoneCalls: getChannelStatus('phone_call'),
      lastTriageRun: null, // TODO: Track this
      alertsSentToday: this.alertsSentToday,
      pendingInTriage: 0, // TODO: Track pending queue
    };
  }

  /**
   * Run all channel checks
   */
  async runAllChecks(): Promise<{
    outlook: CheckResult;
    imessage: CheckResult;
    phoneCalls: CheckResult;
    totalNew: number;
    totalUrgent: number;
    totalNotified: number;
  }> {
    console.log('[CommunicationMonitor] Running all channel checks...');

    const outlook = await this.checkOutlook();
    const imessage = await this.checkIMessage();
    const phoneCalls = await this.checkPhoneCalls();

    const totalNew = outlook.new + imessage.new + phoneCalls.new;
    const totalUrgent = outlook.urgent + imessage.urgent + phoneCalls.urgent;
    const totalNotified = outlook.notified + imessage.notified + phoneCalls.notified;

    console.log(
      `[CommunicationMonitor] All checks complete: ${totalNew} new, ${totalUrgent} urgent, ${totalNotified} notified`
    );

    return {
      outlook,
      imessage,
      phoneCalls,
      totalNew,
      totalUrgent,
      totalNotified,
    };
  }

  /**
   * Send daily digest of communications
   */
  async sendDailyDigest(): Promise<{ itemsIncluded: number }> {
    // TODO: Implement daily digest compilation
    // This would summarize batch-priority items
    console.log('[CommunicationMonitor] Daily digest not yet implemented');
    return { itemsIncluded: 0 };
  }
}

// Export singleton instance
export const communicationMonitorService = new CommunicationMonitorService();

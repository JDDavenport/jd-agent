/**
 * JD Agent - Gmail Integration
 * 
 * Monitors Gmail inbox for new emails:
 * - Fetches unread and recent emails
 * - Triages emails for action required
 * - Extracts tasks from actionable emails
 * - Drafts replies (with approval)
 */

import { google, gmail_v1 } from 'googleapis';
import { addEmailTriageJob } from '../jobs/queue';

// ============================================
// Types
// ============================================

export interface Email {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  snippet: string;
  receivedAt: Date;
  isUnread: boolean;
  labels: string[];
}

export interface EmailTriageResult {
  emailId: string;
  actionRequired: boolean;
  priority: 'urgent' | 'normal' | 'low';
  category: 'action' | 'fyi' | 'spam' | 'personal';
  suggestedTask?: string;
  suggestedReply?: string;
}

// ============================================
// Gmail Integration
// ============================================

export class GmailIntegration {
  private gmail: gmail_v1.Gmail | null = null;
  private auth: any = null;
  private isConfigured = false;
  private userEmail: string = '';
  private prioritySenders: Set<string> = new Set();

  constructor() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    
    this.userEmail = process.env.GOOGLE_USER_EMAIL || '';

    if (clientId && clientSecret && refreshToken) {
      this.auth = new google.auth.OAuth2(clientId, clientSecret);
      this.auth.setCredentials({ refresh_token: refreshToken });
      
      this.gmail = google.gmail({ version: 'v1', auth: this.auth });
      this.isConfigured = true;
      
      console.log('[Gmail] Integration initialized');
    } else {
      console.log('[Gmail] Not configured - set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN');
    }

    // Initialize priority senders (can be configured via env or database)
    this.initializePrioritySenders();
  }

  /**
   * Initialize list of priority senders
   */
  private initializePrioritySenders() {
    const priorityList = process.env.PRIORITY_SENDERS || '';
    const senders = priorityList.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    this.prioritySenders = new Set(senders);
  }

  /**
   * Check if Gmail is configured
   */
  isReady(): boolean {
    return this.isConfigured && this.gmail !== null;
  }

  /**
   * Get recent emails (unread + last 24 hours)
   */
  async getRecentEmails(maxResults = 50): Promise<Email[]> {
    if (!this.gmail) {
      console.error('[Gmail] Not configured');
      return [];
    }

    try {
      // Query for unread or recent emails
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: 'is:unread OR newer_than:1d',
      });

      const messages = response.data.messages || [];
      const emails: Email[] = [];

      for (const msg of messages) {
        if (!msg.id) continue;
        
        const email = await this.getEmail(msg.id);
        if (email) {
          emails.push(email);
        }
      }

      console.log(`[Gmail] Fetched ${emails.length} recent emails`);
      return emails;
    } catch (error) {
      console.error('[Gmail] Failed to fetch emails:', error);
      return [];
    }
  }

  /**
   * Get a single email by ID
   */
  async getEmail(messageId: string): Promise<Email | null> {
    if (!this.gmail) return null;

    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const message = response.data;
      if (!message) return null;

      // Parse headers
      const headers = message.payload?.headers || [];
      const getHeader = (name: string) => 
        headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

      // Parse body
      let body = '';
      if (message.payload?.body?.data) {
        body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
      } else if (message.payload?.parts) {
        const textPart = message.payload.parts.find(p => p.mimeType === 'text/plain');
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
        }
      }

      return {
        id: message.id!,
        threadId: message.threadId || '',
        from: getHeader('From'),
        to: getHeader('To'),
        subject: getHeader('Subject'),
        body,
        snippet: message.snippet || '',
        receivedAt: new Date(parseInt(message.internalDate || '0')),
        isUnread: (message.labelIds || []).includes('UNREAD'),
        labels: message.labelIds || [],
      };
    } catch (error) {
      console.error(`[Gmail] Failed to get email ${messageId}:`, error);
      return null;
    }
  }

  /**
   * Check if sender is a priority sender
   */
  isPrioritySender(email: Email): boolean {
    const fromLower = email.from.toLowerCase();
    return Array.from(this.prioritySenders).some(sender => fromLower.includes(sender));
  }

  /**
   * Queue emails for triage processing
   */
  async queueEmailsForTriage(): Promise<{ queued: number; skipped: number }> {
    let queued = 0;
    let skipped = 0;

    try {
      const emails = await this.getRecentEmails(30);

      for (const email of emails) {
        // Skip emails from self
        if (email.from.includes(this.userEmail)) {
          skipped++;
          continue;
        }

        // Queue for triage
        await addEmailTriageJob({
          emailId: email.id,
          from: email.from,
          subject: email.subject,
          body: email.body || email.snippet,
          receivedAt: email.receivedAt,
        });
        queued++;
      }

      console.log(`[Gmail] Queued ${queued} emails for triage, skipped ${skipped}`);
    } catch (error) {
      console.error('[Gmail] Failed to queue emails:', error);
    }

    return { queued, skipped };
  }

  /**
   * Mark email as read
   */
  async markAsRead(messageId: string): Promise<boolean> {
    if (!this.gmail) return false;

    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['UNREAD'],
        },
      });
      return true;
    } catch (error) {
      console.error(`[Gmail] Failed to mark ${messageId} as read:`, error);
      return false;
    }
  }

  /**
   * Add label to email
   */
  async addLabel(messageId: string, labelName: string): Promise<boolean> {
    if (!this.gmail) return false;

    try {
      // First, get or create the label
      const labelId = await this.getOrCreateLabel(labelName);
      if (!labelId) return false;

      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: [labelId],
        },
      });
      return true;
    } catch (error) {
      console.error(`[Gmail] Failed to add label to ${messageId}:`, error);
      return false;
    }
  }

  /**
   * Get or create a label
   */
  private async getOrCreateLabel(labelName: string): Promise<string | null> {
    if (!this.gmail) return null;

    try {
      // List existing labels
      const response = await this.gmail.users.labels.list({ userId: 'me' });
      const labels = response.data.labels || [];
      
      const existing = labels.find(l => l.name === labelName);
      if (existing?.id) return existing.id;

      // Create new label
      const createResponse = await this.gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: labelName,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
        },
      });

      return createResponse.data.id || null;
    } catch (error) {
      console.error(`[Gmail] Failed to get/create label ${labelName}:`, error);
      return null;
    }
  }

  /**
   * Send an email (for replies and notifications)
   */
  async sendEmail(to: string, subject: string, body: string, threadId?: string): Promise<boolean> {
    if (!this.gmail) return false;

    try {
      const message = [
        `To: ${to}`,
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        body,
      ].join('\n');

      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
          threadId,
        },
      });

      console.log(`[Gmail] Sent email to ${to}`);
      return true;
    } catch (error) {
      console.error('[Gmail] Failed to send email:', error);
      return false;
    }
  }

  /**
   * Get status
   */
  getStatus(): {
    configured: boolean;
    userEmail: string;
    prioritySendersCount: number;
  } {
    return {
      configured: this.isConfigured,
      userEmail: this.userEmail,
      prioritySendersCount: this.prioritySenders.size,
    };
  }
}

// ============================================
// Singleton instance
// ============================================

export const gmailIntegration = new GmailIntegration();

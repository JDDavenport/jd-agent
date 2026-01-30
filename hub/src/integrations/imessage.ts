/**
 * JD Agent - iMessage/SMS Integration
 *
 * Monitors iMessage and SMS messages on macOS by reading the local
 * Messages database at ~/Library/Messages/chat.db
 *
 * Requirements:
 * - macOS only
 * - Full Disk Access permission for the process
 * - Messages app must be syncing with iCloud
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================
// Types
// ============================================

export interface iMessage {
  id: number;
  guid: string;
  text: string;
  fromHandle: string; // Phone number or email
  fromName?: string;
  isFromMe: boolean;
  date: Date;
  chatId: string;
  serviceName: string; // 'iMessage' or 'SMS'
  isRead: boolean;
  hasAttachments: boolean;
}

export interface iMessageConfig {
  enabled?: boolean;
  dbPath?: string;
  contactsDbPath?: string;
}

// ============================================
// Constants
// ============================================

const DEFAULT_MESSAGES_DB = path.join(
  process.env.HOME || '',
  'Library/Messages/chat.db'
);

const DEFAULT_CONTACTS_DB = path.join(
  process.env.HOME || '',
  'Library/Application Support/AddressBook/Sources'
);

// macOS stores dates as nanoseconds since 2001-01-01 (Mac epoch)
// We need to convert to JavaScript Date (milliseconds since 1970-01-01)
const MAC_EPOCH_OFFSET = 978307200; // Seconds between 1970 and 2001

// ============================================
// iMessage Integration
// ============================================

export class iMessageIntegration {
  private config: Required<iMessageConfig>;
  private lastCheckedRowId: number = 0;
  private db: any = null; // better-sqlite3 instance
  private contactsCache: Map<string, string> = new Map();

  constructor(config: iMessageConfig = {}) {
    this.config = {
      enabled: config.enabled ?? process.env.IMESSAGE_ENABLED === 'true',
      dbPath: config.dbPath ?? DEFAULT_MESSAGES_DB,
      contactsDbPath: config.contactsDbPath ?? DEFAULT_CONTACTS_DB,
    };

    if (this.config.enabled) {
      console.log('[iMessage] Integration enabled');
    } else {
      console.log('[iMessage] Integration disabled - set IMESSAGE_ENABLED=true');
    }
  }

  /**
   * Check if integration is configured
   */
  isConfigured(): boolean {
    return this.config.enabled && process.platform === 'darwin';
  }

  /**
   * Check if we have access to the Messages database
   */
  async checkAccess(): Promise<{
    hasAccess: boolean;
    error?: string;
  }> {
    if (process.platform !== 'darwin') {
      return { hasAccess: false, error: 'Not running on macOS' };
    }

    if (!fs.existsSync(this.config.dbPath)) {
      return { hasAccess: false, error: 'Messages database not found' };
    }

    try {
      // Try to open the database
      const Database = require('better-sqlite3');
      const db = new Database(this.config.dbPath, { readonly: true });

      // Test query
      db.prepare('SELECT 1 FROM message LIMIT 1').get();
      db.close();

      return { hasAccess: true };
    } catch (error: any) {
      if (error.code === 'SQLITE_CANTOPEN') {
        return {
          hasAccess: false,
          error:
            'Full Disk Access required. Go to System Preferences > Privacy & Security > Full Disk Access and add Terminal/your IDE.',
        };
      }
      return { hasAccess: false, error: String(error) };
    }
  }

  /**
   * Initialize the database connection
   */
  private async initDb(): Promise<boolean> {
    if (this.db) return true;

    try {
      const Database = require('better-sqlite3');
      this.db = new Database(this.config.dbPath, { readonly: true });
      console.log('[iMessage] Database connection established');
      return true;
    } catch (error) {
      console.error('[iMessage] Failed to open database:', error);
      return false;
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('[iMessage] Database connection closed');
    }
  }

  /**
   * Convert macOS date to JavaScript Date
   */
  private macDateToJS(macDate: number): Date {
    // macOS stores dates as nanoseconds since 2001-01-01
    const seconds = macDate / 1000000000 + MAC_EPOCH_OFFSET;
    return new Date(seconds * 1000);
  }

  /**
   * Get recent messages
   */
  async getRecentMessages(limit: number = 50): Promise<iMessage[]> {
    if (!await this.initDb()) {
      return [];
    }

    try {
      const query = `
        SELECT
          m.ROWID as id,
          m.guid,
          COALESCE(m.text, '') as text,
          COALESCE(h.id, '') as from_handle,
          m.is_from_me,
          m.date as mac_date,
          COALESCE(c.chat_identifier, '') as chat_id,
          COALESCE(m.service, 'iMessage') as service,
          m.is_read,
          CASE WHEN ma.ROWID IS NOT NULL THEN 1 ELSE 0 END as has_attachments
        FROM message m
        LEFT JOIN handle h ON m.handle_id = h.ROWID
        LEFT JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
        LEFT JOIN chat c ON cmj.chat_id = c.ROWID
        LEFT JOIN message_attachment_join ma ON m.ROWID = ma.message_id
        WHERE m.text IS NOT NULL AND m.text != ''
        ORDER BY m.ROWID DESC
        LIMIT ?
      `;

      const rows = this.db.prepare(query).all(limit);

      return rows.map((row: any) => ({
        id: row.id,
        guid: row.guid,
        text: row.text,
        fromHandle: row.from_handle,
        fromName: this.getContactName(row.from_handle),
        isFromMe: row.is_from_me === 1,
        date: this.macDateToJS(row.mac_date),
        chatId: row.chat_id,
        serviceName: row.service,
        isRead: row.is_read === 1,
        hasAttachments: row.has_attachments === 1,
      }));
    } catch (error) {
      console.error('[iMessage] Failed to get messages:', error);
      return [];
    }
  }

  /**
   * Get new messages since last check
   */
  async getNewMessages(): Promise<iMessage[]> {
    if (!await this.initDb()) {
      return [];
    }

    try {
      const query = `
        SELECT
          m.ROWID as id,
          m.guid,
          COALESCE(m.text, '') as text,
          COALESCE(h.id, '') as from_handle,
          m.is_from_me,
          m.date as mac_date,
          COALESCE(c.chat_identifier, '') as chat_id,
          COALESCE(m.service, 'iMessage') as service,
          m.is_read,
          CASE WHEN ma.ROWID IS NOT NULL THEN 1 ELSE 0 END as has_attachments
        FROM message m
        LEFT JOIN handle h ON m.handle_id = h.ROWID
        LEFT JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
        LEFT JOIN chat c ON cmj.chat_id = c.ROWID
        LEFT JOIN message_attachment_join ma ON m.ROWID = ma.message_id
        WHERE m.ROWID > ?
          AND m.text IS NOT NULL
          AND m.text != ''
          AND m.is_from_me = 0
        ORDER BY m.ROWID ASC
        LIMIT 100
      `;

      const rows = this.db.prepare(query).all(this.lastCheckedRowId);

      if (rows.length > 0) {
        // Update last checked ID to the highest seen
        this.lastCheckedRowId = Math.max(...rows.map((r: any) => r.id));
      }

      return rows.map((row: any) => ({
        id: row.id,
        guid: row.guid,
        text: row.text,
        fromHandle: row.from_handle,
        fromName: this.getContactName(row.from_handle),
        isFromMe: row.is_from_me === 1,
        date: this.macDateToJS(row.mac_date),
        chatId: row.chat_id,
        serviceName: row.service,
        isRead: row.is_read === 1,
        hasAttachments: row.has_attachments === 1,
      }));
    } catch (error) {
      console.error('[iMessage] Failed to get new messages:', error);
      return [];
    }
  }

  /**
   * Get unread messages
   */
  async getUnreadMessages(): Promise<iMessage[]> {
    if (!await this.initDb()) {
      return [];
    }

    try {
      const query = `
        SELECT
          m.ROWID as id,
          m.guid,
          COALESCE(m.text, '') as text,
          COALESCE(h.id, '') as from_handle,
          m.is_from_me,
          m.date as mac_date,
          COALESCE(c.chat_identifier, '') as chat_id,
          COALESCE(m.service, 'iMessage') as service,
          m.is_read,
          CASE WHEN ma.ROWID IS NOT NULL THEN 1 ELSE 0 END as has_attachments
        FROM message m
        LEFT JOIN handle h ON m.handle_id = h.ROWID
        LEFT JOIN chat_message_join cmj ON m.ROWID = cmj.message_id
        LEFT JOIN chat c ON cmj.chat_id = c.ROWID
        LEFT JOIN message_attachment_join ma ON m.ROWID = ma.message_id
        WHERE m.is_read = 0
          AND m.is_from_me = 0
          AND m.text IS NOT NULL
          AND m.text != ''
        ORDER BY m.ROWID DESC
        LIMIT 100
      `;

      const rows = this.db.prepare(query).all();

      return rows.map((row: any) => ({
        id: row.id,
        guid: row.guid,
        text: row.text,
        fromHandle: row.from_handle,
        fromName: this.getContactName(row.from_handle),
        isFromMe: row.is_from_me === 1,
        date: this.macDateToJS(row.mac_date),
        chatId: row.chat_id,
        serviceName: row.service,
        isRead: row.is_read === 1,
        hasAttachments: row.has_attachments === 1,
      }));
    } catch (error) {
      console.error('[iMessage] Failed to get unread messages:', error);
      return [];
    }
  }

  /**
   * Get contact name from handle (phone number or email)
   * Uses a cache to avoid repeated lookups
   */
  private getContactName(handle: string): string | undefined {
    if (!handle) return undefined;

    // Check cache first
    if (this.contactsCache.has(handle)) {
      return this.contactsCache.get(handle);
    }

    // TODO: Implement contacts lookup from AddressBook database
    // For now, return undefined and let the caller handle it
    return undefined;
  }

  /**
   * Get statistics for system health display
   */
  async getStats(): Promise<{
    unreadCount: number;
    totalRecent: number;
    lastMessageAt: Date | null;
  }> {
    if (!await this.initDb()) {
      return { unreadCount: 0, totalRecent: 0, lastMessageAt: null };
    }

    try {
      // Count unread messages
      const unreadResult = this.db
        .prepare(
          `
          SELECT COUNT(*) as count
          FROM message
          WHERE is_read = 0
            AND is_from_me = 0
            AND text IS NOT NULL
        `
        )
        .get();

      // Get latest message date
      const latestResult = this.db
        .prepare(
          `
          SELECT MAX(date) as latest_date
          FROM message
          WHERE text IS NOT NULL
        `
        )
        .get();

      // Count messages in last 24 hours
      const oneDayAgo =
        ((Date.now() / 1000 - MAC_EPOCH_OFFSET) * 1000000000).toString();
      const recentResult = this.db
        .prepare(
          `
          SELECT COUNT(*) as count
          FROM message
          WHERE date > ?
            AND text IS NOT NULL
        `
        )
        .get(oneDayAgo);

      return {
        unreadCount: unreadResult?.count || 0,
        totalRecent: recentResult?.count || 0,
        lastMessageAt: latestResult?.latest_date
          ? this.macDateToJS(latestResult.latest_date)
          : null,
      };
    } catch (error) {
      console.error('[iMessage] Failed to get stats:', error);
      return { unreadCount: 0, totalRecent: 0, lastMessageAt: null };
    }
  }

  /**
   * Set the starting point for new message checks
   */
  async setCheckpoint(): Promise<void> {
    if (!await this.initDb()) return;

    try {
      const result = this.db
        .prepare('SELECT MAX(ROWID) as max_id FROM message')
        .get();
      this.lastCheckedRowId = result?.max_id || 0;
      console.log(`[iMessage] Checkpoint set to message ID: ${this.lastCheckedRowId}`);
    } catch (error) {
      console.error('[iMessage] Failed to set checkpoint:', error);
    }
  }

  /**
   * Get integration status for system health
   */
  async getStatus(): Promise<{
    enabled: boolean;
    hasAccess: boolean;
    unreadCount: number;
    lastCheck: Date;
    error?: string;
  }> {
    const enabled = this.isConfigured();
    let hasAccess = false;
    let unreadCount = 0;
    let error: string | undefined;

    if (enabled) {
      const accessCheck = await this.checkAccess();
      hasAccess = accessCheck.hasAccess;
      error = accessCheck.error;

      if (hasAccess) {
        const stats = await this.getStats();
        unreadCount = stats.unreadCount;
      }
    }

    return {
      enabled,
      hasAccess,
      unreadCount,
      lastCheck: new Date(),
      error,
    };
  }
}

// Export singleton instance
export const imessageIntegration = new iMessageIntegration();

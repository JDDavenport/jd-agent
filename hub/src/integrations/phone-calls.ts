/**
 * JD Agent - Phone Call Integration
 *
 * Monitors phone calls on macOS via the CallKit database.
 * Detects missed calls and can trigger notifications.
 *
 * Requirements:
 * - macOS only
 * - iPhone paired with Mac via Continuity
 * - Full Disk Access permission
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================
// Types
// ============================================

export interface PhoneCall {
  id: number;
  callerId: string;
  callerName?: string;
  callType: 'incoming' | 'outgoing' | 'missed';
  duration: number; // seconds, 0 for missed
  timestamp: Date;
  answered: boolean;
  serviceName?: string; // 'FaceTime', 'Phone', etc.
}

export interface PhoneCallsConfig {
  enabled?: boolean;
  dbPath?: string;
}

// ============================================
// Constants
// ============================================

const DEFAULT_CALLS_DB = path.join(
  process.env.HOME || '',
  'Library/Application Support/CallHistoryDB/CallHistory.storedata'
);

// Core Data epoch (2001-01-01)
const CORE_DATA_EPOCH_OFFSET = 978307200;

// ============================================
// Phone Calls Integration
// ============================================

export class PhoneCallsIntegration {
  private config: Required<PhoneCallsConfig>;
  private db: any = null;
  private lastCheckedId: number = 0;

  constructor(config: PhoneCallsConfig = {}) {
    this.config = {
      enabled: config.enabled ?? process.env.PHONE_CALLS_ENABLED === 'true',
      dbPath: config.dbPath ?? DEFAULT_CALLS_DB,
    };

    if (this.config.enabled) {
      console.log('[PhoneCalls] Integration enabled');
    } else {
      console.log('[PhoneCalls] Integration disabled - set PHONE_CALLS_ENABLED=true');
    }
  }

  /**
   * Check if integration is configured
   */
  isConfigured(): boolean {
    return this.config.enabled && process.platform === 'darwin';
  }

  /**
   * Check if we have access to the call history database
   */
  async checkAccess(): Promise<{
    hasAccess: boolean;
    error?: string;
  }> {
    if (process.platform !== 'darwin') {
      return { hasAccess: false, error: 'Not running on macOS' };
    }

    if (!fs.existsSync(this.config.dbPath)) {
      return {
        hasAccess: false,
        error: 'Call history database not found. Make sure Continuity is enabled.',
      };
    }

    try {
      const Database = require('better-sqlite3');
      const db = new Database(this.config.dbPath, { readonly: true });

      // Test query - CallHistory uses Core Data format
      db.prepare('SELECT 1 FROM ZCALLRECORD LIMIT 1').get();
      db.close();

      return { hasAccess: true };
    } catch (error: any) {
      if (error.code === 'SQLITE_CANTOPEN') {
        return {
          hasAccess: false,
          error:
            'Full Disk Access required. Go to System Preferences > Privacy & Security > Full Disk Access.',
        };
      }
      if (error.message?.includes('no such table')) {
        return {
          hasAccess: false,
          error: 'Call history table not found. Database may be from a different macOS version.',
        };
      }
      return { hasAccess: false, error: String(error) };
    }
  }

  /**
   * Initialize database connection
   */
  private async initDb(): Promise<boolean> {
    if (this.db) return true;

    try {
      const Database = require('better-sqlite3');
      this.db = new Database(this.config.dbPath, { readonly: true });
      console.log('[PhoneCalls] Database connection established');
      return true;
    } catch (error) {
      console.error('[PhoneCalls] Failed to open database:', error);
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
      console.log('[PhoneCalls] Database connection closed');
    }
  }

  /**
   * Convert Core Data timestamp to JavaScript Date
   */
  private coreDataDateToJS(coreDataDate: number): Date {
    const seconds = coreDataDate + CORE_DATA_EPOCH_OFFSET;
    return new Date(seconds * 1000);
  }

  /**
   * Determine call type from database values
   */
  private getCallType(
    callType: number,
    answered: number
  ): 'incoming' | 'outgoing' | 'missed' {
    // callType: 1 = incoming, 0 = outgoing
    if (callType === 1 && answered === 0) {
      return 'missed';
    }
    return callType === 1 ? 'incoming' : 'outgoing';
  }

  /**
   * Get recent calls
   */
  async getRecentCalls(limit: number = 50): Promise<PhoneCall[]> {
    if (!await this.initDb()) {
      return [];
    }

    try {
      const query = `
        SELECT
          Z_PK as id,
          ZADDRESS as caller_id,
          ZNAME as caller_name,
          ZCALLTYPE as call_type,
          ZDURATION as duration,
          ZDATE as timestamp,
          ZANSWERED as answered,
          ZSERVICE_PROVIDER as service
        FROM ZCALLRECORD
        ORDER BY ZDATE DESC
        LIMIT ?
      `;

      const rows = this.db.prepare(query).all(limit);

      return rows.map((row: any) => ({
        id: row.id,
        callerId: row.caller_id || 'Unknown',
        callerName: row.caller_name || undefined,
        callType: this.getCallType(row.call_type, row.answered),
        duration: row.duration || 0,
        timestamp: this.coreDataDateToJS(row.timestamp),
        answered: row.answered === 1,
        serviceName: row.service || undefined,
      }));
    } catch (error) {
      console.error('[PhoneCalls] Failed to get recent calls:', error);
      return [];
    }
  }

  /**
   * Get missed calls
   */
  async getMissedCalls(since?: Date): Promise<PhoneCall[]> {
    if (!await this.initDb()) {
      return [];
    }

    try {
      let query: string;
      let params: any[];

      if (since) {
        const coreDataTimestamp = since.getTime() / 1000 - CORE_DATA_EPOCH_OFFSET;
        query = `
          SELECT
            Z_PK as id,
            ZADDRESS as caller_id,
            ZNAME as caller_name,
            ZCALLTYPE as call_type,
            ZDURATION as duration,
            ZDATE as timestamp,
            ZANSWERED as answered,
            ZSERVICE_PROVIDER as service
          FROM ZCALLRECORD
          WHERE ZANSWERED = 0
            AND ZCALLTYPE = 1
            AND ZDATE > ?
          ORDER BY ZDATE DESC
        `;
        params = [coreDataTimestamp];
      } else {
        query = `
          SELECT
            Z_PK as id,
            ZADDRESS as caller_id,
            ZNAME as caller_name,
            ZCALLTYPE as call_type,
            ZDURATION as duration,
            ZDATE as timestamp,
            ZANSWERED as answered,
            ZSERVICE_PROVIDER as service
          FROM ZCALLRECORD
          WHERE ZANSWERED = 0
            AND ZCALLTYPE = 1
          ORDER BY ZDATE DESC
          LIMIT 50
        `;
        params = [];
      }

      const rows = this.db.prepare(query).all(...params);

      return rows.map((row: any) => ({
        id: row.id,
        callerId: row.caller_id || 'Unknown',
        callerName: row.caller_name || undefined,
        callType: 'missed' as const,
        duration: 0,
        timestamp: this.coreDataDateToJS(row.timestamp),
        answered: false,
        serviceName: row.service || undefined,
      }));
    } catch (error) {
      console.error('[PhoneCalls] Failed to get missed calls:', error);
      return [];
    }
  }

  /**
   * Get new missed calls since last check
   */
  async getNewMissedCalls(): Promise<PhoneCall[]> {
    if (!await this.initDb()) {
      return [];
    }

    try {
      const query = `
        SELECT
          Z_PK as id,
          ZADDRESS as caller_id,
          ZNAME as caller_name,
          ZCALLTYPE as call_type,
          ZDURATION as duration,
          ZDATE as timestamp,
          ZANSWERED as answered,
          ZSERVICE_PROVIDER as service
        FROM ZCALLRECORD
        WHERE Z_PK > ?
          AND ZANSWERED = 0
          AND ZCALLTYPE = 1
        ORDER BY Z_PK ASC
        LIMIT 50
      `;

      const rows = this.db.prepare(query).all(this.lastCheckedId);

      if (rows.length > 0) {
        // Update last checked ID
        this.lastCheckedId = Math.max(...rows.map((r: any) => r.id));
      }

      return rows.map((row: any) => ({
        id: row.id,
        callerId: row.caller_id || 'Unknown',
        callerName: row.caller_name || undefined,
        callType: 'missed' as const,
        duration: 0,
        timestamp: this.coreDataDateToJS(row.timestamp),
        answered: false,
        serviceName: row.service || undefined,
      }));
    } catch (error) {
      console.error('[PhoneCalls] Failed to get new missed calls:', error);
      return [];
    }
  }

  /**
   * Get statistics for system health
   */
  async getStats(): Promise<{
    missedToday: number;
    totalToday: number;
    lastCallAt: Date | null;
  }> {
    if (!await this.initDb()) {
      return { missedToday: 0, totalToday: 0, lastCallAt: null };
    }

    try {
      // Start of today in Core Data timestamp
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const todayTimestamp = startOfDay.getTime() / 1000 - CORE_DATA_EPOCH_OFFSET;

      // Count missed calls today
      const missedResult = this.db
        .prepare(
          `
          SELECT COUNT(*) as count
          FROM ZCALLRECORD
          WHERE ZANSWERED = 0
            AND ZCALLTYPE = 1
            AND ZDATE >= ?
        `
        )
        .get(todayTimestamp);

      // Count total calls today
      const totalResult = this.db
        .prepare(
          `
          SELECT COUNT(*) as count
          FROM ZCALLRECORD
          WHERE ZDATE >= ?
        `
        )
        .get(todayTimestamp);

      // Get latest call
      const latestResult = this.db
        .prepare(
          `
          SELECT MAX(ZDATE) as latest_date
          FROM ZCALLRECORD
        `
        )
        .get();

      return {
        missedToday: missedResult?.count || 0,
        totalToday: totalResult?.count || 0,
        lastCallAt: latestResult?.latest_date
          ? this.coreDataDateToJS(latestResult.latest_date)
          : null,
      };
    } catch (error) {
      console.error('[PhoneCalls] Failed to get stats:', error);
      return { missedToday: 0, totalToday: 0, lastCallAt: null };
    }
  }

  /**
   * Set checkpoint for new call detection
   */
  async setCheckpoint(): Promise<void> {
    if (!await this.initDb()) return;

    try {
      const result = this.db
        .prepare('SELECT MAX(Z_PK) as max_id FROM ZCALLRECORD')
        .get();
      this.lastCheckedId = result?.max_id || 0;
      console.log(`[PhoneCalls] Checkpoint set to call ID: ${this.lastCheckedId}`);
    } catch (error) {
      console.error('[PhoneCalls] Failed to set checkpoint:', error);
    }
  }

  /**
   * Get integration status for system health
   */
  async getStatus(): Promise<{
    enabled: boolean;
    hasAccess: boolean;
    missedToday: number;
    lastCheck: Date;
    error?: string;
  }> {
    const enabled = this.isConfigured();
    let hasAccess = false;
    let missedToday = 0;
    let error: string | undefined;

    if (enabled) {
      const accessCheck = await this.checkAccess();
      hasAccess = accessCheck.hasAccess;
      error = accessCheck.error;

      if (hasAccess) {
        const stats = await this.getStats();
        missedToday = stats.missedToday;
      }
    }

    return {
      enabled,
      hasAccess,
      missedToday,
      lastCheck: new Date(),
      error,
    };
  }
}

// Export singleton instance
export const phoneCallsIntegration = new PhoneCallsIntegration();

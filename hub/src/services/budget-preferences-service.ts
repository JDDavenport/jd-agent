/**
 * Budget Preferences Service
 *
 * Manages user preferences for budget reports and alerts.
 */

import { db } from '../db/client';
import { budgetReportPreferences } from '../db/schema';
import { eq } from 'drizzle-orm';

// ============================================
// Types
// ============================================

export interface BudgetPreferences {
  id: string;
  // Daily report settings
  dailyEmailEnabled: boolean;
  dailySmsEnabled: boolean;
  dailyTime: string; // HH:MM format
  // Weekly report settings
  weeklyEmailEnabled: boolean;
  weeklySmsEnabled: boolean;
  weeklyDay: number; // 0 = Sunday, 6 = Saturday
  weeklyTime: string; // HH:MM format
  // Alert settings
  alertsEnabled: boolean;
  largeTransactionThresholdCents: number;
  unusualSpendingMultiplier: number;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdatePreferencesInput {
  dailyEmailEnabled?: boolean;
  dailySmsEnabled?: boolean;
  dailyTime?: string;
  weeklyEmailEnabled?: boolean;
  weeklySmsEnabled?: boolean;
  weeklyDay?: number;
  weeklyTime?: string;
  alertsEnabled?: boolean;
  largeTransactionThresholdCents?: number;
  unusualSpendingMultiplier?: number;
}

// ============================================
// Default Preferences
// ============================================

const DEFAULT_PREFERENCES: Omit<BudgetPreferences, 'id' | 'createdAt' | 'updatedAt'> = {
  dailyEmailEnabled: true,
  dailySmsEnabled: true,
  dailyTime: '07:00',
  weeklyEmailEnabled: true,
  weeklySmsEnabled: true,
  weeklyDay: 0, // Sunday
  weeklyTime: '09:00',
  alertsEnabled: true,
  largeTransactionThresholdCents: 10000, // $100
  unusualSpendingMultiplier: 2.0,
};

// ============================================
// Budget Preferences Service
// ============================================

class BudgetPreferencesService {
  /**
   * Get or create preferences (singleton pattern - only one row)
   */
  async getPreferences(): Promise<BudgetPreferences> {
    // Try to get existing preferences
    const [existing] = await db
      .select()
      .from(budgetReportPreferences)
      .limit(1);

    if (existing) {
      return {
        id: existing.id,
        dailyEmailEnabled: existing.dailyEmailEnabled,
        dailySmsEnabled: existing.dailySmsEnabled,
        dailyTime: existing.dailyTime,
        weeklyEmailEnabled: existing.weeklyEmailEnabled,
        weeklySmsEnabled: existing.weeklySmsEnabled,
        weeklyDay: existing.weeklyDay,
        weeklyTime: existing.weeklyTime,
        alertsEnabled: existing.alertsEnabled,
        largeTransactionThresholdCents: existing.largeTransactionThresholdCents,
        unusualSpendingMultiplier: existing.unusualSpendingMultiplier,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
      };
    }

    // Create default preferences
    const [created] = await db
      .insert(budgetReportPreferences)
      .values({
        dailyEmailEnabled: DEFAULT_PREFERENCES.dailyEmailEnabled,
        dailySmsEnabled: DEFAULT_PREFERENCES.dailySmsEnabled,
        dailyTime: DEFAULT_PREFERENCES.dailyTime,
        weeklyEmailEnabled: DEFAULT_PREFERENCES.weeklyEmailEnabled,
        weeklySmsEnabled: DEFAULT_PREFERENCES.weeklySmsEnabled,
        weeklyDay: DEFAULT_PREFERENCES.weeklyDay,
        weeklyTime: DEFAULT_PREFERENCES.weeklyTime,
        alertsEnabled: DEFAULT_PREFERENCES.alertsEnabled,
        largeTransactionThresholdCents: DEFAULT_PREFERENCES.largeTransactionThresholdCents,
        unusualSpendingMultiplier: DEFAULT_PREFERENCES.unusualSpendingMultiplier,
      })
      .returning();

    return {
      id: created.id,
      dailyEmailEnabled: created.dailyEmailEnabled,
      dailySmsEnabled: created.dailySmsEnabled,
      dailyTime: created.dailyTime,
      weeklyEmailEnabled: created.weeklyEmailEnabled,
      weeklySmsEnabled: created.weeklySmsEnabled,
      weeklyDay: created.weeklyDay,
      weeklyTime: created.weeklyTime,
      alertsEnabled: created.alertsEnabled,
      largeTransactionThresholdCents: created.largeTransactionThresholdCents,
      unusualSpendingMultiplier: created.unusualSpendingMultiplier,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  }

  /**
   * Update preferences
   */
  async updatePreferences(input: UpdatePreferencesInput): Promise<BudgetPreferences> {
    // Ensure preferences exist
    const current = await this.getPreferences();

    // Build update object
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (typeof input.dailyEmailEnabled === 'boolean') {
      updates.dailyEmailEnabled = input.dailyEmailEnabled;
    }
    if (typeof input.dailySmsEnabled === 'boolean') {
      updates.dailySmsEnabled = input.dailySmsEnabled;
    }
    if (typeof input.dailyTime === 'string' && /^\d{2}:\d{2}$/.test(input.dailyTime)) {
      updates.dailyTime = input.dailyTime;
    }
    if (typeof input.weeklyEmailEnabled === 'boolean') {
      updates.weeklyEmailEnabled = input.weeklyEmailEnabled;
    }
    if (typeof input.weeklySmsEnabled === 'boolean') {
      updates.weeklySmsEnabled = input.weeklySmsEnabled;
    }
    if (typeof input.weeklyDay === 'number' && input.weeklyDay >= 0 && input.weeklyDay <= 6) {
      updates.weeklyDay = input.weeklyDay;
    }
    if (typeof input.weeklyTime === 'string' && /^\d{2}:\d{2}$/.test(input.weeklyTime)) {
      updates.weeklyTime = input.weeklyTime;
    }
    if (typeof input.alertsEnabled === 'boolean') {
      updates.alertsEnabled = input.alertsEnabled;
    }
    if (typeof input.largeTransactionThresholdCents === 'number' && input.largeTransactionThresholdCents > 0) {
      updates.largeTransactionThresholdCents = input.largeTransactionThresholdCents;
    }
    if (typeof input.unusualSpendingMultiplier === 'number' && input.unusualSpendingMultiplier > 0) {
      updates.unusualSpendingMultiplier = input.unusualSpendingMultiplier;
    }

    // Update
    const [updated] = await db
      .update(budgetReportPreferences)
      .set(updates)
      .where(eq(budgetReportPreferences.id, current.id))
      .returning();

    return {
      id: updated.id,
      dailyEmailEnabled: updated.dailyEmailEnabled,
      dailySmsEnabled: updated.dailySmsEnabled,
      dailyTime: updated.dailyTime,
      weeklyEmailEnabled: updated.weeklyEmailEnabled,
      weeklySmsEnabled: updated.weeklySmsEnabled,
      weeklyDay: updated.weeklyDay,
      weeklyTime: updated.weeklyTime,
      alertsEnabled: updated.alertsEnabled,
      largeTransactionThresholdCents: updated.largeTransactionThresholdCents,
      unusualSpendingMultiplier: updated.unusualSpendingMultiplier,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * Check if daily reports are enabled
   */
  async isDailyReportEnabled(): Promise<{ email: boolean; sms: boolean; time: string }> {
    const prefs = await this.getPreferences();
    return {
      email: prefs.dailyEmailEnabled,
      sms: prefs.dailySmsEnabled,
      time: prefs.dailyTime,
    };
  }

  /**
   * Check if weekly reports are enabled
   */
  async isWeeklyReportEnabled(): Promise<{ email: boolean; sms: boolean; day: number; time: string }> {
    const prefs = await this.getPreferences();
    return {
      email: prefs.weeklyEmailEnabled,
      sms: prefs.weeklySmsEnabled,
      day: prefs.weeklyDay,
      time: prefs.weeklyTime,
    };
  }

  /**
   * Get alert settings
   */
  async getAlertSettings(): Promise<{
    enabled: boolean;
    largeTransactionThresholdCents: number;
    unusualSpendingMultiplier: number;
  }> {
    const prefs = await this.getPreferences();
    return {
      enabled: prefs.alertsEnabled,
      largeTransactionThresholdCents: prefs.largeTransactionThresholdCents,
      unusualSpendingMultiplier: prefs.unusualSpendingMultiplier,
    };
  }
}

export const budgetPreferencesService = new BudgetPreferencesService();

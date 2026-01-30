/**
 * Budget Alert Service
 *
 * Smart proactive alerts for budget monitoring:
 * - Large transaction detection (>$100)
 * - Unusual spending patterns (2x normal)
 * - Positive reinforcement (under budget)
 * - Weekly summary alerts
 */

import { db } from '../db/client';
import { financeTransactions, financeInsights } from '../db/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { financeService } from './finance-service';
import { notificationService } from './notification-service';

// ============================================
// Types
// ============================================

export type AlertType =
  | 'large_transaction'
  | 'unusual_spending'
  | 'category_overspent'
  | 'week_under_budget'
  | 'month_under_budget'
  | 'spending_streak';

export interface AlertConfig {
  largeTransactionThresholdCents: number; // Default: 10000 ($100)
  unusualSpendingMultiplier: number; // Default: 2.0 (2x normal)
  enabled: boolean;
}

export interface Alert {
  type: AlertType;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'success';
  data: Record<string, any>;
  createdAt: Date;
}

// ============================================
// Budget Alert Service
// ============================================

class BudgetAlertService {
  private config: AlertConfig = {
    largeTransactionThresholdCents: 10000, // $100
    unusualSpendingMultiplier: 2.0,
    enabled: true,
  };

  /**
   * Format cents as currency
   */
  private formatCurrency(cents: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  }

  /**
   * Get today's date range
   */
  private getTodayRange(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  /**
   * Check if an alert was already sent for this item
   */
  private async wasAlertSent(
    alertType: string,
    uniqueKey: string
  ): Promise<boolean> {
    const [existing] = await db
      .select()
      .from(financeInsights)
      .where(
        and(
          eq(financeInsights.insightType, alertType),
          sql`${financeInsights.data}->>'uniqueKey' = ${uniqueKey}`
        )
      )
      .limit(1);

    return !!existing;
  }

  /**
   * Store alert in database
   */
  private async storeAlert(alert: Alert, uniqueKey: string): Promise<void> {
    await db.insert(financeInsights).values({
      insightType: alert.type,
      category: alert.data.category || null,
      title: alert.title,
      description: alert.message,
      severity: alert.severity === 'success' ? 'info' : alert.severity,
      actionable: alert.severity === 'warning',
      actionType: alert.severity === 'warning' ? 'review' : null,
      data: {
        ...alert.data,
        uniqueKey,
      },
    });
  }

  /**
   * Send alert notification
   */
  private async sendAlert(alert: Alert): Promise<boolean> {
    const icon = alert.severity === 'success' ? '🎉' : alert.severity === 'warning' ? '⚠️' : 'ℹ️';
    const message = `${icon} *${alert.title}*\n\n${alert.message}`;

    try {
      const result = await notificationService.send(message, {
        priority: alert.severity === 'warning' ? 'high' : 'normal',
      });
      return result.success;
    } catch (err) {
      console.error('[BudgetAlert] Failed to send alert:', err);
      return false;
    }
  }

  // ============================================
  // Large Transaction Detection
  // ============================================

  /**
   * Check for large transactions today
   */
  async checkLargeTransactions(): Promise<Alert[]> {
    const { start, end } = this.getTodayRange();
    const alerts: Alert[] = [];

    const transactions = await financeService.getTransactions({
      startDate: start,
      endDate: end,
      excluded: false,
      limit: 100,
    });

    for (const txn of transactions) {
      // Only check expenses (positive amounts)
      if (txn.amountCents < this.config.largeTransactionThresholdCents) continue;

      const uniqueKey = `large_txn_${txn.id}`;
      if (await this.wasAlertSent('large_transaction', uniqueKey)) continue;

      const merchantName = txn.merchantName || txn.name || 'Unknown';
      const category = txn.userCategory || txn.category || 'Uncategorized';

      const alert: Alert = {
        type: 'large_transaction',
        title: 'Large Transaction Detected',
        message: `${this.formatCurrency(txn.amountCents)} at ${merchantName}\nCategory: ${category}\n\nCheck your Budget app if this was unexpected.`,
        severity: 'warning',
        data: {
          transactionId: txn.id,
          merchantName,
          amountCents: txn.amountCents,
          category,
          date: txn.date,
        },
        createdAt: new Date(),
      };

      alerts.push(alert);
      await this.storeAlert(alert, uniqueKey);
      await this.sendAlert(alert);
    }

    return alerts;
  }

  // ============================================
  // Unusual Spending Detection
  // ============================================

  /**
   * Calculate average daily spending over past 30 days
   */
  private async getAverageDailySpending(): Promise<number> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const transactions = await financeService.getTransactions({
      startDate,
      endDate,
      excluded: false,
      limit: 1000,
    });

    const totalSpent = transactions
      .filter((t) => t.amountCents > 0)
      .reduce((sum, t) => sum + t.amountCents, 0);

    return Math.round(totalSpent / 30);
  }

  /**
   * Check for unusual spending today
   */
  async checkUnusualSpending(): Promise<Alert | null> {
    const { start, end } = this.getTodayRange();
    const todayKey = start.toISOString().split('T')[0];
    const uniqueKey = `unusual_spending_${todayKey}`;

    // Only alert once per day
    if (await this.wasAlertSent('unusual_spending', uniqueKey)) {
      return null;
    }

    const transactions = await financeService.getTransactions({
      startDate: start,
      endDate: end,
      excluded: false,
      limit: 100,
    });

    const todaySpent = transactions
      .filter((t) => t.amountCents > 0)
      .reduce((sum, t) => sum + t.amountCents, 0);

    const avgDaily = await this.getAverageDailySpending();

    // Check if spending is above threshold
    if (todaySpent < avgDaily * this.config.unusualSpendingMultiplier) {
      return null;
    }

    const multiplier = Math.round((todaySpent / avgDaily) * 10) / 10;

    const alert: Alert = {
      type: 'unusual_spending',
      title: 'Unusual Spending Today',
      message: `You've spent ${this.formatCurrency(todaySpent)} today - that's ${multiplier}x your daily average of ${this.formatCurrency(avgDaily)}.\n\nReview your transactions to make sure everything is expected.`,
      severity: 'warning',
      data: {
        todaySpentCents: todaySpent,
        averageDailyCents: avgDaily,
        multiplier,
        date: todayKey,
      },
      createdAt: new Date(),
    };

    await this.storeAlert(alert, uniqueKey);
    await this.sendAlert(alert);

    return alert;
  }

  // ============================================
  // Positive Reinforcement
  // ============================================

  /**
   * Check if user finished week under budget
   */
  async checkWeekUnderBudget(): Promise<Alert | null> {
    // Only run on Sunday
    const now = new Date();
    if (now.getDay() !== 0) return null;

    const weekKey = now.toISOString().split('T')[0];
    const uniqueKey = `week_under_budget_${weekKey}`;

    if (await this.wasAlertSent('week_under_budget', uniqueKey)) {
      return null;
    }

    // Get budget statuses
    const budgetStatuses = await financeService.getBudgetStatuses(false);

    if (budgetStatuses.length === 0) return null;

    // Count categories under budget
    const underBudget = budgetStatuses.filter((s) => s.remainingCents > 0);
    const overBudget = budgetStatuses.filter((s) => s.remainingCents < 0);

    // Only celebrate if mostly under budget
    if (overBudget.length >= underBudget.length) return null;

    const totalRemaining = budgetStatuses.reduce((sum, s) => sum + s.remainingCents, 0);

    if (totalRemaining <= 0) return null;

    const alert: Alert = {
      type: 'week_under_budget',
      title: 'Great Week!',
      message: `You finished the week with ${this.formatCurrency(totalRemaining)} to spare across ${underBudget.length} categories.\n\nKeep up the great work!`,
      severity: 'success',
      data: {
        totalRemainingCents: totalRemaining,
        categoriesUnderBudget: underBudget.length,
        categoriesOverBudget: overBudget.length,
        weekEndDate: weekKey,
      },
      createdAt: new Date(),
    };

    await this.storeAlert(alert, uniqueKey);
    await this.sendAlert(alert);

    return alert;
  }

  /**
   * Check for spending streak (X days under daily average)
   */
  async checkSpendingStreak(): Promise<Alert | null> {
    const avgDaily = await this.getAverageDailySpending();
    let streakDays = 0;

    // Check last 7 days
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date();
      checkDate.setDate(checkDate.getDate() - i);
      checkDate.setHours(0, 0, 0, 0);

      const endDate = new Date(checkDate);
      endDate.setHours(23, 59, 59, 999);

      const transactions = await financeService.getTransactions({
        startDate: checkDate,
        endDate: endDate,
        excluded: false,
        limit: 100,
      });

      const daySpent = transactions
        .filter((t) => t.amountCents > 0)
        .reduce((sum, t) => sum + t.amountCents, 0);

      if (daySpent < avgDaily) {
        streakDays++;
      } else {
        break;
      }
    }

    // Celebrate streaks of 3+ days
    if (streakDays < 3) return null;

    const todayKey = new Date().toISOString().split('T')[0];
    const uniqueKey = `spending_streak_${streakDays}_${todayKey}`;

    if (await this.wasAlertSent('spending_streak', uniqueKey)) {
      return null;
    }

    const alert: Alert = {
      type: 'spending_streak',
      title: `${streakDays}-Day Streak!`,
      message: `You've stayed under your ${this.formatCurrency(avgDaily)} daily average for ${streakDays} days in a row.\n\nAmazing discipline!`,
      severity: 'success',
      data: {
        streakDays,
        averageDailyCents: avgDaily,
        date: todayKey,
      },
      createdAt: new Date(),
    };

    await this.storeAlert(alert, uniqueKey);
    await this.sendAlert(alert);

    return alert;
  }

  // ============================================
  // Main Check Function
  // ============================================

  /**
   * Run all alert checks
   */
  async runAllChecks(): Promise<{
    largeTransactions: Alert[];
    unusualSpending: Alert | null;
    weekUnderBudget: Alert | null;
    spendingStreak: Alert | null;
    totalAlertsSent: number;
  }> {
    console.log('[BudgetAlert] Running all alert checks...');

    const isConfigured = await financeService.isConfigured();
    if (!isConfigured) {
      console.log('[BudgetAlert] Finance not configured, skipping alerts');
      return {
        largeTransactions: [],
        unusualSpending: null,
        weekUnderBudget: null,
        spendingStreak: null,
        totalAlertsSent: 0,
      };
    }

    const largeTransactions = await this.checkLargeTransactions();
    const unusualSpending = await this.checkUnusualSpending();
    const weekUnderBudget = await this.checkWeekUnderBudget();
    const spendingStreak = await this.checkSpendingStreak();

    const totalAlertsSent =
      largeTransactions.length +
      (unusualSpending ? 1 : 0) +
      (weekUnderBudget ? 1 : 0) +
      (spendingStreak ? 1 : 0);

    console.log(`[BudgetAlert] Checks complete: ${totalAlertsSent} alerts sent`);

    return {
      largeTransactions,
      unusualSpending,
      weekUnderBudget,
      spendingStreak,
      totalAlertsSent,
    };
  }

  /**
   * Get recent alerts
   */
  async getRecentAlerts(limit = 10): Promise<Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    severity: string;
    createdAt: Date;
  }>> {
    const alerts = await db
      .select({
        id: financeInsights.id,
        type: financeInsights.insightType,
        title: financeInsights.title,
        description: financeInsights.description,
        severity: financeInsights.severity,
        createdAt: financeInsights.createdAt,
      })
      .from(financeInsights)
      .where(
        sql`${financeInsights.insightType} IN ('large_transaction', 'unusual_spending', 'week_under_budget', 'spending_streak')`
      )
      .orderBy(desc(financeInsights.createdAt))
      .limit(limit);

    return alerts.map((a) => ({
      ...a,
      severity: a.severity || 'info',
    }));
  }

  /**
   * Update alert configuration
   */
  updateConfig(config: Partial<AlertConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): AlertConfig {
    return { ...this.config };
  }
}

export const budgetAlertService = new BudgetAlertService();

/**
 * Budget Report Service
 *
 * Generates and sends daily/weekly budget reports via email and SMS.
 * Part of the YNAB-style budgeting system.
 */

import { db } from '../db/client';
import { budgetReports, financeTransactions } from '../db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { financeService, type BudgetStatus, type TransactionRecord } from './finance-service';
import { notificationService } from './notification-service';

// ============================================
// Types
// ============================================

export interface CategoryHealth {
  name: string;
  groupName: string | null;
  remainingCents: number;
  daysRemaining: number;
  status: 'on_track' | 'slow_down' | 'overspent';
  burnRateCentsPerDay: number;
  budgetedCents: number;
  spentCents: number;
  percentUsed: number;
}

export interface DailyPulseData {
  date: Date;
  yesterdaySpentCents: number;
  yesterdayTransactions: TransactionRecord[];
  categoryHealth: CategoryHealth[];
  recommendations: string[];
  monthProgress: {
    daysPassed: number;
    daysTotal: number;
    percentThrough: number;
    totalSpentCents: number;
    totalBudgetedCents: number;
    percentSpent: number;
  };
  toBeBudgetedCents: number;
}

export interface SendResult {
  emailSent: boolean;
  smsSent: boolean;
  reportId?: string;
  error?: string;
}

export interface CategoryWeeklyStatus {
  name: string;
  groupName: string | null;
  budgetedCents: number;
  spentCents: number;
  remainingCents: number;
  percentUsed: number;
  status: 'under' | 'on_track' | 'over';
}

export interface TopMerchant {
  name: string;
  totalCents: number;
  transactionCount: number;
}

export interface WeeklyTrends {
  vsLastWeek: {
    spentCents: number;
    percentChange: number;
    direction: 'up' | 'down' | 'same';
  };
  vsFourWeekAvg: {
    averageCents: number;
    percentChange: number;
    direction: 'up' | 'down' | 'same';
  };
}

export interface WeeklyReportData {
  weekStart: Date;
  weekEnd: Date;
  incomeCents: number;
  spentCents: number;
  savedCents: number;
  categoryBreakdown: CategoryWeeklyStatus[];
  topMerchants: TopMerchant[];
  trends: WeeklyTrends;
  recommendations: string[];
  monthProgress: {
    daysLeft: number;
    projectedEndCents: number;
    onTrack: boolean;
  };
  categoriesOverPace: number;
}

// ============================================
// Budget Report Service
// ============================================

class BudgetReportService {
  /**
   * Format cents as currency string
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
   * Get the start and end of yesterday
   */
  private getYesterdayRange(): { start: Date; end: Date } {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const end = new Date(yesterday);
    end.setHours(23, 59, 59, 999);

    return { start: yesterday, end };
  }

  /**
   * Calculate days remaining in the current month
   */
  private getDaysRemaining(): number {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return lastDay.getDate() - now.getDate() + 1; // Include today
  }

  /**
   * Calculate month progress
   */
  private getMonthProgress(): { daysPassed: number; daysTotal: number; percentThrough: number } {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const daysTotal = lastDay.getDate();
    const daysPassed = now.getDate();
    const percentThrough = Math.round((daysPassed / daysTotal) * 100);

    return { daysPassed, daysTotal, percentThrough };
  }

  /**
   * Determine category health status based on burn rate
   */
  private getCategoryStatus(
    remainingCents: number,
    daysRemaining: number,
    budgetedCents: number
  ): 'on_track' | 'slow_down' | 'overspent' {
    if (remainingCents <= 0) {
      return 'overspent';
    }

    // Calculate expected remaining based on linear spending
    const { daysPassed, daysTotal } = this.getMonthProgress();
    const expectedSpentPercent = daysPassed / daysTotal;
    const actualSpentPercent = (budgetedCents - remainingCents) / budgetedCents;

    // If spending faster than expected by more than 20%, slow down
    if (actualSpentPercent > expectedSpentPercent + 0.2) {
      return 'slow_down';
    }

    return 'on_track';
  }

  /**
   * Generate a recommendation based on category health
   */
  private generateRecommendation(category: CategoryHealth): string | null {
    if (category.status === 'overspent') {
      return `${category.name} is ${this.formatCurrency(Math.abs(category.remainingCents))} overspent. Consider moving money from another category.`;
    }

    if (category.status === 'slow_down') {
      const dailyBudget = Math.round(category.remainingCents / category.daysRemaining);
      return `${category.name} has ${this.formatCurrency(category.remainingCents)} left for ${category.daysRemaining} days. That's ${this.formatCurrency(dailyBudget)}/day.`;
    }

    return null;
  }

  /**
   * Generate the daily pulse data
   */
  async generateDailyPulse(): Promise<DailyPulseData> {
    const { start: yesterdayStart, end: yesterdayEnd } = this.getYesterdayRange();
    const daysRemaining = this.getDaysRemaining();
    const monthProgress = this.getMonthProgress();

    // Get yesterday's transactions
    const yesterdayTransactions = await financeService.getTransactions({
      startDate: yesterdayStart,
      endDate: yesterdayEnd,
      excluded: false,
      limit: 50,
    });

    // Calculate yesterday's total spending (positive amounts = expenses)
    const yesterdaySpentCents = yesterdayTransactions
      .filter((t) => t.amountCents > 0)
      .reduce((sum, t) => sum + t.amountCents, 0);

    // Get current budget statuses
    const budgetStatuses = await financeService.getBudgetStatuses(false);

    // Convert to category health
    const categoryHealth: CategoryHealth[] = budgetStatuses.map((status) => {
      const burnRateCentsPerDay =
        daysRemaining > 0 ? Math.round(status.remainingCents / daysRemaining) : 0;

      return {
        name: status.budget.name,
        groupName: status.budget.groupName,
        remainingCents: status.remainingCents,
        daysRemaining,
        status: this.getCategoryStatus(
          status.remainingCents,
          daysRemaining,
          status.budgetedCents
        ),
        burnRateCentsPerDay,
        budgetedCents: status.budgetedCents,
        spentCents: status.spentCents,
        percentUsed: status.percentUsed,
      };
    });

    // Sort: overspent first, then slow_down, then on_track
    categoryHealth.sort((a, b) => {
      const order = { overspent: 0, slow_down: 1, on_track: 2 };
      return order[a.status] - order[b.status];
    });

    // Generate recommendations for at-risk categories
    const recommendations: string[] = [];
    for (const cat of categoryHealth) {
      const rec = this.generateRecommendation(cat);
      if (rec) {
        recommendations.push(rec);
      }
      if (recommendations.length >= 3) break; // Max 3 recommendations
    }

    // Calculate totals
    const totalBudgetedCents = budgetStatuses.reduce((sum, s) => sum + s.budgetedCents, 0);
    const totalSpentCents = budgetStatuses.reduce((sum, s) => sum + s.spentCents, 0);
    const percentSpent = totalBudgetedCents > 0
      ? Math.round((totalSpentCents / totalBudgetedCents) * 100)
      : 0;

    // Calculate to-be-budgeted (simplified - would need income data for accuracy)
    const overview = await financeService.getOverview();
    const toBeBudgetedCents = overview.monthlyIncomeCents - totalBudgetedCents;

    return {
      date: new Date(),
      yesterdaySpentCents,
      yesterdayTransactions,
      categoryHealth,
      recommendations,
      monthProgress: {
        ...monthProgress,
        totalSpentCents,
        totalBudgetedCents,
        percentSpent,
      },
      toBeBudgetedCents,
    };
  }

  /**
   * Format the daily pulse for email (plain text)
   */
  formatDailyEmail(data: DailyPulseData): { subject: string; text: string } {
    const dateStr = data.date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    const shortDate = data.date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    let text = `Good morning!\n\n`;
    text += `Yesterday's Spending: ${this.formatCurrency(data.yesterdaySpentCents)}\n`;
    text += `${'━'.repeat(40)}\n\n`;

    // Transactions
    if (data.yesterdayTransactions.length > 0) {
      text += `Transactions:\n`;
      for (const txn of data.yesterdayTransactions.slice(0, 10)) {
        const name = txn.merchantName || txn.name;
        const amount = this.formatCurrency(txn.amountCents);
        const category = txn.userCategory || txn.category || 'Uncategorized';
        text += `  ${name.padEnd(20).slice(0, 20)} ${amount.padStart(10)} → ${category}\n`;
      }
      if (data.yesterdayTransactions.length > 10) {
        text += `  ...and ${data.yesterdayTransactions.length - 10} more\n`;
      }
      text += `\n`;
    } else {
      text += `No spending yesterday!\n\n`;
    }

    // Category Health
    text += `Category Health:\n`;
    text += `${'━'.repeat(40)}\n`;

    for (const cat of data.categoryHealth.slice(0, 8)) {
      const icon = cat.status === 'on_track' ? '🟢' : cat.status === 'slow_down' ? '🟡' : '🔴';
      const remaining = this.formatCurrency(cat.remainingCents);
      const daysNote = cat.status !== 'overspent' ? ` (${cat.daysRemaining}d)` : '';
      const statusNote = cat.status === 'overspent' ? ' OVERSPENT' : cat.status === 'slow_down' ? ' ← Slow down' : '';
      text += `${icon} ${cat.name.padEnd(16).slice(0, 16)} ${remaining.padStart(8)}${daysNote}${statusNote}\n`;
    }
    text += `\n`;

    // Recommendations
    if (data.recommendations.length > 0) {
      for (const rec of data.recommendations) {
        text += `💡 ${rec}\n`;
      }
      text += `\n`;
    }

    // Footer
    text += `${'━'.repeat(40)}\n`;
    text += `To Be Budgeted: ${this.formatCurrency(data.toBeBudgetedCents)}\n`;
    text += `${data.date.toLocaleDateString('en-US', { month: 'long' })}: ${data.monthProgress.percentThrough}% through, ${data.monthProgress.percentSpent}% spent\n`;

    return {
      subject: `Budget Pulse - ${shortDate}`,
      text,
    };
  }

  /**
   * Format the daily pulse for SMS (concise, ~160 chars)
   */
  formatDailySMS(data: DailyPulseData): string {
    const shortDate = `${data.date.getMonth() + 1}/${data.date.getDate()}`;

    let sms = `Budget ${shortDate}\n`;
    sms += `Spent yest: ${this.formatCurrency(data.yesterdaySpentCents)}\n`;

    // Show top 3 categories by urgency
    for (const cat of data.categoryHealth.slice(0, 3)) {
      const icon = cat.status === 'on_track' ? '🟢' : cat.status === 'slow_down' ? '🟡' : '🔴';
      const remaining = this.formatCurrency(cat.remainingCents);
      const daysNote = cat.status !== 'overspent' ? ` (${cat.daysRemaining}d)` : '';
      sms += `${icon} ${cat.name.slice(0, 10)} ${remaining}${daysNote}\n`;
    }

    // Add a tip if there's a recommendation
    if (data.recommendations.length > 0) {
      // Extract just the actionable part
      const rec = data.recommendations[0];
      const tip = rec.length > 40 ? rec.slice(0, 37) + '...' : rec;
      sms += `Tip: ${tip}`;
    }

    return sms;
  }

  /**
   * Send the daily budget pulse via email and SMS
   */
  async sendDailyPulse(): Promise<SendResult> {
    try {
      // Check if finance is configured
      const isConfigured = await financeService.isConfigured();
      if (!isConfigured) {
        console.log('[BudgetReport] Finance not configured, skipping daily pulse');
        return { emailSent: false, smsSent: false };
      }

      // Generate report data
      const data = await this.generateDailyPulse();

      // Format messages
      const email = this.formatDailyEmail(data);
      const sms = this.formatDailySMS(data);

      // Send email
      let emailSent = false;
      try {
        const emailResult = await notificationService.sendEmail(
          email.subject,
          email.text
        );
        emailSent = emailResult.success;
        if (!emailSent) {
          console.error('[BudgetReport] Email send failed:', emailResult.error);
        }
      } catch (err) {
        console.error('[BudgetReport] Email error:', err);
      }

      // Send SMS
      let smsSent = false;
      try {
        const smsResult = await notificationService.send(sms, { channel: 'sms' });
        smsSent = smsResult.success;
        if (!smsSent) {
          console.error('[BudgetReport] SMS send failed:', smsResult.error);
        }
      } catch (err) {
        console.error('[BudgetReport] SMS error:', err);
      }

      // Store report in database
      let reportId: string | undefined;
      try {
        const [report] = await db
          .insert(budgetReports)
          .values({
            reportType: 'daily',
            reportDate: data.date.toISOString().split('T')[0],
            data: data as any,
            emailSentAt: emailSent ? new Date() : null,
            smsSentAt: smsSent ? new Date() : null,
          })
          .returning();
        reportId = report.id;
      } catch (err) {
        console.error('[BudgetReport] Failed to store report:', err);
      }

      console.log(`[BudgetReport] Daily pulse sent: email=${emailSent}, sms=${smsSent}`);

      return { emailSent, smsSent, reportId };
    } catch (err) {
      console.error('[BudgetReport] Failed to send daily pulse:', err);
      return {
        emailSent: false,
        smsSent: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Get a previously generated report
   */
  async getReport(date: string): Promise<DailyPulseData | null> {
    const [report] = await db
      .select()
      .from(budgetReports)
      .where(
        and(
          eq(budgetReports.reportType, 'daily'),
          eq(budgetReports.reportDate, date)
        )
      )
      .limit(1);

    if (!report) {
      return null;
    }

    return report.data as DailyPulseData;
  }

  /**
   * Get report history
   */
  async getReportHistory(limit = 7): Promise<Array<{
    id: string;
    reportType: string;
    reportDate: string;
    emailSentAt: Date | null;
    smsSentAt: Date | null;
    createdAt: Date;
  }>> {
    const reports = await db
      .select({
        id: budgetReports.id,
        reportType: budgetReports.reportType,
        reportDate: budgetReports.reportDate,
        emailSentAt: budgetReports.emailSentAt,
        smsSentAt: budgetReports.smsSentAt,
        createdAt: budgetReports.createdAt,
      })
      .from(budgetReports)
      .orderBy(desc(budgetReports.reportDate))
      .limit(limit);

    return reports;
  }

  /**
   * Preview today's report without sending
   */
  async previewDailyPulse(): Promise<{
    data: DailyPulseData;
    email: { subject: string; text: string };
    sms: string;
  }> {
    const data = await this.generateDailyPulse();
    const email = this.formatDailyEmail(data);
    const sms = this.formatDailySMS(data);

    return { data, email, sms };
  }

  // ============================================
  // Weekly Report Methods
  // ============================================

  /**
   * Get date range for current week (Monday to Sunday)
   */
  private getCurrentWeekRange(): { start: Date; end: Date } {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const start = new Date(now);
    start.setDate(now.getDate() + diffToMonday);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  /**
   * Get date range for a previous week (offset weeks back)
   */
  private getPreviousWeekRange(weeksBack: number): { start: Date; end: Date } {
    const { start: currentStart } = this.getCurrentWeekRange();

    const start = new Date(currentStart);
    start.setDate(start.getDate() - (weeksBack * 7));

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  /**
   * Get spending for a date range
   */
  private async getSpendingForRange(start: Date, end: Date): Promise<number> {
    const transactions = await financeService.getTransactions({
      startDate: start,
      endDate: end,
      excluded: false,
      limit: 1000,
    });

    return transactions
      .filter((t) => t.amountCents > 0)
      .reduce((sum, t) => sum + t.amountCents, 0);
  }

  /**
   * Get income for a date range
   */
  private async getIncomeForRange(start: Date, end: Date): Promise<number> {
    const transactions = await financeService.getTransactions({
      startDate: start,
      endDate: end,
      excluded: false,
      limit: 1000,
    });

    return transactions
      .filter((t) => t.amountCents < 0)
      .reduce((sum, t) => sum + Math.abs(t.amountCents), 0);
  }

  /**
   * Get top merchants for a date range
   */
  private async getTopMerchants(start: Date, end: Date, limit = 5): Promise<TopMerchant[]> {
    const transactions = await financeService.getTransactions({
      startDate: start,
      endDate: end,
      excluded: false,
      limit: 500,
    });

    const merchantMap = new Map<string, { totalCents: number; count: number }>();

    for (const txn of transactions) {
      if (txn.amountCents <= 0) continue; // Skip income

      const name = txn.merchantName || txn.name || 'Unknown';
      const existing = merchantMap.get(name) || { totalCents: 0, count: 0 };
      merchantMap.set(name, {
        totalCents: existing.totalCents + txn.amountCents,
        count: existing.count + 1,
      });
    }

    return Array.from(merchantMap.entries())
      .map(([name, data]) => ({
        name,
        totalCents: data.totalCents,
        transactionCount: data.count,
      }))
      .sort((a, b) => b.totalCents - a.totalCents)
      .slice(0, limit);
  }

  /**
   * Calculate weekly trends
   */
  private async calculateWeeklyTrends(currentSpentCents: number): Promise<WeeklyTrends> {
    // Get last week's spending
    const lastWeekRange = this.getPreviousWeekRange(1);
    const lastWeekSpent = await this.getSpendingForRange(lastWeekRange.start, lastWeekRange.end);

    // Get 4-week average
    const fourWeekTotals: number[] = [];
    for (let i = 1; i <= 4; i++) {
      const range = this.getPreviousWeekRange(i);
      const spent = await this.getSpendingForRange(range.start, range.end);
      fourWeekTotals.push(spent);
    }
    const fourWeekAvg = fourWeekTotals.reduce((a, b) => a + b, 0) / 4;

    // Calculate vs last week
    const vsLastWeekDiff = currentSpentCents - lastWeekSpent;
    const vsLastWeekPercent = lastWeekSpent > 0
      ? Math.round((vsLastWeekDiff / lastWeekSpent) * 100)
      : 0;

    // Calculate vs 4-week average
    const vsAvgDiff = currentSpentCents - fourWeekAvg;
    const vsAvgPercent = fourWeekAvg > 0
      ? Math.round((vsAvgDiff / fourWeekAvg) * 100)
      : 0;

    return {
      vsLastWeek: {
        spentCents: lastWeekSpent,
        percentChange: Math.abs(vsLastWeekPercent),
        direction: vsLastWeekPercent > 5 ? 'up' : vsLastWeekPercent < -5 ? 'down' : 'same',
      },
      vsFourWeekAvg: {
        averageCents: Math.round(fourWeekAvg),
        percentChange: Math.abs(vsAvgPercent),
        direction: vsAvgPercent > 5 ? 'up' : vsAvgPercent < -5 ? 'down' : 'same',
      },
    };
  }

  /**
   * Generate weekly report recommendations
   */
  private generateWeeklyRecommendations(
    categoryBreakdown: CategoryWeeklyStatus[],
    trends: WeeklyTrends,
    savedCents: number
  ): string[] {
    const recommendations: string[] = [];

    // Categories over budget
    const overCategories = categoryBreakdown.filter((c) => c.status === 'over');
    if (overCategories.length > 0) {
      const names = overCategories.slice(0, 2).map((c) => c.name).join(' and ');
      const overAmount = overCategories.reduce((sum, c) => sum + Math.abs(c.remainingCents), 0);
      recommendations.push(
        `Move ${this.formatCurrency(overAmount)} to cover overspending in ${names}.`
      );
    }

    // Trend-based recommendations
    if (trends.vsLastWeek.direction === 'up' && trends.vsLastWeek.percentChange > 20) {
      recommendations.push(
        `Spending is up ${trends.vsLastWeek.percentChange}% vs. last week. Review this week's purchases.`
      );
    } else if (trends.vsLastWeek.direction === 'down' && trends.vsLastWeek.percentChange > 10) {
      recommendations.push(
        `Great job! Spending is down ${trends.vsLastWeek.percentChange}% from last week.`
      );
    }

    // Savings recommendation
    if (savedCents > 0) {
      recommendations.push(
        `You saved ${this.formatCurrency(savedCents)} this week. Consider moving it to a savings goal.`
      );
    } else if (savedCents < 0) {
      recommendations.push(
        `You overspent by ${this.formatCurrency(Math.abs(savedCents))} this week. Review non-essential spending.`
      );
    }

    return recommendations.slice(0, 4);
  }

  /**
   * Generate the weekly report data
   */
  async generateWeeklyReport(): Promise<WeeklyReportData> {
    const { start: weekStart, end: weekEnd } = this.getCurrentWeekRange();

    // Get transactions for the week
    const weekTransactions = await financeService.getTransactions({
      startDate: weekStart,
      endDate: weekEnd,
      excluded: false,
      limit: 500,
    });

    // Calculate totals
    const spentCents = weekTransactions
      .filter((t) => t.amountCents > 0)
      .reduce((sum, t) => sum + t.amountCents, 0);

    const incomeCents = weekTransactions
      .filter((t) => t.amountCents < 0)
      .reduce((sum, t) => sum + Math.abs(t.amountCents), 0);

    const savedCents = incomeCents - spentCents;

    // Get budget statuses
    const budgetStatuses = await financeService.getBudgetStatuses(false);

    // Build category breakdown
    const categoryBreakdown: CategoryWeeklyStatus[] = budgetStatuses.map((status) => {
      let categoryStatus: 'under' | 'on_track' | 'over' = 'on_track';
      if (status.percentUsed > 100) {
        categoryStatus = 'over';
      } else if (status.percentUsed < 50) {
        categoryStatus = 'under';
      }

      return {
        name: status.budget.name,
        groupName: status.budget.groupName,
        budgetedCents: status.budgetedCents,
        spentCents: status.spentCents,
        remainingCents: status.remainingCents,
        percentUsed: status.percentUsed,
        status: categoryStatus,
      };
    });

    // Sort by spent (highest first)
    categoryBreakdown.sort((a, b) => b.spentCents - a.spentCents);

    // Get top merchants
    const topMerchants = await this.getTopMerchants(weekStart, weekEnd);

    // Calculate trends
    const trends = await this.calculateWeeklyTrends(spentCents);

    // Calculate month progress
    const monthProgress = this.getMonthProgress();
    const daysLeft = monthProgress.daysTotal - monthProgress.daysPassed;
    const totalBudgetedCents = budgetStatuses.reduce((sum, s) => sum + s.budgetedCents, 0);
    const totalSpentCents = budgetStatuses.reduce((sum, s) => sum + s.spentCents, 0);
    const dailySpendRate = totalSpentCents / monthProgress.daysPassed;
    const projectedEndCents = totalBudgetedCents - (totalSpentCents + (dailySpendRate * daysLeft));

    // Count categories over pace
    const categoriesOverPace = categoryBreakdown.filter((c) => c.status === 'over').length;

    // Generate recommendations
    const recommendations = this.generateWeeklyRecommendations(
      categoryBreakdown,
      trends,
      savedCents
    );

    return {
      weekStart,
      weekEnd,
      incomeCents,
      spentCents,
      savedCents,
      categoryBreakdown,
      topMerchants,
      trends,
      recommendations,
      monthProgress: {
        daysLeft,
        projectedEndCents: Math.round(projectedEndCents),
        onTrack: projectedEndCents >= 0,
      },
      categoriesOverPace,
    };
  }

  /**
   * Format the weekly report for email
   */
  formatWeeklyEmail(data: WeeklyReportData): { subject: string; text: string } {
    const weekStartStr = data.weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const weekEndStr = data.weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    let text = `WEEK IN REVIEW\n`;
    text += `${'━'.repeat(40)}\n\n`;

    text += `💰 Income This Week:     ${this.formatCurrency(data.incomeCents).padStart(10)}\n`;
    text += `💸 Total Spent:          ${this.formatCurrency(data.spentCents).padStart(10)}\n`;
    text += `📈 Net Savings:          ${this.formatCurrency(data.savedCents).padStart(10)}\n\n`;

    // Category breakdown
    text += `CATEGORY BREAKDOWN\n`;
    text += `${'━'.repeat(40)}\n`;
    text += `${'Category'.padEnd(16)} ${'Budget'.padStart(8)} ${'Spent'.padStart(8)} ${'Left'.padStart(8)} Status\n`;
    text += `${'-'.repeat(16)} ${'-'.repeat(8)} ${'-'.repeat(8)} ${'-'.repeat(8)} ------\n`;

    for (const cat of data.categoryBreakdown.slice(0, 8)) {
      const icon = cat.status === 'under' ? '🟢' : cat.status === 'on_track' ? '🟡' : '🔴';
      text += `${cat.name.padEnd(16).slice(0, 16)} `;
      text += `${this.formatCurrency(cat.budgetedCents).padStart(8)} `;
      text += `${this.formatCurrency(cat.spentCents).padStart(8)} `;
      text += `${this.formatCurrency(cat.remainingCents).padStart(8)} `;
      text += `${icon}\n`;
    }
    text += `\n`;

    // Top merchants
    text += `TOP MERCHANTS\n`;
    text += `${'━'.repeat(40)}\n`;
    for (let i = 0; i < data.topMerchants.length; i++) {
      const m = data.topMerchants[i];
      text += `${(i + 1)}. ${m.name.padEnd(20).slice(0, 20)} ${this.formatCurrency(m.totalCents).padStart(10)}\n`;
    }
    text += `\n`;

    // Trends
    text += `TRENDS\n`;
    text += `${'━'.repeat(40)}\n`;
    const vsLastWeekIcon = data.trends.vsLastWeek.direction === 'up' ? '↑' : data.trends.vsLastWeek.direction === 'down' ? '↓' : '→';
    const vsAvgIcon = data.trends.vsFourWeekAvg.direction === 'up' ? '↑' : data.trends.vsFourWeekAvg.direction === 'down' ? '↓' : '→';
    text += `vs. Last Week: Spending ${vsLastWeekIcon} ${data.trends.vsLastWeek.percentChange}%\n`;
    text += `vs. 4-Week Avg: Spending ${vsAvgIcon} ${data.trends.vsFourWeekAvg.percentChange}%\n\n`;

    // Recommendations
    if (data.recommendations.length > 0) {
      text += `RECOMMENDATIONS\n`;
      text += `${'━'.repeat(40)}\n`;
      for (let i = 0; i < data.recommendations.length; i++) {
        text += `${i + 1}. ${data.recommendations[i]}\n`;
      }
      text += `\n`;
    }

    // Month progress
    text += `${'━'.repeat(40)}\n`;
    const monthName = new Date().toLocaleDateString('en-US', { month: 'long' });
    text += `${monthName}: ${data.monthProgress.daysLeft} days left\n`;
    if (data.monthProgress.onTrack) {
      text += `Projected end-of-month: +${this.formatCurrency(data.monthProgress.projectedEndCents)} (under budget)\n`;
    } else {
      text += `Projected end-of-month: ${this.formatCurrency(data.monthProgress.projectedEndCents)} (over budget)\n`;
    }

    return {
      subject: `Weekly Budget Report - ${weekStartStr} to ${weekEndStr}`,
      text,
    };
  }

  /**
   * Format the weekly report for SMS
   */
  formatWeeklySMS(data: WeeklyReportData): string {
    let sms = `Weekly Budget Report\n`;
    sms += `Income: ${this.formatCurrency(data.incomeCents)}\n`;
    sms += `Spent: ${this.formatCurrency(data.spentCents)} (${Math.round((data.spentCents / (data.incomeCents || 1)) * 100)}%)\n`;
    sms += `Saved: ${this.formatCurrency(data.savedCents)}\n`;

    // Top category
    if (data.topMerchants.length > 0) {
      sms += `Top: ${data.topMerchants[0].name.slice(0, 12)} ${this.formatCurrency(data.topMerchants[0].totalCents)}\n`;
    }

    // Categories over pace
    if (data.categoriesOverPace > 0) {
      sms += `${data.categoriesOverPace} categories over pace\n`;
    }

    sms += `Full report in email`;

    return sms;
  }

  /**
   * Send the weekly budget report via email and SMS
   */
  async sendWeeklyReport(): Promise<SendResult> {
    try {
      // Check if finance is configured
      const isConfigured = await financeService.isConfigured();
      if (!isConfigured) {
        console.log('[BudgetReport] Finance not configured, skipping weekly report');
        return { emailSent: false, smsSent: false };
      }

      // Generate report data
      const data = await this.generateWeeklyReport();

      // Format messages
      const email = this.formatWeeklyEmail(data);
      const sms = this.formatWeeklySMS(data);

      // Send email
      let emailSent = false;
      try {
        const emailResult = await notificationService.sendEmail(
          email.subject,
          email.text
        );
        emailSent = emailResult.success;
        if (!emailSent) {
          console.error('[BudgetReport] Weekly email send failed:', emailResult.error);
        }
      } catch (err) {
        console.error('[BudgetReport] Weekly email error:', err);
      }

      // Send SMS
      let smsSent = false;
      try {
        const smsResult = await notificationService.send(sms, { channel: 'sms' });
        smsSent = smsResult.success;
        if (!smsSent) {
          console.error('[BudgetReport] Weekly SMS send failed:', smsResult.error);
        }
      } catch (err) {
        console.error('[BudgetReport] Weekly SMS error:', err);
      }

      // Store report in database
      let reportId: string | undefined;
      try {
        const [report] = await db
          .insert(budgetReports)
          .values({
            reportType: 'weekly',
            reportDate: data.weekEnd.toISOString().split('T')[0],
            data: data as any,
            emailSentAt: emailSent ? new Date() : null,
            smsSentAt: smsSent ? new Date() : null,
          })
          .returning();
        reportId = report.id;
      } catch (err) {
        console.error('[BudgetReport] Failed to store weekly report:', err);
      }

      console.log(`[BudgetReport] Weekly report sent: email=${emailSent}, sms=${smsSent}`);

      return { emailSent, smsSent, reportId };
    } catch (err) {
      console.error('[BudgetReport] Failed to send weekly report:', err);
      return {
        emailSent: false,
        smsSent: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  /**
   * Get a previously generated weekly report
   */
  async getWeeklyReport(date: string): Promise<WeeklyReportData | null> {
    const [report] = await db
      .select()
      .from(budgetReports)
      .where(
        and(
          eq(budgetReports.reportType, 'weekly'),
          eq(budgetReports.reportDate, date)
        )
      )
      .limit(1);

    if (!report) {
      return null;
    }

    return report.data as WeeklyReportData;
  }

  /**
   * Preview weekly report without sending
   */
  async previewWeeklyReport(): Promise<{
    data: WeeklyReportData;
    email: { subject: string; text: string };
    sms: string;
  }> {
    const data = await this.generateWeeklyReport();
    const email = this.formatWeeklyEmail(data);
    const sms = this.formatWeeklySMS(data);

    return { data, email, sms };
  }
}

export const budgetReportService = new BudgetReportService();

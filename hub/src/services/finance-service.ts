/**
 * Finance Service
 *
 * Business logic for financial data management, aggregations, and insights.
 */

import { db } from '../db/client';
import {
  financeTransactions,
  plaidAccounts,
  financeBudgets,
  financeInsights,
  financeBudgetAllocations,
} from '../db/schema';
import { eq, and, gte, lte, desc, sql, asc, isNull, or } from 'drizzle-orm';
import { notificationService } from './notification-service';

// ============================================
// Types
// ============================================

export interface FinanceOverview {
  totalBalanceCents: number;
  monthlySpendingCents: number;
  monthlyIncomeCents: number;
  netCashFlowCents: number;
  accountCount: number;
  pendingTransactions: number;
}

export interface SpendingByCategory {
  category: string;
  amountCents: number;
  transactionCount: number;
  percentOfTotal: number;
}

export interface TransactionFilters {
  accountId?: string;
  category?: string;
  startDate?: Date;
  endDate?: Date;
  minAmountCents?: number;
  maxAmountCents?: number;
  pending?: boolean;
  excluded?: boolean;
  limit?: number;
  offset?: number;
}

export interface TransactionRecord {
  id: string;
  plaidAccountId: string;
  plaidTransactionId: string | null;
  amountCents: number;
  isoCurrencyCode: string | null;
  date: string;
  datetime: Date | null;
  merchantName: string | null;
  name: string;
  category: string | null;
  userCategory: string | null;
  pending: boolean | null;
  userNote: string | null;
  isExcluded: boolean | null;
  createdAt: Date;
}

export interface RecentTransaction {
  id: string;
  merchantName: string | null;
  name: string;
  amountCents: number;
  date: string;
  category: string;
  pending: boolean | null;
}

export interface BudgetRecord {
  id: string;
  name: string;
  groupName: string | null;
  category: string;
  groupOrder: number | null;
  budgetOrder: number | null;
  amountCents: number;
  targetType: string | null;
  targetAmountCents: number | null;
  targetDate: string | null;
  periodType: 'weekly' | 'monthly' | 'yearly' | string | null;
  startDate: string | null;
  endDate: string | null;
  rolloverEnabled: boolean | null;
  rolloverAmountCents: number | null;
  carryoverOverspent: boolean | null;
  alertThreshold: number | null;
  alertsEnabled: boolean | null;
  isActive: boolean | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface BudgetStatus {
  budget: BudgetRecord;
  periodStart: string;
  periodEnd: string;
  spentCents: number;
  remainingCents: number;
  percentUsed: number;
  limitCents: number;
  isOverBudget: boolean;
  budgetedCents: number;
  targetAmountCents: number;
  targetProgressCents: number;
  targetRemainingCents: number;
  targetProgressPercent: number;
}

// ============================================
// Finance Service Class
// ============================================

class FinanceService {
  /**
   * Get financial overview for dashboard
   */
  async getOverview(): Promise<FinanceOverview> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Get account balances
    const accounts = await db
      .select()
      .from(plaidAccounts)
      .where(and(eq(plaidAccounts.isHidden, false), eq(plaidAccounts.syncStatus, 'active')));

    const totalBalanceCents = accounts.reduce((sum, acc) => {
      return sum + (acc.currentBalanceCents || 0);
    }, 0);

    // Get monthly spending/income
    const monthlyTxns = await db
      .select({
        amountCents: financeTransactions.amountCents,
      })
      .from(financeTransactions)
      .where(
        and(
          gte(financeTransactions.date, monthStart.toISOString().split('T')[0]),
          lte(financeTransactions.date, monthEnd.toISOString().split('T')[0]),
          eq(financeTransactions.isExcluded, false)
        )
      );

    let monthlySpendingCents = 0;
    let monthlyIncomeCents = 0;

    for (const txn of monthlyTxns) {
      if (txn.amountCents > 0) {
        monthlySpendingCents += txn.amountCents;
      } else {
        monthlyIncomeCents += Math.abs(txn.amountCents);
      }
    }

    // Get pending count
    const pendingResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(financeTransactions)
      .where(eq(financeTransactions.pending, true));

    return {
      totalBalanceCents,
      monthlySpendingCents,
      monthlyIncomeCents,
      netCashFlowCents: monthlyIncomeCents - monthlySpendingCents,
      accountCount: accounts.length,
      pendingTransactions: pendingResult[0]?.count || 0,
    };
  }

  /**
   * Get spending breakdown by category for a date range
   */
  async getSpendingByCategory(startDate: Date, endDate: Date): Promise<SpendingByCategory[]> {
    const result = await db
      .select({
        category: sql<string>`coalesce(${financeTransactions.userCategory}, ${financeTransactions.category}, 'Uncategorized')`,
        amountCents: sql<number>`sum(${financeTransactions.amountCents})::int`,
        count: sql<number>`count(*)::int`,
      })
      .from(financeTransactions)
      .where(
        and(
          gte(financeTransactions.date, startDate.toISOString().split('T')[0]),
          lte(financeTransactions.date, endDate.toISOString().split('T')[0]),
          eq(financeTransactions.isExcluded, false),
          sql`${financeTransactions.amountCents} > 0` // Only expenses
        )
      )
      .groupBy(
        sql`coalesce(${financeTransactions.userCategory}, ${financeTransactions.category}, 'Uncategorized')`
      )
      .orderBy(desc(sql`sum(${financeTransactions.amountCents})`));

    const total = result.reduce((sum, r) => sum + (r.amountCents || 0), 0);

    return result.map((r) => ({
      category: r.category || 'Uncategorized',
      amountCents: r.amountCents || 0,
      transactionCount: r.count || 0,
      percentOfTotal: total > 0 ? Math.round(((r.amountCents || 0) / total) * 100) : 0,
    }));
  }

  /**
   * Get transactions with filters
   */
  async getTransactions(filters: TransactionFilters = {}): Promise<TransactionRecord[]> {
    const conditions = [];

    if (filters.accountId) {
      conditions.push(eq(financeTransactions.plaidAccountId, filters.accountId));
    }
    if (filters.category) {
      conditions.push(
        or(
          eq(financeTransactions.category, filters.category),
          eq(financeTransactions.userCategory, filters.category)
        )
      );
    }
    if (filters.startDate) {
      conditions.push(
        gte(financeTransactions.date, filters.startDate.toISOString().split('T')[0])
      );
    }
    if (filters.endDate) {
      conditions.push(lte(financeTransactions.date, filters.endDate.toISOString().split('T')[0]));
    }
    if (filters.minAmountCents !== undefined) {
      conditions.push(gte(financeTransactions.amountCents, filters.minAmountCents));
    }
    if (filters.maxAmountCents !== undefined) {
      conditions.push(lte(financeTransactions.amountCents, filters.maxAmountCents));
    }
    if (filters.pending !== undefined) {
      conditions.push(eq(financeTransactions.pending, filters.pending));
    }
    if (filters.excluded !== undefined) {
      conditions.push(eq(financeTransactions.isExcluded, filters.excluded));
    }

    const transactions = await db
      .select()
      .from(financeTransactions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(financeTransactions.date))
      .limit(filters.limit || 50)
      .offset(filters.offset || 0);

    return transactions;
  }

  /**
   * Get a single transaction by ID
   */
  async getTransaction(id: string): Promise<TransactionRecord | null> {
    const [transaction] = await db
      .select()
      .from(financeTransactions)
      .where(eq(financeTransactions.id, id));

    return transaction || null;
  }

  /**
   * Update transaction (category, notes, exclusion)
   */
  async updateTransaction(
    id: string,
    data: {
      userCategory?: string;
      userNote?: string;
      isExcluded?: boolean;
    }
  ): Promise<TransactionRecord | null> {
    const [updated] = await db
      .update(financeTransactions)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(financeTransactions.id, id))
      .returning();

    return updated || null;
  }

  /**
   * Get recent transactions for widget
   */
  async getRecentTransactions(limit = 5): Promise<RecentTransaction[]> {
    const transactions = await db
      .select({
        id: financeTransactions.id,
        merchantName: financeTransactions.merchantName,
        name: financeTransactions.name,
        amountCents: financeTransactions.amountCents,
        date: financeTransactions.date,
        category: sql<string>`coalesce(${financeTransactions.userCategory}, ${financeTransactions.category}, 'Uncategorized')`,
        pending: financeTransactions.pending,
      })
      .from(financeTransactions)
      .where(eq(financeTransactions.isExcluded, false))
      .orderBy(desc(financeTransactions.date))
      .limit(limit);

    return transactions;
  }

  /**
   * Get widget summary data for command center
   */
  async getWidgetSummary(): Promise<{
    overview: FinanceOverview;
    topCategories: SpendingByCategory[];
    recentTransactions: RecentTransaction[];
  }> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [overview, topCategories, recentTransactions] = await Promise.all([
      this.getOverview(),
      this.getSpendingByCategory(monthStart, monthEnd).then((cats) => cats.slice(0, 3)),
      this.getRecentTransactions(3),
    ]);

    return {
      overview,
      topCategories,
      recentTransactions,
    };
  }

  /**
   * Get count of connected accounts
   */
  async getAccountCount(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(plaidAccounts)
      .where(and(eq(plaidAccounts.isHidden, false), eq(plaidAccounts.syncStatus, 'active')));

    return result[0]?.count || 0;
  }

  /**
   * Check if finance module is configured and has data
   */
  async isConfigured(): Promise<boolean> {
    const count = await this.getAccountCount();
    return count > 0;
  }

  /**
   * Create or get a manual account for uploaded transactions
   */
  async getOrCreateManualAccount(name = 'Manual Import'): Promise<string> {
    // Check if manual account already exists
    const [existing] = await db
      .select()
      .from(plaidAccounts)
      .where(eq(plaidAccounts.itemId, 'manual-upload'));

    if (existing) {
      return existing.id;
    }

    // Create a manual account
    const [account] = await db
      .insert(plaidAccounts)
      .values({
        itemId: 'manual-upload',
        accountId: `manual-${Date.now()}`,
        institutionName: name,
        accessTokenEncrypted: 'manual', // No real token needed
        accessTokenIv: 'manual',
        accountName: name,
        accountType: 'depository',
        accountSubtype: 'checking',
        syncStatus: 'active',
        isHidden: false,
      })
      .returning();

    return account.id;
  }

  /**
   * Import transactions from parsed CSV data
   */
  async importTransactions(
    accountId: string,
    transactions: Array<{
      date: string;
      description: string;
      amount: number; // In dollars (will be converted to cents)
      category?: string;
      type?: string;
    }>
  ): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;

    for (const txn of transactions) {
      try {
        // Convert amount to cents and negate to match Plaid convention
        // Bank CSVs: positive = income/credit, negative = expense/debit
        // Plaid convention: positive = expense, negative = income
        // So we negate the CSV amount
        const amountCents = Math.round(txn.amount * -100);

        await db.insert(financeTransactions).values({
          plaidAccountId: accountId,
          plaidTransactionId: null,
          amountCents,
          isoCurrencyCode: 'USD',
          date: txn.date,
          merchantName: null,
          name: txn.description,
          category: txn.category || this.inferCategory(txn.description),
          pending: false,
          isExcluded: false,
        });
        imported++;
      } catch (err) {
        console.error('Failed to import transaction:', txn, err);
        skipped++;
      }
    }

    return { imported, skipped };
  }

  /**
   * Simple category inference based on description keywords
   */
  private inferCategory(description: string): string {
    const lower = description.toLowerCase();

    // Common category mappings
    const categories: Record<string, string[]> = {
      'Food & Dining': [
        'restaurant',
        'cafe',
        'coffee',
        'pizza',
        'burger',
        'food',
        'doordash',
        'ubereats',
        'grubhub',
        'starbucks',
        'chipotle',
        'mcdonald',
        'subway',
      ],
      Groceries: ['grocery', 'safeway', 'kroger', 'whole foods', 'trader joe', 'costco', 'walmart'],
      Transportation: ['uber', 'lyft', 'gas', 'shell', 'chevron', 'exxon', 'parking', 'transit'],
      Shopping: ['amazon', 'target', 'best buy', 'apple', 'nike', 'clothing', 'store'],
      Entertainment: ['netflix', 'spotify', 'hulu', 'disney', 'movie', 'theatre', 'concert'],
      Utilities: ['electric', 'water', 'gas bill', 'internet', 'comcast', 'att', 'verizon'],
      Health: ['pharmacy', 'cvs', 'walgreens', 'doctor', 'hospital', 'medical', 'dental'],
      Travel: ['airline', 'hotel', 'airbnb', 'flight', 'booking', 'expedia'],
      Subscriptions: ['subscription', 'membership', 'annual', 'monthly'],
      Transfer: ['transfer', 'zelle', 'venmo', 'paypal'],
      Income: ['payroll', 'direct deposit', 'salary', 'deposit'],
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some((kw) => lower.includes(kw))) {
        return category;
      }
    }

    return 'Uncategorized';
  }

  /**
   * Get list of manual accounts
   */
  async getManualAccounts(): Promise<Array<{ id: string; name: string; transactionCount: number }>> {
    const accounts = await db
      .select({
        id: plaidAccounts.id,
        name: plaidAccounts.institutionName,
      })
      .from(plaidAccounts)
      .where(eq(plaidAccounts.itemId, 'manual-upload'));

    const results = [];
    for (const account of accounts) {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(financeTransactions)
        .where(eq(financeTransactions.plaidAccountId, account.id));

      results.push({
        id: account.id,
        name: account.name,
        transactionCount: countResult?.count || 0,
      });
    }

    return results;
  }

  // ============================================
  // Budgets
  // ============================================

  async getBudgets(includeInactive = false): Promise<BudgetRecord[]> {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    const conditions = includeInactive
      ? undefined
      : and(
          eq(financeBudgets.isActive, true),
          or(isNull(financeBudgets.startDate), lte(financeBudgets.startDate, today)),
          or(isNull(financeBudgets.endDate), gte(financeBudgets.endDate, today))
        );

    const budgets = await db
      .select()
      .from(financeBudgets)
      .where(conditions)
      .orderBy(
        asc(financeBudgets.groupOrder),
        asc(financeBudgets.groupName),
        asc(financeBudgets.budgetOrder),
        asc(financeBudgets.name)
      );

    return budgets;
  }

  async getBudget(id: string): Promise<BudgetRecord | null> {
    const [budget] = await db.select().from(financeBudgets).where(eq(financeBudgets.id, id));
    return budget || null;
  }

  async createBudget(data: {
    name: string;
    groupName?: string | null;
    groupOrder?: number;
    budgetOrder?: number;
    category: string;
    amountCents: number;
    targetType?: string;
    targetAmountCents?: number | null;
    targetDate?: string | null;
    month?: string | null;
    periodType?: 'weekly' | 'monthly' | 'yearly';
    startDate?: string | null;
    endDate?: string | null;
    rolloverEnabled?: boolean;
    rolloverAmountCents?: number;
    carryoverOverspent?: boolean;
    alertThreshold?: number;
    alertsEnabled?: boolean;
  }): Promise<BudgetRecord> {
    const [budget] = await db
      .insert(financeBudgets)
      .values({
        name: data.name,
        groupName: data.groupName || null,
        groupOrder: data.groupOrder ?? 0,
        budgetOrder: data.budgetOrder ?? 0,
        category: data.category,
        amountCents: data.amountCents,
        targetType: data.targetType || 'monthly',
        targetAmountCents: data.targetAmountCents ?? null,
        targetDate: data.targetDate ?? null,
        periodType: data.periodType || 'monthly',
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        rolloverEnabled: data.rolloverEnabled ?? false,
        rolloverAmountCents: data.rolloverAmountCents ?? 0,
        carryoverOverspent: data.carryoverOverspent ?? true,
        alertThreshold: data.alertThreshold ?? 80,
        alertsEnabled: data.alertsEnabled ?? true,
        isActive: true,
        updatedAt: new Date(),
      })
      .returning();

    if (data.month) {
      await this.setBudgetAllocation(budget.id, data.month, data.amountCents);
    }

    return budget;
  }

  async updateBudget(
    id: string,
    data: Partial<{
      name: string;
      groupName: string | null;
      groupOrder: number;
      budgetOrder: number;
      category: string;
      amountCents: number;
      targetType: string;
      targetAmountCents: number | null;
      targetDate: string | null;
      periodType: 'weekly' | 'monthly' | 'yearly';
      startDate: string | null;
      endDate: string | null;
      rolloverEnabled: boolean;
      rolloverAmountCents: number;
      carryoverOverspent: boolean;
      alertThreshold: number;
      alertsEnabled: boolean;
      isActive: boolean;
    }>
  ): Promise<BudgetRecord | null> {
    const [budget] = await db
      .update(financeBudgets)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(financeBudgets.id, id))
      .returning();

    return budget || null;
  }

  async deactivateBudget(id: string): Promise<void> {
    await db
      .update(financeBudgets)
      .set({
        isActive: false,
        endDate: new Date().toISOString().split('T')[0],
        updatedAt: new Date(),
      })
      .where(eq(financeBudgets.id, id));
  }

  async getBudgetStatuses(includeInactive = false, month?: string): Promise<BudgetStatus[]> {
    const budgets = await this.getBudgets(includeInactive);
    const now = new Date();
    const viewMonth = month || this.getMonthKey(now);

    const statuses: BudgetStatus[] = [];
    for (const budget of budgets) {
      const { periodStart, periodEnd } = this.getBudgetPeriodRange(budget, now, viewMonth);
      const spentCents = await this.getBudgetSpending(budget, periodStart, periodEnd);
      const budgetedCents = await this.getBudgetedAmount(budget.id, viewMonth, budget.amountCents);
      const limitCents = this.getBudgetLimit(budget, budgetedCents);
      const rawRemaining = limitCents - spentCents;
      const remainingCents =
        budget.carryoverOverspent === false ? Math.max(0, rawRemaining) : rawRemaining;
      const percentUsed = limitCents > 0 ? Math.round((spentCents / limitCents) * 100) : 0;
      const targetAmountCents = this.getTargetAmount(budget);
      const targetProgressCents = budgetedCents;
      const targetRemainingCents = Math.max(0, targetAmountCents - targetProgressCents);
      const targetProgressPercent =
        targetAmountCents > 0 ? Math.round((targetProgressCents / targetAmountCents) * 100) : 0;

      statuses.push({
        budget,
        periodStart,
        periodEnd,
        spentCents,
        remainingCents,
        percentUsed,
        limitCents,
        isOverBudget: spentCents > limitCents,
        budgetedCents,
        targetAmountCents,
        targetProgressCents,
        targetRemainingCents,
        targetProgressPercent,
      });
    }

    return statuses;
  }

  async setBudgetAllocation(budgetId: string, month: string, amountCents: number): Promise<void> {
    const normalized = this.normalizeMonth(month);

    const existing = await db
      .select()
      .from(financeBudgetAllocations)
      .where(and(eq(financeBudgetAllocations.budgetId, budgetId), eq(financeBudgetAllocations.month, normalized)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(financeBudgetAllocations)
        .set({
          amountCents,
          updatedAt: new Date(),
        })
        .where(and(eq(financeBudgetAllocations.budgetId, budgetId), eq(financeBudgetAllocations.month, normalized)));
    } else {
      await db.insert(financeBudgetAllocations).values({
        budgetId,
        month: normalized,
        amountCents,
      });
    }
  }

  async checkBudgetAlerts(): Promise<{ alertsSent: number }> {
    const statuses = await this.getBudgetStatuses(false);
    let alertsSent = 0;

    for (const status of statuses) {
      const { budget, percentUsed, periodStart, periodEnd } = status;

      if (budget.alertsEnabled === false) continue;
      const threshold = budget.alertThreshold ?? 80;
      if (percentUsed < threshold) continue;

      const existing = await db
        .select()
        .from(financeInsights)
        .where(
          and(
            eq(financeInsights.insightType, 'budget_warning'),
            sql`${financeInsights.data}->>'budgetId' = ${budget.id}`,
            sql`${financeInsights.data}->>'periodStart' = ${periodStart}`
          )
        )
        .limit(1);

      if (existing.length > 0) continue;

      const message = `💸 *Budget Alert*\n\n` +
        `*${budget.name}* (${budget.category})\n` +
        `Used: ${percentUsed}%\n` +
        `Period: ${periodStart} → ${periodEnd}\n` +
        `Remaining: ${formatCurrency(Math.max(status.remainingCents, 0))}\n\n` +
        `_Check Command Center → Budget for details._`;

      await notificationService.send(message, { priority: percentUsed >= 100 ? 'urgent' : 'high' });

      await db.insert(financeInsights).values({
        insightType: 'budget_warning',
        category: budget.category,
        title: `Budget warning: ${budget.name}`,
        description: `Budget ${budget.name} crossed ${threshold}% (${percentUsed}%) for ${periodStart} - ${periodEnd}.`,
        severity: percentUsed >= 100 ? 'alert' : 'warning',
        actionable: true,
        actionType: 'review',
        data: {
          budgetId: budget.id,
          periodStart,
          periodEnd,
          percentUsed,
          spentCents: status.spentCents,
          limitCents: status.limitCents,
        },
      });

      alertsSent += 1;
    }

    return { alertsSent };
  }

  private getBudgetLimit(budget: BudgetRecord, budgetedCents: number): number {
    if (budget.rolloverEnabled) {
      return budgetedCents + (budget.rolloverAmountCents || 0);
    }
    return budgetedCents;
  }

  private getTargetAmount(budget: BudgetRecord): number {
    const target = budget.targetAmountCents ?? budget.amountCents;
    switch (budget.targetType) {
      case 'weekly':
        return target * 4;
      case 'yearly':
        return Math.round(target / 12);
      case 'monthly':
      default:
        return target;
    }
  }

  private getBudgetPeriodRange(
    budget: BudgetRecord,
    referenceDate: Date,
    monthOverride?: string
  ): { periodStart: string; periodEnd: string } {
    const ref = new Date(referenceDate);
    ref.setHours(0, 0, 0, 0);

    let start = new Date(ref);
    let end = new Date(ref);

    if (monthOverride) {
      const [y, m] = this.normalizeMonth(monthOverride).split('-').map((v) => Number.parseInt(v, 10));
      start = new Date(y, m - 1, 1);
      end = new Date(y, m, 0);
    } else {
    switch (budget.periodType || 'monthly') {
      case 'weekly': {
        const day = ref.getDay(); // 0 = Sun
        const diff = (day + 6) % 7; // Monday start
        start.setDate(ref.getDate() - diff);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
        break;
      }
      case 'yearly':
        start = new Date(ref.getFullYear(), 0, 1);
        end = new Date(ref.getFullYear(), 11, 31);
        break;
      case 'monthly':
      default:
        start = new Date(ref.getFullYear(), ref.getMonth(), 1);
        end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
        break;
    }
    }

    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];

    const finalStart = budget.startDate && budget.startDate > startStr ? budget.startDate : startStr;
    const finalEnd = budget.endDate && budget.endDate < endStr ? budget.endDate : endStr;

    return { periodStart: finalStart, periodEnd: finalEnd };
  }

  private async getBudgetSpending(
    budget: BudgetRecord,
    periodStart: string,
    periodEnd: string
  ): Promise<number> {
    const [result] = await db
      .select({
        total: sql<number>`coalesce(sum(${financeTransactions.amountCents}), 0)::int`,
      })
      .from(financeTransactions)
      .where(
        and(
          gte(financeTransactions.date, periodStart),
          lte(financeTransactions.date, periodEnd),
          eq(financeTransactions.isExcluded, false),
          sql`${financeTransactions.amountCents} > 0`,
          sql`coalesce(${financeTransactions.userCategory}, ${financeTransactions.category}, 'Uncategorized') = ${budget.category}`
        )
      );

    return result?.total || 0;
  }

  private async getBudgetedAmount(
    budgetId: string,
    month: string,
    fallbackAmountCents: number
  ): Promise<number> {
    const normalized = this.normalizeMonth(month);
    const [allocation] = await db
      .select()
      .from(financeBudgetAllocations)
      .where(and(eq(financeBudgetAllocations.budgetId, budgetId), eq(financeBudgetAllocations.month, normalized)));

    return allocation?.amountCents ?? fallbackAmountCents;
  }

  private normalizeMonth(month: string): string {
    const [yearStr, monthStr] = month.split('-');
    const year = Number.parseInt(yearStr, 10);
    const monthNum = Number.parseInt(monthStr, 10);
    if (!year || !monthNum) {
      return this.getMonthKey(new Date());
    }
    return `${year.toString().padStart(4, '0')}-${monthNum.toString().padStart(2, '0')}`;
  }

  private getMonthKey(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
  }
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export const financeService = new FinanceService();

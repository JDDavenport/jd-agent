/**
 * Spending Analytics Service
 *
 * Analytics and insights for spending patterns:
 * - Spending trends over time
 * - Top merchants analysis
 * - Category breakdown
 * - Budget accuracy tracking
 * - Income vs expenses analysis
 */

import { db } from '../db/client';
import { financeTransactions, financeBudgets, financeBudgetAllocations } from '../db/schema';
import { eq, and, gte, lte, desc, sql, asc } from 'drizzle-orm';
import { financeService } from './finance-service';

// ============================================
// Types
// ============================================

export interface SpendingTrendPoint {
  date: string; // YYYY-MM-DD or YYYY-MM depending on granularity
  spentCents: number;
  incomeCents: number;
  netCents: number;
  transactionCount: number;
}

export interface SpendingTrends {
  period: 'daily' | 'weekly' | 'monthly';
  data: SpendingTrendPoint[];
  summary: {
    totalSpentCents: number;
    totalIncomeCents: number;
    averageSpentCents: number;
    averageIncomeCents: number;
    highestSpendDay: { date: string; amountCents: number } | null;
    lowestSpendDay: { date: string; amountCents: number } | null;
  };
}

export interface MerchantAnalysis {
  merchantName: string;
  totalSpentCents: number;
  transactionCount: number;
  averageTransactionCents: number;
  lastTransactionDate: string;
  category: string | null;
  percentOfTotal: number;
}

export interface CategoryTrend {
  category: string;
  periods: Array<{
    period: string;
    spentCents: number;
    budgetCents: number;
    percentUsed: number;
  }>;
  trend: 'increasing' | 'decreasing' | 'stable';
  averageSpentCents: number;
}

export interface BudgetAccuracy {
  category: string;
  periods: Array<{
    period: string; // YYYY-MM
    budgetCents: number;
    actualCents: number;
    varianceCents: number;
    variancePercent: number;
    status: 'under' | 'over' | 'on_target';
  }>;
  overallAccuracy: number; // percentage 0-100
  averageVariancePercent: number;
}

export interface IncomeExpenseComparison {
  period: string;
  incomeCents: number;
  expensesCents: number;
  savingsCents: number;
  savingsRate: number; // percentage
}

// ============================================
// Spending Analytics Service
// ============================================

class SpendingAnalyticsService {
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
   * Get date range based on period
   */
  private getDateRange(
    lookbackDays: number
  ): { startDate: Date; endDate: Date } {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - lookbackDays);
    startDate.setHours(0, 0, 0, 0);

    return { startDate, endDate };
  }

  // ============================================
  // Spending Trends
  // ============================================

  /**
   * Get spending trends over time
   */
  async getSpendingTrends(options: {
    period: 'daily' | 'weekly' | 'monthly';
    lookbackDays?: number;
  }): Promise<SpendingTrends> {
    const { period, lookbackDays = 90 } = options;
    const { startDate, endDate } = this.getDateRange(lookbackDays);

    // Get all transactions in range
    const transactions = await financeService.getTransactions({
      startDate,
      endDate,
      excluded: false,
      limit: 5000,
    });

    // Group by period
    const groupedData = new Map<
      string,
      { spent: number; income: number; count: number }
    >();

    for (const txn of transactions) {
      const date = new Date(txn.date);
      let periodKey: string;

      if (period === 'daily') {
        periodKey = txn.date;
      } else if (period === 'weekly') {
        // Get start of week (Sunday)
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        periodKey = weekStart.toISOString().split('T')[0];
      } else {
        // Monthly
        periodKey = txn.date.substring(0, 7); // YYYY-MM
      }

      const existing = groupedData.get(periodKey) || {
        spent: 0,
        income: 0,
        count: 0,
      };

      if (txn.amountCents > 0) {
        existing.spent += txn.amountCents;
      } else {
        existing.income += Math.abs(txn.amountCents);
      }
      existing.count += 1;

      groupedData.set(periodKey, existing);
    }

    // Convert to array and sort
    const data: SpendingTrendPoint[] = Array.from(groupedData.entries())
      .map(([date, values]) => ({
        date,
        spentCents: values.spent,
        incomeCents: values.income,
        netCents: values.income - values.spent,
        transactionCount: values.count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate summary
    const totalSpent = data.reduce((sum, d) => sum + d.spentCents, 0);
    const totalIncome = data.reduce((sum, d) => sum + d.incomeCents, 0);
    const spendingDays = data.filter((d) => d.spentCents > 0);

    let highestSpendDay = null;
    let lowestSpendDay = null;

    if (spendingDays.length > 0) {
      const sorted = [...spendingDays].sort(
        (a, b) => b.spentCents - a.spentCents
      );
      highestSpendDay = {
        date: sorted[0].date,
        amountCents: sorted[0].spentCents,
      };
      lowestSpendDay = {
        date: sorted[sorted.length - 1].date,
        amountCents: sorted[sorted.length - 1].spentCents,
      };
    }

    return {
      period,
      data,
      summary: {
        totalSpentCents: totalSpent,
        totalIncomeCents: totalIncome,
        averageSpentCents: data.length > 0 ? Math.round(totalSpent / data.length) : 0,
        averageIncomeCents: data.length > 0 ? Math.round(totalIncome / data.length) : 0,
        highestSpendDay,
        lowestSpendDay,
      },
    };
  }

  // ============================================
  // Merchant Analysis
  // ============================================

  /**
   * Get top merchants by spending
   */
  async getTopMerchants(options: {
    limit?: number;
    lookbackDays?: number;
  }): Promise<MerchantAnalysis[]> {
    const { limit = 20, lookbackDays = 90 } = options;
    const { startDate, endDate } = this.getDateRange(lookbackDays);

    // Get all expense transactions
    const transactions = await financeService.getTransactions({
      startDate,
      endDate,
      excluded: false,
      limit: 5000,
    });

    // Filter to expenses only and group by merchant
    const merchantData = new Map<
      string,
      {
        total: number;
        count: number;
        lastDate: string;
        category: string | null;
      }
    >();

    let totalSpending = 0;

    for (const txn of transactions) {
      if (txn.amountCents <= 0) continue; // Skip income

      totalSpending += txn.amountCents;

      const merchantName = txn.merchantName || txn.name || 'Unknown';
      const existing = merchantData.get(merchantName) || {
        total: 0,
        count: 0,
        lastDate: txn.date,
        category: txn.userCategory || txn.category,
      };

      existing.total += txn.amountCents;
      existing.count += 1;
      if (txn.date > existing.lastDate) {
        existing.lastDate = txn.date;
      }

      merchantData.set(merchantName, existing);
    }

    // Convert to array, calculate percentages, sort, and limit
    const merchants: MerchantAnalysis[] = Array.from(merchantData.entries())
      .map(([name, data]) => ({
        merchantName: name,
        totalSpentCents: data.total,
        transactionCount: data.count,
        averageTransactionCents: Math.round(data.total / data.count),
        lastTransactionDate: data.lastDate,
        category: data.category,
        percentOfTotal:
          totalSpending > 0
            ? Math.round((data.total / totalSpending) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.totalSpentCents - a.totalSpentCents)
      .slice(0, limit);

    return merchants;
  }

  // ============================================
  // Category Trends
  // ============================================

  /**
   * Get spending trends by category over multiple months
   */
  async getCategoryTrends(options: {
    months?: number;
  }): Promise<CategoryTrend[]> {
    const { months = 6 } = options;

    // Get budgets
    const budgets = await financeService.getBudgets();
    const budgetMap = new Map<string, number>();
    for (const budget of budgets) {
      budgetMap.set(budget.category, budget.amountCents);
    }

    // Generate month periods
    const periods: string[] = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      periods.push(
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      );
    }

    // Get transactions for each period
    const categoryData = new Map<
      string,
      Map<string, number>
    >();

    for (const period of periods) {
      const [year, month] = period.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);

      const transactions = await financeService.getTransactions({
        startDate,
        endDate,
        excluded: false,
        limit: 2000,
      });

      for (const txn of transactions) {
        if (txn.amountCents <= 0) continue;

        const category = txn.userCategory || txn.category || 'Uncategorized';

        if (!categoryData.has(category)) {
          categoryData.set(category, new Map());
        }

        const periodData = categoryData.get(category)!;
        const current = periodData.get(period) || 0;
        periodData.set(period, current + txn.amountCents);
      }
    }

    // Build category trends
    const trends: CategoryTrend[] = [];

    for (const [category, periodMap] of categoryData) {
      const budgetCents = budgetMap.get(category) || 0;
      const periodData = periods.map((period) => {
        const spentCents = periodMap.get(period) || 0;
        return {
          period,
          spentCents,
          budgetCents,
          percentUsed: budgetCents > 0 ? Math.round((spentCents / budgetCents) * 100) : 0,
        };
      });

      // Calculate trend direction
      const values = periodData.map((p) => p.spentCents);
      const firstHalf = values.slice(0, Math.floor(values.length / 2));
      const secondHalf = values.slice(Math.floor(values.length / 2));
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / (firstHalf.length || 1);
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / (secondHalf.length || 1);

      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      const threshold = 0.15; // 15% change threshold
      if (secondAvg > firstAvg * (1 + threshold)) {
        trend = 'increasing';
      } else if (secondAvg < firstAvg * (1 - threshold)) {
        trend = 'decreasing';
      }

      const total = values.reduce((a, b) => a + b, 0);

      trends.push({
        category,
        periods: periodData,
        trend,
        averageSpentCents: Math.round(total / values.length),
      });
    }

    // Sort by average spending (highest first)
    return trends.sort((a, b) => b.averageSpentCents - a.averageSpentCents);
  }

  // ============================================
  // Budget Accuracy
  // ============================================

  /**
   * Calculate budget accuracy over multiple months
   */
  async getBudgetAccuracy(options: {
    months?: number;
  }): Promise<BudgetAccuracy[]> {
    const { months = 6 } = options;

    // Get budgets
    const budgets = await financeService.getBudgets();

    // Generate month periods
    const periods: string[] = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      periods.push(
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      );
    }

    const results: BudgetAccuracy[] = [];

    for (const budget of budgets) {
      const periodData: BudgetAccuracy['periods'] = [];
      let totalVariancePercent = 0;
      let periodsWithBudget = 0;

      for (const period of periods) {
        const [year, month] = period.split('-').map(Number);
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59, 999);

        // Get actual spending for this category in this period
        const transactions = await financeService.getTransactions({
          startDate,
          endDate,
          category: budget.category,
          excluded: false,
          limit: 500,
        });

        const actualCents = transactions
          .filter((t) => t.amountCents > 0)
          .reduce((sum, t) => sum + t.amountCents, 0);

        const varianceCents = actualCents - budget.amountCents;
        const variancePercent =
          budget.amountCents > 0
            ? Math.round((varianceCents / budget.amountCents) * 100)
            : 0;

        let status: 'under' | 'over' | 'on_target' = 'on_target';
        if (variancePercent > 10) {
          status = 'over';
        } else if (variancePercent < -10) {
          status = 'under';
        }

        periodData.push({
          period,
          budgetCents: budget.amountCents,
          actualCents,
          varianceCents,
          variancePercent,
          status,
        });

        if (budget.amountCents > 0) {
          totalVariancePercent += Math.abs(variancePercent);
          periodsWithBudget++;
        }
      }

      // Calculate overall accuracy (100 - average absolute variance %)
      const avgVariance = periodsWithBudget > 0 ? totalVariancePercent / periodsWithBudget : 0;
      const accuracy = Math.max(0, 100 - avgVariance);

      results.push({
        category: budget.category,
        periods: periodData,
        overallAccuracy: Math.round(accuracy),
        averageVariancePercent: Math.round(avgVariance),
      });
    }

    // Sort by accuracy (lowest first - needs attention)
    return results.sort((a, b) => a.overallAccuracy - b.overallAccuracy);
  }

  // ============================================
  // Income vs Expenses
  // ============================================

  /**
   * Get income vs expenses comparison by month
   */
  async getIncomeExpenseComparison(options: {
    months?: number;
  }): Promise<IncomeExpenseComparison[]> {
    const { months = 12 } = options;

    // Generate month periods
    const periods: string[] = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      periods.push(
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      );
    }

    const results: IncomeExpenseComparison[] = [];

    for (const period of periods) {
      const [year, month] = period.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);

      const transactions = await financeService.getTransactions({
        startDate,
        endDate,
        excluded: false,
        limit: 2000,
      });

      let incomeCents = 0;
      let expensesCents = 0;

      for (const txn of transactions) {
        if (txn.amountCents > 0) {
          expensesCents += txn.amountCents;
        } else {
          incomeCents += Math.abs(txn.amountCents);
        }
      }

      const savingsCents = incomeCents - expensesCents;
      const savingsRate = incomeCents > 0 ? Math.round((savingsCents / incomeCents) * 100) : 0;

      results.push({
        period,
        incomeCents,
        expensesCents,
        savingsCents,
        savingsRate,
      });
    }

    return results;
  }

  // ============================================
  // Summary Dashboard Data
  // ============================================

  /**
   * Get all analytics data for the dashboard
   */
  async getDashboardData(): Promise<{
    trends: SpendingTrends;
    topMerchants: MerchantAnalysis[];
    categoryTrends: CategoryTrend[];
    budgetAccuracy: BudgetAccuracy[];
    incomeExpenses: IncomeExpenseComparison[];
  }> {
    const [trends, topMerchants, categoryTrends, budgetAccuracy, incomeExpenses] =
      await Promise.all([
        this.getSpendingTrends({ period: 'daily', lookbackDays: 30 }),
        this.getTopMerchants({ limit: 10, lookbackDays: 90 }),
        this.getCategoryTrends({ months: 6 }),
        this.getBudgetAccuracy({ months: 6 }),
        this.getIncomeExpenseComparison({ months: 12 }),
      ]);

    return {
      trends,
      topMerchants,
      categoryTrends,
      budgetAccuracy,
      incomeExpenses,
    };
  }
}

export const spendingAnalyticsService = new SpendingAnalyticsService();

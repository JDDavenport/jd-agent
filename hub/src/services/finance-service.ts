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
} from '../db/schema';
import { eq, and, gte, lte, desc, sql, asc, isNull, or } from 'drizzle-orm';

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
}

export const financeService = new FinanceService();

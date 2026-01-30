/**
 * Finance Types
 *
 * TypeScript interfaces for the Budget & Finance module.
 * These types match the backend finance-service.ts responses.
 */

// ============================================
// Overview Types
// ============================================

export interface FinanceOverview {
  totalBalanceCents: number;
  monthlySpendingCents: number;
  monthlyIncomeCents: number;
  netCashFlowCents: number;
  accountCount: number;
  pendingTransactions: number;
}

// ============================================
// Account Types
// ============================================

export interface PlaidAccount {
  id: string;
  itemId: string;
  accountId: string;
  institutionId: string | null;
  institutionName: string;
  accountName: string | null;
  accountType: string | null;
  accountSubtype: string | null;
  accountMask: string | null;
  currentBalanceCents: number | null;
  availableBalanceCents: number | null;
  limitCents: number | null;
  isoCurrencyCode: string | null;
  lastSyncAt: string | null;
  syncStatus: 'active' | 'error' | 'disconnected' | string | null;
  displayName: string | null;
}

// ============================================
// Transaction Types
// ============================================

export interface Transaction {
  id: string;
  plaidAccountId: string;
  plaidTransactionId: string | null;
  amountCents: number;
  isoCurrencyCode: string | null;
  date: string;
  datetime: string | null;
  merchantName: string | null;
  name: string;
  category: string | null;
  userCategory: string | null;
  pending: boolean | null;
  userNote: string | null;
  isExcluded: boolean | null;
  createdAt: string;
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
// Spending/Category Types
// ============================================

export interface SpendingByCategory {
  category: string;
  amountCents: number;
  transactionCount: number;
  percentOfTotal: number;
}

// ============================================
// Widget Types
// ============================================

export interface FinanceWidgetData {
  overview: FinanceOverview;
  topCategories: SpendingByCategory[];
  recentTransactions: RecentTransaction[];
}

// ============================================
// Status Types
// ============================================

export interface FinanceStatus {
  plaidConfigured: boolean;
  encryptionConfigured: boolean;
  hasAccounts: boolean;
  ready: boolean;
}

// ============================================
// Budget Types
// ============================================

export interface Budget {
  id: string;
  name: string;
  groupName: string | null;
  groupOrder: number | null;
  budgetOrder: number | null;
  category: string;
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
  createdAt: string;
  updatedAt: string;
}

export interface BudgetStatus {
  budget: Budget;
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
// Sync Types
// ============================================

export interface SyncResult {
  added: number;
  modified: number;
  removed: number;
}

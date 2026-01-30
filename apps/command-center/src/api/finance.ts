/**
 * Finance API Functions
 *
 * API functions for the Budget & Finance module.
 */

import apiClient from './client';
import type {
  FinanceOverview,
  FinanceWidgetData,
  FinanceStatus,
  Budget,
  BudgetStatus,
  PlaidAccount,
  RecentTransaction,
  SpendingByCategory,
  SyncResult,
  Transaction,
} from '../types/finance';

// ============================================
// Status
// ============================================

export const getFinanceStatus = (): Promise<FinanceStatus> =>
  apiClient.get('/finance/status');

// ============================================
// Budgets
// ============================================

export const getBudgets = (includeInactive = false, month?: string): Promise<BudgetStatus[]> => {
  const params = new URLSearchParams();
  if (includeInactive) params.append('includeInactive', 'true');
  if (month) params.append('month', month);
  const query = params.toString();
  return apiClient.get(`/finance/budgets${query ? `?${query}` : ''}`);
};

export const getBudget = (id: string): Promise<Budget> =>
  apiClient.get(`/finance/budgets/${id}`);

export interface BudgetInput {
  name: string;
  groupName?: string;
  groupOrder?: number;
  budgetOrder?: number;
  category: string;
  amount: number;
  targetType?: 'monthly' | 'weekly' | 'yearly';
  targetAmount?: number;
  targetDate?: string;
  month?: string;
  periodType?: 'weekly' | 'monthly' | 'yearly';
  startDate?: string;
  endDate?: string;
  rolloverEnabled?: boolean;
  rolloverAmount?: number;
  carryoverOverspent?: boolean;
  alertThreshold?: number;
  alertsEnabled?: boolean;
}

export const createBudget = (data: BudgetInput): Promise<Budget> =>
  apiClient.post('/finance/budgets', data);

export const updateBudget = (id: string, data: Partial<BudgetInput> & { isActive?: boolean }): Promise<Budget> =>
  apiClient.patch(`/finance/budgets/${id}`, data);

export const deleteBudget = (id: string): Promise<void> =>
  apiClient.delete(`/finance/budgets/${id}`);

// ============================================
// Overview & Widget
// ============================================

export const getFinanceOverview = (): Promise<FinanceOverview> =>
  apiClient.get('/finance/overview');

export const getFinanceWidget = (): Promise<FinanceWidgetData> =>
  apiClient.get('/finance/widget');

export const getSpendingByCategory = (
  startDate?: string,
  endDate?: string
): Promise<SpendingByCategory[]> => {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  const query = params.toString();
  return apiClient.get(`/finance/spending${query ? `?${query}` : ''}`);
};

// ============================================
// Accounts
// ============================================

export const getAccounts = (): Promise<PlaidAccount[]> =>
  apiClient.get('/finance/accounts');

export const syncAccount = (accountId: string): Promise<SyncResult> =>
  apiClient.post(`/finance/accounts/${accountId}/sync`);

export const updateAccount = (
  accountId: string,
  data: { displayName?: string; isHidden?: boolean }
): Promise<void> => apiClient.patch(`/finance/accounts/${accountId}`, data);

export const disconnectAccount = (itemId: string): Promise<void> =>
  apiClient.delete(`/finance/accounts/${itemId}`);

// ============================================
// Transactions
// ============================================

export interface TransactionFilters {
  accountId?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  pending?: boolean;
  limit?: number;
  offset?: number;
}

export const getTransactions = (filters?: TransactionFilters): Promise<Transaction[]> => {
  const params = new URLSearchParams();
  if (filters) {
    if (filters.accountId) params.append('accountId', filters.accountId);
    if (filters.category) params.append('category', filters.category);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.minAmount !== undefined) params.append('minAmount', filters.minAmount.toString());
    if (filters.maxAmount !== undefined) params.append('maxAmount', filters.maxAmount.toString());
    if (filters.pending !== undefined) params.append('pending', filters.pending.toString());
    if (filters.limit !== undefined) params.append('limit', filters.limit.toString());
    if (filters.offset !== undefined) params.append('offset', filters.offset.toString());
  }
  const query = params.toString();
  return apiClient.get(`/finance/transactions${query ? `?${query}` : ''}`);
};

export const getRecentTransactions = (limit = 5): Promise<RecentTransaction[]> =>
  apiClient.get(`/finance/transactions/recent?limit=${limit}`);

export const getTransaction = (id: string): Promise<Transaction> =>
  apiClient.get(`/finance/transactions/${id}`);

export const updateTransaction = (
  id: string,
  data: { userCategory?: string; userNote?: string; isExcluded?: boolean }
): Promise<Transaction> => apiClient.patch(`/finance/transactions/${id}`, data);

// ============================================
// Plaid Link
// ============================================

export interface LinkTokenResponse {
  linkToken: string;
  expiration: string;
}

export const createLinkToken = (): Promise<LinkTokenResponse> =>
  apiClient.post('/finance/link-token');

export const exchangePublicToken = (
  publicToken: string
): Promise<{ itemId: string; accounts: Array<{ id: string; name: string; type: string }> }> =>
  apiClient.post('/finance/exchange-token', { publicToken });

// ============================================
// Sync
// ============================================

export const syncAllAccounts = (): Promise<SyncResult> =>
  apiClient.post('/finance/sync');

// ============================================
// Manual Upload
// ============================================

export interface UploadResult {
  imported: number;
  skipped: number;
  accountId: string;
  accountName: string;
}

export const uploadTransactions = async (
  file: File,
  accountName?: string
): Promise<UploadResult> => {
  const formData = new FormData();
  formData.append('file', file);
  if (accountName) {
    formData.append('accountName', accountName);
  }

  const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/finance/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to upload transactions');
  }

  const result = await response.json();
  return result.data;
};

export interface ManualAccount {
  id: string;
  name: string;
  transactionCount: number;
}

export const getManualAccounts = (): Promise<ManualAccount[]> =>
  apiClient.get('/finance/manual-accounts');

// ============================================
// Analytics
// ============================================

export interface SpendingTrendPoint {
  date: string;
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
    period: string;
    budgetCents: number;
    actualCents: number;
    varianceCents: number;
    variancePercent: number;
    status: 'under' | 'over' | 'on_target';
  }>;
  overallAccuracy: number;
  averageVariancePercent: number;
}

export interface IncomeExpenseComparison {
  period: string;
  incomeCents: number;
  expensesCents: number;
  savingsCents: number;
  savingsRate: number;
}

export interface AnalyticsDashboard {
  trends: SpendingTrends;
  topMerchants: MerchantAnalysis[];
  categoryTrends: CategoryTrend[];
  budgetAccuracy: BudgetAccuracy[];
  incomeExpenses: IncomeExpenseComparison[];
}

export const getSpendingTrends = (
  period: 'daily' | 'weekly' | 'monthly' = 'daily',
  days = 90
): Promise<SpendingTrends> =>
  apiClient.get(`/finance/analytics/trends?period=${period}&days=${days}`);

export const getTopMerchants = (limit = 20, days = 90): Promise<MerchantAnalysis[]> =>
  apiClient.get(`/finance/analytics/merchants?limit=${limit}&days=${days}`);

export const getCategoryTrends = (months = 6): Promise<CategoryTrend[]> =>
  apiClient.get(`/finance/analytics/categories?months=${months}`);

export const getBudgetAccuracy = (months = 6): Promise<BudgetAccuracy[]> =>
  apiClient.get(`/finance/analytics/accuracy?months=${months}`);

export const getIncomeExpenses = (months = 12): Promise<IncomeExpenseComparison[]> =>
  apiClient.get(`/finance/analytics/income-expenses?months=${months}`);

export const getAnalyticsDashboard = (): Promise<AnalyticsDashboard> =>
  apiClient.get('/finance/analytics/dashboard');

// ============================================
// Preferences
// ============================================

export interface BudgetPreferences {
  id: string;
  dailyEmailEnabled: boolean;
  dailySmsEnabled: boolean;
  dailyTime: string;
  weeklyEmailEnabled: boolean;
  weeklySmsEnabled: boolean;
  weeklyDay: number;
  weeklyTime: string;
  alertsEnabled: boolean;
  largeTransactionThresholdCents: number;
  unusualSpendingMultiplier: number;
  createdAt: string;
  updatedAt: string;
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

export const getBudgetPreferences = (): Promise<BudgetPreferences> =>
  apiClient.get('/finance/reports/preferences');

export const updateBudgetPreferences = (data: UpdatePreferencesInput): Promise<BudgetPreferences> =>
  apiClient.patch('/finance/reports/preferences', data);

// ============================================
// Report History
// ============================================

export interface ReportHistoryItem {
  id: string;
  reportType: string;
  reportDate: string;
  emailSentAt: string | null;
  smsSentAt: string | null;
  createdAt: string;
}

export const getReportHistory = (limit = 20, type?: 'daily' | 'weekly'): Promise<ReportHistoryItem[]> => {
  const params = new URLSearchParams();
  params.append('limit', limit.toString());
  if (type) params.append('type', type);
  return apiClient.get(`/finance/reports/history?${params.toString()}`);
};

// ============================================
// Alerts History
// ============================================

export interface AlertHistoryItem {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: string;
  createdAt: string;
}

export const getAlertHistory = (limit = 20): Promise<AlertHistoryItem[]> =>
  apiClient.get(`/finance/reports/alerts?limit=${limit}`);

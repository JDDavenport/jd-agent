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

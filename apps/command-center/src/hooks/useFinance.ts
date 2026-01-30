/**
 * useFinance Hooks
 *
 * React Query hooks for the Budget & Finance module.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getFinanceStatus,
  getFinanceOverview,
  getFinanceWidget,
  getSpendingByCategory,
  getBudgets,
  createBudget,
  updateBudget,
  deleteBudget,
  getAccounts,
  getTransactions,
  getRecentTransactions,
  syncAllAccounts,
  syncAccount,
  type TransactionFilters,
} from '../api/finance';
import type {
  FinanceStatus,
  FinanceOverview,
  FinanceWidgetData,
  SpendingByCategory,
  BudgetStatus,
  Budget,
  PlaidAccount,
  Transaction,
  RecentTransaction,
  SyncResult,
} from '../types/finance';

// ============================================
// Status Hook
// ============================================

export function useFinanceStatus() {
  return useQuery<FinanceStatus>({
    queryKey: ['finance', 'status'],
    queryFn: getFinanceStatus,
    staleTime: 5 * 60 * 1000, // Consider data stale after 5 minutes
  });
}

// ============================================
// Overview & Widget Hooks
// ============================================

export function useFinanceOverview() {
  return useQuery<FinanceOverview>({
    queryKey: ['finance', 'overview'],
    queryFn: getFinanceOverview,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });
}

export function useFinanceWidget() {
  return useQuery<FinanceWidgetData>({
    queryKey: ['finance', 'widget'],
    queryFn: getFinanceWidget,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });
}

export function useSpendingByCategory(startDate?: string, endDate?: string) {
  return useQuery<SpendingByCategory[]>({
    queryKey: ['finance', 'spending', startDate, endDate],
    queryFn: () => getSpendingByCategory(startDate, endDate),
    refetchInterval: 5 * 60 * 1000,
  });
}

// ============================================
// Budget Hooks
// ============================================

export function useBudgets(includeInactive = false, month?: string) {
  return useQuery<BudgetStatus[]>({
    queryKey: ['finance', 'budgets', includeInactive, month],
    queryFn: () => getBudgets(includeInactive, month),
    refetchInterval: 2 * 60 * 1000,
  });
}

export function useCreateBudget() {
  const queryClient = useQueryClient();
  return useMutation<Budget, Error, Parameters<typeof createBudget>[0]>({
    mutationFn: createBudget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'budgets'] });
    },
  });
}

export function useUpdateBudget() {
  const queryClient = useQueryClient();
  return useMutation<Budget, Error, { id: string; data: Parameters<typeof updateBudget>[1] }>({
    mutationFn: ({ id, data }) => updateBudget(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'budgets'] });
    },
  });
}

export function useDeleteBudget() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteBudget,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'budgets'] });
    },
  });
}

// ============================================
// Account Hooks
// ============================================

export function useAccounts() {
  return useQuery<PlaidAccount[]>({
    queryKey: ['finance', 'accounts'],
    queryFn: getAccounts,
    staleTime: 60 * 1000,
  });
}

// ============================================
// Transaction Hooks
// ============================================

export function useTransactions(filters?: TransactionFilters) {
  return useQuery<Transaction[]>({
    queryKey: ['finance', 'transactions', filters],
    queryFn: () => getTransactions(filters),
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useRecentTransactions(limit = 5) {
  return useQuery<RecentTransaction[]>({
    queryKey: ['finance', 'transactions', 'recent', limit],
    queryFn: () => getRecentTransactions(limit),
    refetchInterval: 5 * 60 * 1000,
  });
}

// ============================================
// Sync Mutations
// ============================================

export function useSyncAllAccounts() {
  const queryClient = useQueryClient();

  return useMutation<SyncResult>({
    mutationFn: syncAllAccounts,
    onSuccess: () => {
      // Invalidate all finance queries after sync
      queryClient.invalidateQueries({ queryKey: ['finance'] });
    },
  });
}

export function useSyncAccount() {
  const queryClient = useQueryClient();

  return useMutation<SyncResult, Error, string>({
    mutationFn: syncAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance'] });
    },
  });
}

// ============================================
// Upload Hook
// ============================================

import { uploadTransactions, getManualAccounts, type UploadResult, type ManualAccount } from '../api/finance';

export function useUploadTransactions() {
  const queryClient = useQueryClient();

  return useMutation<UploadResult, Error, { file: File; accountName?: string }>({
    mutationFn: ({ file, accountName }) => uploadTransactions(file, accountName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance'] });
    },
  });
}

export function useManualAccounts() {
  return useQuery<ManualAccount[]>({
    queryKey: ['finance', 'manual-accounts'],
    queryFn: getManualAccounts,
    staleTime: 60 * 1000,
  });
}

// ============================================
// Analytics Hooks
// ============================================

import {
  getSpendingTrends,
  getTopMerchants,
  getCategoryTrends,
  getBudgetAccuracy,
  getIncomeExpenses,
  getAnalyticsDashboard,
  type SpendingTrends,
  type MerchantAnalysis,
  type CategoryTrend,
  type BudgetAccuracy,
  type IncomeExpenseComparison,
  type AnalyticsDashboard,
} from '../api/finance';

export function useSpendingTrends(
  period: 'daily' | 'weekly' | 'monthly' = 'daily',
  days = 90
) {
  return useQuery<SpendingTrends>({
    queryKey: ['finance', 'analytics', 'trends', period, days],
    queryFn: () => getSpendingTrends(period, days),
    staleTime: 5 * 60 * 1000,
  });
}

export function useTopMerchants(limit = 20, days = 90) {
  return useQuery<MerchantAnalysis[]>({
    queryKey: ['finance', 'analytics', 'merchants', limit, days],
    queryFn: () => getTopMerchants(limit, days),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCategoryTrends(months = 6) {
  return useQuery<CategoryTrend[]>({
    queryKey: ['finance', 'analytics', 'categories', months],
    queryFn: () => getCategoryTrends(months),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBudgetAccuracy(months = 6) {
  return useQuery<BudgetAccuracy[]>({
    queryKey: ['finance', 'analytics', 'accuracy', months],
    queryFn: () => getBudgetAccuracy(months),
    staleTime: 5 * 60 * 1000,
  });
}

export function useIncomeExpenses(months = 12) {
  return useQuery<IncomeExpenseComparison[]>({
    queryKey: ['finance', 'analytics', 'income-expenses', months],
    queryFn: () => getIncomeExpenses(months),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAnalyticsDashboard() {
  return useQuery<AnalyticsDashboard>({
    queryKey: ['finance', 'analytics', 'dashboard'],
    queryFn: getAnalyticsDashboard,
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================
// Preferences Hooks
// ============================================

import {
  getBudgetPreferences,
  updateBudgetPreferences,
  getReportHistory,
  getAlertHistory,
  type BudgetPreferences,
  type UpdatePreferencesInput,
  type ReportHistoryItem,
  type AlertHistoryItem,
} from '../api/finance';

export function useBudgetPreferences() {
  return useQuery<BudgetPreferences>({
    queryKey: ['finance', 'preferences'],
    queryFn: getBudgetPreferences,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateBudgetPreferences() {
  const queryClient = useQueryClient();

  return useMutation<BudgetPreferences, Error, UpdatePreferencesInput>({
    mutationFn: updateBudgetPreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance', 'preferences'] });
    },
  });
}

export function useReportHistory(limit = 20, type?: 'daily' | 'weekly') {
  return useQuery<ReportHistoryItem[]>({
    queryKey: ['finance', 'reports', 'history', limit, type],
    queryFn: () => getReportHistory(limit, type),
    staleTime: 60 * 1000,
  });
}

export function useAlertHistory(limit = 20) {
  return useQuery<AlertHistoryItem[]>({
    queryKey: ['finance', 'alerts', 'history', limit],
    queryFn: () => getAlertHistory(limit),
    staleTime: 60 * 1000,
  });
}

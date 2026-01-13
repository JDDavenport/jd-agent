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

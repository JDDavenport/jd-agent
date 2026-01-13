/**
 * useDashboardEnhanced Hook
 *
 * React Query hook for fetching enhanced dashboard data.
 * Provides all metric card data in a single optimized request.
 *
 * IMPORTANT: Uses cascading loading to prevent overwhelming the server.
 * Requests are staggered based on priority to avoid memory exhaustion.
 */

import { useQuery } from '@tanstack/react-query';
import { getEnhancedDashboard } from '../api/dashboard';
import type { EnhancedDashboardData } from '../types/dashboard';

// Primary query - loads first
export function useDashboardEnhanced() {
  return useQuery<EnhancedDashboardData>({
    queryKey: ['dashboard', 'enhanced'],
    queryFn: getEnhancedDashboard,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    staleTime: 2 * 60 * 1000, // Consider data stale after 2 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
}

/**
 * Individual widget hooks for granular updates
 */

import {
  getTasksMetric,
  getEventsMetric,
  getGoalsMetric,
  getHabitsMetric,
  getVaultMetric,
  getWellnessMetric,
} from '../api/dashboard';
import type {
  TasksMetric,
  EventsMetric,
  GoalsMetric,
  HabitsMetric,
  VaultMetric,
  WellnessMetric,
} from '../types/dashboard';

export function useTasksMetric() {
  return useQuery<TasksMetric>({
    queryKey: ['dashboard', 'tasks'],
    queryFn: getTasksMetric,
    refetchInterval: 60 * 1000, // Refresh every minute for tasks
  });
}

export function useEventsMetric() {
  return useQuery<EventsMetric>({
    queryKey: ['dashboard', 'events'],
    queryFn: getEventsMetric,
    refetchInterval: 60 * 1000, // Refresh every minute for events
  });
}

export function useGoalsMetric() {
  return useQuery<GoalsMetric>({
    queryKey: ['dashboard', 'goals'],
    queryFn: getGoalsMetric,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });
}

export function useHabitsMetric() {
  return useQuery<HabitsMetric>({
    queryKey: ['dashboard', 'habits'],
    queryFn: getHabitsMetric,
    refetchInterval: 60 * 1000, // Refresh every minute for habits
  });
}

export function useVaultMetric() {
  return useQuery<VaultMetric>({
    queryKey: ['dashboard', 'vault'],
    queryFn: getVaultMetric,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });
}

export function useWellnessMetric() {
  return useQuery<WellnessMetric>({
    queryKey: ['dashboard', 'wellness'],
    queryFn: getWellnessMetric,
    refetchInterval: 10 * 60 * 1000, // Refresh every 10 minutes
  });
}

// ============================================
// Phase 2 - Grouped Views (load after enhanced)
// ============================================

import {
  getGroupedTodayTasks,
  getGroupedDeadlines,
  getWeekOverview,
} from '../api/dashboard';
import type {
  GroupedTodayTasks,
  GroupedDeadlines,
  WeekOverview,
} from '../types/dashboard';

export function useGroupedTodayTasks(enabled: boolean = true) {
  return useQuery<GroupedTodayTasks>({
    queryKey: ['dashboard', 'tasks', 'grouped'],
    queryFn: getGroupedTodayTasks,
    enabled,
    refetchInterval: 2 * 60 * 1000, // Refresh every 2 minutes
    staleTime: 60 * 1000,
    retry: 5, // More retries for recovery
    retryDelay: 3000, // Fixed 3 second delay to let server recover
  });
}

export function useGroupedDeadlines(enabled: boolean = true) {
  return useQuery<GroupedDeadlines>({
    queryKey: ['dashboard', 'deadlines', 'grouped'],
    queryFn: getGroupedDeadlines,
    enabled,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    staleTime: 2 * 60 * 1000,
    retry: 5,
    retryDelay: 3000,
  });
}

export function useWeekOverview(enabled: boolean = true) {
  return useQuery<WeekOverview>({
    queryKey: ['dashboard', 'week-overview'],
    queryFn: getWeekOverview,
    enabled,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    staleTime: 2 * 60 * 1000,
    retry: 5,
    retryDelay: 3000,
  });
}

// ============================================
// Phase 3 - New Dashboard Sections (load last)
// ============================================

import {
  getCanvasHub,
  getFitness,
  getSystemMonitor,
  getAIInsights,
  dismissInsight,
} from '../api/dashboard';
import type {
  CanvasHubData,
  FitnessData,
  SystemMonitorData,
  AIInsightsData,
} from '../types/dashboard';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useCanvasHub(enabled: boolean = true) {
  return useQuery<CanvasHubData>({
    queryKey: ['dashboard', 'canvas'],
    queryFn: getCanvasHub,
    enabled,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    staleTime: 3 * 60 * 1000,
    retry: 5,
    retryDelay: 3000,
  });
}

export function useFitness(enabled: boolean = true) {
  return useQuery<FitnessData>({
    queryKey: ['dashboard', 'fitness'],
    queryFn: getFitness,
    enabled,
    refetchInterval: 10 * 60 * 1000, // Refresh every 10 minutes
    staleTime: 5 * 60 * 1000,
    retry: 5,
    retryDelay: 3000,
  });
}

export function useSystemMonitor(enabled: boolean = true) {
  return useQuery<SystemMonitorData>({
    queryKey: ['dashboard', 'system'],
    queryFn: getSystemMonitor,
    enabled,
    refetchInterval: 2 * 60 * 1000, // Refresh every 2 minutes
    staleTime: 60 * 1000,
    retry: 5,
    retryDelay: 3000,
  });
}

export function useAIInsights(enabled: boolean = true) {
  return useQuery<AIInsightsData>({
    queryKey: ['dashboard', 'insights'],
    queryFn: getAIInsights,
    enabled,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    staleTime: 3 * 60 * 1000,
    retry: 5,
    retryDelay: 3000,
  });
}

export function useDismissInsight() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: dismissInsight,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'insights'] });
    },
  });
}

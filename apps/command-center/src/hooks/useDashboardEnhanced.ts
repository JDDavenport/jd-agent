/**
 * useDashboardEnhanced Hook
 *
 * React Query hook for fetching enhanced dashboard data.
 * Provides all metric card data in a single optimized request.
 */

import { useQuery } from '@tanstack/react-query';
import { getEnhancedDashboard } from '../api/dashboard';
import type { EnhancedDashboardData } from '../types/dashboard';

export function useDashboardEnhanced() {
  return useQuery<EnhancedDashboardData>({
    queryKey: ['dashboard', 'enhanced'],
    queryFn: getEnhancedDashboard,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    staleTime: 60 * 1000, // Consider data stale after 1 minute
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
// Phase 2 - Grouped Views
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

export function useGroupedTodayTasks() {
  return useQuery<GroupedTodayTasks>({
    queryKey: ['dashboard', 'tasks', 'grouped'],
    queryFn: getGroupedTodayTasks,
    refetchInterval: 60 * 1000, // Refresh every minute
  });
}

export function useGroupedDeadlines() {
  return useQuery<GroupedDeadlines>({
    queryKey: ['dashboard', 'deadlines', 'grouped'],
    queryFn: getGroupedDeadlines,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });
}

export function useWeekOverview() {
  return useQuery<WeekOverview>({
    queryKey: ['dashboard', 'week-overview'],
    queryFn: getWeekOverview,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });
}

// ============================================
// Phase 3 - New Dashboard Sections
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

export function useCanvasHub() {
  return useQuery<CanvasHubData>({
    queryKey: ['dashboard', 'canvas'],
    queryFn: getCanvasHub,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });
}

export function useFitness() {
  return useQuery<FitnessData>({
    queryKey: ['dashboard', 'fitness'],
    queryFn: getFitness,
    refetchInterval: 10 * 60 * 1000, // Refresh every 10 minutes
  });
}

export function useSystemMonitor() {
  return useQuery<SystemMonitorData>({
    queryKey: ['dashboard', 'system'],
    queryFn: getSystemMonitor,
    refetchInterval: 60 * 1000, // Refresh every minute
  });
}

export function useAIInsights() {
  return useQuery<AIInsightsData>({
    queryKey: ['dashboard', 'insights'],
    queryFn: getAIInsights,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
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

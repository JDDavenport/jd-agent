/**
 * Dashboard API
 *
 * API client functions for the enhanced Command Center dashboard.
 */

import apiClient from './client';
import type {
  EnhancedDashboardData,
  TasksMetric,
  EventsMetric,
  GoalsMetric,
  HabitsMetric,
  VaultMetric,
  WellnessMetric,
} from '../types/dashboard';

/**
 * Get enhanced dashboard data for all metric cards
 */
export const getEnhancedDashboard = async (): Promise<EnhancedDashboardData> => {
  return apiClient.get('/dashboard/enhanced');
};

/**
 * Get specific widget data
 */
export const getWidget = async <T>(
  widgetType: 'tasks' | 'events' | 'goals' | 'habits' | 'vault' | 'wellness'
): Promise<T> => {
  return apiClient.get(`/dashboard/widget/${widgetType}`);
};

/**
 * Get tasks metric
 */
export const getTasksMetric = async (): Promise<TasksMetric> => {
  return apiClient.get('/dashboard/tasks');
};

/**
 * Get events metric
 */
export const getEventsMetric = async (): Promise<EventsMetric> => {
  return apiClient.get('/dashboard/events');
};

/**
 * Get goals metric
 */
export const getGoalsMetric = async (): Promise<GoalsMetric> => {
  return apiClient.get('/dashboard/goals');
};

/**
 * Get habits metric
 */
export const getHabitsMetric = async (): Promise<HabitsMetric> => {
  return apiClient.get('/dashboard/habits');
};

/**
 * Get vault metric
 */
export const getVaultMetric = async (): Promise<VaultMetric> => {
  return apiClient.get('/dashboard/vault');
};

/**
 * Get wellness metric
 */
export const getWellnessMetric = async (): Promise<WellnessMetric> => {
  return apiClient.get('/dashboard/wellness');
};

// ============================================
// Phase 2 - Grouped Views
// ============================================

import type {
  GroupedTodayTasks,
  GroupedDeadlines,
  WeekOverview,
} from '../types/dashboard';

/**
 * Get today's tasks grouped by priority
 */
export const getGroupedTodayTasks = async (): Promise<GroupedTodayTasks> => {
  return apiClient.get('/dashboard/tasks/grouped');
};

/**
 * Get deadlines grouped by urgency
 */
export const getGroupedDeadlines = async (): Promise<GroupedDeadlines> => {
  return apiClient.get('/dashboard/deadlines/grouped');
};

/**
 * Get week overview with events and workload
 */
export const getWeekOverview = async (): Promise<WeekOverview> => {
  return apiClient.get('/dashboard/week-overview');
};

// ============================================
// Phase 3 - New Dashboard Sections
// ============================================

import type {
  CanvasHubData,
  FitnessData,
  SystemMonitorData,
  AIInsightsData,
} from '../types/dashboard';

/**
 * Get Canvas Hub data (classes, assignments)
 */
export const getCanvasHub = async (): Promise<CanvasHubData> => {
  return apiClient.get('/dashboard/canvas');
};

/**
 * Get Fitness Dashboard data (Whoop)
 */
export const getFitness = async (): Promise<FitnessData> => {
  return apiClient.get('/dashboard/fitness');
};

/**
 * Get System Monitor data (integration health)
 */
export const getSystemMonitor = async (): Promise<SystemMonitorData> => {
  return apiClient.get('/dashboard/system');
};

/**
 * Get AI Insights list
 */
export const getAIInsights = async (): Promise<AIInsightsData> => {
  return apiClient.get('/dashboard/insights');
};

/**
 * Dismiss an AI insight
 */
export const dismissInsight = async (insightId: string): Promise<void> => {
  return apiClient.post(`/dashboard/insights/${insightId}/dismiss`);
};

/**
 * Generate new AI insights
 */
export const generateInsights = async (): Promise<{ generated: number }> => {
  return apiClient.post('/dashboard/insights/generate');
};

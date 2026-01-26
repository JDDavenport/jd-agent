/**
 * Homework Hub Hooks
 *
 * Canvas Complete Phase 4: Centralized homework dashboard
 * - Due today, due this week, upcoming assignments
 * - Readings with progress tracking
 * - Urgency indicators
 */

import { useQuery } from '@tanstack/react-query';

// ============================================
// Types
// ============================================

export interface HomeworkItem {
  id: string;
  title: string;
  courseName: string;
  courseCode: string | null;
  dueAt: string | null;
  pointsPossible: number | null;
  estimatedMinutes: number | null;
  taskId: string | null;
  hasRubric: boolean;
  hasInstructions: boolean;
  url: string | null;
  subtaskCount: number;
  subtasksCompleted: number;
  progressPercent: number;
  urgencyLevel: 'critical' | 'high' | 'medium' | 'low';
  hoursUntilDue: number | null;
  status: 'not_started' | 'in_progress' | 'ready_to_submit' | 'completed';
}

export interface ReadingItem {
  id: string;
  fileName: string;
  displayName: string | null;
  courseName: string;
  courseCode: string | null;
  fileType: string;
  materialType: string | null;
  readStatus: string;
  readProgress: number;
  relatedAssignmentTitle: string | null;
  relatedAssignmentDueAt: string | null;
}

export interface HomeworkHubData {
  dueToday: HomeworkItem[];
  dueThisWeek: HomeworkItem[];
  upcoming: HomeworkItem[];
  readingsDue: ReadingItem[];
  summary: HomeworkSummary;
}

export interface HomeworkSummary {
  dueTodayCount: number;
  dueThisWeekCount: number;
  upcomingCount: number;
  unreadReadingsCount: number;
  totalEstimatedMinutesToday: number;
  totalEstimatedMinutesWeek: number;
  criticalCount: number;
}

// ============================================
// API Functions
// ============================================

async function fetchHomeworkHub(): Promise<HomeworkHubData> {
  const response = await fetch('/api/canvas-integrity/homework-hub');
  if (!response.ok) throw new Error('Failed to fetch homework hub data');
  const result = await response.json();
  return result.data;
}

async function fetchHomeworkSummary(): Promise<HomeworkSummary> {
  const response = await fetch('/api/canvas-integrity/homework-hub/summary');
  if (!response.ok) throw new Error('Failed to fetch homework summary');
  const result = await response.json();
  return result.data;
}

async function fetchDueToday(): Promise<HomeworkItem[]> {
  const response = await fetch('/api/canvas-integrity/homework-hub/due-today');
  if (!response.ok) throw new Error('Failed to fetch due today');
  const result = await response.json();
  return result.data;
}

async function fetchDueThisWeek(): Promise<HomeworkItem[]> {
  const response = await fetch('/api/canvas-integrity/homework-hub/due-this-week');
  if (!response.ok) throw new Error('Failed to fetch due this week');
  const result = await response.json();
  return result.data;
}

async function fetchCritical(): Promise<HomeworkItem[]> {
  const response = await fetch('/api/canvas-integrity/homework-hub/critical');
  if (!response.ok) throw new Error('Failed to fetch critical assignments');
  const result = await response.json();
  return result.data;
}

// ============================================
// Hooks
// ============================================

/**
 * Get complete homework hub data
 */
export function useHomeworkHub() {
  return useQuery({
    queryKey: ['homework-hub'],
    queryFn: fetchHomeworkHub,
    staleTime: 60000, // 1 minute
    refetchInterval: 300000, // Refresh every 5 minutes
  });
}

/**
 * Get homework summary for compact widgets
 */
export function useHomeworkSummary() {
  return useQuery({
    queryKey: ['homework-hub-summary'],
    queryFn: fetchHomeworkSummary,
    staleTime: 60000,
    refetchInterval: 300000,
  });
}

/**
 * Get assignments due today
 */
export function useDueToday() {
  return useQuery({
    queryKey: ['homework-hub-due-today'],
    queryFn: fetchDueToday,
    staleTime: 60000,
  });
}

/**
 * Get assignments due this week
 */
export function useDueThisWeek() {
  return useQuery({
    queryKey: ['homework-hub-due-this-week'],
    queryFn: fetchDueThisWeek,
    staleTime: 60000,
  });
}

/**
 * Get critical/urgent assignments
 */
export function useCriticalAssignments() {
  return useQuery({
    queryKey: ['homework-hub-critical'],
    queryFn: fetchCritical,
    staleTime: 60000,
  });
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get urgency color classes
 */
export function getUrgencyColors(level: HomeworkItem['urgencyLevel']): {
  bg: string;
  text: string;
  border: string;
} {
  switch (level) {
    case 'critical':
      return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50' };
    case 'high':
      return { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/50' };
    case 'medium':
      return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/50' };
    case 'low':
      return { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/50' };
  }
}

/**
 * Get status display info
 */
export function getStatusInfo(status: HomeworkItem['status']): {
  label: string;
  color: string;
  icon: string;
} {
  switch (status) {
    case 'completed':
      return { label: 'Completed', color: 'text-green-400', icon: '✓' };
    case 'ready_to_submit':
      return { label: 'Ready to Submit', color: 'text-blue-400', icon: '📤' };
    case 'in_progress':
      return { label: 'In Progress', color: 'text-yellow-400', icon: '⏳' };
    case 'not_started':
      return { label: 'Not Started', color: 'text-gray-400', icon: '○' };
  }
}

/**
 * Format time estimate
 */
export function formatTimeEstimate(minutes: number | null): string {
  if (!minutes) return '';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Format hours until due
 */
export function formatHoursUntilDue(hours: number | null): string {
  if (hours === null) return '';
  if (hours < 0) return 'Past due';
  if (hours < 1) return 'Due soon';
  if (hours < 24) return `${Math.round(hours)}h left`;
  const days = Math.floor(hours / 24);
  return `${days}d left`;
}

/**
 * Get progress bar color
 */
export function getProgressColor(percent: number): string {
  if (percent >= 100) return 'bg-green-500';
  if (percent >= 75) return 'bg-blue-500';
  if (percent >= 50) return 'bg-yellow-500';
  if (percent >= 25) return 'bg-orange-500';
  return 'bg-red-500';
}

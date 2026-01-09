/**
 * Dashboard Types
 *
 * TypeScript interfaces for the enhanced Command Center dashboard.
 * These types match the backend dashboard-service.ts responses.
 */

export interface TasksMetric {
  today: number;
  overdue: number;
  completed: number;
  byPriority: {
    high: number;
    medium: number;
    low: number;
  };
  completionRate: number;
}

export interface EventsMetric {
  today: number;
  nextEvent: {
    title: string;
    startsIn: number;
    startTime: string;
  } | null;
  byType: {
    meeting: number;
    class: number;
    personal: number;
    other: number;
  };
}

export interface GoalsMetric {
  active: number;
  completed: number;
  overallProgress: number;
  byArea: Record<string, number>;
  needsAttention: number;
}

export interface HabitsMetric {
  completedToday: number;
  totalDueToday: number;
  completionRate: number;
  longestStreak: {
    title: string;
    days: number;
  } | null;
  weekCalendar: boolean[];
}

export interface VaultMetric {
  totalEntries: number;
  recentCount: number;
  byType: {
    notes: number;
    recordings: number;
    documents: number;
    other: number;
  };
}

export type WellnessStatus = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown' | 'not_configured';

export interface WellnessMetric {
  recoveryScore: number | null;
  sleepHours: number | null;
  status: WellnessStatus;
  recommendation: string | null;
}

export interface EnhancedDashboardData {
  tasks: TasksMetric;
  events: EventsMetric;
  goals: GoalsMetric;
  habits: HabitsMetric;
  vault: VaultMetric;
  wellness: WellnessMetric;
  lastUpdated: string;
}

// Metric card shared props
export interface MetricCardProps {
  isLoading?: boolean;
  error?: Error | null;
}

// Click targets for metric cards
export type MetricCardTarget =
  | '/tasks'          // External app at port 5173
  | '/goals'
  | '/habits'
  | '/vault'          // External app at port 5175
  | '/personal-health'
  | '/calendar'
  | string;           // Custom target

// ============================================
// PHASE 2 TYPES - Grouped Views
// ============================================

export interface TaskWithProject {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  dueDate: string | null;
  source: string;
  context: string;
  timeEstimateMinutes: number | null;
  completedAt: string | null;
  project: {
    id: string;
    name: string;
  } | null;
}

export interface GroupedTodayTasks {
  overdue: TaskWithProject[];
  high: TaskWithProject[];
  medium: TaskWithProject[];
  low: TaskWithProject[];
  noPriority: TaskWithProject[];
  completed: TaskWithProject[];
  stats: {
    total: number;
    completed: number;
    totalMinutes: number;
    completedMinutes: number;
  };
}

export interface DeadlineTask {
  id: string;
  title: string;
  dueDate: string;
  priority: number;
  source: string;
  context: string;
  project: {
    id: string;
    name: string;
  } | null;
  daysUntil: number;
}

export interface GroupedDeadlines {
  overdue: DeadlineTask[];
  today: DeadlineTask[];
  thisWeek: DeadlineTask[];
  nextWeek: DeadlineTask[];
  later: DeadlineTask[];
  stats: {
    total: number;
    overdue: number;
    urgent: number;
  };
}

export interface WeekDayEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string | null;
  eventType: string | null;
}

export interface WeekDay {
  date: string;
  dayName: string;
  events: WeekDayEvent[];
  taskCount: number;
  workloadLevel: 'light' | 'moderate' | 'heavy';
  density: number;
}

export interface WeekOverview {
  days: WeekDay[];
  timeAllocation: {
    meetings: number;
    classes: number;
    focus: number;
    personal: number;
  };
  totalEvents: number;
  totalTasks: number;
}

// ============================================
// PHASE 3 TYPES - New Dashboard Sections
// ============================================

export interface CanvasClass {
  id: string;
  name: string;
  time: string;
  location: string | null;
  isToday: boolean;
}

export interface CanvasAssignment {
  id: string;
  title: string;
  courseName: string;
  dueDate: string;
  daysUntil: number;
  isOverdue: boolean;
  taskId: string | null;
}

export interface CanvasHubData {
  todaysClasses: CanvasClass[];
  upcomingAssignments: CanvasAssignment[];
  missingSubmissions: number;
  nextClass: {
    name: string;
    startsIn: number;
    location: string | null;
  } | null;
}

export interface FitnessData {
  workoutStreak: number;
  lastWorkout: {
    type: string;
    date: string;
    strain: number;
  } | null;
  sleepTrend: Array<{
    date: string;
    hours: number;
    quality: number;
  }>;
  recoveryTrend: Array<{
    date: string;
    score: number;
  }>;
  todayRecovery: number | null;
  averageSleep: number;
}

export interface IntegrationHealth {
  name: string;
  displayName: string;
  status: 'healthy' | 'degraded' | 'down' | 'not_configured';
  lastSyncAt: string | null;
  latencyMs: number | null;
  errorMessage: string | null;
}

export interface SystemMonitorData {
  integrations: IntegrationHealth[];
  overallStatus: 'healthy' | 'degraded' | 'down';
  healthyCount: number;
  totalCount: number;
  lastUpdated: string;
}

export interface AIInsight {
  id: string;
  type: 'pattern' | 'warning' | 'suggestion' | 'alert';
  category: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  actionable: boolean;
  actionLabel: string | null;
  actionTarget: string | null;
  createdAt: string;
}

export interface AIInsightsData {
  insights: AIInsight[];
  totalCount: number;
  criticalCount: number;
  warningCount: number;
}

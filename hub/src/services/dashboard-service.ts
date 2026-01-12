/**
 * Dashboard Service
 *
 * Unified aggregation service for the Command Center dashboard.
 * Combines data from analytics, progress, calendar, and health services
 * into a single optimized response for the enhanced metric cards.
 */

import { eq, and, gte, lte, lt, sql, desc, asc, or, isNull } from 'drizzle-orm';
import { db } from '../db/client';
import { tasks, calendarEvents, vaultEntries, goals, habits, habitCompletions, projects, canvasItems, classProjectMapping, aiInsights, systemHealthLogs } from '../db/schema';
import { progressService } from './progress-service';
import { getWhoopIntegration } from '../integrations/whoop';

// ============================================
// TYPES
// ============================================

export interface TasksMetric {
  today: number;
  overdue: number;
  completed: number;
  byPriority: {
    high: number;    // priority 3-4
    medium: number;  // priority 2
    low: number;     // priority 0-1
  };
  completionRate: number; // percentage of today's tasks completed
}

export interface EventsMetric {
  today: number;
  nextEvent: {
    title: string;
    startsIn: number; // minutes until event
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
  overallProgress: number; // average progress percentage
  byArea: Record<string, number>; // count by life area
  needsAttention: number; // goals behind schedule
}

export interface HabitsMetric {
  completedToday: number;
  totalDueToday: number;
  completionRate: number;
  longestStreak: {
    title: string;
    days: number;
  } | null;
  weekCalendar: boolean[]; // 7 days, true = all habits completed that day
}

export interface VaultMetric {
  totalEntries: number;
  recentCount: number; // last 24 hours
  byType: {
    notes: number;
    recordings: number;
    documents: number;
    other: number;
  };
}

export interface WellnessMetric {
  recoveryScore: number | null;
  sleepHours: number | null;
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown' | 'not_configured';
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

// ============================================
// PHASE 2 TYPES - Grouped Views
// ============================================

export interface TaskWithProject {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  dueDate: Date | null;
  source: string;
  context: string;
  timeEstimateMinutes: number | null;
  completedAt: Date | null;
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
  dueDate: Date;
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

export interface WeekDay {
  date: string;
  dayName: string;
  events: Array<{
    id: string;
    title: string;
    startTime: string;
    endTime: string | null;
    eventType: string | null;
  }>;
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
    startsIn: number; // minutes
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

// ============================================
// SERVICE
// ============================================

class DashboardService {
  /**
   * Get enhanced dashboard data for all metric cards
   */
  async getEnhanced(): Promise<EnhancedDashboardData> {
    const [tasksMetric, eventsMetric, goalsMetric, habitsMetric, vaultMetric, wellnessMetric] =
      await Promise.all([
        this.getTasksMetric(),
        this.getEventsMetric(),
        this.getGoalsMetric(),
        this.getHabitsMetric(),
        this.getVaultMetric(),
        this.getWellnessMetric(),
      ]);

    return {
      tasks: tasksMetric,
      events: eventsMetric,
      goals: goalsMetric,
      habits: habitsMetric,
      vault: vaultMetric,
      wellness: wellnessMetric,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Get tasks metric for dashboard card
   */
  async getTasksMetric(): Promise<TasksMetric> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // Get all task counts in parallel
    const [todayResult, overdueResult, completedResult, priorityResult] = await Promise.all([
      // Today's tasks (status = 'today' or due today)
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .where(
          and(
            sql`${tasks.status} not in ('done', 'archived')`,
            sql`(${tasks.status} = 'today' OR (${tasks.dueDate} >= ${todayStart} AND ${tasks.dueDate} < ${todayEnd}))`
          )
        ),
      // Overdue tasks
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .where(
          and(
            sql`${tasks.status} not in ('done', 'archived')`,
            lte(tasks.dueDate, todayStart)
          )
        ),
      // Completed today
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .where(
          and(
            eq(tasks.status, 'done'),
            gte(tasks.completedAt, todayStart),
            lte(tasks.completedAt, todayEnd)
          )
        ),
      // By priority (for active tasks)
      db
        .select({
          priority: tasks.priority,
          count: sql<number>`count(*)::int`,
        })
        .from(tasks)
        .where(sql`${tasks.status} not in ('done', 'archived')`)
        .groupBy(tasks.priority),
    ]);

    const today = todayResult[0]?.count || 0;
    const overdue = overdueResult[0]?.count || 0;
    const completed = completedResult[0]?.count || 0;

    // Calculate priority breakdown
    const byPriority = { high: 0, medium: 0, low: 0 };
    for (const row of priorityResult) {
      if (row.priority >= 3) {
        byPriority.high += row.count;
      } else if (row.priority === 2) {
        byPriority.medium += row.count;
      } else {
        byPriority.low += row.count;
      }
    }

    const totalTodayTasks = today + completed;
    const completionRate = totalTodayTasks > 0
      ? Math.round((completed / totalTodayTasks) * 100)
      : 0;

    return {
      today,
      overdue,
      completed,
      byPriority,
      completionRate,
    };
  }

  /**
   * Get events metric for dashboard card
   */
  async getEventsMetric(): Promise<EventsMetric> {
    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // Get today's events and next event in parallel
    const [todayEventsResult, typeResult, nextEventResult] = await Promise.all([
      // Total today
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(calendarEvents)
        .where(
          and(
            gte(calendarEvents.startTime, todayStart),
            lte(calendarEvents.startTime, todayEnd)
          )
        ),
      // By type
      db
        .select({
          eventType: calendarEvents.eventType,
          count: sql<number>`count(*)::int`,
        })
        .from(calendarEvents)
        .where(
          and(
            gte(calendarEvents.startTime, todayStart),
            lte(calendarEvents.startTime, todayEnd)
          )
        )
        .groupBy(calendarEvents.eventType),
      // Next upcoming event
      db
        .select({
          title: calendarEvents.title,
          startTime: calendarEvents.startTime,
        })
        .from(calendarEvents)
        .where(gte(calendarEvents.startTime, now))
        .orderBy(asc(calendarEvents.startTime))
        .limit(1),
    ]);

    const today = todayEventsResult[0]?.count || 0;

    // Calculate by type
    const byType = { meeting: 0, class: 0, personal: 0, other: 0 };
    for (const row of typeResult) {
      const type = row.eventType?.toLowerCase() || 'other';
      if (type === 'meeting') byType.meeting += row.count;
      else if (type === 'class') byType.class += row.count;
      else if (type === 'personal') byType.personal += row.count;
      else byType.other += row.count;
    }

    // Next event
    let nextEvent: EventsMetric['nextEvent'] = null;
    if (nextEventResult[0]) {
      const event = nextEventResult[0];
      const startTime = new Date(event.startTime);
      const startsIn = Math.round((startTime.getTime() - now.getTime()) / (1000 * 60));
      nextEvent = {
        title: event.title,
        startsIn,
        startTime: startTime.toISOString(),
      };
    }

    return {
      today,
      nextEvent,
      byType,
    };
  }

  /**
   * Get goals metric for dashboard card
   */
  async getGoalsMetric(): Promise<GoalsMetric> {
    // Get goal stats
    const [statusResult, areaResult, needsAttentionResult] = await Promise.all([
      // By status
      db
        .select({
          status: goals.status,
          count: sql<number>`count(*)::int`,
          avgProgress: sql<number>`coalesce(avg(${goals.progressPercentage}), 0)::real`,
        })
        .from(goals)
        .groupBy(goals.status),
      // By life area (active only)
      db
        .select({
          lifeArea: goals.lifeArea,
          count: sql<number>`count(*)::int`,
        })
        .from(goals)
        .where(eq(goals.status, 'active'))
        .groupBy(goals.lifeArea),
      // Needs attention (active goals that are behind or stalled)
      progressService.getGoalsNeedingAttention(),
    ]);

    let active = 0;
    let completed = 0;
    let totalProgress = 0;
    let activeCount = 0;

    for (const row of statusResult) {
      if (row.status === 'active') {
        active = row.count;
        totalProgress = row.avgProgress;
        activeCount = row.count;
      } else if (row.status === 'completed') {
        completed = row.count;
      }
    }

    const byArea: Record<string, number> = {};
    for (const row of areaResult) {
      if (row.lifeArea) {
        byArea[row.lifeArea] = row.count;
      }
    }

    return {
      active,
      completed,
      overallProgress: Math.round(totalProgress),
      byArea,
      needsAttention: needsAttentionResult.length,
    };
  }

  /**
   * Get habits metric for dashboard card
   */
  async getHabitsMetric(): Promise<HabitsMetric> {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Get today's habits progress and top streak
    const [todaysProgress, topStreak, weekCalendar] = await Promise.all([
      progressService.getTodaysHabitsProgress(),
      this.getTopHabitStreak(),
      this.getWeekCompletionCalendar(),
    ]);

    return {
      completedToday: todaysProgress.completed,
      totalDueToday: todaysProgress.total,
      completionRate: todaysProgress.percentage,
      longestStreak: topStreak,
      weekCalendar,
    };
  }

  /**
   * Get the habit with the longest current streak
   */
  private async getTopHabitStreak(): Promise<{ title: string; days: number } | null> {
    const result = await db
      .select({
        title: habits.title,
        currentStreak: habits.currentStreak,
      })
      .from(habits)
      .where(eq(habits.isActive, true))
      .orderBy(desc(habits.currentStreak))
      .limit(1);

    const streak = result[0]?.currentStreak;
    if (result[0] && streak !== null && streak > 0) {
      return {
        title: result[0].title,
        days: streak,
      };
    }
    return null;
  }

  /**
   * Get a 7-day calendar showing habit completion status
   * Returns array of 7 booleans (oldest to newest)
   */
  private async getWeekCompletionCalendar(): Promise<boolean[]> {
    const calendar: boolean[] = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // Check if any habits were completed on this day
      const result = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(habitCompletions)
        .where(
          and(
            eq(habitCompletions.date, dateStr),
            eq(habitCompletions.skipped, false)
          )
        );

      calendar.push((result[0]?.count || 0) > 0);
    }

    return calendar;
  }

  /**
   * Get vault metric for dashboard card
   */
  async getVaultMetric(): Promise<VaultMetric> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const [totalResult, recentResult, typeResult] = await Promise.all([
      // Total entries
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(vaultEntries),
      // Recent (last 24 hours)
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(vaultEntries)
        .where(gte(vaultEntries.createdAt, yesterday)),
      // By type
      db
        .select({
          contentType: vaultEntries.contentType,
          count: sql<number>`count(*)::int`,
        })
        .from(vaultEntries)
        .groupBy(vaultEntries.contentType),
    ]);

    const byType = { notes: 0, recordings: 0, documents: 0, other: 0 };
    for (const row of typeResult) {
      const type = row.contentType?.toLowerCase() || 'other';
      if (type === 'note' || type === 'journal' || type === 'class_notes') {
        byType.notes += row.count;
      } else if (type === 'recording' || type === 'recording_summary' || type === 'lecture') {
        byType.recordings += row.count;
      } else if (type === 'document' || type === 'article') {
        byType.documents += row.count;
      } else {
        byType.other += row.count;
      }
    }

    return {
      totalEntries: totalResult[0]?.count || 0,
      recentCount: recentResult[0]?.count || 0,
      byType,
    };
  }

  /**
   * Get wellness metric for dashboard card
   */
  async getWellnessMetric(): Promise<WellnessMetric> {
    try {
      const whoop = getWhoopIntegration();

      if (!whoop.isConfigured()) {
        return {
          recoveryScore: null,
          sleepHours: null,
          status: 'not_configured',
          recommendation: 'Connect Whoop to see recovery metrics',
        };
      }

      const [recovery, sleep] = await Promise.all([
        whoop.getTodayRecovery().catch(() => null),
        whoop.getLastNightSleep().catch(() => null),
      ]);

      let status: WellnessMetric['status'] = 'unknown';
      let recommendation: string | null = null;
      let recoveryScore: number | null = null;
      let sleepHours: number | null = null;

      if (recovery) {
        recoveryScore = recovery.score.recovery_score;
        if (recoveryScore >= 80) {
          status = 'excellent';
          recommendation = 'Great recovery! Push yourself today.';
        } else if (recoveryScore >= 60) {
          status = 'good';
          recommendation = 'Solid recovery. Maintain your routine.';
        } else if (recoveryScore >= 40) {
          status = 'fair';
          recommendation = 'Take it easy today. Consider lighter workouts.';
        } else {
          status = 'poor';
          recommendation = 'Rest and recovery recommended.';
        }
      }

      if (sleep) {
        // Convert milliseconds to hours if needed
        const totalSleep = sleep.score?.sleep_performance_percentage
          ? (sleep.score.sleep_performance_percentage / 100) * 8 // Estimate based on 8hr target
          : null;
        sleepHours = totalSleep ? Math.round(totalSleep * 10) / 10 : null;
      }

      return {
        recoveryScore,
        sleepHours,
        status,
        recommendation,
      };
    } catch (error) {
      console.error('[Dashboard] Wellness metric error:', error);
      return {
        recoveryScore: null,
        sleepHours: null,
        status: 'unknown',
        recommendation: null,
      };
    }
  }

  /**
   * Get a specific widget's data
   */
  async getWidget(widgetType: string): Promise<unknown> {
    switch (widgetType) {
      case 'tasks':
        return this.getTasksMetric();
      case 'events':
        return this.getEventsMetric();
      case 'goals':
        return this.getGoalsMetric();
      case 'habits':
        return this.getHabitsMetric();
      case 'vault':
        return this.getVaultMetric();
      case 'wellness':
        return this.getWellnessMetric();
      default:
        throw new Error(`Unknown widget type: ${widgetType}`);
    }
  }

  // ============================================
  // PHASE 2 - Grouped Views
  // ============================================

  /**
   * Get today's tasks grouped by priority
   */
  async getGroupedTodayTasks(): Promise<GroupedTodayTasks> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // Get all today's tasks with project info
    const result = await db
      .select({
        task: tasks,
        project: {
          id: projects.id,
          name: projects.name,
        },
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        or(
          eq(tasks.status, 'today'),
          and(
            sql`${tasks.status} not in ('archived')`,
            gte(tasks.dueDate, todayStart),
            lt(tasks.dueDate, todayEnd)
          ),
          and(
            eq(tasks.status, 'done'),
            gte(tasks.completedAt, todayStart),
            lt(tasks.completedAt, todayEnd)
          )
        )
      )
      .orderBy(desc(tasks.priority), asc(tasks.dueDate));

    // Also get overdue tasks
    const overdueResult = await db
      .select({
        task: tasks,
        project: {
          id: projects.id,
          name: projects.name,
        },
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        and(
          sql`${tasks.status} not in ('done', 'archived')`,
          lt(tasks.dueDate, todayStart)
        )
      )
      .orderBy(asc(tasks.dueDate));

    // Transform and group
    const transformTask = (row: { task: typeof tasks.$inferSelect; project: { id: string; name: string } | null }): TaskWithProject => ({
      id: row.task.id,
      title: row.task.title,
      description: row.task.description,
      status: row.task.status,
      priority: row.task.priority,
      dueDate: row.task.dueDate,
      source: row.task.source,
      context: row.task.context,
      timeEstimateMinutes: row.task.timeEstimateMinutes,
      completedAt: row.task.completedAt,
      project: row.project?.id ? row.project : null,
    });

    const grouped: GroupedTodayTasks = {
      overdue: overdueResult.map(transformTask),
      high: [],
      medium: [],
      low: [],
      noPriority: [],
      completed: [],
      stats: {
        total: 0,
        completed: 0,
        totalMinutes: 0,
        completedMinutes: 0,
      },
    };

    for (const row of result) {
      const task = transformTask(row);

      if (task.status === 'done') {
        grouped.completed.push(task);
        grouped.stats.completed++;
        grouped.stats.completedMinutes += task.timeEstimateMinutes || 0;
      } else {
        grouped.stats.total++;
        grouped.stats.totalMinutes += task.timeEstimateMinutes || 0;

        if (task.priority >= 3) {
          grouped.high.push(task);
        } else if (task.priority === 2) {
          grouped.medium.push(task);
        } else if (task.priority === 1) {
          grouped.low.push(task);
        } else {
          grouped.noPriority.push(task);
        }
      }
    }

    // Add overdue to totals
    grouped.stats.total += grouped.overdue.length;
    for (const task of grouped.overdue) {
      grouped.stats.totalMinutes += task.timeEstimateMinutes || 0;
    }

    return grouped;
  }

  /**
   * Get deadlines grouped by urgency
   */
  async getGroupedDeadlines(): Promise<GroupedDeadlines> {
    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const nextWeekEnd = new Date(todayStart);
    nextWeekEnd.setDate(nextWeekEnd.getDate() + 14);

    // Get all tasks with due dates
    const result = await db
      .select({
        task: tasks,
        project: {
          id: projects.id,
          name: projects.name,
        },
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        and(
          sql`${tasks.status} not in ('done', 'archived')`,
          sql`${tasks.dueDate} is not null`
        )
      )
      .orderBy(asc(tasks.dueDate));

    const grouped: GroupedDeadlines = {
      overdue: [],
      today: [],
      thisWeek: [],
      nextWeek: [],
      later: [],
      stats: {
        total: 0,
        overdue: 0,
        urgent: 0,
      },
    };

    for (const row of result) {
      if (!row.task.dueDate) continue;

      const dueDate = new Date(row.task.dueDate);
      const daysUntil = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const deadline: DeadlineTask = {
        id: row.task.id,
        title: row.task.title,
        dueDate: row.task.dueDate,
        priority: row.task.priority,
        source: row.task.source,
        context: row.task.context,
        project: row.project?.id ? row.project : null,
        daysUntil,
      };

      grouped.stats.total++;

      if (dueDate < todayStart) {
        grouped.overdue.push(deadline);
        grouped.stats.overdue++;
        grouped.stats.urgent++;
      } else if (dueDate < todayEnd) {
        grouped.today.push(deadline);
        grouped.stats.urgent++;
      } else if (dueDate < weekEnd) {
        grouped.thisWeek.push(deadline);
      } else if (dueDate < nextWeekEnd) {
        grouped.nextWeek.push(deadline);
      } else {
        grouped.later.push(deadline);
      }
    }

    return grouped;
  }

  /**
   * Get week overview with events and workload
   */
  async getWeekOverview(): Promise<WeekOverview> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get start of week (Monday)
    const dayOfWeek = today.getDay();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    // Get all events for the week
    const events = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          gte(calendarEvents.startTime, weekStart),
          lt(calendarEvents.startTime, weekEnd)
        )
      )
      .orderBy(asc(calendarEvents.startTime));

    // Get task counts per day
    const taskCounts = await db
      .select({
        dueDate: sql<string>`date(${tasks.dueDate})`,
        count: sql<number>`count(*)::int`,
      })
      .from(tasks)
      .where(
        and(
          sql`${tasks.status} not in ('done', 'archived')`,
          gte(tasks.dueDate, weekStart),
          lt(tasks.dueDate, weekEnd)
        )
      )
      .groupBy(sql`date(${tasks.dueDate})`);

    const taskCountMap = new Map<string, number>();
    for (const tc of taskCounts) {
      if (tc.dueDate) {
        taskCountMap.set(tc.dueDate, tc.count);
      }
    }

    // Build days array
    const days: WeekDay[] = [];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const timeAllocation = { meetings: 0, classes: 0, focus: 0, personal: 0 };
    let totalEvents = 0;
    let totalTasks = 0;

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      // Filter events for this day
      const dayEvents = events
        .filter(e => {
          const eventDate = new Date(e.startTime);
          return eventDate.toISOString().split('T')[0] === dateStr;
        })
        .map(e => ({
          id: e.id,
          title: e.title,
          startTime: e.startTime.toISOString(),
          endTime: e.endTime?.toISOString() || null,
          eventType: e.eventType,
        }));

      // Calculate time allocation
      for (const e of dayEvents) {
        const eventType = e.eventType?.toLowerCase() || 'other';
        if (eventType === 'meeting') timeAllocation.meetings++;
        else if (eventType === 'class') timeAllocation.classes++;
        else if (eventType === 'blocked_time') timeAllocation.focus++;
        else timeAllocation.personal++;
      }

      const taskCount = taskCountMap.get(dateStr) || 0;
      totalEvents += dayEvents.length;
      totalTasks += taskCount;

      // Calculate workload level
      const totalItems = dayEvents.length + taskCount;
      let workloadLevel: 'light' | 'moderate' | 'heavy' = 'light';
      if (totalItems >= 8) workloadLevel = 'heavy';
      else if (totalItems >= 4) workloadLevel = 'moderate';

      // Calculate density (0-1)
      const density = Math.min(1, totalItems / 10);

      days.push({
        date: dateStr,
        dayName: dayNames[date.getDay()],
        events: dayEvents,
        taskCount,
        workloadLevel,
        density,
      });
    }

    return {
      days,
      timeAllocation,
      totalEvents,
      totalTasks,
    };
  }

  // ============================================
  // PHASE 3 - New Dashboard Sections
  // ============================================

  /**
   * Get Canvas Hub data (classes, assignments)
   */
  async getCanvasHub(): Promise<CanvasHubData> {
    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // Get today's classes from calendar
    const todaysClassesResult = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          gte(calendarEvents.startTime, todayStart),
          lt(calendarEvents.startTime, todayEnd),
          eq(calendarEvents.eventType, 'class')
        )
      )
      .orderBy(asc(calendarEvents.startTime));

    const todaysClasses: CanvasClass[] = todaysClassesResult.map(event => ({
      id: event.id,
      name: event.title,
      time: event.startTime.toISOString(),
      location: event.location,
      isToday: true,
    }));

    // Get upcoming assignments (Canvas items with due dates in next 7 days)
    const assignmentsResult = await db
      .select({
        item: canvasItems,
        task: tasks,
      })
      .from(canvasItems)
      .leftJoin(tasks, eq(canvasItems.taskId, tasks.id))
      .where(
        and(
          sql`${canvasItems.dueAt} is not null`,
          gte(canvasItems.dueAt, todayStart),
          lt(canvasItems.dueAt, weekEnd),
          sql`${canvasItems.canvasType} in ('assignment', 'quiz')`
        )
      )
      .orderBy(asc(canvasItems.dueAt))
      .limit(10);

    const upcomingAssignments: CanvasAssignment[] = assignmentsResult.map(row => {
      const dueAt = row.item.dueAt!;
      const daysUntil = Math.ceil((dueAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: row.item.id,
        title: row.item.title,
        courseName: row.item.courseName || 'Unknown Course',
        dueDate: dueAt.toISOString(),
        daysUntil,
        isOverdue: daysUntil < 0,
        taskId: row.item.taskId,
      };
    });

    // Count missing submissions (overdue Canvas items not marked as done)
    const missingResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(canvasItems)
      .leftJoin(tasks, eq(canvasItems.taskId, tasks.id))
      .where(
        and(
          lt(canvasItems.dueAt, now),
          sql`${canvasItems.canvasType} in ('assignment', 'quiz')`,
          or(
            isNull(tasks.status),
            sql`${tasks.status} != 'done'`
          )
        )
      );

    // Find next class
    const nextClassResult = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          gte(calendarEvents.startTime, now),
          eq(calendarEvents.eventType, 'class')
        )
      )
      .orderBy(asc(calendarEvents.startTime))
      .limit(1);

    let nextClass: CanvasHubData['nextClass'] = null;
    if (nextClassResult[0]) {
      const event = nextClassResult[0];
      const startsIn = Math.round((event.startTime.getTime() - now.getTime()) / (1000 * 60));
      nextClass = {
        name: event.title,
        startsIn,
        location: event.location,
      };
    }

    return {
      todaysClasses,
      upcomingAssignments,
      missingSubmissions: missingResult[0]?.count || 0,
      nextClass,
    };
  }

  /**
   * Get Fitness Dashboard data (Whoop integration)
   */
  async getFitness(): Promise<FitnessData> {
    const whoop = getWhoopIntegration();

    if (!whoop.isConfigured()) {
      return {
        workoutStreak: 0,
        lastWorkout: null,
        sleepTrend: [],
        recoveryTrend: [],
        todayRecovery: null,
        averageSleep: 0,
      };
    }

    try {
      // Only getTodayRecovery is available on the Whoop integration
      const recovery = await whoop.getTodayRecovery().catch(() => null);

      // Today's recovery
      const todayRecovery = recovery?.score?.recovery_score ?? null;

      // Note: Sleep and workout data would require additional Whoop API methods
      // For now, return basic recovery data only
      return {
        workoutStreak: 0,
        lastWorkout: null,
        sleepTrend: [],
        recoveryTrend: [],
        todayRecovery,
        averageSleep: 0,
      };
    } catch (error) {
      console.error('[Dashboard] Fitness data error:', error);
      return {
        workoutStreak: 0,
        lastWorkout: null,
        sleepTrend: [],
        recoveryTrend: [],
        todayRecovery: null,
        averageSleep: 0,
      };
    }
  }

  /**
   * Get System Monitor data (integration health)
   */
  async getSystemMonitor(): Promise<SystemMonitorData> {
    const integrationNames = [
      { name: 'google_calendar', displayName: 'Google Calendar' },
      { name: 'canvas', displayName: 'Canvas LMS' },
      { name: 'whoop', displayName: 'Whoop' },
      { name: 'gmail', displayName: 'Gmail' },
      { name: 'notion', displayName: 'Notion' },
      { name: 'telegram', displayName: 'Telegram' },
      { name: 'plaud', displayName: 'Plaud Pro' },
    ];

    // Get latest health status for each integration
    const healthStatuses = await Promise.all(
      integrationNames.map(async ({ name, displayName }) => {
        const result = await db
          .select()
          .from(systemHealthLogs)
          .where(eq(systemHealthLogs.integration, name))
          .orderBy(desc(systemHealthLogs.createdAt))
          .limit(1);

        if (result[0]) {
          return {
            name,
            displayName,
            status: result[0].status as IntegrationHealth['status'],
            lastSyncAt: result[0].lastSyncAt?.toISOString() || null,
            latencyMs: result[0].latencyMs,
            errorMessage: result[0].errorMessage,
          };
        }

        // Check if integration is configured (simplified check)
        const isConfigured = this.checkIntegrationConfigured(name);
        return {
          name,
          displayName,
          status: isConfigured ? 'healthy' : 'not_configured' as const,
          lastSyncAt: null,
          latencyMs: null,
          errorMessage: null,
        };
      })
    );

    // Calculate overall status
    const healthyCount = healthStatuses.filter(h => h.status === 'healthy').length;
    const degradedCount = healthStatuses.filter(h => h.status === 'degraded').length;
    const downCount = healthStatuses.filter(h => h.status === 'down').length;
    const totalCount = healthStatuses.filter(h => h.status !== 'not_configured').length;

    let overallStatus: SystemMonitorData['overallStatus'] = 'healthy';
    if (downCount > 0) {
      overallStatus = 'down';
    } else if (degradedCount > 0) {
      overallStatus = 'degraded';
    }

    return {
      integrations: healthStatuses,
      overallStatus,
      healthyCount,
      totalCount,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Check if an integration is configured (simplified)
   */
  private checkIntegrationConfigured(name: string): boolean {
    switch (name) {
      case 'google_calendar':
        return !!process.env.GOOGLE_CLIENT_ID;
      case 'canvas':
        return !!process.env.CANVAS_API_TOKEN;
      case 'whoop':
        return !!process.env.WHOOP_CLIENT_ID;
      case 'gmail':
        return !!process.env.GOOGLE_CLIENT_ID;
      case 'notion':
        return !!process.env.NOTION_API_KEY;
      case 'telegram':
        return !!process.env.TELEGRAM_BOT_TOKEN;
      case 'plaud':
        return !!process.env.PLAUD_SYNC_PATH;
      default:
        return false;
    }
  }

  /**
   * Get AI Insights data
   */
  async getAIInsights(): Promise<AIInsightsData> {
    const now = new Date();

    // Get active insights (not dismissed, not expired)
    const result = await db
      .select()
      .from(aiInsights)
      .where(
        and(
          eq(aiInsights.isDismissed, false),
          or(
            isNull(aiInsights.expiresAt),
            gte(aiInsights.expiresAt, now)
          )
        )
      )
      .orderBy(
        sql`CASE ${aiInsights.severity} WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END`,
        desc(aiInsights.createdAt)
      )
      .limit(10);

    const insights: AIInsight[] = result.map(row => ({
      id: row.id,
      type: row.insightType as AIInsight['type'],
      category: row.category,
      title: row.title,
      description: row.description,
      severity: row.severity as AIInsight['severity'],
      actionable: row.actionable,
      actionLabel: row.actionLabel,
      actionTarget: row.actionTarget,
      createdAt: row.createdAt.toISOString(),
    }));

    // Count by severity
    const criticalCount = insights.filter(i => i.severity === 'critical').length;
    const warningCount = insights.filter(i => i.severity === 'warning').length;

    return {
      insights,
      totalCount: insights.length,
      criticalCount,
      warningCount,
    };
  }

  /**
   * Dismiss an AI insight
   */
  async dismissInsight(insightId: string): Promise<void> {
    await db
      .update(aiInsights)
      .set({
        isDismissed: true,
        dismissedAt: new Date(),
      })
      .where(eq(aiInsights.id, insightId));
  }

  /**
   * Generate AI insights based on current data patterns
   * This is called periodically to create new insights
   */
  async generateInsights(): Promise<number> {
    const insights: Array<{
      insightType: string;
      category: string;
      title: string;
      description: string;
      severity: string;
      actionable: boolean;
      actionLabel?: string;
      actionTarget?: string;
      data?: Record<string, unknown>;
      expiresAt?: Date;
    }> = [];

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check for overdue tasks
    const overdueCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(
        and(
          sql`${tasks.status} not in ('done', 'archived')`,
          lt(tasks.dueDate, now)
        )
      );

    if ((overdueCount[0]?.count || 0) > 3) {
      insights.push({
        insightType: 'warning',
        category: 'workload',
        title: 'Multiple Overdue Tasks',
        description: `You have ${overdueCount[0]?.count} overdue tasks. Consider reviewing and rescheduling them.`,
        severity: 'warning',
        actionable: true,
        actionLabel: 'View Tasks',
        actionTarget: '/tasks',
        expiresAt: tomorrow,
      });
    }

    // Check for heavy workload tomorrow
    const tomorrowStart = new Date(now);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

    const [tomorrowEvents, tomorrowTasks] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(calendarEvents)
        .where(
          and(
            gte(calendarEvents.startTime, tomorrowStart),
            lt(calendarEvents.startTime, tomorrowEnd)
          )
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .where(
          and(
            sql`${tasks.status} not in ('done', 'archived')`,
            gte(tasks.dueDate, tomorrowStart),
            lt(tasks.dueDate, tomorrowEnd)
          )
        ),
    ]);

    const tomorrowTotal = (tomorrowEvents[0]?.count || 0) + (tomorrowTasks[0]?.count || 0);
    if (tomorrowTotal > 10) {
      insights.push({
        insightType: 'alert',
        category: 'workload',
        title: 'Heavy Workload Tomorrow',
        description: `Tomorrow has ${tomorrowTotal} items scheduled. Consider spreading some tasks to other days.`,
        severity: 'info',
        actionable: true,
        actionLabel: 'View Calendar',
        actionTarget: '/calendar',
        expiresAt: tomorrowStart,
      });
    }

    // Check for goals needing attention
    const staleGoals = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(goals)
      .where(
        and(
          eq(goals.status, 'active'),
          lt(goals.healthScore, 50)
        )
      );

    if ((staleGoals[0]?.count || 0) > 0) {
      insights.push({
        insightType: 'suggestion',
        category: 'goal',
        title: 'Goals Need Attention',
        description: `${staleGoals[0]?.count} goals have low health scores. Consider reviewing your progress.`,
        severity: 'info',
        actionable: true,
        actionLabel: 'View Goals',
        actionTarget: '/goals',
      });
    }

    // Insert new insights (avoiding duplicates by checking recent similar insights)
    let insertedCount = 0;
    for (const insight of insights) {
      // Check for recent similar insight
      const existing = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(aiInsights)
        .where(
          and(
            eq(aiInsights.title, insight.title),
            eq(aiInsights.isDismissed, false),
            gte(aiInsights.createdAt, new Date(now.getTime() - 24 * 60 * 60 * 1000))
          )
        );

      if ((existing[0]?.count || 0) === 0) {
        await db.insert(aiInsights).values(insight);
        insertedCount++;
      }
    }

    return insertedCount;
  }
}

export const dashboardService = new DashboardService();

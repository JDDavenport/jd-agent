import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { tasks, projects, goals, dailyReviews, calendarEvents, vaultEntries, recordings } from '../db/schema';
import { integrityService } from './integrity-service';
import { getWhoopIntegration } from '../integrations/whoop';

class AnalyticsService {
  /**
   * Get productivity stats for a date range
   */
  async getProductivity(startDate: Date, endDate: Date) {
    // Tasks completed in range
    const completedTasks = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.status, 'done'),
          gte(tasks.completedAt, startDate),
          lte(tasks.completedAt, endDate)
        )
      );

    // Tasks by status
    const tasksByStatus = await db
      .select({
        status: tasks.status,
        count: sql<number>`count(*)::int`,
      })
      .from(tasks)
      .groupBy(tasks.status);

    // Inbox zero streaks (from daily reviews)
    const inboxZeroDays = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(dailyReviews)
      .where(
        and(
          eq(dailyReviews.inboxEnd, 0),
          gte(dailyReviews.date, startDate.toISOString().split('T')[0]),
          lte(dailyReviews.date, endDate.toISOString().split('T')[0])
        )
      );

    // On-time completion rate
    const onTimeStats = await db
      .select({
        total: sql<number>`count(*)::int`,
        onTime: sql<number>`count(*) filter (where ${tasks.completedAt} <= ${tasks.dueDate})::int`,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.status, 'done'),
          sql`${tasks.dueDate} is not null`,
          gte(tasks.completedAt, startDate),
          lte(tasks.completedAt, endDate)
        )
      );

    const onTimeRate =
      onTimeStats[0]?.total > 0
        ? Math.round((onTimeStats[0].onTime / onTimeStats[0].total) * 100)
        : 100;

    return {
      tasksCompleted: completedTasks[0]?.count || 0,
      tasksByStatus: tasksByStatus.reduce(
        (acc, row) => {
          acc[row.status] = row.count;
          return acc;
        },
        {} as Record<string, number>
      ),
      inboxZeroDays: inboxZeroDays[0]?.count || 0,
      onTimeRate,
    };
  }

  /**
   * Get completion trends by day
   */
  async getCompletionTrend(days: number = 14) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const trend = await db
      .select({
        date: sql<string>`date(${tasks.completedAt})`,
        count: sql<number>`count(*)::int`,
      })
      .from(tasks)
      .where(
        and(eq(tasks.status, 'done'), gte(tasks.completedAt, startDate))
      )
      .groupBy(sql`date(${tasks.completedAt})`)
      .orderBy(sql`date(${tasks.completedAt})`);

    return trend;
  }

  /**
   * Get stats by context
   */
  async getByContext(startDate?: Date, endDate?: Date) {
    const conditions = [eq(tasks.status, 'done')];
    if (startDate) conditions.push(gte(tasks.completedAt, startDate));
    if (endDate) conditions.push(lte(tasks.completedAt, endDate));

    const stats = await db
      .select({
        context: tasks.context,
        count: sql<number>`count(*)::int`,
      })
      .from(tasks)
      .where(and(...conditions))
      .groupBy(tasks.context)
      .orderBy(desc(sql`count(*)`));

    return stats;
  }

  /**
   * Get project progress
   */
  async getProjectProgress() {
    const projectStats = await db
      .select({
        projectId: projects.id,
        projectName: projects.name,
        status: projects.status,
        totalTasks: sql<number>`count(${tasks.id})::int`,
        completedTasks: sql<number>`count(*) filter (where ${tasks.status} = 'done')::int`,
      })
      .from(projects)
      .leftJoin(tasks, eq(tasks.projectId, projects.id))
      .where(eq(projects.status, 'active'))
      .groupBy(projects.id, projects.name, projects.status);

    return projectStats.map((p) => ({
      ...p,
      progress:
        p.totalTasks > 0
          ? Math.round((p.completedTasks / p.totalTasks) * 100)
          : 0,
    }));
  }

  /**
   * Get goal progress summary
   */
  async getGoalProgress() {
    const goalStats = await db
      .select({
        id: goals.id,
        title: goals.title,
        area: goals.area,
        targetValue: goals.targetValue,
        currentValue: goals.currentValue,
        targetDate: goals.targetDate,
        status: goals.status,
      })
      .from(goals)
      .where(eq(goals.status, 'active'))
      .orderBy(goals.targetDate);

    return goalStats.map((g) => ({
      ...g,
      progress:
        g.targetValue && g.targetValue > 0
          ? Math.round(((g.currentValue || 0) / g.targetValue) * 100)
          : 0,
    }));
  }

  /**
   * Get summary dashboard data
   */
  async getDashboard() {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Get task counts
    const [todayTasks, overdueTasks, upcomingTasks, inboxTasks] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .where(eq(tasks.status, 'today')),
      db.select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .where(and(
          sql`${tasks.status} not in ('done', 'archived')`,
          lte(tasks.dueDate, todayStart)
        )),
      db.select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .where(eq(tasks.status, 'upcoming')),
      db.select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .where(eq(tasks.status, 'inbox')),
    ]);

    // Get calendar event counts
    const [todayEvents, upcomingEvents] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` })
        .from(calendarEvents)
        .where(and(
          gte(calendarEvents.startTime, todayStart),
          lte(calendarEvents.startTime, todayEnd)
        )),
      db.select({ count: sql<number>`count(*)::int` })
        .from(calendarEvents)
        .where(gte(calendarEvents.startTime, todayEnd)),
    ]);

    // Get vault entry counts
    const [totalVaultEntries, thisWeekVaultEntries] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` })
        .from(vaultEntries),
      db.select({ count: sql<number>`count(*)::int` })
        .from(vaultEntries)
        .where(gte(vaultEntries.createdAt, weekAgo)),
    ]);

    // Get recording counts
    const [totalRecordings, unprocessedRecordings] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` })
        .from(recordings),
      db.select({ count: sql<number>`count(*)::int` })
        .from(recordings)
        .where(eq(recordings.status, 'pending')),
    ]);

    // Get system health
    const systemHealth = await integrityService.getHealthSummary();

    // Get personal health status
    let personalHealth;
    try {
      const whoop = getWhoopIntegration();
      if (whoop.isConfigured()) {
        const recovery = await whoop.getTodayRecovery();
        let status: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown' = 'unknown';
        let score: number | null = null;

        if (recovery) {
          score = recovery.score.recovery_score;
          if (score >= 80) status = 'excellent';
          else if (score >= 60) status = 'good';
          else if (score >= 40) status = 'fair';
          else status = 'poor';
        }

        personalHealth = {
          status,
          recoveryScore: score,
          hasData: !!recovery,
        };
      } else {
        personalHealth = {
          status: 'not_configured' as const,
          recoveryScore: null,
          hasData: false,
        };
      }
    } catch (error) {
      console.error('[Analytics] Health data fetch error:', error);
      personalHealth = {
        status: 'unknown' as const,
        recoveryScore: null,
        hasData: false,
      };
    }

    return {
      tasks: {
        today: todayTasks[0]?.count || 0,
        overdue: overdueTasks[0]?.count || 0,
        upcoming: upcomingTasks[0]?.count || 0,
        inbox: inboxTasks[0]?.count || 0,
      },
      calendar: {
        todayEvents: todayEvents[0]?.count || 0,
        upcomingEvents: upcomingEvents[0]?.count || 0,
      },
      vault: {
        totalEntries: totalVaultEntries[0]?.count || 0,
        thisWeek: thisWeekVaultEntries[0]?.count || 0,
      },
      recordings: {
        total: totalRecordings[0]?.count || 0,
        unprocessed: unprocessedRecordings[0]?.count || 0,
      },
      health: personalHealth,
      systemHealth: {
        status: systemHealth.status,
        lastCheck: new Date().toISOString(),
      },
    };
  }

  /**
   * Get health metrics for the System Health page
   */
  async getHealthMetrics() {
    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Get tasks completed in last 7 days
    const tasksCompleted = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(
        and(
          eq(tasks.status, 'done'),
          gte(tasks.completedAt, weekAgo)
        )
      );

    // Get vault entries created in last 7 days
    const vaultEntriesCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vaultEntries)
      .where(gte(vaultEntries.createdAt, weekAgo));

    // Get daily stats for the past 7 days
    const dailyStats = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayTasksResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(tasks)
        .where(
          and(
            eq(tasks.status, 'done'),
            gte(tasks.completedAt, dayStart),
            lte(tasks.completedAt, dayEnd)
          )
        );

      dailyStats.push({
        date: dayStart.toISOString().split('T')[0],
        tasksCompleted: dayTasksResult[0]?.count || 0,
        timeTracked: 0, // Time tracking not implemented yet
      });
    }

    return {
      tasksCompleted7d: tasksCompleted[0]?.count || 0,
      timeTracked7d: 0, // Time tracking not implemented yet
      vaultEntries7d: vaultEntriesCount[0]?.count || 0,
      dailyStats,
    };
  }
}

export const analyticsService = new AnalyticsService();

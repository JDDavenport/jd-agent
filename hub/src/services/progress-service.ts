/**
 * Progress Service
 *
 * Aggregates progress data for the Goals & Habits dashboard.
 * Provides overview, weekly reports, life area breakdowns, and streak tracking.
 */

import { eq, and, desc, asc, sql, gte, lte } from 'drizzle-orm';
import { db } from '../db/client';
import { goals, habits, habitCompletions, milestones, goalReflections } from '../db/schema';
import { LIFE_AREAS, LIFE_AREA_VALUES, type LifeArea } from '../constants/life-areas';
import { habitService } from './habit-service';
import { milestonesService } from './milestones-service';

// ============================================
// TYPES
// ============================================

export interface LifeAreaProgress {
  area: LifeArea;
  name: string;
  icon: string;
  color: string;
  progressPercentage: number;
  activeGoals: number;
  completedGoals: number;
  totalGoals: number;
  activeHabits: number;
  avgHabitCompletionRate: number;
}

export interface HabitStreak {
  habitId: string;
  habitTitle: string;
  lifeArea: string | null;
  currentStreak: number;
  longestStreak: number;
}

export interface GoalAlert {
  goalId: string;
  goalTitle: string;
  lifeArea: string | null;
  reason: string;
  severity: 'warning' | 'critical';
  progressPercentage: number;
  daysRemaining: number | null;
}

export interface ProgressOverview {
  todaysHabits: {
    completed: number;
    total: number;
    percentage: number;
  };
  byArea: LifeAreaProgress[];
  topStreaks: HabitStreak[];
  needsAttention: GoalAlert[];
  overallProgress: {
    totalGoals: number;
    completedGoals: number;
    activeGoals: number;
    percentage: number;
  };
  upcomingMilestones: Array<{
    id: string;
    title: string;
    goalTitle: string;
    targetDate: string | null;
    daysUntil: number | null;
  }>;
}

export interface WeeklyReport {
  weekStartDate: string;
  weekEndDate: string;
  habits: {
    totalCompletions: number;
    totalDue: number;
    completionRate: number;
    perfectDays: number;
    streaksGained: number;
    streaksLost: number;
  };
  goals: {
    progressMade: number;
    milestonesCompleted: number;
    reflectionsAdded: number;
  };
  byArea: Array<{
    area: LifeArea;
    name: string;
    habitCompletionRate: number;
    goalsProgress: number;
  }>;
  highlights: string[];
  improvements: string[];
}

export interface LifeAreaDetail {
  area: LifeArea;
  name: string;
  icon: string;
  color: string;
  description: string;
  goals: Array<{
    id: string;
    title: string;
    status: string;
    progressPercentage: number;
    targetDate: string | null;
    milestonesCount: number;
    milestonesCompleted: number;
  }>;
  habits: Array<{
    id: string;
    title: string;
    frequency: string;
    currentStreak: number;
    completionRate: number;
    isActive: boolean;
  }>;
  stats: {
    totalGoals: number;
    completedGoals: number;
    activeGoals: number;
    totalHabits: number;
    activeHabits: number;
    avgStreak: number;
    avgCompletionRate: number;
  };
}

// ============================================
// SERVICE
// ============================================

class ProgressService {
  /**
   * Get full dashboard overview data
   */
  async getOverview(): Promise<ProgressOverview> {
    const [todaysHabits, byArea, topStreaks, needsAttention, overallProgress, upcomingMilestones] =
      await Promise.all([
        this.getTodaysHabitsProgress(),
        this.getProgressByArea(),
        this.getTopStreaks(5),
        this.getGoalsNeedingAttention(),
        this.getOverallGoalProgress(),
        this.getUpcomingMilestonesForDashboard(7),
      ]);

    return {
      todaysHabits,
      byArea,
      topStreaks,
      needsAttention,
      overallProgress,
      upcomingMilestones,
    };
  }

  /**
   * Get today's habit completion progress
   */
  async getTodaysHabitsProgress(): Promise<{ completed: number; total: number; percentage: number }> {
    const todaysHabits = await habitService.getTodaysHabits();
    const dueHabits = todaysHabits.filter((h) => h.isDueToday);
    const completed = dueHabits.filter((h) => h.completedToday).length;
    const total = dueHabits.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, total, percentage };
  }

  /**
   * Get progress breakdown by life area
   */
  async getProgressByArea(): Promise<LifeAreaProgress[]> {
    const results: LifeAreaProgress[] = [];

    for (const area of LIFE_AREA_VALUES) {
      const areaInfo = LIFE_AREAS[area];

      // Get goals for this area
      const areaGoals = await db
        .select({
          total: sql<number>`count(*)::int`,
          completed: sql<number>`count(*) filter (where ${goals.status} = 'completed')::int`,
          active: sql<number>`count(*) filter (where ${goals.status} = 'active')::int`,
          avgProgress: sql<number>`coalesce(avg(${goals.progressPercentage}), 0)::real`,
        })
        .from(goals)
        .where(eq(goals.lifeArea, area));

      // Get habits for this area
      const areaHabits = await db
        .select({
          total: sql<number>`count(*)::int`,
          active: sql<number>`count(*) filter (where ${habits.isActive} = true)::int`,
          avgStreak: sql<number>`coalesce(avg(${habits.currentStreak}), 0)::real`,
        })
        .from(habits)
        .where(eq(habits.lifeArea, area));

      const goalData = areaGoals[0];
      const habitData = areaHabits[0];

      // Calculate average habit completion rate for active habits
      let avgCompletionRate = 0;
      if (habitData.active > 0) {
        const activeHabits = await db
          .select({ id: habits.id })
          .from(habits)
          .where(and(eq(habits.lifeArea, area), eq(habits.isActive, true)));

        const rates = await Promise.all(
          activeHabits.map(async (h) => {
            const stats = await habitService.getWeeklyStats(h.id);
            return stats.completionRate;
          })
        );
        avgCompletionRate = rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0;
      }

      // Calculate overall progress for this area
      const progressPercentage =
        goalData.total > 0 ? Math.round((goalData.completed / goalData.total) * 100) : 0;

      results.push({
        area,
        name: areaInfo.name,
        icon: areaInfo.icon,
        color: areaInfo.color,
        progressPercentage,
        activeGoals: goalData.active,
        completedGoals: goalData.completed,
        totalGoals: goalData.total,
        activeHabits: habitData.active,
        avgHabitCompletionRate: avgCompletionRate,
      });
    }

    return results;
  }

  /**
   * Get top habit streaks
   */
  async getTopStreaks(limit: number = 5): Promise<HabitStreak[]> {
    const result = await db
      .select({
        habitId: habits.id,
        habitTitle: habits.title,
        lifeArea: habits.lifeArea,
        currentStreak: habits.currentStreak,
        longestStreak: habits.longestStreak,
      })
      .from(habits)
      .where(eq(habits.isActive, true))
      .orderBy(desc(habits.currentStreak))
      .limit(limit);

    return result;
  }

  /**
   * Get goals that need attention (behind schedule, stalled, etc.)
   *
   * OPTIMIZED: Uses a single query with LEFT JOIN to fetch goals and their
   * latest reflection in one round-trip, eliminating N+1 query pattern.
   */
  async getGoalsNeedingAttention(): Promise<GoalAlert[]> {
    const alerts: GoalAlert[] = [];
    const today = new Date();

    // Single query: Get active goals with only needed columns + latest reflection date
    // Uses a lateral join pattern via subquery to get the most recent reflection per goal
    const activeGoalsWithReflections = await db
      .select({
        // Only select columns we actually need (not SELECT *)
        id: goals.id,
        title: goals.title,
        lifeArea: goals.lifeArea,
        progressPercentage: goals.progressPercentage,
        targetDate: goals.targetDate,
        startDate: goals.startDate,
        createdAt: goals.createdAt,
        updatedAt: goals.updatedAt,
        // Subquery to get latest reflection date for each goal
        lastReflectionAt: sql<Date | null>`(
          SELECT created_at FROM goal_reflections
          WHERE goal_id = ${goals.id}
          ORDER BY created_at DESC
          LIMIT 1
        )`.as('last_reflection_at'),
      })
      .from(goals)
      .where(eq(goals.status, 'active'));

    // Process all goals in memory (no additional DB calls)
    for (const goal of activeGoalsWithReflections) {
      const progress = goal.progressPercentage || 0;
      let daysRemaining: number | null = null;
      let addedAlert = false;

      if (goal.targetDate) {
        const targetDate = new Date(goal.targetDate);
        daysRemaining = Math.ceil((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        // Calculate expected progress based on timeline
        const startDate = goal.startDate ? new Date(goal.startDate) : goal.createdAt;
        const totalDays = Math.ceil((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const daysElapsed = Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const expectedProgress = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;

        // Check if significantly behind
        const behindBy = expectedProgress - progress;

        if (daysRemaining < 0) {
          // Overdue
          alerts.push({
            goalId: goal.id,
            goalTitle: goal.title,
            lifeArea: goal.lifeArea,
            reason: `Overdue by ${Math.abs(daysRemaining)} days`,
            severity: 'critical',
            progressPercentage: progress,
            daysRemaining,
          });
          addedAlert = true;
        } else if (daysRemaining <= 7 && progress < 80) {
          // Due soon but not close to completion
          alerts.push({
            goalId: goal.id,
            goalTitle: goal.title,
            lifeArea: goal.lifeArea,
            reason: `Due in ${daysRemaining} days, only ${Math.round(progress)}% complete`,
            severity: 'critical',
            progressPercentage: progress,
            daysRemaining,
          });
          addedAlert = true;
        } else if (behindBy > 25) {
          // Significantly behind schedule
          alerts.push({
            goalId: goal.id,
            goalTitle: goal.title,
            lifeArea: goal.lifeArea,
            reason: `${Math.round(behindBy)}% behind schedule`,
            severity: 'warning',
            progressPercentage: progress,
            daysRemaining,
          });
          addedAlert = true;
        }
      }

      // Check for stalled goals (no progress in 14+ days)
      // Skip if we already added an alert for this goal or if it has a target date alert
      if (addedAlert) continue;

      // Use the pre-fetched lastReflectionAt instead of another DB query
      const lastActivity = goal.lastReflectionAt || goal.updatedAt;
      const daysSinceActivity = Math.ceil((today.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceActivity > 14 && progress < 100) {
        alerts.push({
          goalId: goal.id,
          goalTitle: goal.title,
          lifeArea: goal.lifeArea,
          reason: `No activity in ${daysSinceActivity} days`,
          severity: 'warning',
          progressPercentage: progress,
          daysRemaining,
        });
      }
    }

    // Sort by severity (critical first) then by days remaining
    return alerts.sort((a, b) => {
      if (a.severity !== b.severity) {
        return a.severity === 'critical' ? -1 : 1;
      }
      if (a.daysRemaining === null) return 1;
      if (b.daysRemaining === null) return -1;
      return a.daysRemaining - b.daysRemaining;
    });
  }

  /**
   * Get overall goal progress
   */
  async getOverallGoalProgress(): Promise<{
    totalGoals: number;
    completedGoals: number;
    activeGoals: number;
    percentage: number;
  }> {
    const result = await db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${goals.status} = 'completed')::int`,
        active: sql<number>`count(*) filter (where ${goals.status} = 'active')::int`,
      })
      .from(goals);

    const data = result[0];
    const percentage = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;

    return {
      totalGoals: data.total,
      completedGoals: data.completed,
      activeGoals: data.active,
      percentage,
    };
  }

  /**
   * Get upcoming milestones for dashboard
   */
  async getUpcomingMilestonesForDashboard(
    days: number = 7
  ): Promise<Array<{ id: string; title: string; goalTitle: string; targetDate: string | null; daysUntil: number | null }>> {
    const upcoming = await milestonesService.getUpcoming(days);
    const today = new Date();

    return upcoming.map((m) => ({
      id: m.id,
      title: m.title,
      goalTitle: m.goalTitle,
      targetDate: m.targetDate,
      daysUntil: m.targetDate
        ? Math.ceil((new Date(m.targetDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        : null,
    }));
  }

  /**
   * Get weekly report
   */
  async getWeeklyReport(): Promise<WeeklyReport> {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - 7);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = today.toISOString().split('T')[0];

    // Get habit completions for the week
    const weekCompletions = await db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${habitCompletions.skipped} = false)::int`,
        skipped: sql<number>`count(*) filter (where ${habitCompletions.skipped} = true)::int`,
      })
      .from(habitCompletions)
      .where(and(gte(habitCompletions.date, weekStartStr), lte(habitCompletions.date, weekEndStr)));

    // Get milestones completed this week
    const milestonesCompleted = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(milestones)
      .where(
        and(
          eq(milestones.status, 'completed'),
          gte(milestones.completedAt, weekStart),
          lte(milestones.completedAt, today)
        )
      );

    // Get reflections added this week
    const reflectionsAdded = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(goalReflections)
      .where(and(gte(goalReflections.createdAt, weekStart), lte(goalReflections.createdAt, today)));

    // Calculate perfect days (all due habits completed)
    let perfectDays = 0;
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(weekStart);
      checkDate.setDate(checkDate.getDate() + i);
      const dateStr = checkDate.toISOString().split('T')[0];

      // This is simplified - would need more complex logic for accurate perfect day tracking
      const dayCompletions = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(habitCompletions)
        .where(and(eq(habitCompletions.date, dateStr), eq(habitCompletions.skipped, false)));

      if (dayCompletions[0].count > 0) {
        perfectDays++;
      }
    }

    // Get area breakdown
    const byArea: WeeklyReport['byArea'] = [];
    for (const area of LIFE_AREA_VALUES) {
      const areaInfo = LIFE_AREAS[area];

      // Get active habits for area
      const areaHabits = await db
        .select({ id: habits.id })
        .from(habits)
        .where(and(eq(habits.lifeArea, area), eq(habits.isActive, true)));

      let avgCompletionRate = 0;
      if (areaHabits.length > 0) {
        const rates = await Promise.all(
          areaHabits.map(async (h) => {
            const stats = await habitService.getWeeklyStats(h.id);
            return stats.completionRate;
          })
        );
        avgCompletionRate = rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0;
      }

      // Get goals progress for area
      const areaGoals = await db
        .select({ avgProgress: sql<number>`coalesce(avg(${goals.progressPercentage}), 0)::real` })
        .from(goals)
        .where(and(eq(goals.lifeArea, area), eq(goals.status, 'active')));

      byArea.push({
        area,
        name: areaInfo.name,
        habitCompletionRate: avgCompletionRate,
        goalsProgress: Math.round(areaGoals[0].avgProgress),
      });
    }

    // Generate highlights and improvements
    const highlights: string[] = [];
    const improvements: string[] = [];

    const completionData = weekCompletions[0];
    const completionRate = completionData.total > 0
      ? Math.round((completionData.completed / completionData.total) * 100)
      : 0;

    if (completionRate >= 80) {
      highlights.push(`Great habit consistency! ${completionRate}% completion rate`);
    } else if (completionRate < 50) {
      improvements.push(`Habit completion rate was ${completionRate}% - aim for 80%+`);
    }

    if (milestonesCompleted[0].count > 0) {
      highlights.push(`Completed ${milestonesCompleted[0].count} milestone(s)`);
    }

    if (reflectionsAdded[0].count > 0) {
      highlights.push(`Added ${reflectionsAdded[0].count} goal reflection(s)`);
    } else {
      improvements.push('Consider adding weekly reflections to your goals');
    }

    if (perfectDays >= 5) {
      highlights.push(`${perfectDays} perfect days this week!`);
    }

    // Check for struggling areas
    for (const area of byArea) {
      if (area.habitCompletionRate < 40 && area.habitCompletionRate > 0) {
        improvements.push(`${area.name} habits need attention (${area.habitCompletionRate}% completion)`);
      }
    }

    return {
      weekStartDate: weekStartStr,
      weekEndDate: weekEndStr,
      habits: {
        totalCompletions: completionData.completed,
        totalDue: completionData.total,
        completionRate,
        perfectDays,
        streaksGained: 0, // Would need more complex tracking
        streaksLost: 0, // Would need more complex tracking
      },
      goals: {
        progressMade: 0, // Would need delta tracking
        milestonesCompleted: milestonesCompleted[0].count,
        reflectionsAdded: reflectionsAdded[0].count,
      },
      byArea,
      highlights,
      improvements,
    };
  }

  /**
   * Get detailed progress for a specific life area
   */
  async getByLifeArea(area: LifeArea): Promise<LifeAreaDetail> {
    const areaInfo = LIFE_AREAS[area];

    // Get goals for this area
    const areaGoals = await db
      .select()
      .from(goals)
      .where(eq(goals.lifeArea, area))
      .orderBy(desc(goals.createdAt));

    // Enrich goals with milestone counts
    const enrichedGoals = await Promise.all(
      areaGoals.map(async (goal) => {
        const stats = await milestonesService.getStatsForGoal(goal.id);
        return {
          id: goal.id,
          title: goal.title,
          status: goal.status || 'active',
          progressPercentage: goal.progressPercentage || 0,
          targetDate: goal.targetDate,
          milestonesCount: stats.total,
          milestonesCompleted: stats.completed,
        };
      })
    );

    // Get habits for this area
    const areaHabits = await db
      .select()
      .from(habits)
      .where(eq(habits.lifeArea, area))
      .orderBy(desc(habits.currentStreak));

    // Enrich habits with completion rates
    const enrichedHabits = await Promise.all(
      areaHabits.map(async (habit) => {
        const stats = await habitService.getWeeklyStats(habit.id);
        return {
          id: habit.id,
          title: habit.title,
          frequency: habit.frequency,
          currentStreak: habit.currentStreak || 0,
          completionRate: stats.completionRate,
          isActive: habit.isActive || false,
        };
      })
    );

    // Calculate stats
    const activeHabits = enrichedHabits.filter((h) => h.isActive);
    const avgStreak =
      activeHabits.length > 0
        ? Math.round(activeHabits.reduce((sum, h) => sum + h.currentStreak, 0) / activeHabits.length)
        : 0;
    const avgCompletionRate =
      activeHabits.length > 0
        ? Math.round(activeHabits.reduce((sum, h) => sum + h.completionRate, 0) / activeHabits.length)
        : 0;

    return {
      area,
      name: areaInfo.name,
      icon: areaInfo.icon,
      color: areaInfo.color,
      description: areaInfo.description,
      goals: enrichedGoals,
      habits: enrichedHabits,
      stats: {
        totalGoals: areaGoals.length,
        completedGoals: areaGoals.filter((g) => g.status === 'completed').length,
        activeGoals: areaGoals.filter((g) => g.status === 'active').length,
        totalHabits: areaHabits.length,
        activeHabits: activeHabits.length,
        avgStreak,
        avgCompletionRate,
      },
    };
  }

  /**
   * Get habit completion dashboard data
   */
  async getHabitDashboard(): Promise<{
    today: { completed: number; total: number; percentage: number };
    thisWeek: { completed: number; total: number; percentage: number };
    topStreaks: HabitStreak[];
    atRiskStreaks: HabitStreak[];
  }> {
    const today = await this.getTodaysHabitsProgress();
    const todaysHabits = await habitService.getTodaysHabits();

    // Calculate this week's progress
    const activeHabits = await db
      .select({ id: habits.id })
      .from(habits)
      .where(eq(habits.isActive, true));

    let weekCompleted = 0;
    let weekTotal = 0;

    for (const habit of activeHabits) {
      const stats = await habitService.getWeeklyStats(habit.id);
      weekCompleted += stats.completed;
      weekTotal += stats.completed + stats.missed;
    }

    const weekPercentage = weekTotal > 0 ? Math.round((weekCompleted / weekTotal) * 100) : 0;

    // Get at-risk streaks (streak > 0 but not completed today and at_risk status)
    const atRiskHabits = todaysHabits.filter(
      (h) => h.currentStreak > 0 && !h.completedToday && h.streakStatus === 'at_risk'
    );

    return {
      today,
      thisWeek: {
        completed: weekCompleted,
        total: weekTotal,
        percentage: weekPercentage,
      },
      topStreaks: await this.getTopStreaks(5),
      atRiskStreaks: atRiskHabits.map((h) => ({
        habitId: h.id,
        habitTitle: h.title,
        lifeArea: h.lifeArea || null,
        currentStreak: h.currentStreak,
        longestStreak: h.longestStreak,
      })),
    };
  }
}

export const progressService = new ProgressService();

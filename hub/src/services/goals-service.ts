/**
 * Goals Service
 *
 * Manages goals across the 6 life areas with support for milestones,
 * progress tracking, and health scoring.
 */

import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { goals, habits as habitsTable, milestones, goalReflections } from '../db/schema';
import { type LifeArea, LIFE_AREAS, isValidLifeArea } from '../constants/life-areas';

// ============================================
// TYPES
// ============================================

export type GoalType = 'achievement' | 'maintenance' | 'growth';
export type MetricType = 'boolean' | 'numeric' | 'percentage' | 'milestone';
export type GoalStatus = 'active' | 'paused' | 'completed' | 'abandoned';

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  lifeArea: LifeArea | null;
  area: string | null; // Legacy
  goalType: GoalType | null;
  metricType: MetricType | null;
  targetValue: number | null;
  currentValue: number | null;
  unit: string | null;
  startDate: string | null;
  targetDate: string | null;
  level: string | null;
  parentGoalId: string | null;
  status: GoalStatus | null;
  priority: number | null;
  motivation: string | null;
  vision: string | null;
  progressPercentage: number | null;
  reviewFrequency: string | null;
  lastReviewedAt: Date | null;
  vaultEntryId: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export interface GoalWithRelations extends Goal {
  habits: Array<{
    id: string;
    title: string;
    currentStreak: number;
    isActive: boolean;
  }>;
  milestones: Array<{
    id: string;
    title: string;
    status: string;
    targetDate: string | null;
  }>;
  reflections: Array<{
    id: string;
    content: string;
    reflectionType: string;
    createdAt: Date;
  }>;
  healthScore: number;
}

export interface CreateGoalInput {
  title: string;
  description?: string;
  lifeArea?: LifeArea;
  area?: string; // Legacy support
  goalType?: GoalType;
  metricType?: MetricType;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  startDate?: string;
  targetDate?: string;
  priority?: number;
  motivation?: string;
  vision?: string;
}

export interface UpdateGoalInput {
  title?: string;
  description?: string;
  lifeArea?: LifeArea;
  area?: string;
  goalType?: GoalType;
  metricType?: MetricType;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  startDate?: string;
  targetDate?: string | null;
  status?: GoalStatus;
  priority?: number;
  motivation?: string;
  vision?: string;
  progressPercentage?: number;
}

export interface GoalHealthReport {
  goal: Goal;
  healthScore: number;
  factors: {
    progressVsExpected: { score: number; detail: string };
    hasActiveHabits: { score: number; detail: string };
    milestoneProgress: { score: number; detail: string };
    recentActivity: { score: number; detail: string };
  };
  recommendations: string[];
  projectedCompletion: Date | null;
}

// ============================================
// SERVICE
// ============================================

class GoalsService {
  /**
   * List goals with optional filters
   */
  async list(filters?: { status?: string; area?: string; lifeArea?: LifeArea }): Promise<Goal[]> {
    const conditions = [];

    if (filters?.status) {
      conditions.push(eq(goals.status, filters.status));
    }
    if (filters?.lifeArea) {
      conditions.push(eq(goals.lifeArea, filters.lifeArea));
    }
    if (filters?.area) {
      conditions.push(eq(goals.area, filters.area));
    }

    let query = db.select().from(goals);

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const result = await query.orderBy(asc(goals.priority), asc(goals.targetDate), asc(goals.title)).limit(100);
    return result as Goal[];
  }

  /**
   * Get a goal by ID
   */
  async getById(id: string): Promise<Goal | null> {
    const [goal] = await db.select().from(goals).where(eq(goals.id, id)).limit(1);
    return (goal as Goal) || null;
  }

  /**
   * Get a goal with all its relations (habits, milestones, reflections)
   */
  async getByIdWithRelations(id: string): Promise<GoalWithRelations | null> {
    const goal = await this.getById(id);
    if (!goal) return null;

    // Get linked habits
    const linkedHabits = await db
      .select({
        id: habitsTable.id,
        title: habitsTable.title,
        currentStreak: habitsTable.currentStreak,
        isActive: habitsTable.isActive,
      })
      .from(habitsTable)
      .where(eq(habitsTable.goalId, id));

    // Get milestones
    const goalMilestones = await db
      .select({
        id: milestones.id,
        title: milestones.title,
        status: milestones.status,
        targetDate: milestones.targetDate,
      })
      .from(milestones)
      .where(eq(milestones.goalId, id))
      .orderBy(asc(milestones.orderIndex));

    // Get recent reflections
    const recentReflections = await db
      .select({
        id: goalReflections.id,
        content: goalReflections.content,
        reflectionType: goalReflections.reflectionType,
        createdAt: goalReflections.createdAt,
      })
      .from(goalReflections)
      .where(eq(goalReflections.goalId, id))
      .orderBy(desc(goalReflections.createdAt))
      .limit(5);

    // Calculate health score
    const healthScore = await this.calculateHealthScore(goal, linkedHabits, goalMilestones);

    return {
      ...goal,
      habits: linkedHabits as GoalWithRelations['habits'],
      milestones: goalMilestones as GoalWithRelations['milestones'],
      reflections: recentReflections as GoalWithRelations['reflections'],
      healthScore,
    };
  }

  /**
   * Create a new goal
   */
  async create(input: CreateGoalInput): Promise<Goal> {
    // Validate and set lifeArea
    let lifeArea: LifeArea | null = null;
    if (input.lifeArea && isValidLifeArea(input.lifeArea)) {
      lifeArea = input.lifeArea;
    }

    const [goal] = await db
      .insert(goals)
      .values({
        title: input.title,
        description: input.description,
        lifeArea,
        area: input.area,
        goalType: input.goalType || 'achievement',
        metricType: input.metricType || 'boolean',
        targetValue: input.targetValue,
        currentValue: input.currentValue ?? 0,
        unit: input.unit,
        startDate: input.startDate || new Date().toISOString().split('T')[0],
        targetDate: input.targetDate,
        priority: input.priority ?? 2,
        motivation: input.motivation,
        vision: input.vision,
        progressPercentage: 0,
      })
      .returning();

    return goal as Goal;
  }

  /**
   * Update a goal
   */
  async update(id: string, input: UpdateGoalInput): Promise<Goal | null> {
    const updateData: Record<string, unknown> = {
      ...input,
      updatedAt: new Date(),
    };

    // Validate lifeArea if provided
    if (input.lifeArea && !isValidLifeArea(input.lifeArea)) {
      delete updateData.lifeArea;
    }

    const [updated] = await db
      .update(goals)
      .set(updateData)
      .where(eq(goals.id, id))
      .returning();

    return (updated as Goal) || null;
  }

  /**
   * Update goal progress (value and percentage)
   */
  async updateProgress(
    id: string,
    currentValue: number,
    notes?: string
  ): Promise<Goal | null> {
    const goal = await this.getById(id);
    if (!goal) return null;

    // Calculate new progress percentage
    let progressPercentage = 0;
    let newStatus: GoalStatus = 'active';

    switch (goal.metricType) {
      case 'boolean':
        progressPercentage = currentValue >= 1 ? 100 : 0;
        if (currentValue >= 1) newStatus = 'completed';
        break;

      case 'numeric':
        if (goal.targetValue && goal.targetValue > 0) {
          progressPercentage = Math.min(100, (currentValue / goal.targetValue) * 100);
          if (currentValue >= goal.targetValue) newStatus = 'completed';
        }
        break;

      case 'percentage':
        progressPercentage = Math.min(100, currentValue);
        if (currentValue >= 100) newStatus = 'completed';
        break;

      case 'milestone':
        // Progress is calculated from milestones, not directly updated
        // Just update currentValue as a reference
        break;

      default:
        if (goal.targetValue && goal.targetValue > 0) {
          progressPercentage = Math.min(100, (currentValue / goal.targetValue) * 100);
          if (currentValue >= goal.targetValue) newStatus = 'completed';
        }
    }

    const updateData: Record<string, unknown> = {
      currentValue,
      progressPercentage,
      updatedAt: new Date(),
    };

    // Only change status if completing (don't override paused/abandoned)
    if (newStatus === 'completed' && goal.status === 'active') {
      updateData.status = 'completed';
      updateData.completedAt = new Date();
    }

    const [updated] = await db
      .update(goals)
      .set(updateData)
      .where(eq(goals.id, id))
      .returning();

    return (updated as Goal) || null;
  }

  /**
   * Recalculate progress from milestones (for milestone-based goals)
   */
  async recalculateProgress(id: string): Promise<Goal | null> {
    const goal = await this.getById(id);
    if (!goal) return null;

    // Get milestone stats
    const milestoneStats = await db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${milestones.status} = 'completed')::int`,
        skipped: sql<number>`count(*) filter (where ${milestones.status} = 'skipped')::int`,
      })
      .from(milestones)
      .where(eq(milestones.goalId, id));

    const stats = milestoneStats[0];
    const countable = stats.total - stats.skipped;
    const progressPercentage = countable > 0 ? Math.round((stats.completed / countable) * 100) : 0;

    const updateData: Record<string, unknown> = {
      progressPercentage,
      updatedAt: new Date(),
    };

    // Auto-complete if all milestones done
    if (progressPercentage >= 100 && goal.status === 'active') {
      updateData.status = 'completed';
      updateData.completedAt = new Date();
    }

    const [updated] = await db
      .update(goals)
      .set(updateData)
      .where(eq(goals.id, id))
      .returning();

    return (updated as Goal) || null;
  }

  /**
   * Delete a goal
   */
  async delete(id: string): Promise<boolean> {
    const result = await db.delete(goals).where(eq(goals.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get goals grouped by area (legacy)
   */
  async getByArea(): Promise<Array<{
    area: string | null;
    total: number;
    completed: number;
    active: number;
  }>> {
    const result = await db
      .select({
        area: goals.area,
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${goals.status} = 'completed')::int`,
        active: sql<number>`count(*) filter (where ${goals.status} = 'active')::int`,
      })
      .from(goals)
      .groupBy(goals.area);

    return result;
  }

  /**
   * Get goals grouped by life area
   */
  async getByLifeArea(): Promise<Array<{
    lifeArea: LifeArea | null;
    name: string;
    icon: string;
    color: string;
    total: number;
    completed: number;
    active: number;
    avgProgress: number;
  }>> {
    const result = await db
      .select({
        lifeArea: goals.lifeArea,
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${goals.status} = 'completed')::int`,
        active: sql<number>`count(*) filter (where ${goals.status} = 'active')::int`,
        avgProgress: sql<number>`coalesce(avg(${goals.progressPercentage}), 0)::real`,
      })
      .from(goals)
      .groupBy(goals.lifeArea);

    return result.map((r) => {
      const areaInfo = r.lifeArea && isValidLifeArea(r.lifeArea) ? LIFE_AREAS[r.lifeArea] : null;
      return {
        lifeArea: r.lifeArea as LifeArea | null,
        name: areaInfo?.name || 'Uncategorized',
        icon: areaInfo?.icon || '📌',
        color: areaInfo?.color || '#808080',
        total: r.total,
        completed: r.completed,
        active: r.active,
        avgProgress: Math.round(r.avgProgress),
      };
    });
  }

  /**
   * Calculate health score for a goal (0-100)
   */
  async calculateHealthScore(
    goal: Goal,
    linkedHabits?: Array<{ isActive: boolean }>,
    goalMilestones?: Array<{ status: string }>
  ): Promise<number> {
    let score = 50; // Base score
    const today = new Date();

    // Factor 1: Progress vs expected (if has deadline)
    if (goal.targetDate) {
      const targetDate = new Date(goal.targetDate);
      const startDate = goal.startDate ? new Date(goal.startDate) : goal.createdAt;
      const totalDays = Math.max(1, (targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysElapsed = Math.max(0, (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const expectedProgress = Math.min(100, (daysElapsed / totalDays) * 100);
      const actualProgress = goal.progressPercentage || 0;
      const diff = actualProgress - expectedProgress;

      if (diff >= 10) score += 20; // Ahead
      else if (diff >= 0) score += 10; // On track
      else if (diff >= -20) score -= 10; // Slightly behind
      else score -= 25; // Significantly behind
    }

    // Factor 2: Has active habits
    const goalHabits = linkedHabits || await db
      .select({ isActive: habitsTable.isActive })
      .from(habitsTable)
      .where(eq(habitsTable.goalId, goal.id));

    if (goalHabits.filter((h) => h.isActive).length > 0) {
      score += 15;
    }

    // Factor 3: Milestone progress
    const milestoneData = goalMilestones || await db
      .select({ status: milestones.status })
      .from(milestones)
      .where(eq(milestones.goalId, goal.id));

    if (milestoneData.length > 0) {
      const completed = milestoneData.filter((m) => m.status === 'completed').length;
      const rate = completed / milestoneData.length;
      score += Math.round(rate * 15);
    }

    // Factor 4: Recent activity (reflections in last 7 days)
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const recentReflections = await db
      .select({ id: goalReflections.id })
      .from(goalReflections)
      .where(
        and(
          eq(goalReflections.goalId, goal.id),
          sql`${goalReflections.createdAt} >= ${weekAgo}`
        )
      )
      .limit(1);

    if (recentReflections.length > 0) {
      score += 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get detailed health report for a goal
   */
  async getHealthReport(id: string): Promise<GoalHealthReport | null> {
    const goal = await this.getById(id);
    if (!goal) return null;

    const today = new Date();
    const factors: GoalHealthReport['factors'] = {
      progressVsExpected: { score: 0, detail: '' },
      hasActiveHabits: { score: 0, detail: '' },
      milestoneProgress: { score: 0, detail: '' },
      recentActivity: { score: 0, detail: '' },
    };
    const recommendations: string[] = [];

    // Factor 1: Progress vs expected
    if (goal.targetDate) {
      const targetDate = new Date(goal.targetDate);
      const startDate = goal.startDate ? new Date(goal.startDate) : goal.createdAt;
      const totalDays = Math.max(1, (targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysElapsed = Math.max(0, (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const expectedProgress = Math.min(100, (daysElapsed / totalDays) * 100);
      const actualProgress = goal.progressPercentage || 0;
      const diff = actualProgress - expectedProgress;

      if (diff >= 10) {
        factors.progressVsExpected = { score: 20, detail: 'Ahead of schedule' };
      } else if (diff >= 0) {
        factors.progressVsExpected = { score: 10, detail: 'On track' };
      } else if (diff >= -20) {
        factors.progressVsExpected = { score: -10, detail: 'Slightly behind schedule' };
        recommendations.push('Consider increasing effort to catch up');
      } else {
        factors.progressVsExpected = { score: -25, detail: 'Significantly behind schedule' };
        recommendations.push('Consider adjusting timeline or breaking goal into smaller steps');
      }
    } else {
      factors.progressVsExpected = { score: 0, detail: 'No target date set' };
      recommendations.push('Consider setting a target date to track progress');
    }

    // Factor 2: Has active habits
    const linkedHabits = await db
      .select({ isActive: habitsTable.isActive })
      .from(habitsTable)
      .where(eq(habitsTable.goalId, id));

    const activeHabits = linkedHabits.filter((h) => h.isActive).length;
    if (activeHabits > 0) {
      factors.hasActiveHabits = { score: 15, detail: `${activeHabits} active habit(s) linked` };
    } else {
      factors.hasActiveHabits = { score: 0, detail: 'No active habits linked' };
      recommendations.push('Link habits to this goal for consistent progress');
    }

    // Factor 3: Milestone progress
    const milestoneData = await db
      .select({ status: milestones.status })
      .from(milestones)
      .where(eq(milestones.goalId, id));

    if (milestoneData.length > 0) {
      const completed = milestoneData.filter((m) => m.status === 'completed').length;
      const rate = completed / milestoneData.length;
      const milestoneScore = Math.round(rate * 15);
      factors.milestoneProgress = {
        score: milestoneScore,
        detail: `${completed}/${milestoneData.length} milestones completed`,
      };
    } else {
      factors.milestoneProgress = { score: 0, detail: 'No milestones set' };
      recommendations.push('Break this goal into milestones for better tracking');
    }

    // Factor 4: Recent activity
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const recentReflections = await db
      .select({ id: goalReflections.id })
      .from(goalReflections)
      .where(
        and(
          eq(goalReflections.goalId, id),
          sql`${goalReflections.createdAt} >= ${weekAgo}`
        )
      );

    if (recentReflections.length > 0) {
      factors.recentActivity = { score: 10, detail: `${recentReflections.length} reflection(s) this week` };
    } else {
      factors.recentActivity = { score: 0, detail: 'No recent reflections' };
      recommendations.push('Add regular reflections to track your journey');
    }

    // Calculate total health score
    const healthScore = Math.max(
      0,
      Math.min(
        100,
        50 +
          factors.progressVsExpected.score +
          factors.hasActiveHabits.score +
          factors.milestoneProgress.score +
          factors.recentActivity.score
      )
    );

    // Calculate projected completion
    let projectedCompletion: Date | null = null;
    if (goal.targetDate && goal.progressPercentage && goal.progressPercentage > 0) {
      const startDate = goal.startDate ? new Date(goal.startDate) : goal.createdAt;
      const daysElapsed = Math.max(1, (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const progressPerDay = (goal.progressPercentage || 0) / daysElapsed;
      if (progressPerDay > 0) {
        const remainingProgress = 100 - (goal.progressPercentage || 0);
        const daysRemaining = remainingProgress / progressPerDay;
        projectedCompletion = new Date(today.getTime() + daysRemaining * 24 * 60 * 60 * 1000);
      }
    }

    return {
      goal,
      healthScore,
      factors,
      recommendations,
      projectedCompletion,
    };
  }

  /**
   * Get goals needing attention (low health score)
   */
  async getNeedingAttention(threshold: number = 50): Promise<Array<Goal & { healthScore: number }>> {
    const activeGoals = await this.list({ status: 'active' });
    const goalsWithScores: Array<Goal & { healthScore: number }> = [];

    for (const goal of activeGoals) {
      const healthScore = await this.calculateHealthScore(goal);
      if (healthScore < threshold) {
        goalsWithScores.push({ ...goal, healthScore });
      }
    }

    return goalsWithScores.sort((a, b) => a.healthScore - b.healthScore);
  }

  /**
   * Complete a goal
   */
  async complete(id: string): Promise<Goal | null> {
    const [updated] = await db
      .update(goals)
      .set({
        status: 'completed',
        progressPercentage: 100,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(goals.id, id))
      .returning();

    return (updated as Goal) || null;
  }

  /**
   * Pause a goal
   */
  async pause(id: string): Promise<Goal | null> {
    const [updated] = await db
      .update(goals)
      .set({
        status: 'paused',
        updatedAt: new Date(),
      })
      .where(eq(goals.id, id))
      .returning();

    return (updated as Goal) || null;
  }

  /**
   * Resume a paused goal
   */
  async resume(id: string): Promise<Goal | null> {
    const [updated] = await db
      .update(goals)
      .set({
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(goals.id, id))
      .returning();

    return (updated as Goal) || null;
  }

  /**
   * Abandon a goal
   */
  async abandon(id: string): Promise<Goal | null> {
    const [updated] = await db
      .update(goals)
      .set({
        status: 'abandoned',
        updatedAt: new Date(),
      })
      .where(eq(goals.id, id))
      .returning();

    return (updated as Goal) || null;
  }
}

export const goalsService = new GoalsService();

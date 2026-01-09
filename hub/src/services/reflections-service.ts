/**
 * Reflections Service
 *
 * Manages goal reflections - journaling entries that track progress,
 * obstacles, wins, and adjustments for goals.
 */

import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { goalReflections, goals } from '../db/schema';
import { type LifeArea } from '../constants/life-areas';

// ============================================
// TYPES
// ============================================

export type ReflectionType = 'progress' | 'obstacle' | 'win' | 'adjustment';
export type Sentiment = 'positive' | 'neutral' | 'negative' | 'mixed';

export interface Reflection {
  id: string;
  goalId: string;
  content: string;
  reflectionType: ReflectionType;
  sentiment: Sentiment | null;
  createdAt: Date;
}

export interface ReflectionWithGoal extends Reflection {
  goalTitle: string;
  goalLifeArea: string | null;
}

export interface CreateReflectionInput {
  content: string;
  reflectionType?: ReflectionType;
  sentiment?: Sentiment;
}

export interface ReflectionStats {
  total: number;
  byType: {
    progress: number;
    obstacle: number;
    win: number;
    adjustment: number;
  };
  bySentiment: {
    positive: number;
    neutral: number;
    negative: number;
    mixed: number;
  };
  lastReflectionDate: Date | null;
}

// ============================================
// SERVICE
// ============================================

class ReflectionsService {
  /**
   * Create a new reflection for a goal
   */
  async create(goalId: string, input: CreateReflectionInput): Promise<Reflection> {
    const [reflection] = await db
      .insert(goalReflections)
      .values({
        goalId,
        content: input.content,
        reflectionType: input.reflectionType || 'progress',
        sentiment: input.sentiment,
      })
      .returning();

    // Update goal's updatedAt to track activity
    await db
      .update(goals)
      .set({ updatedAt: new Date() })
      .where(eq(goals.id, goalId));

    return reflection as Reflection;
  }

  /**
   * Get a reflection by ID
   */
  async getById(id: string): Promise<Reflection | null> {
    const [reflection] = await db
      .select()
      .from(goalReflections)
      .where(eq(goalReflections.id, id))
      .limit(1);

    return (reflection as Reflection) || null;
  }

  /**
   * List reflections for a goal
   */
  async listByGoal(goalId: string, limit?: number): Promise<Reflection[]> {
    let query = db
      .select()
      .from(goalReflections)
      .where(eq(goalReflections.goalId, goalId))
      .orderBy(desc(goalReflections.createdAt));

    if (limit) {
      query = query.limit(limit) as typeof query;
    }

    const result = await query;
    return result as Reflection[];
  }

  /**
   * Get reflections with goal details
   */
  async listByGoalWithDetails(goalId: string): Promise<ReflectionWithGoal[]> {
    const result = await db
      .select({
        id: goalReflections.id,
        goalId: goalReflections.goalId,
        content: goalReflections.content,
        reflectionType: goalReflections.reflectionType,
        sentiment: goalReflections.sentiment,
        createdAt: goalReflections.createdAt,
        goalTitle: goals.title,
        goalLifeArea: goals.lifeArea,
      })
      .from(goalReflections)
      .innerJoin(goals, eq(goalReflections.goalId, goals.id))
      .where(eq(goalReflections.goalId, goalId))
      .orderBy(desc(goalReflections.createdAt));

    return result as ReflectionWithGoal[];
  }

  /**
   * Delete a reflection
   */
  async delete(id: string): Promise<boolean> {
    const result = await db.delete(goalReflections).where(eq(goalReflections.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get recent reflections by life area
   */
  async getRecentByArea(area: LifeArea, days: number = 7): Promise<ReflectionWithGoal[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await db
      .select({
        id: goalReflections.id,
        goalId: goalReflections.goalId,
        content: goalReflections.content,
        reflectionType: goalReflections.reflectionType,
        sentiment: goalReflections.sentiment,
        createdAt: goalReflections.createdAt,
        goalTitle: goals.title,
        goalLifeArea: goals.lifeArea,
      })
      .from(goalReflections)
      .innerJoin(goals, eq(goalReflections.goalId, goals.id))
      .where(and(eq(goals.lifeArea, area), gte(goalReflections.createdAt, startDate)))
      .orderBy(desc(goalReflections.createdAt));

    return result as ReflectionWithGoal[];
  }

  /**
   * Get all recent reflections across all goals
   */
  async getRecent(days: number = 7, limit: number = 20): Promise<ReflectionWithGoal[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await db
      .select({
        id: goalReflections.id,
        goalId: goalReflections.goalId,
        content: goalReflections.content,
        reflectionType: goalReflections.reflectionType,
        sentiment: goalReflections.sentiment,
        createdAt: goalReflections.createdAt,
        goalTitle: goals.title,
        goalLifeArea: goals.lifeArea,
      })
      .from(goalReflections)
      .innerJoin(goals, eq(goalReflections.goalId, goals.id))
      .where(gte(goalReflections.createdAt, startDate))
      .orderBy(desc(goalReflections.createdAt))
      .limit(limit);

    return result as ReflectionWithGoal[];
  }

  /**
   * Get reflection statistics for a goal
   */
  async getStatsForGoal(goalId: string): Promise<ReflectionStats> {
    const result = await db
      .select({
        total: sql<number>`count(*)::int`,
        progress: sql<number>`count(*) filter (where ${goalReflections.reflectionType} = 'progress')::int`,
        obstacle: sql<number>`count(*) filter (where ${goalReflections.reflectionType} = 'obstacle')::int`,
        win: sql<number>`count(*) filter (where ${goalReflections.reflectionType} = 'win')::int`,
        adjustment: sql<number>`count(*) filter (where ${goalReflections.reflectionType} = 'adjustment')::int`,
        positive: sql<number>`count(*) filter (where ${goalReflections.sentiment} = 'positive')::int`,
        neutral: sql<number>`count(*) filter (where ${goalReflections.sentiment} = 'neutral')::int`,
        negative: sql<number>`count(*) filter (where ${goalReflections.sentiment} = 'negative')::int`,
        mixed: sql<number>`count(*) filter (where ${goalReflections.sentiment} = 'mixed')::int`,
      })
      .from(goalReflections)
      .where(eq(goalReflections.goalId, goalId));

    // Get last reflection date
    const lastReflection = await db
      .select({ createdAt: goalReflections.createdAt })
      .from(goalReflections)
      .where(eq(goalReflections.goalId, goalId))
      .orderBy(desc(goalReflections.createdAt))
      .limit(1);

    const data = result[0];

    return {
      total: data.total,
      byType: {
        progress: data.progress,
        obstacle: data.obstacle,
        win: data.win,
        adjustment: data.adjustment,
      },
      bySentiment: {
        positive: data.positive,
        neutral: data.neutral,
        negative: data.negative,
        mixed: data.mixed,
      },
      lastReflectionDate: lastReflection[0]?.createdAt || null,
    };
  }

  /**
   * Get reflections by type for a goal
   */
  async listByType(goalId: string, type: ReflectionType): Promise<Reflection[]> {
    const result = await db
      .select()
      .from(goalReflections)
      .where(and(eq(goalReflections.goalId, goalId), eq(goalReflections.reflectionType, type)))
      .orderBy(desc(goalReflections.createdAt));

    return result as Reflection[];
  }

  /**
   * Get win reflections across all goals (for celebration/motivation)
   */
  async getWins(limit: number = 10): Promise<ReflectionWithGoal[]> {
    const result = await db
      .select({
        id: goalReflections.id,
        goalId: goalReflections.goalId,
        content: goalReflections.content,
        reflectionType: goalReflections.reflectionType,
        sentiment: goalReflections.sentiment,
        createdAt: goalReflections.createdAt,
        goalTitle: goals.title,
        goalLifeArea: goals.lifeArea,
      })
      .from(goalReflections)
      .innerJoin(goals, eq(goalReflections.goalId, goals.id))
      .where(eq(goalReflections.reflectionType, 'win'))
      .orderBy(desc(goalReflections.createdAt))
      .limit(limit);

    return result as ReflectionWithGoal[];
  }

  /**
   * Get obstacles across all goals (for coaching/intervention)
   */
  async getObstacles(limit: number = 10): Promise<ReflectionWithGoal[]> {
    const result = await db
      .select({
        id: goalReflections.id,
        goalId: goalReflections.goalId,
        content: goalReflections.content,
        reflectionType: goalReflections.reflectionType,
        sentiment: goalReflections.sentiment,
        createdAt: goalReflections.createdAt,
        goalTitle: goals.title,
        goalLifeArea: goals.lifeArea,
      })
      .from(goalReflections)
      .innerJoin(goals, eq(goalReflections.goalId, goals.id))
      .where(eq(goalReflections.reflectionType, 'obstacle'))
      .orderBy(desc(goalReflections.createdAt))
      .limit(limit);

    return result as ReflectionWithGoal[];
  }

  /**
   * Search reflections by content
   */
  async search(query: string, limit: number = 20): Promise<ReflectionWithGoal[]> {
    const searchPattern = `%${query.toLowerCase()}%`;

    const result = await db
      .select({
        id: goalReflections.id,
        goalId: goalReflections.goalId,
        content: goalReflections.content,
        reflectionType: goalReflections.reflectionType,
        sentiment: goalReflections.sentiment,
        createdAt: goalReflections.createdAt,
        goalTitle: goals.title,
        goalLifeArea: goals.lifeArea,
      })
      .from(goalReflections)
      .innerJoin(goals, eq(goalReflections.goalId, goals.id))
      .where(sql`lower(${goalReflections.content}) like ${searchPattern}`)
      .orderBy(desc(goalReflections.createdAt))
      .limit(limit);

    return result as ReflectionWithGoal[];
  }

  /**
   * Get reflection count for date range (for activity tracking)
   */
  async getCountForDateRange(startDate: Date, endDate: Date): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(goalReflections)
      .where(and(gte(goalReflections.createdAt, startDate), lte(goalReflections.createdAt, endDate)));

    return result[0].count;
  }
}

export const reflectionsService = new ReflectionsService();

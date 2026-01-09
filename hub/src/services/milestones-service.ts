/**
 * Milestones Service
 *
 * Manages goal milestones - checkpoints that track progress toward goal completion.
 * Milestones can be linked to tasks for tracking specific actions.
 */

import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { milestones, goalTasks, tasks, goals } from '../db/schema';

// ============================================
// TYPES
// ============================================

export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface Milestone {
  id: string;
  goalId: string;
  title: string;
  description: string | null;
  targetDate: string | null;
  orderIndex: number;
  status: MilestoneStatus;
  completedAt: Date | null;
  evidence: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MilestoneWithTasks extends Milestone {
  linkedTasks: Array<{
    id: string;
    title: string;
    status: string;
  }>;
}

export interface CreateMilestoneInput {
  goalId: string;
  title: string;
  description?: string;
  targetDate?: string;
  orderIndex?: number;
}

export interface UpdateMilestoneInput {
  title?: string;
  description?: string;
  targetDate?: string | null;
  orderIndex?: number;
  status?: MilestoneStatus;
}

// ============================================
// SERVICE
// ============================================

class MilestonesService {
  /**
   * Create a new milestone
   */
  async create(input: CreateMilestoneInput): Promise<Milestone> {
    // If no orderIndex provided, get the next available index
    let orderIndex = input.orderIndex;
    if (orderIndex === undefined) {
      const existing = await this.listByGoal(input.goalId);
      orderIndex = existing.length > 0 ? Math.max(...existing.map((m) => m.orderIndex)) + 1 : 0;
    }

    const [milestone] = await db
      .insert(milestones)
      .values({
        goalId: input.goalId,
        title: input.title,
        description: input.description,
        targetDate: input.targetDate,
        orderIndex,
      })
      .returning();

    return milestone as Milestone;
  }

  /**
   * Get a milestone by ID
   */
  async getById(id: string): Promise<Milestone | null> {
    const [milestone] = await db.select().from(milestones).where(eq(milestones.id, id)).limit(1);

    return (milestone as Milestone) || null;
  }

  /**
   * Get a milestone with its linked tasks
   */
  async getByIdWithTasks(id: string): Promise<MilestoneWithTasks | null> {
    const milestone = await this.getById(id);
    if (!milestone) return null;

    const linkedTasks = await this.getLinkedTasks(id);

    return {
      ...milestone,
      linkedTasks,
    };
  }

  /**
   * List all milestones for a goal, ordered by orderIndex
   */
  async listByGoal(goalId: string): Promise<Milestone[]> {
    const result = await db
      .select()
      .from(milestones)
      .where(eq(milestones.goalId, goalId))
      .orderBy(asc(milestones.orderIndex));

    return result as Milestone[];
  }

  /**
   * Update a milestone
   */
  async update(id: string, input: UpdateMilestoneInput): Promise<Milestone | null> {
    const [updated] = await db
      .update(milestones)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(milestones.id, id))
      .returning();

    return (updated as Milestone) || null;
  }

  /**
   * Delete a milestone
   */
  async delete(id: string): Promise<boolean> {
    const result = await db.delete(milestones).where(eq(milestones.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Mark a milestone as completed with optional evidence
   */
  async complete(id: string, evidence?: string): Promise<Milestone | null> {
    const [updated] = await db
      .update(milestones)
      .set({
        status: 'completed',
        completedAt: new Date(),
        evidence: evidence || null,
        updatedAt: new Date(),
      })
      .where(eq(milestones.id, id))
      .returning();

    if (updated) {
      // Trigger goal progress recalculation
      await this.updateGoalProgressFromMilestones(updated.goalId);
    }

    return (updated as Milestone) || null;
  }

  /**
   * Mark a milestone as in progress
   */
  async startProgress(id: string): Promise<Milestone | null> {
    const [updated] = await db
      .update(milestones)
      .set({
        status: 'in_progress',
        updatedAt: new Date(),
      })
      .where(eq(milestones.id, id))
      .returning();

    return (updated as Milestone) || null;
  }

  /**
   * Skip a milestone (won't contribute to goal progress)
   */
  async skip(id: string): Promise<Milestone | null> {
    const [updated] = await db
      .update(milestones)
      .set({
        status: 'skipped',
        updatedAt: new Date(),
      })
      .where(eq(milestones.id, id))
      .returning();

    if (updated) {
      await this.updateGoalProgressFromMilestones(updated.goalId);
    }

    return (updated as Milestone) || null;
  }

  /**
   * Reorder milestones for a goal
   */
  async reorder(goalId: string, milestoneIds: string[]): Promise<void> {
    // Update each milestone's orderIndex based on position in array
    for (let i = 0; i < milestoneIds.length; i++) {
      await db
        .update(milestones)
        .set({ orderIndex: i, updatedAt: new Date() })
        .where(and(eq(milestones.id, milestoneIds[i]), eq(milestones.goalId, goalId)));
    }
  }

  /**
   * Link a task to a milestone
   */
  async linkTask(milestoneId: string, taskId: string): Promise<void> {
    const milestone = await this.getById(milestoneId);
    if (!milestone) {
      throw new Error('Milestone not found');
    }

    // Check if task is already linked
    const existing = await db
      .select()
      .from(goalTasks)
      .where(eq(goalTasks.taskId, taskId))
      .limit(1);

    if (existing.length > 0) {
      // Update existing link to point to this milestone
      await db
        .update(goalTasks)
        .set({
          milestoneId,
          goalId: milestone.goalId,
        })
        .where(eq(goalTasks.taskId, taskId));
    } else {
      // Create new link
      await db.insert(goalTasks).values({
        milestoneId,
        goalId: milestone.goalId,
        taskId,
      });
    }
  }

  /**
   * Unlink a task from a milestone
   */
  async unlinkTask(milestoneId: string, taskId: string): Promise<void> {
    await db
      .delete(goalTasks)
      .where(and(eq(goalTasks.milestoneId, milestoneId), eq(goalTasks.taskId, taskId)));
  }

  /**
   * Get tasks linked to a milestone
   */
  async getLinkedTasks(
    milestoneId: string
  ): Promise<Array<{ id: string; title: string; status: string }>> {
    const result = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
      })
      .from(goalTasks)
      .innerJoin(tasks, eq(goalTasks.taskId, tasks.id))
      .where(eq(goalTasks.milestoneId, milestoneId));

    return result;
  }

  /**
   * Get milestone statistics for a goal
   */
  async getStatsForGoal(goalId: string): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    skipped: number;
    completionRate: number;
  }> {
    const result = await db
      .select({
        total: sql<number>`count(*)::int`,
        pending: sql<number>`count(*) filter (where ${milestones.status} = 'pending')::int`,
        inProgress: sql<number>`count(*) filter (where ${milestones.status} = 'in_progress')::int`,
        completed: sql<number>`count(*) filter (where ${milestones.status} = 'completed')::int`,
        skipped: sql<number>`count(*) filter (where ${milestones.status} = 'skipped')::int`,
      })
      .from(milestones)
      .where(eq(milestones.goalId, goalId));

    const data = result[0];
    const countable = data.total - data.skipped;
    const completionRate = countable > 0 ? Math.round((data.completed / countable) * 100) : 0;

    return {
      ...data,
      completionRate,
    };
  }

  /**
   * Update goal progress based on milestone completion
   * Called automatically when milestones are completed/skipped
   */
  private async updateGoalProgressFromMilestones(goalId: string): Promise<void> {
    const stats = await this.getStatsForGoal(goalId);

    // Update the goal's progress percentage
    await db
      .update(goals)
      .set({
        progressPercentage: stats.completionRate,
        updatedAt: new Date(),
      })
      .where(eq(goals.id, goalId));
  }

  /**
   * Get upcoming milestones across all goals
   */
  async getUpcoming(days: number = 7): Promise<Array<Milestone & { goalTitle: string }>> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    const futureDateStr = futureDate.toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];

    const result = await db
      .select({
        id: milestones.id,
        goalId: milestones.goalId,
        title: milestones.title,
        description: milestones.description,
        targetDate: milestones.targetDate,
        orderIndex: milestones.orderIndex,
        status: milestones.status,
        completedAt: milestones.completedAt,
        evidence: milestones.evidence,
        createdAt: milestones.createdAt,
        updatedAt: milestones.updatedAt,
        goalTitle: goals.title,
      })
      .from(milestones)
      .innerJoin(goals, eq(milestones.goalId, goals.id))
      .where(
        and(
          eq(milestones.status, 'pending'),
          sql`${milestones.targetDate} IS NOT NULL`,
          sql`${milestones.targetDate} >= ${todayStr}`,
          sql`${milestones.targetDate} <= ${futureDateStr}`
        )
      )
      .orderBy(asc(milestones.targetDate));

    return result as Array<Milestone & { goalTitle: string }>;
  }

  /**
   * Get overdue milestones
   */
  async getOverdue(): Promise<Array<Milestone & { goalTitle: string }>> {
    const todayStr = new Date().toISOString().split('T')[0];

    const result = await db
      .select({
        id: milestones.id,
        goalId: milestones.goalId,
        title: milestones.title,
        description: milestones.description,
        targetDate: milestones.targetDate,
        orderIndex: milestones.orderIndex,
        status: milestones.status,
        completedAt: milestones.completedAt,
        evidence: milestones.evidence,
        createdAt: milestones.createdAt,
        updatedAt: milestones.updatedAt,
        goalTitle: goals.title,
      })
      .from(milestones)
      .innerJoin(goals, eq(milestones.goalId, goals.id))
      .where(
        and(
          eq(milestones.status, 'pending'),
          sql`${milestones.targetDate} IS NOT NULL`,
          sql`${milestones.targetDate} < ${todayStr}`
        )
      )
      .orderBy(asc(milestones.targetDate));

    return result as Array<Milestone & { goalTitle: string }>;
  }
}

export const milestonesService = new MilestonesService();

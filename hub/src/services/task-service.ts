import { eq, and, gte, lte, desc, asc, sql, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { tasks, projects } from '../db/schema';
import { addRecurrenceGenerateJob } from '../jobs/queue';
import type { TaskStatus, TaskSource, EnergyLevel } from '../types';

// ============================================
// Types
// ============================================

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: number;
  dueDate?: Date;
  dueDateIsHard?: boolean;
  scheduledStart?: Date;
  scheduledEnd?: Date;
  source: TaskSource;
  sourceRef?: string;
  context: string;
  timeEstimateMinutes?: number;
  energyLevel?: EnergyLevel;
  waitingFor?: string;
  projectId?: string;
  parentTaskId?: string;
  recurrenceRule?: string; // RRULE format
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: number;
  dueDate?: Date | null;
  dueDateIsHard?: boolean;
  context?: string;
  timeEstimateMinutes?: number;
  energyLevel?: EnergyLevel;
  waitingFor?: string;
  projectId?: string;
  parentTaskId?: string | null; // For subtasks, null to clear
  recurrenceRule?: string | null; // RRULE format, null to clear
}

export interface TaskFilters {
  status?: TaskStatus;
  context?: string;
  source?: TaskSource;
  sourceRef?: string;
  dueBefore?: Date;
  dueAfter?: Date;
  projectId?: string;
  includeCompleted?: boolean;
  limit?: number;
  offset?: number;
}

export interface TaskWithProject {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  dueDate: Date | null;
  dueDateIsHard: boolean;
  source: string;
  sourceRef: string | null;
  context: string;
  timeEstimateMinutes: number | null;
  energyLevel: string | null;
  blockedBy: string | null;
  waitingFor: string | null;
  projectId: string | null;
  parentTaskId: string | null;
  recurrenceRule: string | null;
  recurrenceParentId: string | null;
  calendarEventId: string | null;
  scheduledStart: Date | null;
  scheduledEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  subtaskCount?: number;
  completedSubtaskCount?: number;
  project?: {
    id: string;
    name: string;
    context: string;
  } | null;
}

// ============================================
// Task Service
// ============================================

export class TaskService {
  /**
   * Create a new task
   */
  async create(input: CreateTaskInput): Promise<TaskWithProject> {
    const [task] = await db
      .insert(tasks)
      .values({
        title: input.title,
        description: input.description,
        status: input.status || 'inbox',
        priority: input.priority || 0,
        dueDate: input.dueDate,
        dueDateIsHard: input.dueDateIsHard || false,
        scheduledStart: input.scheduledStart,
        scheduledEnd: input.scheduledEnd,
        source: input.source,
        sourceRef: input.sourceRef,
        context: input.context,
        timeEstimateMinutes: input.timeEstimateMinutes,
        energyLevel: input.energyLevel,
        waitingFor: input.waitingFor,
        projectId: input.projectId,
        parentTaskId: input.parentTaskId,
        recurrenceRule: input.recurrenceRule,
      })
      .returning();

    return this.getById(task.id) as Promise<TaskWithProject>;
  }

  /**
   * Get a task by ID
   */
  async getById(id: string): Promise<TaskWithProject | null> {
    const result = await db
      .select({
        task: tasks,
        project: {
          id: projects.id,
          name: projects.name,
          context: projects.context,
        },
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(eq(tasks.id, id))
      .limit(1);

    if (result.length === 0) return null;

    const { task, project } = result[0];

    // Get subtask counts
    const counts = await this.getSubtaskCounts(task.id);

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      dueDateIsHard: task.dueDateIsHard,
      source: task.source,
      sourceRef: task.sourceRef,
      context: task.context,
      timeEstimateMinutes: task.timeEstimateMinutes,
      energyLevel: task.energyLevel,
      blockedBy: task.blockedBy,
      waitingFor: task.waitingFor,
      projectId: task.projectId,
      parentTaskId: task.parentTaskId,
      recurrenceRule: task.recurrenceRule,
      recurrenceParentId: task.recurrenceParentId,
      calendarEventId: task.calendarEventId,
      scheduledStart: task.scheduledStart,
      scheduledEnd: task.scheduledEnd,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      completedAt: task.completedAt,
      subtaskCount: counts.total,
      completedSubtaskCount: counts.completed,
      project: project?.id ? project : null,
    };
  }

  /**
   * List tasks with optional filters
   */
  async list(filters: TaskFilters = {}): Promise<TaskWithProject[]> {
    const conditions = [];

    if (filters.status) {
      conditions.push(eq(tasks.status, filters.status));
    }

    if (filters.context) {
      conditions.push(eq(tasks.context, filters.context));
    }

    if (filters.source) {
      conditions.push(eq(tasks.source, filters.source));
    }

    if (filters.sourceRef) {
      conditions.push(eq(tasks.sourceRef, filters.sourceRef));
    }

    if (filters.projectId) {
      conditions.push(eq(tasks.projectId, filters.projectId));
    }

    if (filters.dueBefore) {
      conditions.push(lte(tasks.dueDate, filters.dueBefore));
    }

    if (filters.dueAfter) {
      conditions.push(gte(tasks.dueDate, filters.dueAfter));
    }

    if (!filters.includeCompleted) {
      conditions.push(
        and(
          sql`${tasks.status} != 'done'`,
          sql`${tasks.status} != 'archived'`
        )!
      );
    }

    // Apply pagination defaults to prevent timeouts on large datasets
    // Note: Railway has a ~3s edge timeout, so keep default limit low
    const limit = filters.limit ?? 30; // Default 30 tasks max
    const offset = filters.offset ?? 0;

    const result = await db
      .select({
        task: tasks,
        project: {
          id: projects.id,
          name: projects.name,
          context: projects.context,
        },
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
        desc(tasks.priority),
        asc(tasks.dueDate),
        desc(tasks.createdAt)
      )
      .limit(limit)
      .offset(offset);

    const mappedTasks = result.map(({ task, project }) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      dueDateIsHard: task.dueDateIsHard,
      source: task.source,
      sourceRef: task.sourceRef,
      context: task.context,
      timeEstimateMinutes: task.timeEstimateMinutes,
      energyLevel: task.energyLevel,
      blockedBy: task.blockedBy,
      waitingFor: task.waitingFor,
      projectId: task.projectId,
      parentTaskId: task.parentTaskId,
      recurrenceRule: task.recurrenceRule,
      recurrenceParentId: task.recurrenceParentId,
      calendarEventId: task.calendarEventId,
      scheduledStart: task.scheduledStart,
      scheduledEnd: task.scheduledEnd,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      completedAt: task.completedAt,
      project: project?.id ? project : null,
    }));

    // Augment with subtask counts
    return this.augmentWithSubtaskCounts(mappedTasks);
  }

  /**
   * Get today's tasks
   */
  async getToday(): Promise<TaskWithProject[]> {
    return this.list({ status: 'today' });
  }

  /**
   * Get inbox tasks
   */
  async getInbox(): Promise<TaskWithProject[]> {
    return this.list({ status: 'inbox' });
  }

  /**
   * Get upcoming tasks (due within N days)
   */
  async getUpcoming(days: number = 7): Promise<TaskWithProject[]> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const result = await db
      .select({
        task: tasks,
        project: {
          id: projects.id,
          name: projects.name,
          context: projects.context,
        },
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        and(
          gte(tasks.dueDate, now),
          lte(tasks.dueDate, futureDate),
          sql`${tasks.status} NOT IN ('done', 'archived')`
        )
      )
      .orderBy(asc(tasks.dueDate));

    const mappedTasks = result.map(({ task, project }) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      dueDateIsHard: task.dueDateIsHard,
      source: task.source,
      sourceRef: task.sourceRef,
      context: task.context,
      timeEstimateMinutes: task.timeEstimateMinutes,
      energyLevel: task.energyLevel,
      blockedBy: task.blockedBy,
      waitingFor: task.waitingFor,
      projectId: task.projectId,
      parentTaskId: task.parentTaskId,
      recurrenceRule: task.recurrenceRule,
      recurrenceParentId: task.recurrenceParentId,
      calendarEventId: task.calendarEventId,
      scheduledStart: task.scheduledStart,
      scheduledEnd: task.scheduledEnd,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      completedAt: task.completedAt,
      project: project?.id ? project : null,
    }));

    return this.augmentWithSubtaskCounts(mappedTasks);
  }

  /**
   * Get tasks due within a date range
   */
  async getDueInRange(startDate: Date, endDate: Date): Promise<TaskWithProject[]> {
    return this.list({
      dueAfter: startDate,
      dueBefore: endDate,
    });
  }

  /**
   * Get overdue tasks
   */
  async getOverdue(): Promise<TaskWithProject[]> {
    const now = new Date();
    const result = await db
      .select({
        task: tasks,
        project: {
          id: projects.id,
          name: projects.name,
          context: projects.context,
        },
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        and(
          lte(tasks.dueDate, now),
          sql`${tasks.status} NOT IN ('done', 'archived')`
        )
      )
      .orderBy(asc(tasks.dueDate));

    const mappedTasks = result.map(({ task, project }) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      dueDateIsHard: task.dueDateIsHard,
      source: task.source,
      sourceRef: task.sourceRef,
      context: task.context,
      timeEstimateMinutes: task.timeEstimateMinutes,
      energyLevel: task.energyLevel,
      blockedBy: task.blockedBy,
      waitingFor: task.waitingFor,
      projectId: task.projectId,
      parentTaskId: task.parentTaskId,
      recurrenceRule: task.recurrenceRule,
      recurrenceParentId: task.recurrenceParentId,
      calendarEventId: task.calendarEventId,
      scheduledStart: task.scheduledStart,
      scheduledEnd: task.scheduledEnd,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      completedAt: task.completedAt,
      project: project?.id ? project : null,
    }));

    return this.augmentWithSubtaskCounts(mappedTasks);
  }

  /**
   * Update a task
   */
  async update(id: string, input: UpdateTaskInput): Promise<TaskWithProject | null> {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.status !== undefined) {
      updateData.status = input.status;
      // Auto-set completedAt when status changes to/from 'done'
      if (input.status === 'done') {
        updateData.completedAt = new Date();
      } else {
        updateData.completedAt = null;
      }
    }
    if (input.priority !== undefined) updateData.priority = input.priority;
    if (input.dueDate !== undefined) updateData.dueDate = input.dueDate;
    if (input.dueDateIsHard !== undefined) updateData.dueDateIsHard = input.dueDateIsHard;
    if (input.context !== undefined) updateData.context = input.context;
    if (input.timeEstimateMinutes !== undefined) updateData.timeEstimateMinutes = input.timeEstimateMinutes;
    if (input.energyLevel !== undefined) updateData.energyLevel = input.energyLevel;
    if (input.waitingFor !== undefined) updateData.waitingFor = input.waitingFor;
    if (input.projectId !== undefined) updateData.projectId = input.projectId;
    if (input.recurrenceRule !== undefined) updateData.recurrenceRule = input.recurrenceRule;

    const [updated] = await db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, id))
      .returning();

    if (!updated) return null;
    return this.getById(id);
  }

  /**
   * Complete a task
   */
  async complete(id: string): Promise<TaskWithProject | null> {
    const [updated] = await db
      .update(tasks)
      .set({
        status: 'done',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, id))
      .returning();

    if (!updated) return null;

    // If this is a recurring task, trigger generation of next instance
    if (updated.recurrenceRule) {
      try {
        await addRecurrenceGenerateJob({
          taskId: id,
          trigger: 'completion',
        });
        console.log(`[TaskService] Queued recurrence generation for task ${id}`);
      } catch (error) {
        // Log but don't fail - the batch job will catch it later
        console.error(`[TaskService] Failed to queue recurrence generation:`, error);
      }
    }

    return this.getById(id);
  }

  /**
   * Reopen a completed task
   */
  async reopen(id: string): Promise<TaskWithProject | null> {
    const [updated] = await db
      .update(tasks)
      .set({
        status: 'inbox',
        completedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, id))
      .returning();

    if (!updated) return null;
    return this.getById(id);
  }

  /**
   * Archive a task
   */
  async archive(id: string): Promise<TaskWithProject | null> {
    const [updated] = await db
      .update(tasks)
      .set({
        status: 'archived',
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, id))
      .returning();

    if (!updated) return null;
    return this.getById(id);
  }

  /**
   * Delete a task permanently
   */
  async delete(id: string): Promise<boolean> {
    const result = await db.delete(tasks).where(eq(tasks.id, id)).returning();
    return result.length > 0;
  }

  /**
   * Move task to today
   */
  async moveToToday(id: string): Promise<TaskWithProject | null> {
    return this.update(id, { status: 'today' });
  }

  /**
   * Move task to inbox
   */
  async moveToInbox(id: string): Promise<TaskWithProject | null> {
    return this.update(id, { status: 'inbox' });
  }

  /**
   * Get task counts by status
   */
  async getCounts(): Promise<Record<string, number>> {
    const result = await db
      .select({
        status: tasks.status,
        count: sql<number>`count(*)::int`,
      })
      .from(tasks)
      .groupBy(tasks.status);

    const counts: Record<string, number> = {
      inbox: 0,
      today: 0,
      upcoming: 0,
      waiting: 0,
      someday: 0,
      done: 0,
      archived: 0,
    };

    for (const row of result) {
      counts[row.status] = row.count;
    }

    return counts;
  }

  /**
   * Bulk update task statuses
   */
  async bulkUpdateStatus(ids: string[], status: TaskStatus): Promise<number> {
    if (ids.length === 0) return 0;

    const result = await db
      .update(tasks)
      .set({
        status,
        updatedAt: new Date(),
        ...(status === 'done' ? { completedAt: new Date() } : {}),
      })
      .where(inArray(tasks.id, ids))
      .returning();

    return result.length;
  }

  /**
   * Get tasks completed today
   */
  async getCompletedToday(): Promise<TaskWithProject[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await db
      .select({
        task: tasks,
        project: {
          id: projects.id,
          name: projects.name,
          context: projects.context,
        },
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        and(
          eq(tasks.status, 'done'),
          gte(tasks.completedAt, today)
        )
      )
      .orderBy(desc(tasks.completedAt));

    const mappedTasks = result.map(({ task, project }) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      dueDateIsHard: task.dueDateIsHard,
      source: task.source,
      sourceRef: task.sourceRef,
      context: task.context,
      timeEstimateMinutes: task.timeEstimateMinutes,
      energyLevel: task.energyLevel,
      blockedBy: task.blockedBy,
      waitingFor: task.waitingFor,
      projectId: task.projectId,
      parentTaskId: task.parentTaskId,
      recurrenceRule: task.recurrenceRule,
      recurrenceParentId: task.recurrenceParentId,
      calendarEventId: task.calendarEventId,
      scheduledStart: task.scheduledStart,
      scheduledEnd: task.scheduledEnd,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      completedAt: task.completedAt,
      project: project?.id ? project : null,
    }));

    return this.augmentWithSubtaskCounts(mappedTasks);
  }

  /**
   * Get tasks completed since a given date
   */
  async getCompletedSince(since: Date): Promise<TaskWithProject[]> {
    const result = await db
      .select({
        task: tasks,
        project: {
          id: projects.id,
          name: projects.name,
          context: projects.context,
        },
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        and(
          eq(tasks.status, 'done'),
          gte(tasks.completedAt, since)
        )
      )
      .orderBy(desc(tasks.completedAt));

    const mappedTasks = result.map(({ task, project }) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      dueDateIsHard: task.dueDateIsHard,
      source: task.source,
      sourceRef: task.sourceRef,
      context: task.context,
      timeEstimateMinutes: task.timeEstimateMinutes,
      energyLevel: task.energyLevel,
      blockedBy: task.blockedBy,
      waitingFor: task.waitingFor,
      projectId: task.projectId,
      parentTaskId: task.parentTaskId,
      recurrenceRule: task.recurrenceRule,
      recurrenceParentId: task.recurrenceParentId,
      calendarEventId: task.calendarEventId,
      scheduledStart: task.scheduledStart,
      scheduledEnd: task.scheduledEnd,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      completedAt: task.completedAt,
      project: project?.id ? project : null,
    }));

    return this.augmentWithSubtaskCounts(mappedTasks);
  }

  /**
   * Schedule a task with start/end times
   */
  async schedule(id: string, scheduledStart: Date, scheduledEnd: Date, calendarEventId?: string): Promise<TaskWithProject | null> {
    const [updated] = await db
      .update(tasks)
      .set({
        scheduledStart,
        scheduledEnd,
        calendarEventId,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, id))
      .returning();

    if (!updated) return null;
    return this.getById(id);
  }

  /**
   * Unschedule a task
   */
  async unschedule(id: string): Promise<TaskWithProject | null> {
    const [updated] = await db
      .update(tasks)
      .set({
        scheduledStart: null,
        scheduledEnd: null,
        calendarEventId: null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, id))
      .returning();

    if (!updated) return null;
    return this.getById(id);
  }

  /**
   * Get scheduled tasks for a date range
   */
  async getScheduled(startDate: Date, endDate: Date): Promise<TaskWithProject[]> {
    const result = await db
      .select({
        task: tasks,
        project: {
          id: projects.id,
          name: projects.name,
          context: projects.context,
        },
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        and(
          gte(tasks.scheduledStart, startDate),
          lte(tasks.scheduledStart, endDate),
          sql`${tasks.status} NOT IN ('done', 'archived')`
        )
      )
      .orderBy(asc(tasks.scheduledStart));

    const mappedTasks = result.map(({ task, project }) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      dueDateIsHard: task.dueDateIsHard,
      source: task.source,
      sourceRef: task.sourceRef,
      context: task.context,
      timeEstimateMinutes: task.timeEstimateMinutes,
      energyLevel: task.energyLevel,
      blockedBy: task.blockedBy,
      waitingFor: task.waitingFor,
      projectId: task.projectId,
      parentTaskId: task.parentTaskId,
      recurrenceRule: task.recurrenceRule,
      recurrenceParentId: task.recurrenceParentId,
      calendarEventId: task.calendarEventId,
      scheduledStart: task.scheduledStart,
      scheduledEnd: task.scheduledEnd,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      completedAt: task.completedAt,
      project: project?.id ? project : null,
    }));

    return this.augmentWithSubtaskCounts(mappedTasks);
  }

  // ============================================
  // Subtask Methods
  // ============================================

  /**
   * Get all subtasks for a parent task
   */
  async getSubtasks(parentTaskId: string): Promise<TaskWithProject[]> {
    const results = await db
      .select({
        task: tasks,
        project: {
          id: projects.id,
          name: projects.name,
          context: projects.context,
        },
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(eq(tasks.parentTaskId, parentTaskId))
      .orderBy(asc(tasks.createdAt));

    return results.map(({ task, project }) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      dueDateIsHard: task.dueDateIsHard,
      source: task.source,
      sourceRef: task.sourceRef,
      context: task.context,
      timeEstimateMinutes: task.timeEstimateMinutes,
      energyLevel: task.energyLevel,
      blockedBy: task.blockedBy,
      waitingFor: task.waitingFor,
      projectId: task.projectId,
      parentTaskId: task.parentTaskId,
      recurrenceRule: task.recurrenceRule,
      recurrenceParentId: task.recurrenceParentId,
      calendarEventId: task.calendarEventId,
      scheduledStart: task.scheduledStart,
      scheduledEnd: task.scheduledEnd,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      completedAt: task.completedAt,
      project: project?.id ? project : null,
    }));
  }

  /**
   * Create a subtask for a parent task
   * Validates that:
   * - Parent task exists
   * - Parent task is not itself a subtask (max 1 level deep)
   */
  async createSubtask(parentTaskId: string, input: CreateTaskInput): Promise<TaskWithProject> {
    // Verify parent task exists
    const parent = await this.getById(parentTaskId);
    if (!parent) {
      throw new Error('Parent task not found');
    }

    // Prevent nesting beyond 1 level - subtasks cannot have subtasks
    if (parent.parentTaskId) {
      throw new Error('Subtasks cannot have subtasks (max 1 level deep)');
    }

    // Create the subtask with parent reference
    // Inherit context and projectId from parent if not specified
    const subtaskInput: CreateTaskInput = {
      ...input,
      parentTaskId,
      context: input.context || parent.context,
      projectId: input.projectId ?? parent.projectId ?? undefined,
    };

    return this.create(subtaskInput);
  }

  /**
   * Get subtask counts for a task
   */
  async getSubtaskCounts(taskId: string): Promise<{ total: number; completed: number }> {
    const result = await db
      .select({
        total: sql<number>`COUNT(*)::int`,
        completed: sql<number>`COUNT(*) FILTER (WHERE ${tasks.status} = 'done')::int`,
      })
      .from(tasks)
      .where(eq(tasks.parentTaskId, taskId));

    return {
      total: result[0]?.total ?? 0,
      completed: result[0]?.completed ?? 0,
    };
  }

  /**
   * Get subtask counts for multiple tasks in a single query
   */
  async getBulkSubtaskCounts(taskIds: string[]): Promise<Map<string, { total: number; completed: number }>> {
    if (taskIds.length === 0) {
      return new Map();
    }

    const result = await db
      .select({
        parentTaskId: tasks.parentTaskId,
        total: sql<number>`COUNT(*)::int`,
        completed: sql<number>`COUNT(*) FILTER (WHERE ${tasks.status} = 'done')::int`,
      })
      .from(tasks)
      .where(inArray(tasks.parentTaskId, taskIds))
      .groupBy(tasks.parentTaskId);

    const countsMap = new Map<string, { total: number; completed: number }>();
    for (const row of result) {
      if (row.parentTaskId) {
        countsMap.set(row.parentTaskId, {
          total: row.total ?? 0,
          completed: row.completed ?? 0,
        });
      }
    }

    return countsMap;
  }

  /**
   * Augment tasks with subtask counts
   */
  async augmentWithSubtaskCounts(tasksToAugment: TaskWithProject[]): Promise<TaskWithProject[]> {
    const taskIds = tasksToAugment.map(t => t.id);
    const countsMap = await this.getBulkSubtaskCounts(taskIds);

    return tasksToAugment.map(task => {
      const counts = countsMap.get(task.id);
      return {
        ...task,
        subtaskCount: counts?.total ?? 0,
        completedSubtaskCount: counts?.completed ?? 0,
      };
    });
  }
}

// Export singleton instance
export const taskService = new TaskService();

import { Hono } from 'hono';
import { z } from 'zod';
import { taskService } from '../../services/task-service';
import { schedulingService } from '../../services/scheduling-service';
import { taskArchiveService } from '../../services/task-archive-service';
import { AppError, ValidationError, NotFoundError } from '../middleware/error-handler';
import type { TaskStatus, TaskSource, EnergyLevel } from '../../types';

const tasksRouter = new Hono();

// ============================================
// Validation Schemas
// ============================================

const taskStatusEnum = z.enum(['inbox', 'today', 'upcoming', 'waiting', 'someday', 'done', 'archived']);
const taskSourceEnum = z.enum(['email', 'canvas', 'meeting', 'recording', 'manual', 'calendar', 'remarkable']);
const energyLevelEnum = z.enum(['high', 'low', 'admin']);

const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  status: taskStatusEnum.optional(),
  priority: z.number().int().min(0).max(4).optional(),
  dueDate: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  dueDateIsHard: z.boolean().optional(),
  source: taskSourceEnum,
  sourceRef: z.string().optional(),
  context: z.string().min(1, 'Context is required'),
  timeEstimateMinutes: z.number().int().positive().optional(),
  energyLevel: energyLevelEnum.optional(),
  waitingFor: z.string().optional(),
  projectId: z.string().uuid().optional(),
  parentTaskId: z.string().uuid().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: taskStatusEnum.optional(),
  priority: z.number().int().min(0).max(4).optional(),
  dueDate: z.string().datetime().nullable().optional().transform(val => val === null ? null : val ? new Date(val) : undefined),
  dueDateIsHard: z.boolean().optional(),
  context: z.string().min(1).optional(),
  timeEstimateMinutes: z.number().int().positive().optional(),
  energyLevel: energyLevelEnum.optional(),
  waitingFor: z.string().optional(),
  projectId: z.string().uuid().nullable().optional(),
});

// Helper to parse date or datetime strings
const dateStringToDate = (val: string | undefined): Date | undefined => {
  if (!val) return undefined;
  // If it's just a date (YYYY-MM-DD), add time component
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return new Date(val + 'T00:00:00.000Z');
  }
  return new Date(val);
};

const listFiltersSchema = z.object({
  status: taskStatusEnum.optional(),
  context: z.string().optional(),
  source: taskSourceEnum.optional(),
  dueBefore: z.string().optional().transform(dateStringToDate),
  dueAfter: z.string().optional().transform(dateStringToDate),
  projectId: z.string().uuid().optional(),
  includeCompleted: z.string().optional().transform(val => val === 'true'),
});

const scheduleTaskSchema = z.object({
  startTime: z.string().datetime().transform(val => new Date(val)),
  endTime: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  createCalendarEvent: z.boolean().optional().default(true),
});

// ============================================
// Routes
// ============================================

/**
 * GET /api/tasks
 * List tasks with optional filters
 */
tasksRouter.get('/', async (c) => {
  const query = c.req.query();
  const parseResult = listFiltersSchema.safeParse(query);
  
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.message);
  }

  const tasks = await taskService.list(parseResult.data);
  
  return c.json({
    success: true,
    data: tasks,
    count: tasks.length,
  });
});

/**
 * GET /api/tasks/today
 * Get today's tasks
 */
tasksRouter.get('/today', async (c) => {
  const tasks = await taskService.getToday();
  return c.json({
    success: true,
    data: tasks,
    count: tasks.length,
  });
});

/**
 * GET /api/tasks/inbox
 * Get inbox tasks
 */
tasksRouter.get('/inbox', async (c) => {
  const tasks = await taskService.getInbox();
  return c.json({
    success: true,
    data: tasks,
    count: tasks.length,
  });
});

/**
 * GET /api/tasks/overdue
 * Get overdue tasks
 */
tasksRouter.get('/overdue', async (c) => {
  const tasks = await taskService.getOverdue();
  return c.json({
    success: true,
    data: tasks,
    count: tasks.length,
  });
});

/**
 * GET /api/tasks/counts
 * Get task counts by status
 */
tasksRouter.get('/counts', async (c) => {
  const counts = await taskService.getCounts();
  return c.json({
    success: true,
    data: counts,
  });
});

/**
 * GET /api/tasks/upcoming
 * Get tasks due in the next N days (default 7)
 */
tasksRouter.get('/upcoming', async (c) => {
  const daysParam = c.req.query('days');
  const days = daysParam ? parseInt(daysParam, 10) : 7;

  if (isNaN(days) || days < 1 || days > 365) {
    throw new ValidationError('Days must be a number between 1 and 365');
  }

  const tasks = await taskService.getUpcoming(days);
  return c.json({
    success: true,
    data: tasks,
    count: tasks.length,
  });
});

/**
 * GET /api/tasks/archived
 * Get archived tasks from vault
 */
tasksRouter.get('/archived', async (c) => {
  const context = c.req.query('context');
  const limitParam = c.req.query('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 50;

  const entries = await taskArchiveService.getArchivedTasks(context, limit);

  return c.json({
    success: true,
    data: entries,
    count: entries.length,
  });
});

/**
 * GET /api/tasks/:id
 * Get a single task by ID
 */
tasksRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  
  // Validate UUID format
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid task ID format');
  }

  const task = await taskService.getById(id);
  
  if (!task) {
    throw new NotFoundError('Task');
  }

  return c.json({
    success: true,
    data: task,
  });
});

/**
 * POST /api/tasks
 * Create a new task
 */
tasksRouter.post('/', async (c) => {
  const body = await c.req.json();
  const parseResult = createTaskSchema.safeParse(body);
  
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
  }

  const task = await taskService.create(parseResult.data as any);
  
  return c.json({
    success: true,
    data: task,
    message: 'Task created successfully',
  }, 201);
});

/**
 * PATCH /api/tasks/:id
 * Update an existing task
 */
tasksRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');
  
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid task ID format');
  }

  const body = await c.req.json();
  const parseResult = updateTaskSchema.safeParse(body);
  
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
  }

  // Filter out undefined values
  const updateData = Object.fromEntries(
    Object.entries(parseResult.data).filter(([_, v]) => v !== undefined)
  );

  if (Object.keys(updateData).length === 0) {
    throw new ValidationError('No valid fields to update');
  }

  const task = await taskService.update(id, updateData as any);
  
  if (!task) {
    throw new NotFoundError('Task');
  }

  return c.json({
    success: true,
    data: task,
    message: 'Task updated successfully',
  });
});

/**
 * POST /api/tasks/:id/complete
 * Mark a task as complete
 */
tasksRouter.post('/:id/complete', async (c) => {
  const id = c.req.param('id');
  
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid task ID format');
  }

  const task = await taskService.complete(id);
  
  if (!task) {
    throw new NotFoundError('Task');
  }

  return c.json({
    success: true,
    data: task,
    message: 'Task marked as complete',
  });
});

/**
 * POST /api/tasks/:id/reopen
 * Reopen a completed task
 */
tasksRouter.post('/:id/reopen', async (c) => {
  const id = c.req.param('id');
  
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid task ID format');
  }

  const task = await taskService.reopen(id);
  
  if (!task) {
    throw new NotFoundError('Task');
  }

  return c.json({
    success: true,
    data: task,
    message: 'Task reopened',
  });
});

/**
 * POST /api/tasks/:id/archive
 * Archive a task
 */
tasksRouter.post('/:id/archive', async (c) => {
  const id = c.req.param('id');
  
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid task ID format');
  }

  const task = await taskService.archive(id);
  
  if (!task) {
    throw new NotFoundError('Task');
  }

  return c.json({
    success: true,
    data: task,
    message: 'Task archived',
  });
});

/**
 * POST /api/tasks/:id/schedule
 * Schedule a task for a specific time
 */
tasksRouter.post('/:id/schedule', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid task ID format');
  }

  const body = await c.req.json();
  const parseResult = scheduleTaskSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
  }

  const result = await schedulingService.scheduleTask({
    taskId: id,
    startTime: parseResult.data.startTime,
    endTime: parseResult.data.endTime,
    createCalendarEvent: parseResult.data.createCalendarEvent,
  });

  if (!result.success) {
    throw new NotFoundError('Task');
  }

  return c.json({
    success: true,
    data: result,
    message: 'Task scheduled successfully',
  });
});

/**
 * POST /api/tasks/:id/unschedule
 * Remove scheduling from a task
 */
tasksRouter.post('/:id/unschedule', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid task ID format');
  }

  const result = await schedulingService.unscheduleTask(id);

  if (!result.success) {
    throw new NotFoundError('Task');
  }

  return c.json({
    success: true,
    message: 'Task unscheduled successfully',
  });
});

/**
 * DELETE /api/tasks/:id
 * Delete a task permanently
 */
tasksRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid task ID format');
  }

  const deleted = await taskService.delete(id);
  
  if (!deleted) {
    throw new NotFoundError('Task');
  }

  return c.json({
    success: true,
    message: 'Task deleted permanently',
  });
});

/**
 * POST /api/tasks/bulk/status
 * Bulk update task statuses
 */
tasksRouter.post('/bulk/status', async (c) => {
  const body = await c.req.json();

  const schema = z.object({
    ids: z.array(z.string().uuid()).min(1),
    status: taskStatusEnum,
  });

  const parseResult = schema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
  }

  const count = await taskService.bulkUpdateStatus(
    parseResult.data.ids,
    parseResult.data.status as TaskStatus
  );

  return c.json({
    success: true,
    message: `Updated ${count} tasks`,
    count,
  });
});

/**
 * POST /api/tasks/:id/archive-to-vault
 * Archive a completed task to the vault
 */
tasksRouter.post('/:id/archive-to-vault', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid task ID format');
  }

  try {
    const result = await taskArchiveService.archiveTask(id);

    if (!result) {
      throw new NotFoundError('Task');
    }

    return c.json({
      success: true,
      data: result,
      message: 'Task archived to vault',
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('must be completed')) {
      throw new ValidationError(error.message);
    }
    throw error;
  }
});

/**
 * POST /api/tasks/archive-completed
 * Archive all completed tasks older than N days to the vault
 */
tasksRouter.post('/archive-completed', async (c) => {
  const daysParam = c.req.query('days');
  const days = daysParam ? parseInt(daysParam, 10) : 1;

  if (isNaN(days) || days < 0 || days > 365) {
    throw new ValidationError('Days must be a number between 0 and 365');
  }

  const result = await taskArchiveService.archiveCompletedTasks(days);

  return c.json({
    success: true,
    data: result,
    message: `Archived ${result.tasksArchived} tasks to vault`,
  });
});

export { tasksRouter };

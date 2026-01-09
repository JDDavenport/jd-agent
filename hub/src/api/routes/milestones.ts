/**
 * Milestones API Routes
 *
 * Endpoints for managing goal milestones - checkpoints that track progress toward goals.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { milestonesService } from '../../services/milestones-service';
import { ValidationError, NotFoundError } from '../middleware/error-handler';

const milestonesRouter = new Hono();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createSchema = z.object({
  goalId: z.string().uuid('Invalid goal ID'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  targetDate: z.string().optional(),
  orderIndex: z.number().int().min(0).optional(),
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  targetDate: z.string().optional().nullable(),
  orderIndex: z.number().int().min(0).optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'skipped']).optional(),
});

const completeSchema = z.object({
  evidence: z.string().optional(),
});

const linkTaskSchema = z.object({
  taskId: z.string().uuid('Invalid task ID'),
});

const reorderSchema = z.object({
  goalId: z.string().uuid('Invalid goal ID'),
  milestoneIds: z.array(z.string().uuid('Invalid milestone ID')),
});

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/milestones
 * List milestones for a goal
 */
milestonesRouter.get('/', async (c) => {
  // Accept both 'goal_id' and 'goalId' for compatibility
  const goalId = c.req.query('goalId') || c.req.query('goal_id');

  if (!goalId) {
    throw new ValidationError('goalId query parameter is required');
  }

  const milestones = await milestonesService.listByGoal(goalId);

  return c.json({
    success: true,
    data: milestones,
    count: milestones.length,
  });
});

/**
 * GET /api/milestones/upcoming
 * Get upcoming milestones across all goals
 */
milestonesRouter.get('/upcoming', async (c) => {
  const days = parseInt(c.req.query('days') || '7', 10);
  const upcoming = await milestonesService.getUpcoming(days);

  return c.json({
    success: true,
    data: upcoming,
    count: upcoming.length,
  });
});

/**
 * GET /api/milestones/overdue
 * Get overdue milestones
 */
milestonesRouter.get('/overdue', async (c) => {
  const overdue = await milestonesService.getOverdue();

  return c.json({
    success: true,
    data: overdue,
    count: overdue.length,
  });
});

/**
 * GET /api/milestones/:id
 * Get a single milestone
 */
milestonesRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const withTasks = c.req.query('tasks') === 'true';

  const milestone = withTasks
    ? await milestonesService.getByIdWithTasks(id)
    : await milestonesService.getById(id);

  if (!milestone) {
    throw new NotFoundError('Milestone');
  }

  return c.json({ success: true, data: milestone });
});

/**
 * POST /api/milestones
 * Create a new milestone
 */
milestonesRouter.post('/', async (c) => {
  const body = await c.req.json();
  const parseResult = createSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const milestone = await milestonesService.create(parseResult.data);

  return c.json(
    {
      success: true,
      data: milestone,
      message: 'Milestone created',
    },
    201
  );
});

/**
 * PATCH /api/milestones/:id
 * Update a milestone
 */
milestonesRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parseResult = updateSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const milestone = await milestonesService.update(id, parseResult.data);

  if (!milestone) {
    throw new NotFoundError('Milestone');
  }

  return c.json({
    success: true,
    data: milestone,
    message: 'Milestone updated',
  });
});

/**
 * DELETE /api/milestones/:id
 * Delete a milestone
 */
milestonesRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = await milestonesService.delete(id);

  if (!deleted) {
    throw new NotFoundError('Milestone');
  }

  return c.json({ success: true, message: 'Milestone deleted' });
});

/**
 * POST /api/milestones/:id/complete
 * Mark a milestone as completed
 */
milestonesRouter.post('/:id/complete', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));
  const parseResult = completeSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const milestone = await milestonesService.complete(id, parseResult.data.evidence);

  if (!milestone) {
    throw new NotFoundError('Milestone');
  }

  // Get goal progress for response
  const stats = await milestonesService.getStatsForGoal(milestone.goalId);

  return c.json({
    success: true,
    data: {
      milestone,
      goalProgress: stats.completionRate,
    },
    message: 'Milestone completed',
  });
});

/**
 * POST /api/milestones/:id/start
 * Mark a milestone as in progress
 */
milestonesRouter.post('/:id/start', async (c) => {
  const id = c.req.param('id');
  const milestone = await milestonesService.startProgress(id);

  if (!milestone) {
    throw new NotFoundError('Milestone');
  }

  return c.json({
    success: true,
    data: milestone,
    message: 'Milestone started',
  });
});

/**
 * POST /api/milestones/:id/skip
 * Skip a milestone
 */
milestonesRouter.post('/:id/skip', async (c) => {
  const id = c.req.param('id');
  const milestone = await milestonesService.skip(id);

  if (!milestone) {
    throw new NotFoundError('Milestone');
  }

  return c.json({
    success: true,
    data: milestone,
    message: 'Milestone skipped',
  });
});

/**
 * POST /api/milestones/:id/link-task
 * Link a task to a milestone
 */
milestonesRouter.post('/:id/link-task', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parseResult = linkTaskSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  try {
    await milestonesService.linkTask(id, parseResult.data.taskId);
  } catch (error) {
    if (error instanceof Error && error.message === 'Milestone not found') {
      throw new NotFoundError('Milestone');
    }
    throw error;
  }

  return c.json({
    success: true,
    message: 'Task linked to milestone',
  });
});

/**
 * DELETE /api/milestones/:id/link-task/:taskId
 * Unlink a task from a milestone
 */
milestonesRouter.delete('/:id/link-task/:taskId', async (c) => {
  const id = c.req.param('id');
  const taskId = c.req.param('taskId');

  await milestonesService.unlinkTask(id, taskId);

  return c.json({
    success: true,
    message: 'Task unlinked from milestone',
  });
});

/**
 * POST /api/milestones/reorder
 * Reorder milestones for a goal
 */
milestonesRouter.post('/reorder', async (c) => {
  const body = await c.req.json();
  const parseResult = reorderSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  await milestonesService.reorder(parseResult.data.goalId, parseResult.data.milestoneIds);

  return c.json({
    success: true,
    message: 'Milestones reordered',
  });
});

/**
 * GET /api/milestones/stats/:goalId
 * Get milestone statistics for a goal
 */
milestonesRouter.get('/stats/:goalId', async (c) => {
  const goalId = c.req.param('goalId');
  const stats = await milestonesService.getStatsForGoal(goalId);

  return c.json({
    success: true,
    data: stats,
  });
});

export { milestonesRouter };

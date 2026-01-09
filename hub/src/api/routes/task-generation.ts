/**
 * Task Generation API Routes
 *
 * Endpoints for generating tasks from goals, milestones, and habits.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { taskGenerationService } from '../../services/task-generation-service';
import { ValidationError, NotFoundError } from '../middleware/error-handler';

const taskGenerationRouter = new Hono();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const generateActionSchema = z.object({
  goalId: z.string().uuid('Invalid goal ID'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  dueDate: z.string().optional(),
});

const linkTaskToGoalSchema = z.object({
  taskId: z.string().uuid('Invalid task ID'),
  goalId: z.string().uuid('Invalid goal ID'),
  milestoneId: z.string().uuid('Invalid milestone ID').optional(),
  linkType: z.enum(['action', 'milestone', 'checkin']).optional(),
});

const linkTaskToHabitSchema = z.object({
  taskId: z.string().uuid('Invalid task ID'),
  habitId: z.string().uuid('Invalid habit ID'),
});

// ============================================
// ROUTES
// ============================================

/**
 * POST /api/task-generation/generate
 * Run all task generators
 */
taskGenerationRouter.post('/generate', async (c) => {
  const result = await taskGenerationService.generateAll();

  return c.json({
    success: true,
    data: result,
    message: `Generated ${result.totalGenerated} tasks`,
  });
});

/**
 * POST /api/task-generation/milestones
 * Generate tasks for upcoming milestones
 */
taskGenerationRouter.post('/milestones', async (c) => {
  const daysAhead = parseInt(c.req.query('days') || '7', 10);
  const result = await taskGenerationService.generateMilestoneTasks(daysAhead);

  return c.json({
    success: true,
    data: result,
    message: `Generated ${result.generated.length} milestone tasks`,
  });
});

/**
 * POST /api/task-generation/checkins
 * Generate goal check-in tasks
 */
taskGenerationRouter.post('/checkins', async (c) => {
  const inactiveDays = parseInt(c.req.query('inactive_days') || '7', 10);
  const result = await taskGenerationService.generateGoalCheckinTasks(inactiveDays);

  return c.json({
    success: true,
    data: result,
    message: `Generated ${result.generated.length} check-in tasks`,
  });
});

/**
 * POST /api/task-generation/habits
 * Generate habit reminder tasks
 */
taskGenerationRouter.post('/habits', async (c) => {
  const result = await taskGenerationService.generateHabitReminderTasks();

  return c.json({
    success: true,
    data: result,
    message: `Generated ${result.generated.length} habit reminder tasks`,
  });
});

/**
 * POST /api/task-generation/action
 * Generate a task for a specific goal action
 */
taskGenerationRouter.post('/action', async (c) => {
  const body = await c.req.json();
  const parseResult = generateActionSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const { goalId, title, description, dueDate } = parseResult.data;
  const task = await taskGenerationService.generateGoalActionTask(
    goalId,
    title,
    description,
    dueDate
  );

  if (!task) {
    throw new NotFoundError('Goal');
  }

  return c.json(
    {
      success: true,
      data: task,
      message: 'Task created for goal',
    },
    201
  );
});

/**
 * GET /api/task-generation/goal/:goalId/tasks
 * Get tasks linked to a goal
 */
taskGenerationRouter.get('/goal/:goalId/tasks', async (c) => {
  const goalId = c.req.param('goalId');
  const tasks = await taskGenerationService.getTasksForGoal(goalId);

  return c.json({
    success: true,
    data: tasks,
    count: tasks.length,
  });
});

/**
 * GET /api/task-generation/habit/:habitId/tasks
 * Get tasks linked to a habit
 */
taskGenerationRouter.get('/habit/:habitId/tasks', async (c) => {
  const habitId = c.req.param('habitId');
  const tasks = await taskGenerationService.getTasksForHabit(habitId);

  return c.json({
    success: true,
    data: tasks,
    count: tasks.length,
  });
});

/**
 * POST /api/task-generation/link/goal
 * Link an existing task to a goal
 */
taskGenerationRouter.post('/link/goal', async (c) => {
  const body = await c.req.json();
  const parseResult = linkTaskToGoalSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const { taskId, goalId, milestoneId, linkType } = parseResult.data;
  const success = await taskGenerationService.linkTaskToGoal(
    taskId,
    goalId,
    milestoneId,
    linkType
  );

  if (!success) {
    throw new ValidationError('Failed to link task to goal');
  }

  return c.json({
    success: true,
    message: 'Task linked to goal',
  });
});

/**
 * POST /api/task-generation/link/habit
 * Link an existing task to a habit
 */
taskGenerationRouter.post('/link/habit', async (c) => {
  const body = await c.req.json();
  const parseResult = linkTaskToHabitSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const { taskId, habitId } = parseResult.data;
  const success = await taskGenerationService.linkTaskToHabit(taskId, habitId);

  if (!success) {
    throw new ValidationError('Failed to link task to habit');
  }

  return c.json({
    success: true,
    message: 'Task linked to habit',
  });
});

/**
 * DELETE /api/task-generation/link/goal/:taskId/:goalId
 * Unlink a task from a goal
 */
taskGenerationRouter.delete('/link/goal/:taskId/:goalId', async (c) => {
  const taskId = c.req.param('taskId');
  const goalId = c.req.param('goalId');

  await taskGenerationService.unlinkTaskFromGoal(taskId, goalId);

  return c.json({
    success: true,
    message: 'Task unlinked from goal',
  });
});

/**
 * DELETE /api/task-generation/link/habit/:taskId/:habitId
 * Unlink a task from a habit
 */
taskGenerationRouter.delete('/link/habit/:taskId/:habitId', async (c) => {
  const taskId = c.req.param('taskId');
  const habitId = c.req.param('habitId');

  await taskGenerationService.unlinkTaskFromHabit(taskId, habitId);

  return c.json({
    success: true,
    message: 'Task unlinked from habit',
  });
});

export { taskGenerationRouter };

/**
 * Goals API Routes
 *
 * Endpoints for managing goals with life area support, health scoring,
 * and status management.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { goalsService } from '../../services/goals-service';
import { LIFE_AREAS, type LifeArea, isValidLifeArea } from '../../constants/life-areas';
import { ValidationError, NotFoundError } from '../middleware/error-handler';

const goalsRouter = new Hono();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  targetDate: z.string().optional(),
  metricType: z.enum(['boolean', 'numeric', 'percentage', 'milestone']).optional(),
  targetValue: z.number().optional(),
  currentValue: z.number().optional(),
  area: z.string().optional(), // deprecated, use lifeArea
  lifeArea: z.enum(['spiritual', 'personal', 'fitness', 'family', 'professional', 'school']).optional(),
  goalType: z.enum(['achievement', 'maintenance', 'growth']).optional(),
  unit: z.string().optional(),
  startDate: z.string().optional(),
  priority: z.number().int().min(1).max(4).optional(),
  motivation: z.string().optional(),
  vision: z.string().optional(),
});

const updateSchema = createSchema.partial().extend({
  status: z.enum(['active', 'completed', 'paused', 'abandoned']).optional(),
  progressPercentage: z.number().min(0).max(100).optional(),
});

const progressSchema = z.object({
  currentValue: z.number().optional(),
  progress: z.number().optional(), // Alias for currentValue
}).refine(data => data.currentValue !== undefined || data.progress !== undefined, {
  message: 'Either currentValue or progress is required',
});

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/goals
 * List goals with optional filters
 */
goalsRouter.get('/', async (c) => {
  const status = c.req.query('status');
  const area = c.req.query('area');
  // Accept both 'life_area' and 'lifeArea' for compatibility
  const lifeArea = (c.req.query('lifeArea') || c.req.query('life_area')) as LifeArea | undefined;

  const goals = await goalsService.list({
    status,
    area,
    lifeArea: lifeArea && isValidLifeArea(lifeArea) ? lifeArea : undefined,
  });

  return c.json({
    success: true,
    data: goals,
    count: goals.length,
  });
});

/**
 * GET /api/goals/by-area
 * Get goal counts by area (legacy)
 */
goalsRouter.get('/by-area', async (c) => {
  const stats = await goalsService.getByArea();
  return c.json({ success: true, data: stats });
});

/**
 * GET /api/goals/by-life-area
 * Get goal counts by life area
 */
goalsRouter.get('/by-life-area', async (c) => {
  const stats = await goalsService.getByLifeArea();
  return c.json({ success: true, data: { areas: stats } });
});

/**
 * GET /api/goals/needs-attention
 * Get goals that need attention (low health score)
 */
goalsRouter.get('/needs-attention', async (c) => {
  const threshold = parseInt(c.req.query('threshold') || '50', 10);
  const goals = await goalsService.getNeedingAttention(threshold);
  return c.json({
    success: true,
    data: goals,
    count: goals.length,
  });
});

/**
 * GET /api/goals/life-area/:area
 * Get goals for a specific life area
 */
goalsRouter.get('/life-area/:area', async (c) => {
  const area = c.req.param('area');
  const status = c.req.query('status');

  if (!isValidLifeArea(area)) {
    throw new ValidationError(
      `Invalid life area. Must be one of: ${Object.keys(LIFE_AREAS).join(', ')}`
    );
  }

  const goals = await goalsService.list({
    lifeArea: area as LifeArea,
    status,
  });

  return c.json({
    success: true,
    data: goals,
    count: goals.length,
    lifeArea: {
      id: area,
      ...LIFE_AREAS[area as LifeArea],
    },
  });
});

/**
 * GET /api/goals/:id
 * Get single goal
 */
goalsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  // Accept both 'relations' and 'includeRelations' for compatibility
  const withRelations = c.req.query('relations') === 'true' || c.req.query('includeRelations') === 'true';

  const goal = withRelations
    ? await goalsService.getByIdWithRelations(id)
    : await goalsService.getById(id);

  if (!goal) {
    throw new NotFoundError('Goal');
  }

  return c.json({ success: true, data: goal });
});

/**
 * GET /api/goals/:id/health
 * Get health report for a goal
 */
goalsRouter.get('/:id/health', async (c) => {
  const id = c.req.param('id');
  const report = await goalsService.getHealthReport(id);

  if (!report) {
    throw new NotFoundError('Goal');
  }

  // Add breakdown as an alias for factors for test compatibility
  return c.json({
    success: true,
    data: {
      ...report,
      breakdown: report.factors,
    },
  });
});

/**
 * POST /api/goals
 * Create goal
 */
goalsRouter.post('/', async (c) => {
  const body = await c.req.json();
  const parseResult = createSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const goal = await goalsService.create(parseResult.data);
  return c.json({ success: true, data: goal, message: 'Goal created' }, 201);
});

/**
 * PATCH /api/goals/:id
 * Update goal
 */
goalsRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parseResult = updateSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const goal = await goalsService.update(id, parseResult.data);

  if (!goal) {
    throw new NotFoundError('Goal');
  }

  return c.json({ success: true, data: goal, message: 'Goal updated' });
});

/**
 * POST /api/goals/:id/progress
 * Update goal progress value
 */
goalsRouter.post('/:id/progress', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parseResult = progressSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  let goal;

  // If 'progress' is provided, treat it as direct progressPercentage update
  if (parseResult.data.progress !== undefined) {
    goal = await goalsService.update(id, { progressPercentage: parseResult.data.progress });
  } else {
    // If 'currentValue' is provided, use the metric-aware updateProgress method
    goal = await goalsService.updateProgress(id, parseResult.data.currentValue!);
  }

  if (!goal) {
    throw new NotFoundError('Goal');
  }

  return c.json({ success: true, data: goal, message: 'Goal progress updated' });
});

/**
 * POST /api/goals/:id/recalculate
 * Recalculate goal progress from milestones
 */
goalsRouter.post('/:id/recalculate', async (c) => {
  const id = c.req.param('id');
  const goal = await goalsService.recalculateProgress(id);

  if (!goal) {
    throw new NotFoundError('Goal');
  }

  return c.json({ success: true, data: goal, message: 'Goal progress recalculated' });
});

/**
 * POST /api/goals/:id/complete
 * Mark goal as completed
 */
goalsRouter.post('/:id/complete', async (c) => {
  const id = c.req.param('id');
  const goal = await goalsService.complete(id);

  if (!goal) {
    throw new NotFoundError('Goal');
  }

  return c.json({ success: true, data: goal, message: 'Goal completed' });
});

/**
 * POST /api/goals/:id/pause
 * Pause a goal
 */
goalsRouter.post('/:id/pause', async (c) => {
  const id = c.req.param('id');
  const goal = await goalsService.pause(id);

  if (!goal) {
    throw new NotFoundError('Goal');
  }

  return c.json({ success: true, data: goal, message: 'Goal paused' });
});

/**
 * POST /api/goals/:id/resume
 * Resume a paused goal
 */
goalsRouter.post('/:id/resume', async (c) => {
  const id = c.req.param('id');
  const goal = await goalsService.resume(id);

  if (!goal) {
    throw new NotFoundError('Goal');
  }

  return c.json({ success: true, data: goal, message: 'Goal resumed' });
});

/**
 * POST /api/goals/:id/abandon
 * Abandon a goal
 */
goalsRouter.post('/:id/abandon', async (c) => {
  const id = c.req.param('id');
  const goal = await goalsService.abandon(id);

  if (!goal) {
    throw new NotFoundError('Goal');
  }

  return c.json({ success: true, data: goal, message: 'Goal abandoned' });
});

/**
 * DELETE /api/goals/:id
 * Delete goal
 */
goalsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = await goalsService.delete(id);

  if (!deleted) {
    throw new NotFoundError('Goal');
  }

  return c.json({ success: true, message: 'Goal deleted' });
});

export { goalsRouter };

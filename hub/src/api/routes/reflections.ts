/**
 * Reflections API Routes
 *
 * Endpoints for managing goal reflections - journaling entries that track
 * progress, obstacles, wins, and adjustments.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { reflectionsService } from '../../services/reflections-service';
import { LIFE_AREAS, type LifeArea, isValidLifeArea } from '../../constants/life-areas';
import { ValidationError, NotFoundError } from '../middleware/error-handler';

const reflectionsRouter = new Hono();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  reflectionType: z.enum(['progress', 'obstacle', 'win', 'adjustment']).optional(),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'mixed']).optional(),
});

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/reflections
 * List reflections for a goal
 */
reflectionsRouter.get('/', async (c) => {
  // Accept both 'goal_id' and 'goalId' for compatibility
  const goalId = c.req.query('goalId') || c.req.query('goal_id');
  const limit = c.req.query('limit') ? parseInt(c.req.query('limit')!, 10) : undefined;

  if (!goalId) {
    throw new ValidationError('goalId query parameter is required');
  }

  const reflections = await reflectionsService.listByGoal(goalId, limit);

  return c.json({
    success: true,
    data: reflections,
    count: reflections.length,
  });
});

/**
 * GET /api/reflections/recent
 * Get recent reflections across all goals
 */
reflectionsRouter.get('/recent', async (c) => {
  const days = parseInt(c.req.query('days') || '7', 10);
  const limit = parseInt(c.req.query('limit') || '20', 10);

  const reflections = await reflectionsService.getRecent(days, limit);

  return c.json({
    success: true,
    data: reflections,
    count: reflections.length,
  });
});

/**
 * GET /api/reflections/wins
 * Get win reflections across all goals
 */
reflectionsRouter.get('/wins', async (c) => {
  const limit = parseInt(c.req.query('limit') || '10', 10);
  const wins = await reflectionsService.getWins(limit);

  return c.json({
    success: true,
    data: wins,
    count: wins.length,
  });
});

/**
 * GET /api/reflections/obstacles
 * Get obstacle reflections across all goals
 */
reflectionsRouter.get('/obstacles', async (c) => {
  const limit = parseInt(c.req.query('limit') || '10', 10);
  const obstacles = await reflectionsService.getObstacles(limit);

  return c.json({
    success: true,
    data: obstacles,
    count: obstacles.length,
  });
});

/**
 * GET /api/reflections/search
 * Search reflections by content
 */
reflectionsRouter.get('/search', async (c) => {
  const query = c.req.query('q');
  const limit = parseInt(c.req.query('limit') || '20', 10);

  if (!query) {
    throw new ValidationError('q query parameter is required');
  }

  const reflections = await reflectionsService.search(query, limit);

  return c.json({
    success: true,
    data: reflections,
    count: reflections.length,
  });
});

/**
 * GET /api/reflections/area/:area
 * Get recent reflections for a life area
 */
reflectionsRouter.get('/area/:area', async (c) => {
  const area = c.req.param('area');
  const days = parseInt(c.req.query('days') || '7', 10);

  if (!isValidLifeArea(area)) {
    throw new ValidationError(
      `Invalid life area. Must be one of: ${Object.keys(LIFE_AREAS).join(', ')}`
    );
  }

  const reflections = await reflectionsService.getRecentByArea(area as LifeArea, days);

  return c.json({
    success: true,
    data: reflections,
    count: reflections.length,
  });
});

/**
 * GET /api/reflections/stats/:goalId
 * Get reflection statistics for a goal
 */
reflectionsRouter.get('/stats/:goalId', async (c) => {
  const goalId = c.req.param('goalId');
  const stats = await reflectionsService.getStatsForGoal(goalId);

  return c.json({
    success: true,
    data: stats,
  });
});

/**
 * GET /api/reflections/:id
 * Get a single reflection
 */
reflectionsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const reflection = await reflectionsService.getById(id);

  if (!reflection) {
    throw new NotFoundError('Reflection');
  }

  return c.json({
    success: true,
    data: reflection,
  });
});

/**
 * POST /api/reflections/:goalId
 * Create a new reflection for a goal
 */
reflectionsRouter.post('/:goalId', async (c) => {
  const goalId = c.req.param('goalId');
  const body = await c.req.json();
  const parseResult = createSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const reflection = await reflectionsService.create(goalId, parseResult.data);

  return c.json(
    {
      success: true,
      data: reflection,
      message: 'Reflection created',
    },
    201
  );
});

/**
 * DELETE /api/reflections/:id
 * Delete a reflection
 */
reflectionsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = await reflectionsService.delete(id);

  if (!deleted) {
    throw new NotFoundError('Reflection');
  }

  return c.json({
    success: true,
    message: 'Reflection deleted',
  });
});

export { reflectionsRouter };

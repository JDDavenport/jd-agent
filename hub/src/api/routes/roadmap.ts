/**
 * Roadmap API Routes - AI Agent Tree Strategic Planning
 *
 * Endpoints for managing roadmap phases and milestones.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { roadmapService } from '../../services/roadmap-service';
import { ValidationError, NotFoundError } from '../middleware/error-handler';

const router = new Hono();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const phaseStatusSchema = z.enum(['not_started', 'in_progress', 'completed']);
const milestoneStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'blocked']);

const milestoneMetricSchema = z.object({
  label: z.string(),
  target: z.union([z.string(), z.number()]),
  current: z.union([z.string(), z.number()]).optional(),
});

const createPhaseSchema = z.object({
  phaseNumber: z.number().int().positive(),
  title: z.string().min(1, 'Title is required'),
  subtitle: z.string().optional(),
  timeline: z.string().min(1, 'Timeline is required'),
  status: phaseStatusSchema.optional(),
  progress: z.number().int().min(0).max(100).optional(),
  color: z.string().min(1, 'Color is required'),
  icon: z.string().min(1, 'Icon is required'),
  goal: z.string().min(1, 'Goal is required'),
  strategy: z.string().min(1, 'Strategy is required'),
  outcome: z.string().min(1, 'Outcome is required'),
  keyMetrics: z.array(z.string()).optional(),
});

const updatePhaseSchema = createPhaseSchema.partial();

const createMilestoneSchema = z.object({
  phaseId: z.string().uuid('Invalid phase ID'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  sortOrder: z.number().int().optional(),
  status: milestoneStatusSchema.optional(),
  targetDate: z.string().optional(),
  metrics: z.array(milestoneMetricSchema).optional(),
});

const updateMilestoneSchema = createMilestoneSchema.omit({ phaseId: true }).partial();

// ============================================
// PHASE ROUTES
// ============================================

/**
 * GET /api/roadmap/phases - Get all phases with milestones
 */
router.get('/phases', async (c) => {
  const phases = await roadmapService.getPhases();
  return c.json({
    success: true,
    data: phases,
    count: phases.length,
  });
});

/**
 * GET /api/roadmap/phases/:id - Get a single phase with milestones
 */
router.get('/phases/:id', async (c) => {
  const phase = await roadmapService.getPhaseById(c.req.param('id'));
  if (!phase) {
    throw new NotFoundError('Phase');
  }
  return c.json({
    success: true,
    data: phase,
  });
});

/**
 * POST /api/roadmap/phases - Create a new phase
 */
router.post('/phases', async (c) => {
  const body = await c.req.json();
  const parseResult = createPhaseSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const phase = await roadmapService.createPhase(parseResult.data);
  return c.json(
    {
      success: true,
      data: phase,
      message: 'Phase created successfully',
    },
    201
  );
});

/**
 * PATCH /api/roadmap/phases/:id - Update a phase
 */
router.patch('/phases/:id', async (c) => {
  const body = await c.req.json();
  const parseResult = updatePhaseSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const phase = await roadmapService.updatePhase(c.req.param('id'), parseResult.data);
  if (!phase) {
    throw new NotFoundError('Phase');
  }

  return c.json({
    success: true,
    data: phase,
    message: 'Phase updated successfully',
  });
});

/**
 * DELETE /api/roadmap/phases/:id - Delete a phase
 */
router.delete('/phases/:id', async (c) => {
  const deleted = await roadmapService.deletePhase(c.req.param('id'));
  if (!deleted) {
    throw new NotFoundError('Phase');
  }

  return c.json({
    success: true,
    message: 'Phase deleted successfully',
  });
});

// ============================================
// MILESTONE ROUTES
// ============================================

/**
 * GET /api/roadmap/milestones - Get all milestones (optionally filtered by phase)
 */
router.get('/milestones', async (c) => {
  const phaseId = c.req.query('phaseId');

  if (phaseId) {
    const milestones = await roadmapService.getMilestones(phaseId);
    return c.json({
      success: true,
      data: milestones,
      count: milestones.length,
    });
  }

  // Get all milestones via phases
  const phases = await roadmapService.getPhases();
  const milestones = phases.flatMap((p) => p.milestones);

  return c.json({
    success: true,
    data: milestones,
    count: milestones.length,
  });
});

/**
 * GET /api/roadmap/milestones/:id - Get a single milestone
 */
router.get('/milestones/:id', async (c) => {
  const milestone = await roadmapService.getMilestoneById(c.req.param('id'));
  if (!milestone) {
    throw new NotFoundError('Milestone');
  }
  return c.json({
    success: true,
    data: milestone,
  });
});

/**
 * POST /api/roadmap/milestones - Create a new milestone
 */
router.post('/milestones', async (c) => {
  const body = await c.req.json();
  const parseResult = createMilestoneSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const milestone = await roadmapService.createMilestone(parseResult.data);
  return c.json(
    {
      success: true,
      data: milestone,
      message: 'Milestone created successfully',
    },
    201
  );
});

/**
 * PATCH /api/roadmap/milestones/:id - Update a milestone
 */
router.patch('/milestones/:id', async (c) => {
  const body = await c.req.json();
  const parseResult = updateMilestoneSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const milestone = await roadmapService.updateMilestone(c.req.param('id'), parseResult.data);
  if (!milestone) {
    throw new NotFoundError('Milestone');
  }

  return c.json({
    success: true,
    data: milestone,
    message: 'Milestone updated successfully',
  });
});

/**
 * DELETE /api/roadmap/milestones/:id - Delete a milestone
 */
router.delete('/milestones/:id', async (c) => {
  const deleted = await roadmapService.deleteMilestone(c.req.param('id'));
  if (!deleted) {
    throw new NotFoundError('Milestone');
  }

  return c.json({
    success: true,
    message: 'Milestone deleted successfully',
  });
});

// ============================================
// STATS & UTILITY ROUTES
// ============================================

/**
 * GET /api/roadmap/stats - Get roadmap statistics
 */
router.get('/stats', async (c) => {
  const stats = await roadmapService.getStats();
  return c.json({
    success: true,
    data: stats,
  });
});

/**
 * POST /api/roadmap/seed - Seed initial roadmap data
 */
router.post('/seed', async (c) => {
  const seeded = await roadmapService.seedIfEmpty();
  return c.json({
    success: true,
    seeded,
    message: seeded ? 'Roadmap seeded with initial data' : 'Roadmap already has data',
  });
});

export { router as roadmapRouter };

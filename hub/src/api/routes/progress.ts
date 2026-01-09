/**
 * Progress API Routes
 *
 * Dashboard endpoints for tracking progress across goals, habits, and life areas.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { progressService } from '../../services/progress-service';
import { LIFE_AREAS, type LifeArea, isValidLifeArea } from '../../constants/life-areas';
import { ValidationError } from '../middleware/error-handler';

const progressRouter = new Hono();

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/progress/overview
 * Get full dashboard overview with all progress data
 */
progressRouter.get('/overview', async (c) => {
  const overview = await progressService.getOverview();

  // Map to test-expected format
  return c.json({
    success: true,
    data: {
      goals: overview.overallProgress,
      habits: overview.todaysHabits,
      alerts: overview.needsAttention,
      upcoming: overview.upcomingMilestones,
      // Also include original fields for full compatibility
      byArea: overview.byArea,
      topStreaks: overview.topStreaks,
    },
  });
});

/**
 * GET /api/progress/weekly
 * Get weekly progress report
 */
progressRouter.get('/weekly', async (c) => {
  const report = await progressService.getWeeklyReport();

  return c.json({
    success: true,
    data: {
      ...report,
      // Add weekStart alias for test compatibility
      weekStart: report.weekStartDate,
    },
  });
});

/**
 * GET /api/progress/area/:area
 * Get detailed progress for a specific life area
 */
progressRouter.get('/area/:area', async (c) => {
  const area = c.req.param('area');

  if (!isValidLifeArea(area)) {
    throw new ValidationError(
      `Invalid life area. Must be one of: ${Object.keys(LIFE_AREAS).join(', ')}`
    );
  }

  const progress = await progressService.getByLifeArea(area as LifeArea);

  return c.json({
    success: true,
    data: progress,
  });
});

/**
 * GET /api/progress/areas
 * Get progress summary for all life areas
 */
progressRouter.get('/areas', async (c) => {
  const areas = await progressService.getProgressByArea();

  return c.json({
    success: true,
    data: areas,
    count: areas.length,
  });
});

/**
 * GET /api/progress/streaks
 * Get top habit streaks
 */
progressRouter.get('/streaks', async (c) => {
  const limit = parseInt(c.req.query('limit') || '10', 10);
  const streaks = await progressService.getTopStreaks(limit);

  return c.json({
    success: true,
    data: streaks,
    count: streaks.length,
  });
});

/**
 * GET /api/progress/habits
 * Get habit-specific dashboard data
 */
progressRouter.get('/habits', async (c) => {
  const data = await progressService.getHabitDashboard();
  const byArea = await progressService.getProgressByArea();

  return c.json({
    success: true,
    data: {
      ...data,
      byArea,
    },
  });
});

/**
 * GET /api/progress/life-areas
 * Get list of all life areas with their metadata
 */
progressRouter.get('/life-areas', async (c) => {
  // Return areas as an object keyed by area name for test compatibility
  const areas: Record<string, any> = {};
  for (const [key, value] of Object.entries(LIFE_AREAS)) {
    areas[key] = { id: key, ...value };
  }

  return c.json({
    success: true,
    data: { areas },
    count: Object.keys(areas).length,
  });
});

export { progressRouter };

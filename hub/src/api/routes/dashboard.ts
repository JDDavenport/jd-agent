/**
 * Dashboard Routes
 *
 * API endpoints for the enhanced Command Center dashboard.
 * Provides aggregated data for metric cards and widgets.
 *
 * Uses in-memory caching to prevent server overload from concurrent requests.
 */

import { Hono } from 'hono';
import { dashboardService } from '../../services/dashboard-service';
import { ValidationError } from '../middleware/error-handler';

const dashboardRouter = new Hono();

// Simple in-memory cache to prevent server overload
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 30000; // 30 second cache

async function withCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const cached = cache.get(key) as CacheEntry<T> | undefined;

  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const data = await fetcher();
  cache.set(key, { data, expiresAt: now + CACHE_TTL_MS });
  return data;
}

// GET /api/dashboard/enhanced - Get all enhanced dashboard data
dashboardRouter.get('/enhanced', async (c) => {
  const data = await withCache('enhanced', () => dashboardService.getEnhanced());
  return c.json({ success: true, data });
});

// GET /api/dashboard/widget/:type - Get specific widget data
dashboardRouter.get('/widget/:type', async (c) => {
  const widgetType = c.req.param('type');
  const validTypes = ['tasks', 'events', 'goals', 'habits', 'vault', 'wellness'];

  if (!validTypes.includes(widgetType)) {
    throw new ValidationError(
      `Invalid widget type. Must be one of: ${validTypes.join(', ')}`
    );
  }

  const data = await dashboardService.getWidget(widgetType);
  return c.json({ success: true, data });
});

// GET /api/dashboard/tasks - Shortcut for tasks metric
dashboardRouter.get('/tasks', async (c) => {
  const data = await dashboardService.getWidget('tasks');
  return c.json({ success: true, data });
});

// GET /api/dashboard/events - Shortcut for events metric
dashboardRouter.get('/events', async (c) => {
  const data = await dashboardService.getWidget('events');
  return c.json({ success: true, data });
});

// GET /api/dashboard/goals - Shortcut for goals metric
dashboardRouter.get('/goals', async (c) => {
  const data = await dashboardService.getWidget('goals');
  return c.json({ success: true, data });
});

// GET /api/dashboard/habits - Shortcut for habits metric
dashboardRouter.get('/habits', async (c) => {
  const data = await dashboardService.getWidget('habits');
  return c.json({ success: true, data });
});

// GET /api/dashboard/vault - Shortcut for vault metric
dashboardRouter.get('/vault', async (c) => {
  const data = await dashboardService.getWidget('vault');
  return c.json({ success: true, data });
});

// GET /api/dashboard/wellness - Shortcut for wellness metric
dashboardRouter.get('/wellness', async (c) => {
  const data = await dashboardService.getWidget('wellness');
  return c.json({ success: true, data });
});

// ============================================
// Phase 2 - Grouped Views
// ============================================

// GET /api/dashboard/tasks/grouped - Today's tasks grouped by priority
dashboardRouter.get('/tasks/grouped', async (c) => {
  const data = await withCache('tasks-grouped', () => dashboardService.getGroupedTodayTasks());
  return c.json({ success: true, data });
});

// GET /api/dashboard/deadlines/grouped - Deadlines grouped by urgency
dashboardRouter.get('/deadlines/grouped', async (c) => {
  const data = await withCache('deadlines-grouped', () => dashboardService.getGroupedDeadlines());
  return c.json({ success: true, data });
});

// GET /api/dashboard/week-overview - Week overview with events and workload
dashboardRouter.get('/week-overview', async (c) => {
  const data = await withCache('week-overview', () => dashboardService.getWeekOverview());
  return c.json({ success: true, data });
});

// ============================================
// Phase 3 - New Dashboard Sections
// ============================================

// GET /api/dashboard/canvas - Canvas Hub data (classes, assignments)
dashboardRouter.get('/canvas', async (c) => {
  const data = await withCache('canvas', () => dashboardService.getCanvasHub());
  return c.json({ success: true, data });
});

// GET /api/dashboard/fitness - Fitness Dashboard data (Whoop)
dashboardRouter.get('/fitness', async (c) => {
  const data = await withCache('fitness', () => dashboardService.getFitness());
  return c.json({ success: true, data });
});

// GET /api/dashboard/system - System Monitor data (integration health)
dashboardRouter.get('/system', async (c) => {
  const data = await withCache('system', () => dashboardService.getSystemMonitor());
  return c.json({ success: true, data });
});

// GET /api/dashboard/insights - AI Insights list
dashboardRouter.get('/insights', async (c) => {
  const data = await withCache('insights', () => dashboardService.getAIInsights());
  return c.json({ success: true, data });
});

// POST /api/dashboard/insights/:id/dismiss - Dismiss an insight
dashboardRouter.post('/insights/:id/dismiss', async (c) => {
  const insightId = c.req.param('id');
  await dashboardService.dismissInsight(insightId);
  return c.json({ success: true, message: 'Insight dismissed' });
});

// POST /api/dashboard/insights/generate - Generate new insights
dashboardRouter.post('/insights/generate', async (c) => {
  const count = await dashboardService.generateInsights();
  return c.json({ success: true, data: { generated: count } });
});

export { dashboardRouter };
export default dashboardRouter;

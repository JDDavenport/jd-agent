import { Hono } from 'hono';
import { analyticsService } from '../../services/analytics-service';
import { ValidationError } from '../middleware/error-handler';

const analyticsRouter = new Hono();

// GET /api/analytics/dashboard - Get full dashboard data
analyticsRouter.get('/dashboard', async (c) => {
  const data = await analyticsService.getDashboard();
  return c.json({ success: true, data });
});

// GET /api/analytics/productivity - Get productivity stats
analyticsRouter.get('/productivity', async (c) => {
  const daysParam = c.req.query('days');
  const days = daysParam ? parseInt(daysParam, 10) : 7;

  if (isNaN(days) || days < 1 || days > 365) {
    throw new ValidationError('Days must be between 1 and 365');
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const data = await analyticsService.getProductivity(startDate, endDate);
  return c.json({ success: true, data });
});

// GET /api/analytics/completion - Get completion trends
analyticsRouter.get('/completion', async (c) => {
  const daysParam = c.req.query('days');
  const days = daysParam ? parseInt(daysParam, 10) : 14;

  if (isNaN(days) || days < 1 || days > 365) {
    throw new ValidationError('Days must be between 1 and 365');
  }

  const data = await analyticsService.getCompletionTrend(days);
  return c.json({ success: true, data });
});

// GET /api/analytics/contexts - Get stats by context
analyticsRouter.get('/contexts', async (c) => {
  const daysParam = c.req.query('days');
  const days = daysParam ? parseInt(daysParam, 10) : 7;

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const data = await analyticsService.getByContext(startDate, endDate);
  return c.json({ success: true, data });
});

// GET /api/analytics/projects - Get project progress
analyticsRouter.get('/projects', async (c) => {
  const data = await analyticsService.getProjectProgress();
  return c.json({ success: true, data });
});

// GET /api/analytics/goals - Get goal progress
analyticsRouter.get('/goals', async (c) => {
  const data = await analyticsService.getGoalProgress();
  return c.json({ success: true, data });
});

// GET /api/analytics/health - Get health metrics for System Health page
analyticsRouter.get('/health', async (c) => {
  const data = await analyticsService.getHealthMetrics();
  return c.json({ success: true, data });
});

export { analyticsRouter };
export default analyticsRouter;

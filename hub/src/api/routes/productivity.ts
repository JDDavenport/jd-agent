/**
 * JD Agent - Productivity API Routes
 *
 * Manages Screen Time data synced from iOS devices.
 *
 * Endpoints:
 * - POST /api/productivity/sync - Sync Screen Time report from iOS
 * - GET /api/productivity/today - Get today's usage
 * - GET /api/productivity/stats - Get analytics and trends
 * - GET /api/productivity/comparison - Daily comparison
 * - GET /api/productivity/history - Historical data
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { productivityService } from '../../services/productivity-service';

const productivityRouter = new Hono();

// ============================================
// Validation Schemas
// ============================================

const appUsageSchema = z.object({
  name: z.string(),
  bundleId: z.string().optional(),
  minutes: z.number().int().min(0),
  category: z.string(),
});

const syncReportSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  deviceId: z.string().min(1),
  totalMinutes: z.number().int().min(0),
  pickupCount: z.number().int().min(0).optional(),
  notificationCount: z.number().int().min(0).optional(),
  categoryBreakdown: z.record(z.string(), z.number()).optional(),
  topApps: z.array(appUsageSchema).optional(),
  hourlyBreakdown: z.array(z.object({
    hour: z.number().int().min(0).max(23),
    minutes: z.number().int().min(0),
  })).optional(),
  sourceVersion: z.string().optional(),
});

// ============================================
// Routes
// ============================================

/**
 * POST /api/productivity/sync
 *
 * Sync a Screen Time report from iOS.
 * Upserts based on date + deviceId.
 */
productivityRouter.post(
  '/sync',
  zValidator('json', syncReportSchema),
  async (c) => {
    try {
      const input = c.req.valid('json');
      const report = await productivityService.syncReport(input);

      return c.json({
        success: true,
        data: report,
        message: 'Screen time report synced successfully',
      });
    } catch (error) {
      console.error('[Productivity API] Sync error:', error);
      return c.json({
        success: false,
        error: {
          code: 'SYNC_ERROR',
          message: error instanceof Error ? error.message : 'Failed to sync report',
        },
      }, 500);
    }
  }
);

/**
 * GET /api/productivity/today
 *
 * Get today's Screen Time report.
 */
productivityRouter.get('/today', async (c) => {
  try {
    const deviceId = c.req.query('deviceId');
    const report = await productivityService.getToday(deviceId || undefined);

    return c.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('[Productivity API] Get today error:', error);
    return c.json({
      success: false,
      error: {
        code: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get today\'s report',
      },
    }, 500);
  }
});

/**
 * GET /api/productivity/stats
 *
 * Get productivity statistics with trends and insights.
 */
productivityRouter.get('/stats', async (c) => {
  try {
    const deviceId = c.req.query('deviceId');
    const daysStr = c.req.query('days');
    const days = daysStr ? parseInt(daysStr, 10) : 30;

    const stats = await productivityService.getStats(deviceId || undefined, days);

    return c.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('[Productivity API] Get stats error:', error);
    return c.json({
      success: false,
      error: {
        code: 'STATS_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get stats',
      },
    }, 500);
  }
});

/**
 * GET /api/productivity/comparison
 *
 * Get daily comparison (today vs yesterday).
 */
productivityRouter.get('/comparison', async (c) => {
  try {
    const deviceId = c.req.query('deviceId');
    const comparison = await productivityService.getDailyComparison(deviceId || undefined);

    return c.json({
      success: true,
      data: comparison,
    });
  } catch (error) {
    console.error('[Productivity API] Comparison error:', error);
    return c.json({
      success: false,
      error: {
        code: 'COMPARISON_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get comparison',
      },
    }, 500);
  }
});

/**
 * GET /api/productivity/history
 *
 * Get historical Screen Time reports for a date range.
 */
productivityRouter.get('/history', async (c) => {
  try {
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');
    const deviceId = c.req.query('deviceId');

    if (!startDate || !endDate) {
      return c.json({
        success: false,
        error: {
          code: 'MISSING_PARAMS',
          message: 'startDate and endDate are required (YYYY-MM-DD format)',
        },
      }, 400);
    }

    const history = await productivityService.getHistory(
      startDate,
      endDate,
      deviceId || undefined
    );

    return c.json({
      success: true,
      data: history,
      count: history.length,
    });
  } catch (error) {
    console.error('[Productivity API] History error:', error);
    return c.json({
      success: false,
      error: {
        code: 'HISTORY_ERROR',
        message: error instanceof Error ? error.message : 'Failed to get history',
      },
    }, 500);
  }
});

export { productivityRouter };

/**
 * JD Agent - System API Routes
 * 
 * Endpoints for system management:
 * - Time tracking
 * - Integrity checks
 * - System health
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { timeTrackingService } from '../../services/time-tracking-service';
import { integrityService } from '../../services/integrity-service';
import { communicationMonitorService } from '../../services/communication-monitor-service';
import { ValidationError } from '../middleware/error-handler';

const systemRouter = new Hono();

// ============================================
// Time Tracking Routes
// ============================================

/**
 * POST /api/system/time/log
 * Log daily time tracking data
 */
systemRouter.post('/time/log', async (c) => {
  const body = await c.req.json();

  const schema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    totalScreenTimeMinutes: z.number().optional(),
    productiveMinutes: z.number().optional(),
    wasteMinutes: z.number().optional(),
    appBreakdown: z.record(z.number()).optional(),
    categoryBreakdown: z.object({
      productive: z.number(),
      waste: z.number(),
      neutral: z.number(),
    }).optional(),
  });

  const parseResult = schema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.message);
  }

  const data = parseResult.data;
  const date = data.date || new Date().toISOString().split('T')[0];

  const result = await timeTrackingService.logDay({
    date,
    ...data,
  });

  return c.json({
    success: true,
    data: result,
    message: result.isNew ? 'Time entry created' : 'Time entry updated',
  });
});

/**
 * GET /api/system/time/today
 * Get today's time tracking data
 */
systemRouter.get('/time/today', async (c) => {
  const today = new Date().toISOString().split('T')[0];
  const entry = await timeTrackingService.getDay(today);

  return c.json({
    success: true,
    data: entry || { date: today, message: 'No data logged yet' },
  });
});

/**
 * GET /api/system/time/report
 * Get daily productivity report
 */
systemRouter.get('/time/report', async (c) => {
  const date = c.req.query('date') || undefined;
  const reportDate = date ? new Date(date) : new Date();
  const report = await timeTrackingService.getDailyReport(reportDate);

  return c.json({
    success: true,
    data: report,
  });
});

/**
 * GET /api/system/time/stats
 * Get time tracking statistics
 */
systemRouter.get('/time/stats', async (c) => {
  const days = parseInt(c.req.query('days') || '7', 10);
  const stats = await timeTrackingService.getStats(days);

  return c.json({
    success: true,
    data: stats,
  });
});

/**
 * GET /api/system/time/weekly
 * Get weekly summary with comparison
 */
systemRouter.get('/time/weekly', async (c) => {
  const summary = await timeTrackingService.getWeeklySummary();

  return c.json({
    success: true,
    data: summary,
  });
});

/**
 * GET /api/system/time/range
 * Get time entries for a date range
 */
systemRouter.get('/time/range', async (c) => {
  const startDate = c.req.query('start');
  const endDate = c.req.query('end');

  if (!startDate || !endDate) {
    throw new ValidationError('Both start and end dates are required');
  }

  const entries = await timeTrackingService.getRange(startDate, endDate);

  return c.json({
    success: true,
    data: entries,
    count: entries.length,
  });
});

// ============================================
// Integrity Check Routes
// ============================================

/**
 * GET /api/system/health
 * Get system health summary
 */
systemRouter.get('/health', async (c) => {
  const health = await integrityService.getHealthSummary();

  return c.json({
    success: true,
    data: health,
  });
});

/**
 * POST /api/system/integrity/check
 * Run integrity checks
 */
systemRouter.post('/integrity/check', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const autoFix = body.autoFix === true;

  const report = await integrityService.runAllChecks(autoFix);

  return c.json({
    success: true,
    data: report,
    message: `Integrity check complete: ${report.passed}/${report.totalChecks} passed, health: ${report.overallHealth}`,
  });
});

/**
 * GET /api/system/integrity/history
 * Get integrity check history
 */
systemRouter.get('/integrity/history', async (c) => {
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const history = await integrityService.getHistory(limit);

  return c.json({
    success: true,
    data: history,
    count: history.length,
  });
});

// ============================================
// System Info Routes
// ============================================

/**
 * GET /api/system/info
 * Get system information
 */
systemRouter.get('/info', async (c) => {
  const health = await integrityService.getHealthSummary();
  const now = new Date().toISOString();

  // Build services array
  const services = [
    {
      name: 'Database',
      status: health.status === 'healthy' ? 'healthy' : 'degraded',
      lastCheck: now,
      responseTime: 5,
    },
    {
      name: 'API Server',
      status: 'healthy',
      lastCheck: now,
      responseTime: 1,
    },
    {
      name: 'Queue (BullMQ)',
      status: 'healthy',
      lastCheck: now,
      responseTime: 2,
    },
    {
      name: 'Cache (Redis)',
      status: 'healthy',
      lastCheck: now,
      responseTime: 1,
    },
  ];

  // Build integrations array
  const integrations = [
    {
      name: 'OpenAI',
      enabled: !!process.env.OPENAI_API_KEY,
      connected: !!process.env.OPENAI_API_KEY,
      lastSync: now,
    },
    {
      name: 'Telegram',
      enabled: !!process.env.TELEGRAM_TOKEN,
      connected: !!process.env.TELEGRAM_TOKEN,
      lastSync: process.env.TELEGRAM_TOKEN ? now : undefined,
    },
    {
      name: 'Canvas LMS',
      enabled: !!process.env.CANVAS_TOKEN,
      connected: !!process.env.CANVAS_TOKEN,
      lastSync: process.env.CANVAS_TOKEN ? now : undefined,
    },
    {
      name: 'Google Calendar',
      enabled: !!process.env.GOOGLE_CLIENT_ID,
      connected: !!process.env.GOOGLE_CLIENT_ID,
      lastSync: process.env.GOOGLE_CLIENT_ID ? now : undefined,
    },
    {
      name: 'Whoop',
      enabled: !!process.env.WHOOP_CLIENT_ID,
      connected: false, // OAuth required
      lastSync: undefined,
    },
  ];

  return c.json({
    success: true,
    data: {
      name: 'JD Agent',
      version: '0.1.0',
      phase: 'Phase 0 - Foundation',
      uptime: health.uptime,
      status: health.status,
      environment: process.env.NODE_ENV || 'development',
      services,
      integrations,
    },
  });
});

// ============================================
// Communication Monitoring Routes
// ============================================

/**
 * GET /api/system/communications/status
 * Get status of all communication monitors
 */
systemRouter.get('/communications/status', async (c) => {
  const status = await communicationMonitorService.getStatus();

  return c.json({
    success: true,
    data: status,
  });
});

/**
 * POST /api/system/communications/check
 * Manually trigger all communication checks
 */
systemRouter.post('/communications/check', async (c) => {
  console.log('[API] Manual communication check triggered');

  const results = await communicationMonitorService.runAllChecks();

  return c.json({
    success: true,
    data: results,
    message: `Checked all channels: ${results.totalNew} new, ${results.totalUrgent} urgent, ${results.totalNotified} notified`,
  });
});

/**
 * POST /api/system/communications/initialize
 * Initialize communication monitoring (set checkpoints)
 */
systemRouter.post('/communications/initialize', async (c) => {
  console.log('[API] Initializing communication monitoring...');

  await communicationMonitorService.initialize();

  return c.json({
    success: true,
    message: 'Communication monitoring initialized',
  });
});

export { systemRouter };

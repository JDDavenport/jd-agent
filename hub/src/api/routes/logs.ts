/**
 * JD Agent - Logs API Routes
 * 
 * Endpoints for activity and system logs
 */

import { Hono } from 'hono';
import { db } from '../../db/client';
import { systemLogs } from '../../db/schema';
import { desc, sql } from 'drizzle-orm';

const logsRouter = new Hono();

/**
 * GET /api/logs
 * Get recent activity logs
 */
logsRouter.get('/', async (c) => {
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const type = c.req.query('type');

  let query = db
    .select({
      id: systemLogs.id,
      timestamp: systemLogs.createdAt,
      type: systemLogs.logType,
      message: systemLogs.message,
      metadata: systemLogs.details,
    })
    .from(systemLogs)
    .orderBy(desc(systemLogs.createdAt))
    .limit(Math.min(limit, 100));

  if (type) {
    query = query.where(sql`${systemLogs.logType} = ${type}`);
  }

  const logs = await query;

  return c.json({
    success: true,
    data: logs,
    count: logs.length,
  });
});

export { logsRouter };

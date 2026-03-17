/**
 * Study Help Sync Routes
 * 
 * API endpoints for triggering Canvas sync per user.
 */

import { Hono } from 'hono';
import { db } from '../../db/client';
import { studyHelpUsers } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth, getUserId } from '../middleware/auth';
import { syncUserCanvas, syncAllUsers } from '../../services/study-help-sync';

type Env = { Variables: { userId: string } };
const studyHelpSyncRouter = new Hono<Env>();

// Apply auth to user-facing sync routes
studyHelpSyncRouter.use('/trigger', requireAuth);
studyHelpSyncRouter.use('/status', requireAuth);

/**
 * POST /api/study-help/sync/trigger
 * Trigger a full Canvas sync for the authenticated user
 */
studyHelpSyncRouter.post('/trigger', async (c) => {
  const userId = getUserId(c);

  const [user] = await db
    .select()
    .from(studyHelpUsers)
    .where(eq(studyHelpUsers.id, userId))
    .limit(1);

  if (!user?.canvasAccessTokenEncrypted) {
    return c.json({
      success: false,
      error: { code: 'CANVAS_NOT_CONNECTED', message: 'Please connect your Canvas account first' },
    }, 400);
  }

  try {
    console.log(`[StudyHelpSync] Manual sync triggered for user ${userId}`);
    
    const result = await syncUserCanvas(userId);

    return c.json({
      success: result.success,
      data: {
        coursesUpdated: result.coursesUpdated,
        assignmentsUpdated: result.assignmentsUpdated,
        materialsUpdated: result.materialsUpdated,
        syncedAt: result.syncedAt.toISOString(),
        errors: result.errors.length > 0 ? result.errors.slice(0, 5) : undefined,
      },
    });
  } catch (error) {
    console.error('[StudyHelpSync] Sync trigger error:', error);
    return c.json({
      success: false,
      error: { code: 'SYNC_ERROR', message: 'Failed to sync Canvas data' },
    }, 500);
  }
});

/**
 * GET /api/study-help/sync/status
 * Get sync status for the authenticated user
 */
studyHelpSyncRouter.get('/status', async (c) => {
  try {
    const userId = getUserId(c);

    const [user] = await db
      .select()
      .from(studyHelpUsers)
      .where(eq(studyHelpUsers.id, userId))
      .limit(1);

    return c.json({
      success: true,
      data: {
        canvasConnected: !!user?.canvasAccessTokenEncrypted,
        lastSyncAt: user?.lastSyncAt?.toISOString() || null,
        canvasUserId: user?.canvasUserId,
      },
    });
  } catch (error) {
    console.error('[StudyHelpSync] Status error:', error);
    return c.json({
      success: false,
      error: { code: 'STATUS_ERROR', message: 'Failed to get sync status' },
    }, 500);
  }
});

/**
 * POST /api/study-help/sync/all
 * Admin endpoint: Sync all users (requires admin check in production)
 */
studyHelpSyncRouter.post('/all', async (c) => {
  const adminKey = c.req.header('X-Admin-Key');
  const expectedKey = process.env.ADMIN_API_KEY;
  
  if (expectedKey && adminKey !== expectedKey) {
    return c.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Admin access required' },
    }, 403);
  }

  try {
    console.log('[StudyHelpSync] Admin triggered sync for all users');
    
    const results = await syncAllUsers();

    const summary = {
      totalUsers: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      totalCourses: results.reduce((sum, r) => sum + r.coursesUpdated, 0),
      totalAssignments: results.reduce((sum, r) => sum + r.assignmentsUpdated, 0),
      totalMaterials: results.reduce((sum, r) => sum + r.materialsUpdated, 0),
    };

    return c.json({
      success: true,
      data: {
        summary,
        results: results.map(r => ({
          userId: r.userId,
          success: r.success,
          courses: r.coursesUpdated,
          assignments: r.assignmentsUpdated,
          materials: r.materialsUpdated,
          errors: r.errors.length,
        })),
      },
    });
  } catch (error) {
    console.error('[StudyHelpSync] Sync all error:', error);
    return c.json({
      success: false,
      error: { code: 'SYNC_ERROR', message: 'Failed to sync all users' },
    }, 500);
  }
});

export { studyHelpSyncRouter };

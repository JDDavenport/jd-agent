/**
 * Canvas Sync API Routes for Study Help
 * 
 * Endpoints:
 * - POST /api/canvas/connect - Connect Canvas account
 * - POST /api/canvas/sync - Manual sync
 * - GET /api/canvas/courses - List user's courses
 * - GET /api/canvas/courses/:id/tasks - Get tasks for a course
 * - GET /api/canvas/courses/:id/content - Get content for a course
 */

import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { z } from 'zod';
import { canvasSyncService } from '../../services/canvas-sync-service';
import { studyHelpAuthService } from '../../services/study-help-auth-service';

const canvasSyncRouter = new Hono();

// Session cookie name
const COOKIE_NAME = 'study_help_session';

/**
 * Auth middleware - verify session and get user ID
 */
async function requireAuth(c: any): Promise<string | null> {
  const sessionToken = getCookie(c, COOKIE_NAME);
  
  if (!sessionToken) {
    return null;
  }

  try {
    const user = await studyHelpAuthService.validateSession(sessionToken);
    return user?.id || null;
  } catch {
    return null;
  }
}

/**
 * POST /api/canvas/connect
 * Connect Canvas account with access token
 */
canvasSyncRouter.post('/connect', async (c) => {
  const userId = await requireAuth(c);
  
  if (!userId) {
    return c.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Please log in first' },
    }, 401);
  }

  try {
    const body = await c.req.json();
    const { canvasToken, canvasUrl } = body;

    if (!canvasToken) {
      return c.json({
        success: false,
        error: { code: 'MISSING_TOKEN', message: 'Canvas access token is required' },
      }, 400);
    }

    const result = await canvasSyncService.connectCanvas(userId, canvasToken, canvasUrl);

    if (!result.success) {
      return c.json({
        success: false,
        error: { code: 'CONNECT_FAILED', message: result.error },
      }, 400);
    }

    return c.json({
      success: true,
      data: {
        message: 'Canvas connected successfully',
        coursesFound: result.coursesFound,
      },
    });
  } catch (error) {
    console.error('[CanvasSync] Connect error:', error);
    return c.json({
      success: false,
      error: { 
        code: 'CONNECT_ERROR', 
        message: error instanceof Error ? error.message : 'Failed to connect Canvas' 
      },
    }, 500);
  }
});

/**
 * POST /api/canvas/sync
 * Trigger manual sync of Canvas content
 */
canvasSyncRouter.post('/sync', async (c) => {
  const userId = await requireAuth(c);
  
  if (!userId) {
    return c.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Please log in first' },
    }, 401);
  }

  try {
    console.log(`[CanvasSync] Starting sync for user ${userId}`);
    const result = await canvasSyncService.syncUserCourses(userId);

    return c.json({
      success: true,
      data: {
        courses: result.courses,
        assignments: result.assignments,
        tasksCreated: result.tasks,
        pagesProcessed: result.pages,
        filesProcessed: result.files,
        chunksCreated: result.chunks,
        errors: result.errors,
      },
    });
  } catch (error) {
    console.error('[CanvasSync] Sync error:', error);
    return c.json({
      success: false,
      error: { 
        code: 'SYNC_ERROR', 
        message: error instanceof Error ? error.message : 'Sync failed' 
      },
    }, 500);
  }
});

/**
 * GET /api/canvas/courses
 * List user's Canvas courses
 */
canvasSyncRouter.get('/courses', async (c) => {
  const userId = await requireAuth(c);
  
  if (!userId) {
    return c.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Please log in first' },
    }, 401);
  }

  try {
    const courses = await canvasSyncService.getUserCourses(userId);

    return c.json({
      success: true,
      data: courses,
    });
  } catch (error) {
    console.error('[CanvasSync] Get courses error:', error);
    return c.json({
      success: false,
      error: { 
        code: 'FETCH_ERROR', 
        message: error instanceof Error ? error.message : 'Failed to fetch courses' 
      },
    }, 500);
  }
});

/**
 * GET /api/canvas/courses/:id/tasks
 * Get tasks for a specific course
 */
canvasSyncRouter.get('/courses/:id/tasks', async (c) => {
  const userId = await requireAuth(c);
  const courseId = c.req.param('id');
  
  if (!userId) {
    return c.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Please log in first' },
    }, 401);
  }

  try {
    const tasks = await canvasSyncService.getCourseTasks(courseId, userId);

    return c.json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    console.error('[CanvasSync] Get tasks error:', error);
    return c.json({
      success: false,
      error: { 
        code: 'FETCH_ERROR', 
        message: error instanceof Error ? error.message : 'Failed to fetch tasks' 
      },
    }, 500);
  }
});

/**
 * GET /api/canvas/courses/:id/content
 * Get content chunks for a specific course (for RAG)
 */
canvasSyncRouter.get('/courses/:id/content', async (c) => {
  const userId = await requireAuth(c);
  const courseId = c.req.param('id');
  
  if (!userId) {
    return c.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Please log in first' },
    }, 401);
  }

  try {
    const content = await canvasSyncService.getCourseContent(courseId, userId);

    return c.json({
      success: true,
      data: content,
    });
  } catch (error) {
    console.error('[CanvasSync] Get content error:', error);
    return c.json({
      success: false,
      error: { 
        code: 'FETCH_ERROR', 
        message: error instanceof Error ? error.message : 'Failed to fetch content' 
      },
    }, 500);
  }
});

/**
 * GET /api/canvas/status
 * Check if Canvas is connected for the user
 */
canvasSyncRouter.get('/status', async (c) => {
  const userId = await requireAuth(c);
  
  if (!userId) {
    return c.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Please log in first' },
    }, 401);
  }

  try {
    const courses = await canvasSyncService.getUserCourses(userId);
    
    return c.json({
      success: true,
      data: {
        connected: courses.length > 0,
        courseCount: courses.length,
        lastSync: courses[0]?.lastContentSyncAt || null,
      },
    });
  } catch (error) {
    console.error('[CanvasSync] Status error:', error);
    return c.json({
      success: false,
      error: { 
        code: 'STATUS_ERROR', 
        message: error instanceof Error ? error.message : 'Failed to check status' 
      },
    }, 500);
  }
});

export { canvasSyncRouter };

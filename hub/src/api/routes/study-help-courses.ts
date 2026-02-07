/**
 * Study Help Courses API
 * 
 * Manages user course enrollments with per-user Canvas integration.
 * Each user connects their own Canvas account.
 */

import { Hono } from 'hono';
import { db } from '../../db/client';
import { studyHelpUsers, studyHelpUserCourses } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { getDecryptedCanvasToken, getInstitutionForUser } from './study-help-auth';
import { createUserCanvasClient, UserCanvasClient } from '../../integrations/canvas-user';
import { requireClerkAuth } from '../middleware/clerk-auth';
import { resolveUser, getUserId } from '../middleware/resolve-user';

type Env = { Variables: { clerkUserId: string; userId: string } };
const studyHelpCoursesRouter = new Hono<Env>();

// Apply Clerk auth to all courses routes
studyHelpCoursesRouter.use('*', requireClerkAuth);
studyHelpCoursesRouter.use('*', resolveUser);

// ============================================
// Helper functions
// ============================================

function getIconForCourse(name: string): string {
  const iconMap: Record<string, string> = {
    'analytics': '📊', 'strategy': '🎯', 'finance': '💰', 'marketing': '📣',
    'leadership': '👔', 'entrepreneurship': '💡', 'innovation': '💡',
    'acquisition': '🏢', 'venture': '💰', 'capital': '💰', 'career': '🚀',
    'accounting': '📋', 'operations': '⚙️', 'economics': '📈',
  };
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(iconMap)) {
    if (lower.includes(key)) return icon;
  }
  return '📚';
}

function getColorForCourse(name: string): string {
  const colorMap: Record<string, string> = {
    'analytics': 'blue', 'strategy': 'purple', 'finance': 'green', 'marketing': 'orange',
    'leadership': 'cyan', 'entrepreneurship': 'orange', 'innovation': 'orange',
    'acquisition': 'rose', 'venture': 'green', 'capital': 'green', 'career': 'amber',
    'accounting': 'gray', 'operations': 'gray', 'economics': 'blue',
  };
  const lower = name.toLowerCase();
  for (const [key, color] of Object.entries(colorMap)) {
    if (lower.includes(key)) return color;
  }
  return 'gray';
}

function getCurrentTerm(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  if (month >= 0 && month <= 4) return `Winter ${year}`;
  if (month >= 5 && month <= 7) return `Summer ${year}`;
  return `Fall ${year}`;
}

/**
 * Get Canvas client for the authenticated user
 */
async function getUserCanvasClient(userId: string): Promise<{
  user: any;
  canvasClient: UserCanvasClient | null;
  institution: any;
}> {
  const [user] = await db
    .select()
    .from(studyHelpUsers)
    .where(eq(studyHelpUsers.id, userId))
    .limit(1);

  if (!user) {
    return { user: null, canvasClient: null, institution: null };
  }

  // Get institution for Canvas URL
  const institution = await getInstitutionForUser(user);
  const canvasBaseUrl = institution?.canvasBaseUrl || null;

  // Get decrypted Canvas token
  const canvasToken = getDecryptedCanvasToken(user);
  const canvasClient = createUserCanvasClient(canvasBaseUrl, canvasToken);

  return { user, canvasClient, institution };
}

// ============================================
// Routes
// ============================================

/**
 * GET /api/study-help/courses
 * Get current user's enrolled courses
 */
studyHelpCoursesRouter.get('/', async (c) => {
  const userId = getUserId(c);
  const { user } = await getUserCanvasClient(userId);

  try {
    const courses = await db
      .select()
      .from(studyHelpUserCourses)
      .where(
        and(
          eq(studyHelpUserCourses.userId, user.id),
          eq(studyHelpUserCourses.isActive, true)
        )
      );

    const enrichedCourses = courses.map((course) => ({
      id: course.id,
      canvasCourseId: course.canvasCourseId,
      courseName: course.courseName,
      courseCode: course.courseCode,
      term: course.term,
      isPinned: course.isPinned,
      icon: getIconForCourse(course.courseName || ''),
      color: getColorForCourse(course.courseName || ''),
    }));

    return c.json({
      success: true,
      data: { 
        courses: enrichedCourses,
        canvasConnected: !!user.canvasTokenEncrypted,
      },
    });
  } catch (error) {
    console.error('[Courses] Error fetching courses:', error);
    return c.json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch courses' },
    }, 500);
  }
});

/**
 * GET /api/study-help/courses/available
 * Get list of available courses from user's Canvas (for adding)
 */
studyHelpCoursesRouter.get('/available', async (c) => {
  const userId = getUserId(c);
  const { user, canvasClient } = await getUserCanvasClient(userId);

  if (!canvasClient) {
    return c.json({
      success: false,
      error: { code: 'CANVAS_NOT_CONNECTED', message: 'Please connect your Canvas account first' },
    }, 400);
  }

  try {
    // Fetch courses from user's Canvas
    const canvasCourses = await canvasClient.getCurrentCourses();
    const currentTerm = getCurrentTerm();
    
    // Get user's current courses to mark which are already added
    const userCourses = await db
      .select({ canvasCourseId: studyHelpUserCourses.canvasCourseId })
      .from(studyHelpUserCourses)
      .where(
        and(
          eq(studyHelpUserCourses.userId, user.id),
          eq(studyHelpUserCourses.isActive, true)
        )
      );

    const userCourseIds = new Set(userCourses.map((c) => c.canvasCourseId));

    const available = canvasCourses.map((course) => ({
      canvasCourseId: String(course.id),
      courseName: course.name,
      courseCode: course.course_code || '',
      term: currentTerm,
      icon: getIconForCourse(course.name),
      color: getColorForCourse(course.name),
      isEnrolled: userCourseIds.has(String(course.id)),
      workflowState: course.workflow_state,
    }));

    return c.json({
      success: true,
      data: { courses: available },
    });
  } catch (error) {
    console.error('[Courses] Error fetching available courses:', error);
    return c.json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch available courses from Canvas' },
    }, 500);
  }
});

/**
 * POST /api/study-help/courses
 * Add a course to user's enrollment
 */
studyHelpCoursesRouter.post('/', async (c) => {
  const userId = getUserId(c);
  const { user, canvasClient } = await getUserCanvasClient(userId);

  try {
    const body = await c.req.json();
    const { canvasCourseId, courseName, courseCode } = body;

    if (!canvasCourseId) {
      return c.json({
        success: false,
        error: { code: 'MISSING_FIELD', message: 'canvasCourseId is required' },
      }, 400);
    }

    // If Canvas is connected, verify the course exists
    let finalCourseName = courseName;
    let finalCourseCode = courseCode;

    if (canvasClient && !courseName) {
      const canvasCourses = await canvasClient.getCurrentCourses();
      const courseInfo = canvasCourses.find(c => String(c.id) === canvasCourseId);
      
      if (courseInfo) {
        finalCourseName = courseInfo.name;
        finalCourseCode = courseInfo.course_code;
      }
    }

    // Check if already enrolled
    const [existing] = await db
      .select()
      .from(studyHelpUserCourses)
      .where(
        and(
          eq(studyHelpUserCourses.userId, user.id),
          eq(studyHelpUserCourses.canvasCourseId, canvasCourseId)
        )
      )
      .limit(1);

    if (existing) {
      // Reactivate if inactive
      if (!existing.isActive) {
        await db
          .update(studyHelpUserCourses)
          .set({ isActive: true, updatedAt: new Date() })
          .where(eq(studyHelpUserCourses.id, existing.id));
      }

      return c.json({
        success: true,
        data: {
          course: {
            ...existing,
            isActive: true,
            icon: getIconForCourse(existing.courseName || ''),
            color: getColorForCourse(existing.courseName || ''),
          },
        },
      });
    }

    // Create new enrollment
    const [newCourse] = await db
      .insert(studyHelpUserCourses)
      .values({
        userId: user.id,
        canvasCourseId,
        courseName: finalCourseName || 'Unknown Course',
        courseCode: finalCourseCode || null,
        term: getCurrentTerm(),
      })
      .returning();

    return c.json({
      success: true,
      data: {
        course: {
          ...newCourse,
          icon: getIconForCourse(newCourse.courseName || ''),
          color: getColorForCourse(newCourse.courseName || ''),
        },
      },
    });
  } catch (error) {
    console.error('[Courses] Error adding course:', error);
    return c.json({
      success: false,
      error: { code: 'ADD_ERROR', message: 'Failed to add course' },
    }, 500);
  }
});

/**
 * POST /api/study-help/courses/bulk
 * Add multiple courses at once
 */
studyHelpCoursesRouter.post('/bulk', async (c) => {
  const userId = getUserId(c);
  const { user, canvasClient } = await getUserCanvasClient(userId);

  try {
    const body = await c.req.json();
    const { canvasCourseIds } = body;

    if (!Array.isArray(canvasCourseIds) || canvasCourseIds.length === 0) {
      return c.json({
        success: false,
        error: { code: 'MISSING_FIELD', message: 'canvasCourseIds array is required' },
      }, 400);
    }

    // Fetch course info from Canvas if connected
    let canvasCourses: any[] = [];
    if (canvasClient) {
      canvasCourses = await canvasClient.getCurrentCourses();
    }

    const addedCourses = [];
    const currentTerm = getCurrentTerm();

    for (const canvasCourseId of canvasCourseIds) {
      const courseInfo = canvasCourses.find(c => String(c.id) === canvasCourseId);

      // Check if already enrolled
      const [existing] = await db
        .select()
        .from(studyHelpUserCourses)
        .where(
          and(
            eq(studyHelpUserCourses.userId, user.id),
            eq(studyHelpUserCourses.canvasCourseId, canvasCourseId)
          )
        )
        .limit(1);

      if (existing) {
        if (!existing.isActive) {
          await db
            .update(studyHelpUserCourses)
            .set({ isActive: true, updatedAt: new Date() })
            .where(eq(studyHelpUserCourses.id, existing.id));
        }
        addedCourses.push({
          ...existing,
          isActive: true,
          icon: getIconForCourse(existing.courseName || ''),
          color: getColorForCourse(existing.courseName || ''),
        });
      } else {
        const courseName = courseInfo?.name || `Course ${canvasCourseId}`;
        const courseCode = courseInfo?.course_code || null;

        const [newCourse] = await db
          .insert(studyHelpUserCourses)
          .values({
            userId: user.id,
            canvasCourseId,
            courseName,
            courseCode,
            term: currentTerm,
          })
          .returning();

        addedCourses.push({
          ...newCourse,
          icon: getIconForCourse(courseName),
          color: getColorForCourse(courseName),
        });
      }
    }

    return c.json({
      success: true,
      data: { courses: addedCourses },
    });
  } catch (error) {
    console.error('[Courses] Error adding courses:', error);
    return c.json({
      success: false,
      error: { code: 'ADD_ERROR', message: 'Failed to add courses' },
    }, 500);
  }
});

/**
 * DELETE /api/study-help/courses/:courseId
 * Remove a course (soft delete)
 */
studyHelpCoursesRouter.delete('/:courseId', async (c) => {
  const userId = getUserId(c);
  const { user } = await getUserCanvasClient(userId);

  try {
    const courseId = c.req.param('courseId');

    const [updated] = await db
      .update(studyHelpUserCourses)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(studyHelpUserCourses.id, courseId),
          eq(studyHelpUserCourses.userId, user.id)
        )
      )
      .returning();

    if (!updated) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Course not found' },
      }, 404);
    }

    return c.json({
      success: true,
      data: { message: 'Course removed' },
    });
  } catch (error) {
    console.error('[Courses] Error removing course:', error);
    return c.json({
      success: false,
      error: { code: 'REMOVE_ERROR', message: 'Failed to remove course' },
    }, 500);
  }
});

/**
 * PATCH /api/study-help/courses/:courseId/pin
 * Toggle pin status
 */
studyHelpCoursesRouter.patch('/:courseId/pin', async (c) => {
  const userId = getUserId(c);
  const { user } = await getUserCanvasClient(userId);

  try {
    const courseId = c.req.param('courseId');

    const [course] = await db
      .select()
      .from(studyHelpUserCourses)
      .where(
        and(
          eq(studyHelpUserCourses.id, courseId),
          eq(studyHelpUserCourses.userId, user.id)
        )
      )
      .limit(1);

    if (!course) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Course not found' },
      }, 404);
    }

    const [updated] = await db
      .update(studyHelpUserCourses)
      .set({ isPinned: !course.isPinned, updatedAt: new Date() })
      .where(eq(studyHelpUserCourses.id, courseId))
      .returning();

    return c.json({
      success: true,
      data: { course: updated },
    });
  } catch (error) {
    console.error('[Courses] Error toggling pin:', error);
    return c.json({
      success: false,
      error: { code: 'PIN_ERROR', message: 'Failed to toggle pin' },
    }, 500);
  }
});

/**
 * POST /api/study-help/courses/sync
 * Sync courses from user's Canvas
 */
studyHelpCoursesRouter.post('/sync', async (c) => {
  const userId = getUserId(c);
  const { user, canvasClient } = await getUserCanvasClient(userId);

  if (!canvasClient) {
    return c.json({
      success: false,
      error: { code: 'CANVAS_NOT_CONNECTED', message: 'Please connect your Canvas account first' },
    }, 400);
  }

  try {
    console.log('[Courses] Starting Canvas sync for user:', user.id);
    
    const canvasCourses = await canvasClient.getCurrentCourses();
    const currentTerm = getCurrentTerm();
    const syncedCourses: any[] = [];

    for (const course of canvasCourses) {
      if (course.workflow_state !== 'available') continue;

      const canvasCourseId = String(course.id);

      const [existing] = await db
        .select()
        .from(studyHelpUserCourses)
        .where(and(
          eq(studyHelpUserCourses.userId, user.id),
          eq(studyHelpUserCourses.canvasCourseId, canvasCourseId)
        ))
        .limit(1);

      if (existing) {
        await db
          .update(studyHelpUserCourses)
          .set({
            courseName: course.name,
            courseCode: course.course_code,
            term: currentTerm,
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(studyHelpUserCourses.id, existing.id));

        syncedCourses.push({
          ...existing,
          courseName: course.name,
          courseCode: course.course_code,
          term: currentTerm,
          isActive: true,
          icon: getIconForCourse(course.name),
          color: getColorForCourse(course.name),
        });
      } else {
        const [newCourse] = await db
          .insert(studyHelpUserCourses)
          .values({
            userId: user.id,
            canvasCourseId,
            courseName: course.name,
            courseCode: course.course_code,
            term: currentTerm,
          })
          .returning();

        syncedCourses.push({
          ...newCourse,
          icon: getIconForCourse(course.name),
          color: getColorForCourse(course.name),
        });
      }
    }

    console.log(`[Courses] Synced ${syncedCourses.length} courses for user ${user.id}`);

    return c.json({
      success: true,
      data: {
        courses: syncedCourses,
        syncedAt: new Date().toISOString(),
        totalFromCanvas: canvasCourses.length,
        currentSemester: currentTerm,
      },
    });
  } catch (error) {
    console.error('[Courses] Error syncing from Canvas:', error);
    return c.json({
      success: false,
      error: { code: 'SYNC_ERROR', message: 'Failed to sync courses from Canvas' },
    }, 500);
  }
});

/**
 * GET /api/study-help/courses/canvas
 * Get courses directly from Canvas for preview
 */
studyHelpCoursesRouter.get('/canvas', async (c) => {
  const userId = getUserId(c);
  const { user, canvasClient } = await getUserCanvasClient(userId);

  if (!canvasClient) {
    return c.json({
      success: false,
      error: { code: 'CANVAS_NOT_CONNECTED', message: 'Please connect your Canvas account first' },
    }, 400);
  }

  try {
    const canvasCourses = await canvasClient.getCourses();

    const userCourses = await db
      .select({ canvasCourseId: studyHelpUserCourses.canvasCourseId })
      .from(studyHelpUserCourses)
      .where(and(
        eq(studyHelpUserCourses.userId, user.id),
        eq(studyHelpUserCourses.isActive, true)
      ));

    const userCourseIds = new Set(userCourses.map(c => c.canvasCourseId));

    const courses = canvasCourses.map(course => ({
      canvasCourseId: String(course.id),
      courseName: course.name,
      courseCode: course.course_code || null,
      startDate: course.start_at,
      endDate: course.end_at,
      isEnrolled: userCourseIds.has(String(course.id)),
    }));

    return c.json({ success: true, data: { courses } });
  } catch (error) {
    console.error('[Courses] Error fetching from Canvas:', error);
    return c.json({
      success: false,
      error: { code: 'CANVAS_ERROR', message: 'Failed to fetch courses from Canvas' },
    }, 500);
  }
});

/**
 * POST /api/study-help/courses/manual
 * Add a course manually (without Canvas)
 */
studyHelpCoursesRouter.post('/manual', async (c) => {
  const userId = getUserId(c);
  const { user } = await getUserCanvasClient(userId);

  try {
    const body = await c.req.json();
    const { courseName, courseCode, term, icon, color } = body;

    if (!courseName) {
      return c.json({
        success: false,
        error: { code: 'MISSING_FIELD', message: 'courseName is required' },
      }, 400);
    }

    const canvasCourseId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const [newCourse] = await db
      .insert(studyHelpUserCourses)
      .values({
        userId: user.id,
        canvasCourseId,
        courseName,
        courseCode: courseCode || null,
        term: term || getCurrentTerm(),
      })
      .returning();

    return c.json({
      success: true,
      data: {
        course: {
          ...newCourse,
          icon: icon || getIconForCourse(courseName),
          color: color || getColorForCourse(courseName),
          source: 'manual',
        },
      },
    });
  } catch (error) {
    console.error('[Courses] Error adding manual course:', error);
    return c.json({
      success: false,
      error: { code: 'ADD_ERROR', message: 'Failed to add course' },
    }, 500);
  }
});

export { studyHelpCoursesRouter };

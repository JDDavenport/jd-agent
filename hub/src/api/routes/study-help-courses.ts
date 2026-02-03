import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { db } from '../../db/client';
import { studyHelpUsers, studyHelpSessions, studyHelpUserCourses } from '../../db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { createHash } from 'crypto';
import { CanvasIntegration } from '../../integrations/canvas';

// Canvas integration instance (uses env vars for token)
const canvasApi = new CanvasIntegration();

const studyHelpCoursesRouter = new Hono();

const COOKIE_NAME = 'study_help_session';

// Hash token for lookup
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Auth middleware - get user from session
async function getUserFromSession(sessionToken: string | undefined) {
  if (!sessionToken) return null;

  const tokenHash = hashToken(sessionToken);

  const [session] = await db
    .select()
    .from(studyHelpSessions)
    .where(
      and(
        eq(studyHelpSessions.tokenHash, tokenHash),
        gt(studyHelpSessions.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!session) return null;

  const [user] = await db
    .select()
    .from(studyHelpUsers)
    .where(eq(studyHelpUsers.id, session.userId))
    .limit(1);

  return user?.isActive ? user : null;
}

// Helper functions for course icons and colors
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

// Helper to get current term string
function getCurrentTerm(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  if (month >= 0 && month <= 4) return `Winter ${year}`;
  if (month >= 5 && month <= 7) return `Summer ${year}`;
  return `Fall ${year}`;
}

// Fetch available courses from Canvas API dynamically
async function fetchAvailableCourses(): Promise<Array<{
  canvasCourseId: string;
  courseName: string;
  courseCode: string;
  term: string;
  icon: string;
  color: string;
}>> {
  try {
    const canvasCourses = await canvasApi.getCourses();
    const currentTerm = getCurrentTerm();
    const now = new Date();
    
    // Filter to current/active courses
    const activeCourses = canvasCourses.filter(course => {
      if (course.workflow_state === 'deleted') return false;
      // Include available courses or unpublished (upcoming)
      if (course.workflow_state === 'available') return true;
      // For unpublished, include if start date is within 60 days
      if (course.start_at) {
        const startDate = new Date(course.start_at);
        const daysUntilStart = (startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        if (daysUntilStart >= -30 && daysUntilStart <= 60) return true;
      }
      return false;
    });
    
    return activeCourses.map(course => ({
      canvasCourseId: String(course.id),
      courseName: course.name,
      courseCode: course.course_code || '',
      term: currentTerm,
      icon: getIconForCourse(course.name),
      color: getColorForCourse(course.name),
    }));
  } catch (error) {
    console.error('[Courses] Error fetching from Canvas:', error);
    return [];
  }
}

/**
 * GET /api/study-help/courses
 * Get current user's enrolled courses
 */
studyHelpCoursesRouter.get('/', async (c) => {
  const sessionToken = getCookie(c, COOKIE_NAME);
  const user = await getUserFromSession(sessionToken);

  if (!user) {
    return c.json(
      {
        success: false,
        error: { code: 'NOT_AUTHENTICATED', message: 'Please log in' },
      },
      401
    );
  }

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

    // Enrich with dynamic icons/colors based on course name
    const enrichedCourses = courses.map((course) => {
      return {
        id: course.id,
        canvasCourseId: course.canvasCourseId,
        courseName: course.courseName,
        courseCode: course.courseCode,
        term: course.term,
        isPinned: course.isPinned,
        icon: getIconForCourse(course.courseName || ''),
        color: getColorForCourse(course.courseName || ''),
      };
    });

    return c.json({
      success: true,
      data: { courses: enrichedCourses },
    });
  } catch (error) {
    console.error('[Courses] Error fetching courses:', error);
    return c.json(
      {
        success: false,
        error: { code: 'FETCH_ERROR', message: 'Failed to fetch courses' },
      },
      500
    );
  }
});

/**
 * GET /api/study-help/courses/available
 * Get list of available courses that can be added (fetched from Canvas)
 */
studyHelpCoursesRouter.get('/available', async (c) => {
  const sessionToken = getCookie(c, COOKIE_NAME);
  const user = await getUserFromSession(sessionToken);

  if (!user) {
    return c.json(
      {
        success: false,
        error: { code: 'NOT_AUTHENTICATED', message: 'Please log in' },
      },
      401
    );
  }

  try {
    // Fetch courses from Canvas dynamically
    const canvasCourses = await fetchAvailableCourses();
    
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
      ...course,
      isEnrolled: userCourseIds.has(course.canvasCourseId),
    }));

    return c.json({
      success: true,
      data: { courses: available },
    });
  } catch (error) {
    console.error('[Courses] Error fetching available courses:', error);
    return c.json(
      {
        success: false,
        error: { code: 'FETCH_ERROR', message: 'Failed to fetch available courses' },
      },
      500
    );
  }
});

/**
 * POST /api/study-help/courses
 * Add a course to user's enrollment
 */
studyHelpCoursesRouter.post('/', async (c) => {
  const sessionToken = getCookie(c, COOKIE_NAME);
  const user = await getUserFromSession(sessionToken);

  if (!user) {
    return c.json(
      {
        success: false,
        error: { code: 'NOT_AUTHENTICATED', message: 'Please log in' },
      },
      401
    );
  }

  try {
    const body = await c.req.json();
    const { canvasCourseId } = body;

    if (!canvasCourseId) {
      return c.json(
        {
          success: false,
          error: { code: 'MISSING_FIELD', message: 'canvasCourseId is required' },
        },
        400
      );
    }

    // Find course info from Canvas
    const availableCourses = await fetchAvailableCourses();
    const courseInfo = availableCourses.find(
      (c) => c.canvasCourseId === canvasCourseId
    );

    if (!courseInfo) {
      return c.json(
        {
          success: false,
          error: { code: 'INVALID_COURSE', message: 'Course not found in Canvas' },
        },
        404
      );
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
            icon: courseInfo.icon,
            color: courseInfo.color,
          },
        },
      });
    }

    // Create new enrollment
    const [newCourse] = await db
      .insert(studyHelpUserCourses)
      .values({
        userId: user.id,
        canvasCourseId: courseInfo.canvasCourseId,
        courseName: courseInfo.courseName,
        courseCode: courseInfo.courseCode,
        term: courseInfo.term,
      })
      .returning();

    return c.json({
      success: true,
      data: {
        course: {
          ...newCourse,
          icon: courseInfo.icon,
          color: courseInfo.color,
        },
      },
    });
  } catch (error) {
    console.error('[Courses] Error adding course:', error);
    return c.json(
      {
        success: false,
        error: { code: 'ADD_ERROR', message: 'Failed to add course' },
      },
      500
    );
  }
});

/**
 * POST /api/study-help/courses/bulk
 * Add multiple courses at once (for initial setup)
 */
studyHelpCoursesRouter.post('/bulk', async (c) => {
  const sessionToken = getCookie(c, COOKIE_NAME);
  const user = await getUserFromSession(sessionToken);

  if (!user) {
    return c.json(
      {
        success: false,
        error: { code: 'NOT_AUTHENTICATED', message: 'Please log in' },
      },
      401
    );
  }

  try {
    const body = await c.req.json();
    const { canvasCourseIds } = body;

    if (!Array.isArray(canvasCourseIds) || canvasCourseIds.length === 0) {
      return c.json(
        {
          success: false,
          error: { code: 'MISSING_FIELD', message: 'canvasCourseIds array is required' },
        },
        400
      );
    }

    const addedCourses = [];
    
    // Fetch available courses from Canvas once
    const availableCourses = await fetchAvailableCourses();

    for (const canvasCourseId of canvasCourseIds) {
      const courseInfo = availableCourses.find(
        (c) => c.canvasCourseId === canvasCourseId
      );

      if (!courseInfo) continue;

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
        addedCourses.push({ ...existing, isActive: true, icon: courseInfo.icon, color: courseInfo.color });
      } else {
        const [newCourse] = await db
          .insert(studyHelpUserCourses)
          .values({
            userId: user.id,
            canvasCourseId: courseInfo.canvasCourseId,
            courseName: courseInfo.courseName,
            courseCode: courseInfo.courseCode,
            term: courseInfo.term,
          })
          .returning();

        addedCourses.push({ ...newCourse, icon: courseInfo.icon, color: courseInfo.color });
      }
    }

    return c.json({
      success: true,
      data: { courses: addedCourses },
    });
  } catch (error) {
    console.error('[Courses] Error adding courses:', error);
    return c.json(
      {
        success: false,
        error: { code: 'ADD_ERROR', message: 'Failed to add courses' },
      },
      500
    );
  }
});

/**
 * DELETE /api/study-help/courses/:courseId
 * Remove a course from user's enrollment (soft delete)
 */
studyHelpCoursesRouter.delete('/:courseId', async (c) => {
  const sessionToken = getCookie(c, COOKIE_NAME);
  const user = await getUserFromSession(sessionToken);

  if (!user) {
    return c.json(
      {
        success: false,
        error: { code: 'NOT_AUTHENTICATED', message: 'Please log in' },
      },
      401
    );
  }

  try {
    const courseId = c.req.param('courseId');

    // Soft delete - set isActive to false
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
      return c.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Course not found' },
        },
        404
      );
    }

    return c.json({
      success: true,
      data: { message: 'Course removed' },
    });
  } catch (error) {
    console.error('[Courses] Error removing course:', error);
    return c.json(
      {
        success: false,
        error: { code: 'REMOVE_ERROR', message: 'Failed to remove course' },
      },
      500
    );
  }
});

/**
 * PATCH /api/study-help/courses/:courseId/pin
 * Toggle pin status for a course
 */
studyHelpCoursesRouter.patch('/:courseId/pin', async (c) => {
  const sessionToken = getCookie(c, COOKIE_NAME);
  const user = await getUserFromSession(sessionToken);

  if (!user) {
    return c.json(
      {
        success: false,
        error: { code: 'NOT_AUTHENTICATED', message: 'Please log in' },
      },
      401
    );
  }

  try {
    const courseId = c.req.param('courseId');

    // Get current pin status
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
      return c.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'Course not found' },
        },
        404
      );
    }

    // Toggle pin
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
    return c.json(
      {
        success: false,
        error: { code: 'PIN_ERROR', message: 'Failed to toggle pin' },
      },
      500
    );
  }
});

/**
 * POST /api/study-help/courses/sync
 * Sync courses from Canvas API - auto-detect current semester courses
 */
studyHelpCoursesRouter.post('/sync', async (c) => {
  const sessionToken = getCookie(c, COOKIE_NAME);
  const user = await getUserFromSession(sessionToken);

  if (!user) {
    return c.json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Please log in' } }, 401);
  }

  try {
    console.log('[Courses] Starting Canvas sync for user:', user.id);
    
    // Fetch courses from Canvas API
    const canvasCourses = await canvasApi.getCourses();
    
    // Get current date to filter for current/upcoming terms
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // Determine current term based on month
    let currentTerm = '';
    if (currentMonth >= 0 && currentMonth <= 4) {
      currentTerm = `Winter ${currentYear}`;
    } else if (currentMonth >= 5 && currentMonth <= 7) {
      currentTerm = `Summer ${currentYear}`;
    } else {
      currentTerm = `Fall ${currentYear}`;
    }
    
    // Filter to current semester courses (by recent start date or not ended)
    const currentCourses = canvasCourses.filter(course => {
      if (course.workflow_state === 'deleted' || course.workflow_state === 'unpublished') {
        return false;
      }
      // Include if course started within last 4 months or hasn't ended
      if (course.start_at) {
        const startDate = new Date(course.start_at);
        const monthsAgo = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
        if (monthsAgo >= 0 && monthsAgo <= 4) return true;
      }
      if (course.end_at) {
        const endDate = new Date(course.end_at);
        if (endDate > now) return true;
      }
      return false;
    });
    
    console.log(`[Courses] Found ${currentCourses.length} current semester courses`);
    
    // Sync each course to user's enrollment
    const syncedCourses: any[] = [];
    
    for (const course of currentCourses) {
      const canvasCourseId = String(course.id);
      const courseName = course.name;
      const courseCode = course.course_code || null;
      
      // Check if already exists
      const [existing] = await db
        .select()
        .from(studyHelpUserCourses)
        .where(and(
          eq(studyHelpUserCourses.userId, user.id),
          eq(studyHelpUserCourses.canvasCourseId, canvasCourseId)
        ))
        .limit(1);
      
      if (existing) {
        // Update if name/code changed or reactivate
        await db
          .update(studyHelpUserCourses)
          .set({ courseName, courseCode, term: currentTerm, isActive: true, updatedAt: new Date() })
          .where(eq(studyHelpUserCourses.id, existing.id));
        
        syncedCourses.push({
          ...existing, courseName, courseCode, term: currentTerm, isActive: true,
          icon: getIconForCourse(courseName), color: getColorForCourse(courseName), source: 'canvas',
        });
      } else {
        // Create new
        const [newCourse] = await db
          .insert(studyHelpUserCourses)
          .values({ userId: user.id, canvasCourseId, courseName, courseCode, term: currentTerm })
          .returning();
        
        syncedCourses.push({
          ...newCourse, icon: getIconForCourse(courseName), color: getColorForCourse(courseName), source: 'canvas',
        });
      }
    }
    
    console.log(`[Courses] Synced ${syncedCourses.length} courses for user ${user.id}`);
    
    return c.json({
      success: true,
      data: { courses: syncedCourses, syncedAt: new Date().toISOString(), totalFromCanvas: canvasCourses.length, currentSemester: currentTerm },
    });
  } catch (error) {
    console.error('[Courses] Error syncing from Canvas:', error);
    return c.json({ success: false, error: { code: 'SYNC_ERROR', message: 'Failed to sync courses from Canvas' } }, 500);
  }
});

/**
 * GET /api/study-help/courses/canvas
 * Get courses directly from Canvas API (for preview/selection)
 */
studyHelpCoursesRouter.get('/canvas', async (c) => {
  const sessionToken = getCookie(c, COOKIE_NAME);
  const user = await getUserFromSession(sessionToken);

  if (!user) {
    return c.json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Please log in' } }, 401);
  }

  try {
    const canvasCourses = await canvasApi.getCourses();
    
    const userCourses = await db
      .select({ canvasCourseId: studyHelpUserCourses.canvasCourseId })
      .from(studyHelpUserCourses)
      .where(and(eq(studyHelpUserCourses.userId, user.id), eq(studyHelpUserCourses.isActive, true)));
    
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
    return c.json({ success: false, error: { code: 'CANVAS_ERROR', message: 'Failed to fetch courses from Canvas' } }, 500);
  }
});

/**
 * POST /api/study-help/courses/manual
 * Add a course manually (not from Canvas)
 */
studyHelpCoursesRouter.post('/manual', async (c) => {
  const sessionToken = getCookie(c, COOKIE_NAME);
  const user = await getUserFromSession(sessionToken);

  if (!user) {
    return c.json({ success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Please log in' } }, 401);
  }

  try {
    const body = await c.req.json();
    const { courseName, courseCode, term, icon, color } = body;
    
    if (!courseName) {
      return c.json({ success: false, error: { code: 'MISSING_FIELD', message: 'courseName is required' } }, 400);
    }
    
    const canvasCourseId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const [newCourse] = await db
      .insert(studyHelpUserCourses)
      .values({ userId: user.id, canvasCourseId, courseName, courseCode: courseCode || null, term: term || null })
      .returning();
    
    return c.json({
      success: true,
      data: { course: { ...newCourse, icon: icon || '📚', color: color || 'gray', source: 'manual' } },
    });
  } catch (error) {
    console.error('[Courses] Error adding manual course:', error);
    return c.json({ success: false, error: { code: 'ADD_ERROR', message: 'Failed to add course' } }, 500);
  }
});

export { studyHelpCoursesRouter };

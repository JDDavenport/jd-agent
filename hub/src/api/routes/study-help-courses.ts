import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { db } from '../../db/client';
import { studyHelpUsers, studyHelpSessions, studyHelpUserCourses } from '../../db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { createHash } from 'crypto';

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

// Available courses that users can select from
// In the future, this could come from Canvas API or database
const AVAILABLE_COURSES = [
  {
    canvasCourseId: '32991',
    courseName: 'Business Analytics',
    courseCode: 'MBA 560',
    term: 'Winter 2026',
    icon: '📊',
    color: 'blue',
  },
  {
    canvasCourseId: '33202',
    courseName: 'Business Strategy',
    courseCode: 'MBA 580',
    term: 'Winter 2026',
    icon: '🎯',
    color: 'purple',
  },
  {
    canvasCourseId: '33259',
    courseName: 'Entrepreneurial Innovation',
    courseCode: 'ENT',
    term: 'Winter 2026',
    icon: '💡',
    color: 'orange',
  },
  {
    canvasCourseId: '34638',
    courseName: 'Venture Capital / Private Equity',
    courseCode: 'MBA 664',
    term: 'Winter 2026',
    icon: '💰',
    color: 'green',
  },
  {
    canvasCourseId: '34458',
    courseName: 'Entrepreneurship Through Acquisition',
    courseCode: 'MBA 677R',
    term: 'Winter 2026',
    icon: '🏢',
    color: 'rose',
  },
  {
    canvasCourseId: '34642',
    courseName: 'Strategic Client Acquisition/Retention',
    courseCode: 'MBA 654',
    term: 'Winter 2026',
    icon: '🤝',
    color: 'cyan',
  },
  {
    canvasCourseId: '34634',
    courseName: 'Post-MBA Career Strategy',
    courseCode: 'MBA 693R',
    term: 'Winter 2026',
    icon: '🚀',
    color: 'amber',
  },
];

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

    // Enrich with static data (icons, colors)
    const enrichedCourses = courses.map((course) => {
      const available = AVAILABLE_COURSES.find(
        (c) => c.canvasCourseId === course.canvasCourseId
      );
      return {
        id: course.id,
        canvasCourseId: course.canvasCourseId,
        courseName: course.courseName,
        courseCode: course.courseCode,
        term: course.term,
        isPinned: course.isPinned,
        icon: available?.icon || '📚',
        color: available?.color || 'gray',
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
 * Get list of available courses that can be added
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

    const available = AVAILABLE_COURSES.map((course) => ({
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

    // Find course info from available courses
    const courseInfo = AVAILABLE_COURSES.find(
      (c) => c.canvasCourseId === canvasCourseId
    );

    if (!courseInfo) {
      return c.json(
        {
          success: false,
          error: { code: 'INVALID_COURSE', message: 'Course not found' },
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

    for (const canvasCourseId of canvasCourseIds) {
      const courseInfo = AVAILABLE_COURSES.find(
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

export { studyHelpCoursesRouter };

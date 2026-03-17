/**
 * Canvas Connect Routes (Clerk Auth)
 * 
 * Handles Canvas onboarding flow for Study Aide:
 * - Token validation + user profile
 * - Course listing
 * - Full comprehensive sync
 * - Sync status
 * 
 * Uses Clerk auth (Bearer token) — compatible with the React frontend.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { requireAuth, getUserId as getAuthUserId } from '../middleware/auth';
import { db } from '../../db/client';
import {
  studyHelpUsers,
  studyHelpUserCourses,
  studyHelpInstitutions,
  classes,
  tasks,
  canvasItems,
  canvasMaterials,
  vaultEntries,
} from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { UserCanvasClient, createUserCanvasClient } from '../../integrations/canvas-user';

type Env = { Variables: { userId: string; authUser: any } };
const canvasConnectRouter = new Hono<Env>();

const ENCRYPTION_KEY = process.env.STUDY_HELP_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || 'default-key-change-me-32-chars!!';

// ============================================
// Crypto helpers
// ============================================

function encryptToken(plainToken: string): string {
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plainToken, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decryptToken(encryptedData: string): string | null {
  try {
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
    const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
    if (!ivHex || !authTagHex || !encrypted) return null;
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function getCurrentTerm(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (month >= 0 && month <= 4) return `Winter ${year}`;
  if (month >= 5 && month <= 7) return `Summer ${year}`;
  return `Fall ${year}`;
}

function guessMaterialType(title: string, type: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('syllabus')) return 'syllabus';
  if (lower.includes('case')) return 'case';
  if (lower.includes('reading') || lower.includes('article')) return 'reading';
  if (lower.includes('slide') || lower.includes('lecture') || lower.includes('ppt')) return 'lecture';
  if (lower.includes('template')) return 'template';
  if (lower.includes('data') || lower.includes('excel') || lower.includes('csv')) return 'data';
  return 'reading';
}

// ============================================
// Helper: get user row from userId (set by auth middleware)
// ============================================

async function getUserById(userId: string) {
  const [user] = await db
    .select()
    .from(studyHelpUsers)
    .where(eq(studyHelpUsers.id, userId))
    .limit(1);
  return user;
}

async function getCanvasClient(user: any): Promise<{ client: UserCanvasClient | null; canvasUrl: string | null }> {
  if (!user.canvasAccessTokenEncrypted) return { client: null, canvasUrl: null };

  const token = decryptToken(user.canvasAccessTokenEncrypted);
  if (!token) return { client: null, canvasUrl: null };

  // Get Canvas URL from institution or stored metadata
  let canvasUrl: string | null = null;
  if (user.institutionId) {
    const [inst] = await db
      .select()
      .from(studyHelpInstitutions)
      .where(eq(studyHelpInstitutions.id, user.institutionId))
      .limit(1);
    canvasUrl = inst?.canvasBaseUrl || null;
  }

  // Fallback: check if URL is stored in canvasUserId field as "url|userId" format
  // Or use a default
  if (!canvasUrl && user.canvasUserId?.includes('|')) {
    canvasUrl = user.canvasUserId.split('|')[0];
  }

  if (!canvasUrl) return { client: null, canvasUrl: null };

  const client = createUserCanvasClient(canvasUrl, token);
  return { client, canvasUrl };
}

// ============================================
// Apply Clerk auth to all routes
// ============================================

canvasConnectRouter.use('*', requireAuth);

// ============================================
// POST /api/canvas/connect
// Validate token, save it, return user info + courses
// ============================================

canvasConnectRouter.post('/connect', async (c) => {
  const userId = getAuthUserId(c);
  const user = await getUserById(userId);

  try {
    const { canvasUrl, canvasToken } = await c.req.json();

    if (!canvasUrl || !canvasToken) {
      return c.json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'Canvas URL and token are required' },
      }, 400);
    }

    // Normalize URL
    let normalizedUrl = canvasUrl.trim();
    if (!normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    normalizedUrl = normalizedUrl.replace(/\/$/, '');

    // Validate token by fetching profile
    const client = new UserCanvasClient(normalizedUrl, canvasToken);
    let profile: any;
    try {
      profile = await client.getProfile();
    } catch (e: any) {
      const msg = e.message || '';
      if (msg.includes('401') || msg.includes('Invalid')) {
        return c.json({
          success: false,
          error: { code: 'INVALID_TOKEN', message: 'Invalid Canvas token. Please check and try again.' },
        }, 400);
      }
      return c.json({
        success: false,
        error: { code: 'CONNECTION_ERROR', message: `Could not reach Canvas at ${normalizedUrl}. Check the URL.` },
      }, 400);
    }

    // Get available courses
    let courses: any[] = [];
    try {
      courses = await client.getCurrentCourses();
    } catch {}

    // Find or create institution
    let institutionId: string | null = null;
    const domain = new URL(normalizedUrl).hostname;
    const [existingInst] = await db
      .select()
      .from(studyHelpInstitutions)
      .where(eq(studyHelpInstitutions.canvasBaseUrl, normalizedUrl))
      .limit(1);

    if (existingInst) {
      institutionId = existingInst.id;
    } else {
      const [newInst] = await db
        .insert(studyHelpInstitutions)
        .values({
          name: domain.replace('.instructure.com', '').toUpperCase(),
          domain,
          shortName: domain.replace('.instructure.com', '').toUpperCase(),
          canvasBaseUrl: normalizedUrl,
          enabled: true,
        })
        .returning();
      institutionId = newInst.id;
    }

    // Encrypt and save token
    const encryptedToken = encryptToken(canvasToken);
    await db
      .update(studyHelpUsers)
      .set({
        canvasAccessTokenEncrypted: encryptedToken,
        canvasUserId: String(profile.id),
        institutionId,
        updatedAt: new Date(),
      })
      .where(eq(studyHelpUsers.id, user.id));

    return c.json({
      success: true,
      data: {
        profile: {
          id: profile.id,
          name: profile.name,
          avatarUrl: profile.avatar_url,
        },
        courses: courses.map(c => ({
          id: String(c.id),
          name: c.name,
          code: c.course_code,
          state: c.workflow_state,
        })),
      },
    });
  } catch (e: any) {
    console.error('[CanvasConnect] Error:', e);
    return c.json({
      success: false,
      error: { code: 'CONNECT_ERROR', message: 'Failed to connect Canvas' },
    }, 500);
  }
});

// ============================================
// GET /api/canvas/status
// Check connection status
// ============================================

canvasConnectRouter.get('/status', async (c) => {
  const userId = getAuthUserId(c);
  const user = await getUserById(userId);

  const connected = !!user.canvasAccessTokenEncrypted;

  let institution = null;
  if (user.institutionId) {
    const [inst] = await db
      .select()
      .from(studyHelpInstitutions)
      .where(eq(studyHelpInstitutions.id, user.institutionId))
      .limit(1);
    if (inst) {
      institution = { name: inst.name, shortName: inst.shortName, canvasBaseUrl: inst.canvasBaseUrl };
    }
  }

  return c.json({
    success: true,
    data: {
      connected,
      canvasUserId: user.canvasUserId,
      lastSyncAt: user.lastSyncAt?.toISOString() || null,
      institution,
    },
  });
});

// ============================================
// GET /api/canvas/courses
// List synced courses
// ============================================

canvasConnectRouter.get('/courses', async (c) => {
  const userId = getAuthUserId(c);
  const user = await getUserById(userId);

  const courses = await db
    .select()
    .from(studyHelpUserCourses)
    .where(and(
      eq(studyHelpUserCourses.userId, user.id),
      eq(studyHelpUserCourses.isActive, true)
    ));

  return c.json({
    success: true,
    data: {
      courses: courses.map(c => ({
        id: c.id,
        canvasCourseId: c.canvasCourseId,
        courseName: c.courseName,
        courseCode: c.courseCode,
        term: c.term,
        isPinned: c.isPinned,
        lastContentSyncAt: c.lastContentSyncAt?.toISOString() || null,
      })),
    },
  });
});

// ============================================
// POST /api/canvas/sync
// Trigger comprehensive sync
// Body: { courseIds?: string[] } — if empty, syncs all courses
// ============================================

canvasConnectRouter.post('/sync', async (c) => {
  const userId = getAuthUserId(c);
  const user = await getUserById(userId);

  const { client, canvasUrl } = await getCanvasClient(user);
  if (!client) {
    return c.json({
      success: false,
      error: { code: 'CANVAS_NOT_CONNECTED', message: 'Connect Canvas first' },
    }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const requestedCourseIds: string[] | undefined = body.courseIds;

  const syncResult = {
    courses: 0,
    assignments: 0,
    modules: 0,
    pages: 0,
    files: 0,
    discussions: 0,
    quizzes: 0,
    announcements: 0,
    errors: [] as string[],
  };

  try {
    console.log(`[CanvasSync] Starting comprehensive sync for user:${userId}`);

    // 1. Fetch all current courses from Canvas
    const canvasCourses = await client.getCurrentCourses();
    const currentTerm = getCurrentTerm();

    // Filter to requested courses if specified
    const coursesToSync = requestedCourseIds
      ? canvasCourses.filter(c => requestedCourseIds.includes(String(c.id)))
      : canvasCourses.filter(c => c.workflow_state === 'available');

    // 2. Upsert user course enrollments
    for (const course of coursesToSync) {
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
        await db.update(studyHelpUserCourses).set({
          courseName: course.name,
          courseCode: course.course_code,
          term: currentTerm,
          isActive: true,
          lastContentSyncAt: new Date(),
          updatedAt: new Date(),
        }).where(eq(studyHelpUserCourses.id, existing.id));
      } else {
        await db.insert(studyHelpUserCourses).values({
          userId: user.id,
          canvasCourseId,
          courseName: course.name,
          courseCode: course.course_code,
          term: currentTerm,
          isActive: true,
        });
      }
      syncResult.courses++;
    }

    // 3. Deep scan each course
    for (const course of coursesToSync) {
      const courseId = course.id;
      const courseName = course.name;

      try {
        // Get or create class record
        let [classRecord] = await db
          .select()
          .from(classes)
          .where(eq(classes.canvasCourseId, String(courseId)))
          .limit(1);

        if (!classRecord) {
          [classRecord] = await db.insert(classes).values({
            name: courseName,
            code: course.course_code,
            canvasCourseId: String(courseId),
            semester: currentTerm,
            status: 'active',
          }).returning();
        }

        const scan = await client.deepScanCourse(courseId);

        // --- Assignments ---
        for (const assignment of scan.assignments) {
          if (!assignment.published) continue;
          const sourceRef = `canvas:assignment:${assignment.id}`;
          const [existing] = await db.select().from(tasks).where(eq(tasks.sourceRef, sourceRef)).limit(1);
          const taskData = {
            title: assignment.name,
            description: assignment.description ? stripHtml(assignment.description).slice(0, 5000) : null,
            dueDate: assignment.due_at ? new Date(assignment.due_at) : null,
            dueDateIsHard: true,
            source: 'canvas' as const,
            sourceRef,
            context: courseName,
            status: 'inbox' as const,
            priority: assignment.points_possible >= 100 ? 3 : 2,
            updatedAt: new Date(),
          };
          if (existing) {
            await db.update(tasks).set(taskData).where(eq(tasks.id, existing.id));
          } else {
            await db.insert(tasks).values(taskData);
          }
          syncResult.assignments++;
        }

        // --- Modules + Items ---
        for (const { module, items } of scan.modules) {
          syncResult.modules++;
          for (const item of items) {
            if (!item.published) continue;
            if (['SubHeader', 'ExternalTool'].includes(item.type)) continue;

            const canvasFileId = item.content_id ? String(item.content_id) : `moduleitem-${item.id}`;
            const [existing] = await db.select().from(canvasMaterials)
              .where(eq(canvasMaterials.canvasFileId, canvasFileId)).limit(1);

            const matData = {
              courseId: classRecord.id,
              canvasFileId,
              fileName: item.title,
              displayName: item.title,
              fileType: item.type === 'File' ? 'file' : item.type === 'Page' ? 'page' : item.type === 'Quiz' ? 'quiz' : 'url',
              canvasUrl: item.html_url,
              moduleName: module.name,
              modulePosition: module.position,
              materialType: guessMaterialType(item.title, item.type),
              lastSyncedAt: new Date(),
              updatedAt: new Date(),
            };

            if (existing) {
              await db.update(canvasMaterials).set(matData).where(eq(canvasMaterials.id, existing.id));
            } else {
              await db.insert(canvasMaterials).values(matData);
            }
          }
        }

        // --- Pages ---
        for (const page of scan.pages) {
          if (!page.published) continue;
          const sourceRef = `canvas:page:${courseId}:${page.url}`;
          const [existing] = await db.select().from(vaultEntries)
            .where(eq(vaultEntries.sourceRef, sourceRef)).limit(1);

          if (!existing) {
            await db.insert(vaultEntries).values({
              title: page.title,
              content: page.body ? stripHtml(page.body).slice(0, 50000) : '',
              contentType: 'note',
              context: courseName,
              tags: ['canvas', 'page'],
              source: 'canvas',
              sourceRef,
              sourceUrl: page.url,
              sourceDate: new Date(page.updated_at),
            });
            syncResult.pages++;
          }
        }

        // --- Files ---
        for (const file of scan.files) {
          if (file.locked || file.hidden) continue;
          const canvasFileId = String(file.id);
          const [existing] = await db.select().from(canvasMaterials)
            .where(eq(canvasMaterials.canvasFileId, canvasFileId)).limit(1);

          if (!existing) {
            await db.insert(canvasMaterials).values({
              courseId: classRecord.id,
              canvasFileId,
              fileName: file.filename,
              displayName: file.display_name,
              fileType: file.content_type?.split('/').pop() || 'file',
              mimeType: file.content_type,
              fileSizeBytes: file.size,
              downloadUrl: file.url,
              materialType: guessMaterialType(file.display_name, 'File'),
              lastSyncedAt: new Date(),
            });
            syncResult.files++;
          }
        }

        // --- Discussions ---
        for (const disc of scan.discussions) {
          if (!disc.published) continue;
          const sourceRef = `canvas:discussion:${disc.id}`;
          const [existing] = await db.select().from(vaultEntries)
            .where(eq(vaultEntries.sourceRef, sourceRef)).limit(1);

          if (!existing) {
            await db.insert(vaultEntries).values({
              title: disc.title,
              content: disc.message ? stripHtml(disc.message).slice(0, 10000) : '',
              contentType: 'note',
              context: courseName,
              tags: ['canvas', 'discussion'],
              source: 'canvas',
              sourceRef,
              sourceUrl: disc.html_url,
              sourceDate: disc.posted_at ? new Date(disc.posted_at) : undefined,
            });
          }

          // If discussion has a due date, create task
          if (disc.due_at) {
            const taskRef = `canvas:discussion-task:${disc.id}`;
            const [existingTask] = await db.select().from(tasks)
              .where(eq(tasks.sourceRef, taskRef)).limit(1);
            if (!existingTask) {
              await db.insert(tasks).values({
                title: `Discussion: ${disc.title}`,
                dueDate: new Date(disc.due_at),
                dueDateIsHard: true,
                source: 'canvas',
                sourceRef: taskRef,
                context: courseName,
                status: 'inbox',
                priority: 2,
              });
            }
          }
          syncResult.discussions++;
        }

        // --- Quizzes ---
        for (const quiz of scan.quizzes) {
          if (!quiz.published) continue;
          if (quiz.due_at) {
            const taskRef = `canvas:quiz:${quiz.id}`;
            const [existingTask] = await db.select().from(tasks)
              .where(eq(tasks.sourceRef, taskRef)).limit(1);
            if (!existingTask) {
              await db.insert(tasks).values({
                title: `Quiz: ${quiz.title}`,
                description: quiz.description ? stripHtml(quiz.description).slice(0, 2000) : null,
                dueDate: new Date(quiz.due_at),
                dueDateIsHard: true,
                source: 'canvas',
                sourceRef: taskRef,
                context: courseName,
                status: 'inbox',
                priority: 2,
              });
            }
          }
          syncResult.quizzes++;
        }

        // --- Announcements ---
        for (const ann of scan.announcements) {
          const sourceRef = `canvas:announcement:${ann.id}`;
          const [existing] = await db.select().from(vaultEntries)
            .where(eq(vaultEntries.sourceRef, sourceRef)).limit(1);

          if (!existing) {
            await db.insert(vaultEntries).values({
              title: ann.title,
              content: ann.message ? stripHtml(ann.message).slice(0, 10000) : '',
              contentType: 'note',
              context: courseName,
              tags: ['canvas', 'announcement'],
              source: 'canvas',
              sourceRef,
              sourceDate: new Date(ann.posted_at),
            });
            syncResult.announcements++;
          }
        }

        // --- Syllabus ---
        if (scan.syllabus) {
          const sourceRef = `canvas:syllabus:${courseId}`;
          const [existing] = await db.select().from(vaultEntries)
            .where(eq(vaultEntries.sourceRef, sourceRef)).limit(1);

          if (!existing) {
            await db.insert(vaultEntries).values({
              title: `${courseName} - Syllabus`,
              content: stripHtml(scan.syllabus).slice(0, 50000),
              contentType: 'document',
              context: courseName,
              tags: ['canvas', 'syllabus'],
              source: 'canvas',
              sourceRef,
            });
          }
        }

      } catch (e: any) {
        syncResult.errors.push(`${courseName}: ${e.message}`);
        console.error(`[CanvasSync] Error syncing ${courseName}:`, e);
      }
    }

    // Update user's last sync time
    await db.update(studyHelpUsers).set({
      lastSyncAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(studyHelpUsers.id, user.id));

    console.log(`[CanvasSync] Complete:`, syncResult);

    return c.json({
      success: true,
      data: syncResult,
    });
  } catch (e: any) {
    console.error('[CanvasSync] Fatal error:', e);
    return c.json({
      success: false,
      error: { code: 'SYNC_ERROR', message: e.message },
    }, 500);
  }
});

// ============================================
// GET /api/canvas/sync/status
// ============================================

canvasConnectRouter.get('/sync/status', async (c) => {
  const userId = getAuthUserId(c);
  const user = await getUserById(userId);

  const courses = await db
    .select()
    .from(studyHelpUserCourses)
    .where(and(
      eq(studyHelpUserCourses.userId, user.id),
      eq(studyHelpUserCourses.isActive, true)
    ));

  return c.json({
    success: true,
    data: {
      connected: !!user.canvasAccessTokenEncrypted,
      lastSyncAt: user.lastSyncAt?.toISOString() || null,
      coursesCount: courses.length,
      courses: courses.map(c => ({
        name: c.courseName,
        code: c.courseCode,
        lastSync: c.lastContentSyncAt?.toISOString() || null,
      })),
    },
  });
});

// ============================================
// DELETE /api/canvas/disconnect
// ============================================

canvasConnectRouter.delete('/disconnect', async (c) => {
  const userId = getAuthUserId(c);
  const user = await getUserById(userId);

  await db.update(studyHelpUsers).set({
    canvasAccessTokenEncrypted: null,
    canvasRefreshTokenEncrypted: null,
    canvasUserId: null,
    updatedAt: new Date(),
  }).where(eq(studyHelpUsers.id, user.id));

  return c.json({ success: true, data: { message: 'Canvas disconnected' } });
});

export { canvasConnectRouter };

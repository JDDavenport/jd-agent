/**
 * Study Help Sync Service
 * 
 * Per-user Canvas sync service. Syncs courses, assignments, and materials
 * for each user based on their own Canvas access token.
 */

import { db } from '../db/client';
import {
  studyHelpUsers,
  studyHelpUserCourses,
  studyHelpInstitutions,
  canvasMaterials,
  classes,
  tasks,
  canvasItems,
} from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { createHash, createDecipheriv } from 'crypto';

// Import the user Canvas client
import { UserCanvasClient, createUserCanvasClient } from '../integrations/canvas-user';

const ENCRYPTION_KEY = process.env.STUDY_HELP_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || 'default-key-change-me-32-chars!!';

// ============================================
// Types
// ============================================

export interface SyncResult {
  success: boolean;
  userId: string;
  coursesUpdated: number;
  assignmentsUpdated: number;
  materialsUpdated: number;
  errors: string[];
  syncedAt: Date;
}

export interface UserSyncContext {
  userId: string;
  email: string;
  canvasToken: string;
  canvasBaseUrl: string;
  institutionId: string | null;
}

// ============================================
// Helpers
// ============================================

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

async function getUserSyncContext(userId: string): Promise<UserSyncContext | null> {
  const [user] = await db
    .select()
    .from(studyHelpUsers)
    .where(eq(studyHelpUsers.id, userId))
    .limit(1);

  if (!user || !user.canvasAccessTokenEncrypted) {
    return null;
  }

  const canvasToken = decryptToken(user.canvasAccessTokenEncrypted);
  if (!canvasToken) {
    return null;
  }

  // Get Canvas URL from institution
  let canvasBaseUrl: string | null = null;
  if (user.institutionId) {
    const [institution] = await db
      .select()
      .from(studyHelpInstitutions)
      .where(eq(studyHelpInstitutions.id, user.institutionId))
      .limit(1);
    canvasBaseUrl = institution?.canvasBaseUrl || null;
  }

  if (!canvasBaseUrl) {
    return null;
  }

  return {
    userId: user.id,
    email: user.email,
    canvasToken,
    canvasBaseUrl,
    institutionId: user.institutionId,
  };
}

// ============================================
// Sync Functions
// ============================================

/**
 * Sync courses for a user from Canvas
 */
async function syncCourses(
  canvasClient: UserCanvasClient,
  ctx: UserSyncContext
): Promise<{ updated: number; courseIds: string[] }> {
  const canvasCourses = await canvasClient.getCurrentCourses();
  const courseIds: string[] = [];
  let updated = 0;

  for (const course of canvasCourses) {
    if (course.workflow_state !== 'available') continue;

    const canvasCourseId = String(course.id);
    courseIds.push(canvasCourseId);

    // Upsert user course enrollment
    const [existing] = await db
      .select()
      .from(studyHelpUserCourses)
      .where(and(
        eq(studyHelpUserCourses.userId, ctx.userId),
        eq(studyHelpUserCourses.canvasCourseId, canvasCourseId)
      ))
      .limit(1);

    const term = getCurrentTerm();

    if (existing) {
      await db
        .update(studyHelpUserCourses)
        .set({
          courseName: course.name,
          courseCode: course.course_code,
          term,
          isActive: true,
          lastContentSyncAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(studyHelpUserCourses.id, existing.id));
    } else {
      await db
        .insert(studyHelpUserCourses)
        .values({
          userId: ctx.userId,
          canvasCourseId,
          courseName: course.name,
          courseCode: course.course_code,
          term,
          isActive: true,
        });
    }
    updated++;
  }

  return { updated, courseIds };
}

/**
 * Sync assignments for user's enrolled courses
 */
async function syncAssignments(
  canvasClient: UserCanvasClient,
  ctx: UserSyncContext,
  courseIds: string[]
): Promise<{ updated: number; errors: string[] }> {
  let updated = 0;
  const errors: string[] = [];

  for (const canvasCourseId of courseIds) {
    try {
      const assignments = await canvasClient.getAssignments(parseInt(canvasCourseId));
      
      // Get or create class record
      let classRecord = await getOrCreateClass(canvasCourseId, ctx);
      if (!classRecord) continue;

      for (const assignment of assignments) {
        if (!assignment.published) continue;

        // Upsert assignment as task
        const sourceRef = `canvas-${assignment.id}`;
        
        const [existingTask] = await db
          .select()
          .from(tasks)
          .where(eq(tasks.sourceRef, sourceRef))
          .limit(1);

        const taskData = {
          title: assignment.name,
          description: assignment.description?.slice(0, 5000) || null,
          dueDate: assignment.due_at ? new Date(assignment.due_at) : null,
          source: 'canvas' as const,
          sourceRef,
          context: classRecord.code || classRecord.name,
          status: 'inbox' as const,
          priority: assignment.due_at ? 2 : 1,
          updatedAt: new Date(),
        };

        if (existingTask) {
          await db
            .update(tasks)
            .set(taskData)
            .where(eq(tasks.id, existingTask.id));
        } else {
          await db
            .insert(tasks)
            .values({
              ...taskData,
              createdAt: new Date(),
            });
        }
        updated++;
      }
    } catch (e) {
      errors.push(`Course ${canvasCourseId}: ${e}`);
    }
  }

  return { updated, errors };
}

/**
 * Sync materials (modules, pages, files) for user's courses
 */
async function syncMaterials(
  canvasClient: UserCanvasClient,
  ctx: UserSyncContext,
  courseIds: string[]
): Promise<{ updated: number; errors: string[] }> {
  let updated = 0;
  const errors: string[] = [];

  for (const canvasCourseId of courseIds) {
    try {
      // Get or create class record
      let classRecord = await getOrCreateClass(canvasCourseId, ctx);
      if (!classRecord) continue;

      // Fetch modules and items
      const modules = await canvasClient.getModules(parseInt(canvasCourseId));
      
      for (const module of modules) {
        if (!module.published) continue;

        const items = await canvasClient.getModuleItems(parseInt(canvasCourseId), module.id);
        
        for (const item of items) {
          if (!item.published) continue;
          if (!['File', 'Page', 'ExternalUrl'].includes(item.type)) continue;

          const canvasFileId = item.content_id ? String(item.content_id) : `item-${item.id}`;
          
          // Upsert material
          const [existing] = await db
            .select()
            .from(canvasMaterials)
            .where(eq(canvasMaterials.canvasFileId, canvasFileId))
            .limit(1);

          const materialData = {
            courseId: classRecord.id,
            canvasFileId,
            fileName: item.title,
            displayName: item.title,
            fileType: item.type === 'File' ? 'file' : item.type === 'Page' ? 'page' : 'url',
            canvasUrl: item.html_url,
            moduleName: module.name,
            modulePosition: module.position,
            materialType: guessMaterialType(item.title, item.type),
            lastSyncedAt: new Date(),
            updatedAt: new Date(),
          };

          if (existing) {
            await db
              .update(canvasMaterials)
              .set(materialData)
              .where(eq(canvasMaterials.id, existing.id));
          } else {
            await db
              .insert(canvasMaterials)
              .values({
                ...materialData,
                createdAt: new Date(),
              });
          }
          updated++;
        }
      }
    } catch (e) {
      errors.push(`Materials ${canvasCourseId}: ${e}`);
    }
  }

  return { updated, errors };
}

/**
 * Get or create a class record for a Canvas course
 */
async function getOrCreateClass(canvasCourseId: string, ctx: UserSyncContext): Promise<{ id: string; name: string; code: string | null } | null> {
  // First check if class exists
  const [existing] = await db
    .select()
    .from(classes)
    .where(eq(classes.canvasCourseId, canvasCourseId))
    .limit(1);

  if (existing) {
    return { id: existing.id, name: existing.name, code: existing.code };
  }

  // Get course info from user's enrolled courses
  const [userCourse] = await db
    .select()
    .from(studyHelpUserCourses)
    .where(and(
      eq(studyHelpUserCourses.userId, ctx.userId),
      eq(studyHelpUserCourses.canvasCourseId, canvasCourseId)
    ))
    .limit(1);

  if (!userCourse) return null;

  // Create class record
  const [newClass] = await db
    .insert(classes)
    .values({
      name: userCourse.courseName || `Canvas Course ${canvasCourseId}`,
      code: userCourse.courseCode,
      canvasCourseId,
      semester: userCourse.term || getCurrentTerm(),
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  return { id: newClass.id, name: newClass.name, code: newClass.code };
}

function getCurrentTerm(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  if (month >= 0 && month <= 4) return `Winter ${year}`;
  if (month >= 5 && month <= 7) return `Summer ${year}`;
  return `Fall ${year}`;
}

function guessMaterialType(title: string, itemType: string): string {
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
// Main Sync Function
// ============================================

/**
 * Sync all Canvas data for a user
 */
export async function syncUserCanvas(userId: string): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    userId,
    coursesUpdated: 0,
    assignmentsUpdated: 0,
    materialsUpdated: 0,
    errors: [],
    syncedAt: new Date(),
  };

  try {
    // Get user context
    const ctx = await getUserSyncContext(userId);
    if (!ctx) {
      result.errors.push('User not found or Canvas not connected');
      return result;
    }

    // Create Canvas client
    const canvasClient = createUserCanvasClient(ctx.canvasBaseUrl, ctx.canvasToken);
    if (!canvasClient) {
      result.errors.push('Failed to create Canvas client');
      return result;
    }

    console.log(`[StudyHelpSync] Starting sync for user ${ctx.email}`);

    // 1. Sync courses
    const coursesResult = await syncCourses(canvasClient, ctx);
    result.coursesUpdated = coursesResult.updated;

    // 2. Sync assignments
    const assignmentsResult = await syncAssignments(canvasClient, ctx, coursesResult.courseIds);
    result.assignmentsUpdated = assignmentsResult.updated;
    result.errors.push(...assignmentsResult.errors);

    // 3. Sync materials
    const materialsResult = await syncMaterials(canvasClient, ctx, coursesResult.courseIds);
    result.materialsUpdated = materialsResult.updated;
    result.errors.push(...materialsResult.errors);

    // 4. Update user's last sync time
    await db
      .update(studyHelpUsers)
      .set({ 
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(studyHelpUsers.id, userId));

    result.success = result.errors.length === 0;
    console.log(`[StudyHelpSync] Completed for ${ctx.email}: ${result.coursesUpdated} courses, ${result.assignmentsUpdated} assignments, ${result.materialsUpdated} materials`);

  } catch (e) {
    result.errors.push(`Sync failed: ${e}`);
    console.error(`[StudyHelpSync] Error for user ${userId}:`, e);
  }

  return result;
}

/**
 * Sync Canvas for all active users
 */
export async function syncAllUsers(): Promise<SyncResult[]> {
  const users = await db
    .select({ id: studyHelpUsers.id })
    .from(studyHelpUsers)
    .where(eq(studyHelpUsers.isActive, true));

  const results: SyncResult[] = [];

  for (const user of users) {
    // Check if user has Canvas connected
    const [fullUser] = await db
      .select()
      .from(studyHelpUsers)
      .where(eq(studyHelpUsers.id, user.id))
      .limit(1);

    if (fullUser?.canvasAccessTokenEncrypted) {
      const result = await syncUserCanvas(user.id);
      results.push(result);
      
      // Small delay between users to avoid rate limiting
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return results;
}

export const studyHelpSyncService = {
  syncUserCanvas,
  syncAllUsers,
};

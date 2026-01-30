import { db } from '../db/client';
import {
  canvasItems,
  canvasAudits,
  classProjectMapping,
  canvasScheduleTracking,
  canvasAssignmentSubtasks,
  tasks,
  projects,
  classes,
} from '../db/schema';
import { eq, desc, and, isNull, lte, gte, sql } from 'drizzle-orm';

// ============================================
// Types
// ============================================

export type CanvasItemType = 'assignment' | 'quiz' | 'discussion' | 'announcement' | 'module_item' | 'page' | 'file' | 'external_url' | 'subheader';
export type DiscoveryMethod = 'api' | 'browser_assignments' | 'browser_modules' | 'browser_home' | 'browser_syllabus' | 'browser_pages' | 'browser_files';
export type SyncStatus = 'pending' | 'synced' | 'mismatch' | 'orphaned';
export type AuditType = 'full' | 'incremental' | 'quick_check';
export type AuditStatus = 'running' | 'completed' | 'failed';

export interface CreateCanvasItemInput {
  canvasId: string;
  canvasType: CanvasItemType;
  courseId?: string;
  courseName: string;
  title: string;
  description?: string;
  url?: string;
  dueAt?: Date;
  availableFrom?: Date;
  availableUntil?: Date;
  pointsPossible?: number;
  submissionTypes?: string[];
  isQuiz?: boolean;
  isDiscussion?: boolean;
  isGraded?: boolean;
  discoveredVia: DiscoveryMethod;
  canvasData?: Record<string, unknown>;
  // Canvas Complete Phase 1 fields
  instructions?: string;
  instructionsHtml?: string;
  rubric?: Record<string, unknown>[];
  allowedExtensions?: string[];
  wordCountMin?: number;
  wordCountMax?: number;
  isGroupAssignment?: boolean;
  hasPeerReview?: boolean;
  attachedFileIds?: string[];
  estimatedMinutes?: number;
  lockInfo?: Record<string, unknown>;
  gradingType?: string;
}

export interface UpdateCanvasItemInput {
  title?: string;
  description?: string;
  url?: string;
  dueAt?: Date;
  availableFrom?: Date;
  availableUntil?: Date;
  pointsPossible?: number;
  submissionTypes?: string[];
  taskId?: string;
  projectId?: string;
  vaultPageId?: string;
  syncStatus?: SyncStatus;
  browserVerified?: boolean;
  apiVerified?: boolean;
  lastBrowserCheck?: Date;
  lastApiCheck?: Date;
  verificationScreenshot?: string;
  canvasData?: Record<string, unknown>;
  // Canvas Complete Phase 1 fields
  instructions?: string;
  instructionsHtml?: string;
  rubric?: Record<string, unknown>[];
  allowedExtensions?: string[];
  wordCountMin?: number;
  wordCountMax?: number;
  isGroupAssignment?: boolean;
  hasPeerReview?: boolean;
  attachedFileIds?: string[];
  estimatedMinutes?: number;
  lockInfo?: Record<string, unknown>;
  gradingType?: string;
}

export interface CreateAuditInput {
  auditType: AuditType;
  startedAt: Date;
}

export interface UpdateAuditInput {
  completedAt?: Date;
  status?: AuditStatus;
  coursesAudited?: number;
  pagesVisited?: number;
  screenshotsCaptured?: number;
  itemsDiscovered?: number;
  tasksVerified?: number;
  tasksCreated?: number;
  tasksUpdated?: number;
  discrepanciesFound?: number;
  integrityScore?: number;
  findings?: Record<string, unknown>;
  errors?: Record<string, unknown>;
}

export interface CreateProjectMappingInput {
  canvasCourseId: string;
  canvasCourseName: string;
  canvasCourseCode?: string;
  projectId: string;
  professorName?: string;
  semester?: string;
  credits?: number;
  meetingDays?: string[];
  meetingTimeStart?: string;
  meetingTimeEnd?: string;
  location?: string;
}

export interface ItemFilters {
  courseId?: string;
  canvasType?: CanvasItemType;
  syncStatus?: SyncStatus;
  hasDueDate?: boolean;
  dueBefore?: Date;
  dueAfter?: Date;
}

export interface UnscheduledCanvasTask {
  canvasItemId: string;
  taskId: string;
  title: string;
  courseName: string;
  dueAt: Date | null;
  daysUntilDue: number | null;
  priority: number;
}

// ============================================
// Canvas Integrity Service
// ============================================

class CanvasIntegrityService {
  // ----------------------------------------
  // Canvas Items CRUD
  // ----------------------------------------

  async createItem(input: CreateCanvasItemInput) {
    const [item] = await db
      .insert(canvasItems)
      .values({
        canvasId: input.canvasId,
        canvasType: input.canvasType,
        courseId: input.courseId,
        courseName: input.courseName,
        title: input.title,
        description: input.description,
        url: input.url,
        dueAt: input.dueAt,
        availableFrom: input.availableFrom,
        availableUntil: input.availableUntil,
        pointsPossible: input.pointsPossible,
        submissionTypes: input.submissionTypes,
        isQuiz: input.isQuiz ?? false,
        isDiscussion: input.isDiscussion ?? false,
        isGraded: input.isGraded ?? true,
        discoveredVia: input.discoveredVia,
        canvasData: input.canvasData,
        // Canvas Complete Phase 1 fields
        instructions: input.instructions,
        instructionsHtml: input.instructionsHtml,
        rubric: input.rubric,
        allowedExtensions: input.allowedExtensions,
        wordCountMin: input.wordCountMin,
        wordCountMax: input.wordCountMax,
        isGroupAssignment: input.isGroupAssignment ?? false,
        hasPeerReview: input.hasPeerReview ?? false,
        attachedFileIds: input.attachedFileIds,
        estimatedMinutes: input.estimatedMinutes,
        lockInfo: input.lockInfo,
        gradingType: input.gradingType,
      })
      .returning();
    return item;
  }

  async getItemById(id: string) {
    const [item] = await db
      .select()
      .from(canvasItems)
      .where(eq(canvasItems.id, id));
    return item || null;
  }

  async getItemByCanvasId(canvasId: string) {
    const [item] = await db
      .select()
      .from(canvasItems)
      .where(eq(canvasItems.canvasId, canvasId));
    return item || null;
  }

  async updateItem(id: string, input: UpdateCanvasItemInput) {
    const [item] = await db
      .update(canvasItems)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(canvasItems.id, id))
      .returning();
    return item || null;
  }

  async listItems(filters?: ItemFilters) {
    const conditions = [];

    if (filters?.courseId) {
      conditions.push(eq(canvasItems.courseId, filters.courseId));
    }
    if (filters?.canvasType) {
      conditions.push(eq(canvasItems.canvasType, filters.canvasType));
    }
    if (filters?.syncStatus) {
      conditions.push(eq(canvasItems.syncStatus, filters.syncStatus));
    }
    if (filters?.dueAfter) {
      conditions.push(gte(canvasItems.dueAt, filters.dueAfter));
    }
    if (filters?.dueBefore) {
      conditions.push(lte(canvasItems.dueAt, filters.dueBefore));
    }

    let query = db.select().from(canvasItems).$dynamic();

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    return query.orderBy(canvasItems.dueAt);
  }

  async deleteItem(id: string) {
    const result = await db.delete(canvasItems).where(eq(canvasItems.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getItemsNeedingSync() {
    return db
      .select()
      .from(canvasItems)
      .where(eq(canvasItems.syncStatus, 'pending'));
  }

  async getItemsWithMismatch() {
    return db
      .select()
      .from(canvasItems)
      .where(eq(canvasItems.syncStatus, 'mismatch'));
  }

  async markItemVerified(id: string, method: 'browser' | 'api') {
    const updates: Partial<typeof canvasItems.$inferInsert> = {
      lastVerifiedAt: new Date(),
      updatedAt: new Date(),
    };

    if (method === 'browser') {
      updates.browserVerified = true;
      updates.lastBrowserCheck = new Date();
    } else {
      updates.apiVerified = true;
      updates.lastApiCheck = new Date();
    }

    const [item] = await db
      .update(canvasItems)
      .set(updates)
      .where(eq(canvasItems.id, id))
      .returning();
    return item || null;
  }

  // ----------------------------------------
  // Audits CRUD
  // ----------------------------------------

  async createAudit(input: CreateAuditInput) {
    const [audit] = await db
      .insert(canvasAudits)
      .values({
        auditType: input.auditType,
        startedAt: input.startedAt,
        status: 'running',
      })
      .returning();
    return audit;
  }

  async updateAudit(id: string, input: UpdateAuditInput) {
    const [audit] = await db
      .update(canvasAudits)
      .set(input)
      .where(eq(canvasAudits.id, id))
      .returning();
    return audit || null;
  }

  async getAuditById(id: string) {
    const [audit] = await db
      .select()
      .from(canvasAudits)
      .where(eq(canvasAudits.id, id));
    return audit || null;
  }

  async getLatestAudit() {
    const [audit] = await db
      .select()
      .from(canvasAudits)
      .orderBy(desc(canvasAudits.startedAt))
      .limit(1);
    return audit || null;
  }

  async listAudits(limit = 10) {
    return db
      .select()
      .from(canvasAudits)
      .orderBy(desc(canvasAudits.startedAt))
      .limit(limit);
  }

  async getRunningAudit() {
    const [audit] = await db
      .select()
      .from(canvasAudits)
      .where(eq(canvasAudits.status, 'running'))
      .limit(1);
    return audit || null;
  }

  // ----------------------------------------
  // Class Project Mapping
  // ----------------------------------------

  async createProjectMapping(input: CreateProjectMappingInput) {
    const [mapping] = await db
      .insert(classProjectMapping)
      .values({
        canvasCourseId: input.canvasCourseId,
        canvasCourseName: input.canvasCourseName,
        canvasCourseCode: input.canvasCourseCode,
        projectId: input.projectId,
        professorName: input.professorName,
        semester: input.semester,
        credits: input.credits,
        meetingDays: input.meetingDays,
        meetingTimeStart: input.meetingTimeStart,
        meetingTimeEnd: input.meetingTimeEnd,
        location: input.location,
      })
      .returning();
    return mapping;
  }

  async getProjectForCourse(canvasCourseId: string) {
    const [mapping] = await db
      .select({
        mapping: classProjectMapping,
        project: projects,
      })
      .from(classProjectMapping)
      .leftJoin(projects, eq(classProjectMapping.projectId, projects.id))
      .where(eq(classProjectMapping.canvasCourseId, canvasCourseId));

    return mapping?.project || null;
  }

  async getMappingByCourseId(canvasCourseId: string) {
    const [mapping] = await db
      .select()
      .from(classProjectMapping)
      .where(eq(classProjectMapping.canvasCourseId, canvasCourseId));
    return mapping || null;
  }

  async listActiveMappings() {
    return db
      .select({
        mapping: classProjectMapping,
        project: projects,
      })
      .from(classProjectMapping)
      .leftJoin(projects, eq(classProjectMapping.projectId, projects.id))
      .where(eq(classProjectMapping.isActive, true));
  }

  async updateMapping(id: string, input: Partial<CreateProjectMappingInput>) {
    const [mapping] = await db
      .update(classProjectMapping)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(classProjectMapping.id, id))
      .returning();
    return mapping || null;
  }

  async deactivateMapping(id: string) {
    const [mapping] = await db
      .update(classProjectMapping)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(classProjectMapping.id, id))
      .returning();
    return mapping || null;
  }

  /**
   * Find project by course code (e.g., "MBA508", "MBA580")
   * Searches canvasCourseCode and canvasCourseName for matches
   */
  async getProjectByCourseCode(courseCode: string): Promise<{ id: string; name: string } | null> {
    // Normalize course code (e.g., "MBA 508" -> "MBA508")
    const normalizedCode = courseCode.replace(/\s+/g, '').toUpperCase();

    // Try exact match on course code first
    const mappings = await db
      .select({
        mapping: classProjectMapping,
        project: projects,
      })
      .from(classProjectMapping)
      .leftJoin(projects, eq(classProjectMapping.projectId, projects.id))
      .where(eq(classProjectMapping.isActive, true));

    // Find matching mapping
    for (const { mapping, project } of mappings) {
      if (!project) continue;

      // Check course code (e.g., "MBA 508-001")
      const mappingCode = mapping.canvasCourseCode?.replace(/\s+/g, '').toUpperCase() || '';
      if (mappingCode.includes(normalizedCode) || normalizedCode.includes(mappingCode.replace(/-.*$/, ''))) {
        return { id: project.id, name: project.name };
      }

      // Check course name contains the code
      const mappingName = mapping.canvasCourseName.replace(/\s+/g, '').toUpperCase();
      if (mappingName.includes(normalizedCode)) {
        return { id: project.id, name: project.name };
      }
    }

    return null;
  }

  /**
   * Get all course-to-project mappings for vault linking
   * Returns a map of course codes to project IDs
   */
  async getCourseProjectMap(): Promise<Map<string, string>> {
    const mappings = await db
      .select({
        canvasCourseCode: classProjectMapping.canvasCourseCode,
        canvasCourseName: classProjectMapping.canvasCourseName,
        projectId: classProjectMapping.projectId,
      })
      .from(classProjectMapping)
      .where(eq(classProjectMapping.isActive, true));

    const courseProjectMap = new Map<string, string>();

    for (const mapping of mappings) {
      // Extract course code from canvasCourseCode (e.g., "MBA 508-001" -> "MBA508")
      if (mapping.canvasCourseCode) {
        const code = mapping.canvasCourseCode.replace(/\s+/g, '').replace(/-.*$/, '').toUpperCase();
        courseProjectMap.set(code, mapping.projectId);
      }

      // Also extract from course name (e.g., "MBA 508-001: Business Analytics" -> "MBA508")
      const nameMatch = mapping.canvasCourseName.match(/MBA\s*(\d{3})/i);
      if (nameMatch) {
        const code = `MBA${nameMatch[1]}`;
        if (!courseProjectMap.has(code)) {
          courseProjectMap.set(code, mapping.projectId);
        }
      }
    }

    return courseProjectMap;
  }

  // ----------------------------------------
  // Schedule Tracking
  // ----------------------------------------

  async createScheduleTracking(
    canvasItemId: string,
    taskId: string,
    scheduledStart?: Date,
    scheduledEnd?: Date
  ) {
    const [tracking] = await db
      .insert(canvasScheduleTracking)
      .values({
        canvasItemId,
        taskId,
        isScheduled: !!scheduledStart,
        scheduledStart,
        scheduledEnd,
      })
      .returning();
    return tracking;
  }

  async getScheduleTracking(canvasItemId: string) {
    const [tracking] = await db
      .select()
      .from(canvasScheduleTracking)
      .where(eq(canvasScheduleTracking.canvasItemId, canvasItemId));
    return tracking || null;
  }

  async markScheduled(
    canvasItemId: string,
    scheduledStart: Date,
    scheduledEnd: Date,
    calendarEventId?: string
  ) {
    const [tracking] = await db
      .update(canvasScheduleTracking)
      .set({
        isScheduled: true,
        scheduledStart,
        scheduledEnd,
        calendarEventId,
        lastCheckedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(canvasScheduleTracking.canvasItemId, canvasItemId))
      .returning();
    return tracking || null;
  }

  async recordNudgeSent(canvasItemId: string) {
    const [tracking] = await db
      .update(canvasScheduleTracking)
      .set({
        reminderSent: true,
        reminderSentAt: new Date(),
        reminderCount: sql`${canvasScheduleTracking.reminderCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(canvasScheduleTracking.canvasItemId, canvasItemId))
      .returning();
    return tracking || null;
  }

  async getUnscheduledItems(): Promise<UnscheduledCanvasTask[]> {
    const results = await db
      .select({
        canvasItemId: canvasItems.id,
        taskId: tasks.id,
        title: tasks.title,
        courseName: canvasItems.courseName,
        dueAt: canvasItems.dueAt,
        priority: tasks.priority,
      })
      .from(canvasItems)
      .innerJoin(tasks, eq(canvasItems.taskId, tasks.id))
      .leftJoin(
        canvasScheduleTracking,
        eq(canvasItems.id, canvasScheduleTracking.canvasItemId)
      )
      .where(
        and(
          eq(canvasItems.syncStatus, 'synced'),
          // Either no tracking record or not scheduled
          sql`(${canvasScheduleTracking.isScheduled} IS NULL OR ${canvasScheduleTracking.isScheduled} = false)`
        )
      )
      .orderBy(canvasItems.dueAt)
      .limit(50);

    return results.map((r) => ({
      canvasItemId: r.canvasItemId,
      taskId: r.taskId,
      title: r.title,
      courseName: r.courseName,
      dueAt: r.dueAt,
      daysUntilDue: r.dueAt
        ? Math.ceil((r.dueAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null,
      priority: r.priority,
    }));
  }

  // ----------------------------------------
  // Integrity Status
  // ----------------------------------------

  async getIntegrityStatus() {
    const [itemStats] = await db
      .select({
        total: sql<number>`count(*)`,
        synced: sql<number>`count(*) filter (where ${canvasItems.syncStatus} = 'synced')`,
        pending: sql<number>`count(*) filter (where ${canvasItems.syncStatus} = 'pending')`,
        mismatch: sql<number>`count(*) filter (where ${canvasItems.syncStatus} = 'mismatch')`,
        orphaned: sql<number>`count(*) filter (where ${canvasItems.syncStatus} = 'orphaned')`,
      })
      .from(canvasItems);

    const latestAudit = await this.getLatestAudit();
    const unscheduledCount = (await this.getUnscheduledItems()).length;
    const activeMappings = await this.listActiveMappings();

    const syncedPercentage =
      itemStats.total > 0
        ? Math.round((itemStats.synced / itemStats.total) * 100)
        : 100;

    return {
      items: {
        total: itemStats.total,
        synced: itemStats.synced,
        pending: itemStats.pending,
        mismatch: itemStats.mismatch,
        orphaned: itemStats.orphaned,
      },
      syncPercentage: syncedPercentage,
      integrityScore: latestAudit?.integrityScore ?? null,
      lastAuditAt: latestAudit?.completedAt ?? latestAudit?.startedAt ?? null,
      lastAuditStatus: latestAudit?.status ?? null,
      unscheduledCount,
      activeCourses: activeMappings.length,
    };
  }

  // ----------------------------------------
  // Canvas Complete - Subtasks
  // ----------------------------------------

  async getAssignmentSubtasks(canvasItemId: string) {
    return db
      .select()
      .from(canvasAssignmentSubtasks)
      .where(eq(canvasAssignmentSubtasks.canvasItemId, canvasItemId))
      .orderBy(canvasAssignmentSubtasks.sortOrder);
  }

  async createAssignmentSubtask(input: {
    canvasItemId: string;
    title: string;
    subtaskType?: string;
    sortOrder?: number;
    generatedBy?: string;
    generationPrompt?: string;
    taskId?: string;
  }) {
    const [subtask] = await db
      .insert(canvasAssignmentSubtasks)
      .values({
        canvasItemId: input.canvasItemId,
        title: input.title,
        subtaskType: input.subtaskType,
        sortOrder: input.sortOrder ?? 0,
        generatedBy: input.generatedBy ?? 'manual',
        generationPrompt: input.generationPrompt,
        taskId: input.taskId,
      })
      .returning();
    return subtask;
  }

  async updateAssignmentSubtask(
    id: string,
    input: {
      title?: string;
      subtaskType?: string;
      sortOrder?: number;
      isCompleted?: boolean;
      completedAt?: Date | null;
    }
  ) {
    const [subtask] = await db
      .update(canvasAssignmentSubtasks)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(canvasAssignmentSubtasks.id, id))
      .returning();
    return subtask || null;
  }

  async deleteAssignmentSubtask(id: string) {
    const result = await db
      .delete(canvasAssignmentSubtasks)
      .where(eq(canvasAssignmentSubtasks.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // ----------------------------------------
  // Canvas Complete - Enhanced Queries
  // ----------------------------------------

  async getItemByTaskId(taskId: string) {
    const [item] = await db
      .select()
      .from(canvasItems)
      .where(eq(canvasItems.taskId, taskId));
    return item || null;
  }
}

export const canvasIntegrityService = new CanvasIntegrityService();

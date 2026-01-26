import { Hono } from 'hono';
import { z } from 'zod';
import { canvasIntegrityService } from '../../services/canvas-integrity-service';
import { canvasAssignmentPageService } from '../../services/canvas-assignment-page-service';
import { homeworkHubService } from '../../services/homework-hub-service';
import { canvasSubmissionService } from '../../services/canvas-submission-service';
import { canvasGradesService } from '../../services/canvas-grades-service';
import { getCanvasIntegrityAgent } from '../../agents/canvas-integrity';
import { getCanvasScheduler } from '../../agents/canvas-integrity/scheduler';
import { ValidationError, NotFoundError } from '../middleware/error-handler';

const canvasIntegrityRouter = new Hono();

// ============================================
// Schemas
// ============================================

const createItemSchema = z.object({
  canvasId: z.string().min(1, 'Canvas ID is required'),
  canvasType: z.enum(['assignment', 'quiz', 'discussion', 'announcement', 'module_item']),
  courseId: z.string().uuid().optional(),
  courseName: z.string().min(1, 'Course name is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  url: z.string().url().optional(),
  dueAt: z.string().datetime().optional(),
  availableFrom: z.string().datetime().optional(),
  availableUntil: z.string().datetime().optional(),
  pointsPossible: z.number().optional(),
  submissionTypes: z.array(z.string()).optional(),
  isQuiz: z.boolean().optional(),
  isDiscussion: z.boolean().optional(),
  isGraded: z.boolean().optional(),
  discoveredVia: z.enum(['api', 'browser_assignments', 'browser_modules', 'browser_home', 'browser_syllabus']),
  canvasData: z.record(z.unknown()).optional(),
});

const updateItemSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  url: z.string().url().optional(),
  dueAt: z.string().datetime().optional(),
  syncStatus: z.enum(['pending', 'synced', 'mismatch', 'orphaned']).optional(),
  taskId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
});

const createMappingSchema = z.object({
  canvasCourseId: z.string().min(1, 'Canvas course ID is required'),
  canvasCourseName: z.string().min(1, 'Course name is required'),
  canvasCourseCode: z.string().optional(),
  projectId: z.string().uuid('Project ID must be a valid UUID'),
  professorName: z.string().optional(),
  semester: z.string().optional(),
  credits: z.number().int().optional(),
  meetingDays: z.array(z.string()).optional(),
  meetingTimeStart: z.string().optional(),
  meetingTimeEnd: z.string().optional(),
  location: z.string().optional(),
});

// ============================================
// Status & Dashboard
// ============================================

// GET /api/canvas-integrity/status - Get current integrity status
canvasIntegrityRouter.get('/status', async (c) => {
  const status = await canvasIntegrityService.getIntegrityStatus();
  return c.json({
    success: true,
    data: status,
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// Canvas Items
// ============================================

// GET /api/canvas-integrity/items - List canvas items
canvasIntegrityRouter.get('/items', async (c) => {
  const courseId = c.req.query('courseId');
  const canvasType = c.req.query('type') as 'assignment' | 'quiz' | 'discussion' | 'announcement' | 'module_item' | undefined;
  const syncStatus = c.req.query('syncStatus') as 'pending' | 'synced' | 'mismatch' | 'orphaned' | undefined;

  const items = await canvasIntegrityService.listItems({
    courseId,
    canvasType,
    syncStatus,
  });

  return c.json({
    success: true,
    data: items,
    count: items.length,
  });
});

// GET /api/canvas-integrity/items/:id - Get single item
canvasIntegrityRouter.get('/items/:id', async (c) => {
  const id = c.req.param('id');
  const item = await canvasIntegrityService.getItemById(id);
  if (!item) throw new NotFoundError('Canvas item');
  return c.json({ success: true, data: item });
});

// POST /api/canvas-integrity/items - Create item
canvasIntegrityRouter.post('/items', async (c) => {
  const body = await c.req.json();
  const parseResult = createItemSchema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
  }

  const data = parseResult.data;
  const item = await canvasIntegrityService.createItem({
    ...data,
    dueAt: data.dueAt ? new Date(data.dueAt) : undefined,
    availableFrom: data.availableFrom ? new Date(data.availableFrom) : undefined,
    availableUntil: data.availableUntil ? new Date(data.availableUntil) : undefined,
  });

  return c.json({ success: true, data: item, message: 'Canvas item created' }, 201);
});

// PATCH /api/canvas-integrity/items/:id - Update item
canvasIntegrityRouter.patch('/items/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parseResult = updateItemSchema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
  }

  const data = parseResult.data;
  const item = await canvasIntegrityService.updateItem(id, {
    ...data,
    dueAt: data.dueAt ? new Date(data.dueAt) : undefined,
  });
  if (!item) throw new NotFoundError('Canvas item');

  return c.json({ success: true, data: item, message: 'Canvas item updated' });
});

// DELETE /api/canvas-integrity/items/:id - Delete item
canvasIntegrityRouter.delete('/items/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = await canvasIntegrityService.deleteItem(id);
  if (!deleted) throw new NotFoundError('Canvas item');
  return c.json({ success: true, message: 'Canvas item deleted' });
});

// POST /api/canvas-integrity/items/:id/verify - Mark item verified
canvasIntegrityRouter.post('/items/:id/verify', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const method = body.method === 'browser' ? 'browser' : 'api';

  const item = await canvasIntegrityService.markItemVerified(id, method);
  if (!item) throw new NotFoundError('Canvas item');

  return c.json({ success: true, data: item, message: `Item verified via ${method}` });
});

// ============================================
// Audits
// ============================================

// GET /api/canvas-integrity/audits - List audits
canvasIntegrityRouter.get('/audits', async (c) => {
  const limitParam = c.req.query('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 10;
  const audits = await canvasIntegrityService.listAudits(limit);
  return c.json({
    success: true,
    data: audits,
    count: audits.length,
  });
});

// GET /api/canvas-integrity/audits/latest - Get latest audit
canvasIntegrityRouter.get('/audits/latest', async (c) => {
  const audit = await canvasIntegrityService.getLatestAudit();
  if (!audit) {
    return c.json({
      success: true,
      data: null,
      message: 'No audits found',
    });
  }
  return c.json({ success: true, data: audit });
});

// GET /api/canvas-integrity/audits/:id - Get specific audit
canvasIntegrityRouter.get('/audits/:id', async (c) => {
  const id = c.req.param('id');
  const audit = await canvasIntegrityService.getAuditById(id);
  if (!audit) throw new NotFoundError('Audit');
  return c.json({ success: true, data: audit });
});

// POST /api/canvas-integrity/audit - Trigger new audit
canvasIntegrityRouter.post('/audit', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const auditType = body.type || 'full';

  // Check if audit already running
  const running = await canvasIntegrityService.getRunningAudit();
  if (running) {
    return c.json({
      success: false,
      error: {
        code: 'AUDIT_IN_PROGRESS',
        message: 'An audit is already running',
        auditId: running.id,
      },
    }, 409);
  }

  // Run audit in background (don't await)
  const scheduler = getCanvasScheduler();
  if (auditType === 'full') {
    scheduler.triggerFullAudit().catch(console.error);
  } else if (auditType === 'incremental') {
    scheduler.triggerIncrementalAudit().catch(console.error);
  } else {
    scheduler.triggerQuickCheck().catch(console.error);
  }

  return c.json({
    success: true,
    message: `${auditType} audit started in background`,
  }, 202);
});

// POST /api/canvas-integrity/audit/quick - Quick API check
canvasIntegrityRouter.post('/audit/quick', async (c) => {
  const running = await canvasIntegrityService.getRunningAudit();
  if (running) {
    return c.json({
      success: false,
      error: {
        code: 'AUDIT_IN_PROGRESS',
        message: 'An audit is already running',
      },
    }, 409);
  }

  const scheduler = getCanvasScheduler();
  scheduler.triggerQuickCheck().catch(console.error);

  return c.json({
    success: true,
    message: 'Quick check started in background',
  }, 202);
});

// GET /api/canvas-integrity/scheduler - Get scheduler status
canvasIntegrityRouter.get('/scheduler', async (c) => {
  const scheduler = getCanvasScheduler();
  const jobs = scheduler.getStatus();
  return c.json({
    success: true,
    data: jobs,
  });
});

// ============================================
// Class-Project Mappings
// ============================================

// GET /api/canvas-integrity/mappings - List all mappings
canvasIntegrityRouter.get('/mappings', async (c) => {
  const mappings = await canvasIntegrityService.listActiveMappings();
  return c.json({
    success: true,
    data: mappings,
    count: mappings.length,
  });
});

// GET /api/canvas-integrity/mappings/:courseId - Get mapping by course ID
canvasIntegrityRouter.get('/mappings/:courseId', async (c) => {
  const courseId = c.req.param('courseId');
  const mapping = await canvasIntegrityService.getMappingByCourseId(courseId);
  if (!mapping) throw new NotFoundError('Mapping');
  return c.json({ success: true, data: mapping });
});

// POST /api/canvas-integrity/mappings - Create mapping
canvasIntegrityRouter.post('/mappings', async (c) => {
  const body = await c.req.json();
  const parseResult = createMappingSchema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
  }

  const mapping = await canvasIntegrityService.createProjectMapping(parseResult.data);
  return c.json({ success: true, data: mapping, message: 'Mapping created' }, 201);
});

// DELETE /api/canvas-integrity/mappings/:id - Deactivate mapping
canvasIntegrityRouter.delete('/mappings/:id', async (c) => {
  const id = c.req.param('id');
  const mapping = await canvasIntegrityService.deactivateMapping(id);
  if (!mapping) throw new NotFoundError('Mapping');
  return c.json({ success: true, message: 'Mapping deactivated' });
});

// ============================================
// Scheduling
// ============================================

// GET /api/canvas-integrity/unscheduled - Get unscheduled canvas tasks
canvasIntegrityRouter.get('/unscheduled', async (c) => {
  const items = await canvasIntegrityService.getUnscheduledItems();
  return c.json({
    success: true,
    data: items,
    count: items.length,
  });
});

// POST /api/canvas-integrity/nudge - Send scheduling nudge
canvasIntegrityRouter.post('/nudge', async (c) => {
  const unscheduled = await canvasIntegrityService.getUnscheduledItems();

  if (unscheduled.length === 0) {
    return c.json({
      success: true,
      data: { sent: false },
      message: 'No unscheduled tasks - no nudge needed',
    });
  }

  // Send nudge via agent
  const agent = getCanvasIntegrityAgent();
  const sent = await agent.sendScheduleNudge();

  const urgentItems = unscheduled.filter(
    (item) => item.daysUntilDue !== null && item.daysUntilDue <= 2
  );

  return c.json({
    success: true,
    data: {
      sent,
      totalUnscheduled: unscheduled.length,
      urgentCount: urgentItems.length,
    },
    message: sent ? 'Nudge sent via Telegram' : 'Failed to send nudge',
  });
});

// ============================================
// Canvas Complete - Enhanced Assignments
// ============================================

// GET /api/canvas-integrity/assignments/:id/full - Get full assignment details
canvasIntegrityRouter.get('/assignments/:id/full', async (c) => {
  const id = c.req.param('id');
  const item = await canvasIntegrityService.getItemById(id);
  if (!item) throw new NotFoundError('Canvas assignment');

  // Get subtasks if any
  const subtasks = await canvasIntegrityService.getAssignmentSubtasks(id);

  // Format rubric for display
  const rubric = item.rubric ? (item.rubric as Array<{
    id: string;
    criterion: string;
    description: string | null;
    points: number;
    ratings: Array<{ description: string; points: number }>;
  }>) : null;

  // Calculate total rubric points
  const totalRubricPoints = rubric?.reduce((sum, c) => sum + c.points, 0) || null;

  return c.json({
    success: true,
    data: {
      // Basic info
      id: item.id,
      canvasId: item.canvasId,
      title: item.title,
      courseName: item.courseName,
      url: item.url,

      // Dates
      dueAt: item.dueAt,
      availableFrom: item.availableFrom,
      availableUntil: item.availableUntil,

      // Academic details
      pointsPossible: item.pointsPossible,
      gradingType: item.gradingType,
      submissionTypes: item.submissionTypes,
      allowedExtensions: item.allowedExtensions,

      // Canvas Complete enhanced fields
      instructions: item.instructions,
      instructionsHtml: item.instructionsHtml,
      rubric,
      totalRubricPoints,
      wordCountMin: item.wordCountMin,
      wordCountMax: item.wordCountMax,
      isGroupAssignment: item.isGroupAssignment,
      hasPeerReview: item.hasPeerReview,
      estimatedMinutes: item.estimatedMinutes,
      lockInfo: item.lockInfo,

      // Related data
      taskId: item.taskId,
      projectId: item.projectId,
      vaultPageId: item.vaultPageId,
      subtasks,

      // Metadata
      syncStatus: item.syncStatus,
      lastVerifiedAt: item.lastVerifiedAt,
    },
  });
});

// GET /api/canvas-integrity/assignments/:id/subtasks - Get assignment subtasks
canvasIntegrityRouter.get('/assignments/:id/subtasks', async (c) => {
  const id = c.req.param('id');
  const subtasks = await canvasIntegrityService.getAssignmentSubtasks(id);
  return c.json({
    success: true,
    data: subtasks,
    count: subtasks.length,
  });
});

// POST /api/canvas-integrity/assignments/:id/subtasks - Create subtask
canvasIntegrityRouter.post('/assignments/:id/subtasks', async (c) => {
  const canvasItemId = c.req.param('id');
  const body = await c.req.json();

  const subtask = await canvasIntegrityService.createAssignmentSubtask({
    canvasItemId,
    title: body.title,
    subtaskType: body.subtaskType,
    sortOrder: body.sortOrder || 0,
    generatedBy: body.generatedBy || 'manual',
  });

  return c.json({ success: true, data: subtask, message: 'Subtask created' }, 201);
});

// PATCH /api/canvas-integrity/subtasks/:id - Update subtask
canvasIntegrityRouter.patch('/subtasks/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  const subtask = await canvasIntegrityService.updateAssignmentSubtask(id, {
    title: body.title,
    subtaskType: body.subtaskType,
    sortOrder: body.sortOrder,
    isCompleted: body.isCompleted,
    completedAt: body.isCompleted ? new Date() : null,
  });

  if (!subtask) throw new NotFoundError('Subtask');
  return c.json({ success: true, data: subtask, message: 'Subtask updated' });
});

// DELETE /api/canvas-integrity/subtasks/:id - Delete subtask
canvasIntegrityRouter.delete('/subtasks/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = await canvasIntegrityService.deleteAssignmentSubtask(id);
  if (!deleted) throw new NotFoundError('Subtask');
  return c.json({ success: true, message: 'Subtask deleted' });
});

// GET /api/canvas-integrity/by-task/:taskId - Get canvas item by task ID
canvasIntegrityRouter.get('/by-task/:taskId', async (c) => {
  const taskId = c.req.param('taskId');
  const item = await canvasIntegrityService.getItemByTaskId(taskId);
  if (!item) throw new NotFoundError('Canvas item for task');
  return c.json({ success: true, data: item });
});

// GET /api/canvas-integrity/homework - Homework hub dashboard data
canvasIntegrityRouter.get('/homework', async (c) => {
  // Get items due today
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const allItems = await canvasIntegrityService.listItems({
    canvasType: 'assignment',
    dueAfter: today,
    dueBefore: weekEnd,
  });

  const dueToday = allItems.filter(item => {
    if (!item.dueAt) return false;
    const due = new Date(item.dueAt);
    return due >= today && due < tomorrow;
  });

  const dueThisWeek = allItems.filter(item => {
    if (!item.dueAt) return false;
    const due = new Date(item.dueAt);
    return due >= tomorrow && due < weekEnd;
  });

  // Calculate total estimated time
  const totalMinutes = allItems.reduce((sum, item) => sum + (item.estimatedMinutes || 0), 0);

  return c.json({
    success: true,
    data: {
      dueToday: dueToday.map(formatHomeworkItem),
      dueThisWeek: dueThisWeek.map(formatHomeworkItem),
      summary: {
        dueTodayCount: dueToday.length,
        dueThisWeekCount: dueThisWeek.length,
        totalEstimatedMinutes: totalMinutes,
        totalEstimatedHours: Math.round(totalMinutes / 60 * 10) / 10,
      },
    },
  });
});

// Helper function to format homework item
function formatHomeworkItem(item: {
  id: string;
  title: string;
  courseName: string;
  dueAt: Date | null;
  pointsPossible: number | null;
  estimatedMinutes: number | null;
  taskId: string | null;
  rubric: unknown;
  instructions: string | null;
}) {
  return {
    id: item.id,
    title: item.title,
    courseName: item.courseName,
    dueAt: item.dueAt,
    pointsPossible: item.pointsPossible,
    estimatedMinutes: item.estimatedMinutes,
    taskId: item.taskId,
    hasRubric: !!item.rubric,
    hasInstructions: !!item.instructions,
  };
}

// ============================================
// Assignment Page Routes (Phase 3)
// ============================================

/**
 * POST /api/canvas-integrity/assignments/:id/create-page
 * Create a Vault page for an assignment
 */
canvasIntegrityRouter.post('/assignments/:id/create-page', async (c) => {
  const canvasItemId = c.req.param('id');
  const { parentPageId } = await c.req.json().catch(() => ({}));

  // Get assignment data
  const data = await canvasAssignmentPageService.getAssignmentDataForPage(canvasItemId);
  if (!data) {
    throw new NotFoundError('Assignment not found');
  }

  // Check if page already exists
  const existing = await canvasAssignmentPageService.getAssignmentPageByCanvasItem(canvasItemId);
  if (existing) {
    return c.json({
      success: true,
      message: 'Assignment page already exists',
      data: {
        pageId: existing.vaultPageId,
        assignmentPageId: existing.id,
        alreadyExisted: true,
      },
    });
  }

  // Create the page
  const result = await canvasAssignmentPageService.createAssignmentPage(data, parentPageId);

  return c.json({
    success: true,
    data: {
      ...result,
      alreadyExisted: false,
    },
  }, 201);
});

/**
 * GET /api/canvas-integrity/assignments/:id/page
 * Get the Vault page for an assignment
 */
canvasIntegrityRouter.get('/assignments/:id/page', async (c) => {
  const canvasItemId = c.req.param('id');

  const page = await canvasAssignmentPageService.getAssignmentPageByCanvasItem(canvasItemId);
  if (!page) {
    throw new NotFoundError('Assignment page not found');
  }

  return c.json({
    success: true,
    data: page,
  });
});

/**
 * GET /api/canvas-integrity/assignments/:id/page-or-create
 * Get or create a Vault page for an assignment
 */
canvasIntegrityRouter.get('/assignments/:id/page-or-create', async (c) => {
  const canvasItemId = c.req.param('id');

  // Check if page exists
  let page = await canvasAssignmentPageService.getAssignmentPageByCanvasItem(canvasItemId);

  if (!page) {
    // Create it
    const data = await canvasAssignmentPageService.getAssignmentDataForPage(canvasItemId);
    if (!data) {
      throw new NotFoundError('Assignment not found');
    }

    const result = await canvasAssignmentPageService.createAssignmentPage(data);
    page = await canvasAssignmentPageService.getAssignmentPageByCanvasItem(canvasItemId);
  }

  return c.json({
    success: true,
    data: page,
  });
});

/**
 * GET /api/canvas-integrity/by-task/:taskId/page
 * Get the assignment Vault page by task ID
 */
canvasIntegrityRouter.get('/by-task/:taskId/page', async (c) => {
  const taskId = c.req.param('taskId');

  const page = await canvasAssignmentPageService.getAssignmentPageByTask(taskId);
  if (!page) {
    throw new NotFoundError('Assignment page not found for this task');
  }

  return c.json({
    success: true,
    data: page,
  });
});

/**
 * PATCH /api/canvas-integrity/assignment-pages/:id/notes
 * Update user notes on an assignment page
 */
canvasIntegrityRouter.patch('/assignment-pages/:id/notes', async (c) => {
  const assignmentPageId = c.req.param('id');
  const { notes } = await c.req.json();

  if (typeof notes !== 'string') {
    throw new ValidationError('notes must be a string');
  }

  await canvasAssignmentPageService.updateUserNotes(assignmentPageId, notes);

  return c.json({
    success: true,
    message: 'Notes updated',
  });
});

/**
 * POST /api/canvas-integrity/courses/:courseId/create-all-pages
 * Create Vault pages for all assignments in a course
 */
canvasIntegrityRouter.post('/courses/:courseId/create-all-pages', async (c) => {
  const courseId = c.req.param('courseId');
  const { courseName, parentPageId } = await c.req.json().catch(() => ({}));

  // Get or create course folder if courseName provided
  let folderPageId = parentPageId;
  if (!folderPageId && courseName) {
    folderPageId = await canvasAssignmentPageService.getOrCreateCourseAssignmentsFolder(courseName);
  }

  const created = await canvasAssignmentPageService.createPagesForCourse(courseId, folderPageId);

  return c.json({
    success: true,
    data: {
      created,
      folderPageId,
    },
  });
});

// ============================================
// Homework Hub Routes (Phase 4)
// ============================================

/**
 * GET /api/canvas-integrity/homework-hub
 * Get complete homework hub data
 */
canvasIntegrityRouter.get('/homework-hub', async (c) => {
  const data = await homeworkHubService.getHomeworkHubData();

  return c.json({
    success: true,
    data,
  });
});

/**
 * GET /api/canvas-integrity/homework-hub/summary
 * Get homework summary for dashboard widgets
 */
canvasIntegrityRouter.get('/homework-hub/summary', async (c) => {
  const summary = await homeworkHubService.getSummary();

  return c.json({
    success: true,
    data: summary,
  });
});

/**
 * GET /api/canvas-integrity/homework-hub/due-today
 * Get assignments due today
 */
canvasIntegrityRouter.get('/homework-hub/due-today', async (c) => {
  const items = await homeworkHubService.getDueToday();

  return c.json({
    success: true,
    data: items,
    count: items.length,
  });
});

/**
 * GET /api/canvas-integrity/homework-hub/due-this-week
 * Get assignments due this week
 */
canvasIntegrityRouter.get('/homework-hub/due-this-week', async (c) => {
  const items = await homeworkHubService.getDueThisWeek();

  return c.json({
    success: true,
    data: items,
    count: items.length,
  });
});

/**
 * GET /api/canvas-integrity/homework-hub/critical
 * Get critical/urgent assignments
 */
canvasIntegrityRouter.get('/homework-hub/critical', async (c) => {
  const items = await homeworkHubService.getCriticalAssignments();

  return c.json({
    success: true,
    data: items,
    count: items.length,
  });
});

// ============================================
// Submission Routes (Phase 5)
// ============================================

const submitTextSchema = z.object({
  textBody: z.string().min(1, 'Text body is required'),
});

const submitUrlSchema = z.object({
  url: z.string().url('Valid URL is required'),
});

const submitFileSchema = z.object({
  filePath: z.string().min(1, 'File path is required'),
  fileName: z.string().optional(),
});

/**
 * GET /api/canvas-integrity/assignments/:id/submission
 * Get current submission status for an assignment
 */
canvasIntegrityRouter.get('/assignments/:id/submission', async (c) => {
  const canvasItemId = c.req.param('id');

  const status = await canvasSubmissionService.getSubmissionStatus(canvasItemId);

  if (!status) {
    throw new NotFoundError('Assignment not found or submission not available');
  }

  return c.json({
    success: true,
    data: status,
  });
});

/**
 * GET /api/canvas-integrity/assignments/:id/submission/can-submit
 * Check if submission is allowed for an assignment
 */
canvasIntegrityRouter.get('/assignments/:id/submission/can-submit', async (c) => {
  const canvasItemId = c.req.param('id');

  const result = await canvasSubmissionService.canSubmit(canvasItemId);

  return c.json({
    success: true,
    data: result,
  });
});

/**
 * GET /api/canvas-integrity/assignments/:id/submission/history
 * Get submission history for an assignment
 */
canvasIntegrityRouter.get('/assignments/:id/submission/history', async (c) => {
  const canvasItemId = c.req.param('id');

  const history = await canvasSubmissionService.getSubmissionHistory(canvasItemId);

  if (!history) {
    throw new NotFoundError('Assignment not found');
  }

  return c.json({
    success: true,
    data: history,
    count: history.length,
  });
});

/**
 * POST /api/canvas-integrity/assignments/:id/submit/text
 * Submit a text entry for an assignment
 */
canvasIntegrityRouter.post('/assignments/:id/submit/text', async (c) => {
  const canvasItemId = c.req.param('id');
  const body = await c.req.json();

  const parsed = submitTextSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.errors[0].message);
  }

  const result = await canvasSubmissionService.submitText({
    canvasItemId,
    textBody: parsed.data.textBody,
  });

  if (!result.success) {
    return c.json(
      {
        success: false,
        error: { message: result.error },
      },
      400
    );
  }

  return c.json({
    success: true,
    data: {
      submissionId: result.submissionId,
      attempt: result.attempt,
      submittedAt: result.submittedAt,
    },
    message: 'Assignment submitted successfully',
  });
});

/**
 * POST /api/canvas-integrity/assignments/:id/submit/url
 * Submit a URL for an assignment
 */
canvasIntegrityRouter.post('/assignments/:id/submit/url', async (c) => {
  const canvasItemId = c.req.param('id');
  const body = await c.req.json();

  const parsed = submitUrlSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.errors[0].message);
  }

  const result = await canvasSubmissionService.submitUrl({
    canvasItemId,
    url: parsed.data.url,
  });

  if (!result.success) {
    return c.json(
      {
        success: false,
        error: { message: result.error },
      },
      400
    );
  }

  return c.json({
    success: true,
    data: {
      submissionId: result.submissionId,
      attempt: result.attempt,
      submittedAt: result.submittedAt,
    },
    message: 'URL submitted successfully',
  });
});

/**
 * POST /api/canvas-integrity/assignments/:id/submit/file
 * Submit a file for an assignment
 */
canvasIntegrityRouter.post('/assignments/:id/submit/file', async (c) => {
  const canvasItemId = c.req.param('id');
  const body = await c.req.json();

  const parsed = submitFileSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(parsed.error.errors[0].message);
  }

  const result = await canvasSubmissionService.submitFile({
    canvasItemId,
    filePath: parsed.data.filePath,
    fileName: parsed.data.fileName,
  });

  if (!result.success) {
    return c.json(
      {
        success: false,
        error: { message: result.error },
      },
      400
    );
  }

  return c.json({
    success: true,
    data: {
      submissionId: result.submissionId,
      attempt: result.attempt,
      submittedAt: result.submittedAt,
    },
    message: 'File submitted successfully',
  });
});

// ============================================
// Grades Routes (Phase 5)
// ============================================

/**
 * GET /api/canvas-integrity/grades/summary
 * Get grade summary across all courses
 */
canvasIntegrityRouter.get('/grades/summary', async (c) => {
  const summary = await canvasGradesService.getGradeSummary();

  return c.json({
    success: true,
    data: summary,
  });
});

/**
 * GET /api/canvas-integrity/grades/check
 * Check for new grades and return updates
 */
canvasIntegrityRouter.get('/grades/check', async (c) => {
  const updates = await canvasGradesService.checkForNewGrades();

  return c.json({
    success: true,
    data: {
      updates,
      hasNewGrades: updates.length > 0,
      count: updates.length,
    },
  });
});

/**
 * GET /api/canvas-integrity/grades/pending
 * Get submitted assignments awaiting grades
 */
canvasIntegrityRouter.get('/grades/pending', async (c) => {
  const pending = await canvasGradesService.getPendingGrades();

  return c.json({
    success: true,
    data: pending,
    count: pending.length,
  });
});

/**
 * GET /api/canvas-integrity/grades/course/:courseId
 * Get all grades for a specific course
 */
canvasIntegrityRouter.get('/grades/course/:courseId', async (c) => {
  const courseId = c.req.param('courseId');

  const grades = await canvasGradesService.getCourseGrades(courseId);

  if (!grades) {
    throw new NotFoundError('Course not found or no grades available');
  }

  return c.json({
    success: true,
    data: grades,
  });
});

export { canvasIntegrityRouter };

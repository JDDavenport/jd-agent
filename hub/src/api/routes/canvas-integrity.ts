import { Hono } from 'hono';
import { z } from 'zod';
import { canvasIntegrityService } from '../../services/canvas-integrity-service';
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

export { canvasIntegrityRouter };

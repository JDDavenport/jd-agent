/**
 * JD Agent - Setup Wizard API Routes
 * 
 * Endpoints for the setup wizard:
 * - Status and progress
 * - Service connection testing
 * - Brain dump
 * - Inbox processing
 * - Ceremony configuration
 * - Class management
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { setupService, type ServiceName } from '../../services/setup-service';
import { taskService } from '../../services/task-service';
import { ceremonyService } from '../../services/ceremony-service';
import { ValidationError } from '../middleware/error-handler';

const setupRouter = new Hono();

// ============================================
// Status Routes
// ============================================

/**
 * GET /api/setup/status
 * Get overall setup status and progress
 */
setupRouter.get('/status', async (c) => {
  const status = await setupService.getStatus();
  
  return c.json({
    success: true,
    data: status,
  });
});

/**
 * GET /api/setup/services
 * Get status of all services
 */
setupRouter.get('/services', async (c) => {
  const services = await setupService.checkAllServices();
  
  return c.json({
    success: true,
    data: services,
  });
});

// ============================================
// Service Connection Routes
// ============================================

/**
 * POST /api/setup/connect/:service/test
 * Test a specific service connection
 */
setupRouter.post('/connect/:service/test', async (c) => {
  const service = c.req.param('service') as ServiceName;
  
  const validServices: ServiceName[] = [
    'telegram', 'twilio', 'resend', 'canvas'
  ];
  
  if (!validServices.includes(service)) {
    return c.json({
      success: false,
      error: { code: 'INVALID_SERVICE', message: 'Cannot test this service' },
    }, 400);
  }

  const result = await setupService.testService(service);
  
  return c.json({
    success: result.success,
    data: { message: result.message },
  });
});

// ============================================
// Brain Dump Routes
// ============================================

/**
 * POST /api/setup/brain-dump
 * Add a task during brain dump (quick add)
 */
setupRouter.post('/brain-dump', async (c) => {
  const body = await c.req.json();
  
  const schema = z.object({
    title: z.string().min(1, 'Title is required'),
    context: z.string().optional(),
  });
  
  const parseResult = schema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.message);
  }

  const task = await taskService.create({
    title: parseResult.data.title,
    source: 'manual',
    context: parseResult.data.context || 'Inbox',
    status: 'inbox',
  });

  return c.json({
    success: true,
    data: {
      id: task.id,
      title: task.title,
    },
    message: 'Task added to inbox',
  }, 201);
});

/**
 * POST /api/setup/brain-dump/bulk
 * Add multiple tasks at once
 */
setupRouter.post('/brain-dump/bulk', async (c) => {
  const body = await c.req.json();
  
  const schema = z.object({
    tasks: z.array(z.object({
      title: z.string().min(1),
      context: z.string().optional(),
    })).min(1),
  });
  
  const parseResult = schema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.message);
  }

  const created = [];
  for (const taskData of parseResult.data.tasks) {
    const task = await taskService.create({
      title: taskData.title,
      source: 'manual',
      context: taskData.context || 'Inbox',
      status: 'inbox',
    });
    created.push({ id: task.id, title: task.title });
  }

  return c.json({
    success: true,
    data: created,
    count: created.length,
    message: `Added ${created.length} tasks to inbox`,
  }, 201);
});

// ============================================
// Inbox Processing Routes
// ============================================

/**
 * GET /api/setup/inbox
 * Get inbox items for processing
 */
setupRouter.get('/inbox', async (c) => {
  const tasks = await taskService.list({ status: 'inbox' });
  
  return c.json({
    success: true,
    data: tasks.map(t => ({
      id: t.id,
      title: t.title,
      description: t.description,
      context: t.context,
      source: t.source,
      createdAt: t.createdAt,
    })),
    count: tasks.length,
  });
});

/**
 * GET /api/setup/inbox/next
 * Get next inbox item to process
 */
setupRouter.get('/inbox/next', async (c) => {
  const tasks = await taskService.list({ status: 'inbox' });
  
  if (tasks.length === 0) {
    return c.json({
      success: true,
      data: null,
      remaining: 0,
      message: 'Inbox is empty!',
    });
  }

  const next = tasks[0];
  
  return c.json({
    success: true,
    data: {
      id: next.id,
      title: next.title,
      description: next.description,
      context: next.context,
      source: next.source,
      createdAt: next.createdAt,
    },
    remaining: tasks.length,
  });
});

/**
 * POST /api/setup/inbox/:id/process
 * Process an inbox item (add due date, move to today, etc.)
 */
setupRouter.post('/inbox/:id/process', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  
  const schema = z.object({
    action: z.enum(['today', 'upcoming', 'someday', 'waiting', 'delete']),
    dueDate: z.string().optional(),
    context: z.string().optional(),
    priority: z.number().optional(),
    waitingFor: z.string().optional(),
  });
  
  const parseResult = schema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.message);
  }

  const { action, dueDate, context, priority, waitingFor } = parseResult.data;

  if (action === 'delete') {
    await taskService.delete(id);
    return c.json({
      success: true,
      message: 'Task deleted',
    });
  }

  const task = await taskService.update(id, {
    status: action,
    dueDate: dueDate ? new Date(dueDate) : undefined,
    context: context,
    priority: priority,
    waitingFor: waitingFor,
  });

  if (!task) {
    return c.json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Task not found' },
    }, 404);
  }

  return c.json({
    success: true,
    data: {
      id: task.id,
      title: task.title,
      status: task.status,
    },
    message: `Task moved to ${action}`,
  });
});

// ============================================
// Ceremony Configuration Routes
// ============================================

/**
 * GET /api/setup/ceremonies
 * Get ceremony configuration
 */
setupRouter.get('/ceremonies', async (c) => {
  // Get current ceremony settings (from environment for now)
  return c.json({
    success: true,
    data: {
      morningTime: '06:00',
      eveningTime: '21:00',
      weeklyDay: 'Sunday',
      weeklyTime: '16:00',
      notificationChannels: {
        telegram: {
          configured: !!process.env.TELEGRAM_CHAT_ID,
          chatId: process.env.TELEGRAM_CHAT_ID || null,
        },
        sms: {
          configured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.USER_PHONE_NUMBER),
          phoneNumber: process.env.USER_PHONE_NUMBER || null,
        },
        email: {
          configured: !!(process.env.RESEND_API_KEY),
          email: process.env.USER_EMAIL || process.env.GOOGLE_USER_EMAIL || null,
        },
      },
    },
  });
});

/**
 * POST /api/setup/ceremonies/test
 * Send test ceremony notification
 */
setupRouter.post('/ceremonies/test', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const type = body.type || 'morning';
  
  const content = await ceremonyService.preview(type);
  
  // Format for notification
  let message = `🧪 *Test ${type.charAt(0).toUpperCase() + type.slice(1)} Ceremony*\n\n`;
  message += `${content.greeting}\n\n`;
  for (const section of content.sections) {
    message += `*${section.heading}*\n${section.content}\n\n`;
  }
  message += content.signOff;

  // Send via notification service
  const { notificationService } = await import('../../services/notification-service');
  const result = await notificationService.send(message);

  return c.json({
    success: result.success,
    data: {
      channel: result.channel,
      preview: content,
    },
    message: result.success 
      ? 'Test ceremony sent!'
      : `Failed: ${result.error}`,
  });
});

// ============================================
// Class Management Routes
// ============================================

/**
 * GET /api/setup/classes
 * Get all classes
 */
setupRouter.get('/classes', async (c) => {
  const classes = await setupService.getClasses();
  
  return c.json({
    success: true,
    data: classes,
    count: classes.length,
  });
});

/**
 * POST /api/setup/classes
 * Add a new class
 */
setupRouter.post('/classes', async (c) => {
  const body = await c.req.json();
  
  const schema = z.object({
    name: z.string().min(1, 'Name is required'),
    courseCode: z.string().min(1, 'Course code is required'),
    professor: z.string().optional(),
    canvasCourseId: z.string().optional(),
    schedule: z.object({
      days: z.array(z.string()),
      startTime: z.string(),
      endTime: z.string(),
    }).optional(),
  });
  
  const parseResult = schema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.message);
  }

  const result = await setupService.addClass(parseResult.data);

  return c.json({
    success: true,
    data: result,
    message: 'Class added',
  }, 201);
});

/**
 * GET /api/setup/canvas/courses
 * Get available Canvas courses for linking
 */
setupRouter.get('/canvas/courses', async (c) => {
  const { canvasIntegration } = await import('../../integrations/canvas');
  
  if (!canvasIntegration.isConfigured()) {
    return c.json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'Canvas not configured' },
    }, 400);
  }

  try {
    const courses = await canvasIntegration.getCourses();
    return c.json({
      success: true,
      data: courses.map(c => ({
        id: c.id,
        name: c.name,
        courseCode: c.course_code,
      })),
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'CANVAS_ERROR', message: String(error) },
    }, 500);
  }
});

// ============================================
// Completion Routes
// ============================================

/**
 * GET /api/setup/summary
 * Get setup summary
 */
setupRouter.get('/summary', async (c) => {
  const status = await setupService.getStatus();
  const services = status.services;
  
  const connected = services.filter(s => s.connected);
  const notConnected = services.filter(s => !s.connected && s.configured);

  // Get counts
  const { taskService } = await import('../../services/task-service');
  const taskCounts = await taskService.getCounts();
  
  const classes = await setupService.getClasses();

  return c.json({
    success: true,
    data: {
      setupComplete: status.complete,
      connectedServices: connected.map(s => s.displayName),
      pendingServices: notConnected.map(s => s.displayName),
      taskCounts,
      classCount: classes.length,
      nextSteps: [
        'Your morning briefing will arrive at 6:00 AM',
        'Check your inbox regularly to stay on top of tasks',
        'Use the agent (/api/chat) to interact naturally',
      ],
    },
  });
});

/**
 * POST /api/setup/complete
 * Mark setup as complete
 */
setupRouter.post('/complete', async (c) => {
  await setupService.markComplete();
  
  const summary = await setupService.getStatus();

  return c.json({
    success: true,
    data: summary,
    message: 'Setup complete! Welcome to JD Agent.',
  });
});

/**
 * GET /api/setup/preview/morning
 * Preview morning ceremony
 */
setupRouter.get('/preview/morning', async (c) => {
  const content = await ceremonyService.preview('morning');
  
  // Format as readable text
  let formatted = `${content.greeting}\n\n`;
  for (const section of content.sections) {
    formatted += `${section.heading}\n`;
    formatted += `${section.content}\n\n`;
  }
  formatted += content.signOff;

  return c.json({
    success: true,
    data: {
      content,
      formatted,
    },
  });
});

export { setupRouter };

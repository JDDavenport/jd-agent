/**
 * Scheduling API Routes
 * 
 * Manage task scheduling and calendar integration
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { schedulingService } from '../../services/scheduling-service';
import { ValidationError, NotFoundError } from '../middleware/error-handler';

const scheduleRouter = new Hono();

/**
 * POST /api/schedule/task
 * Schedule a task for a specific time
 */
scheduleRouter.post('/task', async (c) => {
  const body = await c.req.json();
  
  const schema = z.object({
    taskId: z.string().uuid(),
    startTime: z.string().datetime(),
    endTime: z.string().datetime().optional(),
    createCalendarEvent: z.boolean().optional().default(true),
  });

  const parseResult = schema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.message);
  }

  const result = await schedulingService.scheduleTask({
    taskId: parseResult.data.taskId,
    startTime: new Date(parseResult.data.startTime),
    endTime: parseResult.data.endTime ? new Date(parseResult.data.endTime) : undefined,
    createCalendarEvent: parseResult.data.createCalendarEvent,
  });

  if (!result.success) {
    return c.json({
      success: false,
      error: { code: 'SCHEDULE_FAILED', message: result.error },
    }, 400);
  }

  return c.json({
    success: true,
    data: result,
    message: 'Task scheduled successfully',
  });
});

/**
 * DELETE /api/schedule/task/:id
 * Unschedule a task
 */
scheduleRouter.delete('/task/:id', async (c) => {
  const taskId = c.req.param('id');
  
  const result = await schedulingService.unscheduleTask(taskId);

  if (!result.success) {
    return c.json({
      success: false,
      error: { code: 'UNSCHEDULE_FAILED', message: result.error },
    }, 400);
  }

  return c.json({
    success: true,
    message: 'Task unscheduled',
  });
});

/**
 * PUT /api/schedule/task/:id
 * Reschedule a task
 */
scheduleRouter.put('/task/:id', async (c) => {
  const taskId = c.req.param('id');
  const body = await c.req.json();
  
  const schema = z.object({
    startTime: z.string().datetime(),
    endTime: z.string().datetime().optional(),
  });

  const parseResult = schema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.message);
  }

  const result = await schedulingService.rescheduleTask(
    taskId,
    new Date(parseResult.data.startTime),
    parseResult.data.endTime ? new Date(parseResult.data.endTime) : undefined
  );

  if (!result.success) {
    return c.json({
      success: false,
      error: { code: 'RESCHEDULE_FAILED', message: result.error },
    }, 400);
  }

  return c.json({
    success: true,
    data: result,
    message: 'Task rescheduled',
  });
});

/**
 * GET /api/schedule/today
 * Get today's scheduled tasks
 */
scheduleRouter.get('/today', async (c) => {
  const tasks = await schedulingService.getTodaysSchedule();

  return c.json({
    success: true,
    data: tasks.map(t => ({
      id: t.id,
      title: t.title,
      context: t.context,
      scheduledStart: t.scheduledStart,
      scheduledEnd: t.scheduledEnd,
      dueDate: t.dueDate,
      priority: t.priority,
      calendarEventId: t.calendarEventId,
    })),
    count: tasks.length,
  });
});

/**
 * GET /api/schedule/range
 * Get scheduled tasks for a date range
 */
scheduleRouter.get('/range', async (c) => {
  const start = c.req.query('start');
  const end = c.req.query('end');

  if (!start || !end) {
    throw new ValidationError('start and end query params required');
  }

  const tasks = await schedulingService.getScheduledTasks(
    new Date(start),
    new Date(end)
  );

  return c.json({
    success: true,
    data: tasks.map(t => ({
      id: t.id,
      title: t.title,
      context: t.context,
      scheduledStart: t.scheduledStart,
      scheduledEnd: t.scheduledEnd,
      dueDate: t.dueDate,
    })),
    count: tasks.length,
  });
});

/**
 * GET /api/schedule/suggestions
 * Get auto-scheduling suggestions
 */
scheduleRouter.get('/suggestions', async (c) => {
  const days = parseInt(c.req.query('days') || '7', 10);
  
  const suggestions = await schedulingService.suggestSchedule(days);

  return c.json({
    success: true,
    data: suggestions.map(s => ({
      task: {
        id: s.task.id,
        title: s.task.title,
        context: s.task.context,
        dueDate: s.task.dueDate,
        timeEstimateMinutes: s.task.timeEstimateMinutes,
      },
      suggestedStart: s.suggestedStart,
      suggestedEnd: s.suggestedEnd,
      reason: s.reason,
    })),
    count: suggestions.length,
  });
});

/**
 * POST /api/schedule/suggestions/:taskId/accept
 * Accept a scheduling suggestion
 */
scheduleRouter.post('/suggestions/:taskId/accept', async (c) => {
  const taskId = c.req.param('taskId');
  const body = await c.req.json();

  const schema = z.object({
    startTime: z.string().datetime(),
    endTime: z.string().datetime().optional(),
  });

  const parseResult = schema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.message);
  }

  const result = await schedulingService.scheduleTask({
    taskId,
    startTime: new Date(parseResult.data.startTime),
    endTime: parseResult.data.endTime ? new Date(parseResult.data.endTime) : undefined,
  });

  return c.json({
    success: result.success,
    data: result,
    message: result.success ? 'Suggestion accepted and scheduled' : result.error,
  });
});

/**
 * POST /api/schedule/sync-calendar
 * Sync all scheduled tasks to Google Calendar
 */
scheduleRouter.post('/sync-calendar', async (c) => {
  const result = await schedulingService.syncAllToCalendar();

  return c.json({
    success: true,
    data: result,
    message: `Synced ${result.synced} tasks to calendar`,
  });
});

export { scheduleRouter };

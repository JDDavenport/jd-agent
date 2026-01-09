import { Hono } from 'hono';
import { z } from 'zod';
import { calendarService } from '../../services/calendar-service';
import { getGoogleCalendar } from '../../integrations/google-calendar';
import { ValidationError, NotFoundError } from '../middleware/error-handler';

const calendarRouter = new Hono();

// ============================================
// Validation Schemas
// ============================================

const eventTypeEnum = z.enum(['class', 'meeting', 'deadline', 'personal', 'blocked_time']);

const createEventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  location: z.string().optional(),
  startTime: z.string().datetime().transform(val => new Date(val)),
  endTime: z.string().datetime().transform(val => new Date(val)),
  allDay: z.boolean().optional(),
  eventType: eventTypeEnum.optional(),
  context: z.string().optional(),
  attendees: z.array(z.string()).optional(),
  syncToGoogle: z.boolean().optional(),
});

const updateEventSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  startTime: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  endTime: z.string().datetime().optional().transform(val => val ? new Date(val) : undefined),
  allDay: z.boolean().optional(),
  eventType: eventTypeEnum.optional(),
  context: z.string().optional(),
});

// Helper to parse date or datetime strings
const dateStringToDate = (val: string | undefined): Date | undefined => {
  if (!val) return undefined;
  // If it's just a date (YYYY-MM-DD), add time component
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return new Date(val + 'T00:00:00.000Z');
  }
  return new Date(val);
};

const listFiltersSchema = z.object({
  startDate: z.string().optional().transform(dateStringToDate),
  endDate: z.string().optional().transform(dateStringToDate),
  eventType: eventTypeEnum.optional(),
  context: z.string().optional(),
});

// ============================================
// Routes
// ============================================

/**
 * GET /api/calendar
 * GET /api/calendar/events
 * List calendar events with optional filters
 */
const listEventsHandler = async (c: any) => {
  const query = c.req.query();
  const parseResult = listFiltersSchema.safeParse(query);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.message);
  }

  const events = await calendarService.list(parseResult.data);

  return c.json({
    success: true,
    data: events,
    count: events.length,
  });
};

calendarRouter.get('/', listEventsHandler);
calendarRouter.get('/events', listEventsHandler);

/**
 * GET /api/calendar/today
 * Get today's events
 */
calendarRouter.get('/today', async (c) => {
  const events = await calendarService.getToday();
  return c.json({
    success: true,
    data: events,
    count: events.length,
  });
});

/**
 * GET /api/calendar/upcoming
 * Get upcoming events (default 7 days)
 */
calendarRouter.get('/upcoming', async (c) => {
  const days = parseInt(c.req.query('days') || '7', 10);
  const events = await calendarService.getUpcoming(days);
  return c.json({
    success: true,
    data: events,
    count: events.length,
    days,
  });
});

/**
 * GET /api/calendar/sync
 * Trigger sync from Google Calendar
 */
calendarRouter.get('/sync', async (c) => {
  const days = parseInt(c.req.query('days') || '30', 10);
  
  const googleCalendar = getGoogleCalendar();
  if (!googleCalendar.isConfigured()) {
    return c.json({
      success: false,
      error: 'Google Calendar not configured',
    }, 400);
  }

  const result = await calendarService.syncFromGoogle(days);
  
  return c.json({
    success: true,
    data: result,
    message: `Synced ${result.created} new and ${result.updated} updated events`,
  });
});

/**
 * GET /api/calendar/status
 * Get Google Calendar integration status
 */
calendarRouter.get('/status', async (c) => {
  const googleCalendar = getGoogleCalendar();
  const counts = await calendarService.getCountsByType();
  
  return c.json({
    success: true,
    data: {
      googleConfigured: googleCalendar.isConfigured(),
      eventCounts: counts,
    },
  });
});

/**
 * GET /api/calendar/:id
 * Get a single event by ID
 */
calendarRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid event ID format');
  }

  const event = await calendarService.getById(id);
  
  if (!event) {
    throw new NotFoundError('Calendar event');
  }

  return c.json({
    success: true,
    data: event,
  });
});

/**
 * POST /api/calendar
 * Create a new calendar event
 */
calendarRouter.post('/', async (c) => {
  const body = await c.req.json();
  const parseResult = createEventSchema.safeParse(body);
  
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
  }

  // Validate end time is after start time
  if (parseResult.data.endTime <= parseResult.data.startTime) {
    throw new ValidationError('End time must be after start time');
  }

  const event = await calendarService.create(parseResult.data);
  
  return c.json({
    success: true,
    data: event,
    message: 'Event created successfully',
  }, 201);
});

/**
 * POST /api/calendar/check-conflicts
 * Check for conflicts at a given time
 */
calendarRouter.post('/check-conflicts', async (c) => {
  const body = await c.req.json();
  
  const schema = z.object({
    startTime: z.string().datetime().transform(val => new Date(val)),
    endTime: z.string().datetime().transform(val => new Date(val)),
    excludeId: z.string().uuid().optional(),
  });

  const parseResult = schema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
  }

  const result = await calendarService.checkConflicts(
    parseResult.data.startTime,
    parseResult.data.endTime,
    parseResult.data.excludeId
  );

  return c.json({
    success: true,
    data: result,
  });
});

/**
 * PATCH /api/calendar/:id
 * Update an existing event
 */
calendarRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');
  
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid event ID format');
  }

  const body = await c.req.json();
  const parseResult = updateEventSchema.safeParse(body);
  
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
  }

  const updateData = Object.fromEntries(
    Object.entries(parseResult.data).filter(([_, v]) => v !== undefined)
  );

  if (Object.keys(updateData).length === 0) {
    throw new ValidationError('No valid fields to update');
  }

  const event = await calendarService.update(id, updateData as any);
  
  if (!event) {
    throw new NotFoundError('Calendar event');
  }

  return c.json({
    success: true,
    data: event,
    message: 'Event updated successfully',
  });
});

/**
 * DELETE /api/calendar/:id
 * Delete a calendar event
 */
calendarRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid event ID format');
  }

  const deleted = await calendarService.delete(id);
  
  if (!deleted) {
    throw new NotFoundError('Calendar event');
  }

  return c.json({
    success: true,
    message: 'Event deleted successfully',
  });
});

export { calendarRouter };

import { eq, and, gte, lte, desc, asc, sql, gt, lt } from 'drizzle-orm';
import { db } from '../db/client';
import { calendarEvents } from '../db/schema';
import { getGoogleCalendar, type CalendarEventInput } from '../integrations/google-calendar';

// ============================================
// Types
// ============================================

export interface CreateEventInput {
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  allDay?: boolean;
  eventType?: 'class' | 'meeting' | 'deadline' | 'personal' | 'blocked_time';
  context?: string;
  attendees?: string[];
  syncToGoogle?: boolean;
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  location?: string;
  startTime?: Date;
  endTime?: Date;
  allDay?: boolean;
  eventType?: 'class' | 'meeting' | 'deadline' | 'personal' | 'blocked_time';
  context?: string;
  attendees?: string[];
}

export interface EventFilters {
  startDate?: Date;
  endDate?: Date;
  eventType?: string;
  context?: string;
}

export interface CalendarEventRecord {
  id: string;
  googleEventId: string | null;
  title: string;
  description: string | null;
  location: string | null;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  eventType: string | null;
  context: string | null;
  attendees: string[] | null;
  alertSent: boolean;
  syncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Calendar Service
// ============================================

export class CalendarService {
  private googleCalendar = getGoogleCalendar();

  /**
   * Create a new calendar event
   */
  async create(input: CreateEventInput): Promise<CalendarEventRecord> {
    let googleEventId: string | null = null;

    // Sync to Google Calendar if requested and configured
    if (input.syncToGoogle !== false && this.googleCalendar.isConfigured()) {
      try {
        googleEventId = await this.googleCalendar.createEvent({
          title: input.title,
          description: input.description,
          location: input.location,
          startTime: input.startTime,
          endTime: input.endTime,
          allDay: input.allDay,
          eventType: input.eventType,
          context: input.context,
        });
      } catch (error) {
        console.error('[CalendarService] Failed to create Google event:', error);
      }
    }

    const [event] = await db
      .insert(calendarEvents)
      .values({
        googleEventId,
        title: input.title,
        description: input.description,
        location: input.location,
        startTime: input.startTime,
        endTime: input.endTime,
        allDay: input.allDay || false,
        eventType: input.eventType,
        context: input.context,
        attendees: input.attendees,
        syncedAt: googleEventId ? new Date() : null,
      })
      .returning();

    return event as CalendarEventRecord;
  }

  /**
   * Get an event by ID
   */
  async getById(id: string): Promise<CalendarEventRecord | null> {
    const [event] = await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.id, id))
      .limit(1);

    return event as CalendarEventRecord || null;
  }

  /**
   * Get an event by Google Event ID
   */
  async getByGoogleId(googleEventId: string): Promise<CalendarEventRecord | null> {
    const [event] = await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.googleEventId, googleEventId))
      .limit(1);

    return event as CalendarEventRecord || null;
  }

  /**
   * List events with optional filters
   * If no date range is provided, defaults to current date + 30 days
   */
  async list(filters: EventFilters = {}): Promise<CalendarEventRecord[]> {
    console.log('[CalendarService] list() starting');

    try {
      // Default to current date range if no dates provided
      const effectiveFilters = { ...filters };
      if (!effectiveFilters.startDate && !effectiveFilters.endDate) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        effectiveFilters.startDate = now;
        const future = new Date(now);
        future.setDate(future.getDate() + 30);
        effectiveFilters.endDate = future;
      }

      console.log('[CalendarService] list() called with filters:', JSON.stringify({
        startDate: effectiveFilters.startDate?.toISOString(),
        endDate: effectiveFilters.endDate?.toISOString(),
        eventType: effectiveFilters.eventType,
        context: effectiveFilters.context,
      }));

      // Use simple query without date filters first to test
      console.log('[CalendarService] Executing simplified query');

      const events = await db
        .select()
        .from(calendarEvents)
        .orderBy(asc(calendarEvents.startTime))
        .limit(100);

      console.log('[CalendarService] Query returned', events.length, 'events');

      // Filter in-memory if date filters provided
      let filtered = events as CalendarEventRecord[];
      if (effectiveFilters.startDate) {
        filtered = filtered.filter(e => new Date(e.startTime) >= effectiveFilters.startDate!);
      }
      if (effectiveFilters.endDate) {
        filtered = filtered.filter(e => new Date(e.startTime) <= effectiveFilters.endDate!);
      }
      if (effectiveFilters.eventType) {
        filtered = filtered.filter(e => e.eventType === effectiveFilters.eventType);
      }
      if (effectiveFilters.context) {
        filtered = filtered.filter(e => e.context === effectiveFilters.context);
      }

      console.log('[CalendarService] After filtering:', filtered.length, 'events');
      return filtered;
    } catch (error) {
      console.error('[CalendarService] Query error:', error);
      console.error('[CalendarService] Query error message:', error instanceof Error ? error.message : 'unknown');
      throw error;
    }
  }

  /**
   * Get today's events
   */
  async getToday(): Promise<CalendarEventRecord[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.list({ startDate: today, endDate: tomorrow });
  }

  /**
   * Get upcoming events for the next N days
   */
  async getUpcoming(days: number = 7): Promise<CalendarEventRecord[]> {
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + days);

    return this.list({ startDate: now, endDate: future });
  }

  /**
   * Get events in a date range
   */
  async getInRange(startDate: Date, endDate: Date): Promise<CalendarEventRecord[]> {
    return this.list({ startDate, endDate });
  }

  /**
   * Update an event
   */
  async update(id: string, input: UpdateEventInput): Promise<CalendarEventRecord | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.location !== undefined) updateData.location = input.location;
    if (input.startTime !== undefined) updateData.startTime = input.startTime;
    if (input.endTime !== undefined) updateData.endTime = input.endTime;
    if (input.allDay !== undefined) updateData.allDay = input.allDay;
    if (input.eventType !== undefined) updateData.eventType = input.eventType;
    if (input.context !== undefined) updateData.context = input.context;

    // Update in Google Calendar if linked
    if (existing.googleEventId && this.googleCalendar.isConfigured()) {
      try {
        await this.googleCalendar.updateEvent(existing.googleEventId, {
          title: input.title,
          description: input.description,
          location: input.location,
          startTime: input.startTime,
          endTime: input.endTime,
          allDay: input.allDay,
        });
        updateData.syncedAt = new Date();
      } catch (error) {
        console.error('[CalendarService] Failed to update Google event:', error);
      }
    }

    const [updated] = await db
      .update(calendarEvents)
      .set(updateData)
      .where(eq(calendarEvents.id, id))
      .returning();

    return updated as CalendarEventRecord || null;
  }

  /**
   * Delete an event
   */
  async delete(id: string): Promise<boolean> {
    const existing = await this.getById(id);
    if (!existing) return false;

    // Delete from Google Calendar if linked
    if (existing.googleEventId && this.googleCalendar.isConfigured()) {
      try {
        await this.googleCalendar.deleteEvent(existing.googleEventId);
      } catch (error) {
        console.error('[CalendarService] Failed to delete Google event:', error);
      }
    }

    const result = await db
      .delete(calendarEvents)
      .where(eq(calendarEvents.id, id))
      .returning();

    return result.length > 0;
  }

  /**
   * Sync events from Google Calendar
   */
  async syncFromGoogle(days: number = 30): Promise<{
    created: number;
    updated: number;
    errors: string[];
  }> {
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + days);

    return this.googleCalendar.syncFromGoogle(now, future);
  }

  /**
   * Check for conflicts
   */
  async checkConflicts(startTime: Date, endTime: Date, excludeId?: string): Promise<{
    hasConflict: boolean;
    conflictingEvents: CalendarEventRecord[];
  }> {
    // Check local database for conflicts
    const overlapping = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          sql`${calendarEvents.startTime} < ${endTime}`,
          sql`${calendarEvents.endTime} > ${startTime}`,
          excludeId ? sql`${calendarEvents.id} != ${excludeId}` : undefined
        )
      );

    return {
      hasConflict: overlapping.length > 0,
      conflictingEvents: overlapping as CalendarEventRecord[],
    };
  }

  /**
   * Get events needing alerts (starting within X minutes)
   */
  async getEventsNeedingAlerts(withinMinutes: number = 15): Promise<CalendarEventRecord[]> {
    const now = new Date();
    const alertWindow = new Date(now.getTime() + withinMinutes * 60 * 1000);

    const events = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          gte(calendarEvents.startTime, now),
          lte(calendarEvents.startTime, alertWindow),
          eq(calendarEvents.alertSent, false)
        )
      )
      .orderBy(asc(calendarEvents.startTime));

    return events as CalendarEventRecord[];
  }

  /**
   * Mark alert as sent
   */
  async markAlertSent(id: string): Promise<void> {
    await db
      .update(calendarEvents)
      .set({ alertSent: true })
      .where(eq(calendarEvents.id, id));
  }

  /**
   * Get event counts by type
   */
  async getCountsByType(): Promise<Record<string, number>> {
    const result = await db
      .select({
        eventType: calendarEvents.eventType,
        count: sql<number>`count(*)::int`,
      })
      .from(calendarEvents)
      .groupBy(calendarEvents.eventType);

    const counts: Record<string, number> = {};
    for (const row of result) {
      counts[row.eventType || 'untyped'] = row.count;
    }
    return counts;
  }
}

// Export singleton instance
export const calendarService = new CalendarService();

import { google, calendar_v3 } from 'googleapis';
import { db } from '../db/client';
import { calendarEvents } from '../db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

// ============================================
// Types
// ============================================

export interface GoogleCalendarConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  calendarId?: string;
  timeZone?: string;
}

export interface CalendarEventInput {
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  allDay?: boolean;
  eventType?: 'class' | 'meeting' | 'deadline' | 'personal' | 'blocked_time';
  context?: string;
}

export interface SyncResult {
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
}

// ============================================
// Google Calendar Integration
// ============================================

export class GoogleCalendarIntegration {
  private calendar: calendar_v3.Calendar | null = null;
  private calendarId: string = 'primary';
  private timeZone: string = 'America/Denver';
  private auth: any = null;

  constructor(config?: GoogleCalendarConfig) {
    if (config?.clientId && config?.clientSecret && config?.refreshToken) {
      this.auth = new google.auth.OAuth2(
        config.clientId,
        config.clientSecret
      );
      
      this.auth.setCredentials({
        refresh_token: config.refreshToken,
      });

      this.calendar = google.calendar({ version: 'v3', auth: this.auth });
      this.calendarId = config.calendarId || 'primary';
      this.timeZone = config.timeZone || 'America/Denver';

      console.log('[Google Calendar] Integration initialized');
    } else {
      console.log('[Google Calendar] Not configured - missing credentials');
    }
  }

  /**
   * Check if calendar is configured
   */
  isConfigured(): boolean {
    return this.calendar !== null;
  }

  /**
   * Get events from Google Calendar
   */
  async getEvents(startDate: Date, endDate: Date): Promise<calendar_v3.Schema$Event[]> {
    if (!this.isConfigured()) {
      console.log('[Google Calendar] Not configured, returning empty');
      return [];
    }

    try {
      const response = await this.calendar!.events.list({
        calendarId: this.calendarId,
        timeMin: startDate.toISOString(),
        timeMax: endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 250,
      });

      return response.data.items || [];
    } catch (error) {
      console.error('[Google Calendar] Failed to get events:', error);
      throw error;
    }
  }

  /**
   * Get a single event by ID
   */
  async getEvent(eventId: string): Promise<calendar_v3.Schema$Event | null> {
    if (!this.isConfigured()) return null;

    try {
      const response = await this.calendar!.events.get({
        calendarId: this.calendarId,
        eventId,
      });

      return response.data;
    } catch (error) {
      console.error('[Google Calendar] Failed to get event:', error);
      return null;
    }
  }

  /**
   * Create a new event in Google Calendar
   */
  async createEvent(event: CalendarEventInput): Promise<string | null> {
    if (!this.isConfigured()) {
      console.log('[Google Calendar] Not configured, skipping event creation');
      return null;
    }

    try {
      const eventBody: calendar_v3.Schema$Event = {
        summary: event.title,
        description: event.description,
        location: event.location,
      };

      if (event.allDay) {
        eventBody.start = {
          date: event.startTime.toISOString().split('T')[0],
        };
        eventBody.end = {
          date: event.endTime.toISOString().split('T')[0],
        };
      } else {
        eventBody.start = {
          dateTime: event.startTime.toISOString(),
          timeZone: this.timeZone,
        };
        eventBody.end = {
          dateTime: event.endTime.toISOString(),
          timeZone: this.timeZone,
        };
      }

      const response = await this.calendar!.events.insert({
        calendarId: this.calendarId,
        requestBody: eventBody,
      });

      console.log('[Google Calendar] Created event:', response.data.id);
      return response.data.id || null;
    } catch (error) {
      console.error('[Google Calendar] Failed to create event:', error);
      throw error;
    }
  }

  /**
   * Update an existing event
   */
  async updateEvent(
    eventId: string,
    updates: Partial<CalendarEventInput>
  ): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      const existing = await this.getEvent(eventId);
      if (!existing) return false;

      const eventBody: calendar_v3.Schema$Event = {
        summary: updates.title || existing.summary,
        description: updates.description ?? existing.description,
        location: updates.location ?? existing.location,
      };

      if (updates.startTime && updates.endTime) {
        if (updates.allDay) {
          eventBody.start = {
            date: updates.startTime.toISOString().split('T')[0],
          };
          eventBody.end = {
            date: updates.endTime.toISOString().split('T')[0],
          };
        } else {
          eventBody.start = {
            dateTime: updates.startTime.toISOString(),
            timeZone: this.timeZone,
          };
          eventBody.end = {
            dateTime: updates.endTime.toISOString(),
            timeZone: this.timeZone,
          };
        }
      }

      await this.calendar!.events.update({
        calendarId: this.calendarId,
        eventId,
        requestBody: eventBody,
      });

      console.log('[Google Calendar] Updated event:', eventId);
      return true;
    } catch (error) {
      console.error('[Google Calendar] Failed to update event:', error);
      return false;
    }
  }

  /**
   * Delete an event
   */
  async deleteEvent(eventId: string): Promise<boolean> {
    if (!this.isConfigured()) return false;

    try {
      await this.calendar!.events.delete({
        calendarId: this.calendarId,
        eventId,
      });

      console.log('[Google Calendar] Deleted event:', eventId);
      return true;
    } catch (error) {
      console.error('[Google Calendar] Failed to delete event:', error);
      return false;
    }
  }

  /**
   * Sync events from Google Calendar to local database
   */
  async syncFromGoogle(startDate: Date, endDate: Date): Promise<SyncResult> {
    const result: SyncResult = { created: 0, updated: 0, deleted: 0, errors: [] };

    if (!this.isConfigured()) {
      result.errors.push('Google Calendar not configured');
      return result;
    }

    try {
      const googleEvents = await this.getEvents(startDate, endDate);

      for (const gEvent of googleEvents) {
        if (!gEvent.id) continue;

        try {
          // Check if event exists locally
          const [existing] = await db
            .select()
            .from(calendarEvents)
            .where(eq(calendarEvents.googleEventId, gEvent.id))
            .limit(1);

          const eventData = this.parseGoogleEvent(gEvent);

          if (existing) {
            // Update existing event
            await db
              .update(calendarEvents)
              .set({
                ...eventData,
                syncedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(calendarEvents.id, existing.id));
            result.updated++;
          } else {
            // Create new event
            await db.insert(calendarEvents).values({
              googleEventId: gEvent.id,
              ...eventData,
              syncedAt: new Date(),
            });
            result.created++;
          }
        } catch (error) {
          result.errors.push(`Failed to sync event ${gEvent.id}: ${error}`);
        }
      }

      console.log('[Google Calendar] Sync complete:', result);
    } catch (error) {
      result.errors.push(`Sync failed: ${error}`);
    }

    return result;
  }

  /**
   * Parse a Google Calendar event into our format
   */
  private parseGoogleEvent(gEvent: calendar_v3.Schema$Event): {
    title: string;
    description: string | undefined;
    location: string | undefined;
    startTime: Date;
    endTime: Date;
    allDay: boolean;
    eventType: string | undefined;
    context: string | undefined;
  } {
    const allDay = !!gEvent.start?.date;
    
    let startTime: Date;
    let endTime: Date;

    if (allDay) {
      startTime = new Date(gEvent.start!.date!);
      endTime = new Date(gEvent.end!.date!);
    } else {
      startTime = new Date(gEvent.start!.dateTime!);
      endTime = new Date(gEvent.end!.dateTime!);
    }

    // Try to detect event type from title or description
    const title = gEvent.summary || 'Untitled Event';
    let eventType: string | undefined;
    let context: string | undefined;

    const titleLower = title.toLowerCase();
    if (titleLower.includes('class') || titleLower.includes('lecture')) {
      eventType = 'class';
    } else if (titleLower.includes('meeting') || titleLower.includes('call')) {
      eventType = 'meeting';
    } else if (titleLower.includes('deadline') || titleLower.includes('due')) {
      eventType = 'deadline';
    }

    // Extract context from title (e.g., "CS401: Neural Networks" -> "CS401")
    const contextMatch = title.match(/^([A-Z]{2,4}\s?\d{3,4})/);
    if (contextMatch) {
      context = contextMatch[1].replace(/\s/g, '');
    }

    return {
      title,
      description: gEvent.description || undefined,
      location: gEvent.location || undefined,
      startTime,
      endTime,
      allDay,
      eventType,
      context,
    };
  }

  /**
   * Check for conflicts with existing events
   */
  async checkConflicts(startTime: Date, endTime: Date): Promise<{
    hasConflict: boolean;
    conflictingEvents: calendar_v3.Schema$Event[];
  }> {
    if (!this.isConfigured()) {
      return { hasConflict: false, conflictingEvents: [] };
    }

    const events = await this.getEvents(startTime, endTime);
    
    // Filter to only events that actually overlap
    const conflicts = events.filter(event => {
      const eventStart = event.start?.dateTime 
        ? new Date(event.start.dateTime) 
        : new Date(event.start?.date || '');
      const eventEnd = event.end?.dateTime 
        ? new Date(event.end.dateTime) 
        : new Date(event.end?.date || '');

      // Check for overlap
      return eventStart < endTime && eventEnd > startTime;
    });

    return {
      hasConflict: conflicts.length > 0,
      conflictingEvents: conflicts,
    };
  }

  /**
   * Get today's events
   */
  async getTodayEvents(): Promise<calendar_v3.Schema$Event[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.getEvents(today, tomorrow);
  }

  /**
   * Get upcoming events for the next N days
   */
  async getUpcomingEvents(days: number = 7): Promise<calendar_v3.Schema$Event[]> {
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + days);

    return this.getEvents(now, future);
  }
}

// ============================================
// Singleton instance
// ============================================

let calendarInstance: GoogleCalendarIntegration | null = null;

export function getGoogleCalendar(): GoogleCalendarIntegration {
  if (!calendarInstance) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const calendarId = process.env.GOOGLE_CALENDAR_ID;
    const timeZone = process.env.TIMEZONE || 'America/Denver';

    if (clientId && clientSecret && refreshToken) {
      calendarInstance = new GoogleCalendarIntegration({
        clientId,
        clientSecret,
        refreshToken,
        calendarId,
        timeZone,
      });
    } else {
      calendarInstance = new GoogleCalendarIntegration();
    }
  }
  return calendarInstance;
}

export { GoogleCalendarIntegration as default };

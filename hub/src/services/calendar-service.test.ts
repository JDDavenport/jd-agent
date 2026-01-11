import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { CalendarService, type CreateEventInput, type UpdateEventInput } from './calendar-service';
import { db } from '../db/client';
import { calendarEvents } from '../db/schema';

// Mock the database client
vi.mock('../db/client', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock Google Calendar integration
vi.mock('../integrations/google-calendar', () => ({
  getGoogleCalendar: vi.fn(() => ({
    isConfigured: vi.fn(() => false),
    createEvent: vi.fn(),
    updateEvent: vi.fn(),
    deleteEvent: vi.fn(),
    syncFromGoogle: vi.fn(),
  })),
}));

// Helper to create chainable mock
function createChainableMock(finalValue: unknown) {
  const chain: Record<string, Mock> = {};

  const createMethod = (returnValue: unknown): Mock => {
    return vi.fn().mockReturnValue(returnValue);
  };

  // Build chain from end to start
  chain.returning = createMethod(Promise.resolve(finalValue));
  chain.limit = createMethod(Promise.resolve(finalValue));
  chain.groupBy = createMethod(Promise.resolve(finalValue));

  // orderBy needs to support .limit() after it
  chain.orderBy = createMethod({
    limit: chain.limit,
    then: (resolve: (value: unknown) => void) => resolve(finalValue),
  });
  Object.assign(chain.orderBy(), Promise.resolve(finalValue));

  // where needs to return an object with returning, limit, orderBy
  chain.where = createMethod({
    returning: chain.returning,
    limit: chain.limit,
    orderBy: chain.orderBy,
    then: (resolve: (value: unknown) => void) => resolve(finalValue),
  });
  Object.assign(chain.where(), Promise.resolve(finalValue));

  chain.set = createMethod({ where: chain.where });
  chain.values = createMethod({ returning: chain.returning });
  chain.from = createMethod({
    where: chain.where,
    orderBy: chain.orderBy,
    groupBy: chain.groupBy,
    limit: chain.limit,
  });

  return chain;
}

// Create a new instance for each test to avoid singleton issues
function createCalendarService() {
  return new CalendarService();
}

describe('Calendar Service', () => {
  let calendarService: CalendarService;

  beforeEach(() => {
    vi.clearAllMocks();
    calendarService = createCalendarService();
  });

  // ============================================
  // CREATE EVENT TESTS
  // ============================================
  describe('create', () => {
    it('should create a new event with valid data', async () => {
      const eventData: CreateEventInput = {
        title: 'Team Meeting',
        description: 'Weekly team sync',
        location: 'Conference Room A',
        startTime: new Date('2026-01-15T10:00:00Z'),
        endTime: new Date('2026-01-15T11:00:00Z'),
        eventType: 'meeting',
      };

      const mockEvent = {
        id: 'event-1',
        googleEventId: null,
        title: eventData.title,
        description: eventData.description,
        location: eventData.location,
        startTime: eventData.startTime,
        endTime: eventData.endTime,
        allDay: false,
        eventType: eventData.eventType,
        context: null,
        attendees: null,
        alertSent: false,
        syncedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const chain = createChainableMock([mockEvent]);
      vi.mocked(db.insert).mockReturnValue({ values: chain.values } as any);

      const result = await calendarService.create(eventData);

      expect(result).toBeDefined();
      expect(result.title).toBe(eventData.title);
      expect(result.eventType).toBe('meeting');
      expect(db.insert).toHaveBeenCalledWith(calendarEvents);
    });

    it('should create event with all-day flag', async () => {
      const eventData: CreateEventInput = {
        title: 'Conference',
        startTime: new Date('2026-01-20T00:00:00Z'),
        endTime: new Date('2026-01-21T00:00:00Z'),
        allDay: true,
      };

      const mockEvent = {
        id: 'event-2',
        title: eventData.title,
        allDay: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const chain = createChainableMock([mockEvent]);
      vi.mocked(db.insert).mockReturnValue({ values: chain.values } as any);

      const result = await calendarService.create(eventData);

      expect(result.allDay).toBe(true);
    });

    it('should create event with attendees', async () => {
      const eventData: CreateEventInput = {
        title: 'Planning Session',
        startTime: new Date('2026-01-15T14:00:00Z'),
        endTime: new Date('2026-01-15T15:00:00Z'),
        attendees: ['alice@example.com', 'bob@example.com'],
      };

      const mockEvent = {
        id: 'event-3',
        title: eventData.title,
        attendees: eventData.attendees,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const chain = createChainableMock([mockEvent]);
      vi.mocked(db.insert).mockReturnValue({ values: chain.values } as any);

      const result = await calendarService.create(eventData);

      expect(result.attendees).toEqual(['alice@example.com', 'bob@example.com']);
    });

    it('should accept all valid event types', async () => {
      const validTypes = ['class', 'meeting', 'deadline', 'personal', 'blocked_time'] as const;

      for (const eventType of validTypes) {
        const eventData: CreateEventInput = {
          title: `${eventType} event`,
          startTime: new Date('2026-01-15T10:00:00Z'),
          endTime: new Date('2026-01-15T11:00:00Z'),
          eventType,
        };

        const mockEvent = {
          id: `event-${eventType}`,
          title: eventData.title,
          eventType,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const chain = createChainableMock([mockEvent]);
        vi.mocked(db.insert).mockReturnValue({ values: chain.values } as any);

        const result = await calendarService.create(eventData);
        expect(result.eventType).toBe(eventType);
      }
    });

    it('should default allDay to false when not specified', async () => {
      const eventData: CreateEventInput = {
        title: 'Quick Meeting',
        startTime: new Date('2026-01-15T10:00:00Z'),
        endTime: new Date('2026-01-15T10:30:00Z'),
      };

      const mockEvent = {
        id: 'event-4',
        title: eventData.title,
        allDay: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const chain = createChainableMock([mockEvent]);
      vi.mocked(db.insert).mockReturnValue({ values: chain.values } as any);

      const result = await calendarService.create(eventData);

      expect(result.allDay).toBe(false);
    });
  });

  // ============================================
  // GET BY ID TESTS
  // ============================================
  describe('getById', () => {
    it('should return event when it exists', async () => {
      const mockEvent = {
        id: 'event-1',
        title: 'Test Event',
        description: 'Test description',
        startTime: new Date('2026-01-15T10:00:00Z'),
        endTime: new Date('2026-01-15T11:00:00Z'),
        allDay: false,
        eventType: 'meeting',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const chain = createChainableMock([mockEvent]);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await calendarService.getById('event-1');

      expect(result).toEqual(mockEvent);
      expect(db.select).toHaveBeenCalled();
    });

    it('should return null when event does not exist', async () => {
      const chain = createChainableMock([]);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await calendarService.getById('non-existent');

      expect(result).toBeNull();
    });
  });

  // ============================================
  // GET BY GOOGLE ID TESTS
  // ============================================
  describe('getByGoogleId', () => {
    it('should return event when found by Google ID', async () => {
      const mockEvent = {
        id: 'event-1',
        googleEventId: 'google-abc123',
        title: 'Synced Event',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const chain = createChainableMock([mockEvent]);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await calendarService.getByGoogleId('google-abc123');

      expect(result).toEqual(mockEvent);
      expect(result?.googleEventId).toBe('google-abc123');
    });

    it('should return null when Google ID not found', async () => {
      const chain = createChainableMock([]);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await calendarService.getByGoogleId('non-existent-google-id');

      expect(result).toBeNull();
    });
  });

  // ============================================
  // LIST EVENTS TESTS
  // ============================================
  describe('list', () => {
    it('should return all events without filters', async () => {
      const mockEvents = [
        { id: 'event-1', title: 'Event 1', eventType: 'meeting' },
        { id: 'event-2', title: 'Event 2', eventType: 'class' },
      ];

      const chain = createChainableMock(mockEvents);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await calendarService.list();

      expect(result).toHaveLength(2);
      expect(db.select).toHaveBeenCalled();
    });

    it('should filter by startDate', async () => {
      const mockEvents = [
        { id: 'event-1', title: 'Future Event', startTime: new Date('2026-01-20T10:00:00Z') },
      ];

      const chain = createChainableMock(mockEvents);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await calendarService.list({ startDate: new Date('2026-01-15T00:00:00Z') });

      expect(result).toBeDefined();
      expect(db.select).toHaveBeenCalled();
    });

    it('should filter by endDate', async () => {
      const mockEvents = [
        { id: 'event-1', title: 'Past Event', startTime: new Date('2026-01-10T10:00:00Z') },
      ];

      const chain = createChainableMock(mockEvents);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await calendarService.list({ endDate: new Date('2026-01-15T00:00:00Z') });

      expect(result).toBeDefined();
    });

    it('should filter by eventType', async () => {
      const mockEvents = [
        { id: 'event-1', title: 'Meeting 1', eventType: 'meeting' },
      ];

      const chain = createChainableMock(mockEvents);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await calendarService.list({ eventType: 'meeting' });

      expect(result).toBeDefined();
    });

    it('should filter by context', async () => {
      const mockEvents = [
        { id: 'event-1', title: 'Work Event', context: '@work' },
      ];

      const chain = createChainableMock(mockEvents);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await calendarService.list({ context: '@work' });

      expect(result).toBeDefined();
    });

    it('should handle multiple filters', async () => {
      const mockEvents = [
        { id: 'event-1', title: 'Work Meeting', eventType: 'meeting', context: '@work' },
      ];

      const chain = createChainableMock(mockEvents);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await calendarService.list({
        eventType: 'meeting',
        context: '@work',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
      });

      expect(result).toBeDefined();
    });
  });

  // ============================================
  // GET TODAY TESTS
  // ============================================
  describe('getToday', () => {
    it('should return today\'s events', async () => {
      const mockEvents = [
        { id: 'event-1', title: 'Today Event 1' },
        { id: 'event-2', title: 'Today Event 2' },
      ];

      const chain = createChainableMock(mockEvents);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await calendarService.getToday();

      expect(result).toHaveLength(2);
    });
  });

  // ============================================
  // GET UPCOMING TESTS
  // ============================================
  describe('getUpcoming', () => {
    it('should return events for next 7 days by default', async () => {
      const mockEvents = [
        { id: 'event-1', title: 'Upcoming 1' },
        { id: 'event-2', title: 'Upcoming 2' },
      ];

      const chain = createChainableMock(mockEvents);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await calendarService.getUpcoming();

      expect(result).toBeDefined();
    });

    it('should accept custom days parameter', async () => {
      const mockEvents = [
        { id: 'event-1', title: 'Event in 14 days' },
      ];

      const chain = createChainableMock(mockEvents);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await calendarService.getUpcoming(14);

      expect(result).toBeDefined();
    });
  });

  // ============================================
  // GET IN RANGE TESTS
  // ============================================
  describe('getInRange', () => {
    it('should return events within date range', async () => {
      const mockEvents = [
        { id: 'event-1', title: 'Event in range' },
      ];

      const chain = createChainableMock(mockEvents);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await calendarService.getInRange(
        new Date('2026-01-01'),
        new Date('2026-01-31')
      );

      expect(result).toBeDefined();
    });
  });

  // ============================================
  // UPDATE EVENT TESTS
  // ============================================
  describe('update', () => {
    it('should update event fields', async () => {
      const existingEvent = {
        id: 'event-1',
        googleEventId: null,
        title: 'Original Title',
        description: 'Original description',
        startTime: new Date('2026-01-15T10:00:00Z'),
        endTime: new Date('2026-01-15T11:00:00Z'),
      };

      const updateData: UpdateEventInput = {
        title: 'Updated Title',
        description: 'Updated description',
      };

      // Mock getById call
      const selectChain = createChainableMock([existingEvent]);
      vi.mocked(db.select).mockReturnValue({ from: selectChain.from } as any);

      // Mock update call
      const mockUpdated = {
        ...existingEvent,
        title: 'Updated Title',
        description: 'Updated description',
        updatedAt: new Date(),
      };
      const updateChain = createChainableMock([mockUpdated]);
      vi.mocked(db.update).mockReturnValue({ set: updateChain.set } as any);

      const result = await calendarService.update('event-1', updateData);

      expect(result).toBeDefined();
      expect(result?.title).toBe('Updated Title');
      expect(db.update).toHaveBeenCalledWith(calendarEvents);
    });

    it('should return null when event does not exist', async () => {
      const selectChain = createChainableMock([]);
      vi.mocked(db.select).mockReturnValue({ from: selectChain.from } as any);

      const result = await calendarService.update('non-existent', { title: 'Test' });

      expect(result).toBeNull();
    });

    it('should update time fields', async () => {
      const existingEvent = {
        id: 'event-1',
        googleEventId: null,
        title: 'Meeting',
        startTime: new Date('2026-01-15T10:00:00Z'),
        endTime: new Date('2026-01-15T11:00:00Z'),
      };

      const selectChain = createChainableMock([existingEvent]);
      vi.mocked(db.select).mockReturnValue({ from: selectChain.from } as any);

      const newStartTime = new Date('2026-01-15T14:00:00Z');
      const newEndTime = new Date('2026-01-15T15:00:00Z');

      const mockUpdated = {
        ...existingEvent,
        startTime: newStartTime,
        endTime: newEndTime,
      };
      const updateChain = createChainableMock([mockUpdated]);
      vi.mocked(db.update).mockReturnValue({ set: updateChain.set } as any);

      const result = await calendarService.update('event-1', {
        startTime: newStartTime,
        endTime: newEndTime,
      });

      expect(result?.startTime).toEqual(newStartTime);
      expect(result?.endTime).toEqual(newEndTime);
    });

    it('should update eventType', async () => {
      const existingEvent = {
        id: 'event-1',
        googleEventId: null,
        title: 'Event',
        eventType: 'meeting',
      };

      const selectChain = createChainableMock([existingEvent]);
      vi.mocked(db.select).mockReturnValue({ from: selectChain.from } as any);

      const mockUpdated = { ...existingEvent, eventType: 'personal' };
      const updateChain = createChainableMock([mockUpdated]);
      vi.mocked(db.update).mockReturnValue({ set: updateChain.set } as any);

      const result = await calendarService.update('event-1', { eventType: 'personal' });

      expect(result?.eventType).toBe('personal');
    });
  });

  // ============================================
  // DELETE EVENT TESTS
  // ============================================
  describe('delete', () => {
    it('should delete event and return true', async () => {
      const existingEvent = {
        id: 'event-1',
        googleEventId: null,
        title: 'To Delete',
      };

      // Mock getById
      const selectChain = createChainableMock([existingEvent]);
      vi.mocked(db.select).mockReturnValue({ from: selectChain.from } as any);

      // Mock delete
      const deleteChain = createChainableMock([{ id: 'event-1' }]);
      deleteChain.where = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'event-1' }]),
      });
      vi.mocked(db.delete).mockReturnValue({ where: deleteChain.where } as any);

      const result = await calendarService.delete('event-1');

      expect(result).toBe(true);
      expect(db.delete).toHaveBeenCalledWith(calendarEvents);
    });

    it('should return false when event does not exist', async () => {
      const selectChain = createChainableMock([]);
      vi.mocked(db.select).mockReturnValue({ from: selectChain.from } as any);

      const result = await calendarService.delete('non-existent');

      expect(result).toBe(false);
    });
  });

  // ============================================
  // CHECK CONFLICTS TESTS
  // ============================================
  describe('checkConflicts', () => {
    it('should detect conflicts when events overlap', async () => {
      const conflictingEvents = [
        {
          id: 'conflict-1',
          title: 'Existing Meeting',
          startTime: new Date('2026-01-15T10:00:00Z'),
          endTime: new Date('2026-01-15T11:00:00Z'),
        },
      ];

      const chain = createChainableMock(conflictingEvents);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await calendarService.checkConflicts(
        new Date('2026-01-15T10:30:00Z'),
        new Date('2026-01-15T11:30:00Z')
      );

      expect(result.hasConflict).toBe(true);
      expect(result.conflictingEvents).toHaveLength(1);
    });

    it('should return no conflicts when time slot is free', async () => {
      const chain = createChainableMock([]);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await calendarService.checkConflicts(
        new Date('2026-01-15T10:00:00Z'),
        new Date('2026-01-15T11:00:00Z')
      );

      expect(result.hasConflict).toBe(false);
      expect(result.conflictingEvents).toHaveLength(0);
    });

    it('should exclude specified event ID from conflict check', async () => {
      const chain = createChainableMock([]);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await calendarService.checkConflicts(
        new Date('2026-01-15T10:00:00Z'),
        new Date('2026-01-15T11:00:00Z'),
        'exclude-this-id'
      );

      expect(result.hasConflict).toBe(false);
    });
  });

  // ============================================
  // GET EVENTS NEEDING ALERTS TESTS
  // ============================================
  describe('getEventsNeedingAlerts', () => {
    it('should return events starting within alert window', async () => {
      const mockEvents = [
        {
          id: 'event-1',
          title: 'Starting Soon',
          startTime: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
          alertSent: false,
        },
      ];

      const chain = createChainableMock(mockEvents);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await calendarService.getEventsNeedingAlerts(15);

      expect(result).toBeDefined();
    });

    it('should use default 15 minute window', async () => {
      const chain = createChainableMock([]);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await calendarService.getEventsNeedingAlerts();

      expect(result).toBeDefined();
    });
  });

  // ============================================
  // MARK ALERT SENT TESTS
  // ============================================
  describe('markAlertSent', () => {
    it('should update alertSent flag to true', async () => {
      const updateChain = createChainableMock([]);
      updateChain.where = vi.fn().mockResolvedValue(undefined);
      vi.mocked(db.update).mockReturnValue({ set: vi.fn().mockReturnValue({ where: updateChain.where }) } as any);

      await calendarService.markAlertSent('event-1');

      expect(db.update).toHaveBeenCalledWith(calendarEvents);
    });
  });

  // ============================================
  // GET COUNTS BY TYPE TESTS
  // ============================================
  describe('getCountsByType', () => {
    it('should return event counts grouped by type', async () => {
      const mockCounts = [
        { eventType: 'meeting', count: 5 },
        { eventType: 'class', count: 3 },
        { eventType: 'personal', count: 2 },
      ];

      const chain = createChainableMock(mockCounts);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await calendarService.getCountsByType();

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should handle null eventType as "untyped"', async () => {
      const mockCounts = [
        { eventType: null, count: 2 },
        { eventType: 'meeting', count: 5 },
      ];

      const chain = createChainableMock(mockCounts);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await calendarService.getCountsByType();

      expect(result['untyped']).toBe(2);
      expect(result['meeting']).toBe(5);
    });

    it('should return empty object when no events exist', async () => {
      const chain = createChainableMock([]);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await calendarService.getCountsByType();

      expect(result).toEqual({});
    });
  });

  // ============================================
  // SYNC FROM GOOGLE TESTS
  // ============================================
  describe('syncFromGoogle', () => {
    it('should call Google Calendar sync with date range', async () => {
      const { getGoogleCalendar } = await import('../integrations/google-calendar');
      const mockGoogleCalendar = {
        isConfigured: vi.fn(() => true),
        syncFromGoogle: vi.fn().mockResolvedValue({ created: 5, updated: 2, errors: [] }),
      };
      vi.mocked(getGoogleCalendar).mockReturnValue(mockGoogleCalendar as any);

      // Create fresh service instance with mocked Google Calendar
      const service = new CalendarService();
      const result = await service.syncFromGoogle(30);

      expect(result).toEqual({ created: 5, updated: 2, errors: [] });
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================
  describe('edge cases', () => {
    it('should handle empty list results', async () => {
      const chain = createChainableMock([]);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await calendarService.list();

      expect(result).toEqual([]);
    });

    it('should handle event with all optional fields null', async () => {
      const mockEvent = {
        id: 'event-minimal',
        googleEventId: null,
        title: 'Minimal Event',
        description: null,
        location: null,
        startTime: new Date(),
        endTime: new Date(),
        allDay: false,
        eventType: null,
        context: null,
        attendees: null,
        alertSent: false,
        syncedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const chain = createChainableMock([mockEvent]);
      vi.mocked(db.select).mockReturnValue({ from: chain.from } as any);

      const result = await calendarService.getById('event-minimal');

      expect(result).toBeDefined();
      expect(result?.description).toBeNull();
      expect(result?.location).toBeNull();
      expect(result?.eventType).toBeNull();
    });
  });
});

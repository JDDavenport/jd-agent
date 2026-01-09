export type EventType = 'class' | 'meeting' | 'deadline' | 'personal' | 'blocked_time';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  eventType?: EventType;
  context?: string;
  googleEventId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCalendarEventInput {
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  allDay?: boolean;
  eventType?: EventType;
  context?: string;
}

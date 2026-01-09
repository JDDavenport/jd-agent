export type EventType = 'class' | 'meeting' | 'deadline' | 'personal' | 'blocked_time';

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: string;
  endTime: string;
  allDay: boolean;
  eventType: EventType;
  context: string | null;
  googleEventId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventInput {
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  allDay?: boolean;
  eventType?: EventType;
  context?: string;
  syncToGoogle?: boolean;
}

export interface UpdateEventInput extends Partial<CreateEventInput> {}

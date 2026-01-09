import apiClient from './client';
import type { CalendarEvent, CreateEventInput, UpdateEventInput } from '../types/calendar';

interface CalendarFilters {
  startDate?: string;
  endDate?: string;
  eventType?: string;
  context?: string;
}

export const getCalendarEvents = async (filters?: CalendarFilters): Promise<CalendarEvent[]> => {
  const params = new URLSearchParams();
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  if (filters?.eventType) params.append('eventType', filters.eventType);
  if (filters?.context) params.append('context', filters.context);

  return apiClient.get(`/calendar?${params.toString()}`);
};

export const getTodayEvents = async (): Promise<CalendarEvent[]> => {
  return apiClient.get('/calendar/today');
};

export const getUpcomingEvents = async (days: number = 7): Promise<CalendarEvent[]> => {
  return apiClient.get(`/calendar/upcoming?days=${days}`);
};

export const createEvent = async (data: CreateEventInput): Promise<CalendarEvent> => {
  return apiClient.post('/calendar', data);
};

export const updateEvent = async (id: string, data: UpdateEventInput): Promise<CalendarEvent> => {
  return apiClient.patch(`/calendar/${id}`, data);
};

export const deleteEvent = async (id: string): Promise<void> => {
  await apiClient.delete(`/calendar/${id}`);
};

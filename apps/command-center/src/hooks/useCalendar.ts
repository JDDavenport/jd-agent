import { useQuery } from '@tanstack/react-query';
import * as calendarApi from '../api/calendar';
import { startOfWeek, endOfWeek, format } from 'date-fns';

export function useCalendarEvents(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['calendar', startDate, endDate],
    queryFn: () => calendarApi.getCalendarEvents({ startDate, endDate }),
  });
}

export function useWeekCalendar(date: Date = new Date()) {
  const start = format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const end = format(endOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['calendar', 'week', start, end],
    queryFn: () => calendarApi.getCalendarEvents({ startDate: start, endDate: end }),
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });
}

export function useTodayEvents() {
  return useQuery({
    queryKey: ['calendar', 'today'],
    queryFn: () => calendarApi.getTodayEvents(),
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useUpcomingEvents(days: number = 7) {
  return useQuery({
    queryKey: ['calendar', 'upcoming', days],
    queryFn: () => calendarApi.getUpcomingEvents(days),
  });
}

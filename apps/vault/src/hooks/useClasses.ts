/**
 * useClasses - React Query hooks for MBA class data
 *
 * Provides access to:
 * - Class list with summary info
 * - Class details with class days
 * - Combined class notes (Plaud + Remarkable + typed)
 * - Auto-combine mutation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { ClassSummary } from '../lib/types';

// Query keys
export const classKeys = {
  all: ['classes'] as const,
  list: () => [...classKeys.all, 'list'] as const,
  detail: (code: string) => [...classKeys.all, 'detail', code] as const,
  dayContent: (code: string, date: string) => [...classKeys.all, 'day', code, date] as const,
};

/**
 * Get list of all classes with summary info
 */
export function useClasses() {
  return useQuery({
    queryKey: classKeys.list(),
    queryFn: () => api.listClasses(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get details for a specific class including all class days
 */
export function useClass(code: string | null) {
  return useQuery({
    queryKey: classKeys.detail(code || ''),
    queryFn: () => api.getClass(code!),
    enabled: !!code,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Get combined content for a specific class day
 */
export function useClassDayContent(code: string | null, date: string | null) {
  return useQuery({
    queryKey: classKeys.dayContent(code || '', date || ''),
    queryFn: () => api.getClassDayContent(code!, date!),
    enabled: !!code && !!date,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Combine notes for a specific class day
 */
export function useCombineClassNotes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ code, date }: { code: string; date: string }) =>
      api.combineClassNotes(code, date),
    onSuccess: (_, { code, date }) => {
      // Invalidate class detail and day content queries
      queryClient.invalidateQueries({ queryKey: classKeys.detail(code) });
      queryClient.invalidateQueries({ queryKey: classKeys.dayContent(code, date) });
    },
  });
}

/**
 * Combine all pending class notes
 */
export function useCombineAllClassNotes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.combineAllPendingClassNotes(),
    onSuccess: () => {
      // Invalidate all class queries
      queryClient.invalidateQueries({ queryKey: classKeys.all });
    },
  });
}

/**
 * Get classes grouped by semester
 */
export function useClassesBySemester() {
  const { data: classes = [], ...rest } = useClasses();

  const grouped = classes.reduce((acc, cls) => {
    const semester = cls.semester || 'Unknown';
    if (!acc[semester]) acc[semester] = [];
    acc[semester].push(cls);
    return acc;
  }, {} as Record<string, ClassSummary[]>);

  // Sort semesters (most recent first)
  const sortedSemesters = Object.keys(grouped).sort((a, b) => {
    // Extract year and season for sorting
    const getOrder = (s: string) => {
      const match = s.match(/(Winter|Spring|Summer|Fall)(\d{4})/);
      if (!match) return 0;
      const [, season, year] = match;
      const seasonOrder = { Winter: 0, Spring: 1, Summer: 2, Fall: 3 };
      return parseInt(year) * 10 + (seasonOrder[season as keyof typeof seasonOrder] || 0);
    };
    return getOrder(b) - getOrder(a);
  });

  return {
    ...rest,
    data: classes,
    semesters: sortedSemesters,
    grouped,
  };
}

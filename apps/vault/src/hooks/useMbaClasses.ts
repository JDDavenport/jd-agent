/**
 * useMbaClasses - React Query hooks for MBA class data with recordings
 *
 * Uses the new vault-based MBA classes API that combines:
 * - Vault page tree structure (MBA BYU → Semester → Class → Date)
 * - Remarkable notes (OCR text from handwritten notes)
 * - Plaud recordings (matched by date)
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '../api';
import type { MbaClassesResponse, MbaClassSessionResponse } from '../lib/types';

// Query keys
export const mbaClassKeys = {
  all: ['mba-classes'] as const,
  list: () => [...mbaClassKeys.all, 'list'] as const,
  session: (sessionId: string) => [...mbaClassKeys.all, 'session', sessionId] as const,
};

/**
 * Get MBA classes with recordings and notes
 */
export function useMbaClasses() {
  return useQuery<MbaClassesResponse>({
    queryKey: mbaClassKeys.list(),
    queryFn: () => api.getMbaClasses(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get detailed content for a specific class session (date)
 * Includes vault page content, remarkable notes, and recordings with transcripts
 */
export function useMbaClassSession(sessionId: string | null) {
  return useQuery<MbaClassSessionResponse>({
    queryKey: mbaClassKeys.session(sessionId || ''),
    queryFn: () => api.getMbaClassSession(sessionId!),
    enabled: !!sessionId,
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Get a specific class by ID from the MBA classes data
 */
export function useMbaClass(classId: string | null) {
  const { data: mbaData, isLoading, error } = useMbaClasses();

  const classData = mbaData?.semesters
    .flatMap((s) => s.classes.map((c) => ({ ...c, semesterTitle: s.title })))
    .find((c) => c.id === classId);

  return {
    data: classData,
    semesterTitle: classData?.semesterTitle,
    isLoading,
    error,
  };
}

/**
 * Hook for managing reviewed sessions
 */
const REVIEWED_SESSIONS_KEY = 'mba-reviewed-sessions';

export function useReviewedSessions() {
  const getReviewed = (): Set<string> => {
    if (typeof window === 'undefined') return new Set();
    const stored = localStorage.getItem(REVIEWED_SESSIONS_KEY);
    if (stored) {
      try {
        return new Set(JSON.parse(stored));
      } catch {
        return new Set();
      }
    }
    return new Set();
  };

  const toggleReviewed = (sessionId: string): boolean => {
    const current = getReviewed();
    const isNowReviewed = !current.has(sessionId);

    if (isNowReviewed) {
      current.add(sessionId);
    } else {
      current.delete(sessionId);
    }

    localStorage.setItem(REVIEWED_SESSIONS_KEY, JSON.stringify([...current]));
    return isNowReviewed;
  };

  const isReviewed = (sessionId: string): boolean => {
    return getReviewed().has(sessionId);
  };

  const markAllReviewed = (sessionIds: string[]): void => {
    localStorage.setItem(REVIEWED_SESSIONS_KEY, JSON.stringify(sessionIds));
  };

  return { getReviewed, toggleReviewed, isReviewed, markAllReviewed };
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { SaveReviewInput, CompleteReviewInput } from '../lib/types';

/**
 * Hook for fetching daily review data (habits, goals, completed tasks, etc.)
 */
export function useDailyReview(date?: string) {
  return useQuery({
    queryKey: ['journal', 'daily-review', date],
    queryFn: () => api.getDailyReviewData(date),
  });
}

/**
 * Hook for saving review draft (auto-save)
 */
export function useSaveReviewDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveReviewInput) => api.saveReviewDraft(input),
    onSuccess: () => {
      // Invalidate the daily review query to refresh data
      queryClient.invalidateQueries({ queryKey: ['journal', 'daily-review'] });
    },
  });
}

/**
 * Hook for completing a review (saves to vault)
 */
export function useCompleteReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CompleteReviewInput) => api.completeReview(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal'] });
      queryClient.invalidateQueries({ queryKey: ['vault'] });
    },
  });
}

/**
 * Hook for fetching review history
 */
export function useReviewHistory(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['journal', 'history', page, limit],
    queryFn: () => api.getReviewHistory(page, limit),
  });
}

/**
 * Hook for searching reviews
 */
export function useSearchReviews(query: string) {
  return useQuery({
    queryKey: ['journal', 'search', query],
    queryFn: () => api.searchReviews(query),
    enabled: !!query && query.length > 0,
  });
}

/**
 * Hook for toggling habit completion
 */
export function useToggleHabit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ habitId, date }: { habitId: string; date?: string }) =>
      api.toggleHabitCompletion(habitId, date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal', 'daily-review'] });
    },
  });
}

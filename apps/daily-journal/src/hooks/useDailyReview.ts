import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type {
  SaveReviewInput,
  CompleteReviewInput,
  GetDailyReviewResponse,
  DailyReview,
  CompleteReviewResponse,
  HabitReviewData,
  ReviewHistoryResponse,
  ReviewHistoryItem,
} from '@jd-agent/types';

/**
 * Hook for fetching daily review data
 */
export function useDailyReview(date: string) {
  return useQuery<GetDailyReviewResponse>({
    queryKey: ['daily-review', date],
    queryFn: () => api.getDailyReview(date),
  });
}

/**
 * Hook for saving review draft (auto-save)
 */
export function useSaveReview() {
  const queryClient = useQueryClient();

  return useMutation<DailyReview, Error, SaveReviewInput>({
    mutationFn: (input) => api.saveDailyReview(input),
    onSuccess: () => {
      // Invalidate the specific date's review
      queryClient.invalidateQueries({ queryKey: ['daily-review'] });
    },
  });
}

/**
 * Hook for completing a review
 */
export function useCompleteReview() {
  const queryClient = useQueryClient();

  return useMutation<CompleteReviewResponse, Error, CompleteReviewInput>({
    mutationFn: (input) => api.completeDailyReview(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-review'] });
      queryClient.invalidateQueries({ queryKey: ['review-history'] });
    },
  });
}

/**
 * Hook for toggling habit completion
 */
export function useToggleHabit() {
  const queryClient = useQueryClient();

  return useMutation<HabitReviewData, Error, { habitId: string; date: string }>({
    mutationFn: ({ habitId, date }) => api.toggleHabitInReview(habitId, date),
    onSuccess: (_, { date }) => {
      queryClient.invalidateQueries({ queryKey: ['daily-review', date] });
    },
  });
}

/**
 * Hook for fetching review history
 */
export function useReviewHistory(page = 1, limit = 20) {
  return useQuery<ReviewHistoryResponse>({
    queryKey: ['review-history', page, limit],
    queryFn: () => api.getDailyReviewHistory(page, limit),
  });
}

/**
 * Hook for searching reviews
 */
export function useSearchReviews(query: string) {
  return useQuery<ReviewHistoryItem[]>({
    queryKey: ['review-search', query],
    queryFn: () => api.searchDailyReviews(query),
    enabled: query.length > 0,
  });
}

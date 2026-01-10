import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as journalApi from '../api/journal';
import type { SaveReviewInput, CompleteReviewInput } from '../api/journal';

export function useDailyReview(date?: string) {
  return useQuery({
    queryKey: ['journal', 'daily-review', date],
    queryFn: () => journalApi.getDailyReview(date),
  });
}

export function useSaveReviewDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveReviewInput) => journalApi.saveReviewDraft(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal', 'daily-review'] });
    },
  });
}

export function useCompleteReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CompleteReviewInput) => journalApi.completeReview(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal'] });
    },
  });
}

export function useReviewHistory(page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: ['journal', 'history', page, limit],
    queryFn: () => journalApi.getReviewHistory(page, limit),
  });
}

export function useSearchReviews(query: string) {
  return useQuery({
    queryKey: ['journal', 'search', query],
    queryFn: () => journalApi.searchReviews(query),
    enabled: query.length > 0,
  });
}

export function useToggleHabitCompletion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ habitId, date }: { habitId: string; date?: string }) =>
      journalApi.toggleHabitCompletion(habitId, date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal', 'daily-review'] });
      queryClient.invalidateQueries({ queryKey: ['habits'] });
    },
  });
}

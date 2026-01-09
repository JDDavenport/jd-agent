import { useQuery } from '@tanstack/react-query';
import * as progressApi from '../api/progress';
import type { LifeArea } from '../types/goals';

export function useProgressOverview() {
  return useQuery({
    queryKey: ['progress', 'overview'],
    queryFn: progressApi.getProgressOverview,
  });
}

export function useWeeklyReport() {
  return useQuery({
    queryKey: ['progress', 'weekly'],
    queryFn: progressApi.getWeeklyReport,
  });
}

export function useAreaProgress(area: LifeArea | undefined) {
  return useQuery({
    queryKey: ['progress', 'area', area],
    queryFn: () => progressApi.getAreaProgress(area!),
    enabled: !!area,
  });
}

export function useAllAreasProgress() {
  return useQuery({
    queryKey: ['progress', 'areas'],
    queryFn: progressApi.getAllAreasProgress,
  });
}

export function useTopStreaks(limit = 5) {
  return useQuery({
    queryKey: ['progress', 'streaks', limit],
    queryFn: () => progressApi.getTopStreaks(limit),
  });
}

export function useHabitsDashboard() {
  return useQuery({
    queryKey: ['progress', 'habits'],
    queryFn: progressApi.getHabitsDashboard,
  });
}

export function useLifeAreas() {
  return useQuery({
    queryKey: ['life-areas'],
    queryFn: progressApi.getLifeAreas,
    staleTime: Infinity, // Life areas don't change
  });
}

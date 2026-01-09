import apiClient from './client';
import type { ProgressOverview, LifeAreaProgress, LifeArea, LifeAreaInfo } from '../types/goals';

// ============================================
// PROGRESS DASHBOARD API
// ============================================

export const getProgressOverview = async (): Promise<ProgressOverview> => {
  return apiClient.get('/progress/overview');
};

export const getWeeklyReport = async (): Promise<{
  weekStart: string;
  weekEnd: string;
  habits: {
    completed: number;
    total: number;
    completionRate: number;
    streaksProtected: number;
    streaksBroken: number;
  };
  goals: {
    progressMade: number;
    milestonesCompleted: number;
    reflectionsAdded: number;
  };
  highlights: string[];
  improvements: string[];
}> => {
  return apiClient.get('/progress/weekly');
};

export const getAreaProgress = async (area: LifeArea): Promise<LifeAreaProgress> => {
  return apiClient.get(`/progress/area/${area}`);
};

export const getAllAreasProgress = async (): Promise<LifeAreaProgress[]> => {
  return apiClient.get('/progress/areas');
};

export const getTopStreaks = async (limit = 5): Promise<Array<{
  habitId: string;
  habitTitle: string;
  currentStreak: number;
  longestStreak: number;
  lifeArea: LifeArea;
}>> => {
  return apiClient.get(`/progress/streaks?limit=${limit}`);
};

export const getHabitsDashboard = async (): Promise<{
  today: {
    completed: number;
    total: number;
    completionRate: number;
  };
  week: {
    completed: number;
    total: number;
    completionRate: number;
  };
  byArea: Record<LifeArea, {
    completed: number;
    total: number;
  }>;
  streakLeaders: Array<{
    habitId: string;
    habitTitle: string;
    currentStreak: number;
  }>;
}> => {
  return apiClient.get('/progress/habits');
};

export const getLifeAreas = async (): Promise<Record<LifeArea, LifeAreaInfo>> => {
  return apiClient.get('/progress/life-areas');
};

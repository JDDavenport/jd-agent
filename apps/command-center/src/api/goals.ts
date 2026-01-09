import apiClient from './client';
import type {
  Goal,
  CreateGoalInput,
  UpdateGoalInput,
  GoalFilters,
  Milestone,
  CreateMilestoneInput,
  Habit,
  CreateHabitInput,
  CompleteHabitInput,
  HabitFilters,
  HabitCompletion,
  Reflection,
  CreateReflectionInput,
  LinkedTask,
  LinkedVaultEntry,
  GoalHealthReport,
  LifeArea,
} from '../types/goals';

// ============================================
// GOALS API
// ============================================

export const getGoals = async (filters?: GoalFilters): Promise<Goal[]> => {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.lifeArea) params.append('lifeArea', filters.lifeArea);
  const query = params.toString();
  return apiClient.get(`/goals${query ? `?${query}` : ''}`);
};

export const getGoalById = async (id: string, includeRelations = true): Promise<Goal> => {
  return apiClient.get(`/goals/${id}?includeRelations=${includeRelations}`);
};

export const createGoal = async (data: CreateGoalInput): Promise<Goal> => {
  return apiClient.post('/goals', data);
};

export const updateGoal = async (id: string, data: UpdateGoalInput): Promise<Goal> => {
  return apiClient.patch(`/goals/${id}`, data);
};

export const updateGoalProgress = async (id: string, progress: number): Promise<Goal> => {
  return apiClient.post(`/goals/${id}/progress`, { progress });
};

export const deleteGoal = async (id: string): Promise<void> => {
  return apiClient.delete(`/goals/${id}`);
};

export const getGoalsByLifeArea = async (): Promise<{
  areas: Record<LifeArea, { total: number; active: number; completed: number; averageProgress: number }>;
}> => {
  return apiClient.get('/goals/by-life-area');
};

export const getGoalsNeedingAttention = async (): Promise<Goal[]> => {
  return apiClient.get('/goals/needs-attention');
};

export const getGoalHealth = async (id: string): Promise<GoalHealthReport> => {
  return apiClient.get(`/goals/${id}/health`);
};

export const pauseGoal = async (id: string): Promise<Goal> => {
  return apiClient.post(`/goals/${id}/pause`);
};

export const resumeGoal = async (id: string): Promise<Goal> => {
  return apiClient.post(`/goals/${id}/resume`);
};

export const completeGoal = async (id: string): Promise<Goal> => {
  return apiClient.post(`/goals/${id}/complete`);
};

export const abandonGoal = async (id: string): Promise<Goal> => {
  return apiClient.post(`/goals/${id}/abandon`);
};

export const recalculateGoalProgress = async (id: string): Promise<Goal> => {
  return apiClient.post(`/goals/${id}/recalculate`);
};

// ============================================
// MILESTONES API
// ============================================

export const getMilestones = async (goalId: string): Promise<Milestone[]> => {
  return apiClient.get(`/milestones?goalId=${goalId}`);
};

export const getMilestoneById = async (id: string): Promise<Milestone> => {
  return apiClient.get(`/milestones/${id}`);
};

export const getUpcomingMilestones = async (days = 14): Promise<Milestone[]> => {
  return apiClient.get(`/milestones/upcoming?days=${days}`);
};

export const getOverdueMilestones = async (): Promise<Milestone[]> => {
  return apiClient.get('/milestones/overdue');
};

export const createMilestone = async (data: CreateMilestoneInput): Promise<Milestone> => {
  return apiClient.post('/milestones', data);
};

export const updateMilestone = async (id: string, data: Partial<Milestone>): Promise<Milestone> => {
  return apiClient.patch(`/milestones/${id}`, data);
};

export const deleteMilestone = async (id: string): Promise<void> => {
  return apiClient.delete(`/milestones/${id}`);
};

export const startMilestone = async (id: string): Promise<Milestone> => {
  return apiClient.post(`/milestones/${id}/start`);
};

export const completeMilestone = async (id: string, evidence?: string): Promise<{ milestone: Milestone; goalProgress: number }> => {
  return apiClient.post(`/milestones/${id}/complete`, { evidence });
};

export const skipMilestone = async (id: string): Promise<Milestone> => {
  return apiClient.post(`/milestones/${id}/skip`);
};

export const reorderMilestones = async (goalId: string, milestoneIds: string[]): Promise<void> => {
  return apiClient.post('/milestones/reorder', { goalId, milestoneIds });
};

// ============================================
// HABITS API
// ============================================

export const getHabits = async (filters?: HabitFilters): Promise<Habit[]> => {
  const params = new URLSearchParams();
  if (filters?.lifeArea) params.append('lifeArea', filters.lifeArea);
  if (filters?.isActive !== undefined) params.append('isActive', String(filters.isActive));
  if (filters?.goalId) params.append('goalId', filters.goalId);
  const query = params.toString();
  return apiClient.get(`/habits${query ? `?${query}` : ''}`);
};

export const getHabitById = async (id: string): Promise<Habit> => {
  return apiClient.get(`/habits/${id}`);
};

export const getTodaysHabits = async (): Promise<Habit[]> => {
  return apiClient.get('/habits/today');
};

export const createHabit = async (data: CreateHabitInput): Promise<Habit> => {
  return apiClient.post('/habits', data);
};

export const updateHabit = async (id: string, data: Partial<Habit>): Promise<Habit> => {
  return apiClient.patch(`/habits/${id}`, data);
};

export const deleteHabit = async (id: string): Promise<void> => {
  return apiClient.delete(`/habits/${id}`);
};

export const completeHabit = async (id: string, data?: CompleteHabitInput): Promise<{ completion: HabitCompletion; habit: Habit }> => {
  return apiClient.post(`/habits/${id}/complete`, data || {});
};

export const getHabitStreak = async (id: string): Promise<{ currentStreak: number; longestStreak: number; lastCompletedAt?: Date }> => {
  return apiClient.get(`/habits/${id}/streak`);
};

export const getHabitCompletions = async (id: string, startDate?: string, endDate?: string): Promise<HabitCompletion[]> => {
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);
  const query = params.toString();
  return apiClient.get(`/habits/${id}/completions${query ? `?${query}` : ''}`);
};

export const getHabitsForGoal = async (goalId: string): Promise<Habit[]> => {
  return apiClient.get(`/habits?goalId=${goalId}`);
};

// ============================================
// REFLECTIONS API
// ============================================

export const getReflections = async (goalId: string): Promise<Reflection[]> => {
  return apiClient.get(`/reflections?goalId=${goalId}`);
};

export const getRecentReflections = async (limit = 10): Promise<Reflection[]> => {
  return apiClient.get(`/reflections/recent?limit=${limit}`);
};

export const getWinReflections = async (limit = 10): Promise<Reflection[]> => {
  return apiClient.get(`/reflections/wins?limit=${limit}`);
};

export const getObstacleReflections = async (limit = 10): Promise<Reflection[]> => {
  return apiClient.get(`/reflections/obstacles?limit=${limit}`);
};

export const searchReflections = async (query: string): Promise<Reflection[]> => {
  return apiClient.get(`/reflections/search?q=${encodeURIComponent(query)}`);
};

export const getReflectionsByArea = async (area: LifeArea): Promise<Reflection[]> => {
  return apiClient.get(`/reflections/area/${area}`);
};

export const createReflection = async (goalId: string, data: CreateReflectionInput): Promise<Reflection> => {
  return apiClient.post(`/reflections/${goalId}`, data);
};

export const deleteReflection = async (id: string): Promise<void> => {
  return apiClient.delete(`/reflections/${id}`);
};

export const getReflectionStats = async (goalId: string): Promise<{
  total: number;
  byType: Record<string, number>;
  recentActivity: Date | null;
}> => {
  return apiClient.get(`/reflections/stats/${goalId}`);
};

// ============================================
// TASK GENERATION API
// ============================================

export const generateAllTasks = async (): Promise<{
  milestones: { generated: number; skipped: number };
  checkins: { generated: number; skipped: number };
  habits: { generated: number; skipped: number };
  totalGenerated: number;
}> => {
  return apiClient.post('/task-generation/generate');
};

export const getTasksForGoal = async (goalId: string): Promise<LinkedTask[]> => {
  return apiClient.get(`/task-generation/goal/${goalId}/tasks`);
};

export const getTasksForHabit = async (habitId: string): Promise<LinkedTask[]> => {
  return apiClient.get(`/task-generation/habit/${habitId}/tasks`);
};

export const linkTaskToGoal = async (taskId: string, goalId: string, milestoneId?: string): Promise<void> => {
  return apiClient.post('/task-generation/link/goal', { taskId, goalId, milestoneId });
};

export const linkTaskToHabit = async (taskId: string, habitId: string): Promise<void> => {
  return apiClient.post('/task-generation/link/habit', { taskId, habitId });
};

export const unlinkTaskFromGoal = async (taskId: string, goalId: string): Promise<void> => {
  return apiClient.delete(`/task-generation/link/goal/${taskId}/${goalId}`);
};

export const unlinkTaskFromHabit = async (taskId: string, habitId: string): Promise<void> => {
  return apiClient.delete(`/task-generation/link/habit/${taskId}/${habitId}`);
};

// ============================================
// GOAL VAULT INTEGRATION API
// ============================================

export const exportGoalJourney = async (goalId: string): Promise<{ vaultEntryId: string; title: string }> => {
  return apiClient.post(`/goal-vault/export/journey/${goalId}`);
};

export const exportReflection = async (reflectionId: string): Promise<{ vaultEntryId: string }> => {
  return apiClient.post(`/goal-vault/export/reflection/${reflectionId}`);
};

export const getVaultEntriesForGoal = async (goalId: string): Promise<LinkedVaultEntry[]> => {
  return apiClient.get(`/goal-vault/entries/${goalId}`);
};

export const createGoalNote = async (goalId: string, title: string, content: string, tags?: string[]): Promise<{ vaultEntryId: string }> => {
  return apiClient.post('/goal-vault/note', { goalId, title, content, tags });
};

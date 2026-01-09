import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as goalsApi from '../api/goals';
import type {
  GoalFilters,
  CreateGoalInput,
  UpdateGoalInput,
  CreateMilestoneInput,
  HabitFilters,
  CreateHabitInput,
  CompleteHabitInput,
  CreateReflectionInput,
  LifeArea,
  Milestone,
} from '../types/goals';

// ============================================
// GOALS HOOKS
// ============================================

export function useGoals(filters?: GoalFilters) {
  return useQuery({
    queryKey: ['goals', filters],
    queryFn: () => goalsApi.getGoals(filters),
  });
}

export function useGoal(id: string | undefined) {
  return useQuery({
    queryKey: ['goal', id],
    queryFn: () => goalsApi.getGoalById(id!),
    enabled: !!id,
  });
}

export function useGoalsByLifeArea() {
  return useQuery({
    queryKey: ['goals', 'by-life-area'],
    queryFn: goalsApi.getGoalsByLifeArea,
  });
}

export function useGoalsNeedingAttention() {
  return useQuery({
    queryKey: ['goals', 'needs-attention'],
    queryFn: goalsApi.getGoalsNeedingAttention,
  });
}

export function useGoalHealth(id: string | undefined) {
  return useQuery({
    queryKey: ['goal', id, 'health'],
    queryFn: () => goalsApi.getGoalHealth(id!),
    enabled: !!id,
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateGoalInput) => goalsApi.createGoal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateGoalInput }) => goalsApi.updateGoal(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['goal', id] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });
}

export function useUpdateGoalProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, progress }: { id: string; progress: number }) => goalsApi.updateGoalProgress(id, progress),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['goal', id] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => goalsApi.deleteGoal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });
}

export function usePauseGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => goalsApi.pauseGoal(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['goal', id] });
    },
  });
}

export function useResumeGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => goalsApi.resumeGoal(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['goal', id] });
    },
  });
}

export function useCompleteGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => goalsApi.completeGoal(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['goal', id] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });
}

export function useAbandonGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => goalsApi.abandonGoal(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['goal', id] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });
}

// ============================================
// MILESTONES HOOKS
// ============================================

export function useMilestones(goalId: string | undefined) {
  return useQuery({
    queryKey: ['milestones', goalId],
    queryFn: () => goalsApi.getMilestones(goalId!),
    enabled: !!goalId,
  });
}

export function useUpcomingMilestones(days = 14) {
  return useQuery({
    queryKey: ['milestones', 'upcoming', days],
    queryFn: () => goalsApi.getUpcomingMilestones(days),
  });
}

export function useOverdueMilestones() {
  return useQuery({
    queryKey: ['milestones', 'overdue'],
    queryFn: goalsApi.getOverdueMilestones,
  });
}

export function useCreateMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMilestoneInput) => goalsApi.createMilestone(data),
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({ queryKey: ['milestones', data.goalId] });
      queryClient.invalidateQueries({ queryKey: ['goal', data.goalId] });
    },
  });
}

export function useUpdateMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Milestone> }) => goalsApi.updateMilestone(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones'] });
    },
  });
}

export function useDeleteMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => goalsApi.deleteMilestone(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

export function useStartMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => goalsApi.startMilestone(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones'] });
    },
  });
}

export function useCompleteMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, evidence }: { id: string; evidence?: string }) => goalsApi.completeMilestone(id, evidence),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });
}

export function useSkipMilestone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => goalsApi.skipMilestone(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['milestones'] });
      queryClient.invalidateQueries({ queryKey: ['goals'] });
    },
  });
}

// ============================================
// HABITS HOOKS
// ============================================

export function useHabits(filters?: HabitFilters) {
  return useQuery({
    queryKey: ['habits', filters],
    queryFn: () => goalsApi.getHabits(filters),
  });
}

export function useHabit(id: string | undefined) {
  return useQuery({
    queryKey: ['habit', id],
    queryFn: () => goalsApi.getHabitById(id!),
    enabled: !!id,
  });
}

export function useTodaysHabits() {
  return useQuery({
    queryKey: ['habits', 'today'],
    queryFn: goalsApi.getTodaysHabits,
    refetchInterval: 60 * 1000, // Refresh every minute
  });
}

export function useHabitCompletions(id: string | undefined, startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['habit', id, 'completions', startDate, endDate],
    queryFn: () => goalsApi.getHabitCompletions(id!, startDate, endDate),
    enabled: !!id,
  });
}

export function useCreateHabit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateHabitInput) => goalsApi.createHabit(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });
}

export function useUpdateHabit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateHabitInput> }) => goalsApi.updateHabit(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['habit', id] });
    },
  });
}

export function useDeleteHabit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => goalsApi.deleteHabit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });
}

export function useCompleteHabit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: CompleteHabitInput }) => goalsApi.completeHabit(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['habit', id] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });
}

// ============================================
// REFLECTIONS HOOKS
// ============================================

export function useReflections(goalId: string | undefined) {
  return useQuery({
    queryKey: ['reflections', goalId],
    queryFn: () => goalsApi.getReflections(goalId!),
    enabled: !!goalId,
  });
}

export function useRecentReflections(limit = 10) {
  return useQuery({
    queryKey: ['reflections', 'recent', limit],
    queryFn: () => goalsApi.getRecentReflections(limit),
  });
}

export function useWinReflections(limit = 10) {
  return useQuery({
    queryKey: ['reflections', 'wins', limit],
    queryFn: () => goalsApi.getWinReflections(limit),
  });
}

export function useReflectionsByArea(area: LifeArea | undefined) {
  return useQuery({
    queryKey: ['reflections', 'area', area],
    queryFn: () => goalsApi.getReflectionsByArea(area!),
    enabled: !!area,
  });
}

export function useCreateReflection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ goalId, data }: { goalId: string; data: CreateReflectionInput }) =>
      goalsApi.createReflection(goalId, data),
    onSuccess: (_, { goalId }) => {
      queryClient.invalidateQueries({ queryKey: ['reflections'] });
      queryClient.invalidateQueries({ queryKey: ['goal', goalId] });
      queryClient.invalidateQueries({ queryKey: ['progress'] });
    },
  });
}

export function useDeleteReflection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => goalsApi.deleteReflection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reflections'] });
    },
  });
}

// ============================================
// TASK GENERATION HOOKS
// ============================================

export function useTasksForGoal(goalId: string | undefined) {
  return useQuery({
    queryKey: ['tasks', 'goal', goalId],
    queryFn: () => goalsApi.getTasksForGoal(goalId!),
    enabled: !!goalId,
  });
}

export function useTasksForHabit(habitId: string | undefined) {
  return useQuery({
    queryKey: ['tasks', 'habit', habitId],
    queryFn: () => goalsApi.getTasksForHabit(habitId!),
    enabled: !!habitId,
  });
}

export function useGenerateTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: goalsApi.generateAllTasks,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useLinkTaskToGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, goalId, milestoneId }: { taskId: string; goalId: string; milestoneId?: string }) =>
      goalsApi.linkTaskToGoal(taskId, goalId, milestoneId),
    onSuccess: (_, { goalId }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'goal', goalId] });
    },
  });
}

export function useUnlinkTaskFromGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, goalId }: { taskId: string; goalId: string }) =>
      goalsApi.unlinkTaskFromGoal(taskId, goalId),
    onSuccess: (_, { goalId }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', 'goal', goalId] });
    },
  });
}

// ============================================
// VAULT INTEGRATION HOOKS
// ============================================

export function useVaultEntriesForGoal(goalId: string | undefined) {
  return useQuery({
    queryKey: ['vault', 'goal', goalId],
    queryFn: () => goalsApi.getVaultEntriesForGoal(goalId!),
    enabled: !!goalId,
  });
}

export function useExportGoalJourney() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (goalId: string) => goalsApi.exportGoalJourney(goalId),
    onSuccess: (_, goalId) => {
      queryClient.invalidateQueries({ queryKey: ['vault', 'goal', goalId] });
      queryClient.invalidateQueries({ queryKey: ['goal', goalId] });
    },
  });
}

export function useExportReflection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reflectionId: string) => goalsApi.exportReflection(reflectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault'] });
    },
  });
}

export function useCreateGoalNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ goalId, title, content, tags }: { goalId: string; title: string; content: string; tags?: string[] }) =>
      goalsApi.createGoalNote(goalId, title, content, tags),
    onSuccess: (_, { goalId }) => {
      queryClient.invalidateQueries({ queryKey: ['vault', 'goal', goalId] });
    },
  });
}

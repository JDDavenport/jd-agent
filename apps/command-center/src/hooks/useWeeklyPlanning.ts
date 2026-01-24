import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import type { Task } from '../types/task';

interface ScheduleTaskInput {
  taskId: string;
  startTime: string;
  endTime: string;
}

/**
 * Fetch tasks with #weekly-backlog label, sorted by sortOrder
 * Excludes tasks that have already been scheduled (have scheduledStart)
 */
export function useWeeklyBacklog() {
  return useQuery<Task[]>({
    queryKey: ['tasks', 'weekly-backlog'],
    queryFn: async () => {
      // Note: apiClient interceptor already unwraps response.data.data
      const tasks = await apiClient.get<Task[], Task[]>('/tasks', {
        params: {
          label: 'weekly-backlog',
          includeCompleted: 'false',
          limit: '100',
        },
      }) as unknown as Task[];
      // Filter out tasks that have already been scheduled
      // Sort by sortOrder ascending
      return (tasks || [])
        .filter((t: Task) => !t.scheduledStart)
        .sort((a: Task, b: Task) => (a.sortOrder || 0) - (b.sortOrder || 0));
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

/**
 * Fetch scheduled tasks for a date range
 * Filters tasks that have scheduledStart within the given date range
 */
export function useScheduledTasks(startDate: string, endDate: string) {
  return useQuery<Task[]>({
    queryKey: ['tasks', 'scheduled', startDate, endDate],
    queryFn: async () => {
      // Note: apiClient interceptor already unwraps response.data.data
      const tasks = await apiClient.get<Task[], Task[]>('/tasks', {
        params: {
          includeCompleted: 'false',
          limit: '500',
        },
      }) as unknown as Task[];
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include the full end day

      // Filter tasks that have scheduledStart within range
      return (tasks || []).filter((t: Task) => {
        if (!t.scheduledStart) return false;
        const scheduledDate = new Date(t.scheduledStart);
        return scheduledDate >= start && scheduledDate <= end;
      });
    },
    refetchInterval: 30000,
  });
}

/**
 * Schedule a task for a specific time slot
 */
export function useScheduleTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, startTime, endTime }: ScheduleTaskInput) => {
      // Note: apiClient interceptor already unwraps the response
      const result = await apiClient.post(`/tasks/${taskId}/schedule`, {
        startTime,
        endTime,
        createCalendarEvent: true,
      });
      return result;
    },
    onSuccess: () => {
      // Invalidate both tasks and calendar queries
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
  });
}

/**
 * Unschedule a task (remove from calendar)
 */
export function useUnscheduleTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      // Note: apiClient interceptor already unwraps the response
      const result = await apiClient.post(`/tasks/${taskId}/unschedule`);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['calendar'] });
    },
  });
}

/**
 * Reorder tasks by updating their sortOrder
 */
export function useReorderTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskIds: string[]) => {
      // Note: apiClient interceptor already unwraps the response
      const result = await apiClient.post('/tasks/reorder', { ids: taskIds });
      return result;
    },
    onMutate: async (newTaskIds) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['tasks', 'weekly-backlog'] });

      // Snapshot the previous value
      const previousTasks = queryClient.getQueryData<Task[]>(['tasks', 'weekly-backlog']);

      // Optimistically update to the new value
      if (previousTasks) {
        const taskMap = new Map(previousTasks.map((t) => [t.id, t]));
        const reorderedTasks = newTaskIds
          .map((id) => taskMap.get(id))
          .filter((t): t is Task => !!t);
        queryClient.setQueryData(['tasks', 'weekly-backlog'], reorderedTasks);
      }

      // Return a context object with the snapshotted value
      return { previousTasks };
    },
    onError: (_err, _newTaskIds, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks', 'weekly-backlog'], context.previousTasks);
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['tasks', 'weekly-backlog'] });
    },
  });
}

import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

/**
 * Hook for fetching archived tasks from the vault
 */
export function useArchivedTasks(context?: string, limit = 50) {
  return useQuery({
    queryKey: ['archive', 'tasks', context, limit],
    queryFn: () => api.getArchivedTasks(context, limit),
  });
}

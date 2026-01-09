import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { healthApi } from '../api/health';

export function useSystemInfo() {
  return useQuery({
    queryKey: ['system', 'info'],
    queryFn: () => healthApi.getSystemInfo(),
    refetchInterval: 30000, // Poll every 30 seconds
  });
}

export function useHealthMetrics() {
  return useQuery({
    queryKey: ['health', 'metrics'],
    queryFn: () => healthApi.getHealthMetrics(),
    refetchInterval: 60000, // Poll every minute
  });
}

export function useIntegrityChecks(limit: number = 20) {
  return useQuery({
    queryKey: ['integrity', 'checks', limit],
    queryFn: () => healthApi.getIntegrityChecks(limit),
  });
}

export function useActivityLogs(limit: number = 20) {
  return useQuery({
    queryKey: ['logs', limit],
    queryFn: () => healthApi.getActivityLogs(limit),
    refetchInterval: 30000, // Poll every 30 seconds
  });
}

export function useTriggerCeremony() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (type: string) => healthApi.triggerCeremony(type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    },
  });
}

export function useRunIntegrityCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => healthApi.runIntegrityCheck(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrity'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    },
  });
}

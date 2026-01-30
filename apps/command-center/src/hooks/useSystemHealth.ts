import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { healthApi } from '../api/health';

/**
 * Hook for header system health indicator.
 * Polls /api/health every 30 seconds to show online/offline status.
 */
export function useSystemHealth() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['system', 'health'],
    queryFn: () => healthApi.checkHealth(),
    refetchInterval: 30000, // Poll every 30 seconds
    retry: 1, // Only retry once on failure
    staleTime: 25000, // Consider data fresh for 25 seconds
  });

  // System is healthy if we got a response with status 'healthy'
  // If there's an error or no data, assume unhealthy
  const isHealthy = !isError && data?.status === 'healthy';

  return { isHealthy, isLoading };
}

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

export function useCommunicationStatus() {
  return useQuery({
    queryKey: ['communications', 'status'],
    queryFn: () => healthApi.getCommunicationStatus(),
    refetchInterval: 30000, // Poll every 30 seconds
  });
}

export function useRunCommunicationCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => healthApi.runCommunicationCheck(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    },
  });
}

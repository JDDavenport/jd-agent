import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { setupApi } from '../api/setup';

export function useSetupStatus() {
  return useQuery({
    queryKey: ['setup', 'status'],
    queryFn: () => setupApi.getStatus(),
  });
}

export function useServices() {
  return useQuery({
    queryKey: ['setup', 'services'],
    queryFn: () => setupApi.getServices(),
  });
}

export function useTestService() {
  return useMutation({
    mutationFn: (service: string) => setupApi.testService(service),
  });
}

export function useAddBrainDumpTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ title, context }: { title: string; context?: string }) =>
      setupApi.addBrainDumpTask(title, context),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setup', 'inbox'] });
    },
  });
}

export function useAddBulkTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (tasks: Array<{ title: string; context?: string }>) =>
      setupApi.addBulkTasks(tasks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setup', 'inbox'] });
    },
  });
}

export function useInbox() {
  return useQuery({
    queryKey: ['setup', 'inbox'],
    queryFn: () => setupApi.getInbox(),
  });
}

export function useNextInboxItem() {
  return useQuery({
    queryKey: ['setup', 'inbox', 'next'],
    queryFn: () => setupApi.getNextInboxItem(),
  });
}

export function useProcessInboxItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      action,
      options
    }: {
      id: string;
      action: 'today' | 'upcoming' | 'someday' | 'waiting' | 'delete';
      options?: {
        dueDate?: string;
        context?: string;
        priority?: number;
        waitingFor?: string;
      };
    }) => setupApi.processInboxItem(id, action, options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setup', 'inbox'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useCeremonies() {
  return useQuery({
    queryKey: ['setup', 'ceremonies'],
    queryFn: () => setupApi.getCeremonies(),
  });
}

export function useTestCeremony() {
  return useMutation({
    mutationFn: (type: string) => setupApi.testCeremony(type),
  });
}

export function useClasses() {
  return useQuery({
    queryKey: ['setup', 'classes'],
    queryFn: () => setupApi.getClasses(),
  });
}

export function useAddClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (classData: any) => setupApi.addClass(classData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setup', 'classes'] });
    },
  });
}

export function useCanvasCourses() {
  return useQuery({
    queryKey: ['setup', 'canvas-courses'],
    queryFn: () => setupApi.getCanvasCourses(),
    enabled: false, // Only fetch when explicitly requested
  });
}

export function useSetupSummary() {
  return useQuery({
    queryKey: ['setup', 'summary'],
    queryFn: () => setupApi.getSummary(),
  });
}

export function useMarkSetupComplete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => setupApi.markComplete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['setup'] });
    },
  });
}

export function usePreviewMorning() {
  return useQuery({
    queryKey: ['setup', 'preview-morning'],
    queryFn: () => setupApi.previewMorning(),
    enabled: false,
  });
}

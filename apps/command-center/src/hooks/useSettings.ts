import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../api/settings';

export function useCeremonyStatus() {
  return useQuery({
    queryKey: ['ceremonies', 'status'],
    queryFn: () => settingsApi.getCeremonyStatus(),
  });
}

export function useCeremonyConfig() {
  return useQuery({
    queryKey: ['ceremonies', 'config'],
    queryFn: () => settingsApi.getCeremonyConfig(),
  });
}

export function useTestCeremony() {
  return useMutation({
    mutationFn: (type: string) => settingsApi.testCeremony(type),
  });
}

export function usePreviewCeremony() {
  return useMutation({
    mutationFn: (type: string) => settingsApi.previewCeremony(type),
  });
}

export function useSettingsClasses() {
  return useQuery({
    queryKey: ['settings', 'classes'],
    queryFn: () => settingsApi.getClasses(),
  });
}

export function useAddSettingsClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (classData: any) => settingsApi.addClass(classData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'classes'] });
      queryClient.invalidateQueries({ queryKey: ['setup', 'classes'] });
    },
  });
}

export function useDeleteClass() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => settingsApi.deleteClass(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'classes'] });
      queryClient.invalidateQueries({ queryKey: ['setup', 'classes'] });
    },
  });
}

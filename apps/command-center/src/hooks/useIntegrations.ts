import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { integrationsApi } from '../api/integrations';

// Remarkable Cloud hooks
export function useRemarkableCloudStatus() {
  return useQuery({
    queryKey: ['remarkable', 'cloud', 'status'],
    queryFn: () => integrationsApi.getRemarkableCloudStatus(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useRemarkableDocuments() {
  return useQuery({
    queryKey: ['remarkable', 'cloud', 'documents'],
    queryFn: () => integrationsApi.getRemarkableDocuments(),
  });
}

export function useRemarkablePending() {
  return useQuery({
    queryKey: ['remarkable', 'cloud', 'pending'],
    queryFn: () => integrationsApi.getRemarkablePending(),
    refetchInterval: 60000, // Check for pending documents every minute
  });
}

export function useSyncRemarkableCloud() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => integrationsApi.syncRemarkableCloud(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarkable', 'cloud'] });
    },
  });
}

export function useRenderRemarkableDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) => integrationsApi.renderRemarkableDocument(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarkable', 'cloud'] });
    },
  });
}

export function useStartRemarkablePolling() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (intervalMinutes?: number) => integrationsApi.startRemarkablePolling(intervalMinutes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarkable', 'cloud', 'status'] });
    },
  });
}

export function useStopRemarkablePolling() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => integrationsApi.stopRemarkablePolling(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarkable', 'cloud', 'status'] });
    },
  });
}

export function useClearRemarkableState() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => integrationsApi.clearRemarkableState(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarkable', 'cloud'] });
    },
  });
}

// Google Drive Remarkable hooks
export function useRemarkableGDriveStatus() {
  return useQuery({
    queryKey: ['remarkable', 'gdrive', 'status'],
    queryFn: () => integrationsApi.getRemarkableGDriveStatus(),
  });
}

export function useSyncRemarkableGDrive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => integrationsApi.syncRemarkableGDrive(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarkable', 'gdrive'] });
    },
  });
}

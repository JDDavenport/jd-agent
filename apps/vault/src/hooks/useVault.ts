import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type { CreateVaultInput, VaultSearchParams } from '@jd-agent/types';

export function useVaultEntries() {
  return useQuery({
    queryKey: ['vault'],
    queryFn: () => api.listVault(),
  });
}

export function useVaultEntry(id: string | null) {
  return useQuery({
    queryKey: ['vault', 'entry', id],
    queryFn: () => api.getVaultEntry(id!),
    enabled: !!id,
  });
}

export function useVaultSearch(params: VaultSearchParams) {
  return useQuery({
    queryKey: ['vault', 'search', params],
    queryFn: () => api.searchVault(params),
    enabled: !!params.query && params.query.length > 0,
  });
}

export function useCreateVaultEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateVaultInput) => api.createVaultEntry(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault'] });
    },
  });
}

export function useUpdateVaultEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreateVaultInput> }) =>
      api.updateVaultEntry(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault'] });
    },
  });
}

export function useDeleteVaultEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteVaultEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault'] });
    },
  });
}

// ============================================
// Hierarchy Hooks (Nested Pages)
// ============================================

export function useVaultTree() {
  return useQuery({
    queryKey: ['vault', 'tree'],
    queryFn: () => api.getVaultTree(),
  });
}

export function useVaultChildren(parentId: string | null) {
  return useQuery({
    queryKey: ['vault', 'children', parentId],
    queryFn: () => api.getVaultChildren(parentId),
  });
}

export function useVaultBreadcrumb(id: string | null) {
  return useQuery({
    queryKey: ['vault', 'breadcrumb', id],
    queryFn: () => api.getVaultBreadcrumb(id!),
    enabled: !!id,
  });
}

export function useMoveVaultEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, parentId }: { id: string; parentId: string | null }) =>
      api.moveVaultEntry(id, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault'] });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as vaultApi from '../api/vault';
import type { VaultFilters, CreateVaultEntryInput, UpdateVaultEntryInput } from '../types/vault';

export function useVaultEntries(filters?: VaultFilters) {
  return useQuery({
    queryKey: ['vault', filters],
    queryFn: () => vaultApi.getVaultEntries(filters),
  });
}

export function useVaultSearch(query: string, filters?: VaultFilters) {
  return useQuery({
    queryKey: ['vault', 'search', query, filters],
    queryFn: () => vaultApi.searchVault(query, filters),
    enabled: query.length > 0,
  });
}

export function useVaultEntry(id: string) {
  return useQuery({
    queryKey: ['vault', id],
    queryFn: () => vaultApi.getVaultEntry(id),
    enabled: !!id,
  });
}

export function useCreateVaultEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateVaultEntryInput) => vaultApi.createVaultEntry(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateVaultEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateVaultEntryInput }) =>
      vaultApi.updateVaultEntry(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vault'] });
      queryClient.invalidateQueries({ queryKey: ['vault', variables.id] });
    },
  });
}

export function useDeleteVaultEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => vaultApi.deleteVaultEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vault'] });
    },
  });
}

export function useVaultContexts() {
  return useQuery({
    queryKey: ['vault', 'contexts'],
    queryFn: () => vaultApi.getVaultContexts(),
  });
}

export function useVaultTags() {
  return useQuery({
    queryKey: ['vault', 'tags'],
    queryFn: () => vaultApi.getVaultTags(),
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type {
  CreateVaultBlockInput,
  UpdateVaultBlockInput,
  MoveVaultBlockInput,
  BatchBlockOperation,
} from '../api';
import { vaultPageKeys } from './useVaultPages';

// Query keys
export const vaultBlockKeys = {
  all: ['vaultBlocks'] as const,
  page: (pageId: string) => [...vaultBlockKeys.all, 'page', pageId] as const,
  detail: (id: string) => [...vaultBlockKeys.all, 'detail', id] as const,
  children: (id: string) => [...vaultBlockKeys.all, 'children', id] as const,
};

// Get blocks for a page
export function useVaultBlocks(pageId: string | null) {
  return useQuery({
    queryKey: vaultBlockKeys.page(pageId || ''),
    queryFn: () => api.getVaultBlocks(pageId!),
    enabled: !!pageId,
  });
}

// Get single block
export function useVaultBlock(id: string | null) {
  return useQuery({
    queryKey: vaultBlockKeys.detail(id || ''),
    queryFn: () => api.getVaultBlock(id!),
    enabled: !!id,
  });
}

// Get block children
export function useVaultBlockChildren(id: string | null) {
  return useQuery({
    queryKey: vaultBlockKeys.children(id || ''),
    queryFn: () => api.getVaultBlockChildren(id!),
    enabled: !!id,
  });
}

// Create block
export function useCreateVaultBlock(pageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateVaultBlockInput) => api.createVaultBlock(pageId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vaultBlockKeys.page(pageId) });
      queryClient.invalidateQueries({ queryKey: vaultPageKeys.detail(pageId) });
    },
  });
}

// Update block
export function useUpdateVaultBlock(pageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateVaultBlockInput }) =>
      api.updateVaultBlock(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vaultBlockKeys.page(pageId) });
      queryClient.invalidateQueries({ queryKey: vaultPageKeys.detail(pageId) });
    },
  });
}

// Move block
export function useMoveVaultBlock(pageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: MoveVaultBlockInput }) =>
      api.moveVaultBlock(id, input),
    onSuccess: (block) => {
      queryClient.invalidateQueries({ queryKey: vaultBlockKeys.page(pageId) });
      queryClient.invalidateQueries({ queryKey: vaultPageKeys.detail(pageId) });
      if (block.pageId !== pageId) {
        queryClient.invalidateQueries({ queryKey: vaultBlockKeys.page(block.pageId) });
        queryClient.invalidateQueries({ queryKey: vaultPageKeys.detail(block.pageId) });
      }
    },
  });
}

// Delete block
export function useDeleteVaultBlock(pageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteVaultBlock(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vaultBlockKeys.page(pageId) });
      queryClient.invalidateQueries({ queryKey: vaultPageKeys.detail(pageId) });
    },
  });
}

// Batch operations
export function useBatchVaultBlocks(pageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (operations: BatchBlockOperation[]) => api.batchVaultBlocks(pageId, operations),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vaultBlockKeys.page(pageId) });
      queryClient.invalidateQueries({ queryKey: vaultPageKeys.detail(pageId) });
    },
  });
}

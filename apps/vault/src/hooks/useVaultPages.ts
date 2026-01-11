import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import type {
  CreateVaultPageInput,
  UpdateVaultPageInput,
} from '../api';

// Query keys
export const vaultPageKeys = {
  all: ['vaultPages'] as const,
  lists: () => [...vaultPageKeys.all, 'list'] as const,
  list: (options?: { archived?: boolean }) => [...vaultPageKeys.lists(), options] as const,
  tree: (options?: { archived?: boolean }) => [...vaultPageKeys.all, 'tree', options] as const,
  favorites: () => [...vaultPageKeys.all, 'favorites'] as const,
  details: () => [...vaultPageKeys.all, 'detail'] as const,
  detail: (id: string) => [...vaultPageKeys.details(), id] as const,
  children: (id: string) => [...vaultPageKeys.all, 'children', id] as const,
  search: (query: string) => [...vaultPageKeys.all, 'search', query] as const,
};

// List pages
export function useVaultPages(options?: { archived?: boolean }) {
  return useQuery({
    queryKey: vaultPageKeys.list(options),
    queryFn: () => api.listVaultPages(options),
  });
}

// Get page tree
export function useVaultPageTree(options?: { archived?: boolean }) {
  return useQuery({
    queryKey: vaultPageKeys.tree(options),
    queryFn: () => api.getVaultPageTree(options),
  });
}

// Get favorites
export function useVaultPageFavorites() {
  return useQuery({
    queryKey: vaultPageKeys.favorites(),
    queryFn: () => api.getVaultPageFavorites(),
  });
}

// Get single page with blocks
export function useVaultPage(id: string | null, includeBlocks = true) {
  return useQuery({
    queryKey: vaultPageKeys.detail(id || ''),
    queryFn: () => api.getVaultPage(id!, includeBlocks),
    enabled: !!id,
  });
}

// Get page children
export function useVaultPageChildren(id: string | null) {
  return useQuery({
    queryKey: vaultPageKeys.children(id || ''),
    queryFn: () => api.getVaultPageChildren(id!),
    enabled: !!id,
  });
}

// Quick search
export function useVaultPageSearch(query: string, limit = 10) {
  return useQuery({
    queryKey: vaultPageKeys.search(query),
    queryFn: () => api.quickFindVaultPages(query, limit),
    enabled: query.length > 0,
  });
}

// Alias for command palette
export function useVaultPageQuickFind(query: string, limit = 10) {
  return useQuery({
    queryKey: vaultPageKeys.search(query),
    queryFn: () => api.quickFindVaultPages(query, limit),
    enabled: query.length >= 2, // Only search with 2+ characters
    staleTime: 1000 * 30, // Cache for 30 seconds
  });
}

// Create page
export function useCreateVaultPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateVaultPageInput) => api.createVaultPage(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vaultPageKeys.all });
    },
  });
}

// Update page
export function useUpdateVaultPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateVaultPageInput }) =>
      api.updateVaultPage(id, input),
    onSuccess: (page) => {
      queryClient.invalidateQueries({ queryKey: vaultPageKeys.detail(page.id) });
      queryClient.invalidateQueries({ queryKey: vaultPageKeys.tree() });
      queryClient.invalidateQueries({ queryKey: vaultPageKeys.lists() });
      if (page.isFavorite) {
        queryClient.invalidateQueries({ queryKey: vaultPageKeys.favorites() });
      }
    },
  });
}

// Toggle favorite
export function useToggleVaultPageFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.toggleVaultPageFavorite(id),
    onSuccess: (page) => {
      queryClient.invalidateQueries({ queryKey: vaultPageKeys.detail(page.id) });
      queryClient.invalidateQueries({ queryKey: vaultPageKeys.favorites() });
      queryClient.invalidateQueries({ queryKey: vaultPageKeys.tree() });
    },
  });
}

// Reorder pages
export function useReorderVaultPages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pageIds: string[]) => api.reorderVaultPages(pageIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vaultPageKeys.tree() });
      queryClient.invalidateQueries({ queryKey: vaultPageKeys.lists() });
    },
  });
}

// Delete page
export function useDeleteVaultPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.deleteVaultPage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vaultPageKeys.all });
    },
  });
}

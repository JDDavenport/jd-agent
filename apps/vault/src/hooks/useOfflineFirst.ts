import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { isTauriApp } from './usePlatform';
import { api } from '../api';
import type {
  VaultPage,
  VaultPageTreeNode,
  VaultBlock,
  CreateVaultPageInput,
  UpdateVaultPageInput,
  CreateVaultBlockInput,
  UpdateVaultBlockInput,
  BatchBlockOperation,
} from '../lib/types';

// Lazy load SQLite modules only when needed
async function getPageRepo() {
  try {
    const { pageRepository } = await import('../lib/sqlite');
    return pageRepository;
  } catch (error) {
    console.error('[useOfflineFirst] Failed to load page repository:', error);
    throw error;
  }
}

async function getBlockRepo() {
  try {
    const { blockRepository } = await import('../lib/sqlite');
    return blockRepository;
  } catch (error) {
    console.error('[useOfflineFirst] Failed to load block repository:', error);
    throw error;
  }
}

// Check if SQLite is available and working
let sqliteAvailable: boolean | null = null;
async function checkSqliteAvailable(): Promise<boolean> {
  if (sqliteAvailable !== null) return sqliteAvailable;

  if (!isTauriApp()) {
    sqliteAvailable = false;
    return false;
  }

  try {
    const repo = await getPageRepo();
    // Try a simple operation
    await repo.getAll(false);
    sqliteAvailable = true;
    console.log('[useOfflineFirst] SQLite is available');
    return true;
  } catch (error) {
    console.error('[useOfflineFirst] SQLite not available, falling back to API:', error);
    sqliteAvailable = false;
    return false;
  }
}

// Query keys (reusing existing pattern)
export const offlinePageKeys = {
  all: ['offlinePages'] as const,
  lists: () => [...offlinePageKeys.all, 'list'] as const,
  list: (options?: { archived?: boolean }) => [...offlinePageKeys.lists(), options] as const,
  tree: () => [...offlinePageKeys.all, 'tree'] as const,
  favorites: () => [...offlinePageKeys.all, 'favorites'] as const,
  details: () => [...offlinePageKeys.all, 'detail'] as const,
  detail: (id: string) => [...offlinePageKeys.details(), id] as const,
  search: (query: string) => [...offlinePageKeys.all, 'search', query] as const,
};

export const offlineBlockKeys = {
  all: ['offlineBlocks'] as const,
  byPage: (pageId: string) => [...offlineBlockKeys.all, 'page', pageId] as const,
  detail: (id: string) => [...offlineBlockKeys.all, 'detail', id] as const,
};

// ============================================
// Page Hooks (Offline-First)
// ============================================

export function useOfflinePages(options?: { archived?: boolean }) {
  return useQuery({
    queryKey: offlinePageKeys.list(options),
    queryFn: async (): Promise<VaultPage[]> => {
      if (isTauriApp() && await checkSqliteAvailable()) {
        try {
          const repo = await getPageRepo();
          return repo.getAll(options?.archived ?? false);
        } catch (error) {
          console.error('[useOfflinePages] SQLite failed, falling back to API:', error);
        }
      }
      return api.listVaultPages(options);
    },
  });
}

export function useOfflinePageTree() {
  return useQuery({
    queryKey: offlinePageKeys.tree(),
    queryFn: async (): Promise<VaultPageTreeNode[]> => {
      if (isTauriApp() && await checkSqliteAvailable()) {
        try {
          const repo = await getPageRepo();
          return repo.getTree();
        } catch (error) {
          console.error('[useOfflinePageTree] SQLite failed, falling back to API:', error);
        }
      }
      return api.getVaultPageTree();
    },
  });
}

export function useOfflinePageFavorites() {
  return useQuery({
    queryKey: offlinePageKeys.favorites(),
    queryFn: async (): Promise<VaultPage[]> => {
      if (isTauriApp()) {
        const repo = await getPageRepo();
        return repo.getFavorites();
      }
      return api.getVaultPageFavorites();
    },
  });
}

export function useOfflinePage(id: string | null) {
  return useQuery({
    queryKey: offlinePageKeys.detail(id || ''),
    queryFn: async (): Promise<VaultPage | null> => {
      if (!id) return null;
      if (isTauriApp()) {
        const repo = await getPageRepo();
        return repo.getById(id);
      }
      return api.getVaultPage(id, false);
    },
    enabled: !!id,
  });
}

export function useOfflinePageSearch(query: string, limit = 20) {
  return useQuery({
    queryKey: offlinePageKeys.search(query),
    queryFn: async (): Promise<VaultPage[]> => {
      if (isTauriApp()) {
        const repo = await getPageRepo();
        return repo.search(query, limit);
      }
      return api.quickFindVaultPages(query, limit);
    },
    enabled: query.length >= 2,
    staleTime: 1000 * 30,
  });
}

export function useCreateOfflinePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateVaultPageInput): Promise<VaultPage> => {
      console.log('[useCreateOfflinePage] Creating page:', input);
      if (isTauriApp() && await checkSqliteAvailable()) {
        try {
          const repo = await getPageRepo();
          const page = await repo.create(input);
          console.log('[useCreateOfflinePage] Created via SQLite:', page.id);
          return page;
        } catch (error) {
          console.error('[useCreateOfflinePage] SQLite failed, falling back to API:', error);
        }
      }
      const page = await api.createVaultPage(input);
      console.log('[useCreateOfflinePage] Created via API:', page.id);
      return page;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: offlinePageKeys.all });
    },
    onError: (error) => {
      console.error('[useCreateOfflinePage] Failed to create page:', error);
    },
  });
}

export function useUpdateOfflinePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateVaultPageInput;
    }): Promise<VaultPage | null> => {
      if (isTauriApp()) {
        const repo = await getPageRepo();
        return repo.update(id, input);
      }
      return api.updateVaultPage(id, input);
    },
    onSuccess: (page) => {
      if (page) {
        queryClient.invalidateQueries({ queryKey: offlinePageKeys.detail(page.id) });
        queryClient.invalidateQueries({ queryKey: offlinePageKeys.tree() });
        queryClient.invalidateQueries({ queryKey: offlinePageKeys.lists() });
        if (page.isFavorite) {
          queryClient.invalidateQueries({ queryKey: offlinePageKeys.favorites() });
        }
      }
    },
  });
}

export function useToggleOfflinePageFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<VaultPage | null> => {
      if (isTauriApp()) {
        const repo = await getPageRepo();
        return repo.toggleFavorite(id);
      }
      return api.toggleVaultPageFavorite(id);
    },
    onSuccess: (page) => {
      if (page) {
        queryClient.invalidateQueries({ queryKey: offlinePageKeys.detail(page.id) });
        queryClient.invalidateQueries({ queryKey: offlinePageKeys.favorites() });
        queryClient.invalidateQueries({ queryKey: offlinePageKeys.tree() });
      }
    },
  });
}

export function useDeleteOfflinePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<boolean> => {
      if (isTauriApp()) {
        const repo = await getPageRepo();
        return repo.delete(id);
      }
      await api.deleteVaultPage(id);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: offlinePageKeys.all });
    },
  });
}

// ============================================
// Block Hooks (Offline-First)
// ============================================

export function useOfflineBlocks(pageId: string | null) {
  return useQuery({
    queryKey: offlineBlockKeys.byPage(pageId || ''),
    queryFn: async (): Promise<VaultBlock[]> => {
      if (!pageId) return [];
      if (isTauriApp()) {
        const repo = await getBlockRepo();
        return repo.getByPageId(pageId);
      }
      return api.getVaultBlocks(pageId);
    },
    enabled: !!pageId,
  });
}

export function useCreateOfflineBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pageId,
      input,
    }: {
      pageId: string;
      input: CreateVaultBlockInput;
    }): Promise<VaultBlock> => {
      if (isTauriApp()) {
        const repo = await getBlockRepo();
        return repo.create(pageId, input);
      }
      return api.createVaultBlock(pageId, input);
    },
    onSuccess: (block) => {
      queryClient.invalidateQueries({ queryKey: offlineBlockKeys.byPage(block.pageId) });
    },
  });
}

export function useUpdateOfflineBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: UpdateVaultBlockInput;
    }): Promise<VaultBlock | null> => {
      if (isTauriApp()) {
        const repo = await getBlockRepo();
        return repo.update(id, input);
      }
      return api.updateVaultBlock(id, input);
    },
    onSuccess: (block) => {
      if (block) {
        queryClient.invalidateQueries({ queryKey: offlineBlockKeys.byPage(block.pageId) });
      }
    },
  });
}

export function useDeleteOfflineBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string; pageId: string }): Promise<boolean> => {
      if (isTauriApp()) {
        const repo = await getBlockRepo();
        return repo.delete(id);
      }
      await api.deleteVaultBlock(id);
      return true;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: offlineBlockKeys.byPage(variables.pageId) });
    },
  });
}

export function useBatchOfflineBlockOperations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      pageId,
      operations,
    }: {
      pageId: string;
      operations: BatchBlockOperation[];
    }): Promise<VaultBlock[]> => {
      if (isTauriApp()) {
        const repo = await getBlockRepo();
        return repo.batchOperations(pageId, operations);
      }
      return api.batchVaultBlocks(pageId, operations);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: offlineBlockKeys.byPage(variables.pageId) });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { isTauriApp } from './usePlatform';
import type {
  CreateVaultPageInput,
  UpdateVaultPageInput,
  PARAType,
} from '../api';

// Lazy load SQLite modules only when needed (Tauri app)
async function getPageRepo() {
  try {
    const { pageRepository } = await import('../lib/sqlite');
    return pageRepository;
  } catch (error) {
    console.error('[useVaultPages] Failed to load page repository:', error);
    return null;
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
    if (!repo) {
      sqliteAvailable = false;
      return false;
    }
    await repo.getAll(false);
    sqliteAvailable = true;
    console.log('[useVaultPages] SQLite is available');
    return true;
  } catch (error) {
    console.error('[useVaultPages] SQLite not available, using API only:', error);
    sqliteAvailable = false;
    return false;
  }
}

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
  backlinks: (id: string) => [...vaultPageKeys.all, 'backlinks', id] as const,
  search: (query: string) => [...vaultPageKeys.all, 'search', query] as const,
  para: () => [...vaultPageKeys.all, 'para'] as const,
  paraFolders: () => [...vaultPageKeys.para(), 'folders'] as const,
  paraPages: (paraType: PARAType) => [...vaultPageKeys.para(), paraType] as const,
};

// List pages (with offline-first support)
export function useVaultPages(options?: { archived?: boolean }) {
  return useQuery({
    queryKey: vaultPageKeys.list(options),
    queryFn: async () => {
      // Try SQLite first if available
      if (isTauriApp() && await checkSqliteAvailable()) {
        try {
          const repo = await getPageRepo();
          if (repo) {
            console.log('[useVaultPages] Using SQLite');
            return repo.getAll(options?.archived ?? false);
          }
        } catch (error) {
          console.error('[useVaultPages] SQLite failed, falling back to API:', error);
        }
      }
      console.log('[useVaultPages] Using API');
      return api.listVaultPages(options);
    },
  });
}

// Get page tree (with offline-first support)
export function useVaultPageTree(options?: { archived?: boolean }) {
  return useQuery({
    queryKey: vaultPageKeys.tree(options),
    queryFn: async () => {
      // Try SQLite first if available
      if (isTauriApp() && await checkSqliteAvailable()) {
        try {
          const repo = await getPageRepo();
          if (repo) {
            console.log('[useVaultPageTree] Using SQLite');
            return repo.getTree();
          }
        } catch (error) {
          console.error('[useVaultPageTree] SQLite failed, falling back to API:', error);
        }
      }
      console.log('[useVaultPageTree] Using API');
      return api.getVaultPageTree(options);
    },
  });
}

// Get favorites (with offline-first support)
export function useVaultPageFavorites() {
  return useQuery({
    queryKey: vaultPageKeys.favorites(),
    queryFn: async () => {
      // Try SQLite first if available
      if (isTauriApp() && await checkSqliteAvailable()) {
        try {
          const repo = await getPageRepo();
          if (repo) {
            console.log('[useVaultPageFavorites] Using SQLite');
            return repo.getFavorites();
          }
        } catch (error) {
          console.error('[useVaultPageFavorites] SQLite failed, falling back to API:', error);
        }
      }
      console.log('[useVaultPageFavorites] Using API');
      return api.getVaultPageFavorites();
    },
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

// Get backlinks - pages that link to this page
export function useVaultPageBacklinks(id: string | null) {
  return useQuery({
    queryKey: vaultPageKeys.backlinks(id || ''),
    queryFn: () => api.getVaultPageBacklinks(id!),
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

// Create page (with offline-first support)
export function useCreateVaultPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateVaultPageInput) => {
      console.log('[useCreateVaultPage] Creating page:', input.title);
      // Try SQLite first if available
      if (isTauriApp() && await checkSqliteAvailable()) {
        try {
          const repo = await getPageRepo();
          if (repo) {
            const page = await repo.create(input);
            console.log('[useCreateVaultPage] Created via SQLite:', page.id);
            return page;
          }
        } catch (error) {
          console.error('[useCreateVaultPage] SQLite failed, falling back to API:', error);
        }
      }
      console.log('[useCreateVaultPage] Creating via API');
      const page = await api.createVaultPage(input);
      console.log('[useCreateVaultPage] Created via API:', page.id);
      return page;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vaultPageKeys.all });
    },
    onError: (error) => {
      console.error('[useCreateVaultPage] Failed to create page:', error);
    },
  });
}

// Update page (with offline-first support)
export function useUpdateVaultPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateVaultPageInput }) => {
      console.log('[useUpdateVaultPage] Updating:', id, input);
      // Try SQLite first if available
      if (isTauriApp() && await checkSqliteAvailable()) {
        try {
          const repo = await getPageRepo();
          if (repo) {
            const page = await repo.update(id, input);
            console.log('[useUpdateVaultPage] Updated via SQLite:', page?.id);
            if (page) return page;
          }
        } catch (error) {
          console.error('[useUpdateVaultPage] SQLite failed, falling back to API:', error);
        }
      }
      console.log('[useUpdateVaultPage] Updating via API');
      return api.updateVaultPage(id, input);
    },
    onSuccess: (page) => {
      queryClient.invalidateQueries({ queryKey: vaultPageKeys.detail(page.id) });
      queryClient.invalidateQueries({ queryKey: vaultPageKeys.tree() });
      queryClient.invalidateQueries({ queryKey: vaultPageKeys.lists() });
      if (page.isFavorite) {
        queryClient.invalidateQueries({ queryKey: vaultPageKeys.favorites() });
      }
    },
    onError: (error) => {
      console.error('[useUpdateVaultPage] Error:', error);
    },
  });
}

// Toggle favorite (with offline-first support)
export function useToggleVaultPageFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      console.log('[useToggleVaultPageFavorite] Toggling:', id);
      // Try SQLite first if available
      if (isTauriApp() && await checkSqliteAvailable()) {
        try {
          const repo = await getPageRepo();
          if (repo) {
            const page = await repo.toggleFavorite(id);
            console.log('[useToggleVaultPageFavorite] Toggled via SQLite:', page?.id);
            if (page) return page;
          }
        } catch (error) {
          console.error('[useToggleVaultPageFavorite] SQLite failed, falling back to API:', error);
        }
      }
      console.log('[useToggleVaultPageFavorite] Toggling via API');
      return api.toggleVaultPageFavorite(id);
    },
    onSuccess: (page) => {
      queryClient.invalidateQueries({ queryKey: vaultPageKeys.detail(page.id) });
      queryClient.invalidateQueries({ queryKey: vaultPageKeys.favorites() });
      queryClient.invalidateQueries({ queryKey: vaultPageKeys.tree() });
    },
    onError: (error) => {
      console.error('[useToggleVaultPageFavorite] Error:', error);
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

// Delete page (with offline-first support)
export function useDeleteVaultPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      console.log('[useDeleteVaultPage] Deleting:', id);
      // Try SQLite first if available
      if (isTauriApp() && await checkSqliteAvailable()) {
        try {
          const repo = await getPageRepo();
          if (repo) {
            await repo.delete(id);
            console.log('[useDeleteVaultPage] Deleted via SQLite:', id);
            return;
          }
        } catch (error) {
          console.error('[useDeleteVaultPage] SQLite failed, falling back to API:', error);
        }
      }
      console.log('[useDeleteVaultPage] Deleting via API');
      return api.deleteVaultPage(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vaultPageKeys.all });
    },
    onError: (error) => {
      console.error('[useDeleteVaultPage] Error:', error);
    },
  });
}

// ============================================
// PARA Organization Hooks
// ============================================

// Get PARA folders (Projects, Areas, Resources, Archive)
export function usePARAFolders() {
  return useQuery({
    queryKey: vaultPageKeys.paraFolders(),
    queryFn: () => api.getPARAFolders(),
  });
}

// Get pages under a specific PARA folder
export function usePARAPages(paraType: PARAType) {
  return useQuery({
    queryKey: vaultPageKeys.paraPages(paraType),
    queryFn: () => api.getPARAPages(paraType),
    enabled: !!paraType,
  });
}

// Initialize PARA folders (creates Projects, Areas, Resources, Archive if missing)
export function useInitializePARA() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.initializePARA(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vaultPageKeys.all });
    },
  });
}

// Move a page to a PARA folder
export function useMoveToPARA() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ pageId, paraType }: { pageId: string; paraType: PARAType }) =>
      api.moveToPARA(pageId, paraType),
    onSuccess: (page) => {
      queryClient.invalidateQueries({ queryKey: vaultPageKeys.detail(page.id) });
      queryClient.invalidateQueries({ queryKey: vaultPageKeys.tree() });
      queryClient.invalidateQueries({ queryKey: vaultPageKeys.para() });
    },
  });
}

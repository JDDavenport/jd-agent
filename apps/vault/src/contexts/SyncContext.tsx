import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { isTauriApp } from '../hooks/usePlatform';

interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingChanges: number;
  lastSyncTime: string | null;
  error: string | null;
}

interface SyncContextValue extends SyncState {
  triggerSync: () => Promise<void>;
  clearError: () => void;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SyncState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    pendingChanges: 0,
    lastSyncTime: null,
    error: null,
  });

  const updatePendingCount = useCallback(async () => {
    if (!isTauriApp()) return;

    try {
      const { syncService } = await import('../lib/sqlite');
      const count = await syncService.getPendingCount();
      setState((prev) => ({ ...prev, pendingChanges: count }));
    } catch {
      // SQLite not available
    }
  }, []);

  const triggerSync = useCallback(async () => {
    if (!isTauriApp()) return;
    if (state.isSyncing) return;

    setState((prev) => ({ ...prev, isSyncing: true, error: null }));

    try {
      const { syncService } = await import('../lib/sqlite');
      const result = await syncService.fullSync();

      setState((prev) => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: new Date().toISOString(),
        pendingChanges: 0,
        error: result.errors.length > 0 ? result.errors.join(', ') : null,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isSyncing: false,
        error: err instanceof Error ? err.message : 'Sync failed',
      }));
    }
  }, [state.isSyncing]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setState((prev) => ({ ...prev, isOnline: true }));
      triggerSync();
    };

    const handleOffline = () => {
      setState((prev) => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [triggerSync]);

  // Set up sync service listeners when in Tauri
  useEffect(() => {
    if (!isTauriApp()) return;

    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const { syncService } = await import('../lib/sqlite');

        cleanup = syncService.onConnectivityChange((online) => {
          setState((prev) => ({ ...prev, isOnline: online }));
        });

        // Get initial pending count
        await updatePendingCount();

        // Get last sync time
        const lastSync = await syncService.getLastSyncTime();
        setState((prev) => ({ ...prev, lastSyncTime: lastSync }));
      } catch {
        // SQLite not available
      }
    })();

    return () => cleanup?.();
  }, [updatePendingCount]);

  // Sync on app foreground
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && state.isOnline) {
        triggerSync();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [state.isOnline, triggerSync]);

  // Initial sync on mount
  useEffect(() => {
    if (isTauriApp() && state.isOnline) {
      triggerSync();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SyncContext.Provider
      value={{
        ...state,
        triggerSync,
        clearError,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}

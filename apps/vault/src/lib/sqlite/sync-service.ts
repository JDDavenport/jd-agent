import { getDatabase, now } from './client';
import { pageRepository } from './page-repository';
import { blockRepository } from './block-repository';
import type { VaultPage, VaultBlock } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface SyncQueueItem {
  id: number;
  entity_type: string;
  entity_id: string;
  operation: string;
  payload: string | null;
  created_at: string;
  attempts: number;
  last_error: string | null;
}

interface SyncResult {
  pushed: number;
  pulled: number;
  errors: string[];
}

let isOnline = true;
let syncInProgress = false;
const onlineListeners: Set<(online: boolean) => void> = new Set();

export const syncService = {
  isOnline(): boolean {
    return isOnline;
  },

  setOnline(online: boolean): void {
    if (isOnline !== online) {
      isOnline = online;
      onlineListeners.forEach((listener) => listener(online));

      if (online) {
        // Trigger sync when coming back online
        this.fullSync().catch(console.error);
      }
    }
  },

  onConnectivityChange(callback: (online: boolean) => void): () => void {
    onlineListeners.add(callback);
    return () => onlineListeners.delete(callback);
  },

  async fullSync(): Promise<SyncResult> {
    if (syncInProgress) {
      return { pushed: 0, pulled: 0, errors: ['Sync already in progress'] };
    }

    if (!isOnline) {
      return { pushed: 0, pulled: 0, errors: ['Offline'] };
    }

    syncInProgress = true;
    const result: SyncResult = { pushed: 0, pulled: 0, errors: [] };

    try {
      // Push local changes first
      const pushResult = await this.pushPendingChanges();
      result.pushed = pushResult.pushed;
      result.errors.push(...pushResult.errors);

      // Then pull remote changes
      const pullResult = await this.pullRemoteChanges();
      result.pulled = pullResult.pulled;
      result.errors.push(...pullResult.errors);

      // Update last sync time
      await this.setLastSyncTime(now());
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      syncInProgress = false;
    }

    return result;
  },

  async pushPendingChanges(): Promise<{ pushed: number; errors: string[] }> {
    const db = await getDatabase();
    const result = { pushed: 0, errors: [] as string[] };

    // Get pending items from sync queue
    const queueItems = await db.select<SyncQueueItem[]>(
      'SELECT * FROM sync_queue ORDER BY created_at ASC LIMIT 100'
    );

    for (const item of queueItems) {
      try {
        await this.processSyncQueueItem(item);
        // Remove from queue on success
        await db.execute('DELETE FROM sync_queue WHERE id = ?', [item.id]);
        result.pushed++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`${item.entity_type}/${item.entity_id}: ${errorMsg}`);

        // Update attempt count and error
        await db.execute(
          `UPDATE sync_queue SET attempts = attempts + 1, last_error = ?, last_attempt_at = ? WHERE id = ?`,
          [errorMsg, now(), item.id]
        );
      }
    }

    return result;
  },

  async processSyncQueueItem(item: SyncQueueItem): Promise<void> {
    const payload = item.payload ? JSON.parse(item.payload) : null;

    switch (item.entity_type) {
      case 'page':
        await this.syncPage(item.entity_id, item.operation, payload);
        break;
      case 'block':
        await this.syncBlock(item.entity_id, item.operation, payload);
        break;
      default:
        throw new Error(`Unknown entity type: ${item.entity_type}`);
    }
  },

  async syncPage(id: string, operation: string, payload: unknown): Promise<void> {
    switch (operation) {
      case 'create': {
        const response = await fetch(`${API_BASE_URL}/api/vault/pages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id, // Include local ID to maintain consistency
            ...(payload as Record<string, unknown>),
          }),
        });
        if (!response.ok) throw new Error(`Failed to create page: ${response.status}`);
        const serverPage = await response.json();
        await pageRepository.markSynced(id, serverPage.version ?? 1);
        break;
      }
      case 'update': {
        const response = await fetch(`${API_BASE_URL}/api/vault/pages/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(`Failed to update page: ${response.status}`);
        const serverPage = await response.json();
        await pageRepository.markSynced(id, serverPage.version ?? 1);
        break;
      }
      case 'delete': {
        const response = await fetch(`${API_BASE_URL}/api/vault/pages/${id}`, {
          method: 'DELETE',
        });
        if (!response.ok && response.status !== 404) {
          throw new Error(`Failed to delete page: ${response.status}`);
        }
        break;
      }
    }
  },

  async syncBlock(id: string, operation: string, payload: unknown): Promise<void> {
    switch (operation) {
      case 'create': {
        const block = await blockRepository.getById(id);
        if (!block) return;

        const response = await fetch(
          `${API_BASE_URL}/api/vault/pages/${block.pageId}/blocks`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id,
              type: block.type,
              content: block.content,
              parentBlockId: block.parentBlockId,
              sortOrder: block.sortOrder,
            }),
          }
        );
        if (!response.ok) throw new Error(`Failed to create block: ${response.status}`);
        const serverBlock = await response.json();
        await blockRepository.markSynced(id, serverBlock.version ?? 1);
        break;
      }
      case 'update': {
        const block = await blockRepository.getById(id);
        if (!block) return;

        const response = await fetch(`${API_BASE_URL}/api/vault/blocks/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(`Failed to update block: ${response.status}`);
        const serverBlock = await response.json();
        await blockRepository.markSynced(id, serverBlock.version ?? 1);
        break;
      }
      case 'delete': {
        const response = await fetch(`${API_BASE_URL}/api/vault/blocks/${id}`, {
          method: 'DELETE',
        });
        if (!response.ok && response.status !== 404) {
          throw new Error(`Failed to delete block: ${response.status}`);
        }
        break;
      }
      case 'move': {
        const response = await fetch(`${API_BASE_URL}/api/vault/blocks/${id}/move`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error(`Failed to move block: ${response.status}`);
        break;
      }
    }
  },

  async pullRemoteChanges(): Promise<{ pulled: number; errors: string[] }> {
    const result = { pulled: 0, errors: [] as string[] };

    try {
      // TODO: Use lastSync for incremental sync when backend supports it
      // await this.getLastSyncTime();

      // Fetch all pages from server
      const pagesResponse = await fetch(`${API_BASE_URL}/api/vault/pages`);
      if (!pagesResponse.ok) throw new Error(`Failed to fetch pages: ${pagesResponse.status}`);

      const serverPages: VaultPage[] = await pagesResponse.json();

      // Upsert each page
      for (const page of serverPages) {
        await pageRepository.upsertFromServer(page);
        result.pulled++;
      }

      // For each page, fetch and upsert blocks
      for (const page of serverPages) {
        const blocksResponse = await fetch(
          `${API_BASE_URL}/api/vault/pages/${page.id}/blocks`
        );
        if (blocksResponse.ok) {
          const serverBlocks: VaultBlock[] = await blocksResponse.json();
          for (const block of serverBlocks) {
            await blockRepository.upsertFromServer(block);
            result.pulled++;
          }
        }
      }
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Failed to pull changes');
    }

    return result;
  },

  async getLastSyncTime(): Promise<string | null> {
    const db = await getDatabase();
    const rows = await db.select<{ value: string }[]>(
      "SELECT value FROM sync_metadata WHERE key = 'last_sync_time'"
    );
    return rows.length > 0 ? rows[0].value : null;
  },

  async setLastSyncTime(time: string): Promise<void> {
    const db = await getDatabase();
    await db.execute(
      `INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
       VALUES ('last_sync_time', ?, ?)`,
      [time, now()]
    );
  },

  async getPendingCount(): Promise<number> {
    const db = await getDatabase();
    const rows = await db.select<{ count: number }[]>(
      'SELECT COUNT(*) as count FROM sync_queue'
    );
    return rows[0]?.count ?? 0;
  },

  async clearSyncQueue(): Promise<void> {
    const db = await getDatabase();
    await db.execute('DELETE FROM sync_queue');
  },
};

// Initialize connectivity monitoring
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => syncService.setOnline(true));
  window.addEventListener('offline', () => syncService.setOnline(false));
  syncService.setOnline(navigator.onLine);
}

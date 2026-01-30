import { getDatabase, generateId, now } from './client';
import type { VaultPage, VaultPageTreeNode, VaultPageBreadcrumb, CreateVaultPageInput, UpdateVaultPageInput } from '../types';

interface PageRow {
  id: string;
  parent_id: string | null;
  title: string;
  icon: string | null;
  cover_image: string | null;
  is_favorite: number;
  is_archived: number;
  sort_order: number;
  para_type: string | null;
  is_system: number;
  legacy_entry_id: string | null;
  last_viewed_at: string | null;
  created_at: string;
  updated_at: string;
  sync_status: string;
  server_version: number;
  local_version: number;
  deleted_at: string | null;
}

function rowToPage(row: PageRow): VaultPage {
  return {
    id: row.id,
    parentId: row.parent_id,
    title: row.title,
    icon: row.icon,
    coverImage: row.cover_image,
    isFavorite: row.is_favorite === 1,
    isArchived: row.is_archived === 1,
    sortOrder: row.sort_order,
    legacyEntryId: row.legacy_entry_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastViewedAt: row.last_viewed_at,
  };
}

export const pageRepository = {
  async getAll(includeArchived = false): Promise<VaultPage[]> {
    const db = await getDatabase();
    const query = includeArchived
      ? 'SELECT * FROM vault_pages WHERE deleted_at IS NULL ORDER BY sort_order'
      : 'SELECT * FROM vault_pages WHERE deleted_at IS NULL AND is_archived = 0 ORDER BY sort_order';
    const rows = await db.select<PageRow[]>(query);
    return rows.map(rowToPage);
  },

  async getById(id: string): Promise<VaultPage | null> {
    const db = await getDatabase();
    const rows = await db.select<PageRow[]>(
      'SELECT * FROM vault_pages WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return rows.length > 0 ? rowToPage(rows[0]) : null;
  },

  async getChildren(parentId: string | null): Promise<VaultPage[]> {
    const db = await getDatabase();
    const query = parentId
      ? 'SELECT * FROM vault_pages WHERE parent_id = ? AND deleted_at IS NULL AND is_archived = 0 ORDER BY sort_order'
      : 'SELECT * FROM vault_pages WHERE parent_id IS NULL AND deleted_at IS NULL AND is_archived = 0 ORDER BY sort_order';
    const params = parentId ? [parentId] : [];
    const rows = await db.select<PageRow[]>(query, params);
    return rows.map(rowToPage);
  },

  async getFavorites(): Promise<VaultPage[]> {
    const db = await getDatabase();
    const rows = await db.select<PageRow[]>(
      'SELECT * FROM vault_pages WHERE is_favorite = 1 AND deleted_at IS NULL AND is_archived = 0 ORDER BY sort_order'
    );
    return rows.map(rowToPage);
  },

  async getTree(): Promise<VaultPageTreeNode[]> {
    const pages = await this.getAll(false);
    return buildTree(pages);
  },

  async getBreadcrumb(id: string): Promise<VaultPageBreadcrumb[]> {
    const breadcrumb: VaultPageBreadcrumb[] = [];
    let currentId: string | null = id;
    let depth = 0;
    const maxDepth = 20;

    while (currentId && depth < maxDepth) {
      const page = await this.getById(currentId);
      if (!page) break;
      breadcrumb.unshift({
        id: page.id,
        title: page.title,
        icon: page.icon,
      });
      currentId = page.parentId ?? null;
      depth++;
    }

    return breadcrumb;
  },

  async create(input: CreateVaultPageInput): Promise<VaultPage> {
    const db = await getDatabase();
    const id = generateId();
    const timestamp = now();

    // Get next sort order
    const maxOrderRows = await db.select<{ max_order: number | null }[]>(
      input.parentId
        ? 'SELECT MAX(sort_order) as max_order FROM vault_pages WHERE parent_id = ?'
        : 'SELECT MAX(sort_order) as max_order FROM vault_pages WHERE parent_id IS NULL',
      input.parentId ? [input.parentId] : []
    );
    const sortOrder = (maxOrderRows[0]?.max_order ?? -1) + 1;

    await db.execute(
      `INSERT INTO vault_pages (id, parent_id, title, icon, cover_image, sort_order, created_at, updated_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        id,
        input.parentId ?? null,
        input.title ?? 'Untitled',
        input.icon ?? null,
        input.coverImage ?? null,
        sortOrder,
        timestamp,
        timestamp,
      ]
    );

    // Add to sync queue
    await addToSyncQueue('page', id, 'create', input);

    return (await this.getById(id))!;
  },

  async update(id: string, input: UpdateVaultPageInput): Promise<VaultPage | null> {
    const db = await getDatabase();
    const existing = await this.getById(id);
    if (!existing) return null;

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (input.title !== undefined) {
      updates.push('title = ?');
      values.push(input.title);
    }
    if (input.icon !== undefined) {
      updates.push('icon = ?');
      values.push(input.icon);
    }
    if (input.coverImage !== undefined) {
      updates.push('cover_image = ?');
      values.push(input.coverImage);
    }
    if (input.isFavorite !== undefined) {
      updates.push('is_favorite = ?');
      values.push(input.isFavorite ? 1 : 0);
    }
    if (input.isArchived !== undefined) {
      updates.push('is_archived = ?');
      values.push(input.isArchived ? 1 : 0);
    }
    if (input.parentId !== undefined) {
      updates.push('parent_id = ?');
      values.push(input.parentId);
    }
    if (input.sortOrder !== undefined) {
      updates.push('sort_order = ?');
      values.push(input.sortOrder);
    }

    if (updates.length === 0) return existing;

    updates.push('updated_at = ?');
    values.push(now());
    updates.push('sync_status = ?');
    values.push('pending');
    updates.push('local_version = local_version + 1');
    values.push(id);

    await db.execute(
      `UPDATE vault_pages SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Add to sync queue
    await addToSyncQueue('page', id, 'update', input);

    return this.getById(id);
  },

  async delete(id: string): Promise<boolean> {
    const db = await getDatabase();
    const existing = await this.getById(id);
    if (!existing) return false;

    // Soft delete
    await db.execute(
      `UPDATE vault_pages SET deleted_at = ?, sync_status = 'pending', local_version = local_version + 1 WHERE id = ?`,
      [now(), id]
    );

    // Add to sync queue
    await addToSyncQueue('page', id, 'delete', null);

    return true;
  },

  async toggleFavorite(id: string): Promise<VaultPage | null> {
    const existing = await this.getById(id);
    if (!existing) return null;
    return this.update(id, { isFavorite: !existing.isFavorite });
  },

  async search(query: string, limit = 20): Promise<VaultPage[]> {
    const db = await getDatabase();
    const searchPattern = `%${query}%`;
    const rows = await db.select<PageRow[]>(
      `SELECT * FROM vault_pages
       WHERE title LIKE ? AND deleted_at IS NULL AND is_archived = 0
       ORDER BY updated_at DESC LIMIT ?`,
      [searchPattern, limit]
    );
    return rows.map(rowToPage);
  },

  async reorder(_parentId: string | null, orderedIds: string[]): Promise<void> {
    const db = await getDatabase();
    for (let i = 0; i < orderedIds.length; i++) {
      await db.execute(
        `UPDATE vault_pages SET sort_order = ?, updated_at = ?, sync_status = 'pending' WHERE id = ?`,
        [i, now(), orderedIds[i]]
      );
      await addToSyncQueue('page', orderedIds[i], 'update', { sortOrder: i });
    }
  },

  // Sync-related methods
  async getPendingChanges(): Promise<VaultPage[]> {
    const db = await getDatabase();
    const rows = await db.select<PageRow[]>(
      "SELECT * FROM vault_pages WHERE sync_status = 'pending'"
    );
    return rows.map(rowToPage);
  },

  async markSynced(id: string, serverVersion: number): Promise<void> {
    const db = await getDatabase();
    await db.execute(
      `UPDATE vault_pages SET sync_status = 'synced', server_version = ? WHERE id = ?`,
      [serverVersion, id]
    );
  },

  async upsertFromServer(page: VaultPage & { serverVersion?: number }): Promise<void> {
    const db = await getDatabase();
    const existing = await this.getById(page.id);

    if (!existing) {
      // Insert new page from server
      await db.execute(
        `INSERT INTO vault_pages (id, parent_id, title, icon, cover_image, is_favorite, is_archived, sort_order, created_at, updated_at, sync_status, server_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
        [
          page.id,
          page.parentId ?? null,
          page.title,
          page.icon ?? null,
          page.coverImage ?? null,
          page.isFavorite ? 1 : 0,
          page.isArchived ? 1 : 0,
          page.sortOrder,
          page.createdAt,
          page.updatedAt,
          page.serverVersion ?? 1,
        ]
      );
    } else if (existing.sortOrder <= (page.serverVersion ?? 1)) {
      // Update if server version is newer
      await db.execute(
        `UPDATE vault_pages SET
          parent_id = ?, title = ?, icon = ?, cover_image = ?,
          is_favorite = ?, is_archived = ?, sort_order = ?,
          updated_at = ?, sync_status = 'synced', server_version = ?
         WHERE id = ? AND sync_status = 'synced'`,
        [
          page.parentId ?? null,
          page.title,
          page.icon ?? null,
          page.coverImage ?? null,
          page.isFavorite ? 1 : 0,
          page.isArchived ? 1 : 0,
          page.sortOrder,
          page.updatedAt,
          page.serverVersion ?? 1,
          page.id,
        ]
      );
    }
  },
};

function buildTree(pages: VaultPage[]): VaultPageTreeNode[] {
  const pageMap = new Map<string, VaultPageTreeNode>();
  const roots: VaultPageTreeNode[] = [];

  // Create all nodes
  for (const page of pages) {
    pageMap.set(page.id, {
      id: page.id,
      title: page.title,
      icon: page.icon,
      parentId: page.parentId ?? null,
      isFavorite: page.isFavorite,
      children: [],
      createdAt: page.createdAt,
      updatedAt: page.updatedAt,
    });
  }

  // Build tree structure
  for (const page of pages) {
    const node = pageMap.get(page.id)!;
    if (page.parentId && pageMap.has(page.parentId)) {
      pageMap.get(page.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

async function addToSyncQueue(
  entityType: string,
  entityId: string,
  operation: string,
  payload: unknown
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO sync_queue (entity_type, entity_id, operation, payload, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [entityType, entityId, operation, JSON.stringify(payload), now()]
  );
}

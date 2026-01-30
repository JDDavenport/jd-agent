import { getDatabase, generateId, now } from './client';
import type {
  VaultBlock,
  VaultBlockType,
  VaultBlockContent,
  CreateVaultBlockInput,
  UpdateVaultBlockInput,
  BatchBlockOperation,
} from '../types';

interface BlockRow {
  id: string;
  page_id: string;
  parent_block_id: string | null;
  type: string;
  content: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
  sync_status: string;
  server_version: number;
  local_version: number;
}

function rowToBlock(row: BlockRow): VaultBlock {
  return {
    id: row.id,
    pageId: row.page_id,
    parentBlockId: row.parent_block_id,
    type: row.type as VaultBlockType,
    content: JSON.parse(row.content) as VaultBlockContent,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const blockRepository = {
  async getByPageId(pageId: string): Promise<VaultBlock[]> {
    const db = await getDatabase();
    const rows = await db.select<BlockRow[]>(
      'SELECT * FROM vault_blocks WHERE page_id = ? ORDER BY sort_order',
      [pageId]
    );
    return rows.map(rowToBlock);
  },

  async getById(id: string): Promise<VaultBlock | null> {
    const db = await getDatabase();
    const rows = await db.select<BlockRow[]>(
      'SELECT * FROM vault_blocks WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? rowToBlock(rows[0]) : null;
  },

  async getChildren(parentBlockId: string): Promise<VaultBlock[]> {
    const db = await getDatabase();
    const rows = await db.select<BlockRow[]>(
      'SELECT * FROM vault_blocks WHERE parent_block_id = ? ORDER BY sort_order',
      [parentBlockId]
    );
    return rows.map(rowToBlock);
  },

  async create(pageId: string, input: CreateVaultBlockInput): Promise<VaultBlock> {
    const db = await getDatabase();
    const id = generateId();
    const timestamp = now();

    // Calculate sort order
    let sortOrder = 0;
    if (input.afterBlockId) {
      const afterBlock = await this.getById(input.afterBlockId);
      if (afterBlock) {
        sortOrder = afterBlock.sortOrder + 1;
        // Shift subsequent blocks
        await db.execute(
          `UPDATE vault_blocks SET sort_order = sort_order + 1
           WHERE page_id = ? AND parent_block_id IS ? AND sort_order >= ?`,
          [pageId, input.parentBlockId ?? null, sortOrder]
        );
      }
    } else {
      // Add at end
      const maxOrderRows = await db.select<{ max_order: number | null }[]>(
        `SELECT MAX(sort_order) as max_order FROM vault_blocks
         WHERE page_id = ? AND parent_block_id IS ?`,
        [pageId, input.parentBlockId ?? null]
      );
      sortOrder = (maxOrderRows[0]?.max_order ?? -1) + 1;
    }

    await db.execute(
      `INSERT INTO vault_blocks (id, page_id, parent_block_id, type, content, sort_order, created_at, updated_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        id,
        pageId,
        input.parentBlockId ?? null,
        input.type,
        JSON.stringify(input.content),
        sortOrder,
        timestamp,
        timestamp,
      ]
    );

    // Add to sync queue
    await addToSyncQueue('block', id, 'create', { pageId, ...input });

    return (await this.getById(id))!;
  },

  async update(id: string, input: UpdateVaultBlockInput): Promise<VaultBlock | null> {
    const db = await getDatabase();
    const existing = await this.getById(id);
    if (!existing) return null;

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    if (input.type !== undefined) {
      updates.push('type = ?');
      values.push(input.type);
    }
    if (input.content !== undefined) {
      updates.push('content = ?');
      values.push(JSON.stringify(input.content));
    }

    if (updates.length === 0) return existing;

    updates.push('updated_at = ?');
    values.push(now());
    updates.push('sync_status = ?');
    values.push('pending');
    updates.push('local_version = local_version + 1');
    values.push(id);

    await db.execute(
      `UPDATE vault_blocks SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Add to sync queue
    await addToSyncQueue('block', id, 'update', input);

    return this.getById(id);
  },

  async delete(id: string): Promise<boolean> {
    const db = await getDatabase();
    const existing = await this.getById(id);
    if (!existing) return false;

    // Delete the block and all children (cascade handled by SQLite)
    await db.execute('DELETE FROM vault_blocks WHERE id = ?', [id]);

    // Add to sync queue
    await addToSyncQueue('block', id, 'delete', { pageId: existing.pageId });

    return true;
  },

  async move(
    id: string,
    targetPageId?: string,
    targetParentBlockId?: string | null,
    afterBlockId?: string | null
  ): Promise<VaultBlock | null> {
    const db = await getDatabase();
    const existing = await this.getById(id);
    if (!existing) return null;

    const pageId = targetPageId ?? existing.pageId;
    const parentBlockId = targetParentBlockId !== undefined ? targetParentBlockId : existing.parentBlockId;

    // Calculate new sort order
    let sortOrder = 0;
    if (afterBlockId) {
      const afterBlock = await this.getById(afterBlockId);
      if (afterBlock) {
        sortOrder = afterBlock.sortOrder + 1;
        await db.execute(
          `UPDATE vault_blocks SET sort_order = sort_order + 1
           WHERE page_id = ? AND parent_block_id IS ? AND sort_order >= ?`,
          [pageId, parentBlockId ?? null, sortOrder]
        );
      }
    } else {
      const maxOrderRows = await db.select<{ max_order: number | null }[]>(
        `SELECT MAX(sort_order) as max_order FROM vault_blocks
         WHERE page_id = ? AND parent_block_id IS ?`,
        [pageId, parentBlockId ?? null]
      );
      sortOrder = (maxOrderRows[0]?.max_order ?? -1) + 1;
    }

    await db.execute(
      `UPDATE vault_blocks SET page_id = ?, parent_block_id = ?, sort_order = ?, updated_at = ?, sync_status = 'pending'
       WHERE id = ?`,
      [pageId, parentBlockId ?? null, sortOrder, now(), id]
    );

    // Add to sync queue
    await addToSyncQueue('block', id, 'move', {
      pageId,
      parentBlockId,
      afterBlockId,
    });

    return this.getById(id);
  },

  async batchOperations(pageId: string, operations: BatchBlockOperation[]): Promise<VaultBlock[]> {
    const results: VaultBlock[] = [];

    for (const op of operations) {
      switch (op.op) {
        case 'create': {
          if (op.data && 'type' in op.data) {
            const block = await this.create(pageId, op.data as CreateVaultBlockInput);
            results.push(block);
          }
          break;
        }
        case 'update': {
          if (op.blockId && op.data) {
            const block = await this.update(op.blockId, op.data as UpdateVaultBlockInput);
            if (block) results.push(block);
          }
          break;
        }
        case 'delete': {
          if (op.blockId) {
            await this.delete(op.blockId);
          }
          break;
        }
        case 'move': {
          if (op.blockId && op.data && 'parentBlockId' in op.data) {
            const moveData = op.data as { pageId?: string; parentBlockId?: string | null; afterBlockId?: string | null };
            const block = await this.move(
              op.blockId,
              moveData.pageId,
              moveData.parentBlockId,
              moveData.afterBlockId
            );
            if (block) results.push(block);
          }
          break;
        }
      }
    }

    return results;
  },

  // Sync-related methods
  async getPendingChanges(): Promise<VaultBlock[]> {
    const db = await getDatabase();
    const rows = await db.select<BlockRow[]>(
      "SELECT * FROM vault_blocks WHERE sync_status = 'pending'"
    );
    return rows.map(rowToBlock);
  },

  async markSynced(id: string, serverVersion: number): Promise<void> {
    const db = await getDatabase();
    await db.execute(
      `UPDATE vault_blocks SET sync_status = 'synced', server_version = ? WHERE id = ?`,
      [serverVersion, id]
    );
  },

  async upsertFromServer(block: VaultBlock & { serverVersion?: number }): Promise<void> {
    const db = await getDatabase();
    const existing = await this.getById(block.id);

    if (!existing) {
      await db.execute(
        `INSERT INTO vault_blocks (id, page_id, parent_block_id, type, content, sort_order, created_at, updated_at, sync_status, server_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
        [
          block.id,
          block.pageId,
          block.parentBlockId ?? null,
          block.type,
          JSON.stringify(block.content),
          block.sortOrder,
          block.createdAt,
          block.updatedAt,
          block.serverVersion ?? 1,
        ]
      );
    } else {
      await db.execute(
        `UPDATE vault_blocks SET
          page_id = ?, parent_block_id = ?, type = ?, content = ?,
          sort_order = ?, updated_at = ?, sync_status = 'synced', server_version = ?
         WHERE id = ? AND sync_status = 'synced'`,
        [
          block.pageId,
          block.parentBlockId ?? null,
          block.type,
          JSON.stringify(block.content),
          block.sortOrder,
          block.updatedAt,
          block.serverVersion ?? 1,
          block.id,
        ]
      );
    }
  },

  async deleteAllForPage(pageId: string): Promise<void> {
    const db = await getDatabase();
    await db.execute('DELETE FROM vault_blocks WHERE page_id = ?', [pageId]);
  },
};

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

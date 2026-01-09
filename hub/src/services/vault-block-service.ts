import { eq, and, asc, sql, gt, gte, lt } from 'drizzle-orm';
import { db } from '../db/client';
import { vaultBlocks, vaultPages } from '../db/schema';
import type {
  VaultBlock,
  VaultBlockType,
  VaultBlockContent,
  CreateVaultBlockInput,
  UpdateVaultBlockInput,
  MoveVaultBlockInput,
  BatchBlockOperation,
} from '@jd-agent/types';

// ============================================
// Vault Block Service
// ============================================

export class VaultBlockService {
  /**
   * Create a new block
   */
  async create(pageId: string, input: CreateVaultBlockInput): Promise<VaultBlock> {
    // Verify page exists
    const [page] = await db
      .select({ id: vaultPages.id })
      .from(vaultPages)
      .where(eq(vaultPages.id, pageId))
      .limit(1);

    if (!page) {
      throw new Error('Page not found');
    }

    // Determine sort order
    let sortOrder: number;

    if (input.afterBlockId) {
      // Insert after specific block
      const [afterBlock] = await db
        .select({ sortOrder: vaultBlocks.sortOrder, parentBlockId: vaultBlocks.parentBlockId })
        .from(vaultBlocks)
        .where(eq(vaultBlocks.id, input.afterBlockId))
        .limit(1);

      if (afterBlock) {
        sortOrder = afterBlock.sortOrder + 1;
        // Shift subsequent blocks
        await db
          .update(vaultBlocks)
          .set({ sortOrder: sql`${vaultBlocks.sortOrder} + 1` })
          .where(
            and(
              eq(vaultBlocks.pageId, pageId),
              input.parentBlockId
                ? eq(vaultBlocks.parentBlockId, input.parentBlockId)
                : sql`${vaultBlocks.parentBlockId} IS NULL`,
              gt(vaultBlocks.sortOrder, afterBlock.sortOrder)
            )
          );
      } else {
        sortOrder = 0;
      }
    } else {
      // Append at end
      const maxSortResult = await db
        .select({ maxSort: sql<number>`COALESCE(MAX(${vaultBlocks.sortOrder}), -1)` })
        .from(vaultBlocks)
        .where(
          and(
            eq(vaultBlocks.pageId, pageId),
            input.parentBlockId
              ? eq(vaultBlocks.parentBlockId, input.parentBlockId)
              : sql`${vaultBlocks.parentBlockId} IS NULL`
          )
        );

      sortOrder = (maxSortResult[0]?.maxSort ?? -1) + 1;
    }

    const [block] = await db
      .insert(vaultBlocks)
      .values({
        pageId,
        parentBlockId: input.parentBlockId || null,
        type: input.type,
        content: input.content,
        sortOrder,
      })
      .returning();

    // Update page's updatedAt
    await db
      .update(vaultPages)
      .set({ updatedAt: new Date() })
      .where(eq(vaultPages.id, pageId));

    return this.formatBlock(block);
  }

  /**
   * Get a block by ID
   */
  async getById(id: string): Promise<VaultBlock | null> {
    const [block] = await db
      .select()
      .from(vaultBlocks)
      .where(eq(vaultBlocks.id, id))
      .limit(1);

    if (!block) return null;
    return this.formatBlock(block);
  }

  /**
   * Get all blocks for a page
   */
  async getByPage(pageId: string): Promise<VaultBlock[]> {
    const blocks = await db
      .select()
      .from(vaultBlocks)
      .where(eq(vaultBlocks.pageId, pageId))
      .orderBy(asc(vaultBlocks.sortOrder));

    return blocks.map(b => this.formatBlock(b));
  }

  /**
   * Get child blocks (for nested blocks like toggle)
   */
  async getChildren(parentBlockId: string): Promise<VaultBlock[]> {
    const blocks = await db
      .select()
      .from(vaultBlocks)
      .where(eq(vaultBlocks.parentBlockId, parentBlockId))
      .orderBy(asc(vaultBlocks.sortOrder));

    return blocks.map(b => this.formatBlock(b));
  }

  /**
   * Update a block
   */
  async update(id: string, input: UpdateVaultBlockInput): Promise<VaultBlock | null> {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.type !== undefined) updateData.type = input.type;
    if (input.content !== undefined) updateData.content = input.content;

    const [updated] = await db
      .update(vaultBlocks)
      .set(updateData)
      .where(eq(vaultBlocks.id, id))
      .returning();

    if (!updated) return null;

    // Update page's updatedAt
    await db
      .update(vaultPages)
      .set({ updatedAt: new Date() })
      .where(eq(vaultPages.id, updated.pageId));

    return this.formatBlock(updated);
  }

  /**
   * Delete a block
   */
  async delete(id: string): Promise<boolean> {
    const [block] = await db
      .select({ pageId: vaultBlocks.pageId, sortOrder: vaultBlocks.sortOrder, parentBlockId: vaultBlocks.parentBlockId })
      .from(vaultBlocks)
      .where(eq(vaultBlocks.id, id))
      .limit(1);

    if (!block) return false;

    // Delete nested blocks first (they'll cascade, but we want to be explicit)
    await db
      .delete(vaultBlocks)
      .where(eq(vaultBlocks.parentBlockId, id));

    // Delete the block
    const result = await db
      .delete(vaultBlocks)
      .where(eq(vaultBlocks.id, id))
      .returning();

    if (result.length > 0) {
      // Reorder remaining blocks
      await db
        .update(vaultBlocks)
        .set({ sortOrder: sql`${vaultBlocks.sortOrder} - 1` })
        .where(
          and(
            eq(vaultBlocks.pageId, block.pageId),
            block.parentBlockId
              ? eq(vaultBlocks.parentBlockId, block.parentBlockId)
              : sql`${vaultBlocks.parentBlockId} IS NULL`,
            gt(vaultBlocks.sortOrder, block.sortOrder)
          )
        );

      // Update page's updatedAt
      await db
        .update(vaultPages)
        .set({ updatedAt: new Date() })
        .where(eq(vaultPages.id, block.pageId));
    }

    return result.length > 0;
  }

  /**
   * Move a block to a new position
   */
  async move(id: string, input: MoveVaultBlockInput): Promise<VaultBlock | null> {
    const [block] = await db
      .select()
      .from(vaultBlocks)
      .where(eq(vaultBlocks.id, id))
      .limit(1);

    if (!block) return null;

    const targetPageId = input.pageId || block.pageId;
    const targetParentBlockId = input.parentBlockId ?? block.parentBlockId;

    // If moving to different page, verify page exists
    if (input.pageId && input.pageId !== block.pageId) {
      const [targetPage] = await db
        .select({ id: vaultPages.id })
        .from(vaultPages)
        .where(eq(vaultPages.id, input.pageId))
        .limit(1);

      if (!targetPage) {
        throw new Error('Target page not found');
      }
    }

    // Remove from current position
    await db
      .update(vaultBlocks)
      .set({ sortOrder: sql`${vaultBlocks.sortOrder} - 1` })
      .where(
        and(
          eq(vaultBlocks.pageId, block.pageId),
          block.parentBlockId
            ? eq(vaultBlocks.parentBlockId, block.parentBlockId)
            : sql`${vaultBlocks.parentBlockId} IS NULL`,
          gt(vaultBlocks.sortOrder, block.sortOrder)
        )
      );

    // Determine new sort order
    let newSortOrder: number;

    if (input.afterBlockId) {
      const [afterBlock] = await db
        .select({ sortOrder: vaultBlocks.sortOrder })
        .from(vaultBlocks)
        .where(eq(vaultBlocks.id, input.afterBlockId))
        .limit(1);

      if (afterBlock) {
        newSortOrder = afterBlock.sortOrder + 1;
        // Shift blocks after target position
        await db
          .update(vaultBlocks)
          .set({ sortOrder: sql`${vaultBlocks.sortOrder} + 1` })
          .where(
            and(
              eq(vaultBlocks.pageId, targetPageId),
              targetParentBlockId
                ? eq(vaultBlocks.parentBlockId, targetParentBlockId)
                : sql`${vaultBlocks.parentBlockId} IS NULL`,
              gte(vaultBlocks.sortOrder, afterBlock.sortOrder + 1)
            )
          );
      } else {
        newSortOrder = 0;
      }
    } else {
      // Move to beginning
      await db
        .update(vaultBlocks)
        .set({ sortOrder: sql`${vaultBlocks.sortOrder} + 1` })
        .where(
          and(
            eq(vaultBlocks.pageId, targetPageId),
            targetParentBlockId
              ? eq(vaultBlocks.parentBlockId, targetParentBlockId)
              : sql`${vaultBlocks.parentBlockId} IS NULL`
          )
        );
      newSortOrder = 0;
    }

    // Update block position
    const [updated] = await db
      .update(vaultBlocks)
      .set({
        pageId: targetPageId,
        parentBlockId: targetParentBlockId,
        sortOrder: newSortOrder,
        updatedAt: new Date(),
      })
      .where(eq(vaultBlocks.id, id))
      .returning();

    // Update page timestamps
    await db
      .update(vaultPages)
      .set({ updatedAt: new Date() })
      .where(eq(vaultPages.id, block.pageId));

    if (targetPageId !== block.pageId) {
      await db
        .update(vaultPages)
        .set({ updatedAt: new Date() })
        .where(eq(vaultPages.id, targetPageId));
    }

    return updated ? this.formatBlock(updated) : null;
  }

  /**
   * Reorder blocks within a parent
   */
  async reorder(pageId: string, blockIds: string[]): Promise<void> {
    for (let i = 0; i < blockIds.length; i++) {
      await db
        .update(vaultBlocks)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(and(eq(vaultBlocks.id, blockIds[i]), eq(vaultBlocks.pageId, pageId)));
    }

    // Update page's updatedAt
    await db
      .update(vaultPages)
      .set({ updatedAt: new Date() })
      .where(eq(vaultPages.id, pageId));
  }

  /**
   * Batch operations for performance
   */
  async batch(pageId: string, operations: BatchBlockOperation[]): Promise<VaultBlock[]> {
    const results: VaultBlock[] = [];

    for (const op of operations) {
      switch (op.op) {
        case 'create':
          if (op.data && 'type' in op.data) {
            const created = await this.create(pageId, op.data as CreateVaultBlockInput);
            results.push(created);
          }
          break;

        case 'update':
          if (op.blockId && op.data) {
            const updated = await this.update(op.blockId, op.data as UpdateVaultBlockInput);
            if (updated) results.push(updated);
          }
          break;

        case 'delete':
          if (op.blockId) {
            await this.delete(op.blockId);
          }
          break;

        case 'move':
          if (op.blockId && op.data) {
            const moved = await this.move(op.blockId, op.data as MoveVaultBlockInput);
            if (moved) results.push(moved);
          }
          break;
      }
    }

    return results;
  }

  /**
   * Set parent for nesting (indent/outdent)
   */
  async setParent(blockId: string, parentBlockId: string | null): Promise<VaultBlock | null> {
    const [block] = await db
      .select()
      .from(vaultBlocks)
      .where(eq(vaultBlocks.id, blockId))
      .limit(1);

    if (!block) return null;

    // Verify parent is in same page
    if (parentBlockId) {
      const [parentBlock] = await db
        .select({ pageId: vaultBlocks.pageId })
        .from(vaultBlocks)
        .where(eq(vaultBlocks.id, parentBlockId))
        .limit(1);

      if (!parentBlock || parentBlock.pageId !== block.pageId) {
        throw new Error('Parent block must be in the same page');
      }
    }

    // Get new sort order at end of parent's children
    const maxSortResult = await db
      .select({ maxSort: sql<number>`COALESCE(MAX(${vaultBlocks.sortOrder}), -1)` })
      .from(vaultBlocks)
      .where(
        and(
          eq(vaultBlocks.pageId, block.pageId),
          parentBlockId
            ? eq(vaultBlocks.parentBlockId, parentBlockId)
            : sql`${vaultBlocks.parentBlockId} IS NULL`
        )
      );

    const newSortOrder = (maxSortResult[0]?.maxSort ?? -1) + 1;

    const [updated] = await db
      .update(vaultBlocks)
      .set({
        parentBlockId,
        sortOrder: newSortOrder,
        updatedAt: new Date(),
      })
      .where(eq(vaultBlocks.id, blockId))
      .returning();

    // Update page's updatedAt
    await db
      .update(vaultPages)
      .set({ updatedAt: new Date() })
      .where(eq(vaultPages.id, block.pageId));

    return updated ? this.formatBlock(updated) : null;
  }

  // ============================================
  // Helpers
  // ============================================

  private formatBlock(block: typeof vaultBlocks.$inferSelect): VaultBlock {
    return {
      id: block.id,
      pageId: block.pageId,
      parentBlockId: block.parentBlockId,
      type: block.type as VaultBlockType,
      content: block.content as VaultBlockContent,
      sortOrder: block.sortOrder,
      createdAt: block.createdAt.toISOString(),
      updatedAt: block.updatedAt.toISOString(),
    };
  }
}

// Export singleton instance
export const vaultBlockService = new VaultBlockService();

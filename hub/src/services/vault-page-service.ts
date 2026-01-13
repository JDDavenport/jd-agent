import { eq, and, desc, asc, sql, ilike, isNull } from 'drizzle-orm';
import { db } from '../db/client';
import { vaultPages, vaultBlocks, vaultReferences } from '../db/schema';
import type {
  VaultPage,
  VaultPageTreeNode,
  VaultPageBreadcrumb,
  CreateVaultPageInput,
  UpdateVaultPageInput,
  PARAType,
} from '@jd-agent/types';

// ============================================
// PARA Folder Configuration
// ============================================

export const PARA_FOLDERS: Array<{ type: PARAType; title: string; icon: string; description: string }> = [
  { type: 'projects', title: 'Projects', icon: '📁', description: 'Active projects with deadlines and goals' },
  { type: 'areas', title: 'Areas', icon: '🏠', description: 'Ongoing areas of responsibility' },
  { type: 'resources', title: 'Resources', icon: '📚', description: 'Reference materials and information' },
  { type: 'archive', title: 'Archive', icon: '📦', description: 'Inactive items for future reference' },
];

// ============================================
// Types
// ============================================

export interface VaultPageWithBlocks extends VaultPage {
  blocks?: VaultBlock[];
}

interface VaultBlock {
  id: string;
  pageId: string;
  parentBlockId: string | null;
  type: string;
  content: Record<string, unknown>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Vault Page Service
// ============================================

export class VaultPageService {
  /**
   * Create a new vault page
   */
  async create(input: CreateVaultPageInput): Promise<VaultPage> {
    // Get the max sort order for the parent
    const maxSortResult = await db
      .select({ maxSort: sql<number>`COALESCE(MAX(${vaultPages.sortOrder}), -1)` })
      .from(vaultPages)
      .where(
        input.parentId
          ? eq(vaultPages.parentId, input.parentId)
          : isNull(vaultPages.parentId)
      );

    const nextSortOrder = (maxSortResult[0]?.maxSort ?? -1) + 1;

    const [page] = await db
      .insert(vaultPages)
      .values({
        title: input.title || 'Untitled',
        parentId: input.parentId || null,
        icon: input.icon || null,
        coverImage: input.coverImage || null,
        sortOrder: nextSortOrder,
      })
      .returning();

    return this.formatPage(page);
  }

  /**
   * Get a vault page by ID
   */
  async getById(id: string): Promise<VaultPage | null> {
    const [page] = await db
      .select()
      .from(vaultPages)
      .where(eq(vaultPages.id, id))
      .limit(1);

    if (!page) return null;

    // Update last viewed timestamp
    await db
      .update(vaultPages)
      .set({ lastViewedAt: new Date() })
      .where(eq(vaultPages.id, id));

    return this.formatPage(page);
  }

  /**
   * Get a vault page with its blocks
   */
  async getByIdWithBlocks(id: string): Promise<VaultPageWithBlocks | null> {
    const page = await this.getById(id);
    if (!page) return null;

    const blocks = await db
      .select()
      .from(vaultBlocks)
      .where(eq(vaultBlocks.pageId, id))
      .orderBy(asc(vaultBlocks.sortOrder));

    return {
      ...page,
      blocks: blocks.map(b => ({
        id: b.id,
        pageId: b.pageId,
        parentBlockId: b.parentBlockId,
        type: b.type,
        content: b.content as Record<string, unknown>,
        sortOrder: b.sortOrder,
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      })),
    };
  }

  /**
   * List all vault pages
   */
  async list(options: { archived?: boolean } = {}): Promise<VaultPage[]> {
    const conditions = [];

    if (options.archived !== undefined) {
      conditions.push(eq(vaultPages.isArchived, options.archived));
    }

    const pages = await db
      .select()
      .from(vaultPages)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(vaultPages.sortOrder), desc(vaultPages.updatedAt));

    return pages.map(p => this.formatPage(p));
  }

  /**
   * Update a vault page
   */
  async update(id: string, input: UpdateVaultPageInput): Promise<VaultPage | null> {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.title !== undefined) updateData.title = input.title;
    if (input.icon !== undefined) updateData.icon = input.icon;
    if (input.coverImage !== undefined) updateData.coverImage = input.coverImage;
    if (input.isFavorite !== undefined) updateData.isFavorite = input.isFavorite;
    if (input.isArchived !== undefined) updateData.isArchived = input.isArchived;
    if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;

    // Handle parent change with circular reference check
    if (input.parentId !== undefined) {
      if (input.parentId !== null) {
        const breadcrumb = await this.getBreadcrumb(input.parentId);
        if (breadcrumb.some(b => b.id === id)) {
          throw new Error('Cannot move page into its own descendant');
        }
      }
      updateData.parentId = input.parentId;
    }

    const [updated] = await db
      .update(vaultPages)
      .set(updateData)
      .where(eq(vaultPages.id, id))
      .returning();

    if (!updated) return null;
    return this.formatPage(updated);
  }

  /**
   * Delete a vault page (also deletes all blocks via cascade)
   */
  async delete(id: string): Promise<boolean> {
    // Check if page exists and if it's a system page
    const [page] = await db
      .select({ parentId: vaultPages.parentId, isSystem: vaultPages.isSystem })
      .from(vaultPages)
      .where(eq(vaultPages.id, id))
      .limit(1);

    if (!page) return false;

    // Prevent deleting system pages (PARA root folders)
    if (page.isSystem) {
      throw new Error('Cannot delete system page (PARA folder)');
    }

    // Update children's parentId
    await db
      .update(vaultPages)
      .set({ parentId: page.parentId, updatedAt: new Date() })
      .where(eq(vaultPages.parentId, id));

    // Delete the page (blocks cascade automatically)
    const result = await db
      .delete(vaultPages)
      .where(eq(vaultPages.id, id))
      .returning();

    return result.length > 0;
  }

  // ============================================
  // Hierarchy Methods
  // ============================================

  /**
   * Get hierarchical tree of vault pages
   */
  async getTree(options: { archived?: boolean } = {}): Promise<VaultPageTreeNode[]> {
    const conditions = [];
    if (options.archived !== undefined) {
      conditions.push(eq(vaultPages.isArchived, options.archived));
    }

    const allPages = await db
      .select({
        id: vaultPages.id,
        title: vaultPages.title,
        icon: vaultPages.icon,
        parentId: vaultPages.parentId,
        isFavorite: vaultPages.isFavorite,
        paraType: vaultPages.paraType,
        isSystem: vaultPages.isSystem,
        sortOrder: vaultPages.sortOrder,
        createdAt: vaultPages.createdAt,
        updatedAt: vaultPages.updatedAt,
      })
      .from(vaultPages)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(vaultPages.sortOrder), asc(vaultPages.title));

    // Build tree structure
    const nodeMap = new Map<string, VaultPageTreeNode>();
    const rootNodes: VaultPageTreeNode[] = [];

    // First pass: create all nodes
    for (const page of allPages) {
      nodeMap.set(page.id, {
        id: page.id,
        title: page.title,
        icon: page.icon,
        parentId: page.parentId,
        isFavorite: page.isFavorite,
        paraType: page.paraType as PARAType | null,
        isSystem: page.isSystem,
        children: [],
        createdAt: page.createdAt.toISOString(),
        updatedAt: page.updatedAt.toISOString(),
      });
    }

    // Second pass: build tree
    for (const page of allPages) {
      const node = nodeMap.get(page.id)!;
      if (page.parentId && nodeMap.has(page.parentId)) {
        nodeMap.get(page.parentId)!.children.push(node);
      } else {
        rootNodes.push(node);
      }
    }

    return rootNodes;
  }

  /**
   * Get direct children of a page
   */
  async getChildren(parentId: string | null): Promise<VaultPage[]> {
    const condition = parentId
      ? eq(vaultPages.parentId, parentId)
      : isNull(vaultPages.parentId);

    const pages = await db
      .select()
      .from(vaultPages)
      .where(and(condition, eq(vaultPages.isArchived, false)))
      .orderBy(asc(vaultPages.sortOrder), asc(vaultPages.title));

    return pages.map(p => this.formatPage(p));
  }

  /**
   * Get breadcrumb trail from root to specified page
   */
  async getBreadcrumb(id: string): Promise<VaultPageBreadcrumb[]> {
    const breadcrumb: VaultPageBreadcrumb[] = [];
    let currentId: string | null = id;

    // Walk up the tree (max 20 levels to prevent infinite loops)
    for (let i = 0; i < 20 && currentId; i++) {
      const [page] = await db
        .select({
          id: vaultPages.id,
          title: vaultPages.title,
          icon: vaultPages.icon,
          parentId: vaultPages.parentId,
        })
        .from(vaultPages)
        .where(eq(vaultPages.id, currentId))
        .limit(1);

      if (!page) break;

      breadcrumb.unshift({
        id: page.id,
        title: page.title,
        icon: page.icon,
      });

      currentId = page.parentId;
    }

    return breadcrumb;
  }

  /**
   * Move a page to a new parent
   */
  async move(id: string, newParentId: string | null): Promise<VaultPage | null> {
    return this.update(id, { parentId: newParentId });
  }

  /**
   * Reorder pages within a parent
   */
  async reorder(pageIds: string[]): Promise<void> {
    for (let i = 0; i < pageIds.length; i++) {
      await db
        .update(vaultPages)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(eq(vaultPages.id, pageIds[i]));
    }
  }

  // ============================================
  // Favorites
  // ============================================

  /**
   * Toggle favorite status
   */
  async toggleFavorite(id: string): Promise<VaultPage | null> {
    const [page] = await db
      .select({ isFavorite: vaultPages.isFavorite })
      .from(vaultPages)
      .where(eq(vaultPages.id, id))
      .limit(1);

    if (!page) return null;

    return this.update(id, { isFavorite: !page.isFavorite });
  }

  /**
   * Get all favorite pages
   */
  async getFavorites(): Promise<VaultPage[]> {
    const pages = await db
      .select()
      .from(vaultPages)
      .where(and(eq(vaultPages.isFavorite, true), eq(vaultPages.isArchived, false)))
      .orderBy(asc(vaultPages.sortOrder), desc(vaultPages.updatedAt));

    return pages.map(p => this.formatPage(p));
  }

  // ============================================
  // Search
  // ============================================

  /**
   * Quick search for pages by title
   */
  async quickFind(query: string, limit = 10): Promise<VaultPage[]> {
    const searchPattern = `%${query}%`;

    const pages = await db
      .select()
      .from(vaultPages)
      .where(
        and(
          ilike(vaultPages.title, searchPattern),
          eq(vaultPages.isArchived, false)
        )
      )
      .orderBy(desc(vaultPages.updatedAt))
      .limit(limit);

    return pages.map(p => this.formatPage(p));
  }

  // ============================================
  // PARA Folder Methods
  // ============================================

  /**
   * Initialize PARA root folders if they don't exist
   */
  async initializePARA(): Promise<{ created: number; existing: number }> {
    let created = 0;
    let existing = 0;

    for (let i = 0; i < PARA_FOLDERS.length; i++) {
      const folder = PARA_FOLDERS[i];

      // Check if PARA folder already exists
      const [existingFolder] = await db
        .select()
        .from(vaultPages)
        .where(
          and(
            eq(vaultPages.paraType, folder.type),
            eq(vaultPages.isSystem, true),
            isNull(vaultPages.parentId)
          )
        )
        .limit(1);

      if (existingFolder) {
        existing++;
        continue;
      }

      // Create the PARA folder
      await db.insert(vaultPages).values({
        title: folder.title,
        icon: folder.icon,
        paraType: folder.type,
        isSystem: true,
        sortOrder: i,
        parentId: null,
      });
      created++;
    }

    return { created, existing };
  }

  /**
   * Get PARA root folders
   */
  async getPARAFolders(): Promise<VaultPage[]> {
    const folders = await db
      .select()
      .from(vaultPages)
      .where(
        and(
          eq(vaultPages.isSystem, true),
          isNull(vaultPages.parentId)
        )
      )
      .orderBy(asc(vaultPages.sortOrder));

    return folders.map(p => this.formatPage(p));
  }

  /**
   * Get pages by PARA type (including nested pages)
   */
  async listByPARAType(paraType: PARAType): Promise<VaultPage[]> {
    // First get the PARA root folder
    const [rootFolder] = await db
      .select()
      .from(vaultPages)
      .where(
        and(
          eq(vaultPages.paraType, paraType),
          eq(vaultPages.isSystem, true),
          isNull(vaultPages.parentId)
        )
      )
      .limit(1);

    if (!rootFolder) return [];

    // Get all direct children of this PARA folder
    const pages = await db
      .select()
      .from(vaultPages)
      .where(
        and(
          eq(vaultPages.parentId, rootFolder.id),
          eq(vaultPages.isArchived, false)
        )
      )
      .orderBy(asc(vaultPages.sortOrder), desc(vaultPages.updatedAt));

    return pages.map(p => this.formatPage(p));
  }

  /**
   * Move a page to a PARA folder
   */
  async moveToPARA(pageId: string, paraType: PARAType): Promise<VaultPage | null> {
    // Get the PARA root folder
    const [rootFolder] = await db
      .select({ id: vaultPages.id })
      .from(vaultPages)
      .where(
        and(
          eq(vaultPages.paraType, paraType),
          eq(vaultPages.isSystem, true),
          isNull(vaultPages.parentId)
        )
      )
      .limit(1);

    if (!rootFolder) {
      throw new Error(`PARA folder "${paraType}" not initialized`);
    }

    return this.update(pageId, { parentId: rootFolder.id });
  }

  // ============================================
  // Helpers
  // ============================================

  /**
   * Get backlinks - pages that link to this page
   */
  async getBacklinks(pageId: string): Promise<Array<{ id: string; title: string; icon: string | null }>> {
    const references = await db
      .select({
        pageId: vaultReferences.pageId,
        pageTitle: vaultPages.title,
        pageIcon: vaultPages.icon,
      })
      .from(vaultReferences)
      .innerJoin(vaultPages, eq(vaultReferences.pageId, vaultPages.id))
      .where(
        and(
          eq(vaultReferences.targetType, 'page'),
          eq(vaultReferences.targetId, pageId)
        )
      )
      .orderBy(desc(vaultPages.updatedAt));

    // Deduplicate by page ID (a page might link multiple times)
    const uniquePages = new Map<string, { id: string; title: string; icon: string | null }>();
    for (const ref of references) {
      if (!uniquePages.has(ref.pageId)) {
        uniquePages.set(ref.pageId, {
          id: ref.pageId,
          title: ref.pageTitle,
          icon: ref.pageIcon,
        });
      }
    }

    return Array.from(uniquePages.values());
  }

  // ============================================
  // Private Helpers
  // ============================================

  private formatPage(page: typeof vaultPages.$inferSelect): VaultPage {
    return {
      id: page.id,
      parentId: page.parentId,
      title: page.title,
      icon: page.icon,
      coverImage: page.coverImage,
      isFavorite: page.isFavorite,
      isArchived: page.isArchived,
      sortOrder: page.sortOrder,
      paraType: page.paraType as PARAType | null,
      isSystem: page.isSystem,
      legacyEntryId: page.legacyEntryId,
      createdAt: page.createdAt.toISOString(),
      updatedAt: page.updatedAt.toISOString(),
      lastViewedAt: page.lastViewedAt?.toISOString() || null,
    };
  }
}

// Export singleton instance
export const vaultPageService = new VaultPageService();

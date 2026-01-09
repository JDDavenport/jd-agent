import { eq, and, or, desc, asc, sql, ilike, arrayContains, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { vaultEntries, vaultEmbeddings, recordings } from '../db/schema';
import type { VaultContentType, VaultSource } from '../types';

// ============================================
// Types
// ============================================

export interface CreateVaultEntryInput {
  title: string;
  content?: string;
  contentType: VaultContentType;
  context: string;
  tags?: string[];
  source: VaultSource;
  sourceRef?: string;
  recordingId?: string;
  relatedEntries?: string[];
  sourceDate?: Date;
}

export interface UpdateVaultEntryInput {
  title?: string;
  content?: string;
  contentType?: VaultContentType;
  context?: string;
  tags?: string[];
  sourceRef?: string;
  relatedEntries?: string[];
}

export interface VaultFilters {
  context?: string;
  contentType?: VaultContentType;
  source?: VaultSource;
  tags?: string[];
  fromDate?: Date;
  toDate?: Date;
  recordingId?: string;
}

export interface SearchOptions {
  query: string;
  context?: string;
  contentType?: VaultContentType;
  limit?: number;
}

export interface VaultEntryWithRecording {
  id: string;
  title: string;
  content: string | null;
  contentType: string;
  context: string;
  tags: string[] | null;
  source: string;
  sourceRef: string | null;
  recordingId: string | null;
  relatedEntries: string[] | null;
  sourceDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  recording?: {
    id: string;
    originalFilename: string | null;
    recordingType: string;
    recordedAt: Date | null;
  } | null;
}

export interface VaultTreeNode {
  id: string;
  title: string;
  contentType: string;
  context: string;
  parentId: string | null;
  children: VaultTreeNode[];
  createdAt: Date;
  updatedAt: Date;
}

export interface VaultBreadcrumb {
  id: string;
  title: string;
}

// ============================================
// Vault Service
// ============================================

export class VaultService {
  /**
   * Create a new vault entry
   */
  async create(input: CreateVaultEntryInput): Promise<VaultEntryWithRecording> {
    const [entry] = await db
      .insert(vaultEntries)
      .values({
        title: input.title,
        content: input.content,
        contentType: input.contentType,
        context: input.context,
        tags: input.tags || [],
        source: input.source,
        sourceRef: input.sourceRef,
        recordingId: input.recordingId,
        relatedEntries: input.relatedEntries || [],
        sourceDate: input.sourceDate,
      })
      .returning();

    return this.getById(entry.id) as Promise<VaultEntryWithRecording>;
  }

  /**
   * Get a vault entry by ID
   */
  async getById(id: string): Promise<VaultEntryWithRecording | null> {
    const result = await db
      .select({
        entry: vaultEntries,
        recording: {
          id: recordings.id,
          originalFilename: recordings.originalFilename,
          recordingType: recordings.recordingType,
          recordedAt: recordings.recordedAt,
        },
      })
      .from(vaultEntries)
      .leftJoin(recordings, eq(vaultEntries.recordingId, recordings.id))
      .where(eq(vaultEntries.id, id))
      .limit(1);

    if (result.length === 0) return null;

    const { entry, recording } = result[0];
    return {
      ...entry,
      recording: recording?.id ? recording : null,
    };
  }

  /**
   * List vault entries with optional filters
   */
  async list(filters: VaultFilters = {}): Promise<VaultEntryWithRecording[]> {
    const conditions = [];

    if (filters.context) {
      conditions.push(eq(vaultEntries.context, filters.context));
    }

    if (filters.contentType) {
      conditions.push(eq(vaultEntries.contentType, filters.contentType));
    }

    if (filters.source) {
      conditions.push(eq(vaultEntries.source, filters.source));
    }

    if (filters.recordingId) {
      conditions.push(eq(vaultEntries.recordingId, filters.recordingId));
    }

    if (filters.fromDate) {
      conditions.push(sql`${vaultEntries.sourceDate} >= ${filters.fromDate}`);
    }

    if (filters.toDate) {
      conditions.push(sql`${vaultEntries.sourceDate} <= ${filters.toDate}`);
    }

    // Note: Array contains requires special handling
    if (filters.tags && filters.tags.length > 0) {
      conditions.push(sql`${vaultEntries.tags} && ${filters.tags}`);
    }

    const result = await db
      .select({
        entry: vaultEntries,
        recording: {
          id: recordings.id,
          originalFilename: recordings.originalFilename,
          recordingType: recordings.recordingType,
          recordedAt: recordings.recordedAt,
        },
      })
      .from(vaultEntries)
      .leftJoin(recordings, eq(vaultEntries.recordingId, recordings.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(vaultEntries.sourceDate), desc(vaultEntries.createdAt))
      .limit(100);

    return result.map(({ entry, recording }) => ({
      ...entry,
      recording: recording?.id ? recording : null,
    }));
  }

  /**
   * Full-text search across vault entries
   */
  async search(options: SearchOptions): Promise<VaultEntryWithRecording[]> {
    const { query, context, contentType, limit = 20 } = options;

    // Build the search query using PostgreSQL full-text search
    const searchTerms = query
      .trim()
      .split(/\s+/)
      .filter(term => term.length > 0)
      .map(term => `${term}:*`)
      .join(' & ');

    const conditions = [];

    // Full-text search on title and content
    if (searchTerms) {
      conditions.push(
        sql`(
          to_tsvector('english', coalesce(${vaultEntries.title}, '')) ||
          to_tsvector('english', coalesce(${vaultEntries.content}, ''))
        ) @@ to_tsquery('english', ${searchTerms})`
      );
    }

    if (context) {
      conditions.push(eq(vaultEntries.context, context));
    }

    if (contentType) {
      conditions.push(eq(vaultEntries.contentType, contentType));
    }

    // Use a simpler query without rank in select to avoid column reference issues
    const result = await db
      .select({
        entry: vaultEntries,
        recording: {
          id: recordings.id,
          originalFilename: recordings.originalFilename,
          recordingType: recordings.recordingType,
          recordedAt: recordings.recordedAt,
        },
      })
      .from(vaultEntries)
      .leftJoin(recordings, eq(vaultEntries.recordingId, recordings.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
        sql`ts_rank(
          to_tsvector('english', coalesce(${vaultEntries.title}, '')) ||
          to_tsvector('english', coalesce(${vaultEntries.content}, '')),
          to_tsquery('english', ${searchTerms})
        ) DESC`
      )
      .limit(limit);

    return result.map(({ entry, recording }) => ({
      ...entry,
      recording: recording?.id ? recording : null,
    }));
  }

  /**
   * Simple search using ILIKE (fallback when full-text fails)
   */
  async simpleSearch(query: string, limit = 20): Promise<VaultEntryWithRecording[]> {
    const searchPattern = `%${query}%`;

    const result = await db
      .select({
        entry: vaultEntries,
        recording: {
          id: recordings.id,
          originalFilename: recordings.originalFilename,
          recordingType: recordings.recordingType,
          recordedAt: recordings.recordedAt,
        },
      })
      .from(vaultEntries)
      .leftJoin(recordings, eq(vaultEntries.recordingId, recordings.id))
      .where(
        or(
          ilike(vaultEntries.title, searchPattern),
          ilike(vaultEntries.content, searchPattern)
        )
      )
      .orderBy(desc(vaultEntries.createdAt))
      .limit(limit);

    return result.map(({ entry, recording }) => ({
      ...entry,
      recording: recording?.id ? recording : null,
    }));
  }

  /**
   * Update a vault entry
   */
  async update(id: string, input: UpdateVaultEntryInput): Promise<VaultEntryWithRecording | null> {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.title !== undefined) updateData.title = input.title;
    if (input.content !== undefined) updateData.content = input.content;
    if (input.contentType !== undefined) updateData.contentType = input.contentType;
    if (input.context !== undefined) updateData.context = input.context;
    if (input.tags !== undefined) updateData.tags = input.tags;
    if (input.sourceRef !== undefined) updateData.sourceRef = input.sourceRef;
    if (input.relatedEntries !== undefined) updateData.relatedEntries = input.relatedEntries;

    const [updated] = await db
      .update(vaultEntries)
      .set(updateData)
      .where(eq(vaultEntries.id, id))
      .returning();

    if (!updated) return null;
    return this.getById(id);
  }

  /**
   * Add tags to a vault entry
   */
  async addTags(id: string, newTags: string[]): Promise<VaultEntryWithRecording | null> {
    const entry = await this.getById(id);
    if (!entry) return null;

    const existingTags = entry.tags || [];
    const combinedTags = [...new Set([...existingTags, ...newTags])];

    return this.update(id, { tags: combinedTags });
  }

  /**
   * Remove tags from a vault entry
   */
  async removeTags(id: string, tagsToRemove: string[]): Promise<VaultEntryWithRecording | null> {
    const entry = await this.getById(id);
    if (!entry) return null;

    const existingTags = entry.tags || [];
    const filteredTags = existingTags.filter(tag => !tagsToRemove.includes(tag));

    return this.update(id, { tags: filteredTags });
  }

  /**
   * Delete a vault entry
   */
  async delete(id: string): Promise<boolean> {
    // First delete any embeddings
    await db.delete(vaultEmbeddings).where(eq(vaultEmbeddings.entryId, id));
    
    const result = await db.delete(vaultEntries).where(eq(vaultEntries.id, id)).returning();
    return result.length > 0;
  }

  /**
   * Get entries by context (e.g., all entries for a class)
   */
  async getByContext(context: string): Promise<VaultEntryWithRecording[]> {
    return this.list({ context });
  }

  /**
   * Get entries by content type
   */
  async getByContentType(contentType: VaultContentType): Promise<VaultEntryWithRecording[]> {
    return this.list({ contentType });
  }

  /**
   * Get all unique contexts
   */
  async getContexts(): Promise<string[]> {
    const result = await db
      .selectDistinct({ context: vaultEntries.context })
      .from(vaultEntries)
      .orderBy(vaultEntries.context);

    return result.map(r => r.context);
  }

  /**
   * Get all unique tags
   */
  async getTags(): Promise<string[]> {
    const result = await db
      .select({ tags: vaultEntries.tags })
      .from(vaultEntries)
      .where(sql`${vaultEntries.tags} IS NOT NULL AND array_length(${vaultEntries.tags}, 1) > 0`);

    const allTags = new Set<string>();
    for (const row of result) {
      if (row.tags) {
        row.tags.forEach(tag => allTags.add(tag));
      }
    }

    return Array.from(allTags).sort();
  }

  /**
   * Get vault stats
   */
  async getStats(): Promise<{
    totalEntries: number;
    byContentType: Record<string, number>;
    byContext: Record<string, number>;
    bySource: Record<string, number>;
  }> {
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(vaultEntries);

    const byTypeResult = await db
      .select({
        contentType: vaultEntries.contentType,
        count: sql<number>`count(*)::int`,
      })
      .from(vaultEntries)
      .groupBy(vaultEntries.contentType);

    const byContextResult = await db
      .select({
        context: vaultEntries.context,
        count: sql<number>`count(*)::int`,
      })
      .from(vaultEntries)
      .groupBy(vaultEntries.context);

    const bySourceResult = await db
      .select({
        source: vaultEntries.source,
        count: sql<number>`count(*)::int`,
      })
      .from(vaultEntries)
      .groupBy(vaultEntries.source);

    return {
      totalEntries: countResult.count,
      byContentType: Object.fromEntries(byTypeResult.map(r => [r.contentType, r.count])),
      byContext: Object.fromEntries(byContextResult.map(r => [r.context, r.count])),
      bySource: Object.fromEntries(bySourceResult.map(r => [r.source, r.count])),
    };
  }

  /**
   * Link related entries
   */
  async linkEntries(id: string, relatedIds: string[]): Promise<VaultEntryWithRecording | null> {
    const entry = await this.getById(id);
    if (!entry) return null;

    const existingRelated = entry.relatedEntries || [];
    const combined = [...new Set([...existingRelated, ...relatedIds])];

    return this.update(id, { relatedEntries: combined });
  }

  /**
   * Get related entries
   */
  async getRelated(id: string): Promise<VaultEntryWithRecording[]> {
    const entry = await this.getById(id);
    if (!entry || !entry.relatedEntries || entry.relatedEntries.length === 0) {
      return [];
    }

    const result = await db
      .select({
        entry: vaultEntries,
        recording: {
          id: recordings.id,
          originalFilename: recordings.originalFilename,
          recordingType: recordings.recordingType,
          recordedAt: recordings.recordedAt,
        },
      })
      .from(vaultEntries)
      .leftJoin(recordings, eq(vaultEntries.recordingId, recordings.id))
      .where(inArray(vaultEntries.id, entry.relatedEntries));

    return result.map(({ entry, recording }) => ({
      ...entry,
      recording: recording?.id ? recording : null,
    }));
  }

  // ============================================
  // Hierarchy Methods (Nested Pages)
  // ============================================

  /**
   * Get hierarchical tree of vault entries
   * Returns all entries organized as a tree structure
   */
  async getTree(): Promise<VaultTreeNode[]> {
    const allEntries = await db
      .select({
        id: vaultEntries.id,
        title: vaultEntries.title,
        contentType: vaultEntries.contentType,
        context: vaultEntries.context,
        parentId: vaultEntries.parentId,
        createdAt: vaultEntries.createdAt,
        updatedAt: vaultEntries.updatedAt,
      })
      .from(vaultEntries)
      .orderBy(asc(vaultEntries.title));

    // Build tree structure
    const nodeMap = new Map<string, VaultTreeNode>();
    const rootNodes: VaultTreeNode[] = [];

    // First pass: create all nodes
    for (const entry of allEntries) {
      nodeMap.set(entry.id, {
        id: entry.id,
        title: entry.title,
        contentType: entry.contentType,
        context: entry.context,
        parentId: entry.parentId,
        children: [],
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      });
    }

    // Second pass: build tree
    for (const entry of allEntries) {
      const node = nodeMap.get(entry.id)!;
      if (entry.parentId && nodeMap.has(entry.parentId)) {
        nodeMap.get(entry.parentId)!.children.push(node);
      } else {
        rootNodes.push(node);
      }
    }

    return rootNodes;
  }

  /**
   * Get direct children of a vault entry
   */
  async getChildren(parentId: string | null): Promise<VaultEntryWithRecording[]> {
    const condition = parentId
      ? eq(vaultEntries.parentId, parentId)
      : sql`${vaultEntries.parentId} IS NULL`;

    const result = await db
      .select({
        entry: vaultEntries,
        recording: {
          id: recordings.id,
          originalFilename: recordings.originalFilename,
          recordingType: recordings.recordingType,
          recordedAt: recordings.recordedAt,
        },
      })
      .from(vaultEntries)
      .leftJoin(recordings, eq(vaultEntries.recordingId, recordings.id))
      .where(condition)
      .orderBy(asc(vaultEntries.title));

    return result.map(({ entry, recording }) => ({
      ...entry,
      recording: recording?.id ? recording : null,
    }));
  }

  /**
   * Get breadcrumb trail from root to specified entry
   */
  async getBreadcrumb(id: string): Promise<VaultBreadcrumb[]> {
    const breadcrumb: VaultBreadcrumb[] = [];
    let currentId: string | null = id;

    // Walk up the tree (max 20 levels to prevent infinite loops)
    for (let i = 0; i < 20 && currentId; i++) {
      const [entry] = await db
        .select({
          id: vaultEntries.id,
          title: vaultEntries.title,
          parentId: vaultEntries.parentId,
        })
        .from(vaultEntries)
        .where(eq(vaultEntries.id, currentId))
        .limit(1);

      if (!entry) break;

      breadcrumb.unshift({
        id: entry.id,
        title: entry.title,
      });

      currentId = entry.parentId;
    }

    return breadcrumb;
  }

  /**
   * Move an entry to a new parent
   */
  async move(id: string, newParentId: string | null): Promise<VaultEntryWithRecording | null> {
    // Verify the entry exists
    const entry = await this.getById(id);
    if (!entry) return null;

    // Prevent circular references
    if (newParentId) {
      const breadcrumb = await this.getBreadcrumb(newParentId);
      if (breadcrumb.some(b => b.id === id)) {
        throw new Error('Cannot move entry into its own descendant');
      }
    }

    const [updated] = await db
      .update(vaultEntries)
      .set({
        parentId: newParentId,
        updatedAt: new Date(),
      })
      .where(eq(vaultEntries.id, id))
      .returning();

    if (!updated) return null;
    return this.getById(id);
  }

  /**
   * Create a vault entry with parent
   */
  async createWithParent(input: CreateVaultEntryInput & { parentId?: string }): Promise<VaultEntryWithRecording> {
    const [entry] = await db
      .insert(vaultEntries)
      .values({
        title: input.title,
        content: input.content,
        contentType: input.contentType,
        context: input.context,
        tags: input.tags || [],
        source: input.source,
        sourceRef: input.sourceRef,
        recordingId: input.recordingId,
        relatedEntries: input.relatedEntries || [],
        sourceDate: input.sourceDate,
        parentId: input.parentId,
      })
      .returning();

    return this.getById(entry.id) as Promise<VaultEntryWithRecording>;
  }
}

// Export singleton instance
export const vaultService = new VaultService();

/**
 * Vault Migration Service
 *
 * Migrates legacy vault_entries to the new vault_pages + vault_blocks structure.
 */

import { db } from '../db/client';
import { vaultEntries, vaultPages, vaultBlocks } from '../db/schema';
import { eq, isNull, and, desc, sql } from 'drizzle-orm';
import { vaultPageService } from './vault-page-service';
import type { PARAType } from '@jd-agent/types';

// ============================================
// Types
// ============================================

export interface MigrationStats {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export interface MigrationOptions {
  limit?: number;
  dryRun?: boolean;
  skipExisting?: boolean;
}

// ============================================
// Content Type to Icon Mapping
// ============================================

const CONTENT_TYPE_ICONS: Record<string, string> = {
  note: '📝',
  document: '📄',
  meeting: '👥',
  recording: '🎙️',
  task_archive: '✅',
  email: '📧',
  article: '📰',
  reference: '📚',
  template: '📋',
  journal: '📓',
  class_notes: '🎓',
  meeting_notes: '📋',
  lecture: '🎤',
  snippet: '✂️',
  resume: '📄',
  recording_summary: '🎙️',
  other: '📎',
};

// ============================================
// Context to PARA Type Mapping
// ============================================

function getParaTypeFromContext(context: string, contentType: string): PARAType | null {
  const lowerContext = context.toLowerCase();
  const lowerType = contentType.toLowerCase();

  // Reference materials go to Resources
  if (lowerType === 'reference' || lowerType === 'article' || lowerType === 'template') {
    return 'resources';
  }

  // Archived tasks go to Archive
  if (lowerType === 'task_archive') {
    return 'archive';
  }

  // Class-related content goes to Areas (education is an ongoing area)
  if (lowerContext.includes('class') || lowerContext.includes('school') || lowerType === 'class_notes' || lowerType === 'lecture') {
    return 'areas';
  }

  // Project-related context goes to Projects
  if (lowerContext.includes('project')) {
    return 'projects';
  }

  // Personal, work, family contexts are Areas
  if (lowerContext === 'personal' || lowerContext === 'work' || lowerContext === 'family' || lowerContext === 'health') {
    return 'areas';
  }

  return null;
}

// ============================================
// Markdown to Blocks Conversion
// ============================================

function convertMarkdownToBlocks(content: string | null): Array<{ type: string; content: Record<string, unknown> }> {
  if (!content || content.trim() === '') {
    return [];
  }

  const blocks: Array<{ type: string; content: Record<string, unknown> }> = [];
  const lines = content.split('\n');

  let currentParagraph: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const text = currentParagraph.join('\n').trim();
      if (text) {
        blocks.push({
          type: 'text',
          content: { text },
        });
      }
      currentParagraph = [];
    }
  };

  for (const line of lines) {
    // Heading 1
    if (line.startsWith('# ')) {
      flushParagraph();
      blocks.push({
        type: 'heading_1',
        content: { text: line.slice(2).trim(), level: 1 },
      });
      continue;
    }

    // Heading 2
    if (line.startsWith('## ')) {
      flushParagraph();
      blocks.push({
        type: 'heading_2',
        content: { text: line.slice(3).trim(), level: 2 },
      });
      continue;
    }

    // Heading 3
    if (line.startsWith('### ')) {
      flushParagraph();
      blocks.push({
        type: 'heading_3',
        content: { text: line.slice(4).trim(), level: 3 },
      });
      continue;
    }

    // Bullet list
    if (line.match(/^[\-\*]\s+/)) {
      flushParagraph();
      blocks.push({
        type: 'bulleted_list',
        content: { text: line.replace(/^[\-\*]\s+/, '').trim() },
      });
      continue;
    }

    // Numbered list
    if (line.match(/^\d+\.\s+/)) {
      flushParagraph();
      blocks.push({
        type: 'numbered_list',
        content: { text: line.replace(/^\d+\.\s+/, '').trim() },
      });
      continue;
    }

    // Quote
    if (line.startsWith('> ')) {
      flushParagraph();
      blocks.push({
        type: 'quote',
        content: { text: line.slice(2).trim() },
      });
      continue;
    }

    // Horizontal rule / divider
    if (line.match(/^[\-\*\_]{3,}\s*$/)) {
      flushParagraph();
      blocks.push({
        type: 'divider',
        content: {},
      });
      continue;
    }

    // Empty line - flush paragraph
    if (line.trim() === '') {
      flushParagraph();
      continue;
    }

    // Regular text - accumulate into paragraph
    currentParagraph.push(line);
  }

  // Flush any remaining paragraph
  flushParagraph();

  return blocks;
}

// ============================================
// Migration Service
// ============================================

class VaultMigrationService {
  /**
   * Get entries that haven't been migrated yet
   */
  async getUnmigratedEntries(limit: number = 100): Promise<Array<typeof vaultEntries.$inferSelect>> {
    // Get entries that don't have a corresponding vault_page with legacyEntryId
    const migratedIds = await db
      .select({ legacyEntryId: vaultPages.legacyEntryId })
      .from(vaultPages)
      .where(sql`${vaultPages.legacyEntryId} IS NOT NULL`);

    const migratedIdSet = new Set(migratedIds.map(r => r.legacyEntryId));

    const allEntries = await db
      .select()
      .from(vaultEntries)
      .orderBy(desc(vaultEntries.createdAt))
      .limit(limit * 2); // Get more than needed to account for filtering

    return allEntries
      .filter(entry => !migratedIdSet.has(entry.id))
      .slice(0, limit);
  }

  /**
   * Migrate a single vault_entry to vault_page + blocks
   */
  async migrateEntry(entry: typeof vaultEntries.$inferSelect, dryRun: boolean = false): Promise<{ pageId: string; blockCount: number } | null> {
    // Determine icon based on content type
    const icon = CONTENT_TYPE_ICONS[entry.contentType] || CONTENT_TYPE_ICONS.other;

    // Determine PARA type
    const paraType = getParaTypeFromContext(entry.context, entry.contentType);

    // Find parent PARA folder if applicable
    let parentId: string | null = null;
    if (paraType) {
      const [paraFolder] = await db
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

      if (paraFolder) {
        parentId = paraFolder.id;
      }
    }

    // Convert content to blocks
    const blocks = convertMarkdownToBlocks(entry.content);

    if (dryRun) {
      return { pageId: 'dry-run', blockCount: blocks.length };
    }

    // Create the vault_page
    const [page] = await db
      .insert(vaultPages)
      .values({
        title: entry.title,
        icon,
        parentId,
        legacyEntryId: entry.id,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      })
      .returning();

    // Create blocks
    for (let i = 0; i < blocks.length; i++) {
      await db.insert(vaultBlocks).values({
        pageId: page.id,
        type: blocks[i].type,
        content: blocks[i].content,
        sortOrder: i,
      });
    }

    return { pageId: page.id, blockCount: blocks.length };
  }

  /**
   * Migrate multiple entries
   */
  async migrateEntries(options: MigrationOptions = {}): Promise<MigrationStats> {
    const { limit = 100, dryRun = false, skipExisting = true } = options;

    const stats: MigrationStats = {
      total: 0,
      migrated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    };

    // Get unmigrated entries
    const entries = skipExisting
      ? await this.getUnmigratedEntries(limit)
      : await db
          .select()
          .from(vaultEntries)
          .orderBy(desc(vaultEntries.createdAt))
          .limit(limit);

    stats.total = entries.length;

    for (const entry of entries) {
      try {
        // Check if already migrated (double-check)
        if (skipExisting) {
          const [existing] = await db
            .select({ id: vaultPages.id })
            .from(vaultPages)
            .where(eq(vaultPages.legacyEntryId, entry.id))
            .limit(1);

          if (existing) {
            stats.skipped++;
            continue;
          }
        }

        const result = await this.migrateEntry(entry, dryRun);

        if (result) {
          stats.migrated++;
        } else {
          stats.failed++;
          stats.errors.push(`Failed to migrate entry ${entry.id}: unknown error`);
        }
      } catch (error) {
        stats.failed++;
        stats.errors.push(`Failed to migrate entry ${entry.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return stats;
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<{
    totalEntries: number;
    migratedEntries: number;
    pendingEntries: number;
    percentage: number;
  }> {
    const [totalResult] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(vaultEntries);

    const [migratedResult] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(vaultPages)
      .where(sql`${vaultPages.legacyEntryId} IS NOT NULL`);

    const total = Number(totalResult?.count || 0);
    const migrated = Number(migratedResult?.count || 0);
    const pending = total - migrated;
    const percentage = total > 0 ? Math.round((migrated / total) * 100) : 100;

    return {
      totalEntries: total,
      migratedEntries: migrated,
      pendingEntries: pending,
      percentage,
    };
  }

  /**
   * Rollback migration for a specific entry
   */
  async rollbackEntry(legacyEntryId: string): Promise<boolean> {
    const [page] = await db
      .select({ id: vaultPages.id })
      .from(vaultPages)
      .where(eq(vaultPages.legacyEntryId, legacyEntryId))
      .limit(1);

    if (!page) return false;

    // Delete blocks first (should cascade, but explicit)
    await db.delete(vaultBlocks).where(eq(vaultBlocks.pageId, page.id));

    // Delete page
    await db.delete(vaultPages).where(eq(vaultPages.id, page.id));

    return true;
  }

  /**
   * Rollback all migrations
   */
  async rollbackAll(): Promise<number> {
    // Get all migrated pages
    const migratedPages = await db
      .select({ id: vaultPages.id })
      .from(vaultPages)
      .where(sql`${vaultPages.legacyEntryId} IS NOT NULL`);

    let count = 0;
    for (const page of migratedPages) {
      await db.delete(vaultBlocks).where(eq(vaultBlocks.pageId, page.id));
      await db.delete(vaultPages).where(eq(vaultPages.id, page.id));
      count++;
    }

    return count;
  }
}

// Export singleton instance
export const vaultMigrationService = new VaultMigrationService();

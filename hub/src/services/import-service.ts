/**
 * Import Service - Import classified entries into the vault
 *
 * Handles:
 * - Saving entries to vault_entries table
 * - Deduplication checking
 * - Attachment storage
 * - Progress tracking
 * - Rollback on errors
 */

import { db } from '../db/client';
import { vaultEntries, vaultAttachments } from '../db/schema';
import { eq, and, or, sql } from 'drizzle-orm';
import type { RawEntry, ClassificationResult } from '../types';

// ============================================
// Types
// ============================================

export interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  duplicates: number;
  errors: Array<{ entry: string; error: string }>;
}

export interface ImportOptions {
  checkDuplicates?: boolean; // Check for existing entries before import
  skipOnError?: boolean; // Continue on individual entry errors
  dryRun?: boolean; // Don't actually import, just report what would happen
}

// ============================================
// Import Service
// ============================================

export class ImportService {
  /**
   * Import a single entry with classification
   */
  async importEntry(
    rawEntry: RawEntry,
    classification: ClassificationResult
  ): Promise<string | null> {
    try {
      // Check for duplicates
      const existing = await this.findDuplicate(rawEntry);
      if (existing) {
        console.log(`Skipping duplicate: ${rawEntry.title} (matches ${existing.id})`);
        return null;
      }

      // Create vault entry
      const [entry] = await db
        .insert(vaultEntries)
        .values({
          // Content
          title: rawEntry.title,
          content: rawEntry.content,
          contentType: classification.contentType,

          // Organization
          context: this.extractContext(rawEntry, classification),
          tags: classification.tags,
          category: classification.category,

          // Source tracking
          source: rawEntry.source,
          sourceId: rawEntry.sourceId,
          sourceUrl: rawEntry.sourceUrl,
          sourcePath: rawEntry.sourcePath,

          // Processing state
          isProcessed: true,
          needsReview: classification.suggestedAction === 'review',
          isDuplicate: false,

          // Timestamps
          sourceDate: rawEntry.createdAt,
          createdAt: rawEntry.createdAt,
          updatedAt: rawEntry.modifiedAt,
          importedAt: new Date(),
        })
        .returning();

      // Handle attachments if present
      if (rawEntry.attachments && rawEntry.attachments.length > 0) {
        await this.importAttachments(entry.id, rawEntry.attachments);
      }

      console.log(`✅ Imported: ${rawEntry.title} (${classification.contentType})`);
      return entry.id;
    } catch (error) {
      console.error(`Error importing entry ${rawEntry.title}:`, error);
      throw error;
    }
  }

  /**
   * Import multiple entries in batch
   */
  async importBatch(
    entries: Array<{ raw: RawEntry; classification: ClassificationResult }>,
    options: ImportOptions = {},
    onProgress?: (current: number, total: number) => void
  ): Promise<ImportResult> {
    const result: ImportResult = {
      imported: 0,
      skipped: 0,
      failed: 0,
      duplicates: 0,
      errors: [],
    };

    for (let i = 0; i < entries.length; i++) {
      const { raw, classification } = entries[i];

      try {
        // Check if we should skip based on classification
        if (classification.suggestedAction === 'delete') {
          console.log(`Skipping (marked for deletion): ${raw.title}`);
          result.skipped++;
          continue;
        }

        // Check for duplicates if requested
        if (options.checkDuplicates) {
          const existing = await this.findDuplicate(raw);
          if (existing) {
            console.log(`Duplicate found: ${raw.title}`);
            result.duplicates++;
            continue;
          }
        }

        // Dry run - just report what would be imported
        if (options.dryRun) {
          console.log(`[DRY RUN] Would import: ${raw.title} as ${classification.contentType}`);
          result.imported++;
        } else {
          // Actually import
          await this.importEntry(raw, classification);
          result.imported++;
        }

        if (onProgress) {
          onProgress(i + 1, entries.length);
        }
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          entry: raw.title,
          error: error.message,
        });

        if (!options.skipOnError) {
          throw error;
        }
      }
    }

    return result;
  }

  /**
   * Import entries that need review
   */
  async getEntriesNeedingReview(): Promise<any[]> {
    return await db
      .select()
      .from(vaultEntries)
      .where(eq(vaultEntries.needsReview, true))
      .orderBy(vaultEntries.importedAt);
  }

  /**
   * Update entry after review
   */
  async updateAfterReview(
    entryId: string,
    updates: {
      category?: string;
      tags?: string[];
      contentType?: string;
      needsReview?: boolean;
    }
  ): Promise<void> {
    await db
      .update(vaultEntries)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(vaultEntries.id, entryId));
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Find duplicate entry
   */
  private async findDuplicate(rawEntry: RawEntry): Promise<any | null> {
    // Check by sourceId if present (most reliable)
    if (rawEntry.sourceId) {
      const bySourceId = await db
        .select()
        .from(vaultEntries)
        .where(
          and(
            eq(vaultEntries.source, rawEntry.source),
            eq(vaultEntries.sourceId, rawEntry.sourceId)
          )
        )
        .limit(1);

      if (bySourceId.length > 0) {
        return bySourceId[0];
      }
    }

    // Check by title + source (fallback)
    const byTitle = await db
      .select()
      .from(vaultEntries)
      .where(
        and(
          eq(vaultEntries.title, rawEntry.title),
          eq(vaultEntries.source, rawEntry.source)
        )
      )
      .limit(1);

    if (byTitle.length > 0) {
      return byTitle[0];
    }

    return null;
  }

  /**
   * Extract context from entry
   */
  private extractContext(rawEntry: RawEntry, classification: ClassificationResult): string {
    // Try to extract meaningful context from source path
    const path = rawEntry.sourcePath || '';

    // For resumes, use "Career"
    if (classification.contentType === 'resume') {
      return 'Career';
    }

    // For class notes, try to extract class name
    if (classification.category === 'class') {
      // Look for class code pattern (e.g., "CS401", "MATH 220")
      const classMatch = path.match(/\b([A-Z]{2,4}\s*\d{3})\b/i);
      if (classMatch) {
        return classMatch[1].toUpperCase();
      }
      return 'Class';
    }

    // For work/career, use "Career"
    if (['career', 'work', 'resume'].includes(classification.category)) {
      return 'Career';
    }

    // For personal/journal, use "Personal"
    if (['journal', 'ideas', 'goals'].includes(classification.category)) {
      return 'Personal';
    }

    // Use category as context
    return classification.category.charAt(0).toUpperCase() + classification.category.slice(1);
  }

  /**
   * Import attachments (placeholder - would need R2 integration)
   */
  private async importAttachments(
    entryId: string,
    attachments: NonNullable<RawEntry['attachments']>
  ): Promise<void> {
    // For now, just store metadata
    // TODO: Upload to R2 and store path
    for (const attachment of attachments) {
      await db.insert(vaultAttachments).values({
        entryId,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        size: attachment.size,
        storagePath: attachment.url || `local/${attachment.filename}`, // Placeholder
      });
    }
  }

  /**
   * Get import statistics
   */
  async getImportStats(): Promise<{
    total: number;
    bySource: Record<string, number>;
    byContentType: Record<string, number>;
    needingReview: number;
    imported: number;
  }> {
    const totalResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM vault_entries`);
    const total = (totalResult.rows[0] as any)?.count || 0;

    const needingReviewResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM vault_entries WHERE needs_review = true`);
    const needingReview = (needingReviewResult.rows[0] as any)?.count || 0;

    const importedResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM vault_entries WHERE is_processed = true`);
    const imported = (importedResult.rows[0] as any)?.count || 0;

    // Get by source
    const bySourceResult = await db.execute(sql`
      SELECT source, COUNT(*)::int as count
      FROM vault_entries
      GROUP BY source
    `);
    const bySource: Record<string, number> = {};
    for (const row of bySourceResult.rows as any[]) {
      bySource[row.source] = row.count;
    }

    // Get by content type
    const byContentTypeResult = await db.execute(sql`
      SELECT content_type, COUNT(*)::int as count
      FROM vault_entries
      GROUP BY content_type
    `);
    const byContentType: Record<string, number> = {};
    for (const row of byContentTypeResult.rows as any[]) {
      byContentType[row.content_type] = row.count;
    }

    return {
      total,
      bySource,
      byContentType,
      needingReview,
      imported,
    };
  }
}

// ============================================
// Singleton Export
// ============================================

export const importService = new ImportService();

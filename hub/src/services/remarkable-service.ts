/**
 * JD Agent - Remarkable Service
 *
 * Business logic for Remarkable integration:
 * - Content merging: Combined markdown with Remarkable + Plaud + typed notes
 * - Vault page management for class days
 * - OCR result management and review workflow
 * - Inbox processing for weekly GTD review
 *
 * Per PRD, generates _combined.md files with:
 * 1. Existing typed notes (typed-notes.md)
 * 2. Plaud transcript (plaud-transcript.txt)
 * 3. Remarkable OCR (remarkable-ocr.txt)
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { eq, and, desc, asc, sql, isNull, gte, lte, or, like } from 'drizzle-orm';
import { db } from '../db/client';
import {
  remarkableNotes,
  remarkableSyncState,
  vaultPages,
  vaultBlocks,
  vaultEntries,
  transcripts,
  recordings,
  classes,
  classPages,
} from '../db/schema';
import { VaultPageService } from './vault-page-service';
import { VaultBlockService } from './vault-block-service';

// ============================================
// Types
// ============================================

export interface ClassDayContent {
  classCode: string;
  noteDate: string;
  semester: string;
  typedNotes?: string;
  plaudTranscript?: string;
  remarkableOcr?: string;
  remarkablePdfPath?: string;
  combinedMarkdown?: string;
  vaultPageId?: string;
}

export interface MergeResult {
  success: boolean;
  vaultPageId?: string;
  combinedFilePath?: string;
  error?: string;
}

export interface RemarkableNote {
  id: string;
  remarkableFileId: string;
  originalFilename: string;
  uploadTimestamp: Date;
  classificationType: string;
  semester: string | null;
  classCode: string | null;
  noteDate: string | null;
  pdfPath: string;
  ocrText: string | null;
  ocrConfidence: number | null;
  pageId: string | null;
  syncStatus: string;
}

export interface ClassSummary {
  classCode: string;
  className?: string;
  semester: string;
  noteCount: number;
  lastNoteDate?: string;
  averageOcrConfidence?: number;
}

export interface SyncStats {
  totalNotes: number;
  classNotes: number;
  generalNotes: number;
  pendingCount: number;
  needsReviewCount: number;
  completedCount: number;
  failedCount: number;
  averageOcrConfidence: number;
  lastSyncAt?: Date;
}

// ============================================
// Remarkable Service
// ============================================

export class RemarkableService {
  private vaultPageService: VaultPageService;
  private vaultBlockService: VaultBlockService;
  private vaultBasePath: string;

  constructor() {
    this.vaultPageService = new VaultPageService();
    this.vaultBlockService = new VaultBlockService();
    this.vaultBasePath = process.env.VAULT_BASE_PATH || './vault';
  }

  // ============================================
  // Content Merging
  // ============================================

  /**
   * Generate combined markdown for a class day
   * Merges: Typed notes + Plaud transcript + Remarkable OCR
   */
  async generateCombinedMarkdown(classCode: string, noteDate: string): Promise<MergeResult> {
    try {
      // Get the class day content from various sources
      const content = await this.getClassDayContent(classCode, noteDate);

      if (!content) {
        return {
          success: false,
          error: `No content found for ${classCode} on ${noteDate}`,
        };
      }

      // Generate the combined markdown
      const combinedMarkdown = this.buildCombinedMarkdown(content);

      // Write to the vault folder
      const vaultFolder = this.getVaultFolder(content.semester, classCode, noteDate);
      const combinedFilePath = join(vaultFolder, '_combined.md');

      if (!existsSync(vaultFolder)) {
        mkdirSync(vaultFolder, { recursive: true });
      }

      writeFileSync(combinedFilePath, combinedMarkdown);

      // Update or create vault page with the combined content
      const vaultPageId = await this.updateClassDayPage(content, combinedMarkdown);

      // Mark remarkable note as having merged content
      await this.markAsMerged(classCode, noteDate);

      console.log(`[RemarkableService] Generated combined markdown for ${classCode}/${noteDate}`);

      return {
        success: true,
        vaultPageId,
        combinedFilePath,
      };
    } catch (error) {
      console.error(`[RemarkableService] Error generating combined markdown:`, error);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Gather all content for a class day from various sources
   */
  async getClassDayContent(classCode: string, noteDate: string): Promise<ClassDayContent | null> {
    // Get remarkable note for this class/date
    const remarkableNote = await db
      .select()
      .from(remarkableNotes)
      .where(
        and(
          eq(remarkableNotes.classCode, classCode),
          eq(remarkableNotes.noteDate, noteDate)
        )
      )
      .limit(1);

    if (remarkableNote.length === 0) {
      return null;
    }

    const note = remarkableNote[0];
    const semester = note.semester || 'Unknown';

    // Get the vault folder path
    const vaultFolder = this.getVaultFolder(semester, classCode, noteDate);

    // Read typed notes if exists
    const typedNotesPath = join(vaultFolder, 'typed-notes.md');
    const typedNotes = existsSync(typedNotesPath) ? readFileSync(typedNotesPath, 'utf-8') : undefined;

    // Read Plaud transcript if exists
    const plaudTranscriptPath = join(vaultFolder, 'plaud-transcript.txt');
    const plaudTranscript = existsSync(plaudTranscriptPath)
      ? readFileSync(plaudTranscriptPath, 'utf-8')
      : undefined;

    // Also check for transcripts in database linked to this class/date
    const dbTranscript = await this.findPlaudTranscriptForClass(classCode, noteDate);

    // Remarkable OCR text (from database or file)
    let remarkableOcr = note.ocrText || undefined;
    const ocrFilePath = join(vaultFolder, 'remarkable-ocr.txt');
    if (!remarkableOcr && existsSync(ocrFilePath)) {
      remarkableOcr = readFileSync(ocrFilePath, 'utf-8');
    }

    return {
      classCode,
      noteDate,
      semester,
      typedNotes,
      plaudTranscript: plaudTranscript || dbTranscript,
      remarkableOcr,
      remarkablePdfPath: note.pdfPath,
      vaultPageId: note.pageId || undefined,
    };
  }

  /**
   * Find Plaud transcript for a class day by matching calendar events
   */
  private async findPlaudTranscriptForClass(
    classCode: string,
    noteDate: string
  ): Promise<string | undefined> {
    // Try to find a class page with transcript for this class/date
    const classPageResults = await db
      .select({
        transcriptContent: classPages.transcriptContent,
      })
      .from(classPages)
      .limit(5);

    // Look for transcripts that match the class code
    for (const cp of classPageResults) {
      if (cp.transcriptContent && cp.transcriptContent.toLowerCase().includes(classCode.toLowerCase())) {
        return cp.transcriptContent;
      }
    }

    // Also try vault entries with recording source
    const vaultRecordings = await db
      .select()
      .from(vaultEntries)
      .where(
        and(
          eq(vaultEntries.source, 'plaud'),
          like(vaultEntries.context, `%${classCode}%`)
        )
      )
      .limit(5);

    for (const vr of vaultRecordings) {
      if (vr.recordingTranscript) {
        return vr.recordingTranscript;
      }
    }

    return undefined;
  }

  /**
   * Build the combined markdown document
   */
  private buildCombinedMarkdown(content: ClassDayContent): string {
    const sections: string[] = [];

    // Header
    sections.push(`# ${content.classCode} - ${content.noteDate}`);
    sections.push('');
    sections.push(`*Combined notes from multiple sources*`);
    sections.push('');

    // Typed Notes Section
    if (content.typedNotes && content.typedNotes.trim()) {
      sections.push('## Typed Notes');
      sections.push('');
      sections.push(content.typedNotes.trim());
      sections.push('');
    }

    // Audio Transcript Section (Plaud)
    if (content.plaudTranscript && content.plaudTranscript.trim()) {
      sections.push('## Audio Transcript (Plaud)');
      sections.push('');
      sections.push(content.plaudTranscript.trim());
      sections.push('');
    }

    // Handwritten Notes Section (Remarkable)
    if (content.remarkableOcr && content.remarkableOcr.trim()) {
      sections.push('## Handwritten Notes (Remarkable)');
      sections.push('');
      sections.push(content.remarkableOcr.trim());
      sections.push('');

      // Add attachment reference if PDF exists
      if (content.remarkablePdfPath) {
        sections.push('');
        sections.push(`*[Attachment: ${content.remarkablePdfPath}]*`);
        sections.push('');
      }
    }

    // Footer
    sections.push('---');
    sections.push(`*Generated: ${new Date().toISOString()}*`);

    return sections.join('\n');
  }

  /**
   * Update or create a vault page with combined content
   */
  private async updateClassDayPage(
    content: ClassDayContent,
    combinedMarkdown: string
  ): Promise<string> {
    const pageTitle = `${content.classCode} - ${content.noteDate}`;

    // Check if page already exists
    let pageId = content.vaultPageId;

    if (!pageId) {
      // Look for existing page by title
      const existingPages = await db
        .select()
        .from(vaultPages)
        .where(eq(vaultPages.title, pageTitle))
        .limit(1);

      if (existingPages.length > 0) {
        pageId = existingPages[0].id;
      }
    }

    if (pageId) {
      // Update existing page - clear old blocks and add new content
      await db.delete(vaultBlocks).where(eq(vaultBlocks.pageId, pageId));

      // Add new content block
      await db.insert(vaultBlocks).values({
        pageId,
        type: 'text',
        content: { text: combinedMarkdown },
        sortOrder: 0,
      });

      // Update page timestamp
      await db
        .update(vaultPages)
        .set({ updatedAt: new Date() })
        .where(eq(vaultPages.id, pageId));

      return pageId;
    } else {
      // Create new page
      const [newPage] = await db
        .insert(vaultPages)
        .values({
          title: pageTitle,
          icon: '📚',
        })
        .returning();

      // Add content block
      await db.insert(vaultBlocks).values({
        pageId: newPage.id,
        type: 'text',
        content: { text: combinedMarkdown },
        sortOrder: 0,
      });

      return newPage.id;
    }
  }

  /**
   * Mark remarkable note as having merged content
   */
  private async markAsMerged(classCode: string, noteDate: string): Promise<void> {
    await db
      .update(remarkableNotes)
      .set({ hasMergedContent: true, updatedAt: new Date() })
      .where(
        and(
          eq(remarkableNotes.classCode, classCode),
          eq(remarkableNotes.noteDate, noteDate)
        )
      );
  }

  /**
   * Get vault folder path for a class day
   */
  private getVaultFolder(semester: string, classCode: string, noteDate: string): string {
    // Convert semester format: Spring2026 -> spring-2026
    const semesterPath = semester.toLowerCase().replace(/(\d{4})$/, '-$1');
    const classPath = classCode.toLowerCase();

    return join(
      this.vaultBasePath,
      'academic',
      'mba',
      semesterPath,
      classPath,
      'days',
      noteDate
    );
  }

  // ============================================
  // Note Queries
  // ============================================

  /**
   * Get all notes for a specific class
   */
  async getNotesByClass(classCode: string): Promise<RemarkableNote[]> {
    const notes = await db
      .select()
      .from(remarkableNotes)
      .where(eq(remarkableNotes.classCode, classCode))
      .orderBy(desc(remarkableNotes.noteDate));

    return notes as RemarkableNote[];
  }

  /**
   * Get all notes needing review (low OCR confidence)
   */
  async getNotesNeedingReview(): Promise<RemarkableNote[]> {
    const notes = await db
      .select()
      .from(remarkableNotes)
      .where(eq(remarkableNotes.syncStatus, 'needs_review'))
      .orderBy(desc(remarkableNotes.uploadTimestamp));

    return notes as RemarkableNote[];
  }

  /**
   * Get inbox notes (general/non-class notes)
   */
  async getInboxNotes(): Promise<RemarkableNote[]> {
    const notes = await db
      .select()
      .from(remarkableNotes)
      .where(eq(remarkableNotes.classificationType, 'general'))
      .orderBy(desc(remarkableNotes.uploadTimestamp));

    return notes as RemarkableNote[];
  }

  /**
   * Get class summary statistics
   */
  async getClassSummaries(): Promise<ClassSummary[]> {
    const results = await db
      .select({
        classCode: remarkableNotes.classCode,
        semester: remarkableNotes.semester,
        noteCount: sql<number>`COUNT(*)::int`,
        lastNoteDate: sql<string>`MAX(${remarkableNotes.noteDate})`,
        avgConfidence: sql<number>`AVG(${remarkableNotes.ocrConfidence})`,
      })
      .from(remarkableNotes)
      .where(eq(remarkableNotes.classificationType, 'class_note'))
      .groupBy(remarkableNotes.classCode, remarkableNotes.semester);

    // Get class names from the classes table
    const classInfos = await db.select().from(classes);
    const classNameMap = new Map<string, string>();
    for (const c of classInfos) {
      if (c.code) {
        classNameMap.set(c.code, c.name);
      }
    }

    return results.map((r) => ({
      classCode: r.classCode!,
      className: classNameMap.get(r.classCode || '') || undefined,
      semester: r.semester!,
      noteCount: r.noteCount,
      lastNoteDate: r.lastNoteDate,
      averageOcrConfidence: r.avgConfidence ? Math.round(r.avgConfidence) : undefined,
    }));
  }

  /**
   * Get sync statistics
   */
  async getSyncStats(): Promise<SyncStats> {
    // Get total counts by status
    const statusCounts = await db
      .select({
        syncStatus: remarkableNotes.syncStatus,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(remarkableNotes)
      .groupBy(remarkableNotes.syncStatus);

    // Get classification counts
    const classificationCounts = await db
      .select({
        classificationType: remarkableNotes.classificationType,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(remarkableNotes)
      .groupBy(remarkableNotes.classificationType);

    // Get average OCR confidence
    const avgConfidenceResult = await db
      .select({
        avgConfidence: sql<number>`AVG(${remarkableNotes.ocrConfidence})`,
      })
      .from(remarkableNotes)
      .where(sql`${remarkableNotes.ocrConfidence} IS NOT NULL`);

    // Get last sync
    const lastSyncResults = await db
      .select()
      .from(remarkableSyncState)
      .orderBy(desc(remarkableSyncState.lastSyncAt))
      .limit(1);

    // Build stats
    const statusMap = new Map<string, number>();
    for (const s of statusCounts) {
      statusMap.set(s.syncStatus, s.count);
    }

    const classMap = new Map<string, number>();
    for (const c of classificationCounts) {
      classMap.set(c.classificationType, c.count);
    }

    return {
      totalNotes:
        (classMap.get('class_note') || 0) + (classMap.get('general') || 0),
      classNotes: classMap.get('class_note') || 0,
      generalNotes: classMap.get('general') || 0,
      pendingCount: statusMap.get('pending') || 0,
      needsReviewCount: statusMap.get('needs_review') || 0,
      completedCount: statusMap.get('complete') || 0,
      failedCount: statusMap.get('failed') || 0,
      averageOcrConfidence: avgConfidenceResult[0]?.avgConfidence
        ? Math.round(avgConfidenceResult[0].avgConfidence)
        : 0,
      lastSyncAt: lastSyncResults[0]?.lastSyncAt,
    };
  }

  // ============================================
  // Note Management
  // ============================================

  /**
   * Update OCR text for a note (manual correction)
   */
  async updateOcrText(noteId: string, ocrText: string): Promise<void> {
    await db
      .update(remarkableNotes)
      .set({
        ocrText,
        ocrConfidence: 100, // Manual correction is assumed accurate
        syncStatus: 'complete',
        updatedAt: new Date(),
      })
      .where(eq(remarkableNotes.id, noteId));
  }

  /**
   * Re-classify a note (e.g., move from inbox to class note)
   */
  async reclassifyNote(
    noteId: string,
    classification: {
      type: 'class_note' | 'general';
      semester?: string;
      classCode?: string;
      noteDate?: string;
    }
  ): Promise<void> {
    await db
      .update(remarkableNotes)
      .set({
        classificationType: classification.type,
        semester: classification.type === 'class_note' ? classification.semester : null,
        classCode: classification.type === 'class_note' ? classification.classCode : null,
        noteDate: classification.type === 'class_note' ? classification.noteDate : null,
        updatedAt: new Date(),
      })
      .where(eq(remarkableNotes.id, noteId));
  }

  /**
   * Mark note as reviewed (clear needs_review status)
   */
  async markAsReviewed(noteId: string): Promise<void> {
    await db
      .update(remarkableNotes)
      .set({
        syncStatus: 'complete',
        updatedAt: new Date(),
      })
      .where(eq(remarkableNotes.id, noteId));
  }

  /**
   * Delete a note from the system
   */
  async deleteNote(noteId: string): Promise<void> {
    await db.delete(remarkableNotes).where(eq(remarkableNotes.id, noteId));
  }

  // ============================================
  // Batch Operations
  // ============================================

  /**
   * Generate combined markdown for all class notes that haven't been merged
   */
  async mergeAllPendingClassNotes(): Promise<{ merged: number; errors: string[] }> {
    const unmergedNotes = await db
      .select()
      .from(remarkableNotes)
      .where(
        and(
          eq(remarkableNotes.classificationType, 'class_note'),
          eq(remarkableNotes.hasMergedContent, false),
          eq(remarkableNotes.syncStatus, 'complete')
        )
      );

    let merged = 0;
    const errors: string[] = [];

    for (const note of unmergedNotes) {
      if (note.classCode && note.noteDate) {
        const result = await this.generateCombinedMarkdown(note.classCode, note.noteDate);
        if (result.success) {
          merged++;
        } else {
          errors.push(`${note.classCode}/${note.noteDate}: ${result.error}`);
        }
      }
    }

    return { merged, errors };
  }
}

// ============================================
// Singleton Instance
// ============================================

export const remarkableService = new RemarkableService();

/**
 * JD Agent - Remarkable Job Processor
 *
 * Processes background jobs for Remarkable integration:
 * - remarkable-sync: Full sync of all documents in sync folder
 * - remarkable-ocr: OCR processing for individual files
 * - remarkable-merge: Generate combined markdown for class days
 */

import { Job } from 'bullmq';
import { remarkableIntegration } from '../../integrations/remarkable';
import { remarkableService } from '../../services/remarkable-service';
import {
  RemarkableSyncJobData,
  RemarkableOcrJobData,
  RemarkableMergeJobData,
  addRemarkableMergeJob,
} from '../queue';

// ============================================
// Job Processors
// ============================================

/**
 * Process remarkable-sync job
 * Syncs all documents from the Remarkable sync folder
 */
export async function processRemarkableSyncJob(
  job: Job<RemarkableSyncJobData>
): Promise<{ success: boolean; result: any }> {
  const { forceReprocess } = job.data;

  console.log(`[RemarkableProcessor] Starting sync job ${job.id}`);

  try {
    // Run the sync
    const result = await remarkableIntegration.syncAll();

    console.log(
      `[RemarkableProcessor] Sync complete: ${result.processed} processed, ${result.classNotes} class notes, ${result.generalNotes} general`
    );

    // Queue merge jobs for any new class notes
    if (result.classNotes > 0) {
      // Get recently processed class notes that need merging
      const unmergedNotes = await remarkableService.getNotesByClass('');

      // The getNotesByClass with empty string won't work, we need to get all class notes
      // This is handled by the mergeAllPendingClassNotes method
      const mergeResult = await remarkableService.mergeAllPendingClassNotes();

      console.log(
        `[RemarkableProcessor] Merged ${mergeResult.merged} class notes`
      );
    }

    return {
      success: result.errors.length === 0,
      result: {
        processed: result.processed,
        skipped: result.skipped,
        classNotes: result.classNotes,
        generalNotes: result.generalNotes,
        errors: result.errors,
      },
    };
  } catch (error) {
    console.error(`[RemarkableProcessor] Sync job failed:`, error);
    throw error;
  }
}

/**
 * Process remarkable-ocr job
 * Performs OCR on a single file (for retry scenarios)
 */
export async function processRemarkableOcrJob(
  job: Job<RemarkableOcrJobData>
): Promise<{ success: boolean; result: any }> {
  const { remarkableNoteId, filePath, fileType } = job.data;

  console.log(`[RemarkableProcessor] Starting OCR job for ${remarkableNoteId}`);

  try {
    // Re-process the file to get OCR
    const result = await remarkableIntegration.processFile(filePath);

    if (result.success && result.ocrConfidence !== undefined) {
      console.log(
        `[RemarkableProcessor] OCR complete for ${remarkableNoteId}: confidence ${result.ocrConfidence}%`
      );

      // If it's a class note, queue a merge job
      if (result.classification.type === 'class_note') {
        await addRemarkableMergeJob({
          classCode: result.classification.classCode,
          noteDate: result.classification.noteDate,
          remarkableNoteId,
        });
      }

      return {
        success: true,
        result: {
          remarkableNoteId,
          ocrConfidence: result.ocrConfidence,
          hasText: !!result.extractedText,
        },
      };
    }

    return {
      success: false,
      result: {
        remarkableNoteId,
        error: result.error || 'OCR failed',
      },
    };
  } catch (error) {
    console.error(`[RemarkableProcessor] OCR job failed:`, error);
    throw error;
  }
}

/**
 * Process remarkable-merge job
 * Generates combined markdown for a class day
 */
export async function processRemarkableMergeJob(
  job: Job<RemarkableMergeJobData>
): Promise<{ success: boolean; result: any }> {
  const { classCode, noteDate, remarkableNoteId } = job.data;

  console.log(`[RemarkableProcessor] Starting merge job for ${classCode}/${noteDate}`);

  try {
    const result = await remarkableService.generateCombinedMarkdown(classCode, noteDate);

    if (result.success) {
      console.log(
        `[RemarkableProcessor] Merge complete for ${classCode}/${noteDate}: page ${result.vaultPageId}`
      );

      return {
        success: true,
        result: {
          classCode,
          noteDate,
          vaultPageId: result.vaultPageId,
          combinedFilePath: result.combinedFilePath,
        },
      };
    }

    return {
      success: false,
      result: {
        classCode,
        noteDate,
        error: result.error,
      },
    };
  } catch (error) {
    console.error(`[RemarkableProcessor] Merge job failed:`, error);
    throw error;
  }
}

// ============================================
// Job Router
// ============================================

/**
 * Route Remarkable jobs to appropriate processors
 */
export async function processRemarkableJob(
  job: Job
): Promise<{ success: boolean; result: any }> {
  switch (job.name) {
    case 'remarkable-sync':
      return processRemarkableSyncJob(job as Job<RemarkableSyncJobData>);
    case 'remarkable-ocr':
      return processRemarkableOcrJob(job as Job<RemarkableOcrJobData>);
    case 'remarkable-merge':
      return processRemarkableMergeJob(job as Job<RemarkableMergeJobData>);
    default:
      throw new Error(`Unknown Remarkable job type: ${job.name}`);
  }
}

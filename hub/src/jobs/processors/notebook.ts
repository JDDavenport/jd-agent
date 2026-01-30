/**
 * JD Agent - Notebook Job Processor
 *
 * Processes Jupyter notebook sync jobs:
 * - notebook-sync: Sync all notebooks in the directory
 * - notebook-process: Process a single notebook file
 */

import { Job } from 'bullmq';
import type { NotebookSyncJobData, NotebookProcessJobData } from '../queue';
import { notebookService } from '../../services/notebook-service';

/**
 * Process a single notebook file
 */
export async function processNotebookProcessJob(job: Job<NotebookProcessJobData>): Promise<{
  success: boolean;
  notebookId?: string;
  vaultPageId?: string;
  isNew?: boolean;
  error?: string;
}> {
  const { filePath } = job.data;

  console.log(`[NotebookProcessor] Processing: ${filePath}`);

  try {
    const result = await notebookService.processNotebook(filePath);

    if (result.success) {
      console.log(`[NotebookProcessor] Successfully processed: ${filePath}`);
      return {
        success: true,
        notebookId: result.notebookId,
        vaultPageId: result.vaultPageId,
        isNew: result.isNew,
      };
    } else {
      console.error(`[NotebookProcessor] Failed to process: ${filePath}`, result.error);
      return {
        success: false,
        error: result.error,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[NotebookProcessor] Error processing ${filePath}:`, error);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Sync all notebooks in the directory
 */
export async function processNotebookSyncJob(job: Job<NotebookSyncJobData>): Promise<{
  success: boolean;
  processed: number;
  errors: number;
  error?: string;
}> {
  const { forceReprocess } = job.data;

  console.log(`[NotebookProcessor] Starting full sync (force: ${forceReprocess || false})`);

  try {
    const result = await notebookService.syncAll();

    console.log(
      `[NotebookProcessor] Sync complete: ${result.processed} processed, ${result.errors} errors`
    );

    return {
      success: result.errors === 0,
      processed: result.processed,
      errors: result.errors,
      error: result.errors > 0 ? `${result.errors} notebooks failed to process` : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[NotebookProcessor] Sync failed:', error);
    return {
      success: false,
      processed: 0,
      errors: 0,
      error: message,
    };
  }
}

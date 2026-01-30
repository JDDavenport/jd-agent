/**
 * JD Agent - Notebook Watcher Service
 *
 * Watches the notebooks directory for changes and triggers sync.
 * Uses Node.js native fs.watch for efficient file monitoring.
 */

import { watch, existsSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
import type { FSWatcher } from 'fs';
import { notebookService } from './notebook-service';
import { addNotebookProcessJob } from '../jobs/queue';

// ============================================
// Types
// ============================================

export interface WatcherStatus {
  isWatching: boolean;
  watchPath: string;
  processedCount: number;
  lastProcessedAt: Date | null;
  queueSize: number;
}

// ============================================
// Notebook Watcher Service
// ============================================

export class NotebookWatcherService {
  private watcher: FSWatcher | null = null;
  private watchPath: string;
  private isWatching = false;
  private processingQueue = new Set<string>();
  private processedCount = 0;
  private lastProcessedAt: Date | null = null;
  private debounceTimers = new Map<string, NodeJS.Timeout>();

  constructor() {
    this.watchPath = process.env.JUPYTER_NOTEBOOK_DIR || './storage/notebooks';
  }

  /**
   * Start watching the notebooks directory
   */
  startWatching(): boolean {
    // Ensure directory exists
    if (!existsSync(this.watchPath)) {
      console.log(`[NotebookWatcher] Creating directory: ${this.watchPath}`);
      mkdirSync(this.watchPath, { recursive: true });
    }

    if (this.isWatching) {
      console.log('[NotebookWatcher] Already watching');
      return true;
    }

    try {
      this.watcher = watch(this.watchPath, { recursive: true }, (eventType, filename) => {
        this.handleFileEvent(eventType, filename);
      });

      this.isWatching = true;
      console.log(`[NotebookWatcher] Started watching: ${this.watchPath}`);
      return true;
    } catch (error) {
      console.error('[NotebookWatcher] Failed to start watching:', error);
      return false;
    }
  }

  /**
   * Stop watching the notebooks directory
   */
  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    // Clear any pending debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    this.isWatching = false;
    console.log('[NotebookWatcher] Stopped watching');
  }

  /**
   * Handle file system events
   */
  private handleFileEvent(eventType: string, filename: string | null): void {
    if (!filename) return;

    // Only process .ipynb files
    if (extname(filename) !== '.ipynb') return;

    // Skip checkpoint files
    if (filename.includes('.ipynb_checkpoints')) return;

    const fullPath = join(this.watchPath, filename);

    // Skip if already in processing queue
    if (this.processingQueue.has(fullPath)) return;

    // Debounce: wait for file to finish being written
    // Cancel any existing timer for this file
    const existingTimer = this.debounceTimers.get(fullPath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new debounce timer
    const timer = setTimeout(() => {
      this.queueNotebook(fullPath);
      this.debounceTimers.delete(fullPath);
    }, 2000); // 2 second debounce

    this.debounceTimers.set(fullPath, timer);
  }

  /**
   * Queue a notebook for processing
   */
  private async queueNotebook(filePath: string): Promise<void> {
    // Check if file still exists (might have been deleted)
    if (!existsSync(filePath)) {
      console.log(`[NotebookWatcher] File no longer exists: ${filePath}`);
      return;
    }

    // Add to processing queue to prevent duplicates
    this.processingQueue.add(filePath);

    try {
      // Queue job for async processing
      await addNotebookProcessJob({ filePath });

      this.processedCount++;
      this.lastProcessedAt = new Date();

      console.log(`[NotebookWatcher] Queued for processing: ${filePath}`);
    } catch (error) {
      console.error(`[NotebookWatcher] Failed to queue: ${filePath}`, error);
    } finally {
      // Remove from queue after a delay to prevent rapid re-processing
      setTimeout(() => {
        this.processingQueue.delete(filePath);
      }, 5000);
    }
  }

  /**
   * Process a notebook immediately (bypass queue)
   */
  async processImmediately(filePath: string): Promise<void> {
    console.log(`[NotebookWatcher] Processing immediately: ${filePath}`);
    await notebookService.processNotebook(filePath);
    this.processedCount++;
    this.lastProcessedAt = new Date();
  }

  /**
   * Get current watcher status
   */
  getStatus(): WatcherStatus {
    return {
      isWatching: this.isWatching,
      watchPath: this.watchPath,
      processedCount: this.processedCount,
      lastProcessedAt: this.lastProcessedAt,
      queueSize: this.processingQueue.size,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.processedCount = 0;
    this.lastProcessedAt = null;
  }
}

// Export singleton instance
export const notebookWatcherService = new NotebookWatcherService();

/**
 * JD Agent - Remarkable Integration
 * 
 * Syncs handwritten notes from Remarkable tablet:
 * - Watches a local folder for exported PDFs/PNGs
 * - Uses OCR to extract text from handwritten notes
 * - Stores extracted content in the vault
 * 
 * Setup options:
 * 1. Use rmapi (https://github.com/juruen/rmapi) to sync files locally
 * 2. Export notes manually to a watched folder
 * 3. Use Remarkable's official email export
 * 
 * This integration watches REMARKABLE_SYNC_PATH for new files.
 */

import { watch, existsSync, readdirSync, statSync, readFileSync } from 'fs';
import { join, basename, extname } from 'path';
import { db } from '../db/client';
import { vaultEntries, recordings } from '../db/schema';
import { eq } from 'drizzle-orm';

// ============================================
// Types
// ============================================

interface RemarkableDocument {
  filename: string;
  path: string;
  type: 'pdf' | 'png' | 'svg' | 'txt';
  modifiedAt: Date;
  size: number;
}

interface ProcessResult {
  success: boolean;
  documentId?: string;
  vaultEntryId?: string;
  extractedText?: string;
  error?: string;
}

interface SyncResult {
  processed: number;
  skipped: number;
  errors: string[];
}

// ============================================
// Remarkable Integration
// ============================================

export class RemarkableIntegration {
  private syncPath: string | null = null;
  private watcher: ReturnType<typeof watch> | null = null;
  private isWatching = false;
  private processedFiles: Set<string> = new Set();
  private ocrEnabled = false;
  private googleVisionClient: any = null;

  constructor() {
    this.syncPath = process.env.REMARKABLE_SYNC_PATH || null;
    
    if (this.syncPath) {
      if (existsSync(this.syncPath)) {
        console.log(`[Remarkable] Integration initialized, watching: ${this.syncPath}`);
      } else {
        console.log(`[Remarkable] Sync path does not exist: ${this.syncPath}`);
        this.syncPath = null;
      }
    } else {
      console.log('[Remarkable] Not configured - set REMARKABLE_SYNC_PATH to enable');
    }

    // Check for Google Cloud Vision (for OCR)
    this.initializeOcr();
  }

  /**
   * Initialize OCR capability
   */
  private async initializeOcr() {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      try {
        const vision = require('@google-cloud/vision');
        this.googleVisionClient = new vision.ImageAnnotatorClient();
        this.ocrEnabled = true;
        console.log('[Remarkable] OCR enabled via Google Cloud Vision');
      } catch (error) {
        console.log('[Remarkable] OCR not available - Google Cloud Vision not configured');
      }
    }
  }

  /**
   * Check if Remarkable sync is configured
   */
  isConfigured(): boolean {
    return this.syncPath !== null && existsSync(this.syncPath);
  }

  /**
   * Check if OCR is available
   */
  hasOcr(): boolean {
    return this.ocrEnabled;
  }

  /**
   * Start watching the sync folder for new files
   */
  startWatching(): boolean {
    if (!this.syncPath || !existsSync(this.syncPath)) {
      console.log('[Remarkable] Cannot start watching - path not configured or does not exist');
      return false;
    }

    if (this.isWatching) {
      console.log('[Remarkable] Already watching');
      return true;
    }

    this.watcher = watch(this.syncPath, { recursive: true }, async (eventType, filename) => {
      if (eventType === 'rename' && filename) {
        const fullPath = join(this.syncPath!, filename);
        
        // Check if file exists and is a supported type
        if (existsSync(fullPath) && this.isSupportedFile(filename)) {
          // Debounce - wait a bit for file to finish writing
          setTimeout(() => this.processFile(fullPath), 1000);
        }
      }
    });

    this.isWatching = true;
    console.log('[Remarkable] Started watching for new files');
    return true;
  }

  /**
   * Stop watching the sync folder
   */
  stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.isWatching = false;
    console.log('[Remarkable] Stopped watching');
  }

  /**
   * Check if a file is a supported type
   */
  private isSupportedFile(filename: string): boolean {
    const ext = extname(filename).toLowerCase();
    return ['.pdf', '.png', '.svg', '.txt'].includes(ext);
  }

  /**
   * Get file type from extension
   */
  private getFileType(filename: string): 'pdf' | 'png' | 'svg' | 'txt' {
    const ext = extname(filename).toLowerCase();
    switch (ext) {
      case '.pdf': return 'pdf';
      case '.png': return 'png';
      case '.svg': return 'svg';
      case '.txt': return 'txt';
      default: return 'txt';
    }
  }

  /**
   * List all documents in the sync folder
   */
  listDocuments(): RemarkableDocument[] {
    if (!this.syncPath || !existsSync(this.syncPath)) {
      return [];
    }

    const documents: RemarkableDocument[] = [];
    
    const scanDir = (dir: string) => {
      const entries = readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (this.isSupportedFile(entry.name)) {
          const stats = statSync(fullPath);
          documents.push({
            filename: entry.name,
            path: fullPath,
            type: this.getFileType(entry.name),
            modifiedAt: stats.mtime,
            size: stats.size,
          });
        }
      }
    };

    scanDir(this.syncPath);
    return documents;
  }

  /**
   * Process a single file
   */
  async processFile(filePath: string): Promise<ProcessResult> {
    const filename = basename(filePath);
    const sourceRef = `remarkable:${filename}`;

    // Check if already processed
    if (this.processedFiles.has(filePath)) {
      return { success: true, error: 'Already processed' };
    }

    // Check if already in vault
    const existing = await db
      .select()
      .from(vaultEntries)
      .where(eq(vaultEntries.sourceRef, sourceRef))
      .limit(1);

    if (existing.length > 0) {
      this.processedFiles.add(filePath);
      return { success: true, vaultEntryId: existing[0].id, error: 'Already in vault' };
    }

    console.log(`[Remarkable] Processing: ${filename}`);

    try {
      let extractedText = '';
      const fileType = this.getFileType(filename);

      // Extract text based on file type
      if (fileType === 'txt') {
        extractedText = readFileSync(filePath, 'utf-8');
      } else if (fileType === 'png' && this.ocrEnabled) {
        extractedText = await this.performOcr(filePath);
      } else if (fileType === 'pdf') {
        // PDF extraction would require additional library
        extractedText = `[PDF content from ${filename} - OCR not yet implemented for PDFs]`;
      }

      // Parse naming convention for richer metadata
      const metadata = this.parseNamingConvention(filename);
      const context = metadata.context;

      // Create vault entry
      const [entry] = await db.insert(vaultEntries).values({
        title: metadata.topic || this.cleanTitle(filename),
        content: extractedText || `[Handwritten note: ${filename}]`,
        contentType: 'note',
        context,
        tags: ['remarkable', 'handwritten', context.toLowerCase()],
        source: 'remarkable',
        sourceRef,
        sourceDate: metadata.date || statSync(filePath).mtime,
      }).returning();

      this.processedFiles.add(filePath);

      console.log(`[Remarkable] Created vault entry: ${entry.id}`);

      return {
        success: true,
        vaultEntryId: entry.id,
        extractedText,
      };
    } catch (error) {
      console.error(`[Remarkable] Failed to process ${filename}:`, error);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Perform OCR on an image file
   */
  private async performOcr(imagePath: string): Promise<string> {
    if (!this.googleVisionClient) {
      throw new Error('OCR not configured');
    }

    try {
      const [result] = await this.googleVisionClient.textDetection(imagePath);
      const detections = result.textAnnotations;
      
      if (detections && detections.length > 0) {
        // First annotation contains the full text
        return detections[0].description || '';
      }

      return '';
    } catch (error) {
      console.error('[Remarkable] OCR failed:', error);
      throw error;
    }
  }

  /**
   * Extract context from file path or name
   * Supports naming convention: [DATE]-[CONTEXT]-[TOPIC]
   * Examples:
   *   2026-01-05-CS401-Lecture-Neural-Networks.pdf
   *   2026-01-05-Meeting-Professor-Smith.pdf
   */
  private extractContext(filePath: string, filename: string): string {
    // Try to parse naming convention: DATE-CONTEXT-TOPIC
    // Pattern: YYYY-MM-DD-CONTEXT-TOPIC
    const conventionMatch = filename.match(/^\d{4}-\d{2}-\d{2}-([^-]+)/i);
    if (conventionMatch) {
      return conventionMatch[1];
    }

    // Try to extract from folder structure
    if (this.syncPath) {
      const relativePath = filePath.replace(this.syncPath, '').replace(/^[/\\]/, '');
      const parts = relativePath.split(/[/\\]/);
      
      // If there's a folder, use it as context
      if (parts.length > 1) {
        return parts[0];
      }
    }

    // Try to extract from filename patterns like "CS401 - Notes"
    const courseMatch = filename.match(/^([A-Z]{2,4}\s*\d{3})/i);
    if (courseMatch) {
      return courseMatch[1].toUpperCase();
    }

    return 'Notes';
  }

  /**
   * Parse full naming convention from filename
   * Returns date, context, and topic
   */
  parseNamingConvention(filename: string): {
    date?: Date;
    context: string;
    topic?: string;
  } {
    // Pattern: YYYY-MM-DD-CONTEXT-TOPIC.ext
    const pattern = /^(\d{4}-\d{2}-\d{2})-([^-]+)-(.+)\.[^.]+$/;
    const match = filename.match(pattern);

    if (match) {
      return {
        date: new Date(match[1]),
        context: match[2],
        topic: match[3].replace(/-/g, ' '),
      };
    }

    // Fallback
    return {
      context: this.extractContext('', filename),
    };
  }

  /**
   * Clean up filename to use as title
   */
  private cleanTitle(filename: string): string {
    return filename
      .replace(/\.[^.]+$/, '') // Remove extension
      .replace(/_/g, ' ')
      .replace(/-/g, ' - ')
      .trim();
  }

  /**
   * Sync all documents in the folder
   */
  async syncAll(): Promise<SyncResult> {
    const result: SyncResult = {
      processed: 0,
      skipped: 0,
      errors: [],
    };

    if (!this.isConfigured()) {
      result.errors.push('Remarkable not configured');
      return result;
    }

    const documents = this.listDocuments();
    console.log(`[Remarkable] Found ${documents.length} documents to process`);

    for (const doc of documents) {
      const processResult = await this.processFile(doc.path);
      
      if (processResult.success) {
        if (processResult.error?.includes('Already')) {
          result.skipped++;
        } else {
          result.processed++;
        }
      } else {
        result.errors.push(`${doc.filename}: ${processResult.error}`);
      }
    }

    console.log(`[Remarkable] Sync complete: ${result.processed} processed, ${result.skipped} skipped`);
    return result;
  }

  /**
   * Get sync status
   */
  getStatus(): {
    configured: boolean;
    watching: boolean;
    syncPath: string | null;
    ocrEnabled: boolean;
    documentCount: number;
  } {
    return {
      configured: this.isConfigured(),
      watching: this.isWatching,
      syncPath: this.syncPath,
      ocrEnabled: this.ocrEnabled,
      documentCount: this.isConfigured() ? this.listDocuments().length : 0,
    };
  }
}

// ============================================
// Singleton instance
// ============================================

export const remarkableIntegration = new RemarkableIntegration();

/**
 * JD Agent - Plaud Pro Integration
 * 
 * Syncs recordings from Plaud Pro voice recorder:
 * - Watches a sync folder for new audio files
 * - Uploads to Cloudflare R2 storage
 * - Queues for transcription and processing
 * 
 * Setup:
 * 1. Configure Plaud Pro to sync to a local folder
 * 2. Set PLAUD_SYNC_PATH environment variable
 * 3. Configure R2 storage for audio file uploads
 */

import { watch, existsSync, readdirSync, statSync, readFileSync } from 'fs';
import { join, basename, extname } from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { db } from '../db/client';
import { recordings } from '../db/schema';
import { eq } from 'drizzle-orm';
import { addRecordingProcessJob } from '../jobs/queue';

// ============================================
// Types
// ============================================

interface PlaudRecording {
  filename: string;
  path: string;
  size: number;
  modifiedAt: Date;
  duration?: number;
}

interface UploadResult {
  success: boolean;
  recordingId?: string;
  r2Path?: string;
  error?: string;
}

interface SyncResult {
  uploaded: number;
  skipped: number;
  queued: number;
  errors: string[];
}

// ============================================
// Plaud Integration
// ============================================

export class PlaudIntegration {
  private syncPath: string | null = null;
  private watcher: ReturnType<typeof watch> | null = null;
  private isWatching = false;
  private processedFiles: Set<string> = new Set();
  
  private s3Client: S3Client | null = null;
  private bucketName: string | null = null;
  private r2Configured = false;

  constructor() {
    // Check sync path
    this.syncPath = process.env.PLAUD_SYNC_PATH || null;
    
    if (this.syncPath) {
      if (existsSync(this.syncPath)) {
        console.log(`[Plaud] Integration initialized, watching: ${this.syncPath}`);
      } else {
        console.log(`[Plaud] Sync path does not exist: ${this.syncPath}`);
        this.syncPath = null;
      }
    } else {
      console.log('[Plaud] Not configured - set PLAUD_SYNC_PATH to enable');
    }

    // Initialize R2/S3 client
    this.initializeStorage();
  }

  /**
   * Initialize Cloudflare R2 storage
   */
  private initializeStorage() {
    const endpoint = process.env.R2_ENDPOINT;
    const accessKey = process.env.R2_ACCESS_KEY;
    const secretKey = process.env.R2_SECRET_KEY;
    const bucket = process.env.R2_BUCKET_NAME;

    if (endpoint && accessKey && secretKey && bucket) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint,
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
        },
      });
      this.bucketName = bucket;
      this.r2Configured = true;
      console.log('[Plaud] R2 storage configured');
    } else {
      console.log('[Plaud] R2 storage not configured - recordings will not be uploaded');
    }
  }

  /**
   * Check if Plaud sync is configured
   */
  isConfigured(): boolean {
    return this.syncPath !== null && existsSync(this.syncPath);
  }

  /**
   * Check if R2 storage is configured
   */
  hasStorage(): boolean {
    return this.r2Configured;
  }

  /**
   * Start watching the sync folder for new files
   */
  startWatching(): boolean {
    if (!this.syncPath || !existsSync(this.syncPath)) {
      console.log('[Plaud] Cannot start watching - path not configured or does not exist');
      return false;
    }

    if (this.isWatching) {
      console.log('[Plaud] Already watching');
      return true;
    }

    this.watcher = watch(this.syncPath, { recursive: true }, async (eventType, filename) => {
      if (eventType === 'rename' && filename) {
        const fullPath = join(this.syncPath!, filename);
        
        // Check if file exists and is an audio file
        if (existsSync(fullPath) && this.isAudioFile(filename)) {
          // Debounce - wait for file to finish writing
          setTimeout(() => this.processNewRecording(fullPath), 2000);
        }
      }
    });

    this.isWatching = true;
    console.log('[Plaud] Started watching for new recordings');
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
    console.log('[Plaud] Stopped watching');
  }

  /**
   * Check if a file is an audio file
   */
  private isAudioFile(filename: string): boolean {
    const ext = extname(filename).toLowerCase();
    return ['.mp3', '.m4a', '.wav', '.ogg', '.webm', '.aac', '.flac'].includes(ext);
  }

  /**
   * Get MIME type for audio file
   */
  private getMimeType(filename: string): string {
    const ext = extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.webm': 'audio/webm',
      '.aac': 'audio/aac',
      '.flac': 'audio/flac',
    };
    return mimeTypes[ext] || 'audio/mpeg';
  }

  /**
   * List all recordings in the sync folder
   */
  listRecordings(): PlaudRecording[] {
    if (!this.syncPath || !existsSync(this.syncPath)) {
      return [];
    }

    const recordings: PlaudRecording[] = [];
    
    const scanDir = (dir: string) => {
      const entries = readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (this.isAudioFile(entry.name)) {
          const stats = statSync(fullPath);
          recordings.push({
            filename: entry.name,
            path: fullPath,
            size: stats.size,
            modifiedAt: stats.mtime,
          });
        }
      }
    };

    scanDir(this.syncPath);
    return recordings;
  }

  /**
   * Process a new recording file
   */
  private async processNewRecording(filePath: string): Promise<UploadResult> {
    const filename = basename(filePath);
    
    // Skip if already processed
    if (this.processedFiles.has(filePath)) {
      return { success: true, error: 'Already processed' };
    }

    // Check if already in database
    const sourceRef = `plaud:${filename}`;
    const existing = await db
      .select()
      .from(recordings)
      .where(eq(recordings.originalFilename, filename))
      .limit(1);

    if (existing.length > 0) {
      this.processedFiles.add(filePath);
      return { success: true, recordingId: existing[0].id, error: 'Already in database' };
    }

    console.log(`[Plaud] Processing new recording: ${filename}`);

    try {
      // Upload to R2 if configured
      let r2Path: string | null = null;
      
      if (this.r2Configured) {
        r2Path = await this.uploadToR2(filePath, filename);
      }

      // Parse metadata from filename
      const metadata = this.parseFilename(filename);
      const recordedAt = metadata.recordedAt || statSync(filePath).mtime;
      const safeFilename = filename || `Recording ${recordedAt.toISOString().split('T')[0]}`;

      // Create recording record
      const [recording] = await db.insert(recordings).values({
        filePath: r2Path || filePath,
        originalFilename: safeFilename,
        fileSizeBytes: statSync(filePath).size,
        recordingType: metadata.type || 'other',
        context: metadata.context,
        status: 'pending',
        recordedAt,
      }).returning();

      this.processedFiles.add(filePath);

      // Queue for processing
      await addRecordingProcessJob({
        recordingId: recording.id,
        filePath: r2Path || filePath,
        recordingType: metadata.type,
        context: metadata.context,
      });

      console.log(`[Plaud] Created recording ${recording.id}, queued for processing`);

      return {
        success: true,
        recordingId: recording.id,
        r2Path: r2Path || undefined,
      };
    } catch (error) {
      console.error(`[Plaud] Failed to process ${filename}:`, error);
      return {
        success: false,
        error: String(error),
      };
    }
  }

  /**
   * Upload a file to R2 storage
   */
  private async uploadToR2(filePath: string, filename: string): Promise<string> {
    if (!this.s3Client || !this.bucketName) {
      throw new Error('R2 storage not configured');
    }

    const fileBuffer = readFileSync(filePath);
    const key = `recordings/${Date.now()}-${filename}`;
    const mimeType = this.getMimeType(filename);

    await this.s3Client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
    }));

    console.log(`[Plaud] Uploaded to R2: ${key}`);
    return key;
  }

  /**
   * Get a presigned URL for a recording
   */
  async getPresignedUrl(r2Path: string, expiresIn = 3600): Promise<string | null> {
    if (!this.s3Client || !this.bucketName) {
      return null;
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: r2Path,
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      console.error('[Plaud] Failed to generate presigned URL:', error);
      return null;
    }
  }

  /**
   * Parse metadata from filename
   * Expected formats:
   * - YYYY-MM-DD_HH-MM-SS_type_context.mp3
   * - recording_timestamp.m4a
   */
  private parseFilename(filename: string): {
    recordedAt?: Date;
    type?: 'class' | 'meeting' | 'conversation' | 'other';
    context?: string;
  } {
    // Try to parse date from filename
    const dateMatch = filename.match(/(\d{4}-\d{2}-\d{2})/);
    const timeMatch = filename.match(/(\d{2}-\d{2}-\d{2})/);
    
    let recordedAt: Date | undefined;
    if (dateMatch) {
      const dateStr = dateMatch[1];
      const timeStr = timeMatch ? timeMatch[1].replace(/-/g, ':') : '00:00:00';
      const parsed = new Date(`${dateStr}T${timeStr}`);
      // Only use if valid date
      if (!isNaN(parsed.getTime())) {
        recordedAt = parsed;
      }
    }

    // Try to detect type from filename
    let type: 'class' | 'meeting' | 'conversation' | 'other' | undefined;
    const lowerFilename = filename.toLowerCase();
    
    if (lowerFilename.includes('class') || lowerFilename.includes('lecture')) {
      type = 'class';
    } else if (lowerFilename.includes('meeting') || lowerFilename.includes('call')) {
      type = 'meeting';
    } else if (lowerFilename.includes('conversation') || lowerFilename.includes('chat')) {
      type = 'conversation';
    }

    // Try to extract context (class name, project, etc.)
    let context: string | undefined;
    const contextMatch = filename.match(/(?:class|lecture|meeting)[-_]?([A-Z]{2,4}\s*\d{3})/i);
    if (contextMatch) {
      context = contextMatch[1].toUpperCase();
    }

    return { recordedAt, type, context };
  }

  /**
   * Sync all recordings in the folder
   */
  async syncAll(): Promise<SyncResult> {
    const result: SyncResult = {
      uploaded: 0,
      skipped: 0,
      queued: 0,
      errors: [],
    };

    if (!this.isConfigured()) {
      result.errors.push('Plaud not configured');
      return result;
    }

    const recordingsList = this.listRecordings();
    console.log(`[Plaud] Found ${recordingsList.length} recordings to process`);

    for (const rec of recordingsList) {
      const uploadResult = await this.processNewRecording(rec.path);
      
      if (uploadResult.success) {
        if (uploadResult.error?.includes('Already')) {
          result.skipped++;
        } else {
          result.uploaded++;
          result.queued++;
        }
      } else {
        result.errors.push(`${rec.filename}: ${uploadResult.error}`);
      }
    }

    console.log(`[Plaud] Sync complete: ${result.uploaded} uploaded, ${result.skipped} skipped, ${result.queued} queued`);
    return result;
  }

  /**
   * Get sync status
   */
  getStatus(): {
    configured: boolean;
    watching: boolean;
    syncPath: string | null;
    r2Configured: boolean;
    recordingCount: number;
  } {
    return {
      configured: this.isConfigured(),
      watching: this.isWatching,
      syncPath: this.syncPath,
      r2Configured: this.r2Configured,
      recordingCount: this.isConfigured() ? this.listRecordings().length : 0,
    };
  }
}

// ============================================
// Singleton instance
// ============================================

export const plaudIntegration = new PlaudIntegration();

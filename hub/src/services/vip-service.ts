/**
 * JD Agent - Vault Ingestion Pipeline (VIP) Service
 *
 * Orchestrates the entire Vault Ingestion Pipeline:
 * 1. File ingestion and batch creation
 * 2. Audio segmentation
 * 3. Calendar alignment
 * 4. Transcription
 * 5. AI-powered extraction
 * 6. Vault page creation
 * 7. Notification digests
 */

import { db } from '../db/client';
import {
  recordingBatches,
  recordings,
  recordingSegments,
  extractedItems,
  classPages,
  calendarEvents,
  vaultPages,
  vaultBlocks,
  tasks
} from '../db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { addVipIngestionJob, addVipSegmentationJob } from '../jobs/queue';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

// ============================================
// Types
// ============================================

export interface VipBatchConfig {
  batchDate: Date; // Day boundary in America/Denver timezone
  files: VipFile[];
  context?: string;
}

export interface VipFile {
  filename: string;
  path: string; // Local temp path
  size: number;
  mimeType: string;
  durationSeconds?: number;
  originalName?: string;
}

export interface VipBatchStatus {
  id: string;
  batchDate: Date;
  status: 'processing' | 'complete' | 'failed';
  totalFiles: number;
  processedFiles: number;
  totalDurationSeconds: number;
  calendarEventsMatched: number;
  segmentsCreated: number;
  transcriptsCreated: number;
  vaultPagesCreated: number;
  tasksCreated: number;
  errorMessage?: string;
  startedAt: Date;
  completedAt?: Date;
}

// ============================================
// VIP Service Class
// ============================================

export class VipService {
  private s3Client: S3Client | null = null;
  private bucketName: string = '';

  constructor() {
    // Initialize S3 client if configured
    if (process.env.R2_ACCESS_KEY && process.env.R2_SECRET_KEY && process.env.R2_BUCKET_NAME) {
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: process.env.R2_ENDPOINT,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY,
          secretAccessKey: process.env.R2_SECRET_KEY,
        },
      });
      this.bucketName = process.env.R2_BUCKET_NAME;
    }
  }

  /**
   * Check if S3 storage is configured
   */
  isStorageConfigured(): boolean {
    return this.s3Client !== null;
  }

  /**
   * Create a new VIP batch for processing
   */
  async createBatch(config: VipBatchConfig): Promise<string> {
    console.log(`[VIP] Creating batch for ${config.batchDate.toISOString().split('T')[0]} with ${config.files.length} files`);

    // Check for existing batch (idempotency)
    const existingBatch = await db
      .select()
      .from(recordingBatches)
      .where(eq(recordingBatches.batchDate, config.batchDate))
      .limit(1);

    if (existingBatch.length > 0) {
      console.log(`[VIP] Batch already exists for ${config.batchDate.toISOString().split('T')[0]}, returning existing ID`);
      return existingBatch[0].id;
    }

    // Calculate total duration
    const totalDuration = config.files.reduce((sum, file) => sum + (file.durationSeconds || 0), 0);

    // Create batch record
    const [batch] = await db
      .insert(recordingBatches)
      .values({
        batchDate: config.batchDate,
        status: 'processing',
        totalFiles: config.files.length,
        totalDurationSeconds: totalDuration,
        startedAt: new Date(),
      })
      .returning();

    console.log(`[VIP] Created batch ${batch.id}`);

    // Upload files to storage and create recording records
    for (const file of config.files) {
      await this.processFileForBatch(batch.id, file, config.batchDate);
    }

    // Queue initial processing job
    await addVipIngestionJob({
      batchId: batch.id,
      batchDate: config.batchDate,
    });

    return batch.id;
  }

  /**
   * Process a single file for a batch
   */
  private async processFileForBatch(batchId: string, file: VipFile, batchDate: Date): Promise<void> {
    try {
      // Upload to R2 storage
      const storageKey = `vip/${batchDate.toISOString().split('T')[0]}/${Date.now()}-${file.filename}`;

      if (this.isStorageConfigured()) {
        await this.uploadFileToStorage(file.path, storageKey, file.mimeType);
      } else {
        console.warn(`[VIP] Storage not configured, skipping upload for ${file.filename}`);
      }

      // Create recording record
      const filename = file.originalName || file.filename || `Recording ${batchDate.toISOString().split('T')[0]}`;
      const [recording] = await db
        .insert(recordings)
        .values({
          filePath: storageKey, // Use storage key as file path
          originalFilename: filename,
          durationSeconds: file.durationSeconds,
          fileSizeBytes: file.size,
          recordingType: 'class', // Default assumption, will be refined by segmentation
          recordedAt: batchDate,
          uploadedAt: new Date(),
          status: 'pending',
        })
        .returning();

      console.log(`[VIP] Processed file ${file.filename} -> recording ${recording.id}`);

    } catch (error) {
      console.error(`[VIP] Failed to process file ${file.filename}:`, error);
      throw error;
    }
  }

  /**
   * Upload file to R2 storage
   */
  private async uploadFileToStorage(localPath: string, storageKey: string, mimeType: string): Promise<void> {
    if (!this.s3Client) {
      throw new Error('S3 client not configured');
    }

    const fileContent = await Bun.file(localPath).arrayBuffer();

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
      Body: fileContent,
      ContentType: mimeType,
      // Enable server-side encryption
      ServerSideEncryption: 'AES256',
    });

    await this.s3Client.send(command);
    console.log(`[VIP] Uploaded ${storageKey} to storage`);
  }

  /**
   * Get signed URL for accessing stored files
   */
  async getFileUrl(storageKey: string, expiresInSeconds: number = 3600): Promise<string> {
    if (!this.s3Client) {
      throw new Error('S3 client not configured');
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: storageKey,
    });

    const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
    return signedUrl;
  }

  /**
   * Get batch status
   */
  async getBatchStatus(batchId: string): Promise<VipBatchStatus | null> {
    const batch = await db
      .select()
      .from(recordingBatches)
      .where(eq(recordingBatches.id, batchId))
      .limit(1);

    if (batch.length === 0) {
      return null;
    }

    return {
      id: batch[0].id,
      batchDate: new Date(batch[0].batchDate),
      status: batch[0].status as VipBatchStatus['status'],
      totalFiles: batch[0].totalFiles,
      processedFiles: batch[0].processedFiles,
      totalDurationSeconds: batch[0].totalDurationSeconds || 0,
      calendarEventsMatched: batch[0].calendarEventsMatched || 0,
      segmentsCreated: batch[0].segmentsCreated || 0,
      transcriptsCreated: batch[0].transcriptsCreated || 0,
      vaultPagesCreated: batch[0].vaultPagesCreated || 0,
      tasksCreated: batch[0].tasksCreated || 0,
      errorMessage: batch[0].errorMessage || undefined,
      startedAt: batch[0].startedAt,
      completedAt: batch[0].completedAt || undefined,
    };
  }

  /**
   * Get all batches for a date range
   */
  async getBatches(startDate: Date, endDate: Date): Promise<VipBatchStatus[]> {
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const batches = await db
      .select()
      .from(recordingBatches)
      .where(and(
        gte(recordingBatches.batchDate, startDateStr),
        lte(recordingBatches.batchDate, endDateStr)
      ))
      .orderBy(desc(recordingBatches.batchDate));

    return batches.map(batch => ({
      id: batch.id,
      batchDate: new Date(batch.batchDate),
      status: batch.status as VipBatchStatus['status'],
      totalFiles: batch.totalFiles,
      processedFiles: batch.processedFiles,
      totalDurationSeconds: batch.totalDurationSeconds || 0,
      calendarEventsMatched: batch.calendarEventsMatched || 0,
      segmentsCreated: batch.segmentsCreated || 0,
      transcriptsCreated: batch.transcriptsCreated || 0,
      vaultPagesCreated: batch.vaultPagesCreated || 0,
      tasksCreated: batch.tasksCreated || 0,
      errorMessage: batch.errorMessage || undefined,
      startedAt: batch.startedAt,
      completedAt: batch.completedAt || undefined,
    }));
  }

  /**
   * Update batch progress
   */
  async updateBatchProgress(
    batchId: string,
    updates: Partial<Pick<VipBatchStatus, 'processedFiles' | 'calendarEventsMatched' | 'segmentsCreated' | 'transcriptsCreated' | 'vaultPagesCreated' | 'tasksCreated'>>
  ): Promise<void> {
    await db
      .update(recordingBatches)
      .set(updates)
      .where(eq(recordingBatches.id, batchId));
  }

  /**
   * Mark batch as complete
   */
  async completeBatch(batchId: string): Promise<void> {
    await db
      .update(recordingBatches)
      .set({
        status: 'complete',
        completedAt: new Date(),
      })
      .where(eq(recordingBatches.id, batchId));
  }

  /**
   * Mark batch as failed
   */
  async failBatch(batchId: string, errorMessage: string): Promise<void> {
    await db
      .update(recordingBatches)
      .set({
        status: 'failed',
        errorMessage,
        completedAt: new Date(),
      })
      .where(eq(recordingBatches.id, batchId));
  }

  /**
   * Resume processing for a failed/partial batch
   */
  async resumeBatch(batchId: string): Promise<void> {
    // Reset status and queue next job based on current state
    const batch = await this.getBatchStatus(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    if (batch.status === 'complete') {
      console.log(`[VIP] Batch ${batchId} already complete, skipping resume`);
      return;
    }

    // Reset to processing and queue appropriate job
    await db
      .update(recordingBatches)
      .set({
        status: 'processing',
        errorMessage: null,
      })
      .where(eq(recordingBatches.id, batchId));

    // Determine next step based on progress
    if (batch.segmentsCreated === 0) {
      // Need segmentation
      await addVipSegmentationJob({ batchId });
    } else {
      // Continue from next step (calendar alignment, etc.)
      // This will be expanded as we implement more pipeline steps
      console.log(`[VIP] Resuming batch ${batchId} from next step`);
    }
  }

  /**
   * Get calendar events for a date (used by calendar alignment)
   */
  async getCalendarEventsForDate(date: Date): Promise<any[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const events = await db
      .select()
      .from(calendarEvents)
      .where(and(
        gte(calendarEvents.startTime, startOfDay),
        lte(calendarEvents.startTime, endOfDay)
      ))
      .orderBy(calendarEvents.startTime);

    return events;
  }
}

// ============================================
// Singleton Instance
// ============================================

export const vipService = new VipService();
/**
 * JD Agent - Job Queue Setup
 * 
 * BullMQ queue configuration for background job processing:
 * - Transcription jobs (Deepgram)
 * - OCR processing (Google Vision)
 * - Summarization (Claude/OpenAI)
 * - Email processing
 * - Embedding generation
 */

import { Queue, Job, QueueEvents } from 'bullmq';

// ============================================
// Job Types
// ============================================

export type JobType =
  | 'transcription'
  | 'summarization'
  | 'ocr'
  | 'email-triage'
  | 'embedding'
  | 'task-extraction'
  | 'canvas-sync'
  | 'recording-process'
  // VIP Pipeline jobs
  | 'vip-ingestion'
  | 'vip-segmentation'
  | 'vip-calendar-alignment'
  | 'vip-transcription'
  | 'vip-extraction'
  | 'vip-vault-writer'
  | 'vip-notification'
  | 'vip-speaker-embedding'
  // Remarkable Pipeline jobs
  | 'remarkable-sync'
  | 'remarkable-ocr'
  | 'remarkable-merge';

export interface TranscriptionJobData {
  recordingId: string;
  filePath: string;
  audioUrl?: string;
}

export interface SummarizationJobData {
  recordingId: string;
  transcriptId: string;
  recordingType: 'class' | 'meeting' | 'conversation' | 'other';
  context?: string;
}

export interface OcrJobData {
  filePath: string;
  sourceRef: string;
  context?: string;
}

export interface EmailTriageJobData {
  emailId: string;
  from: string;
  subject: string;
  body: string;
  receivedAt: Date;
}

export interface EmbeddingJobData {
  entryId: string;
  content: string;
  chunkIndex?: number;
}

export interface TaskExtractionJobData {
  recordingId?: string;
  transcriptText?: string;
  summaryId?: string;
  source: 'recording' | 'email' | 'note';
  context?: string;
}

export interface RecordingProcessJobData {
  recordingId: string;
  filePath: string;
  recordingType?: 'class' | 'meeting' | 'conversation' | 'other';
  context?: string;
}

export interface VipIngestionJobData {
  batchId: string;
  batchDate: Date;
}

export interface VipSegmentationJobData {
  batchId: string;
}

export interface VipCalendarAlignmentJobData {
  batchId: string;
}

export interface VipTranscriptionJobData {
  batchId: string;
  segmentIds: string[];
}

export interface VipExtractionJobData {
  batchId: string;
  segmentIds: string[];
}

export interface VipVaultWriterJobData {
  batchId: string;
}

export interface VipNotificationJobData {
  batchId: string;
  notificationType: 'telegram' | 'email' | 'both';
}

export interface VipSpeakerEmbeddingJobData {
  batchId: string;
  transcriptId: string;
  recordingId: string;
}

// Remarkable Pipeline Job Data
export interface RemarkableSyncJobData {
  syncPath?: string; // Optional override for sync path
  forceReprocess?: boolean; // Re-process already synced files
}

export interface RemarkableOcrJobData {
  remarkableNoteId: string;
  filePath: string;
  fileType: 'pdf' | 'png' | 'svg';
}

export interface RemarkableMergeJobData {
  classCode: string;
  noteDate: string;
  remarkableNoteId?: string;
}

export type JobData =
  | TranscriptionJobData
  | SummarizationJobData
  | OcrJobData
  | EmailTriageJobData
  | EmbeddingJobData
  | TaskExtractionJobData
  | RecordingProcessJobData
  | VipIngestionJobData
  | VipSegmentationJobData
  | VipCalendarAlignmentJobData
  | VipTranscriptionJobData
  | VipExtractionJobData
  | VipVaultWriterJobData
  | VipNotificationJobData
  | VipSpeakerEmbeddingJobData
  | RemarkableSyncJobData
  | RemarkableOcrJobData
  | RemarkableMergeJobData;

// ============================================
// Redis Connection Options
// ============================================

export function getRedisConnectionOptions() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  
  // Parse the URL to extract connection options
  const url = new URL(redisUrl);
  
  return {
    host: url.hostname,
    port: parseInt(url.port) || 6379,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };
}

// ============================================
// Queues
// ============================================

const QUEUE_NAME = 'jd-agent-jobs';

let mainQueue: Queue | null = null;
let queueEvents: QueueEvents | null = null;

export function getQueue(): Queue {
  if (!mainQueue) {
    const connection = getRedisConnectionOptions();
    mainQueue = new Queue(QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: {
          count: 100,
          age: 24 * 60 * 60, // 24 hours
        },
        removeOnFail: {
          count: 50,
        },
      },
    });
    
    console.log('[Queue] Main queue initialized');
  }
  
  return mainQueue;
}

export function getQueueEvents(): QueueEvents {
  if (!queueEvents) {
    const connection = getRedisConnectionOptions();
    queueEvents = new QueueEvents(QUEUE_NAME, { connection });
    
    queueEvents.on('completed', ({ jobId }) => {
      console.log(`[Queue] Job ${jobId} completed`);
    });
    
    queueEvents.on('failed', ({ jobId, failedReason }) => {
      console.error(`[Queue] Job ${jobId} failed:`, failedReason);
    });
  }
  
  return queueEvents;
}

// ============================================
// Job Scheduling Functions
// ============================================

export async function addTranscriptionJob(data: TranscriptionJobData): Promise<Job> {
  const queue = getQueue();
  return queue.add('transcription', data, {
    priority: 1,
  });
}

export async function addSummarizationJob(data: SummarizationJobData): Promise<Job> {
  const queue = getQueue();
  return queue.add('summarization', data, {
    priority: 2,
  });
}

export async function addOcrJob(data: OcrJobData): Promise<Job> {
  const queue = getQueue();
  return queue.add('ocr', data, {
    priority: 2,
  });
}

export async function addEmailTriageJob(data: EmailTriageJobData): Promise<Job> {
  const queue = getQueue();
  return queue.add('email-triage', data, {
    priority: 3,
  });
}

export async function addEmbeddingJob(data: EmbeddingJobData): Promise<Job> {
  const queue = getQueue();
  return queue.add('embedding', data, {
    priority: 4,
  });
}

export async function addTaskExtractionJob(data: TaskExtractionJobData): Promise<Job> {
  const queue = getQueue();
  return queue.add('task-extraction', data, {
    priority: 2,
  });
}

export async function addRecordingProcessJob(data: RecordingProcessJobData): Promise<Job> {
  const queue = getQueue();
  return queue.add('recording-process', data, {
    priority: 1,
  });
}

export async function addVipIngestionJob(data: VipIngestionJobData): Promise<Job> {
  const queue = getQueue();
  return queue.add('vip-ingestion', data, {
    priority: 1,
  });
}

export async function addVipSegmentationJob(data: VipSegmentationJobData): Promise<Job> {
  const queue = getQueue();
  return queue.add('vip-segmentation', data, {
    priority: 2,
  });
}

export async function addVipCalendarAlignmentJob(data: VipCalendarAlignmentJobData): Promise<Job> {
  const queue = getQueue();
  return queue.add('vip-calendar-alignment', data, {
    priority: 2,
  });
}

export async function addVipTranscriptionJob(data: VipTranscriptionJobData): Promise<Job> {
  const queue = getQueue();
  return queue.add('vip-transcription', data, {
    priority: 2,
  });
}

export async function addVipExtractionJob(data: VipExtractionJobData): Promise<Job> {
  const queue = getQueue();
  return queue.add('vip-extraction', data, {
    priority: 3,
  });
}

export async function addVipVaultWriterJob(data: VipVaultWriterJobData): Promise<Job> {
  const queue = getQueue();
  return queue.add('vip-vault-writer', data, {
    priority: 3,
  });
}

export async function addVipNotificationJob(data: VipNotificationJobData): Promise<Job> {
  const queue = getQueue();
  return queue.add('vip-notification', data, {
    priority: 4,
  });
}

export async function addVipSpeakerEmbeddingJob(data: VipSpeakerEmbeddingJobData): Promise<Job> {
  const queue = getQueue();
  return queue.add('vip-speaker-embedding', data, {
    priority: 3, // Same priority as extraction
  });
}

// ============================================
// Remarkable Pipeline Jobs
// ============================================

export async function addRemarkableSyncJob(data: RemarkableSyncJobData): Promise<Job> {
  const queue = getQueue();
  return queue.add('remarkable-sync', data, {
    priority: 2,
    jobId: `remarkable-sync-${Date.now()}`, // Ensure unique job for each sync
  });
}

export async function addRemarkableOcrJob(data: RemarkableOcrJobData): Promise<Job> {
  const queue = getQueue();
  return queue.add('remarkable-ocr', data, {
    priority: 2,
    jobId: `remarkable-ocr-${data.remarkableNoteId}`,
  });
}

export async function addRemarkableMergeJob(data: RemarkableMergeJobData): Promise<Job> {
  const queue = getQueue();
  return queue.add('remarkable-merge', data, {
    priority: 3,
    jobId: `remarkable-merge-${data.classCode}-${data.noteDate}`,
  });
}

// ============================================
// Queue Status
// ============================================

export async function getQueueStatus(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const queue = getQueue();
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);
  
  return { waiting, active, completed, failed, delayed };
}

export async function getRecentJobs(limit = 20): Promise<Job[]> {
  const queue = getQueue();
  const jobs = await queue.getJobs(['completed', 'failed', 'active', 'waiting'], 0, limit);
  return jobs;
}

// ============================================
// Cleanup
// ============================================

export async function closeQueue(): Promise<void> {
  if (mainQueue) {
    await mainQueue.close();
    mainQueue = null;
  }
  if (queueEvents) {
    await queueEvents.close();
    queueEvents = null;
  }
  console.log('[Queue] Closed all connections');
}

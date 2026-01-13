/**
 * JD Agent - Job Worker
 * 
 * Background job processor for:
 * - Transcription (Deepgram)
 * - Summarization (Claude/OpenAI)
 * - OCR processing (Google Vision)
 * - Email triage
 * - Task extraction
 * - Recording pipeline
 */

import { Worker, Job } from 'bullmq';
import {
  getRedisConnectionOptions,
  closeQueue,
  addTranscriptionJob,
  type TranscriptionJobData,
  type SummarizationJobData,
  type OcrJobData,
  type EmailTriageJobData,
  type TaskExtractionJobData,
  type RecordingProcessJobData,
  type TestingSessionJobData,
  type RecurrenceGenerateJobData,
} from './jobs/queue';
import {
  processTranscriptionJob,
  processSummarizationJob,
  processTaskExtractionJob,
  processEmailTriageJob,
  processTestingSessionJob,
  processRecurrenceGenerateJob,
  processRecurrenceBatchJob,
} from './jobs/processors';
import {
  processVipIngestionJob,
  processVipSegmentationJob,
  processVipCalendarAlignmentJob,
  processVipTranscriptionJob,
  processVipExtractionJob,
  processVipVaultWriterJob,
  processVipNotificationJob,
  processVipSpeakerEmbeddingJob,
} from './jobs/processors/vip';

// ============================================
// Worker Configuration
// ============================================

const QUEUE_NAME = 'jd-agent-jobs';
const CONCURRENCY = 3;

// ============================================
// Job Processor
// ============================================

async function processJob(job: Job): Promise<any> {
  const startTime = Date.now();
  console.log(`[Worker] Processing job ${job.id} (${job.name})`);

  try {
    let result: any;

    switch (job.name) {
      case 'transcription':
        result = await processTranscriptionJob(job as Job<TranscriptionJobData>);
        break;

      case 'summarization':
        result = await processSummarizationJob(job as Job<SummarizationJobData>);
        break;

      case 'task-extraction':
        result = await processTaskExtractionJob(job as Job<TaskExtractionJobData>);
        break;

      case 'email-triage':
        result = await processEmailTriageJob(job as Job<EmailTriageJobData>);
        break;

      case 'recording-process':
        // Recording process is a meta-job that queues transcription
        const data = job.data as RecordingProcessJobData;
        await addTranscriptionJob({
          recordingId: data.recordingId,
          filePath: data.filePath,
        });
        result = { success: true, queued: 'transcription' };
        break;

      case 'vip-ingestion':
        result = await processVipIngestionJob(job as Job<any>);
        break;

      case 'vip-segmentation':
        result = await processVipSegmentationJob(job as Job<any>);
        break;

      case 'vip-calendar-alignment':
        result = await processVipCalendarAlignmentJob(job as Job<any>);
        break;

      case 'vip-transcription':
        result = await processVipTranscriptionJob(job as Job<any>);
        break;

      case 'vip-extraction':
        result = await processVipExtractionJob(job as Job<any>);
        break;

      case 'vip-vault-writer':
        result = await processVipVaultWriterJob(job as Job<any>);
        break;

      case 'vip-notification':
        result = await processVipNotificationJob(job as Job<any>);
        break;

      case 'vip-speaker-embedding':
        result = await processVipSpeakerEmbeddingJob(job as Job<any>);
        break;

      case 'ocr':
        // OCR processing - handled by remarkable integration
        console.log(`[Worker] OCR job ${job.id} - delegating to Remarkable integration`);
        result = { success: true, note: 'OCR handled by Remarkable integration' };
        break;

      case 'embedding':
        // Embedding generation - future implementation
        console.log(`[Worker] Embedding job ${job.id} - not yet implemented`);
        result = { success: true, note: 'Embedding generation not yet implemented' };
        break;

      case 'testing-session':
        result = await processTestingSessionJob(job as Job<TestingSessionJobData>);
        break;

      case 'recurrence-generate':
        result = await processRecurrenceGenerateJob(job as Job<RecurrenceGenerateJobData>);
        break;

      case 'recurrence-batch':
        result = await processRecurrenceBatchJob(job);
        break;

      default:
        console.warn(`[Worker] Unknown job type: ${job.name}`);
        result = { success: false, error: `Unknown job type: ${job.name}` };
    }

    const duration = Date.now() - startTime;
    console.log(`[Worker] Job ${job.id} (${job.name}) completed in ${duration}ms`);

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Worker] Job ${job.id} (${job.name}) failed after ${duration}ms:`, error);
    throw error;
  }
}

// ============================================
// Worker Initialization
// ============================================

async function startWorker() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  JD Agent - Job Worker                                       ║
║  Phase 1: Capture & Process                                  ║
╚══════════════════════════════════════════════════════════════╝
`);

  const connection = getRedisConnectionOptions();

  const worker = new Worker(QUEUE_NAME, processJob, {
    connection,
    concurrency: CONCURRENCY,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
    // Increase lock duration for slow AI testing jobs (Ollama local models)
    lockDuration: 600000, // 10 minutes
    stalledInterval: 300000, // 5 minutes
  });

  // Event handlers
  worker.on('ready', () => {
    console.log('[Worker] Ready and waiting for jobs...');
  });

  worker.on('active', (job) => {
    console.log(`[Worker] Job ${job.id} (${job.name}) is now active`);
  });

  worker.on('completed', (job, result) => {
    console.log(`[Worker] Job ${job.id} (${job.name}) completed:`, 
      typeof result === 'object' ? JSON.stringify(result).substring(0, 100) : result);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} (${job?.name}) failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[Worker] Worker error:', err);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[Worker] Shutting down...');
    await worker.close();
    await closeQueue();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  console.log('[Worker] Worker started with concurrency:', CONCURRENCY);
  console.log('[Worker] Processing jobs:');
  console.log('  - transcription (Deepgram)');
  console.log('  - summarization (OpenAI)');
  console.log('  - task-extraction');
  console.log('  - email-triage');
  console.log('  - recording-process');
  console.log('  - vip-ingestion');
  console.log('  - vip-segmentation');
  console.log('  - vip-calendar-alignment');
  console.log('  - vip-transcription');
  console.log('  - vip-extraction');
  console.log('  - vip-vault-writer');
  console.log('  - vip-notification');
  console.log('  - vip-speaker-embedding');
  console.log('  - ocr');
  console.log('  - embedding');
  console.log('  - testing-session (AI Testing Agent)');
  console.log('  - recurrence-generate');
  console.log('  - recurrence-batch');
}

// Start the worker
startWorker().catch((error) => {
  console.error('[Worker] Failed to start:', error);
  process.exit(1);
});

/**
 * Test VIP Pipeline with Real Audio
 *
 * Runs the full pipeline on a real audio file:
 * Upload → Transcribe → Summarize → Extract Tasks → Create Vault Page
 */

import { db } from '../db/client';
import { recordings, recordingBatches, recordingSegments, transcripts, recordingSummaries, tasks, vaultPages, vaultBlocks, classPages, extractedItems } from '../db/schema';
import { eq } from 'drizzle-orm';
import { vipService } from '../services/vip-service';
import { deepgramIntegration } from '../integrations/deepgram';
import { processVipExtractionJob, processVipVaultWriterJob } from '../jobs/processors/vip';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

const AUDIO_FILE = '/Users/jddavenport/Library/Mobile Documents/com~apple~CloudDocs/Downloads/Final Class Reflections_2.mp3';

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  VIP Pipeline - Real Audio Test');
  console.log('='.repeat(60) + '\n');

  // Generate IDs
  const batchId = randomUUID();
  const recordingId = randomUUID();
  const segmentId = randomUUID();

  try {
    // Step 1: Check file exists
    const file = Bun.file(AUDIO_FILE);
    if (!await file.exists()) {
      throw new Error(`File not found: ${AUDIO_FILE}`);
    }
    const fileSize = file.size;
    console.log(`[1/6] Found audio file: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

    // Step 2: Upload to R2
    console.log('[2/6] Uploading to R2...');
    const s3Client = new S3Client({
      region: 'auto',
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY!,
        secretAccessKey: process.env.R2_SECRET_KEY!,
      },
    });

    const storageKey = `vip/${new Date().toISOString().split('T')[0]}/${recordingId}.mp3`;
    const fileContent = await file.arrayBuffer();

    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: storageKey,
      Body: fileContent,
      ContentType: 'audio/mpeg',
    }));
    console.log(`    Uploaded to: ${storageKey}`);

    // Step 3: Create database records
    console.log('[3/6] Creating database records...');
    const batchDate = new Date();
    batchDate.setHours(0, 0, 0, 0);

    await db.insert(recordingBatches).values({
      id: batchId,
      batchDate,
      status: 'processing',
      totalFiles: 1,
      processedFiles: 0,
      totalDurationSeconds: 0,
      startedAt: new Date(),
    });

    await db.insert(recordings).values({
      id: recordingId,
      filePath: storageKey,
      originalFilename: 'Final Class Reflections_2.mp3',
      fileSizeBytes: fileSize,
      recordingType: 'class',
      context: 'Class Reflections',
      status: 'pending',
      recordedAt: new Date(),
      uploadedAt: new Date(),
    });

    await db.insert(recordingSegments).values({
      id: segmentId,
      batchId,
      recordingId,
      startTimeSeconds: 0,
      endTimeSeconds: 0,
      segmentType: 'class',
      className: 'Class Reflections',
      confidenceScore: 1.0,
    });
    console.log('    Created batch, recording, and segment');

    // Step 4: Transcribe with Deepgram
    console.log('[4/6] Transcribing with Deepgram...');
    const audioUrl = await vipService.getFileUrl(storageKey, 3600);
    const transcriptionResult = await deepgramIntegration.transcribeUrl(audioUrl, recordingId);

    if (!transcriptionResult.success) {
      throw new Error(`Transcription failed: ${transcriptionResult.error}`);
    }

    console.log(`    Words: ${transcriptionResult.wordCount}`);
    console.log(`    Speakers: ${transcriptionResult.speakerCount}`);
    console.log(`    Duration: ${Math.round((transcriptionResult.duration || 0) / 60)} minutes`);

    // Update recording with duration
    await db.update(recordings)
      .set({
        status: 'summarizing',
        durationSeconds: Math.round(transcriptionResult.duration || 0),
      })
      .where(eq(recordings.id, recordingId));

    await db.update(recordingSegments)
      .set({ endTimeSeconds: transcriptionResult.duration || 0 })
      .where(eq(recordingSegments.id, segmentId));

    // Step 5: Run extraction (summary + tasks)
    console.log('[5/6] Generating summary and extracting tasks...');
    const extractionResult = await processVipExtractionJob({
      data: { batchId, segmentIds: [segmentId] },
    } as any);
    console.log(`    Summaries: ${extractionResult.summariesCreated}`);
    console.log(`    Tasks extracted: ${extractionResult.tasksCreated}`);

    // Step 6: Create Vault page
    console.log('[6/6] Creating Vault page...');
    const vaultResult = await processVipVaultWriterJob({
      data: { batchId },
    } as any);
    console.log(`    Pages created: ${vaultResult.pagesCreated}`);

    // Show results
    console.log('\n' + '='.repeat(60));
    console.log('  Results');
    console.log('='.repeat(60) + '\n');

    // Get summary
    const [summary] = await db.select().from(recordingSummaries)
      .where(eq(recordingSummaries.recordingId, recordingId));

    if (summary) {
      console.log('SUMMARY:');
      console.log(summary.summary?.substring(0, 500) + '...\n');

      console.log('KEY POINTS:');
      for (const point of (summary.keyPoints || []).slice(0, 5)) {
        console.log(`  • ${point}`);
      }
      console.log('');
    }

    // Get tasks
    const extractedTasks = await db.select().from(tasks)
      .where(eq(tasks.sourceRef, `recording:${recordingId}`));

    if (extractedTasks.length > 0) {
      console.log('EXTRACTED TASKS:');
      for (const task of extractedTasks) {
        const due = task.dueDate ? ` (due: ${task.dueDate.toLocaleDateString()})` : '';
        console.log(`  • ${task.title}${due}`);
      }
      console.log('');
    }

    // Get vault page
    const [classPage] = await db.select().from(classPages)
      .where(eq(classPages.batchId, batchId));

    if (classPage) {
      const [page] = await db.select().from(vaultPages)
        .where(eq(vaultPages.id, classPage.vaultPageId));

      if (page) {
        console.log(`VAULT PAGE: ${page.icon} ${page.title}`);

        const blocks = await db.select().from(vaultBlocks)
          .where(eq(vaultBlocks.pageId, page.id));
        console.log(`  ${blocks.length} content blocks created`);
      }
    }

    console.log('\n✅ Pipeline completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Pipeline failed:', error);

    // Cleanup on error
    await db.delete(extractedItems).where(eq(extractedItems.batchId, batchId)).catch(() => {});
    await db.delete(classPages).where(eq(classPages.batchId, batchId)).catch(() => {});
    await db.delete(recordingSummaries).where(eq(recordingSummaries.recordingId, recordingId)).catch(() => {});
    await db.delete(transcripts).where(eq(transcripts.recordingId, recordingId)).catch(() => {});
    await db.delete(recordingSegments).where(eq(recordingSegments.batchId, batchId)).catch(() => {});
    await db.delete(recordings).where(eq(recordings.id, recordingId)).catch(() => {});
    await db.delete(recordingBatches).where(eq(recordingBatches.id, batchId)).catch(() => {});

    process.exit(1);
  }

  process.exit(0);
}

main();

/**
 * VIP Pipeline Test Script
 *
 * Tests the VIP pipeline end-to-end by:
 * 1. Creating test data (batch, recording, transcript)
 * 2. Running through extraction, vault writer, and notification
 * 3. Verifying results
 *
 * Usage: bun run src/scripts/test-vip-pipeline.ts
 */

import { db } from '../db/client';
import {
  recordingBatches,
  recordings,
  transcripts,
  recordingSegments,
  calendarEvents,
  extractedItems,
  classPages,
  vaultPages,
  vaultBlocks,
  recordingSummaries,
  tasks,
} from '../db/schema';
import { eq, desc, like } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// Generate test UUIDs (consistent for cleanup)
const TEST_BATCH_ID = '00000000-0000-0000-0000-000000000001';
const TEST_RECORDING_ID = '00000000-0000-0000-0000-000000000002';
const TEST_SEGMENT_ID = '00000000-0000-0000-0000-000000000003';
const TEST_TRANSCRIPT_ID = '00000000-0000-0000-0000-000000000004';
const TEST_CALENDAR_EVENT_ID = '00000000-0000-0000-0000-000000000005';
import {
  processVipSegmentationJob,
  processVipCalendarAlignmentJob,
  processVipExtractionJob,
  processVipVaultWriterJob,
  processVipNotificationJob,
} from '../jobs/processors/vip';

// ============================================
// Test Data
// ============================================

const TEST_TRANSCRIPT = `
Good morning everyone. Today we're going to discuss the basics of game theory and Nash Equilibrium.

First, let's define what a Nash Equilibrium is. It's a concept in game theory where no player can benefit by changing their strategy while the other players keep theirs unchanged.

Let me give you a classic example - the prisoner's dilemma. Two prisoners are interrogated separately. Each can either cooperate with the other by staying silent, or defect by testifying against them.

The key insight here is that the Nash Equilibrium is for both to defect, even though mutual cooperation would give a better outcome for both.

Now, for your assignment this week, I want you to complete the survey on Canvas by Friday. It's worth 5% of your grade.

Also, please read chapter 5 before our next class on Tuesday. We'll be doing a case study analysis.

Are there any questions? Yes, in the back?

Student: Can you explain how this applies to business strategy?

Great question. In business, Nash Equilibrium helps us understand competitive dynamics. Think about pricing decisions - if your competitor lowers prices, what should you do?

We'll cover more of these business applications next week. Remember - survey due Friday, read chapter 5 for Tuesday.

Class dismissed.
`;

// ============================================
// Helper Functions
// ============================================

async function cleanup() {
  console.log('[Test] Cleaning up previous test data...');

  // Delete test data in reverse order of dependencies
  // Vault blocks cleanup handled by cascade from vault pages
  await db.delete(classPages).where(eq(classPages.batchId, TEST_BATCH_ID)).execute().catch(() => {});
  await db.delete(extractedItems).where(eq(extractedItems.batchId, TEST_BATCH_ID)).execute().catch(() => {});
  await db.delete(recordingSummaries).where(eq(recordingSummaries.recordingId, TEST_RECORDING_ID)).execute().catch(() => {});
  await db.delete(transcripts).where(eq(transcripts.recordingId, TEST_RECORDING_ID)).execute().catch(() => {});
  await db.delete(recordingSegments).where(eq(recordingSegments.batchId, TEST_BATCH_ID)).execute().catch(() => {});
  await db.delete(recordings).where(eq(recordings.id, TEST_RECORDING_ID)).execute().catch(() => {});
  await db.delete(recordingBatches).where(eq(recordingBatches.id, TEST_BATCH_ID)).execute().catch(() => {});

  // Clean up tasks created by the test
  await db.delete(tasks).where(eq(tasks.sourceRef, `recording:${TEST_RECORDING_ID}`)).execute().catch(() => {});

  // Clean up calendar event
  await db.delete(calendarEvents).where(eq(calendarEvents.id, TEST_CALENDAR_EVENT_ID)).execute().catch(() => {});

  console.log('[Test] Cleanup complete');
}

async function createTestData() {
  console.log('[Test] Creating test data...');

  const batchDate = new Date();
  batchDate.setHours(0, 0, 0, 0);

  // Create test batch
  await db.insert(recordingBatches).values({
    id: TEST_BATCH_ID,
    batchDate,
    status: 'processing',
    totalFiles: 1,
    processedFiles: 0,
    totalDurationSeconds: 1800, // 30 minutes
    startedAt: new Date(),
  });
  console.log('[Test] Created batch: test-batch-id');

  // Create test recording
  const recordedAt = new Date();
  recordedAt.setHours(14, 0, 0, 0); // 2:00 PM

  await db.insert(recordings).values({
    id: TEST_RECORDING_ID,
    filePath: 'test/test-recording.mp3',
    originalFilename: 'MBA501-Lecture-GameTheory.mp3',
    durationSeconds: 1800,
    fileSizeBytes: 5000000,
    recordingType: 'class',
    context: 'MBA 501 - Game Theory',
    status: 'pending',
    recordedAt,
    uploadedAt: new Date(),
  });
  console.log('[Test] Created recording: test-recording-id');

  // Create test calendar event (to test alignment)
  const eventStart = new Date(recordedAt);
  const eventEnd = new Date(recordedAt.getTime() + 75 * 60 * 1000); // 1h 15m later

  try {
    await db.insert(calendarEvents).values({
      id: TEST_CALENDAR_EVENT_ID,
      googleEventId: 'test-google-event-123',
      title: 'MBA 501 - Managerial Economics',
      description: 'Game Theory lecture',
      startTime: eventStart,
      endTime: eventEnd,
      location: 'Room 301',
      eventType: 'class',
    });
    console.log('[Test] Created calendar event: test-calendar-event-id');
  } catch (e) {
    console.log('[Test] Calendar event already exists or error:', (e as Error).message);
  }

  // Create test segment (linked to calendar event)
  await db.insert(recordingSegments).values({
    id: TEST_SEGMENT_ID,
    batchId: TEST_BATCH_ID,
    recordingId: TEST_RECORDING_ID,
    startTimeSeconds: 0,
    endTimeSeconds: 1800,
    segmentType: 'class',
    calendarEventId: TEST_CALENDAR_EVENT_ID,
    className: 'MBA 501',
    confidenceScore: 1.0,
  });
  console.log('[Test] Created segment: test-segment-id (linked to calendar event)');

  // Create test transcript (simulating Deepgram output)
  await db.insert(transcripts).values({
    id: TEST_TRANSCRIPT_ID,
    recordingId: TEST_RECORDING_ID,
    fullText: TEST_TRANSCRIPT,
    segments: [
      { start: 0, end: 60, text: 'Good morning everyone. Today we\'re going to discuss the basics of game theory and Nash Equilibrium.', speaker: 0 },
      { start: 60, end: 180, text: 'First, let\'s define what a Nash Equilibrium is. It\'s a concept in game theory where no player can benefit by changing their strategy while the other players keep theirs unchanged.', speaker: 0 },
      { start: 180, end: 300, text: 'Let me give you a classic example - the prisoner\'s dilemma. Two prisoners are interrogated separately.', speaker: 0 },
      { start: 300, end: 420, text: 'The key insight here is that the Nash Equilibrium is for both to defect.', speaker: 0 },
      { start: 420, end: 500, text: 'Now, for your assignment this week, I want you to complete the survey on Canvas by Friday.', speaker: 0 },
      { start: 500, end: 580, text: 'Also, please read chapter 5 before our next class on Tuesday.', speaker: 0 },
      { start: 580, end: 620, text: 'Are there any questions? Yes, in the back?', speaker: 0 },
      { start: 620, end: 680, text: 'Can you explain how this applies to business strategy?', speaker: 1 },
      { start: 680, end: 800, text: 'Great question. In business, Nash Equilibrium helps us understand competitive dynamics.', speaker: 0 },
      { start: 800, end: 900, text: 'Remember - survey due Friday, read chapter 5 for Tuesday. Class dismissed.', speaker: 0 },
    ],
    wordCount: 250,
    speakerCount: 2,
    confidenceScore: 0.95,
  });
  console.log('[Test] Created transcript: test-transcript-id');

  // Update recording status to summarizing (simulating transcription complete)
  await db.update(recordings)
    .set({ status: 'summarizing' })
    .where(eq(recordings.id, TEST_RECORDING_ID));

  console.log('[Test] Test data created successfully');
}

// ============================================
// Test Runner
// ============================================

async function runTest() {
  console.log('\n' + '='.repeat(60));
  console.log('  VIP Pipeline End-to-End Test');
  console.log('='.repeat(60) + '\n');

  try {
    // Step 1: Cleanup
    await cleanup();

    // Step 2: Create test data
    await createTestData();

    // Step 3: Run Extraction (skip segmentation/transcription since we have test data)
    console.log('\n[Test] Running VIP Extraction...');
    const extractionResult = await processVipExtractionJob({
      data: { batchId: TEST_BATCH_ID, segmentIds: [TEST_SEGMENT_ID] },
    } as any);
    console.log('[Test] Extraction result:', JSON.stringify(extractionResult, null, 2));

    // Check what was created
    const summaries = await db.select().from(recordingSummaries)
      .where(eq(recordingSummaries.recordingId, TEST_RECORDING_ID));
    console.log(`[Test] Summaries created: ${summaries.length}`);
    if (summaries[0]) {
      console.log('[Test] Summary preview:', summaries[0].summary?.substring(0, 200) + '...');
      console.log('[Test] Key points:', summaries[0].keyPoints);
    }

    const extractedTasks = await db.select().from(tasks)
      .where(eq(tasks.sourceRef, `recording:${TEST_RECORDING_ID}`));
    console.log(`[Test] Tasks extracted: ${extractedTasks.length}`);
    for (const task of extractedTasks) {
      console.log(`  - ${task.title} (due: ${task.dueDate || 'no date'})`);
    }

    // Step 4: Run Vault Writer
    console.log('\n[Test] Running VIP Vault Writer...');
    const vaultResult = await processVipVaultWriterJob({
      data: { batchId: TEST_BATCH_ID },
    } as any);
    console.log('[Test] Vault Writer result:', JSON.stringify(vaultResult, null, 2));

    // Check created pages
    const pages = await db.select().from(classPages)
      .where(eq(classPages.batchId, TEST_BATCH_ID));
    console.log(`[Test] Vault pages created: ${pages.length}`);

    if (pages[0]?.vaultPageId) {
      const [vaultPage] = await db.select().from(vaultPages)
        .where(eq(vaultPages.id, pages[0].vaultPageId));
      if (vaultPage) {
        console.log(`[Test] Vault page: ${vaultPage.icon} ${vaultPage.title}`);

        const blocks = await db.select().from(vaultBlocks)
          .where(eq(vaultBlocks.pageId, vaultPage.id));
        console.log(`[Test] Blocks created: ${blocks.length}`);
        for (const block of blocks.slice(0, 5)) {
          console.log(`  - ${block.type}: ${JSON.stringify(block.content).substring(0, 80)}...`);
        }
      }
    }

    // Step 5: Run Notification (will log but won't send without Telegram config)
    console.log('\n[Test] Running VIP Notification...');
    const notificationResult = await processVipNotificationJob({
      data: { batchId: TEST_BATCH_ID, notificationType: 'telegram' },
    } as any);
    console.log('[Test] Notification result:', JSON.stringify(notificationResult, null, 2));

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('  Test Results Summary');
    console.log('='.repeat(60));

    const finalBatch = await db.select().from(recordingBatches)
      .where(eq(recordingBatches.id, TEST_BATCH_ID));

    if (finalBatch[0]) {
      console.log(`
Batch Status: ${finalBatch[0].status}
Total Files: ${finalBatch[0].totalFiles}
Segments Created: ${finalBatch[0].segmentsCreated}
Transcripts Created: ${finalBatch[0].transcriptsCreated}
Vault Pages Created: ${finalBatch[0].vaultPagesCreated}
Tasks Created: ${finalBatch[0].tasksCreated}
`);
    }

    console.log('✅ VIP Pipeline test completed successfully!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

// Run the test
runTest()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

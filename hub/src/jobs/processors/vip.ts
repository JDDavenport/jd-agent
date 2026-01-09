/**
 * JD Agent - VIP Pipeline Job Processors
 *
 * Background job processors for the Vault Ingestion Pipeline.
 * Phase 0 Implementation - Basic end-to-end pipeline
 */

import { Job } from 'bullmq';
import {
  VipIngestionJobData,
  VipSegmentationJobData,
  VipCalendarAlignmentJobData,
  VipTranscriptionJobData,
  VipExtractionJobData,
  VipVaultWriterJobData,
  VipNotificationJobData,
  VipSpeakerEmbeddingJobData,
} from '../queue';
import { vipService } from '../../services/vip-service';
import {
  addVipSegmentationJob,
  addVipCalendarAlignmentJob,
  addVipTranscriptionJob,
  addVipExtractionJob,
  addVipVaultWriterJob,
  addVipNotificationJob,
  addVipSpeakerEmbeddingJob,
} from '../queue';
import { db } from '../../db/client';
import {
  recordings,
  recordingSegments,
  transcripts,
  recordingSummaries,
  calendarEvents,
  vaultPages,
  vaultBlocks,
  classPages,
  extractedItems,
  tasks,
  recordingBatches,
  speakerMappings,
  voiceProfiles,
} from '../../db/schema';
import { eq, and, gte, lte, desc, sql, inArray } from 'drizzle-orm';
import { deepgramIntegration } from '../../integrations/deepgram';
import { getLLMProviderChain } from '../../lib/providers';
import { getTelegramBot } from '../../integrations/telegram-bot';
import { voiceCommandService } from '../../services/voice-command-service';
import { speakerEmbeddingService } from '../../services/speaker-embedding-service';

// ============================================
// Helper Functions
// ============================================

/**
 * Format duration in seconds to human readable string
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Extract course code from calendar event title
 * Matches patterns like: MBA 501, CS401, ECON 301, etc.
 */
function extractCourseCode(title: string): string | null {
  const match = title.match(/[A-Z]{2,4}\s?\d{3,4}/i);
  return match ? match[0].replace(/\s/g, ' ').toUpperCase() : null;
}

/**
 * Determine segment type from calendar event
 */
function determineSegmentType(
  eventTitle: string | null,
  eventType: string | null
): 'class' | 'meeting' | 'conversation' | 'other' {
  if (!eventTitle) return 'other';

  const lowerTitle = eventTitle.toLowerCase();

  // Check for class indicators
  if (
    extractCourseCode(eventTitle) ||
    lowerTitle.includes('class') ||
    lowerTitle.includes('lecture') ||
    lowerTitle.includes('seminar')
  ) {
    return 'class';
  }

  // Check for meeting indicators
  if (
    lowerTitle.includes('meeting') ||
    lowerTitle.includes('call') ||
    lowerTitle.includes('1:1') ||
    lowerTitle.includes('sync') ||
    eventType === 'meeting'
  ) {
    return 'meeting';
  }

  return 'other';
}

/**
 * Format transcript segments with speaker labels
 */
function formatTranscriptWithSpeakers(
  segments: Array<{ start: number; end: number; text: string; speaker?: number }>,
  speakerNames?: Map<number, string>
): string {
  if (!segments || segments.length === 0) return '';

  let result = '';
  let currentSpeaker: number | undefined = undefined;

  for (const segment of segments) {
    // Add speaker label when speaker changes
    if (segment.speaker !== currentSpeaker) {
      currentSpeaker = segment.speaker;
      const timestamp = formatTimestamp(segment.start);

      // Use speaker name if available, otherwise fallback to "Speaker N"
      const speakerLabel = speakerNames?.get(currentSpeaker ?? 0)
        || `Speaker ${(currentSpeaker ?? 0) + 1}`;

      result += `\n**[${timestamp}] ${speakerLabel}:**\n`;
    }

    result += segment.text + ' ';
  }

  return result.trim();
}

/**
 * Get speaker names for a transcript from voice profile mappings
 * Returns a Map of Deepgram speaker ID -> profile name
 */
async function getSpeakerNamesForTranscript(transcriptId: string): Promise<Map<number, string>> {
  const speakerMap = new Map<number, string>();

  try {
    // Get all speaker mappings for this transcript that have a voice profile
    const mappings = await db
      .select({
        deepgramSpeakerId: speakerMappings.deepgramSpeakerId,
        profileName: voiceProfiles.name,
      })
      .from(speakerMappings)
      .innerJoin(voiceProfiles, eq(speakerMappings.voiceProfileId, voiceProfiles.id))
      .where(eq(speakerMappings.transcriptId, transcriptId));

    for (const mapping of mappings) {
      speakerMap.set(mapping.deepgramSpeakerId, mapping.profileName);
    }
  } catch (error) {
    console.error(`[VIP] Error fetching speaker names for transcript ${transcriptId}:`, error);
    // Return empty map on error - will fallback to "Speaker N"
  }

  return speakerMap;
}

/**
 * Format timestamp in MM:SS or HH:MM:SS format
 */
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// ============================================
// VIP Ingestion Job Processor
// ============================================

export async function processVipIngestionJob(job: Job<VipIngestionJobData>): Promise<any> {
  const { batchId, batchDate } = job.data;

  console.log(`[VIP] Processing ingestion for batch ${batchId}`);

  try {
    // Get batch status to check current state
    const batch = await vipService.getBatchStatus(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    if (batch.status === 'complete') {
      console.log(`[VIP] Batch ${batchId} already complete`);
      return { success: true, skipped: true };
    }

    // Queue next step: segmentation
    await addVipSegmentationJob({ batchId });

    console.log(`[VIP] Ingestion complete for batch ${batchId}, queued segmentation`);
    return { success: true, nextStep: 'segmentation' };
  } catch (error) {
    console.error(`[VIP] Ingestion failed for batch ${batchId}:`, error);
    await vipService.failBatch(batchId, String(error));
    throw error;
  }
}

// ============================================
// VIP Segmentation Job Processor
// ============================================

export async function processVipSegmentationJob(job: Job<VipSegmentationJobData>): Promise<any> {
  const { batchId } = job.data;

  console.log(`[VIP] Processing segmentation for batch ${batchId}`);

  try {
    // Get batch info
    const batch = await vipService.getBatchStatus(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    // Get all recordings for this batch date
    const batchDate = new Date(batch.batchDate);
    const startOfDay = new Date(batchDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(batchDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Find recordings that were uploaded for this batch date
    const batchRecordings = await db
      .select()
      .from(recordings)
      .where(
        and(
          gte(recordings.recordedAt, startOfDay),
          lte(recordings.recordedAt, endOfDay),
          eq(recordings.status, 'pending')
        )
      );

    console.log(`[VIP] Found ${batchRecordings.length} recordings for batch ${batchId}`);

    if (batchRecordings.length === 0) {
      console.log(`[VIP] No recordings found for batch date ${batchDate.toISOString()}`);
      // Still continue pipeline to allow for empty batches
    }

    // Create one segment per recording (simple 1:1 for Phase 0)
    // In future phases, we'll split by silence detection, speaker changes, etc.
    const createdSegments: string[] = [];

    for (const recording of batchRecordings) {
      // Create a segment for the entire recording
      const [segment] = await db
        .insert(recordingSegments)
        .values({
          batchId,
          recordingId: recording.id,
          startTimeSeconds: 0,
          endTimeSeconds: recording.durationSeconds || 0,
          segmentType: recording.recordingType || 'other',
          confidenceScore: 1.0,
        })
        .returning();

      createdSegments.push(segment.id);
      console.log(`[VIP] Created segment ${segment.id} for recording ${recording.id}`);

      // Update recording status
      await db
        .update(recordings)
        .set({ status: 'transcribing' })
        .where(eq(recordings.id, recording.id));
    }

    // Update batch progress
    await vipService.updateBatchProgress(batchId, {
      segmentsCreated: createdSegments.length,
    });

    // Queue next step: calendar alignment
    await addVipCalendarAlignmentJob({ batchId });

    return {
      success: true,
      segmentsCreated: createdSegments.length,
      nextStep: 'calendar-alignment',
    };
  } catch (error) {
    console.error(`[VIP] Segmentation failed for batch ${batchId}:`, error);
    await vipService.failBatch(batchId, String(error));
    throw error;
  }
}

// ============================================
// VIP Calendar Alignment Job Processor
// ============================================

export async function processVipCalendarAlignmentJob(
  job: Job<VipCalendarAlignmentJobData>
): Promise<any> {
  const { batchId } = job.data;

  console.log(`[VIP] Processing calendar alignment for batch ${batchId}`);

  try {
    // Get batch info
    const batch = await vipService.getBatchStatus(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    // Get segments for this batch
    const segments = await db
      .select()
      .from(recordingSegments)
      .where(eq(recordingSegments.batchId, batchId));

    console.log(`[VIP] Found ${segments.length} segments for calendar alignment`);

    // Get calendar events for the batch date
    const batchDate = new Date(batch.batchDate);
    const events = await vipService.getCalendarEventsForDate(batchDate);

    console.log(`[VIP] Found ${events.length} calendar events for date`);

    let eventsMatched = 0;

    // For each segment, try to find matching calendar event
    for (const segment of segments) {
      // Get the recording to find its recorded timestamp
      const [recording] = await db
        .select()
        .from(recordings)
        .where(eq(recordings.id, segment.recordingId))
        .limit(1);

      if (!recording || !recording.recordedAt) continue;

      const recordingStart = new Date(recording.recordedAt);
      const recordingEnd = new Date(
        recordingStart.getTime() + (recording.durationSeconds || 0) * 1000
      );

      // Find overlapping calendar events
      for (const event of events) {
        const eventStart = new Date(event.startTime);
        const eventEnd = new Date(event.endTime);

        // Check for overlap (recording overlaps with event by at least 50%)
        const overlapStart = Math.max(recordingStart.getTime(), eventStart.getTime());
        const overlapEnd = Math.min(recordingEnd.getTime(), eventEnd.getTime());
        const overlapDuration = Math.max(0, overlapEnd - overlapStart);
        const recordingDuration = recordingEnd.getTime() - recordingStart.getTime();

        if (overlapDuration > 0 && overlapDuration / recordingDuration > 0.3) {
          // Found a match - update segment
          const segmentType = determineSegmentType(event.title, event.eventType);
          const courseCode = extractCourseCode(event.title || '');

          await db
            .update(recordingSegments)
            .set({
              calendarEventId: event.id,
              className: courseCode || event.title,
              segmentType,
              confidenceScore: overlapDuration / recordingDuration,
            })
            .where(eq(recordingSegments.id, segment.id));

          eventsMatched++;
          console.log(
            `[VIP] Matched segment ${segment.id} to event: ${event.title} (${segmentType})`
          );
          break; // Only match to first overlapping event
        }
      }
    }

    // Update batch progress
    await vipService.updateBatchProgress(batchId, {
      calendarEventsMatched: eventsMatched,
    });

    // Get segment IDs for transcription
    const segmentIds = segments.map((s) => s.id);

    // Queue next step: transcription
    await addVipTranscriptionJob({
      batchId,
      segmentIds,
    });

    return {
      success: true,
      eventsMatched,
      segmentsToTranscribe: segmentIds.length,
      nextStep: 'transcription',
    };
  } catch (error) {
    console.error(`[VIP] Calendar alignment failed for batch ${batchId}:`, error);
    await vipService.failBatch(batchId, String(error));
    throw error;
  }
}

// ============================================
// VIP Transcription Job Processor
// ============================================

export async function processVipTranscriptionJob(job: Job<VipTranscriptionJobData>): Promise<any> {
  const { batchId, segmentIds } = job.data;

  console.log(`[VIP] Processing transcription for batch ${batchId}, segments: ${segmentIds.length}`);

  try {
    if (!deepgramIntegration.isReady()) {
      throw new Error('Deepgram not configured - set DEEPGRAM_API_KEY');
    }

    let transcriptsCreated = 0;

    // Get segments
    const segments =
      segmentIds.length > 0
        ? await db.select().from(recordingSegments).where(inArray(recordingSegments.id, segmentIds))
        : await db.select().from(recordingSegments).where(eq(recordingSegments.batchId, batchId));

    for (const segment of segments) {
      try {
        // Get the recording
        const [recording] = await db
          .select()
          .from(recordings)
          .where(eq(recordings.id, segment.recordingId))
          .limit(1);

        if (!recording) {
          console.warn(`[VIP] Recording ${segment.recordingId} not found for segment ${segment.id}`);
          continue;
        }

        // Check if transcript already exists
        const existingTranscript = await db
          .select()
          .from(transcripts)
          .where(eq(transcripts.recordingId, recording.id))
          .limit(1);

        if (existingTranscript.length > 0) {
          console.log(`[VIP] Transcript already exists for recording ${recording.id}`);
          transcriptsCreated++;
          continue;
        }

        // Get presigned URL for the audio file
        let audioUrl: string;
        try {
          audioUrl = await vipService.getFileUrl(recording.filePath, 3600);
        } catch (urlError) {
          console.warn(`[VIP] Could not get URL for ${recording.filePath}, skipping transcription`);
          continue;
        }

        console.log(`[VIP] Transcribing recording ${recording.id}...`);

        // Call Deepgram for transcription
        const result = await deepgramIntegration.transcribeUrl(audioUrl, recording.id);

        if (result.success) {
          transcriptsCreated++;
          console.log(
            `[VIP] Transcription complete for recording ${recording.id}: ${result.wordCount} words, ${result.speakerCount} speakers`
          );

          // Update recording status
          await db
            .update(recordings)
            .set({ status: 'summarizing' })
            .where(eq(recordings.id, recording.id));
        } else {
          console.error(`[VIP] Transcription failed for recording ${recording.id}: ${result.error}`);
        }
      } catch (segmentError) {
        console.error(`[VIP] Error processing segment ${segment.id}:`, segmentError);
        // Continue with other segments
      }
    }

    // Update batch progress
    await vipService.updateBatchProgress(batchId, {
      transcriptsCreated,
    });

    // Queue next step: extraction
    await addVipExtractionJob({
      batchId,
      segmentIds,
    });

    return {
      success: true,
      transcriptsCreated,
      nextStep: 'extraction',
    };
  } catch (error) {
    console.error(`[VIP] Transcription failed for batch ${batchId}:`, error);
    await vipService.failBatch(batchId, String(error));
    throw error;
  }
}

// ============================================
// VIP Extraction Job Processor
// ============================================

export async function processVipExtractionJob(job: Job<VipExtractionJobData>): Promise<any> {
  const { batchId, segmentIds } = job.data;

  console.log(`[VIP] Processing extraction for batch ${batchId}`);

  try {
    const llm = getLLMProviderChain();
    let tasksCreated = 0;
    let summariesCreated = 0;

    // Get segments with their recordings and transcripts
    const segments =
      segmentIds.length > 0
        ? await db.select().from(recordingSegments).where(inArray(recordingSegments.id, segmentIds))
        : await db.select().from(recordingSegments).where(eq(recordingSegments.batchId, batchId));

    for (const segment of segments) {
      try {
        // Get recording
        const [recording] = await db
          .select()
          .from(recordings)
          .where(eq(recordings.id, segment.recordingId))
          .limit(1);

        if (!recording) continue;

        // Get transcript
        const [transcript] = await db
          .select()
          .from(transcripts)
          .where(eq(transcripts.recordingId, recording.id))
          .limit(1);

        if (!transcript || !transcript.fullText) {
          console.log(`[VIP] No transcript found for recording ${recording.id}`);
          continue;
        }

        // Check if summary already exists
        const existingSummary = await db
          .select()
          .from(recordingSummaries)
          .where(eq(recordingSummaries.recordingId, recording.id))
          .limit(1);

        if (existingSummary.length > 0) {
          console.log(`[VIP] Summary already exists for recording ${recording.id}`);
          summariesCreated++;
          continue;
        }

        // Truncate transcript if too long (keep first ~8000 chars for context window)
        const truncatedTranscript =
          transcript.fullText.length > 8000
            ? transcript.fullText.substring(0, 8000) + '\n\n[Transcript truncated...]'
            : transcript.fullText;

        // Generate summary using LLM
        const segmentType = segment.segmentType || 'recording';
        const className = segment.className || 'Recording';

        const prompt = `Analyze this ${segmentType} transcript and provide a comprehensive summary.

${segmentType === 'class' ? `Class: ${className}` : `Context: ${recording.context || 'General'}`}
Duration: ${formatDuration(recording.durationSeconds || 0)}

TRANSCRIPT:
${truncatedTranscript}

Please provide:
1. SUMMARY: A 2-3 paragraph overview of the main content
2. KEY POINTS: 3-5 bullet points of the most important takeaways
3. ACTION ITEMS: Any tasks, assignments, deadlines, or action items mentioned (list each on a new line starting with "- ")

Format your response as:
## Summary
[Your summary here]

## Key Points
- [Point 1]
- [Point 2]
...

## Action Items
- [Action item 1]
- [Action item 2]
...

If there are no action items, write "None identified."`;

        console.log(`[VIP] Generating summary for recording ${recording.id}...`);

        const response = await llm.chat([{ role: 'user', content: prompt }], undefined, {
          temperature: 0.3,
          maxTokens: 2000,
        });

        if (response.content) {
          // Parse the response
          const summaryMatch = response.content.match(/## Summary\s*([\s\S]*?)(?=## Key Points|$)/i);
          const keyPointsMatch = response.content.match(
            /## Key Points\s*([\s\S]*?)(?=## Action Items|$)/i
          );
          const actionItemsMatch = response.content.match(/## Action Items\s*([\s\S]*?)$/i);

          const summary = summaryMatch ? summaryMatch[1].trim() : response.content;
          const keyPointsText = keyPointsMatch ? keyPointsMatch[1].trim() : '';
          const actionItemsText = actionItemsMatch ? actionItemsMatch[1].trim() : '';

          // Parse key points into array
          const keyPoints = keyPointsText
            .split('\n')
            .filter((line) => line.trim().startsWith('-'))
            .map((line) => line.replace(/^-\s*/, '').trim())
            .filter((point) => point.length > 0);

          // Parse action items
          const actionItems = actionItemsText
            .split('\n')
            .filter((line) => line.trim().startsWith('-'))
            .map((line) => line.replace(/^-\s*/, '').trim())
            .filter(
              (item) => item.length > 0 && !item.toLowerCase().includes('none identified')
            );

          // Save summary to database
          await db.insert(recordingSummaries).values({
            recordingId: recording.id,
            summary,
            keyPoints,
            topicsCovered: keyPoints.slice(0, 5),
            modelUsed: response.model,
          });

          summariesCreated++;
          console.log(`[VIP] Summary created for recording ${recording.id}`);

          // Create tasks from action items
          for (const actionItem of actionItems) {
            // Extract due date if mentioned
            let dueDate: Date | undefined;
            const dateMatch = actionItem.match(
              /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week|this week)\b/i
            );

            if (dateMatch) {
              const today = new Date();
              const dayName = dateMatch[1].toLowerCase();

              if (dayName === 'tomorrow') {
                dueDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);
              } else if (dayName === 'next week') {
                dueDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
              } else {
                // Find next occurrence of the day
                const days = [
                  'sunday',
                  'monday',
                  'tuesday',
                  'wednesday',
                  'thursday',
                  'friday',
                  'saturday',
                ];
                const targetDay = days.indexOf(dayName);
                if (targetDay >= 0) {
                  const currentDay = today.getDay();
                  let daysUntil = targetDay - currentDay;
                  if (daysUntil <= 0) daysUntil += 7;
                  dueDate = new Date(today.getTime() + daysUntil * 24 * 60 * 60 * 1000);
                }
              }
            }

            // Create task
            const [task] = await db
              .insert(tasks)
              .values({
                title: actionItem.substring(0, 200),
                description: `Extracted from ${segmentType}: ${className}\n\nSource: Recording from ${formatDate(new Date(recording.recordedAt || new Date()))}`,
                status: 'inbox',
                priority: 0,
                source: 'plaud',
                sourceRef: `recording:${recording.id}`,
                context: className,
                dueDate: dueDate || undefined,
              })
              .returning();

            // Link to extracted items
            await db.insert(extractedItems).values({
              batchId,
              segmentId: segment.id,
              itemType: 'task',
              content: actionItem,
              taskId: task.id,
              dueDate: dueDate || undefined,
            });

            tasksCreated++;
            console.log(`[VIP] Created task: ${actionItem.substring(0, 50)}...`);
          }

          // Update recording status
          await db
            .update(recordings)
            .set({ status: 'complete', processedAt: new Date() })
            .where(eq(recordings.id, recording.id));
        }

        // Process voice commands from transcript
        if (transcript.segments) {
          console.log(`[VIP] Scanning for voice commands in recording ${recording.id}...`);
          const commandResults = await voiceCommandService.processTranscriptCommands(
            transcript.segments as any[],
            transcript.id,
            recording.id
          );

          if (commandResults.detected > 0) {
            console.log(`[VIP] Voice commands: ${commandResults.detected} detected, ${commandResults.executed} executed, ${commandResults.skipped} skipped`);
            tasksCreated += commandResults.executed;

            // Log each executed command
            for (const { command, result } of commandResults.commands) {
              if (result.success) {
                console.log(`[VIP]   → Created ${command.type}: "${command.parsedIntent.subject.substring(0, 50)}..."`);
              }
            }
          }
        }

        // Queue speaker embedding job for automatic speaker recognition
        // This runs in parallel and won't block the pipeline
        await addVipSpeakerEmbeddingJob({
          batchId,
          transcriptId: transcript.id,
          recordingId: recording.id,
        });
        console.log(`[VIP] Queued speaker embedding job for transcript ${transcript.id}`);
      } catch (segmentError) {
        console.error(`[VIP] Error extracting segment ${segment.id}:`, segmentError);
        // Continue with other segments
      }
    }

    // Update batch progress
    await vipService.updateBatchProgress(batchId, {
      tasksCreated,
    });

    // Queue next step: vault writer
    await addVipVaultWriterJob({ batchId });

    return {
      success: true,
      summariesCreated,
      tasksCreated,
      nextStep: 'vault-writer',
    };
  } catch (error) {
    console.error(`[VIP] Extraction failed for batch ${batchId}:`, error);
    await vipService.failBatch(batchId, String(error));
    throw error;
  }
}

// ============================================
// VIP Vault Writer Job Processor
// ============================================

export async function processVipVaultWriterJob(job: Job<VipVaultWriterJobData>): Promise<any> {
  const { batchId } = job.data;

  console.log(`[VIP] Processing vault writer for batch ${batchId}`);

  try {
    const batch = await vipService.getBatchStatus(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    let pagesCreated = 0;

    // Get segments for this batch
    const segments = await db
      .select()
      .from(recordingSegments)
      .where(eq(recordingSegments.batchId, batchId));

    // Group segments by calendar event (for class pages)
    const segmentsByEvent: Map<string | null, typeof segments> = new Map();
    for (const segment of segments) {
      const key = segment.calendarEventId || null;
      if (!segmentsByEvent.has(key)) {
        segmentsByEvent.set(key, []);
      }
      segmentsByEvent.get(key)!.push(segment);
    }

    // Create a vault page for each group
    for (const [eventId, eventSegments] of segmentsByEvent) {
      try {
        const firstSegment = eventSegments[0];

        // Get recording and transcript
        const [recording] = await db
          .select()
          .from(recordings)
          .where(eq(recordings.id, firstSegment.recordingId))
          .limit(1);

        if (!recording) continue;

        const [transcript] = await db
          .select()
          .from(transcripts)
          .where(eq(transcripts.recordingId, recording.id))
          .limit(1);

        const [summary] = await db
          .select()
          .from(recordingSummaries)
          .where(eq(recordingSummaries.recordingId, recording.id))
          .limit(1);

        // Get calendar event if exists
        let calendarEvent = null;
        if (eventId) {
          [calendarEvent] = await db
            .select()
            .from(calendarEvents)
            .where(eq(calendarEvents.id, eventId))
            .limit(1);
        }

        // Determine page title and type
        const pageTitle =
          calendarEvent?.title ||
          firstSegment.className ||
          `Recording - ${formatDate(new Date(recording.recordedAt || new Date()))}`;

        const pageType = firstSegment.segmentType || 'recording';

        // Check if page already exists
        const existingPage = await db
          .select()
          .from(classPages)
          .where(
            and(
              eq(classPages.batchId, batchId),
              eventId ? eq(classPages.calendarEventId, eventId) : sql`true`
            )
          )
          .limit(1);

        if (existingPage.length > 0) {
          console.log(`[VIP] Vault page already exists for event ${eventId || 'unmatched'}`);
          pagesCreated++;
          continue;
        }

        // Create vault page
        const batchDate = new Date(batch.batchDate);
        const [vaultPage] = await db
          .insert(vaultPages)
          .values({
            title: pageTitle,
            icon: pageType === 'class' ? '📚' : pageType === 'meeting' ? '🤝' : '🎙️',
          })
          .returning();

        // Create content blocks
        const blocks = [];

        // Header block with metadata
        blocks.push({
          pageId: vaultPage.id,
          type: 'callout',
          content: {
            icon: '📅',
            text: `**Date:** ${formatDate(batchDate)}\n**Duration:** ${formatDuration(recording.durationSeconds || 0)}\n**Type:** ${pageType.charAt(0).toUpperCase() + pageType.slice(1)}`,
          },
          sortOrder: 0,
        });

        // Summary section
        if (summary?.summary) {
          blocks.push({
            pageId: vaultPage.id,
            type: 'heading_2',
            content: { text: 'Summary' },
            sortOrder: 1,
          });

          blocks.push({
            pageId: vaultPage.id,
            type: 'text',
            content: { text: summary.summary },
            sortOrder: 2,
          });
        }

        // Key points section
        if (summary?.keyPoints && summary.keyPoints.length > 0) {
          blocks.push({
            pageId: vaultPage.id,
            type: 'heading_2',
            content: { text: 'Key Takeaways' },
            sortOrder: 3,
          });

          for (let i = 0; i < summary.keyPoints.length; i++) {
            blocks.push({
              pageId: vaultPage.id,
              type: 'bulleted_list',
              content: { text: summary.keyPoints[i] },
              sortOrder: 4 + i,
            });
          }
        }

        // Full transcript section
        if (transcript?.fullText) {
          const transcriptSortOrder = 10 + (summary?.keyPoints?.length || 0);

          blocks.push({
            pageId: vaultPage.id,
            type: 'heading_2',
            content: { text: 'Full Transcript' },
            sortOrder: transcriptSortOrder,
          });

          // Get speaker names from voice profiles
          const speakerNames = await getSpeakerNamesForTranscript(transcript.id);
          if (speakerNames.size > 0) {
            console.log(`[VIP] Found ${speakerNames.size} speaker name(s) for transcript`);
          }

          // Format transcript with speakers if available
          const formattedTranscript = transcript.segments
            ? formatTranscriptWithSpeakers(transcript.segments as any[], speakerNames)
            : transcript.fullText;

          // Split transcript into chunks if too long (max ~2000 chars per block)
          const chunks = formattedTranscript.match(/[\s\S]{1,2000}/g) || [formattedTranscript];
          for (let i = 0; i < chunks.length; i++) {
            blocks.push({
              pageId: vaultPage.id,
              type: 'text',
              content: { text: chunks[i] },
              sortOrder: transcriptSortOrder + 1 + i,
            });
          }
        }

        // Insert all blocks
        if (blocks.length > 0) {
          await db.insert(vaultBlocks).values(blocks);
        }

        // Create class page link (only if we have a calendar event)
        if (eventId) {
          await db.insert(classPages).values({
            calendarEventId: eventId,
            vaultPageId: vaultPage.id,
            batchId,
            transcriptContent: transcript?.fullText?.substring(0, 10000),
            summaryContent: summary?.summary,
            keyTakeaways: summary?.keyPoints,
          });
        } else {
          console.log(`[VIP] No calendar event match, skipping class_pages record for page ${vaultPage.id}`);
        }

        pagesCreated++;
        console.log(`[VIP] Created vault page: ${pageTitle}`);
      } catch (pageError) {
        console.error(`[VIP] Error creating page for event ${eventId}:`, pageError);
        // Continue with other pages
      }
    }

    // Update batch progress
    await vipService.updateBatchProgress(batchId, {
      vaultPagesCreated: pagesCreated,
    });

    // Mark batch as complete and queue notification
    await vipService.completeBatch(batchId);
    await addVipNotificationJob({
      batchId,
      notificationType: 'both',
    });

    return {
      success: true,
      pagesCreated,
      nextStep: 'notification',
    };
  } catch (error) {
    console.error(`[VIP] Vault writer failed for batch ${batchId}:`, error);
    await vipService.failBatch(batchId, String(error));
    throw error;
  }
}

// ============================================
// VIP Notification Job Processor
// ============================================

export async function processVipNotificationJob(job: Job<VipNotificationJobData>): Promise<any> {
  const { batchId, notificationType } = job.data;

  console.log(`[VIP] Processing notification for batch ${batchId}, type: ${notificationType}`);

  try {
    // Get final batch status
    const batch = await vipService.getBatchStatus(batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found for notification`);
    }

    // Get segments to count classes vs other
    const segments = await db
      .select()
      .from(recordingSegments)
      .where(eq(recordingSegments.batchId, batchId));

    const classCount = segments.filter((s) => s.segmentType === 'class').length;
    const meetingCount = segments.filter((s) => s.segmentType === 'meeting').length;
    const otherCount = segments.filter((s) => s.segmentType === 'other').length;

    // Get extracted tasks
    const extractedTasks = await db
      .select()
      .from(extractedItems)
      .where(and(eq(extractedItems.batchId, batchId), eq(extractedItems.itemType, 'task')));

    // Get created vault pages
    const pages = await db.select().from(classPages).where(eq(classPages.batchId, batchId));

    // Format notification message
    const batchDate = new Date(batch.batchDate);
    const totalDuration = formatDuration(batch.totalDurationSeconds);

    let message = `🎙️ *Daily Recording Summary*\n`;
    message += `📅 ${formatDate(batchDate)}\n\n`;

    message += `*Overview:*\n`;
    message += `• ${batch.totalFiles} recording(s) processed\n`;
    message += `• Total duration: ${totalDuration}\n`;
    message += `• ${segments.length} segment(s) analyzed\n\n`;

    if (classCount > 0 || meetingCount > 0) {
      message += `*Content:*\n`;
      if (classCount > 0) message += `• 📚 ${classCount} class recording(s)\n`;
      if (meetingCount > 0) message += `• 🤝 ${meetingCount} meeting(s)\n`;
      if (otherCount > 0) message += `• 🎙️ ${otherCount} other recording(s)\n`;
      message += `\n`;
    }

    message += `*Results:*\n`;
    message += `• ${batch.vaultPagesCreated} vault page(s) created\n`;
    message += `• ${batch.tasksCreated} task(s) extracted\n`;

    if (extractedTasks.length > 0) {
      message += `\n*Extracted Tasks:*\n`;
      for (const task of extractedTasks.slice(0, 5)) {
        message += `• ${task.content.substring(0, 60)}${task.content.length > 60 ? '...' : ''}\n`;
      }
      if (extractedTasks.length > 5) {
        message += `• ...and ${extractedTasks.length - 5} more\n`;
      }
    }

    message += `\n✅ All recordings processed and added to Vault`;

    // Send notifications
    let telegramSent = false;
    let emailSent = false;

    if (notificationType === 'telegram' || notificationType === 'both') {
      const telegram = getTelegramBot();
      if (telegram.isConfigured()) {
        const chatId = parseInt(process.env.TELEGRAM_CHAT_ID || '0');
        if (chatId) {
          telegramSent = await telegram.sendMessage(chatId, message);
          console.log(`[VIP] Telegram notification sent: ${telegramSent}`);
        }
      } else {
        console.log('[VIP] Telegram not configured, skipping notification');
      }
    }

    if (notificationType === 'email' || notificationType === 'both') {
      // Email notification placeholder - would integrate with email service
      console.log('[VIP] Email notification placeholder (not yet implemented)');
      // TODO: Integrate with email service when available
    }

    return {
      success: true,
      notificationType,
      telegramSent,
      emailSent,
      batchStats: {
        totalFiles: batch.totalFiles,
        totalDuration: batch.totalDurationSeconds,
        pagesCreated: batch.vaultPagesCreated,
        tasksCreated: batch.tasksCreated,
        classesProcessed: classCount,
        meetingsProcessed: meetingCount,
      },
    };
  } catch (error) {
    console.error(`[VIP] Notification failed for batch ${batchId}:`, error);
    // Don't fail the batch for notification errors - batch is already complete
    throw error;
  }
}

// ============================================
// VIP Speaker Embedding Job Processor
// ============================================

export async function processVipSpeakerEmbeddingJob(
  job: Job<VipSpeakerEmbeddingJobData>
): Promise<any> {
  const { batchId, transcriptId, recordingId } = job.data;

  console.log(
    `[VIP] Processing speaker embedding for transcript ${transcriptId}, recording ${recordingId}`
  );

  try {
    // Check if embedding service is available
    const isReady = await speakerEmbeddingService.isReady();
    if (!isReady) {
      console.warn('[VIP] Embedding service not available, skipping speaker matching');
      return {
        success: true,
        skipped: true,
        reason: 'service_unavailable',
      };
    }

    // Auto-match speakers
    const result = await speakerEmbeddingService.autoMatchSpeakers(transcriptId, recordingId);

    console.log(
      `[VIP] Speaker matching complete: ${result.matched}/${result.total} matched, ` +
        `${result.needsVerification} need verification`
    );

    return {
      success: true,
      ...result,
    };
  } catch (error) {
    console.error(`[VIP] Speaker embedding failed for transcript ${transcriptId}:`, error);
    // Don't fail the batch for embedding errors - it's an enhancement
    return {
      success: false,
      error: String(error),
    };
  }
}

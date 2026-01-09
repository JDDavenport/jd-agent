/**
 * JD Agent - Transcription Job Processor
 * 
 * Handles transcription jobs:
 * 1. Get recording from database
 * 2. Generate presigned URL for audio
 * 3. Send to Deepgram for transcription
 * 4. Store transcript in database
 * 5. Queue summarization job
 */

import { Job } from 'bullmq';
import { db } from '../../db/client';
import { recordings } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { deepgramIntegration } from '../../integrations/deepgram';
import { plaudIntegration } from '../../integrations/plaud';
import { addSummarizationJob } from '../queue';
import type { TranscriptionJobData } from '../queue';

export async function processTranscriptionJob(job: Job<TranscriptionJobData>): Promise<{
  success: boolean;
  transcriptId?: string;
  error?: string;
}> {
  const { recordingId, filePath, audioUrl } = job.data;
  
  console.log(`[Transcription] Processing recording ${recordingId}`);

  try {
    // Update recording status
    await db.update(recordings)
      .set({ status: 'transcribing' })
      .where(eq(recordings.id, recordingId));

    // Get audio URL
    let url = audioUrl;
    
    if (!url && filePath.startsWith('recordings/')) {
      // It's an R2 path, get presigned URL
      url = await plaudIntegration.getPresignedUrl(filePath) || undefined;
    }

    if (!url) {
      throw new Error('Could not get audio URL for transcription');
    }

    // Transcribe
    const result = await deepgramIntegration.transcribeUrl(url, recordingId);

    if (!result.success) {
      throw new Error(result.error || 'Transcription failed');
    }

    // Get recording details for summarization
    const [recording] = await db
      .select()
      .from(recordings)
      .where(eq(recordings.id, recordingId))
      .limit(1);

    // Queue summarization job
    if (result.transcriptId && recording) {
      await addSummarizationJob({
        recordingId,
        transcriptId: result.transcriptId,
        recordingType: (recording.recordingType as 'class' | 'meeting' | 'conversation' | 'other') || 'other',
        context: recording.context || undefined,
      });
      
      console.log(`[Transcription] Queued summarization for ${recordingId}`);
    }

    return {
      success: true,
      transcriptId: result.transcriptId,
    };
  } catch (error) {
    console.error(`[Transcription] Failed for ${recordingId}:`, error);

    // Update recording with error
    await db.update(recordings)
      .set({
        status: 'failed',
        errorMessage: String(error),
        retryCount: (job.attemptsMade || 0) + 1,
      })
      .where(eq(recordings.id, recordingId));

    return {
      success: false,
      error: String(error),
    };
  }
}

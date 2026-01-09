/**
 * JD Agent - Deepgram Integration
 * 
 * Handles audio transcription using Deepgram's Nova-2 model:
 * - Automatic speech recognition
 * - Speaker diarization (identify different speakers)
 * - Punctuation and smart formatting
 * - Paragraph detection
 */

import { createClient, DeepgramClient, PrerecordedSchema, SyncPrerecordedResponse } from '@deepgram/sdk';
import { db } from '../db/client';
import { transcripts, recordings } from '../db/schema';
import { eq } from 'drizzle-orm';

// ============================================
// Types
// ============================================

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: number;
  confidence: number;
}

export interface TranscriptionResult {
  success: boolean;
  transcriptId?: string;
  fullText?: string;
  segments?: TranscriptSegment[];
  wordCount?: number;
  speakerCount?: number;
  confidence?: number;
  duration?: number;
  error?: string;
}

// ============================================
// Deepgram Integration
// ============================================

export class DeepgramIntegration {
  private client: DeepgramClient | null = null;
  private isConfigured = false;

  constructor() {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    
    if (apiKey) {
      this.client = createClient(apiKey);
      this.isConfigured = true;
      console.log('[Deepgram] Integration initialized');
    } else {
      console.log('[Deepgram] Not configured - set DEEPGRAM_API_KEY to enable transcription');
    }
  }

  /**
   * Check if Deepgram is configured
   */
  isReady(): boolean {
    return this.isConfigured && this.client !== null;
  }

  /**
   * Transcribe audio from a URL (e.g., R2/S3 presigned URL)
   */
  async transcribeUrl(audioUrl: string, recordingId?: string): Promise<TranscriptionResult> {
    if (!this.client) {
      return { success: false, error: 'Deepgram not configured' };
    }

    try {
      console.log(`[Deepgram] Transcribing URL: ${audioUrl.substring(0, 50)}...`);

      const options: PrerecordedSchema = {
        model: 'nova-2',
        smart_format: true,
        diarize: true,
        punctuate: true,
        paragraphs: true,
        utterances: true,
        detect_language: true,
      };

      const response = await this.client.listen.prerecorded.transcribeUrl(
        { url: audioUrl },
        options
      );

      if (!response.result) {
        return { success: false, error: 'No result from Deepgram' };
      }

      return this.processResult(response.result, recordingId);
    } catch (error) {
      console.error('[Deepgram] Transcription failed:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Transcribe audio from a file buffer
   */
  async transcribeBuffer(
    buffer: Buffer,
    mimetype: string,
    recordingId?: string
  ): Promise<TranscriptionResult> {
    if (!this.client) {
      return { success: false, error: 'Deepgram not configured' };
    }

    try {
      console.log(`[Deepgram] Transcribing buffer (${buffer.length} bytes)`);

      const options: PrerecordedSchema = {
        model: 'nova-2',
        smart_format: true,
        diarize: true,
        punctuate: true,
        paragraphs: true,
        utterances: true,
        detect_language: true,
      };

      const response = await this.client.listen.prerecorded.transcribeFile(
        buffer,
        options
      );

      if (!response.result) {
        return { success: false, error: 'No result from Deepgram' };
      }

      return this.processResult(response.result, recordingId);
    } catch (error) {
      console.error('[Deepgram] Transcription failed:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Process Deepgram result and store in database
   */
  private async processResult(
    result: SyncPrerecordedResponse,
    recordingId?: string
  ): Promise<TranscriptionResult> {
    const channel = result.results?.channels?.[0];
    const alternative = channel?.alternatives?.[0];

    if (!alternative) {
      return { success: false, error: 'No transcription result' };
    }

    const fullText = alternative.transcript || '';
    const words = alternative.words || [];
    
    // Build segments from paragraphs or utterances
    const segments: TranscriptSegment[] = [];
    
    if (alternative.paragraphs?.paragraphs) {
      for (const paragraph of alternative.paragraphs.paragraphs) {
        for (const sentence of paragraph.sentences || []) {
          segments.push({
            start: sentence.start || 0,
            end: sentence.end || 0,
            text: sentence.text || '',
            speaker: paragraph.speaker,
            confidence: 1.0,
          });
        }
      }
    } else if (words.length > 0) {
      // Fallback: group words by speaker
      let currentSegment: TranscriptSegment | null = null;
      
      for (const word of words) {
        if (!currentSegment || currentSegment.speaker !== word.speaker) {
          if (currentSegment) {
            segments.push(currentSegment);
          }
          currentSegment = {
            start: word.start || 0,
            end: word.end || 0,
            text: word.punctuated_word || word.word || '',
            speaker: word.speaker,
            confidence: word.confidence || 0,
          };
        } else {
          currentSegment.end = word.end || currentSegment.end;
          currentSegment.text += ' ' + (word.punctuated_word || word.word || '');
        }
      }
      
      if (currentSegment) {
        segments.push(currentSegment);
      }
    }

    // Count unique speakers
    const speakers = new Set(segments.map(s => s.speaker).filter(s => s !== undefined));
    const speakerCount = speakers.size || 1;

    // Calculate overall confidence
    const avgConfidence = words.length > 0
      ? words.reduce((sum, w) => sum + (w.confidence || 0), 0) / words.length
      : 0;

    // Get duration
    const duration = result.metadata?.duration || 0;

    // Store in database if recordingId provided
    let transcriptId: string | undefined;
    
    if (recordingId) {
      try {
        const [transcript] = await db.insert(transcripts).values({
          recordingId,
          fullText,
          segments: segments,
          wordCount: words.length,
          speakerCount,
          confidenceScore: avgConfidence,
        }).returning();

        transcriptId = transcript.id;

        // Update recording status
        await db.update(recordings)
          .set({
            status: 'transcribing', // Will be 'summarizing' after summarization
            durationSeconds: Math.round(duration),
          })
          .where(eq(recordings.id, recordingId));

        console.log(`[Deepgram] Stored transcript ${transcriptId} for recording ${recordingId}`);
      } catch (dbError) {
        console.error('[Deepgram] Failed to store transcript:', dbError);
      }
    }

    return {
      success: true,
      transcriptId,
      fullText,
      segments,
      wordCount: words.length,
      speakerCount,
      confidence: avgConfidence,
      duration,
    };
  }

  /**
   * Get a transcript by recording ID
   */
  async getTranscriptByRecording(recordingId: string): Promise<{
    id: string;
    fullText: string;
    segments: TranscriptSegment[];
    wordCount: number;
    speakerCount: number;
  } | null> {
    const result = await db
      .select()
      .from(transcripts)
      .where(eq(transcripts.recordingId, recordingId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const transcript = result[0];
    return {
      id: transcript.id,
      fullText: transcript.fullText,
      segments: (transcript.segments as TranscriptSegment[]) || [],
      wordCount: transcript.wordCount || 0,
      speakerCount: transcript.speakerCount || 1,
    };
  }
}

// ============================================
// Singleton instance
// ============================================

export const deepgramIntegration = new DeepgramIntegration();

/**
 * Speaker Embedding Service
 *
 * Communicates with the Python embedding microservice to:
 * - Extract voice embeddings from audio segments
 * - Store embeddings in voice_profiles and voice_samples tables
 * - Match unknown speakers to known profiles using pgvector
 *
 * Phase 4 of VIP Pipeline: Automatic Speaker Recognition
 */

import { db } from '../db/client';
import {
  voiceProfiles,
  voiceSamples,
  speakerMappings,
  transcripts,
  recordings,
} from '../db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { vipService } from './vip-service';

// Configuration
const EMBEDDING_SERVICE_URL = process.env.EMBEDDING_SERVICE_URL || 'http://localhost:8001';
const CONFIDENCE_THRESHOLD = parseFloat(process.env.SPEAKER_MATCH_THRESHOLD || '0.7');
const HIGH_CONFIDENCE_THRESHOLD = 0.8;
const MIN_SEGMENT_DURATION = 3; // Minimum seconds for reliable embedding

// ============================================
// Types
// ============================================

interface EmbeddingResponse {
  embedding: number[];
  duration_seconds: number;
  model: string;
  dimensions: number;
}

interface BatchEmbeddingResult {
  speaker_id: number;
  embedding: number[];
  duration: number;
}

interface BatchEmbeddingResponse {
  embeddings: BatchEmbeddingResult[];
  model: string;
}

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: number;
}

interface MatchResult {
  profileId: string;
  profileName: string;
  similarity: number;
}

interface AutoMatchStats {
  matched: number;
  total: number;
  needsVerification: number;
}

// ============================================
// Speaker Embedding Service
// ============================================

class SpeakerEmbeddingService {
  /**
   * Check if embedding service is available
   */
  async isReady(): Promise<boolean> {
    try {
      const response = await fetch(`${EMBEDDING_SERVICE_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) return false;

      const data = await response.json();
      return data.ready === true;
    } catch {
      console.warn('[SpeakerEmbedding] Embedding service not available');
      return false;
    }
  }

  /**
   * Extract embedding from audio segment
   */
  async extractEmbedding(
    audioUrl: string,
    startSeconds: number,
    endSeconds: number
  ): Promise<number[] | null> {
    try {
      const response = await fetch(`${EMBEDDING_SERVICE_URL}/embed/segment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_url: audioUrl,
          start_seconds: startSeconds,
          end_seconds: endSeconds,
        }),
        signal: AbortSignal.timeout(120000), // 2 min timeout for audio processing
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[SpeakerEmbedding] Extraction failed:', error);
        return null;
      }

      const result: EmbeddingResponse = await response.json();
      return result.embedding;
    } catch (error) {
      console.error('[SpeakerEmbedding] Extraction error:', error);
      return null;
    }
  }

  /**
   * Extract embeddings for multiple segments in batch
   */
  async extractBatchEmbeddings(
    audioUrl: string,
    segments: Array<{ speaker_id: number; start: number; end: number }>
  ): Promise<Map<number, number[]>> {
    const speakerEmbeddings = new Map<number, number[]>();

    try {
      const response = await fetch(`${EMBEDDING_SERVICE_URL}/embed/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio_url: audioUrl,
          segments,
        }),
        signal: AbortSignal.timeout(300000), // 5 min timeout for batch
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[SpeakerEmbedding] Batch extraction failed:', error);
        return speakerEmbeddings;
      }

      const result: BatchEmbeddingResponse = await response.json();

      for (const item of result.embeddings) {
        speakerEmbeddings.set(item.speaker_id, item.embedding);
      }
    } catch (error) {
      console.error('[SpeakerEmbedding] Batch extraction error:', error);
    }

    return speakerEmbeddings;
  }

  /**
   * Extract embeddings for all speakers in a transcript
   */
  async extractSpeakerEmbeddings(
    transcriptId: string,
    recordingId: string
  ): Promise<Map<number, number[]>> {
    // Get transcript segments
    const [transcript] = await db
      .select()
      .from(transcripts)
      .where(eq(transcripts.id, transcriptId));

    if (!transcript?.segments) {
      console.warn('[SpeakerEmbedding] No segments found for transcript');
      return new Map();
    }

    // Get audio URL
    const [recording] = await db
      .select()
      .from(recordings)
      .where(eq(recordings.id, recordingId));

    if (!recording) {
      console.warn('[SpeakerEmbedding] Recording not found');
      return new Map();
    }

    let audioUrl: string;
    try {
      audioUrl = await vipService.getFileUrl(recording.filePath, 3600);
    } catch {
      console.warn('[SpeakerEmbedding] Could not get audio URL');
      return new Map();
    }

    // Group segments by speaker and find longest segments
    const segments = transcript.segments as TranscriptSegment[];
    const speakerSegments = new Map<number, Array<{ start: number; end: number }>>();

    for (const seg of segments) {
      if (seg.speaker === undefined) continue;

      const duration = seg.end - seg.start;
      if (duration < MIN_SEGMENT_DURATION) continue;

      if (!speakerSegments.has(seg.speaker)) {
        speakerSegments.set(seg.speaker, []);
      }
      speakerSegments.get(seg.speaker)!.push({ start: seg.start, end: seg.end });
    }

    // Build batch request with longest segment per speaker
    const batchSegments: Array<{ speaker_id: number; start: number; end: number }> = [];

    for (const [speakerId, segs] of speakerSegments) {
      // Sort by duration descending
      segs.sort((a, b) => (b.end - b.start) - (a.end - a.start));
      const longestSeg = segs[0];
      batchSegments.push({
        speaker_id: speakerId,
        start: longestSeg.start,
        end: longestSeg.end,
      });
    }

    if (batchSegments.length === 0) {
      console.warn('[SpeakerEmbedding] No valid speaker segments found');
      return new Map();
    }

    // Extract embeddings in batch
    return this.extractBatchEmbeddings(audioUrl, batchSegments);
  }

  /**
   * Create voice sample and extract embedding
   */
  async createVoiceSample(
    voiceProfileId: string,
    transcriptId: string,
    recordingId: string,
    deepgramSpeakerId: number,
    startSeconds: number,
    endSeconds: number
  ): Promise<string | null> {
    // Get audio URL
    const [recording] = await db
      .select()
      .from(recordings)
      .where(eq(recordings.id, recordingId));

    if (!recording) {
      console.error('[SpeakerEmbedding] Recording not found');
      return null;
    }

    let audioUrl: string;
    try {
      audioUrl = await vipService.getFileUrl(recording.filePath, 3600);
    } catch {
      console.error('[SpeakerEmbedding] Could not get audio URL');
      return null;
    }

    // Extract embedding
    const embedding = await this.extractEmbedding(audioUrl, startSeconds, endSeconds);
    if (!embedding) {
      console.error('[SpeakerEmbedding] Failed to extract embedding');
      return null;
    }

    // Store sample with embedding
    const embeddingJson = JSON.stringify(embedding);
    const [sample] = await db
      .insert(voiceSamples)
      .values({
        voiceProfileId,
        transcriptId,
        recordingId,
        deepgramSpeakerId,
        startTimeSeconds: startSeconds,
        endTimeSeconds: endSeconds,
        durationSeconds: endSeconds - startSeconds,
        // Embedding stored via raw SQL to handle vector type
      })
      .returning();

    // Update embedding separately using raw SQL
    await db.execute(sql`
      UPDATE voice_samples
      SET embedding = ${embeddingJson}::vector
      WHERE id = ${sample.id}
    `);

    // Update profile's aggregate embedding
    await this.updateProfileEmbedding(voiceProfileId);

    console.log(`[SpeakerEmbedding] Created voice sample ${sample.id} for profile ${voiceProfileId}`);
    return sample.id;
  }

  /**
   * Update voice profile's aggregate embedding (average of all samples)
   */
  async updateProfileEmbedding(voiceProfileId: string): Promise<void> {
    // Calculate average embedding from all samples
    const result = await db.execute(sql`
      SELECT AVG(embedding)::vector as avg_embedding
      FROM voice_samples
      WHERE voice_profile_id = ${voiceProfileId}
      AND embedding IS NOT NULL
    `);

    const row = result.rows[0] as { avg_embedding: string | null } | undefined;
    if (row?.avg_embedding) {
      await db.execute(sql`
        UPDATE voice_profiles
        SET embedding = ${row.avg_embedding}::vector,
            embedding_updated_at = NOW(),
            updated_at = NOW()
        WHERE id = ${voiceProfileId}
      `);
      console.log(`[SpeakerEmbedding] Updated profile embedding for ${voiceProfileId}`);
    }
  }

  /**
   * Find matching voice profile for an embedding using cosine similarity
   */
  async findMatchingProfile(
    embedding: number[],
    threshold: number = CONFIDENCE_THRESHOLD
  ): Promise<MatchResult | null> {
    const embeddingJson = JSON.stringify(embedding);

    // Query pgvector for nearest neighbor using cosine similarity
    const result = await db.execute(sql`
      SELECT
        id,
        name,
        1 - (embedding <=> ${embeddingJson}::vector) as similarity
      FROM voice_profiles
      WHERE embedding IS NOT NULL
        AND is_active = true
      ORDER BY embedding <=> ${embeddingJson}::vector
      LIMIT 1
    `);

    if (result.rows.length === 0) return null;

    const match = result.rows[0] as { id: string; name: string; similarity: number };

    if (match.similarity >= threshold) {
      return {
        profileId: match.id,
        profileName: match.name,
        similarity: match.similarity,
      };
    }

    return null;
  }

  /**
   * Auto-match speakers in a transcript to known voice profiles
   */
  async autoMatchSpeakers(
    transcriptId: string,
    recordingId: string
  ): Promise<AutoMatchStats> {
    const stats: AutoMatchStats = { matched: 0, total: 0, needsVerification: 0 };

    // Check if service is available
    if (!await this.isReady()) {
      console.warn('[SpeakerEmbedding] Embedding service not available, skipping auto-match');
      return stats;
    }

    // Extract embeddings for all speakers
    const speakerEmbeddings = await this.extractSpeakerEmbeddings(transcriptId, recordingId);

    stats.total = speakerEmbeddings.size;

    if (stats.total === 0) {
      console.log('[SpeakerEmbedding] No speaker embeddings extracted');
      return stats;
    }

    for (const [speakerId, embedding] of speakerEmbeddings) {
      const match = await this.findMatchingProfile(embedding);

      if (match) {
        // Check if mapping already exists and is manually assigned
        const [existing] = await db
          .select()
          .from(speakerMappings)
          .where(
            and(
              eq(speakerMappings.transcriptId, transcriptId),
              eq(speakerMappings.deepgramSpeakerId, speakerId)
            )
          );

        if (existing?.manuallyAssigned) {
          // Don't override manual assignments
          console.log(`[SpeakerEmbedding] Skipping speaker ${speakerId} - manually assigned`);
          continue;
        }

        // Determine if needs verification
        const needsVerification = match.similarity < HIGH_CONFIDENCE_THRESHOLD;

        if (existing) {
          // Update existing mapping
          await db
            .update(speakerMappings)
            .set({
              voiceProfileId: match.profileId,
              confidence: match.similarity,
              autoMatched: true,
              needsVerification,
              matchScore: match.similarity,
              assignedAt: new Date(),
              assignedBy: 'auto',
            })
            .where(eq(speakerMappings.id, existing.id));
        } else {
          // Create new mapping
          await db
            .insert(speakerMappings)
            .values({
              transcriptId,
              deepgramSpeakerId: speakerId,
              voiceProfileId: match.profileId,
              confidence: match.similarity,
              autoMatched: true,
              needsVerification,
              matchScore: match.similarity,
              manuallyAssigned: false,
              assignedAt: new Date(),
              assignedBy: 'auto',
            });
        }

        console.log(
          `[SpeakerEmbedding] Auto-matched speaker ${speakerId} → ${match.profileName} ` +
          `(similarity: ${(match.similarity * 100).toFixed(1)}%)`
        );

        stats.matched++;
        if (needsVerification) stats.needsVerification++;
      }
    }

    return stats;
  }

  /**
   * Get unverified auto-matches
   */
  async getUnverifiedMappings(limit: number = 50) {
    return db
      .select({
        mapping: speakerMappings,
        profile: {
          id: voiceProfiles.id,
          name: voiceProfiles.name,
          category: voiceProfiles.category,
        },
      })
      .from(speakerMappings)
      .innerJoin(voiceProfiles, eq(speakerMappings.voiceProfileId, voiceProfiles.id))
      .where(
        and(
          eq(speakerMappings.autoMatched, true),
          eq(speakerMappings.needsVerification, true)
        )
      )
      .orderBy(desc(speakerMappings.createdAt))
      .limit(limit);
  }

  /**
   * Verify or reject an auto-matched speaker mapping
   */
  async verifyMapping(
    mappingId: string,
    options: {
      confirmed?: boolean;
      correctProfileId?: string;
    }
  ): Promise<void> {
    const { confirmed, correctProfileId } = options;

    if (confirmed) {
      // Mark as verified
      await db
        .update(speakerMappings)
        .set({
          needsVerification: false,
          manuallyAssigned: true,
          assignedAt: new Date(),
          assignedBy: 'user',
        })
        .where(eq(speakerMappings.id, mappingId));
    } else if (correctProfileId) {
      // Update to correct profile
      await db
        .update(speakerMappings)
        .set({
          voiceProfileId: correctProfileId,
          needsVerification: false,
          autoMatched: false,
          manuallyAssigned: true,
          assignedAt: new Date(),
          assignedBy: 'user',
        })
        .where(eq(speakerMappings.id, mappingId));
    } else {
      // Remove auto-match (wrong assignment, no correct profile)
      await db
        .update(speakerMappings)
        .set({
          voiceProfileId: null,
          needsVerification: false,
          autoMatched: false,
          matchScore: null,
        })
        .where(eq(speakerMappings.id, mappingId));
    }
  }

  /**
   * Get voice samples for a profile
   */
  async getProfileSamples(voiceProfileId: string) {
    return db
      .select()
      .from(voiceSamples)
      .where(eq(voiceSamples.voiceProfileId, voiceProfileId))
      .orderBy(desc(voiceSamples.createdAt));
  }
}

export const speakerEmbeddingService = new SpeakerEmbeddingService();

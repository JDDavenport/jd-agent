/**
 * JD Agent - Recordings API Routes
 *
 * Endpoints for managing audio recordings:
 * - List recordings with filtering
 * - Get recording details with transcript
 * - Get audio URL for playback
 * - Update speaker labels
 */

import { Hono } from 'hono';
import { db } from '../../db/client';
import { recordings, transcripts, voiceProfiles, speakerMappings } from '../../db/schema';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { plaudIntegration } from '../../integrations/plaud';

const recordingsRouter = new Hono();

// ============================================
// List Recordings
// ============================================

/**
 * GET /api/recordings
 * List all recordings with optional filters
 */
recordingsRouter.get('/', async (c) => {
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  const status = c.req.query('status');
  const type = c.req.query('type');
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');

  try {
    // Build where conditions
    const conditions = [];
    if (status) conditions.push(eq(recordings.status, status));
    if (type) conditions.push(eq(recordings.recordingType, type));
    if (startDate) conditions.push(gte(recordings.recordedAt, new Date(startDate)));
    if (endDate) conditions.push(lte(recordings.recordedAt, new Date(endDate)));

    // Get recordings with transcripts
    const recordingsList = await db
      .select({
        id: recordings.id,
        filePath: recordings.filePath,
        originalFilename: recordings.originalFilename,
        durationSeconds: recordings.durationSeconds,
        fileSizeBytes: recordings.fileSizeBytes,
        recordingType: recordings.recordingType,
        context: recordings.context,
        status: recordings.status,
        recordedAt: recordings.recordedAt,
        uploadedAt: recordings.uploadedAt,
        processedAt: recordings.processedAt,
        errorMessage: recordings.errorMessage,
        hasTranscript: sql<boolean>`EXISTS (SELECT 1 FROM transcripts WHERE transcripts.recording_id = recordings.id)`,
      })
      .from(recordings)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(recordings.recordedAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(recordings)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = Number(countResult[0]?.count || 0);

    return c.json({
      success: true,
      data: recordingsList,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + recordingsList.length < total,
      },
    });
  } catch (error) {
    console.error('[Recordings API] Error listing recordings:', error);
    return c.json({
      success: false,
      error: { code: 'LIST_ERROR', message: String(error) },
    }, 500);
  }
});

// ============================================
// Get Recording Details
// ============================================

/**
 * GET /api/recordings/:id
 * Get single recording with transcript
 */
recordingsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');

  try {
    // Get recording
    const [recording] = await db
      .select()
      .from(recordings)
      .where(eq(recordings.id, id))
      .limit(1);

    if (!recording) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Recording not found' },
      }, 404);
    }

    // Get transcript if exists
    const [transcript] = await db
      .select()
      .from(transcripts)
      .where(eq(transcripts.recordingId, id))
      .limit(1);

    // Get speaker mappings if transcript exists
    let speakerLabels: Record<number, string> = {};
    if (transcript) {
      const mappings = await db
        .select({
          deepgramSpeakerId: speakerMappings.deepgramSpeakerId,
          profileName: voiceProfiles.name,
        })
        .from(speakerMappings)
        .leftJoin(voiceProfiles, eq(speakerMappings.voiceProfileId, voiceProfiles.id))
        .where(eq(speakerMappings.transcriptId, transcript.id));

      speakerLabels = mappings.reduce((acc, m) => {
        if (m.profileName) {
          acc[m.deepgramSpeakerId] = m.profileName;
        }
        return acc;
      }, {} as Record<number, string>);
    }

    return c.json({
      success: true,
      data: {
        ...recording,
        transcript: transcript ? {
          id: transcript.id,
          fullText: transcript.fullText,
          segments: transcript.segments,
          wordCount: transcript.wordCount,
          speakerCount: transcript.speakerCount,
          confidenceScore: transcript.confidenceScore,
          speakerLabels,
        } : null,
      },
    });
  } catch (error) {
    console.error('[Recordings API] Error getting recording:', error);
    return c.json({
      success: false,
      error: { code: 'GET_ERROR', message: String(error) },
    }, 500);
  }
});

// ============================================
// Get Audio URL
// ============================================

/**
 * GET /api/recordings/:id/audio-url
 * Get presigned URL for audio playback
 */
recordingsRouter.get('/:id/audio-url', async (c) => {
  const id = c.req.param('id');

  try {
    const [recording] = await db
      .select()
      .from(recordings)
      .where(eq(recordings.id, id))
      .limit(1);

    if (!recording) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Recording not found' },
      }, 404);
    }

    // Get presigned URL if it's an R2 path
    let audioUrl = recording.filePath;
    if (recording.filePath.startsWith('recordings/')) {
      audioUrl = await plaudIntegration.getPresignedUrl(recording.filePath);
    }

    return c.json({
      success: true,
      data: {
        url: audioUrl,
        expiresIn: 3600, // 1 hour
      },
    });
  } catch (error) {
    console.error('[Recordings API] Error getting audio URL:', error);
    return c.json({
      success: false,
      error: { code: 'URL_ERROR', message: String(error) },
    }, 500);
  }
});

// ============================================
// Update Speaker Labels
// ============================================

/**
 * POST /api/recordings/:id/speakers
 * Assign speaker label to a Deepgram speaker ID
 */
recordingsRouter.post('/:id/speakers', async (c) => {
  const id = c.req.param('id');

  try {
    const body = await c.req.json();
    const { deepgramSpeakerId, voiceProfileId, speakerName } = body;

    if (deepgramSpeakerId === undefined) {
      return c.json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'deepgramSpeakerId is required' },
      }, 400);
    }

    // Get transcript
    const [transcript] = await db
      .select()
      .from(transcripts)
      .where(eq(transcripts.recordingId, id))
      .limit(1);

    if (!transcript) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Transcript not found for this recording' },
      }, 404);
    }

    // If speakerName provided, create or find voice profile
    let profileId = voiceProfileId;
    if (speakerName && !profileId) {
      // Check if profile exists
      const [existingProfile] = await db
        .select()
        .from(voiceProfiles)
        .where(eq(voiceProfiles.name, speakerName))
        .limit(1);

      if (existingProfile) {
        profileId = existingProfile.id;
      } else {
        // Create new profile
        const [newProfile] = await db
          .insert(voiceProfiles)
          .values({
            name: speakerName,
            category: 'other',
          })
          .returning();
        profileId = newProfile.id;
      }
    }

    // Create or update speaker mapping
    const existingMapping = await db
      .select()
      .from(speakerMappings)
      .where(
        and(
          eq(speakerMappings.transcriptId, transcript.id),
          eq(speakerMappings.deepgramSpeakerId, deepgramSpeakerId)
        )
      )
      .limit(1);

    if (existingMapping.length > 0) {
      // Update existing
      await db
        .update(speakerMappings)
        .set({
          voiceProfileId: profileId,
          manuallyAssigned: true,
        })
        .where(eq(speakerMappings.id, existingMapping[0].id));
    } else {
      // Create new
      await db.insert(speakerMappings).values({
        transcriptId: transcript.id,
        deepgramSpeakerId,
        voiceProfileId: profileId,
        manuallyAssigned: true,
      });
    }

    return c.json({
      success: true,
      message: `Speaker ${deepgramSpeakerId} labeled as "${speakerName || profileId}"`,
    });
  } catch (error) {
    console.error('[Recordings API] Error updating speaker:', error);
    return c.json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: String(error) },
    }, 500);
  }
});

// ============================================
// Recording Stats
// ============================================

/**
 * GET /api/recordings/stats
 * Get recording statistics
 */
recordingsRouter.get('/stats/summary', async (c) => {
  try {
    // Total recordings by status
    const byStatus = await db
      .select({
        status: recordings.status,
        count: sql<number>`count(*)`,
      })
      .from(recordings)
      .groupBy(recordings.status);

    // Total recordings by type
    const byType = await db
      .select({
        type: recordings.recordingType,
        count: sql<number>`count(*)`,
      })
      .from(recordings)
      .groupBy(recordings.recordingType);

    // Total duration
    const durationResult = await db
      .select({
        totalSeconds: sql<number>`sum(duration_seconds)`,
      })
      .from(recordings);

    // Recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(recordings)
      .where(gte(recordings.recordedAt, sevenDaysAgo));

    return c.json({
      success: true,
      data: {
        byStatus: byStatus.reduce((acc, s) => {
          acc[s.status] = Number(s.count);
          return acc;
        }, {} as Record<string, number>),
        byType: byType.reduce((acc, t) => {
          acc[t.type] = Number(t.count);
          return acc;
        }, {} as Record<string, number>),
        totalDurationSeconds: Number(durationResult[0]?.totalSeconds || 0),
        recentCount: Number(recentCount[0]?.count || 0),
      },
    });
  } catch (error) {
    console.error('[Recordings API] Error getting stats:', error);
    return c.json({
      success: false,
      error: { code: 'STATS_ERROR', message: String(error) },
    }, 500);
  }
});

// ============================================
// Reprocess Recording
// ============================================

/**
 * POST /api/recordings/:id/reprocess
 * Queue recording for reprocessing
 */
recordingsRouter.post('/:id/reprocess', async (c) => {
  const id = c.req.param('id');

  try {
    const [recording] = await db
      .select()
      .from(recordings)
      .where(eq(recordings.id, id))
      .limit(1);

    if (!recording) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Recording not found' },
      }, 404);
    }

    // Reset status and queue for processing
    await db
      .update(recordings)
      .set({
        status: 'pending',
        errorMessage: null,
        processedAt: null,
      })
      .where(eq(recordings.id, id));

    // Import and queue the job
    const { addRecordingProcessJob } = await import('../../jobs/queue');
    await addRecordingProcessJob({
      recordingId: id,
      filePath: recording.filePath,
      recordingType: recording.recordingType as 'class' | 'meeting' | 'conversation' | 'other',
      context: recording.context || undefined,
    });

    return c.json({
      success: true,
      message: 'Recording queued for reprocessing',
    });
  } catch (error) {
    console.error('[Recordings API] Error reprocessing:', error);
    return c.json({
      success: false,
      error: { code: 'REPROCESS_ERROR', message: String(error) },
    }, 500);
  }
});

export default recordingsRouter;

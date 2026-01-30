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
import { plaudBrowserSync } from '../../services/plaud-browser-sync';
import { existsSync, createReadStream, statSync } from 'fs';

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
          // Include AI analysis if available
          summary: transcript.summary,
          extractedTasks: transcript.extractedTasks,
          analyzedAt: transcript.analyzedAt,
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

    // For local files, return streaming URL; for R2, get presigned URL
    let audioUrl: string;
    if (recording.filePath.startsWith('/')) {
      // Local file - use our streaming endpoint
      audioUrl = `/api/recordings/${id}/audio`;
    } else if (recording.filePath.startsWith('recordings/')) {
      // R2 storage - get presigned URL
      const presignedUrl = await plaudIntegration.getPresignedUrl(recording.filePath);
      audioUrl = presignedUrl || recording.filePath;
    } else {
      // Fallback to file path
      audioUrl = recording.filePath;
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
// Stream Audio File
// ============================================

/**
 * GET /api/recordings/:id/audio
 * Stream audio file for playback
 */
recordingsRouter.get('/:id/audio', async (c) => {
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

    const filePath = recording.filePath;

    // For local files, stream directly
    if (filePath.startsWith('/')) {
      if (!existsSync(filePath)) {
        return c.json({
          success: false,
          error: { code: 'FILE_NOT_FOUND', message: 'Audio file not found on disk' },
        }, 404);
      }

      const stat = statSync(filePath);
      const ext = filePath.split('.').pop()?.toLowerCase();
      const mimeTypes: Record<string, string> = {
        mp3: 'audio/mpeg',
        m4a: 'audio/mp4',
        wav: 'audio/wav',
        ogg: 'audio/ogg',
      };
      const contentType = mimeTypes[ext || ''] || 'audio/mpeg';

      // Handle range requests for seeking
      const range = c.req.header('Range');
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunkSize = end - start + 1;

        c.header('Content-Range', `bytes ${start}-${end}/${stat.size}`);
        c.header('Accept-Ranges', 'bytes');
        c.header('Content-Length', String(chunkSize));
        c.header('Content-Type', contentType);
        c.status(206);

        const stream = createReadStream(filePath, { start, end });
        return new Response(stream as unknown as ReadableStream, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunkSize),
            'Content-Type': contentType,
          },
        });
      }

      // Full file response
      c.header('Content-Length', String(stat.size));
      c.header('Content-Type', contentType);
      c.header('Accept-Ranges', 'bytes');

      const stream = createReadStream(filePath);
      return new Response(stream as unknown as ReadableStream, {
        status: 200,
        headers: {
          'Content-Length': String(stat.size),
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
        },
      });
    }

    // For R2 paths, redirect to presigned URL
    const presignedUrl = await plaudIntegration.getPresignedUrl(filePath);
    if (!presignedUrl) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Audio file not found' },
      }, 404);
    }
    return c.redirect(presignedUrl);
  } catch (error) {
    console.error('[Recordings API] Error streaming audio:', error);
    return c.json({
      success: false,
      error: { code: 'STREAM_ERROR', message: String(error) },
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

// ============================================
// Analyze Recording (Summary + Tasks)
// ============================================

/**
 * POST /api/recordings/:id/analyze
 * Generate summary and extract tasks from transcript
 */
recordingsRouter.post('/:id/analyze', async (c) => {
  const id = c.req.param('id');

  try {
    const { recordingAnalysisService } = await import('../../services/recording-analysis-service');
    const analysis = await recordingAnalysisService.analyzeRecording(id);

    return c.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error('[Recordings API] Error analyzing recording:', error);
    return c.json({
      success: false,
      error: { code: 'ANALYSIS_ERROR', message: String(error) },
    }, 500);
  }
});

// ============================================
// Export Tasks to Task System
// ============================================

/**
 * POST /api/recordings/:id/export-tasks
 * Export extracted tasks to the task system
 */
recordingsRouter.post('/:id/export-tasks', async (c) => {
  const id = c.req.param('id');

  try {
    const body = await c.req.json();
    const { tasks } = body as {
      tasks: Array<{
        title: string;
        description?: string;
        priority?: 'low' | 'medium' | 'high';
        dueDate?: string;
      }>;
    };

    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      return c.json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'tasks array is required' },
      }, 400);
    }

    // Get recording for context
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

    // Import task service and create tasks
    const { taskService } = await import('../../services/task-service');

    const createdTasks = [];
    for (const task of tasks) {
      const created = await taskService.create({
        title: task.title,
        description: task.description,
        priority: task.priority === 'high' ? 1 : task.priority === 'medium' ? 2 : 3,
        dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
        source: 'recording',
        context: `From recording: ${recording.originalFilename || 'Untitled'} (ID: ${id})`,
      });
      createdTasks.push(created);
    }

    return c.json({
      success: true,
      data: {
        tasksCreated: createdTasks.length,
        tasks: createdTasks.map(t => ({ id: t.id, title: t.title })),
      },
    });
  } catch (error) {
    console.error('[Recordings API] Error exporting tasks:', error);
    return c.json({
      success: false,
      error: { code: 'EXPORT_ERROR', message: String(error) },
    }, 500);
  }
});

// ============================================
// Trigger Plaud Sync
// ============================================

/**
 * POST /api/recordings/sync
 * Trigger a Plaud sync on demand (called when app opens)
 */
recordingsRouter.post('/sync', async (c) => {
  try {
    console.log('[Recordings API] Triggering Plaud sync...');

    // Run sync in background (don't await to keep response fast)
    plaudBrowserSync.sync().then(result => {
      console.log(`[Recordings API] Plaud sync complete: ${result.synced} synced, ${result.skipped} skipped`);
      if (result.newRecordings.length > 0) {
        console.log(`[Recordings API] New recordings: ${result.newRecordings.join(', ')}`);
      }
    }).catch(err => {
      console.error('[Recordings API] Plaud sync error:', err);
    });

    return c.json({
      success: true,
      message: 'Plaud sync triggered',
    });
  } catch (error) {
    console.error('[Recordings API] Error triggering sync:', error);
    return c.json({
      success: false,
      error: { code: 'SYNC_ERROR', message: String(error) },
    }, 500);
  }
});

export default recordingsRouter;

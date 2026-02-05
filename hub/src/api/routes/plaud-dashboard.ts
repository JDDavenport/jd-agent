/**
 * Plaud Dashboard API Routes
 * 
 * Dedicated API endpoints for the Plaud recordings dashboard
 */

import { Hono } from 'hono';
import { db } from '../../db/client';
import { recordings, transcripts } from '../../db/schema';
import { eq, desc, and, gte, lte, sql, like, or, ilike } from 'drizzle-orm';
import { plaudBrowserSync } from '../../services/plaud-browser-sync';

const plaudDashboardRouter = new Hono();

// ============================================
// Dashboard Stats
// ============================================

/**
 * GET /api/plaud/stats
 * Get dashboard statistics
 */
plaudDashboardRouter.get('/stats', async (c) => {
  try {
    // Total recordings
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(recordings);
    const totalRecordings = Number(totalResult[0]?.count || 0);

    // Total hours
    const durationResult = await db
      .select({
        totalSeconds: sql<number>`coalesce(sum(duration_seconds), 0)`,
      })
      .from(recordings);
    const totalHours = Math.round(Number(durationResult[0]?.totalSeconds || 0) / 3600 * 10) / 10;

    // Recordings this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const weekResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(recordings)
      .where(gte(recordings.recordedAt, oneWeekAgo));
    const recordingsThisWeek = Number(weekResult[0]?.count || 0);

    // Courses covered (unique contexts)
    const coursesResult = await db
      .select({ 
        context: recordings.context,
        count: sql<number>`count(*)`
      })
      .from(recordings)
      .where(sql`${recordings.context} IS NOT NULL AND ${recordings.context} != ''`)
      .groupBy(recordings.context);
    const coursesCovered = coursesResult.length;

    return c.json({
      success: true,
      data: {
        totalRecordings,
        totalHours,
        recordingsThisWeek,
        coursesCovered,
      },
    });
  } catch (error) {
    console.error('[Plaud Dashboard] Error getting stats:', error);
    return c.json({
      success: false,
      error: { code: 'STATS_ERROR', message: String(error) },
    }, 500);
  }
});

// ============================================
// List Recordings with Filters
// ============================================

/**
 * GET /api/plaud/recordings
 * List recordings with filtering and search
 */
plaudDashboardRouter.get('/recordings', async (c) => {
  const limit = parseInt(c.req.query('limit') || '20', 10);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  const course = c.req.query('course');
  const status = c.req.query('status');
  const startDate = c.req.query('startDate');
  const endDate = c.req.query('endDate');
  const search = c.req.query('search');

  try {
    // Build where conditions
    const conditions = [];
    
    if (course) {
      conditions.push(eq(recordings.context, course));
    }
    
    if (status) {
      if (status === 'pending') {
        conditions.push(sql`NOT EXISTS (SELECT 1 FROM transcripts WHERE transcripts.recording_id = recordings.id)`);
      } else if (status === 'transcribed') {
        conditions.push(sql`EXISTS (SELECT 1 FROM transcripts WHERE transcripts.recording_id = recordings.id AND summary IS NULL)`);
      } else if (status === 'summarized') {
        conditions.push(sql`EXISTS (SELECT 1 FROM transcripts WHERE transcripts.recording_id = recordings.id AND summary IS NOT NULL)`);
      }
    }
    
    if (startDate) {
      conditions.push(gte(recordings.recordedAt, new Date(startDate)));
    }
    
    if (endDate) {
      conditions.push(lte(recordings.recordedAt, new Date(endDate)));
    }

    // Search in transcripts if search term provided
    if (search) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM transcripts 
          WHERE transcripts.recording_id = recordings.id 
          AND (
            transcripts.full_text ILIKE ${`%${search}%`} OR
            recordings.original_filename ILIKE ${`%${search}%`} OR
            recordings.context ILIKE ${`%${search}%`}
          )
        )`
      );
    }

    // Get recordings with transcript info
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
        // Transcript info
        hasTranscript: sql<boolean>`EXISTS (SELECT 1 FROM transcripts WHERE transcripts.recording_id = recordings.id)`,
        transcriptPreview: sql<string>`(
          SELECT LEFT(transcripts.full_text, 100) 
          FROM transcripts 
          WHERE transcripts.recording_id = recordings.id 
          LIMIT 1
        )`,
        hasSummary: sql<boolean>`EXISTS (
          SELECT 1 FROM transcripts 
          WHERE transcripts.recording_id = recordings.id 
          AND summary IS NOT NULL
        )`,
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

    // Determine status for each recording
    const enrichedRecordings = recordingsList.map(recording => {
      let recordingStatus: 'pending' | 'transcribed' | 'summarized';
      
      if (!recording.hasTranscript) {
        recordingStatus = 'pending';
      } else if (!recording.hasSummary) {
        recordingStatus = 'transcribed';
      } else {
        recordingStatus = 'summarized';
      }

      return {
        ...recording,
        recordingStatus,
        transcriptPreview: recording.transcriptPreview || '',
      };
    });

    return c.json({
      success: true,
      data: enrichedRecordings,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + recordingsList.length < total,
      },
    });
  } catch (error) {
    console.error('[Plaud Dashboard] Error listing recordings:', error);
    return c.json({
      success: false,
      error: { code: 'LIST_ERROR', message: String(error) },
    }, 500);
  }
});

// ============================================
// Get Single Recording Detail
// ============================================

/**
 * GET /api/plaud/recordings/:id
 * Get recording detail with full transcript
 */
plaudDashboardRouter.get('/recordings/:id', async (c) => {
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

    // Get audio URL (reuse existing logic from recordings.ts)
    let audioUrl: string | null = null;
    if (recording.filePath.startsWith('/')) {
      audioUrl = `/api/recordings/${id}/audio`;
    } else if (recording.filePath.startsWith('recordings/')) {
      // Would need R2 presigned URL - for now just use the direct URL endpoint
      audioUrl = `/api/recordings/${id}/audio-url`;
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
          summary: transcript.summary,
          extractedTasks: transcript.extractedTasks,
          analyzedAt: transcript.analyzedAt,
        } : null,
        audioUrl,
      },
    });
  } catch (error) {
    console.error('[Plaud Dashboard] Error getting recording:', error);
    return c.json({
      success: false,
      error: { code: 'GET_ERROR', message: String(error) },
    }, 500);
  }
});

// ============================================
// Trigger Sync
// ============================================

/**
 * POST /api/plaud/sync
 * Trigger a Plaud sync
 */
plaudDashboardRouter.post('/sync', async (c) => {
  try {
    console.log('[Plaud Dashboard] Triggering sync...');

    // Run sync in background to keep response fast
    plaudBrowserSync.sync().then(result => {
      console.log(`[Plaud Dashboard] Sync complete: ${result.synced} synced, ${result.skipped} skipped`);
      if (result.newRecordings.length > 0) {
        console.log(`[Plaud Dashboard] New recordings: ${result.newRecordings.join(', ')}`);
      }
    }).catch(err => {
      console.error('[Plaud Dashboard] Sync error:', err);
    });

    return c.json({
      success: true,
      message: 'Sync triggered successfully',
    });
  } catch (error) {
    console.error('[Plaud Dashboard] Error triggering sync:', error);
    return c.json({
      success: false,
      error: { code: 'SYNC_ERROR', message: String(error) },
    }, 500);
  }
});

// ============================================
// Generate/Regenerate Summary
// ============================================

/**
 * POST /api/plaud/recordings/:id/summarize
 * Generate or regenerate AI summary for a recording
 */
plaudDashboardRouter.post('/recordings/:id/summarize', async (c) => {
  const id = c.req.param('id');

  try {
    // Import the recording analysis service
    const { recordingAnalysisService } = await import('../../services/recording-analysis-service');
    
    // Get the recording first to make sure it exists
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

    // Check if transcript exists
    const [transcript] = await db
      .select()
      .from(transcripts)
      .where(eq(transcripts.recordingId, id))
      .limit(1);

    if (!transcript) {
      return c.json({
        success: false,
        error: { code: 'NO_TRANSCRIPT', message: 'No transcript available for this recording' },
      }, 400);
    }

    // Generate the analysis
    const analysis = await recordingAnalysisService.analyzeRecording(id);

    return c.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error('[Plaud Dashboard] Error generating summary:', error);
    return c.json({
      success: false,
      error: { code: 'SUMMARY_ERROR', message: String(error) },
    }, 500);
  }
});

export default plaudDashboardRouter;
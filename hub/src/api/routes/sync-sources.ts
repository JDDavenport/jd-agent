/**
 * Sync Sources API Routes for Study Help
 * 
 * Endpoints for syncing content from:
 * - Plaud recordings (lecture transcripts)
 * - Remarkable notes (handwritten notes)
 */

import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { db } from '../../db/client';
import { 
  studyHelpUsers,
  courseContentChunks,
} from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { studyHelpAuthService } from '../../services/study-help-auth-service';

const syncSourcesRouter = new Hono();

// Session cookie name
const COOKIE_NAME = 'study_help_session';

/**
 * Auth middleware - verify session and get user ID
 */
async function requireAuth(c: any): Promise<string | null> {
  const sessionToken = getCookie(c, COOKIE_NAME);
  
  if (!sessionToken) {
    return null;
  }

  try {
    const user = await studyHelpAuthService.validateSession(sessionToken);
    return user?.id || null;
  } catch {
    return null;
  }
}

// ============================================
// PLAUD SYNC
// ============================================

/**
 * POST /api/sync/plaud
 * Upload a Plaud recording transcript
 */
syncSourcesRouter.post('/plaud', async (c) => {
  const userId = await requireAuth(c);
  
  if (!userId) {
    return c.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Please log in first' },
    }, 401);
  }

  try {
    const body = await c.req.json();
    const { 
      recordingId, 
      recordingDate, 
      title, 
      transcript, 
      metadata,
      courseId, // Optional: user can tag which course this belongs to
    } = body;

    if (!recordingId || !transcript) {
      return c.json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'recordingId and transcript are required' },
      }, 400);
    }

    console.log(`[SyncPlaud] Processing recording: ${recordingId} for user ${userId}`);

    // Chunk the transcript for RAG
    const chunks = chunkText(transcript, 1000, 200);
    
    // Store chunks
    let chunksCreated = 0;
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      await db.insert(courseContentChunks).values({
        courseId: courseId || 'uncategorized',
        sourceType: 'lecture',
        sourceId: recordingId,
        sourceTitle: title || recordingId,
        sourceDate: recordingDate || null,
        chunkIndex: i,
        chunkText: chunk,
        chunkTokens: estimateTokens(chunk),
        metadata: {
          userId, // Tag with user for filtering
          plaudRecordingId: recordingId,
          ...metadata,
        },
      }).onConflictDoNothing();
      
      chunksCreated++;
    }

    // Update user's last sync time
    await db
      .update(studyHelpUsers)
      .set({ lastSyncAt: new Date() })
      .where(eq(studyHelpUsers.id, userId));

    console.log(`[SyncPlaud] Created ${chunksCreated} chunks for ${recordingId}`);

    return c.json({
      success: true,
      data: {
        recordingId,
        chunksCreated,
      },
    });
  } catch (error) {
    console.error('[SyncPlaud] Error:', error);
    return c.json({
      success: false,
      error: { 
        code: 'SYNC_ERROR', 
        message: error instanceof Error ? error.message : 'Failed to sync recording' 
      },
    }, 500);
  }
});

/**
 * GET /api/sync/plaud/status
 * Get Plaud sync status for user
 */
syncSourcesRouter.get('/plaud/status', async (c) => {
  const userId = await requireAuth(c);
  
  if (!userId) {
    return c.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Please log in first' },
    }, 401);
  }

  try {
    // Count recordings synced for this user
    const result = await db.execute(`
      SELECT 
        COUNT(DISTINCT source_id) as recording_count,
        COUNT(*) as chunk_count,
        MAX(created_at) as last_sync
      FROM course_content_chunks
      WHERE source_type = 'lecture'
        AND metadata->>'userId' = '${userId}'
    `);

    const stats = result.rows[0] as any;

    return c.json({
      success: true,
      data: {
        recordingCount: parseInt(stats?.recording_count || '0'),
        chunkCount: parseInt(stats?.chunk_count || '0'),
        lastSync: stats?.last_sync || null,
      },
    });
  } catch (error) {
    console.error('[SyncPlaud] Status error:', error);
    return c.json({
      success: false,
      error: { code: 'STATUS_ERROR', message: 'Failed to get status' },
    }, 500);
  }
});

// ============================================
// REMARKABLE SYNC
// ============================================

/**
 * POST /api/sync/remarkable/connect
 * Connect Remarkable account with device token
 */
syncSourcesRouter.post('/remarkable/connect', async (c) => {
  const userId = await requireAuth(c);
  
  if (!userId) {
    return c.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Please log in first' },
    }, 401);
  }

  try {
    const body = await c.req.json();
    const { deviceToken } = body;

    if (!deviceToken) {
      return c.json({
        success: false,
        error: { code: 'MISSING_TOKEN', message: 'Device token is required' },
      }, 400);
    }

    // TODO: Verify token with Remarkable Cloud API
    // For now, just store it
    console.log(`[SyncRemarkable] Connecting device for user ${userId}`);

    // Store encrypted token (in production, use proper encryption)
    // For MVP, store in user metadata or a separate table
    
    return c.json({
      success: true,
      data: {
        message: 'Remarkable connected successfully',
      },
    });
  } catch (error) {
    console.error('[SyncRemarkable] Connect error:', error);
    return c.json({
      success: false,
      error: { 
        code: 'CONNECT_ERROR', 
        message: error instanceof Error ? error.message : 'Failed to connect' 
      },
    }, 500);
  }
});

/**
 * POST /api/sync/remarkable/sync
 * Trigger Remarkable sync
 */
syncSourcesRouter.post('/remarkable/sync', async (c) => {
  const userId = await requireAuth(c);
  
  if (!userId) {
    return c.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Please log in first' },
    }, 401);
  }

  try {
    // TODO: Implement actual Remarkable Cloud sync
    // For MVP, return placeholder
    console.log(`[SyncRemarkable] Starting sync for user ${userId}`);

    return c.json({
      success: true,
      data: {
        notes: 0,
        pages: 0,
        message: 'Remarkable sync coming soon',
      },
    });
  } catch (error) {
    console.error('[SyncRemarkable] Sync error:', error);
    return c.json({
      success: false,
      error: { 
        code: 'SYNC_ERROR', 
        message: error instanceof Error ? error.message : 'Sync failed' 
      },
    }, 500);
  }
});

/**
 * POST /api/sync/remarkable/note
 * Upload a single note (for desktop agent)
 */
syncSourcesRouter.post('/remarkable/note', async (c) => {
  const userId = await requireAuth(c);
  
  if (!userId) {
    return c.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Please log in first' },
    }, 401);
  }

  try {
    const body = await c.req.json();
    const { 
      noteId, 
      title, 
      content, // OCR'd text
      pages,
      metadata,
      courseId,
    } = body;

    if (!noteId || !content) {
      return c.json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'noteId and content are required' },
      }, 400);
    }

    console.log(`[SyncRemarkable] Processing note: ${noteId} for user ${userId}`);

    // Chunk the content for RAG
    const chunks = chunkText(content, 1000, 200);
    
    let chunksCreated = 0;
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      await db.insert(courseContentChunks).values({
        courseId: courseId || 'uncategorized',
        sourceType: 'note',
        sourceId: noteId,
        sourceTitle: title || noteId,
        chunkIndex: i,
        chunkText: chunk,
        chunkTokens: estimateTokens(chunk),
        pageNumber: pages?.[i]?.pageNumber,
        metadata: {
          userId,
          remarkableNoteId: noteId,
          ...metadata,
        },
      }).onConflictDoNothing();
      
      chunksCreated++;
    }

    // Update user's last sync time
    await db
      .update(studyHelpUsers)
      .set({ lastSyncAt: new Date() })
      .where(eq(studyHelpUsers.id, userId));

    return c.json({
      success: true,
      data: {
        noteId,
        chunksCreated,
      },
    });
  } catch (error) {
    console.error('[SyncRemarkable] Note error:', error);
    return c.json({
      success: false,
      error: { 
        code: 'SYNC_ERROR', 
        message: error instanceof Error ? error.message : 'Failed to sync note' 
      },
    }, 500);
  }
});

/**
 * GET /api/sync/remarkable/status
 * Get Remarkable sync status
 */
syncSourcesRouter.get('/remarkable/status', async (c) => {
  const userId = await requireAuth(c);
  
  if (!userId) {
    return c.json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Please log in first' },
    }, 401);
  }

  try {
    const result = await db.execute(`
      SELECT 
        COUNT(DISTINCT source_id) as note_count,
        COUNT(*) as chunk_count,
        MAX(created_at) as last_sync
      FROM course_content_chunks
      WHERE source_type = 'note'
        AND metadata->>'userId' = '${userId}'
    `);

    const stats = result.rows[0] as any;

    return c.json({
      success: true,
      data: {
        connected: false, // TODO: Check if device token exists
        noteCount: parseInt(stats?.note_count || '0'),
        chunkCount: parseInt(stats?.chunk_count || '0'),
        lastSync: stats?.last_sync || null,
      },
    });
  } catch (error) {
    console.error('[SyncRemarkable] Status error:', error);
    return c.json({
      success: false,
      error: { code: 'STATUS_ERROR', message: 'Failed to get status' },
    }, 500);
  }
});

// ============================================
// HELPERS
// ============================================

/**
 * Split text into overlapping chunks
 */
function chunkText(text: string, maxChars: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    let end = start + maxChars;
    
    // Try to break at sentence/paragraph boundary
    if (end < text.length) {
      const slice = text.slice(start, end);
      const lastPeriod = slice.lastIndexOf('. ');
      const lastNewline = slice.lastIndexOf('\n');
      const breakPoint = Math.max(lastPeriod, lastNewline);
      
      if (breakPoint > maxChars / 2) {
        end = start + breakPoint + 1;
      }
    }
    
    chunks.push(text.slice(start, end).trim());
    start = end - overlap;
  }
  
  return chunks.filter(c => c.length > 0);
}

/**
 * Estimate token count (rough approximation)
 */
function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

export { syncSourcesRouter };

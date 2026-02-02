/**
 * Sync API Routes - Receive content from desktop agent
 * 
 * Endpoints:
 * - POST /api/sync/plaud - Upload Plaud transcript
 * - POST /api/sync/remarkable/connect - Connect Remarkable
 * - POST /api/sync/remarkable/sync - Trigger Remarkable sync
 * - GET /api/sync/remarkable/status - Get Remarkable status
 */

import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { db } from '../../db/client';
import { 
  studyHelpUsers, 
  studyHelpSessions, 
  studyHelpUserCourses,
  courseContentChunks 
} from '../../db/schema';
import { eq, and, gt } from 'drizzle-orm';
import { createHash } from 'crypto';

const syncRouter = new Hono();

const COOKIE_NAME = 'study_help_session';

// Hash token for lookup
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Auth middleware - get user from session
async function getUserFromSession(sessionToken: string | undefined) {
  if (!sessionToken) return null;

  const tokenHash = hashToken(sessionToken);

  const [session] = await db
    .select()
    .from(studyHelpSessions)
    .where(
      and(
        eq(studyHelpSessions.tokenHash, tokenHash),
        gt(studyHelpSessions.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!session) return null;

  const [user] = await db
    .select()
    .from(studyHelpUsers)
    .where(eq(studyHelpUsers.id, session.userId))
    .limit(1);

  return user?.isActive ? user : null;
}

// Helper to chunk text
function chunkText(text: string, maxChunkSize: number = 1500): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = '';

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > maxChunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    currentChunk += sentence + ' ';
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * POST /api/sync/plaud
 * Upload a Plaud recording transcript
 */
syncRouter.post('/plaud', async (c) => {
  const sessionToken = getCookie(c, COOKIE_NAME);
  const user = await getUserFromSession(sessionToken);

  if (!user) {
    return c.json(
      { success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Please log in' } },
      401
    );
  }

  try {
    const body = await c.req.json();
    const { recordingId, recordingDate, title, transcript, metadata, courseId } = body;

    if (!recordingId || !transcript) {
      return c.json(
        { success: false, error: { code: 'MISSING_FIELDS', message: 'recordingId and transcript are required' } },
        400
      );
    }

    // Check for existing content with this source ID
    const existing = await db
      .select()
      .from(courseContentChunks)
      .where(
        and(
          eq(courseContentChunks.sourceType, 'lecture'),
          eq(courseContentChunks.sourceId, recordingId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Already synced
      return c.json({
        success: true,
        data: { 
          status: 'already_synced',
          chunksCreated: 0,
        },
      });
    }

    // Determine course ID (can be passed or auto-detected)
    let detectedCourseId = courseId;
    if (!detectedCourseId && title) {
      // Try to detect course from title
      const titleLower = title.toLowerCase();
      if (titleLower.includes('analytics') || titleLower.includes('mba 560')) {
        detectedCourseId = 'mba560';
      } else if (titleLower.includes('strategy') || titleLower.includes('mba 580')) {
        detectedCourseId = 'mba580';
      } else if (titleLower.includes('innovation') || titleLower.includes('entrepreneurial')) {
        detectedCourseId = 'entrepreneurial-innovation';
      } else if (titleLower.includes('vc') || titleLower.includes('venture') || titleLower.includes('mba 664')) {
        detectedCourseId = 'mba664';
      } else if (titleLower.includes('eta') || titleLower.includes('acquisition') || titleLower.includes('mba 677')) {
        detectedCourseId = 'mba677';
      } else if (titleLower.includes('client') || titleLower.includes('retention') || titleLower.includes('mba 654')) {
        detectedCourseId = 'mba654';
      } else if (titleLower.includes('career') || titleLower.includes('mba 693')) {
        detectedCourseId = 'mba693r';
      }
    }

    // Default to 'uncategorized' if no course detected
    detectedCourseId = detectedCourseId || 'uncategorized';

    // Chunk the transcript
    const chunks = chunkText(transcript);
    
    // Store chunks
    const chunkRecords = chunks.map((chunkText, index) => ({
      courseId: detectedCourseId,
      sourceType: 'lecture' as const,
      sourceId: recordingId,
      sourceTitle: title || recordingId,
      sourceDate: recordingDate || null,
      chunkIndex: index,
      chunkText,
      chunkTokens: Math.ceil(chunkText.length / 4), // Rough token estimate
      metadata: {
        userId: user.id,
        ...metadata,
      },
    }));

    await db.insert(courseContentChunks).values(chunkRecords);

    console.log(`[Sync] Plaud: Stored ${chunks.length} chunks for recording ${recordingId} (user: ${user.email})`);

    return c.json({
      success: true,
      data: {
        status: 'synced',
        chunksCreated: chunks.length,
        courseId: detectedCourseId,
      },
    });
  } catch (error) {
    console.error('[Sync] Plaud error:', error);
    return c.json(
      { success: false, error: { code: 'SYNC_ERROR', message: 'Failed to sync recording' } },
      500
    );
  }
});

/**
 * POST /api/sync/remarkable/connect
 * Connect Remarkable device token
 */
syncRouter.post('/remarkable/connect', async (c) => {
  const sessionToken = getCookie(c, COOKIE_NAME);
  const user = await getUserFromSession(sessionToken);

  if (!user) {
    return c.json(
      { success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Please log in' } },
      401
    );
  }

  try {
    const body = await c.req.json();
    const { deviceToken } = body;

    if (!deviceToken) {
      return c.json(
        { success: false, error: { code: 'MISSING_FIELD', message: 'deviceToken is required' } },
        400
      );
    }

    // Store token (encrypted) - for now, just validate format
    // In production, we'd encrypt this before storing
    if (deviceToken.length < 10) {
      return c.json(
        { success: false, error: { code: 'INVALID_TOKEN', message: 'Invalid device token format' } },
        400
      );
    }

    // Update user with remarkable token
    await db
      .update(studyHelpUsers)
      .set({
        // Note: In production, encrypt the token
        // remarkableDeviceToken: encrypt(deviceToken),
        updatedAt: new Date(),
      })
      .where(eq(studyHelpUsers.id, user.id));

    console.log(`[Sync] Remarkable connected for user: ${user.email}`);

    return c.json({
      success: true,
      data: { connected: true },
    });
  } catch (error) {
    console.error('[Sync] Remarkable connect error:', error);
    return c.json(
      { success: false, error: { code: 'CONNECT_ERROR', message: 'Failed to connect Remarkable' } },
      500
    );
  }
});

/**
 * POST /api/sync/remarkable/sync
 * Trigger Remarkable sync
 */
syncRouter.post('/remarkable/sync', async (c) => {
  const sessionToken = getCookie(c, COOKIE_NAME);
  const user = await getUserFromSession(sessionToken);

  if (!user) {
    return c.json(
      { success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Please log in' } },
      401
    );
  }

  try {
    // For MVP, accept notes directly from desktop agent
    const body = await c.req.json();
    const { notes } = body;

    if (!notes || !Array.isArray(notes)) {
      return c.json({
        success: true,
        data: { notes: 0, pages: 0 },
      });
    }

    let totalPages = 0;
    let syncedNotes = 0;

    for (const note of notes) {
      const { noteId, title, ocrText, pageCount, courseId } = note;

      if (!noteId || !ocrText) continue;

      // Check for existing
      const existing = await db
        .select()
        .from(courseContentChunks)
        .where(
          and(
            eq(courseContentChunks.sourceType, 'note'),
            eq(courseContentChunks.sourceId, noteId)
          )
        )
        .limit(1);

      if (existing.length > 0) continue;

      // Determine course
      let detectedCourseId = courseId || 'uncategorized';

      // Chunk the OCR text
      const chunks = chunkText(ocrText);

      const chunkRecords = chunks.map((chunkText, index) => ({
        courseId: detectedCourseId,
        sourceType: 'note' as const,
        sourceId: noteId,
        sourceTitle: title || noteId,
        sourceDate: null,
        chunkIndex: index,
        chunkText,
        chunkTokens: Math.ceil(chunkText.length / 4),
        metadata: {
          userId: user.id,
          pageCount,
        },
      }));

      await db.insert(courseContentChunks).values(chunkRecords);

      syncedNotes++;
      totalPages += pageCount || 0;
    }

    console.log(`[Sync] Remarkable: Synced ${syncedNotes} notes for user: ${user.email}`);

    return c.json({
      success: true,
      data: { notes: syncedNotes, pages: totalPages },
    });
  } catch (error) {
    console.error('[Sync] Remarkable sync error:', error);
    return c.json(
      { success: false, error: { code: 'SYNC_ERROR', message: 'Failed to sync notes' } },
      500
    );
  }
});

/**
 * GET /api/sync/remarkable/status
 * Get Remarkable sync status
 */
syncRouter.get('/remarkable/status', async (c) => {
  const sessionToken = getCookie(c, COOKIE_NAME);
  const user = await getUserFromSession(sessionToken);

  if (!user) {
    return c.json(
      { success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Please log in' } },
      401
    );
  }

  try {
    // Count notes for this user
    const notes = await db
      .select()
      .from(courseContentChunks)
      .where(
        and(
          eq(courseContentChunks.sourceType, 'note'),
          // Filter by user in metadata
        )
      );

    const userNotes = notes.filter((n: any) => n.metadata?.userId === user.id);
    const uniqueNoteIds = new Set(userNotes.map((n: any) => n.sourceId));

    return c.json({
      success: true,
      data: {
        connected: true, // We'd check if remarkableDeviceToken exists
        noteCount: uniqueNoteIds.size,
        lastSync: user.lastSyncAt?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('[Sync] Remarkable status error:', error);
    return c.json(
      { success: false, error: { code: 'STATUS_ERROR', message: 'Failed to get status' } },
      500
    );
  }
});

/**
 * GET /api/sync/status
 * Get overall sync status for user
 */
syncRouter.get('/status', async (c) => {
  const sessionToken = getCookie(c, COOKIE_NAME);
  const user = await getUserFromSession(sessionToken);

  if (!user) {
    return c.json(
      { success: false, error: { code: 'NOT_AUTHENTICATED', message: 'Please log in' } },
      401
    );
  }

  try {
    // Count content by type for this user
    const allContent = await db
      .select()
      .from(courseContentChunks);

    const userContent = allContent.filter((c: any) => c.metadata?.userId === user.id);

    const lectureIds = new Set(userContent.filter((c: any) => c.sourceType === 'lecture').map((c: any) => c.sourceId));
    const noteIds = new Set(userContent.filter((c: any) => c.sourceType === 'note').map((c: any) => c.sourceId));
    const readingIds = new Set(userContent.filter((c: any) => c.sourceType === 'reading').map((c: any) => c.sourceId));

    return c.json({
      success: true,
      data: {
        lectures: lectureIds.size,
        notes: noteIds.size,
        readings: readingIds.size,
        totalChunks: userContent.length,
        lastSync: user.lastSyncAt?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('[Sync] Status error:', error);
    return c.json(
      { success: false, error: { code: 'STATUS_ERROR', message: 'Failed to get status' } },
      500
    );
  }
});

export { syncRouter };

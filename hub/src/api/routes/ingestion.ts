/**
 * JD Agent - Document Ingestion API Routes
 * 
 * Endpoints for managing document ingestion:
 * - Canvas LMS sync
 * - Remarkable notes sync
 * - Manual document upload (future)
 */

import { Hono } from 'hono';
import { canvasIntegration } from '../../integrations/canvas';
import { remarkableIntegration } from '../../integrations/remarkable';
import { plaudIntegration } from '../../integrations/plaud';
import { gmailIntegration } from '../../integrations/gmail';
import { db } from '../../db/client';
import { tasks, vaultEntries } from '../../db/schema';
import { vipService } from '../../services/vip-service';

const ingestionRouter = new Hono();

// ============================================
// Status Routes
// ============================================

/**
 * GET /api/ingestion/status
 * Get status of all ingestion sources
 */
ingestionRouter.get('/status', async (c) => {
  const remarkableStatus = remarkableIntegration.getStatus();

  return c.json({
    success: true,
    data: {
      canvas: {
        configured: canvasIntegration.isConfigured(),
        baseUrl: process.env.CANVAS_BASE_URL || null,
        termFilter: process.env.CANVAS_TERM_FILTER || null,
      },
      remarkable: remarkableStatus,
      plaud: {
        configured: false,
        status: 'Backlogged - device not arrived',
      },
    },
  });
});

// ============================================
// Canvas Routes
// ============================================

/**
 * GET /api/ingestion/canvas/status
 * Get Canvas integration status
 */
ingestionRouter.get('/canvas/status', async (c) => {
  if (!canvasIntegration.isConfigured()) {
    return c.json({
      success: false,
      error: {
        code: 'NOT_CONFIGURED',
        message: 'Canvas not configured. Set CANVAS_BASE_URL and CANVAS_TOKEN.',
      },
    }, 400);
  }

  return c.json({
    success: true,
    data: {
      configured: true,
      baseUrl: process.env.CANVAS_BASE_URL,
      termFilter: process.env.CANVAS_TERM_FILTER || null,
    },
  });
});

/**
 * GET /api/ingestion/canvas/courses
 * List available courses
 */
ingestionRouter.get('/canvas/courses', async (c) => {
  if (!canvasIntegration.isConfigured()) {
    return c.json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'Canvas not configured' },
    }, 400);
  }

  try {
    const courses = await canvasIntegration.getCourses();
    return c.json({
      success: true,
      data: courses.map(course => ({
        id: course.id,
        name: course.name,
        courseCode: course.course_code,
        state: course.workflow_state,
      })),
      count: courses.length,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'CANVAS_ERROR', message: String(error) },
    }, 500);
  }
});

/**
 * GET /api/ingestion/canvas/assignments
 * List upcoming assignments
 */
ingestionRouter.get('/canvas/assignments', async (c) => {
  if (!canvasIntegration.isConfigured()) {
    return c.json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'Canvas not configured' },
    }, 400);
  }

  try {
    const assignments = await canvasIntegration.getUpcomingAssignments();
    return c.json({
      success: true,
      data: assignments.map(a => ({
        id: a.id,
        name: a.name,
        courseName: a.courseName,
        dueAt: a.due_at,
        pointsPossible: a.points_possible,
        url: a.html_url,
      })),
      count: assignments.length,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'CANVAS_ERROR', message: String(error) },
    }, 500);
  }
});

/**
 * POST /api/ingestion/canvas/sync
 * Trigger full Canvas sync
 */
ingestionRouter.post('/canvas/sync', async (c) => {
  if (!canvasIntegration.isConfigured()) {
    return c.json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'Canvas not configured' },
    }, 400);
  }

  try {
    const result = await canvasIntegration.fullSync();
    return c.json({
      success: true,
      data: result,
      message: `Synced ${result.courses} courses, ${result.assignments} assignments, ${result.announcements} announcements`,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'SYNC_ERROR', message: String(error) },
    }, 500);
  }
});

/**
 * POST /api/ingestion/canvas/sync/assignments
 * Sync only assignments to tasks
 */
ingestionRouter.post('/canvas/sync/assignments', async (c) => {
  if (!canvasIntegration.isConfigured()) {
    return c.json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'Canvas not configured' },
    }, 400);
  }

  try {
    const result = await canvasIntegration.syncAssignmentsToTasks();
    return c.json({
      success: true,
      data: result,
      message: `Created ${result.created} tasks, updated ${result.updated}`,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'SYNC_ERROR', message: String(error) },
    }, 500);
  }
});

/**
 * GET /api/ingestion/canvas/current-courses
 * Get current semester courses (including unpublished)
 */
ingestionRouter.get('/canvas/current-courses', async (c) => {
  if (!canvasIntegration.isConfigured()) {
    return c.json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'Canvas not configured' },
    }, 400);
  }

  try {
    const courses = await canvasIntegration.getCurrentCourses();
    return c.json({
      success: true,
      data: courses.map(course => ({
        id: course.id,
        name: course.name,
        code: course.code,
        published: course.published,
        status: course.published ? '✅ Published' : '⏳ Unpublished',
        startDate: course.startDate,
        endDate: course.endDate,
      })),
      count: courses.length,
      publishedCount: courses.filter(c => c.published).length,
      unpublishedCount: courses.filter(c => !c.published).length,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'CANVAS_ERROR', message: String(error) },
    }, 500);
  }
});

/**
 * POST /api/ingestion/canvas/daily-check
 * Run daily Canvas check (catches new assignments, newly published courses)
 */
ingestionRouter.post('/canvas/daily-check', async (c) => {
  if (!canvasIntegration.isConfigured()) {
    return c.json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'Canvas not configured' },
    }, 400);
  }

  try {
    const result = await canvasIntegration.dailyCheck();
    
    let message = `Daily check complete.`;
    if (result.newlyPublished.length > 0) {
      message += ` 🎉 ${result.newlyPublished.length} courses now published: ${result.newlyPublished.join(', ')}.`;
    }
    if (result.newAssignments > 0) {
      message += ` ${result.newAssignments} new assignments added.`;
    }
    if (result.dueSoon.length > 0) {
      message += ` ${result.dueSoon.length} items due within 7 days.`;
    }

    return c.json({
      success: true,
      data: result,
      message,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'CHECK_ERROR', message: String(error) },
    }, 500);
  }
});

/**
 * GET /api/ingestion/canvas/course/:id/deep-scan
 * Deep scan a specific course for all content
 */
ingestionRouter.get('/canvas/course/:id/deep-scan', async (c) => {
  if (!canvasIntegration.isConfigured()) {
    return c.json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'Canvas not configured' },
    }, 400);
  }

  const courseId = parseInt(c.req.param('id'), 10);
  if (isNaN(courseId)) {
    return c.json({
      success: false,
      error: { code: 'INVALID_ID', message: 'Invalid course ID' },
    }, 400);
  }

  try {
    const content = await canvasIntegration.deepScanCourse(courseId);
    return c.json({
      success: true,
      data: {
        assignments: content.assignments.length,
        discussionsWithDue: content.discussions.length,
        readings: content.readings.length,
        announcements: content.announcements.length,
        modules: content.moduleStructure.length,
        moduleDetails: content.moduleStructure.map(m => ({
          name: m.module.name,
          itemCount: m.items.length,
          items: m.items.map(i => ({
            title: i.title,
            type: i.type,
          })),
        })),
      },
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'SCAN_ERROR', message: String(error) },
    }, 500);
  }
});

// ============================================
// Remarkable Routes
// ============================================

/**
 * GET /api/ingestion/remarkable/status
 * Get Remarkable integration status
 */
ingestionRouter.get('/remarkable/status', async (c) => {
  const status = remarkableIntegration.getStatus();
  
  return c.json({
    success: true,
    data: status,
    setupInstructions: !status.configured ? [
      '1. Set REMARKABLE_SYNC_PATH to a folder where you export Remarkable notes',
      '2. Use rmapi (github.com/juruen/rmapi) to auto-sync, or export manually',
      '3. Optionally set GOOGLE_APPLICATION_CREDENTIALS for OCR',
    ] : null,
  });
});

/**
 * GET /api/ingestion/remarkable/documents
 * List documents in sync folder
 */
ingestionRouter.get('/remarkable/documents', async (c) => {
  if (!remarkableIntegration.isConfigured()) {
    return c.json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'Remarkable not configured' },
    }, 400);
  }

  const documents = remarkableIntegration.listDocuments();
  return c.json({
    success: true,
    data: documents.map(doc => ({
      filename: doc.filename,
      type: doc.type,
      modifiedAt: doc.modifiedAt,
      size: doc.size,
    })),
    count: documents.length,
  });
});

/**
 * POST /api/ingestion/remarkable/sync
 * Sync all Remarkable documents
 */
ingestionRouter.post('/remarkable/sync', async (c) => {
  if (!remarkableIntegration.isConfigured()) {
    return c.json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'Remarkable not configured' },
    }, 400);
  }

  try {
    const result = await remarkableIntegration.syncAll();
    return c.json({
      success: true,
      data: result,
      message: `Processed ${result.processed} documents, skipped ${result.skipped}`,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'SYNC_ERROR', message: String(error) },
    }, 500);
  }
});

/**
 * POST /api/ingestion/remarkable/watch/start
 * Start watching sync folder
 */
ingestionRouter.post('/remarkable/watch/start', async (c) => {
  if (!remarkableIntegration.isConfigured()) {
    return c.json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'Remarkable not configured' },
    }, 400);
  }

  const started = remarkableIntegration.startWatching();
  return c.json({
    success: started,
    message: started ? 'Started watching for new files' : 'Failed to start watching',
  });
});

/**
 * POST /api/ingestion/remarkable/watch/stop
 * Stop watching sync folder
 */
ingestionRouter.post('/remarkable/watch/stop', async (c) => {
  remarkableIntegration.stopWatching();
  return c.json({
    success: true,
    message: 'Stopped watching',
  });
});

// ============================================
// Plaud Routes
// ============================================

/**
 * GET /api/ingestion/plaud/status
 * Get Plaud integration status
 */
ingestionRouter.get('/plaud/status', async (c) => {
  const status = plaudIntegration.getStatus();
  
  return c.json({
    success: true,
    data: status,
    setupInstructions: !status.configured ? [
      '1. Set PLAUD_SYNC_PATH to the folder where Plaud syncs recordings',
      '2. Optionally configure R2 storage for cloud backup',
      '3. Set DEEPGRAM_API_KEY for transcription',
    ] : null,
  });
});

/**
 * GET /api/ingestion/plaud/recordings
 * List recordings in sync folder
 */
ingestionRouter.get('/plaud/recordings', async (c) => {
  if (!plaudIntegration.isConfigured()) {
    return c.json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'Plaud not configured' },
    }, 400);
  }

  const recordings = plaudIntegration.listRecordings();
  return c.json({
    success: true,
    data: recordings.map(rec => ({
      filename: rec.filename,
      size: rec.size,
      modifiedAt: rec.modifiedAt,
    })),
    count: recordings.length,
  });
});

/**
 * POST /api/ingestion/plaud/sync
 * Sync all Plaud recordings
 */
ingestionRouter.post('/plaud/sync', async (c) => {
  if (!plaudIntegration.isConfigured()) {
    return c.json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'Plaud not configured' },
    }, 400);
  }

  try {
    const result = await plaudIntegration.syncAll();
    return c.json({
      success: true,
      data: result,
      message: `Uploaded ${result.uploaded} recordings, queued ${result.queued} for processing`,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'SYNC_ERROR', message: String(error) },
    }, 500);
  }
});

/**
 * POST /api/ingestion/plaud/watch/start
 * Start watching sync folder
 */
ingestionRouter.post('/plaud/watch/start', async (c) => {
  if (!plaudIntegration.isConfigured()) {
    return c.json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'Plaud not configured' },
    }, 400);
  }

  const started = plaudIntegration.startWatching();
  return c.json({
    success: started,
    message: started ? 'Started watching for new recordings' : 'Failed to start watching',
  });
});

/**
 * POST /api/ingestion/plaud/watch/stop
 * Stop watching sync folder
 */
ingestionRouter.post('/plaud/watch/stop', async (c) => {
  plaudIntegration.stopWatching();
  return c.json({
    success: true,
    message: 'Stopped watching',
  });
});

// ============================================
// Gmail Routes
// ============================================

/**
 * GET /api/ingestion/gmail/status
 * Get Gmail integration status
 */
ingestionRouter.get('/gmail/status', async (c) => {
  const status = gmailIntegration.getStatus();
  
  return c.json({
    success: true,
    data: status,
    setupInstructions: !status.configured ? [
      '1. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET',
      '2. Set GOOGLE_REFRESH_TOKEN (from OAuth flow)',
      '3. Set GOOGLE_USER_EMAIL',
    ] : null,
  });
});

/**
 * POST /api/ingestion/gmail/fetch
 * Fetch and queue recent emails for triage
 */
ingestionRouter.post('/gmail/fetch', async (c) => {
  if (!gmailIntegration.isReady()) {
    return c.json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'Gmail not configured' },
    }, 400);
  }

  try {
    const result = await gmailIntegration.queueEmailsForTriage();
    return c.json({
      success: true,
      data: result,
      message: `Queued ${result.queued} emails for triage`,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'FETCH_ERROR', message: String(error) },
    }, 500);
  }
});

// ============================================
// Quick Capture Routes
// ============================================

/**
 * POST /api/ingestion/capture
 * Quick capture endpoint for ideas, notes, and tasks
 * 
 * Body:
 * - type: 'task' | 'note' | 'idea'
 * - content: string (the captured text)
 * - context?: string (class, project, etc.)
 * - source?: string (where it came from)
 */
ingestionRouter.post('/capture', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  
  const { type = 'task', content, context = 'Inbox', source = 'quick-capture' } = body;
  
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    return c.json({
      success: false,
      error: { code: 'INVALID_CONTENT', message: 'Content is required' },
    }, 400);
  }

  try {
    let result: { id: string; type: string };

    switch (type) {
      case 'task': {
        // Create a task in the inbox
        const [task] = await db.insert(tasks).values({
          title: content.trim().substring(0, 200),
          description: content.length > 200 ? content : undefined,
          status: 'inbox',
          priority: 0,
          source: 'manual',
          sourceRef: `capture:${Date.now()}`,
          context,
        }).returning();
        
        result = { id: task.id, type: 'task' };
        break;
      }

      case 'note':
      case 'idea': {
        // Create a vault entry
        const [entry] = await db.insert(vaultEntries).values({
          title: content.trim().substring(0, 100),
          content: content,
          contentType: type === 'idea' ? 'note' : 'reference',
          context,
          tags: [type, 'quick-capture'],
          source: 'manual',
          sourceRef: `capture:${Date.now()}`,
          sourceDate: new Date(),
        }).returning();
        
        result = { id: entry.id, type: 'vault_entry' };
        break;
      }

      default:
        return c.json({
          success: false,
          error: { code: 'INVALID_TYPE', message: 'Type must be task, note, or idea' },
        }, 400);
    }

    return c.json({
      success: true,
      data: result,
      message: `Captured as ${type}`,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'CAPTURE_ERROR', message: String(error) },
    }, 500);
  }
});

/**
 * POST /api/ingestion/voice
 * Process voice memo (text from speech-to-text)
 * 
 * Body:
 * - transcript: string (the transcribed text)
 * - duration?: number (duration in seconds)
 * - context?: string
 */
ingestionRouter.post('/voice', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  
  const { transcript, duration, context = 'Voice Memo' } = body;
  
  if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
    return c.json({
      success: false,
      error: { code: 'INVALID_TRANSCRIPT', message: 'Transcript is required' },
    }, 400);
  }

  try {
    // Create a vault entry for the voice memo
    const [entry] = await db.insert(vaultEntries).values({
      title: `Voice Memo - ${new Date().toLocaleString()}`,
      content: transcript,
      contentType: 'note',
      context,
      tags: ['voice-memo', 'quick-capture'],
      source: 'manual',
      sourceRef: `voice:${Date.now()}`,
      sourceDate: new Date(),
    }).returning();

    // Also create a task to process this voice memo
    const [task] = await db.insert(tasks).values({
      title: 'Process voice memo',
      description: `Review and process voice memo captured at ${new Date().toLocaleString()}\n\nTranscript:\n${transcript.substring(0, 500)}${transcript.length > 500 ? '...' : ''}`,
      status: 'inbox',
      priority: 0,
      source: 'manual',
      sourceRef: `voice:${entry.id}`,
      context,
    }).returning();

    return c.json({
      success: true,
      data: {
        vaultEntryId: entry.id,
        taskId: task.id,
        duration,
      },
      message: 'Voice memo captured and task created for processing',
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'CAPTURE_ERROR', message: String(error) },
    }, 500);
  }
});

// ============================================
// VIP (Vault Ingestion Pipeline) Routes
// ============================================

/**
 * POST /api/ingestion/vip/upload
 * Upload audio files for VIP processing
 *
 * Body (multipart/form-data):
 * - files[]: Audio files (MP3/WAV)
 * - batchDate: Date string (YYYY-MM-DD) - defaults to today in America/Denver
 * - context?: Optional context string
 */
ingestionRouter.post('/vip/upload', async (c) => {
  try {
    const formData = await c.req.formData();
    const files = formData.getAll('files') as File[];
    const batchDateStr = formData.get('batchDate') as string;
    const context = formData.get('context') as string;

    if (!files || files.length === 0) {
      return c.json({
        success: false,
        error: { code: 'NO_FILES', message: 'No files provided' },
      }, 400);
    }

    // Validate file types
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave'];
    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        return c.json({
          success: false,
          error: { code: 'INVALID_FILE_TYPE', message: `File ${file.name} has invalid type: ${file.type}. Only MP3/WAV allowed.` },
        }, 400);
      }
    }

    // Parse batch date (America/Denver timezone)
    let batchDate: Date;
    if (batchDateStr) {
      batchDate = new Date(batchDateStr + 'T00:00:00');
      // Validate it's a valid date
      if (isNaN(batchDate.getTime())) {
        return c.json({
          success: false,
          error: { code: 'INVALID_DATE', message: 'Invalid batch date format. Use YYYY-MM-DD.' },
        }, 400);
      }
    } else {
      // Default to today in America/Denver timezone
      batchDate = new Date();
      batchDate.setHours(0, 0, 0, 0);
    }

    // Convert files to VIP file format
    const vipFiles = await Promise.all(files.map(async (file) => {
      // Save to temp location for processing
      const tempPath = `/tmp/vip-${Date.now()}-${file.name}`;
      await Bun.write(tempPath, file);

      return {
        filename: file.name,
        path: tempPath,
        size: file.size,
        mimeType: file.type,
        durationSeconds: undefined, // Will be determined during processing
        originalName: file.name,
      };
    }));

    // Create VIP batch
    const batchId = await vipService.createBatch({
      batchDate,
      files: vipFiles,
      context,
    });

    return c.json({
      success: true,
      data: {
        batchId,
        batchDate: batchDate.toISOString().split('T')[0],
        filesUploaded: files.length,
        totalSize: vipFiles.reduce((sum, f) => sum + f.size, 0),
      },
      message: `VIP batch created with ${files.length} files. Processing started.`,
    });

  } catch (error) {
    console.error('[VIP] Upload failed:', error);
    return c.json({
      success: false,
      error: { code: 'UPLOAD_ERROR', message: String(error) },
    }, 500);
  }
});

/**
 * GET /api/ingestion/vip/status
 * Get VIP service status
 */
ingestionRouter.get('/vip/status', async (c) => {
  const storageConfigured = vipService.isStorageConfigured();

  return c.json({
    success: true,
    data: {
      service: 'vip',
      storageConfigured,
      version: '0.1.0',
      status: 'operational',
    },
  });
});

/**
 * GET /api/ingestion/vip/batches
 * Get VIP batches with optional date range
 *
 * Query params:
 * - startDate?: YYYY-MM-DD
 * - endDate?: YYYY-MM-DD
 * - limit?: number (default 50)
 */
ingestionRouter.get('/vip/batches', async (c) => {
  try {
    const { startDate, endDate, limit } = c.req.query();

    let start: Date;
    let end: Date;

    if (startDate) {
      start = new Date(startDate + 'T00:00:00');
    } else {
      // Default to last 30 days
      start = new Date();
      start.setDate(start.getDate() - 30);
    }

    if (endDate) {
      end = new Date(endDate + 'T23:59:59');
    } else {
      // Default to today
      end = new Date();
      end.setHours(23, 59, 59, 999);
    }

    const batches = await vipService.getBatches(start, end);

    // Apply limit if specified
    const limitNum = limit ? parseInt(limit) : 50;
    const limitedBatches = batches.slice(0, limitNum);

    return c.json({
      success: true,
      data: limitedBatches,
      count: limitedBatches.length,
      dateRange: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
      },
    });

  } catch (error) {
    console.error('[VIP] Failed to get batches:', error);
    return c.json({
      success: false,
      error: { code: 'FETCH_ERROR', message: String(error) },
    }, 500);
  }
});

/**
 * GET /api/ingestion/vip/batches/:id
 * Get specific VIP batch status
 */
ingestionRouter.get('/vip/batches/:id', async (c) => {
  try {
    const batchId = c.req.param('id');
    const batch = await vipService.getBatchStatus(batchId);

    if (!batch) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Batch not found' },
      }, 404);
    }

    return c.json({
      success: true,
      data: batch,
    });

  } catch (error) {
    console.error(`[VIP] Failed to get batch ${c.req.param('id')}:`, error);
    return c.json({
      success: false,
      error: { code: 'FETCH_ERROR', message: String(error) },
    }, 500);
  }
});

/**
 * POST /api/ingestion/vip/batches/:id/resume
 * Resume processing for a failed/partial batch
 */
ingestionRouter.post('/vip/batches/:id/resume', async (c) => {
  try {
    const batchId = c.req.param('id');

    // Check if batch exists
    const batch = await vipService.getBatchStatus(batchId);
    if (!batch) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Batch not found' },
      }, 404);
    }

    if (batch.status === 'complete') {
      return c.json({
        success: false,
        error: { code: 'ALREADY_COMPLETE', message: 'Batch is already complete' },
      }, 400);
    }

    // Resume processing
    await vipService.resumeBatch(batchId);

    return c.json({
      success: true,
      message: `Resumed processing for batch ${batchId}`,
    });

  } catch (error) {
    console.error(`[VIP] Failed to resume batch ${c.req.param('id')}:`, error);
    return c.json({
      success: false,
      error: { code: 'RESUME_ERROR', message: String(error) },
    }, 500);
  }
});

export { ingestionRouter };

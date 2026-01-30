/**
 * JD Agent - Document Ingestion API Routes
 * 
 * Endpoints for managing document ingestion:
 * - Canvas LMS sync
 * - Remarkable notes sync
 * - Manual document upload (future)
 */

import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { canvasIntegration } from '../../integrations/canvas';
import { remarkableIntegration } from '../../integrations/remarkable';
import { remarkableGDriveSync } from '../../services/remarkable-gdrive-sync';
import { remarkableCloudSync } from '../../services/remarkable-cloud-sync';
import { plaudIntegration } from '../../integrations/plaud';
import { plaudApiClient } from '../../integrations/plaud-api';
import { plaudGDriveSync } from '../../services/plaud-gdrive-sync';
import { plaudBrowserSync } from '../../services/plaud-browser-sync';
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
  const status = await remarkableIntegration.getStatus();

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

/**
 * GET /api/ingestion/remarkable/stats
 * Get comprehensive sync statistics
 */
ingestionRouter.get('/remarkable/stats', async (c) => {
  const { remarkableService } = await import('../../services/remarkable-service');

  try {
    const stats = await remarkableService.getSyncStats();
    return c.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'STATS_ERROR', message: String(error) },
    }, 500);
  }
});

/**
 * GET /api/ingestion/remarkable/classes
 * Get class summaries with note counts
 */
ingestionRouter.get('/remarkable/classes', async (c) => {
  const { remarkableService } = await import('../../services/remarkable-service');

  try {
    const summaries = await remarkableService.getClassSummaries();
    return c.json({
      success: true,
      data: summaries,
      count: summaries.length,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'QUERY_ERROR', message: String(error) },
    }, 500);
  }
});

/**
 * GET /api/ingestion/remarkable/notes/:classCode
 * Get notes for a specific class
 */
ingestionRouter.get('/remarkable/notes/:classCode', async (c) => {
  const { remarkableService } = await import('../../services/remarkable-service');
  const classCode = c.req.param('classCode');

  try {
    const notes = await remarkableService.getNotesByClass(classCode.toUpperCase());
    return c.json({
      success: true,
      data: notes,
      count: notes.length,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'QUERY_ERROR', message: String(error) },
    }, 500);
  }
});

/**
 * GET /api/ingestion/remarkable/inbox
 * Get general inbox notes (non-class notes)
 */
ingestionRouter.get('/remarkable/inbox', async (c) => {
  const { remarkableService } = await import('../../services/remarkable-service');

  try {
    const notes = await remarkableService.getInboxNotes();
    return c.json({
      success: true,
      data: notes,
      count: notes.length,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'QUERY_ERROR', message: String(error) },
    }, 500);
  }
});

/**
 * GET /api/ingestion/remarkable/review
 * Get notes needing manual review (low OCR confidence)
 */
ingestionRouter.get('/remarkable/review', async (c) => {
  const { remarkableService } = await import('../../services/remarkable-service');

  try {
    const notes = await remarkableService.getNotesNeedingReview();
    return c.json({
      success: true,
      data: notes,
      count: notes.length,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'QUERY_ERROR', message: String(error) },
    }, 500);
  }
});

/**
 * POST /api/ingestion/remarkable/merge/:classCode/:noteDate
 * Generate combined markdown for a class day
 */
ingestionRouter.post('/remarkable/merge/:classCode/:noteDate', async (c) => {
  const { remarkableService } = await import('../../services/remarkable-service');
  const classCode = c.req.param('classCode');
  const noteDate = c.req.param('noteDate');

  try {
    const result = await remarkableService.generateCombinedMarkdown(
      classCode.toUpperCase(),
      noteDate
    );

    if (result.success) {
      return c.json({
        success: true,
        data: {
          vaultPageId: result.vaultPageId,
          combinedFilePath: result.combinedFilePath,
        },
        message: `Combined markdown generated for ${classCode}/${noteDate}`,
      });
    }

    return c.json({
      success: false,
      error: { code: 'MERGE_ERROR', message: result.error },
    }, 400);
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'MERGE_ERROR', message: String(error) },
    }, 500);
  }
});

/**
 * POST /api/ingestion/remarkable/merge-all
 * Merge all pending class notes
 */
ingestionRouter.post('/remarkable/merge-all', async (c) => {
  const { remarkableService } = await import('../../services/remarkable-service');

  try {
    const result = await remarkableService.mergeAllPendingClassNotes();
    return c.json({
      success: true,
      data: {
        merged: result.merged,
        errors: result.errors,
      },
      message: `Merged ${result.merged} class notes`,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'MERGE_ERROR', message: String(error) },
    }, 500);
  }
});

/**
 * PATCH /api/ingestion/remarkable/notes/:noteId/ocr
 * Update OCR text for a note (manual correction)
 */
ingestionRouter.patch('/remarkable/notes/:noteId/ocr', async (c) => {
  const { remarkableService } = await import('../../services/remarkable-service');
  const noteId = c.req.param('noteId');

  try {
    const body = await c.req.json();
    const { ocrText } = body;

    if (!ocrText) {
      return c.json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'ocrText is required' },
      }, 400);
    }

    await remarkableService.updateOcrText(noteId, ocrText);
    return c.json({
      success: true,
      message: 'OCR text updated',
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: String(error) },
    }, 500);
  }
});

/**
 * PATCH /api/ingestion/remarkable/notes/:noteId/reclassify
 * Re-classify a note (move from inbox to class note or vice versa)
 */
ingestionRouter.patch('/remarkable/notes/:noteId/reclassify', async (c) => {
  const { remarkableService } = await import('../../services/remarkable-service');
  const noteId = c.req.param('noteId');

  try {
    const body = await c.req.json();
    const { type, semester, classCode, noteDate } = body;

    if (!type || !['class_note', 'general'].includes(type)) {
      return c.json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'type must be "class_note" or "general"' },
      }, 400);
    }

    if (type === 'class_note' && (!semester || !classCode || !noteDate)) {
      return c.json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'semester, classCode, and noteDate are required for class notes' },
      }, 400);
    }

    await remarkableService.reclassifyNote(noteId, { type, semester, classCode, noteDate });
    return c.json({
      success: true,
      message: `Note reclassified as ${type}`,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: String(error) },
    }, 500);
  }
});

/**
 * POST /api/ingestion/remarkable/notes/:noteId/reviewed
 * Mark a note as reviewed (clear needs_review status)
 */
ingestionRouter.post('/remarkable/notes/:noteId/reviewed', async (c) => {
  const { remarkableService } = await import('../../services/remarkable-service');
  const noteId = c.req.param('noteId');

  try {
    await remarkableService.markAsReviewed(noteId);
    return c.json({
      success: true,
      message: 'Note marked as reviewed',
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'UPDATE_ERROR', message: String(error) },
    }, 500);
  }
});

/**
 * DELETE /api/ingestion/remarkable/notes/:noteId
 * Delete a remarkable note
 */
ingestionRouter.delete('/remarkable/notes/:noteId', async (c) => {
  const { remarkableService } = await import('../../services/remarkable-service');
  const noteId = c.req.param('noteId');

  try {
    await remarkableService.deleteNote(noteId);
    return c.json({
      success: true,
      message: 'Note deleted',
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'DELETE_ERROR', message: String(error) },
    }, 500);
  }
});

/**
 * POST /api/ingestion/remarkable/jobs/sync
 * Queue a background sync job
 */
ingestionRouter.post('/remarkable/jobs/sync', async (c) => {
  const { addRemarkableSyncJob } = await import('../../jobs/queue');

  try {
    const body = await c.req.json().catch(() => ({}));
    const job = await addRemarkableSyncJob({
      forceReprocess: body.forceReprocess || false,
    });

    return c.json({
      success: true,
      data: { jobId: job.id },
      message: 'Sync job queued',
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'JOB_ERROR', message: String(error) },
    }, 500);
  }
});

/**
 * POST /api/ingestion/remarkable/jobs/merge
 * Queue a background merge job for a class day
 */
ingestionRouter.post('/remarkable/jobs/merge', async (c) => {
  const { addRemarkableMergeJob } = await import('../../jobs/queue');

  try {
    const body = await c.req.json();
    const { classCode, noteDate } = body;

    if (!classCode || !noteDate) {
      return c.json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'classCode and noteDate are required' },
      }, 400);
    }

    const job = await addRemarkableMergeJob({
      classCode: classCode.toUpperCase(),
      noteDate,
    });

    return c.json({
      success: true,
      data: { jobId: job.id },
      message: `Merge job queued for ${classCode}/${noteDate}`,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'JOB_ERROR', message: String(error) },
    }, 500);
  }
});

// ============================================
// Remarkable Google Drive Sync Routes
// ============================================

/**
 * GET /api/ingestion/remarkable/gdrive/status
 * Get Google Drive sync status for Remarkable
 */
ingestionRouter.get('/remarkable/gdrive/status', async (c) => {
  const status = remarkableGDriveSync.getStatus();

  return c.json({
    success: true,
    data: status,
    setupInstructions: !status.configured ? [
      '1. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN',
      '2. Set REMARKABLE_SYNC_PATH to local folder for downloaded PDFs',
      '3. Create a "Remarkable" folder in Google Drive',
      '4. Export PDFs from Remarkable tablet to that Google Drive folder',
      '5. Call /gdrive/polling/start to enable automatic syncing',
    ] : null,
  });
});

/**
 * POST /api/ingestion/remarkable/gdrive/sync
 * Manually trigger Google Drive sync
 */
ingestionRouter.post('/remarkable/gdrive/sync', async (c) => {
  if (!remarkableGDriveSync.isConfigured()) {
    return c.json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'Google Drive sync not configured' },
    }, 400);
  }

  try {
    const result = await remarkableGDriveSync.sync();

    return c.json({
      success: true,
      data: {
        downloaded: result.downloaded,
        skipped: result.skipped,
        errors: result.errors,
        files: result.files.map(f => ({
          filename: f.filename,
          drivePath: f.drivePath,
          localPath: f.localPath,
          size: f.size,
          syncedAt: f.syncedAt,
        })),
      },
      message: `Downloaded ${result.downloaded} files, skipped ${result.skipped}`,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'SYNC_ERROR', message: String(error) },
    }, 500);
  }
});

/**
 * POST /api/ingestion/remarkable/gdrive/polling/start
 * Start automatic polling of Google Drive
 */
ingestionRouter.post('/remarkable/gdrive/polling/start', async (c) => {
  if (!remarkableGDriveSync.isConfigured()) {
    return c.json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'Google Drive sync not configured' },
    }, 400);
  }

  const started = remarkableGDriveSync.startPolling();
  const status = remarkableGDriveSync.getStatus();

  return c.json({
    success: started,
    data: {
      polling: status.polling,
      pollIntervalMinutes: status.pollIntervalMinutes,
    },
    message: started
      ? `Started polling Google Drive every ${status.pollIntervalMinutes} minutes`
      : 'Failed to start polling (already running or not configured)',
  });
});

/**
 * POST /api/ingestion/remarkable/gdrive/polling/stop
 * Stop automatic polling of Google Drive
 */
ingestionRouter.post('/remarkable/gdrive/polling/stop', async (c) => {
  remarkableGDriveSync.stopPolling();

  return c.json({
    success: true,
    message: 'Stopped Google Drive polling',
  });
});

/**
 * POST /api/ingestion/remarkable/gdrive/setup-folders
 * Create recommended folder structure in Google Drive
 */
ingestionRouter.post('/remarkable/gdrive/setup-folders', async (c) => {
  if (!remarkableGDriveSync.isConfigured()) {
    return c.json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'Google Drive sync not configured' },
    }, 400);
  }

  try {
    const body = await c.req.json().catch(() => ({}));
    const classes = body.classes || ['MGMT501', 'MGMT502', 'MKTG501', 'ACCT501', 'FINC501'];

    const result = await remarkableGDriveSync.createFolderStructure(classes);

    return c.json({
      success: true,
      data: result,
      message: `Created folder structure with ${classes.length} class folders`,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'SETUP_ERROR', message: String(error) },
    }, 500);
  }
});

// ============================================
// Remarkable Cloud Sync Routes
// ============================================

/**
 * GET /api/ingestion/remarkable/cloud/status
 * Get Remarkable Cloud sync status
 */
ingestionRouter.get('/remarkable/cloud/status', async (c) => {
  const status = remarkableCloudSync.getStatus();

  return c.json({
    success: true,
    data: status,
    setupInstructions: !status.configured ? [
      '1. Obtain a device token from Remarkable authentication',
      '2. Set REMARKABLE_DEVICE_TOKEN in .env or call /cloud/auth/device',
      '3. Call /cloud/sync to sync documents from Remarkable Cloud',
      '4. Changes will be detected and notifications sent',
    ] : null,
  });
});

/**
 * POST /api/ingestion/remarkable/cloud/auth/device
 * Set the device token for Remarkable Cloud
 */
ingestionRouter.post('/remarkable/cloud/auth/device', async (c) => {
  try {
    const body = await c.req.json();
    const { deviceToken } = body;

    if (!deviceToken) {
      return c.json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'deviceToken is required' },
      }, 400);
    }

    remarkableCloudSync.setDeviceToken(deviceToken);

    return c.json({
      success: true,
      message: 'Device token set successfully',
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'AUTH_ERROR', message: String(error) },
    }, 500);
  }
});

/**
 * POST /api/ingestion/remarkable/cloud/sync
 * Sync with Remarkable Cloud and detect changes
 */
ingestionRouter.post('/remarkable/cloud/sync', async (c) => {
  if (!remarkableCloudSync.isConfigured()) {
    return c.json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'Remarkable Cloud not configured. Set device token first.' },
    }, 400);
  }

  try {
    const result = await remarkableCloudSync.sync();

    // Format changes for response
    const changesFormatted = result.changes.map(ch => ({
      id: ch.document.id,
      name: ch.document.name,
      changeType: ch.changeType,
      lastModified: new Date(ch.document.lastModified).toISOString(),
      pageCount: ch.document.pageCount,
    }));

    return c.json({
      success: result.success,
      data: {
        documentsFound: result.documentsFound,
        changesDetected: result.changes.length,
        changes: changesFormatted,
        errors: result.errors,
      },
      message: result.changes.length > 0
        ? `Found ${result.changes.length} changed document(s)`
        : `Synced ${result.documentsFound} documents, no changes`,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'SYNC_ERROR', message: String(error) },
    }, 500);
  }
});

/**
 * GET /api/ingestion/remarkable/cloud/documents
 * List all tracked documents from Remarkable Cloud
 */
ingestionRouter.get('/remarkable/cloud/documents', async (c) => {
  if (!remarkableCloudSync.isConfigured()) {
    return c.json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'Remarkable Cloud not configured' },
    }, 400);
  }

  const documents = remarkableCloudSync.getAllDocuments();

  return c.json({
    success: true,
    data: documents.map(doc => ({
      id: doc.id,
      name: doc.name,
      type: doc.type,
      parent: doc.parent,
      lastModified: new Date(doc.lastModified).toISOString(),
      pageCount: doc.pageCount,
    })),
    count: documents.length,
  });
});

/**
 * GET /api/ingestion/remarkable/cloud/pending
 * Get documents with pending notifications (new/updated)
 */
ingestionRouter.get('/remarkable/cloud/pending', async (c) => {
  if (!remarkableCloudSync.isConfigured()) {
    return c.json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'Remarkable Cloud not configured' },
    }, 400);
  }

  const pending = remarkableCloudSync.getPendingNotifications();

  return c.json({
    success: true,
    data: pending.map(ch => ({
      id: ch.document.id,
      name: ch.document.name,
      changeType: ch.changeType,
      lastModified: new Date(ch.document.lastModified).toISOString(),
    })),
    count: pending.length,
    message: pending.length > 0
      ? `${pending.length} document(s) have unacknowledged changes`
      : 'No pending notifications',
  });
});

/**
 * POST /api/ingestion/remarkable/cloud/notify
 * Send notification for pending document changes
 */
ingestionRouter.post('/remarkable/cloud/notify', async (c) => {
  if (!remarkableCloudSync.isConfigured()) {
    return c.json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'Remarkable Cloud not configured' },
    }, 400);
  }

  try {
    const pending = remarkableCloudSync.getPendingNotifications();

    if (pending.length === 0) {
      return c.json({
        success: true,
        message: 'No pending notifications',
      });
    }

    // Import notification service
    const { notificationService } = await import('../../services/notification-service');

    // Build notification message
    const newDocs = pending.filter(p => p.changeType === 'new');
    const updatedDocs = pending.filter(p => p.changeType === 'updated');

    let message = '📝 *Remarkable Notes Update*\n\n';

    if (newDocs.length > 0) {
      message += `*New Documents (${newDocs.length}):*\n`;
      for (const doc of newDocs.slice(0, 5)) {
        message += `• ${doc.document.name}\n`;
      }
      if (newDocs.length > 5) {
        message += `_...and ${newDocs.length - 5} more_\n`;
      }
      message += '\n';
    }

    if (updatedDocs.length > 0) {
      message += `*Updated Documents (${updatedDocs.length}):*\n`;
      for (const doc of updatedDocs.slice(0, 5)) {
        message += `• ${doc.document.name}\n`;
      }
      if (updatedDocs.length > 5) {
        message += `_...and ${updatedDocs.length - 5} more_\n`;
      }
      message += '\n';
    }

    message += '_Export to Google Drive from Remarkable app to sync._';

    // Send notification
    const sent = await notificationService.send(message);

    // Mark as notified
    const documentIds = pending.map(p => p.document.id);
    remarkableCloudSync.markNotified(documentIds);

    return c.json({
      success: sent,
      data: {
        notified: documentIds.length,
        newDocs: newDocs.length,
        updatedDocs: updatedDocs.length,
      },
      message: sent
        ? `Notification sent for ${documentIds.length} document(s)`
        : 'Failed to send notification',
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'NOTIFY_ERROR', message: String(error) },
    }, 500);
  }
});

/**
 * POST /api/ingestion/remarkable/cloud/polling/start
 * Start automatic polling of Remarkable Cloud
 */
ingestionRouter.post('/remarkable/cloud/polling/start', async (c) => {
  if (!remarkableCloudSync.isConfigured()) {
    return c.json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'Remarkable Cloud not configured' },
    }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const intervalMinutes = body.intervalMinutes || 30;

  const started = remarkableCloudSync.startPolling(intervalMinutes);

  return c.json({
    success: started,
    message: started
      ? `Started polling Remarkable Cloud every ${intervalMinutes} minutes`
      : 'Failed to start polling',
  });
});

/**
 * POST /api/ingestion/remarkable/cloud/polling/stop
 * Stop automatic polling of Remarkable Cloud
 */
ingestionRouter.post('/remarkable/cloud/polling/stop', async (c) => {
  remarkableCloudSync.stopPolling();

  return c.json({
    success: true,
    message: 'Stopped polling Remarkable Cloud',
  });
});

/**
 * DELETE /api/ingestion/remarkable/cloud/state
 * Clear tracked documents (force fresh sync)
 */
ingestionRouter.delete('/remarkable/cloud/state', async (c) => {
  remarkableCloudSync.clearState();

  return c.json({
    success: true,
    message: 'Cleared all tracked documents. Next sync will treat all as new.',
  });
});

/**
 * POST /api/ingestion/remarkable/cloud/download/:id
 * Download a document bundle from Remarkable Cloud
 */
ingestionRouter.post('/remarkable/cloud/download/:id', async (c) => {
  const { id } = c.req.param();

  try {
    const documentPath = await remarkableCloudSync.downloadDocument(id);

    return c.json({
      success: true,
      data: {
        documentId: id,
        downloadPath: documentPath,
      },
    });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'DOWNLOAD_FAILED',
        message: error instanceof Error ? error.message : String(error),
      },
    }, 500);
  }
});

/**
 * POST /api/ingestion/remarkable/cloud/render/:id
 * Download a document, render it to PDF, and extract text via OCR
 */
ingestionRouter.post('/remarkable/cloud/render/:id', async (c) => {
  const { id } = c.req.param();

  try {
    const result = await remarkableCloudSync.downloadAndRenderPdf(id);

    return c.json({
      success: true,
      data: {
        documentId: id,
        documentName: result.documentName,
        pdfPath: result.pdfPath,
        pdfUrl: result.pdfUrl,
        ocrText: result.ocrText || null,
        ocrCharCount: result.ocrText?.length || 0,
      },
    });
  } catch (error) {
    return c.json({
      success: false,
      error: {
        code: 'RENDER_FAILED',
        message: error instanceof Error ? error.message : String(error),
      },
    }, 500);
  }
});

// ============================================
// Remarkable MBA Sync Routes
// ============================================

/**
 * GET /api/ingestion/remarkable/mba/status
 * Get MBA folder sync status
 */
ingestionRouter.get('/remarkable/mba/status', async (c) => {
  const { remarkableMbaSyncService } = await import('../../services/remarkable-mba-sync');

  try {
    const status = await remarkableMbaSyncService.getStatus();

    return c.json({
      success: true,
      data: status,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'STATUS_ERROR', message: String(error) },
    }, 500);
  }
});

/**
 * GET /api/ingestion/remarkable/mba/tree
 * Get folder tree for MBA folder
 */
ingestionRouter.get('/remarkable/mba/tree', async (c) => {
  if (!remarkableCloudSync.isConfigured()) {
    return c.json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'Remarkable Cloud not configured' },
    }, 400);
  }

  try {
    const mbaFolder = remarkableCloudSync.findFolderByName('BYU MBA');

    if (!mbaFolder) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'BYU MBA folder not found in Remarkable Cloud' },
      }, 404);
    }

    const tree = remarkableCloudSync.getFolderTree(mbaFolder.id);

    return c.json({
      success: true,
      data: {
        rootFolder: {
          id: mbaFolder.id,
          name: mbaFolder.name,
        },
        tree,
      },
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'TREE_ERROR', message: String(error) },
    }, 500);
  }
});

/**
 * POST /api/ingestion/remarkable/mba/sync
 * Trigger full MBA folder sync to Vault
 */
ingestionRouter.post('/remarkable/mba/sync', async (c) => {
  if (!remarkableCloudSync.isConfigured()) {
    return c.json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'Remarkable Cloud not configured. Set device token first.' },
    }, 400);
  }

  const { remarkableMbaSyncService } = await import('../../services/remarkable-mba-sync');

  try {
    // First sync with Remarkable Cloud to get latest state
    console.log('[MBA Sync] Syncing with Remarkable Cloud...');
    await remarkableCloudSync.sync();

    // Then run the MBA folder sync
    console.log('[MBA Sync] Starting MBA folder sync...');
    const result = await remarkableMbaSyncService.syncMbaFolder();

    return c.json({
      success: result.success,
      data: {
        foldersProcessed: result.foldersProcessed,
        documentsProcessed: result.documentsProcessed,
        pagesCreated: result.pagesCreated,
        errors: result.errors,
      },
      message: result.success
        ? `Synced ${result.documentsProcessed} documents, created ${result.pagesCreated} pages`
        : `Sync completed with ${result.errors.length} errors`,
    });
  } catch (error) {
    console.error('[MBA Sync] Sync failed:', error);
    return c.json({
      success: false,
      error: { code: 'SYNC_ERROR', message: String(error) },
    }, 500);
  }
});

/**
 * POST /api/ingestion/remarkable/mba/jobs/sync
 * Queue MBA folder sync as a background job
 */
ingestionRouter.post('/remarkable/mba/jobs/sync', async (c) => {
  if (!remarkableCloudSync.isConfigured()) {
    return c.json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'Remarkable Cloud not configured. Set device token first.' },
    }, 400);
  }

  const { addRemarkableMbaSyncJob } = await import('../../jobs/queue');

  try {
    const body = await c.req.json().catch(() => ({}));
    const job = await addRemarkableMbaSyncJob({
      force: body.force || false,
    });

    return c.json({
      success: true,
      data: { jobId: job.id },
      message: 'MBA sync job queued',
    });
  } catch (error) {
    return c.json({
      success: false,
      error: { code: 'JOB_ERROR', message: String(error) },
    }, 500);
  }
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
 * Sync all Plaud recordings using browser-based sync
 */
ingestionRouter.post('/plaud/sync', async (c) => {
  // Use browser sync (most reliable - auto-login with credentials)
  if (plaudBrowserSync.isConfigured()) {
    try {
      console.log('[Ingestion] Triggering Plaud browser sync...');
      const result = await plaudBrowserSync.sync();
      return c.json({
        success: result.success,
        data: result,
        message: result.success
          ? `Synced ${result.synced} recordings, skipped ${result.skipped}`
          : `Sync failed: ${result.errors.join(', ')}`,
      });
    } catch (error) {
      console.error('[Ingestion] Plaud browser sync error:', error);
      return c.json({
        success: false,
        error: { code: 'SYNC_ERROR', message: String(error) },
      }, 500);
    }
  }

  // Fallback to local folder sync
  if (plaudIntegration.isConfigured()) {
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
  }

  return c.json({
    success: false,
    error: { code: 'NOT_CONFIGURED', message: 'Plaud not configured' },
  }, 400);
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

/**
 * POST /api/ingestion/plaud/webhook
 * Webhook endpoint for Zapier/Plaud to push transcripts automatically
 *
 * Expected payload from Zapier (Plaud trigger: "Transcript & Summary Ready"):
 * {
 *   recording_id: string,
 *   title: string,
 *   transcript: string,
 *   summary: string,
 *   duration_seconds: number,
 *   recorded_at: string (ISO date),
 *   audio_url?: string,
 *   speakers?: { id: number, name?: string }[],
 *   tags?: string[]
 * }
 */
ingestionRouter.post('/plaud/webhook', async (c) => {
  try {
    const payload = await c.req.json();

    console.log('[Plaud Webhook] Received transcript:', {
      id: payload.recording_id || payload.id,
      title: payload.title,
      duration: payload.duration_seconds,
    });

    // Validate required fields
    if (!payload.transcript && !payload.summary) {
      return c.json({
        success: false,
        error: 'Missing transcript or summary in payload',
      }, 400);
    }

    // Import required modules
    const { db } = await import('../../db/client');
    const { recordings, transcripts, vaultBlocks } = await import('../../db/schema');
    const { VaultPageService } = await import('../../services/vault-page-service');

    // Create recording record
    const recordingId = payload.recording_id || payload.id || crypto.randomUUID();
    const recordedAt = payload.recorded_at ? new Date(payload.recorded_at) : new Date();

    // Check if already processed
    const existing = await db
      .select()
      .from(recordings)
      .where(eq(recordings.id, recordingId))
      .limit(1);

    if (existing.length > 0) {
      return c.json({
        success: true,
        message: 'Recording already processed',
        recordingId,
      });
    }

    // Create recording
    const [recording] = await db.insert(recordings).values({
      id: recordingId,
      filePath: payload.audio_url || `plaud-webhook:${recordingId}`,
      originalFilename: payload.title || `Recording ${recordedAt.toISOString()}`,
      durationSeconds: payload.duration_seconds || 0,
      recordingType: payload.recording_type || 'other',
      context: payload.context,
      status: 'complete',
      recordedAt,
    }).returning();

    // Create transcript
    const [transcript] = await db.insert(transcripts).values({
      recordingId: recording.id,
      fullText: payload.transcript || '',
      segments: payload.segments || [],
      wordCount: (payload.transcript || '').split(/\s+/).length,
      speakerCount: payload.speakers?.length || 1,
      confidenceScore: 0.95,
    }).returning();

    // Create or find Vault page (prevent duplicates)
    const pageTitle = payload.title || `Recording - ${recordedAt.toLocaleDateString()}`;
    const vaultPageService = new VaultPageService();
    const { page, created } = await vaultPageService.findOrCreate({
      title: pageTitle,
      icon: '🎙️',
    });

    // Only add blocks if this is a new page
    if (!created) {
      console.log(`[Plaud Webhook] Using existing vault page: ${page.id}`);
    }

    // Add summary block
    if (payload.summary) {
      await db.insert(vaultBlocks).values({
        pageId: page.id,
        type: 'callout',
        content: {
          icon: '📝',
          text: `**Summary**\n\n${payload.summary}`,
        },
        sortOrder: 0,
      });
    }

    // Add transcript block
    if (payload.transcript) {
      await db.insert(vaultBlocks).values({
        pageId: page.id,
        type: 'text',
        content: {
          text: `## Full Transcript\n\n${payload.transcript}`,
        },
        sortOrder: 1,
      });
    }

    console.log('[Plaud Webhook] Created vault page:', page.id);

    return c.json({
      success: true,
      message: 'Recording processed successfully',
      data: {
        recordingId: recording.id,
        transcriptId: transcript.id,
        vaultPageId: page.id,
        title: pageTitle,
      },
    });
  } catch (error) {
    console.error('[Plaud Webhook] Error:', error);
    return c.json({
      success: false,
      error: String(error),
    }, 500);
  }
});

/**
 * GET /api/ingestion/plaud/api/status
 * Get Plaud Cloud API integration status
 */
ingestionRouter.get('/plaud/api/status', async (c) => {
  const status = plaudApiClient.getStatus();

  return c.json({
    success: true,
    data: status,
    setupInstructions: !status.configured ? [
      '1. Sign up at https://www.plaud.ai/pages/developer-platform',
      '2. Create an application to get client_id and client_secret',
      '3. Set PLAUD_CLIENT_ID and PLAUD_CLIENT_SECRET in .env.development',
      '4. Recordings will auto-sync every 30 minutes via scheduler',
    ] : null,
  });
});

/**
 * POST /api/ingestion/plaud/api/sync
 * Manually trigger sync from Plaud Cloud API
 */
ingestionRouter.post('/plaud/api/sync', async (c) => {
  if (!plaudApiClient.isConfigured()) {
    return c.json({
      success: false,
      error: {
        code: 'NOT_CONFIGURED',
        message: 'Plaud API not configured. Set PLAUD_CLIENT_ID and PLAUD_CLIENT_SECRET.',
      },
    }, 400);
  }

  try {
    const result = await plaudApiClient.syncNewRecordings();

    return c.json({
      success: true,
      data: result,
      message: `Synced ${result.synced} recordings from Plaud Cloud`,
    });
  } catch (error) {
    return c.json({
      success: false,
      error: String(error),
    }, 500);
  }
});

// ============================================
// Plaud Google Drive Routes
// ============================================

/**
 * GET /api/ingestion/plaud/gdrive/status
 * Get Plaud Google Drive sync status
 */
ingestionRouter.get('/plaud/gdrive/status', async (c) => {
  const status = plaudGDriveSync.getStatus();

  return c.json({
    success: true,
    data: status,
    setupInstructions: !status.configured ? [
      '1. Ensure Google OAuth is configured (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN)',
      '2. Set PLAUD_SYNC_PATH for local file processing',
      '3. Create a folder named "Plaud" in your Google Drive',
      '4. In the Plaud app, export recordings to Google Drive → Plaud folder',
      '5. Call /gdrive/sync to manually sync, or it runs automatically every 15 minutes',
    ] : null,
  });
});

/**
 * POST /api/ingestion/plaud/gdrive/sync
 * Manually trigger sync from Google Drive
 */
ingestionRouter.post('/plaud/gdrive/sync', async (c) => {
  if (!plaudGDriveSync.isConfigured()) {
    return c.json({
      success: false,
      error: {
        code: 'NOT_CONFIGURED',
        message: 'Plaud Google Drive sync not configured. Ensure Google OAuth and PLAUD_SYNC_PATH are set.',
      },
    }, 400);
  }

  try {
    const result = await plaudGDriveSync.sync();

    return c.json({
      success: true,
      data: result,
      message: result.processed > 0
        ? `Processed ${result.processed} recordings from Google Drive`
        : 'No new recordings found in Google Drive',
    });
  } catch (error) {
    return c.json({
      success: false,
      error: String(error),
    }, 500);
  }
});

/**
 * POST /api/ingestion/plaud/gdrive/create-folder
 * Create the Plaud folder in Google Drive if it doesn't exist
 */
ingestionRouter.post('/plaud/gdrive/create-folder', async (c) => {
  if (!plaudGDriveSync.isConfigured()) {
    return c.json({
      success: false,
      error: {
        code: 'NOT_CONFIGURED',
        message: 'Google Drive not configured',
      },
    }, 400);
  }

  try {
    const folderId = await plaudGDriveSync.createPlaudFolder();

    return c.json({
      success: true,
      data: { folderId },
      message: 'Plaud folder ready in Google Drive',
    });
  } catch (error) {
    return c.json({
      success: false,
      error: String(error),
    }, 500);
  }
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

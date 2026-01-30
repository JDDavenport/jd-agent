/**
 * Classes API Routes
 *
 * Provides endpoints for MBA class management:
 * - List classes with note counts
 * - Get class day notes (combined Plaud + Remarkable + typed)
 * - Trigger auto-combine for class notes
 * - Get class schedule from calendar
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db/client';
import {
  classes,
  remarkableNotes,
  classPages,
  calendarEvents,
  recordings,
  transcripts,
  vaultPages,
  vaultBlocks,
} from '../../db/schema';
import { eq, and, desc, gte, lte, sql, like, or } from 'drizzle-orm';
import { remarkableService } from '../../services/remarkable-service';
import { ValidationError, NotFoundError } from '../middleware/error-handler';

const classesRouter = new Hono();

// ============================================
// Types
// ============================================

interface ClassSummary {
  code: string;
  name: string;
  semester: string;
  noteCount: number;
  lastNoteDate?: string;
  hasPlaud: boolean;
  hasRemarkable: boolean;
  nextClass?: string;
}

interface ClassDay {
  date: string;
  hasTypedNotes: boolean;
  hasPlaudRecording: boolean;
  hasRemarkableNotes: boolean;
  isCombined: boolean;
  vaultPageId?: string;
  plaudRecordingId?: string;
  remarkableNoteId?: string;
}

// ============================================
// Routes
// ============================================

/**
 * GET /api/classes
 * List all classes with summary info
 */
classesRouter.get('/', async (c) => {
  // Get all classes from database
  const allClasses = await db.select().from(classes).orderBy(desc(classes.createdAt));

  // Get remarkable note counts per class
  const remarkableCounts = await db
    .select({
      classCode: remarkableNotes.classCode,
      count: sql<number>`COUNT(*)::int`,
      lastDate: sql<string>`MAX(${remarkableNotes.noteDate})`,
    })
    .from(remarkableNotes)
    .where(eq(remarkableNotes.classificationType, 'class_note'))
    .groupBy(remarkableNotes.classCode);

  // Get class pages (Plaud recordings) count
  const plaudCounts = await db
    .select({
      classCode: sql<string>`regexp_replace(${calendarEvents.title}, '.*\\((.+?)\\).*', '\\1')`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(classPages)
    .innerJoin(calendarEvents, eq(classPages.calendarEventId, calendarEvents.id))
    .groupBy(sql`regexp_replace(${calendarEvents.title}, '.*\\((.+?)\\).*', '\\1')`);

  // Build summary for each class
  const remarkableMap = new Map(remarkableCounts.map(r => [r.classCode, r]));
  const plaudMap = new Map(plaudCounts.map(p => [p.classCode, p]));

  const classSummaries: ClassSummary[] = allClasses.map(cls => {
    const remarkable = remarkableMap.get(cls.code || '');
    const plaud = plaudMap.get(cls.code || '');

    return {
      code: cls.code || '',
      name: cls.name,
      semester: cls.semester || 'Current',
      noteCount: (remarkable?.count || 0) + (plaud?.count || 0),
      lastNoteDate: remarkable?.lastDate,
      hasPlaud: (plaud?.count || 0) > 0,
      hasRemarkable: (remarkable?.count || 0) > 0,
    };
  });

  return c.json({
    success: true,
    data: classSummaries,
    count: classSummaries.length,
  });
});

/**
 * GET /api/classes/:code
 * Get class details with all class days
 */
classesRouter.get('/:code', async (c) => {
  const code = c.req.param('code').toUpperCase();

  // Get class info
  const [classInfo] = await db
    .select()
    .from(classes)
    .where(eq(classes.code, code))
    .limit(1);

  if (!classInfo) {
    throw new NotFoundError('Class');
  }

  // Get all remarkable notes for this class
  const remarkableResults = await db
    .select()
    .from(remarkableNotes)
    .where(
      and(
        eq(remarkableNotes.classCode, code),
        eq(remarkableNotes.classificationType, 'class_note')
      )
    )
    .orderBy(desc(remarkableNotes.noteDate));

  // Get all calendar events for this class (for Plaud matching)
  const calendarResults = await db
    .select({
      id: calendarEvents.id,
      title: calendarEvents.title,
      startTime: calendarEvents.startTime,
      classPageId: classPages.id,
      vaultPageId: classPages.vaultPageId,
      transcriptContent: classPages.transcriptContent,
    })
    .from(calendarEvents)
    .leftJoin(classPages, eq(classPages.calendarEventId, calendarEvents.id))
    .where(like(calendarEvents.title, `%${code}%`))
    .orderBy(desc(calendarEvents.startTime));

  // Build class days map
  const classDaysMap = new Map<string, ClassDay>();

  // Add remarkable notes
  for (const rn of remarkableResults) {
    if (!rn.noteDate) continue;
    const date = rn.noteDate;
    const existing = classDaysMap.get(date) || {
      date,
      hasTypedNotes: false,
      hasPlaudRecording: false,
      hasRemarkableNotes: false,
      isCombined: false,
    };
    existing.hasRemarkableNotes = true;
    existing.remarkableNoteId = rn.id;
    existing.isCombined = rn.hasMergedContent || false;
    if (rn.pageId) existing.vaultPageId = rn.pageId;
    classDaysMap.set(date, existing);
  }

  // Add calendar/Plaud events
  for (const ce of calendarResults) {
    if (!ce.startTime) continue;
    const date = ce.startTime.toISOString().split('T')[0];
    const existing = classDaysMap.get(date) || {
      date,
      hasTypedNotes: false,
      hasPlaudRecording: false,
      hasRemarkableNotes: false,
      isCombined: false,
    };
    if (ce.transcriptContent) {
      existing.hasPlaudRecording = true;
    }
    if (ce.vaultPageId) {
      existing.vaultPageId = ce.vaultPageId;
    }
    classDaysMap.set(date, existing);
  }

  // Convert to array and sort
  const classDays = Array.from(classDaysMap.values()).sort(
    (a, b) => b.date.localeCompare(a.date)
  );

  return c.json({
    success: true,
    data: {
      class: classInfo,
      classDays,
      totalDays: classDays.length,
      combinedCount: classDays.filter(d => d.isCombined).length,
      pendingCombine: classDays.filter(
        d => d.hasRemarkableNotes && d.hasPlaudRecording && !d.isCombined
      ).length,
    },
  });
});

/**
 * GET /api/classes/:code/:date
 * Get combined notes for a specific class day
 */
classesRouter.get('/:code/:date', async (c) => {
  const code = c.req.param('code').toUpperCase();
  const date = c.req.param('date');

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ValidationError('Invalid date format. Use YYYY-MM-DD');
  }

  // Get content from remarkable service
  const content = await remarkableService.getClassDayContent(code, date);

  if (!content) {
    throw new NotFoundError('Class day notes');
  }

  return c.json({
    success: true,
    data: content,
  });
});

/**
 * POST /api/classes/:code/:date/combine
 * Trigger combining notes for a specific class day
 */
classesRouter.post('/:code/:date/combine', async (c) => {
  const code = c.req.param('code').toUpperCase();
  const date = c.req.param('date');

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ValidationError('Invalid date format. Use YYYY-MM-DD');
  }

  const result = await remarkableService.generateCombinedMarkdown(code, date);

  if (!result.success) {
    return c.json({
      success: false,
      error: result.error,
    }, 400);
  }

  return c.json({
    success: true,
    data: {
      vaultPageId: result.vaultPageId,
      combinedFilePath: result.combinedFilePath,
    },
    message: `Combined notes generated for ${code} on ${date}`,
  });
});

/**
 * POST /api/classes/combine-all
 * Trigger combining all pending class notes
 */
classesRouter.post('/combine-all', async (c) => {
  const result = await remarkableService.mergeAllPendingClassNotes();

  return c.json({
    success: true,
    data: {
      merged: result.merged,
      errors: result.errors,
    },
    message: `Merged ${result.merged} class days`,
  });
});

/**
 * GET /api/classes/stats
 * Get statistics about class notes
 */
classesRouter.get('/stats', async (c) => {
  const stats = await remarkableService.getSyncStats();
  const summaries = await remarkableService.getClassSummaries();

  return c.json({
    success: true,
    data: {
      ...stats,
      classes: summaries,
    },
  });
});

export { classesRouter };

import { Hono } from 'hono';
import { z } from 'zod';
import { vaultPageService, PARA_FOLDERS } from '../../services/vault-page-service';
import { vaultBlockService } from '../../services/vault-block-service';
import { ValidationError, NotFoundError } from '../middleware/error-handler';
import type { PARAType } from '@jd-agent/types';
import { db } from '../../db/client';
import { recordings, transcripts, calendarEvents } from '../../db/schema';
import { eq, and, gte, lt, lte, sql, ilike, or } from 'drizzle-orm';

const vaultPagesRouter = new Hono();

// ============================================
// Validation Schemas
// ============================================

const blockTypeEnum = z.enum([
  'text',
  'heading_1',
  'heading_2',
  'heading_3',
  'bulleted_list',
  'numbered_list',
  'todo',
  'toggle',
  'quote',
  'callout',
  'divider',
  'code',
  'image',
  'file',
  'bookmark',
  'page_link',
  'task_link',
  'goal_link',
]);

const createPageSchema = z.object({
  title: z.string().optional(),
  parentId: z.string().uuid().nullable().optional(),
  icon: z.string().nullable().optional(),
  coverImage: z.string().nullable().optional(), // Allow URLs or CSS gradients
});

const updatePageSchema = z.object({
  title: z.string().optional(),
  icon: z.string().nullable().optional(),
  coverImage: z.string().nullable().optional(), // Allow URLs or CSS gradients
  isFavorite: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  parentId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

const createBlockSchema = z.object({
  type: blockTypeEnum,
  content: z.record(z.unknown()),
  parentBlockId: z.string().uuid().nullable().optional(),
  afterBlockId: z.string().uuid().nullable().optional(),
});

const updateBlockSchema = z.object({
  type: blockTypeEnum.optional(),
  content: z.record(z.unknown()).optional(),
});

const moveBlockSchema = z.object({
  pageId: z.string().uuid().optional(),
  parentBlockId: z.string().uuid().nullable().optional(),
  afterBlockId: z.string().uuid().nullable().optional(),
});

const batchOperationSchema = z.object({
  operations: z.array(
    z.object({
      op: z.enum(['create', 'update', 'delete', 'move']),
      blockId: z.string().uuid().optional(),
      data: z.record(z.unknown()).optional(),
    })
  ),
});

const reorderSchema = z.object({
  pageIds: z.array(z.string().uuid()),
});

// ============================================
// Page Routes
// ============================================

/**
 * GET /api/vault/pages
 * List all pages
 */
vaultPagesRouter.get('/', async (c) => {
  const archived = c.req.query('archived');

  const pages = await vaultPageService.list({
    archived: archived === 'true' ? true : archived === 'false' ? false : undefined,
  });

  return c.json({
    success: true,
    data: pages,
    count: pages.length,
  });
});

/**
 * GET /api/vault/pages/tree
 * Get hierarchical page tree
 */
vaultPagesRouter.get('/tree', async (c) => {
  const archived = c.req.query('archived');

  const tree = await vaultPageService.getTree({
    archived: archived === 'true' ? true : archived === 'false' ? false : undefined,
  });

  return c.json({
    success: true,
    data: tree,
  });
});

/**
 * GET /api/vault/pages/favorites
 * Get favorite pages
 */
vaultPagesRouter.get('/favorites', async (c) => {
  const favorites = await vaultPageService.getFavorites();

  return c.json({
    success: true,
    data: favorites,
    count: favorites.length,
  });
});

/**
 * GET /api/vault/pages/quick-find
 * Quick search for pages
 */
vaultPagesRouter.get('/quick-find', async (c) => {
  const query = c.req.query('q') || '';
  const limit = parseInt(c.req.query('limit') || '10', 10);

  if (!query) {
    return c.json({
      success: true,
      data: [],
      count: 0,
    });
  }

  const pages = await vaultPageService.quickFind(query, limit);

  return c.json({
    success: true,
    data: pages,
    count: pages.length,
  });
});

// ============================================
// PARA Folder Routes
// ============================================

/**
 * POST /api/vault/pages/para/initialize
 * Initialize PARA root folders
 */
vaultPagesRouter.post('/para/initialize', async (c) => {
  const result = await vaultPageService.initializePARA();

  return c.json({
    success: true,
    data: result,
    message: `Created ${result.created} PARA folders (${result.existing} already existed)`,
  });
});

/**
 * GET /api/vault/pages/para/folders
 * Get PARA root folders
 */
vaultPagesRouter.get('/para/folders', async (c) => {
  const folders = await vaultPageService.getPARAFolders();

  return c.json({
    success: true,
    data: folders,
    config: PARA_FOLDERS,
  });
});

/**
 * GET /api/vault/pages/para/:type
 * Get pages by PARA type
 */
vaultPagesRouter.get('/para/:type', async (c) => {
  const type = c.req.param('type') as PARAType;

  const validTypes = ['projects', 'areas', 'resources', 'archive'];
  if (!validTypes.includes(type)) {
    throw new ValidationError(`Invalid PARA type. Must be one of: ${validTypes.join(', ')}`);
  }

  const pages = await vaultPageService.listByPARAType(type);

  return c.json({
    success: true,
    data: pages,
    count: pages.length,
  });
});

// ============================================
// MBA Classes Endpoint (Vault-Based)
// ============================================

/**
 * GET /api/vault/pages/mba-classes
 * Get MBA class structure with recordings and notes
 * Uses vault page tree (MBA BYU) instead of test classes table
 */
vaultPagesRouter.get('/mba-classes', async (c) => {
  // Get full page tree
  const pageTree = await vaultPageService.getTree();

  // Define types for tree nodes
  type TreeNode = {
    id: string;
    title: string;
    icon?: string | null;
    children?: TreeNode[];
  };

  // Class-specific keywords for matching recordings to classes via transcript content
  const classKeywords: Record<string, string[]> = {
    'strategy': ['strategy', 'strategic', 'competitive advantage', 'porter', 'differentiation', 'cost leadership', 'five forces', 'swot'],
    'venture capital': ['venture', 'vc', 'startup', 'funding', 'investors', 'term sheet', 'valuation', 'portfolio', 'exit', 'series a', 'series b'],
    'analytics': ['analytics', 'data', 'regression', 'statistics', 'model', 'hypothesis', 'r-squared', 'coefficient', 'dataset'],
    'entrepreneurial innovation': ['entrepreneur', 'innovation', 'startup', 'lean', 'pivot', 'mvp', 'customer discovery', 'business model', 'canvas'],
    'eta': ['eta', 'search fund', 'acquisition', 'small business', 'buy', 'owner', 'operator', 'self-funded'],
    'finance': ['finance', 'npv', 'irr', 'dcf', 'wacc', 'capital', 'valuation', 'cash flow', 'balance sheet', 'income statement'],
    'hr': ['hr', 'human resources', 'hiring', 'compensation', 'performance', 'culture', 'talent', 'recruiting'],
  };

  // Find MBA BYU root page
  const mbaRoot = pageTree.find(
    (page: TreeNode) => page.title.toLowerCase() === 'mba byu'
  ) || pageTree.find(
    (page: TreeNode) =>
      (page.title.toLowerCase().includes('mba') || page.title.toLowerCase().includes('byu')) &&
      page.children && page.children.length > 0
  );

  if (!mbaRoot || !mbaRoot.children?.length) {
    return c.json({
      success: true,
      data: { semesters: [] },
      message: 'No MBA classes found',
    });
  }

  // Get all recordings with their dates AND transcripts for keyword matching
  const allRecordings = await db
    .select({
      id: recordings.id,
      originalFilename: recordings.originalFilename,
      recordedAt: recordings.recordedAt,
      recordingType: recordings.recordingType,
      context: recordings.context,
      status: recordings.status,
      durationSeconds: recordings.durationSeconds,
      transcriptText: transcripts.fullText,
    })
    .from(recordings)
    .leftJoin(transcripts, eq(transcripts.recordingId, recordings.id))
    .orderBy(recordings.recordedAt);

  // Group recordings by date for quick lookup
  const recordingsByDate = new Map<string, typeof allRecordings>();
  for (const rec of allRecordings) {
    if (rec.recordedAt) {
      const dateStr = rec.recordedAt.toISOString().split('T')[0];
      if (!recordingsByDate.has(dateStr)) {
        recordingsByDate.set(dateStr, []);
      }
      recordingsByDate.get(dateStr)!.push(rec);
    }
  }

  // Helper to filter recordings for a specific class based on transcript keywords
  const filterRecordingsForClass = (
    recs: typeof allRecordings,
    className: string
  ) => {
    const classLower = className.toLowerCase();

    // Find matching keywords for this class
    const matchingKeywordSet = Object.entries(classKeywords).find(([key]) =>
      classLower.includes(key)
    );

    if (!matchingKeywordSet) {
      // No specific keywords for this class - return all recordings
      return recs;
    }

    const [matchedClass, keywords] = matchingKeywordSet;

    return recs.filter((rec) => {
      // If no transcript, include it (can't filter)
      if (!rec.transcriptText) return true;

      const transcriptLower = rec.transcriptText.toLowerCase();

      // Check if transcript contains any of this class's keywords
      const currentMatchCount = keywords.filter((kw) => transcriptLower.includes(kw)).length;

      // Check if other classes have stronger matches
      for (const [otherClass, otherKeywords] of Object.entries(classKeywords)) {
        if (otherClass === matchedClass) continue;

        const otherMatchCount = otherKeywords.filter((kw) => transcriptLower.includes(kw)).length;

        // If another class has significantly more keyword matches, exclude this recording
        if (otherMatchCount > currentMatchCount + 2) return false;
      }

      return true;
    });
  };

  // Build semester structure with filtered recordings
  const semesters = (mbaRoot.children as TreeNode[]).map((semester: TreeNode) => ({
    id: semester.id,
    title: semester.title,
    icon: semester.icon,
    classes: (semester.children || []).map((cls: TreeNode) => ({
      id: cls.id,
      title: cls.title,
      icon: cls.icon,
      sessions: (cls.children || []).map((dateNode: TreeNode) => {
        // Date nodes are named like "2026-01-13"
        const dateStr = dateNode.title;
        const dateRecordings = recordingsByDate.get(dateStr) || [];

        // Filter recordings based on class keywords
        const filteredRecordings = filterRecordingsForClass(dateRecordings, cls.title);

        return {
          id: dateNode.id,
          date: dateStr,
          icon: dateNode.icon,
          // Remarkable notes are child pages (like "OCR Text")
          remarkableNotes: (dateNode.children || []).map((child: TreeNode) => ({
            id: child.id,
            title: child.title,
            icon: child.icon,
          })),
          // Recordings filtered by class keywords
          recordings: filteredRecordings.map((rec) => ({
            id: rec.id,
            title: rec.originalFilename,
            recordedAt: rec.recordedAt,
            durationSeconds: rec.durationSeconds,
            hasTranscript: !!rec.transcriptText,
            status: rec.status,
          })),
        };
      }),
    })),
  }));

  // Sort semesters (most recent first)
  semesters.sort((a, b) => b.title.localeCompare(a.title));

  // Calculate stats
  const totalClasses = semesters.reduce((sum, s) => sum + s.classes.length, 0);
  const totalSessions = semesters.reduce(
    (sum, s) => sum + s.classes.reduce((cSum, cls) => cSum + cls.sessions.length, 0),
    0
  );
  const sessionsWithRecordings = semesters.reduce(
    (sum, s) =>
      sum +
      s.classes.reduce(
        (cSum, cls) => cSum + cls.sessions.filter((sess) => sess.recordings.length > 0).length,
        0
      ),
    0
  );

  return c.json({
    success: true,
    data: {
      root: {
        id: mbaRoot.id,
        title: mbaRoot.title,
        icon: mbaRoot.icon,
      },
      semesters,
      stats: {
        totalSemesters: semesters.length,
        totalClasses,
        totalSessions,
        sessionsWithRecordings,
        totalRecordings: allRecordings.length,
      },
    },
  });
});

/**
 * GET /api/vault/pages/mba-classes/:sessionId
 * Get detailed content for a specific class session (date)
 * Includes vault page content, recordings with transcripts
 * Filters recordings based on class-specific keywords in transcripts
 */
vaultPagesRouter.get('/mba-classes/:sessionId', async (c) => {
  const sessionId = c.req.param('sessionId');

  // Get the session page (date page)
  const sessionPage = await vaultPageService.getById(sessionId);
  if (!sessionPage) {
    throw new NotFoundError('Class session');
  }

  // Get breadcrumbs to determine the class name
  const breadcrumbs = await vaultPageService.getBreadcrumb(sessionId);
  // Breadcrumbs: MBA BYU > Semester > ClassName > Date
  // The class is typically the second-to-last breadcrumb (before the date)
  const className = breadcrumbs.length >= 2 ? breadcrumbs[breadcrumbs.length - 2]?.title : null;

  // Class-specific keywords for matching recordings to classes via transcript content
  const classKeywords: Record<string, string[]> = {
    'strategy': ['strategy', 'strategic', 'competitive advantage', 'porter', 'differentiation', 'cost leadership', 'five forces', 'swot'],
    'venture capital': ['venture', 'vc', 'startup', 'funding', 'investors', 'term sheet', 'valuation', 'portfolio', 'exit', 'series a', 'series b'],
    'analytics': ['analytics', 'data', 'regression', 'statistics', 'model', 'hypothesis', 'r-squared', 'coefficient', 'dataset'],
    'entrepreneurial innovation': ['entrepreneur', 'innovation', 'startup', 'lean', 'pivot', 'mvp', 'customer discovery', 'business model', 'canvas'],
    'eta': ['eta', 'search fund', 'acquisition', 'small business', 'buy', 'owner', 'operator', 'self-funded'],
    'finance': ['finance', 'npv', 'irr', 'dcf', 'wacc', 'capital', 'valuation', 'cash flow', 'balance sheet', 'income statement'],
    'hr': ['hr', 'human resources', 'hiring', 'compensation', 'performance', 'culture', 'talent', 'recruiting'],
    'entrepenurial': ['entrepreneur', 'innovation', 'startup', 'lean', 'pivot', 'mvp', 'customer discovery', 'business model', 'canvas'], // Alt spelling
  };

  // Map class names to MBA course codes (for calendar matching)
  const classToCourseCodes: Record<string, string[]> = {
    'strategy': ['MBA 580', 'MBA580', 'STRATEGY'],
    'venture capital': ['MBA 664', 'MBA664', 'VENTURE', 'VC'],
    'analytics': ['MBA 560', 'MBA560', 'ANALYTICS', 'DATA'],
    'entrepreneurial innovation': ['MBA 510', 'MBA510', 'ENTREPRENEUR', 'INNOVATION'],
    'entrepreneurial': ['MBA 510', 'MBA510', 'ENTREPRENEUR', 'INNOVATION'],
    'entrepenurial': ['MBA 584', 'MBA584', 'ENTREPRENEUR', 'INNOVATION'], // Alt spelling - based on calendar
    'eta': ['MBA 677', 'MBA677', 'ETA', 'ACQUISITION'],
    'finance': ['MBA 507', 'MBA507', 'FINANCE'],
    'hr': ['MBA 505', 'MBA505', 'HR', 'HUMAN'],
  };

  // Get the blocks (content) for this page
  const blocks = await vaultBlockService.getByPage(sessionId);

  // Get child pages (OCR Text, etc.)
  const children = await vaultPageService.getChildren(sessionId);

  // Get children content too
  const childrenWithContent = await Promise.all(
    children.map(async (child) => {
      const childBlocks = await vaultBlockService.getByPage(child.id);
      return {
        ...child,
        blocks: childBlocks,
      };
    })
  );

  // Get recordings for this date
  const dateStr = sessionPage.title; // e.g., "2026-01-13"
  const dateStart = new Date(dateStr + 'T00:00:00');
  const dateEnd = new Date(dateStr + 'T23:59:59');

  // ============================================
  // CALENDAR-BASED MATCHING
  // Find calendar events for this class on this date
  // ============================================
  let classCalendarEvent: typeof calendarEvents.$inferSelect | null = null;

  if (className) {
    // Search for calendar events matching this class on this date
    const classLower = className.toLowerCase();
    const dayEvents = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          gte(calendarEvents.startTime, dateStart),
          lte(calendarEvents.startTime, dateEnd),
          or(
            eq(calendarEvents.eventType, 'class'),
            ilike(calendarEvents.title, '%class%'),
            ilike(calendarEvents.title, '%lecture%'),
            ilike(calendarEvents.title, '%MBA%')
          )
        )
      );

    // Find the event that matches our class name using course codes
    classCalendarEvent = dayEvents.find((event) => {
      const titleUpper = event.title.toUpperCase();

      // First, try to match using course codes mapping
      for (const [classKey, courseCodes] of Object.entries(classToCourseCodes)) {
        if (classLower.includes(classKey)) {
          // Check if any course code matches the calendar event title
          for (const code of courseCodes) {
            if (titleUpper.includes(code.toUpperCase())) {
              return true;
            }
          }
        }
      }

      // Fallback: direct name matching
      const titleLower = event.title.toLowerCase();
      if (titleLower.includes(classLower)) return true;

      return false;
    }) || null;
  }

  // Get all recordings for this date (including transcript segments for time-based filtering)
  const dateRecordings = await db
    .select({
      id: recordings.id,
      originalFilename: recordings.originalFilename,
      recordedAt: recordings.recordedAt,
      recordingType: recordings.recordingType,
      durationSeconds: recordings.durationSeconds,
      status: recordings.status,
      transcriptId: transcripts.id,
      transcriptText: transcripts.fullText,
      transcriptSummary: transcripts.summary,
      transcriptSegments: transcripts.segments,
    })
    .from(recordings)
    .leftJoin(transcripts, eq(transcripts.recordingId, recordings.id))
    .where(
      and(
        gte(recordings.recordedAt, dateStart),
        lt(recordings.recordedAt, dateEnd)
      )
    );

  // ============================================
  // TIME-BASED FILTERING
  // Only include recordings that overlap with the calendar event time
  // ============================================
  const filteredRecordings = dateRecordings.filter((rec) => {
    // If no class name found, show all recordings
    if (!className) return true;

    // If we have a calendar event, use TIME-BASED matching (primary)
    if (classCalendarEvent && rec.recordedAt && rec.durationSeconds) {
      const recordingStart = new Date(rec.recordedAt).getTime();
      const recordingEnd = recordingStart + (rec.durationSeconds * 1000);
      const eventStart = new Date(classCalendarEvent.startTime).getTime();
      const eventEnd = new Date(classCalendarEvent.endTime).getTime();

      // Calculate overlap
      const overlapStart = Math.max(recordingStart, eventStart);
      const overlapEnd = Math.min(recordingEnd, eventEnd);
      const overlapDuration = Math.max(0, overlapEnd - overlapStart);

      // Recording must have at least 10 minutes overlap OR start within class time
      const MIN_OVERLAP_MS = 10 * 60 * 1000; // 10 minutes
      const startsWithinClass = recordingStart >= eventStart && recordingStart <= eventEnd;

      if (overlapDuration >= MIN_OVERLAP_MS || startsWithinClass) {
        return true;
      }

      // No time overlap with this class - exclude
      return false;
    }

    // FALLBACK: If no calendar event, use keyword matching
    if (!rec.transcriptText) return true;

    const transcriptLower = rec.transcriptText.toLowerCase();
    const classLower = className.toLowerCase();

    // Find matching keywords for this class
    const matchingKeywordSet = Object.entries(classKeywords).find(([key]) =>
      classLower.includes(key)
    );

    if (matchingKeywordSet) {
      const [, keywords] = matchingKeywordSet;
      // Check if transcript contains any of the class-specific keywords
      const hasClassKeyword = keywords.some((kw) => transcriptLower.includes(kw));
      if (hasClassKeyword) return true;

      // Also check if other classes have stronger matches (to filter out)
      for (const [otherClass, otherKeywords] of Object.entries(classKeywords)) {
        if (classLower.includes(otherClass)) continue; // Skip current class

        const otherMatchCount = otherKeywords.filter((kw) => transcriptLower.includes(kw)).length;
        const currentMatchCount = keywords.filter((kw) => transcriptLower.includes(kw)).length;

        // If another class has significantly more matches, exclude this recording
        if (otherMatchCount > currentMatchCount + 2) return false;
      }
    }

    // Default: include the recording (no strong filter)
    return true;
  });

  // Type for transcript segments
  type TranscriptSegment = {
    start: number; // seconds from recording start
    end: number;
    text: string;
    speaker?: string;
  };

  // Calculate detailed verification info for recording-class match
  const calculateVerification = (rec: typeof dateRecordings[0]) => {
    // Format class time from calendar event
    const formatTime = (date: Date) => date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const expectedClassTime = classCalendarEvent
      ? `${formatTime(new Date(classCalendarEvent.startTime))} - ${formatTime(new Date(classCalendarEvent.endTime))}`
      : '8:00 AM - 5:00 PM (no calendar event found)';

    const verification: {
      keywordsFound: string[];
      classScores: Record<string, { count: number; keywords: string[] }>;
      bestMatchClass: string | null;
      isBestMatch: boolean;
      confidence: number;
      confidenceReason: string;
      recordingTime: string | null;
      expectedClassTime: string;
      timeMatch: 'good' | 'warning' | 'unknown';
      calendarMatch: boolean;
      overlapMinutes: number | null;
      // Segment timing for recordings that span multiple classes
      effectiveStartSeconds: number | null;
      effectiveEndSeconds: number | null;
      totalSegments: number;
      relevantSegments: number;
      segmentNote: string | null;
    } = {
      keywordsFound: [],
      classScores: {},
      bestMatchClass: null,
      isBestMatch: true,
      confidence: 50,
      confidenceReason: 'No transcript available',
      recordingTime: rec.recordedAt ? formatTime(new Date(rec.recordedAt)) : null,
      expectedClassTime,
      timeMatch: 'unknown',
      calendarMatch: false,
      overlapMinutes: null,
      // Segment timing defaults
      effectiveStartSeconds: 0,
      effectiveEndSeconds: rec.durationSeconds || null,
      totalSegments: 0,
      relevantSegments: 0,
      segmentNote: null,
    };

    // Check recording time against calendar event
    if (rec.recordedAt && classCalendarEvent) {
      const recordingStart = new Date(rec.recordedAt).getTime();
      const recordingEnd = recordingStart + ((rec.durationSeconds || 0) * 1000);
      const eventStart = new Date(classCalendarEvent.startTime).getTime();
      const eventEnd = new Date(classCalendarEvent.endTime).getTime();

      // Calculate overlap
      const overlapStart = Math.max(recordingStart, eventStart);
      const overlapEnd = Math.min(recordingEnd, eventEnd);
      const overlapMs = Math.max(0, overlapEnd - overlapStart);
      verification.overlapMinutes = Math.round(overlapMs / 60000);

      // Calculate effective start/end times within the recording
      // These are seconds from the recording start that overlap with the class
      if (overlapMs > 0) {
        verification.effectiveStartSeconds = Math.max(0, Math.round((eventStart - recordingStart) / 1000));
        verification.effectiveEndSeconds = Math.min(
          rec.durationSeconds || 0,
          Math.round((eventEnd - recordingStart) / 1000)
        );

        // Determine if we're showing a partial recording
        const isPartialStart = verification.effectiveStartSeconds > 0;
        const isPartialEnd = verification.effectiveEndSeconds < (rec.durationSeconds || 0);

        if (isPartialStart || isPartialEnd) {
          const effectiveDuration = (verification.effectiveEndSeconds || 0) - (verification.effectiveStartSeconds || 0);
          const effectiveMinutes = Math.round(effectiveDuration / 60);
          verification.segmentNote = `Showing ${effectiveMinutes}min of ${Math.round((rec.durationSeconds || 0) / 60)}min recording`;

          if (isPartialStart && isPartialEnd) {
            verification.segmentNote += ' (middle portion during class)';
          } else if (isPartialStart) {
            verification.segmentNote += ' (class started mid-recording)';
          } else {
            verification.segmentNote += ' (class ended before recording finished)';
          }
        }
      }

      // Determine if recording is within class time
      const startsWithinClass = recordingStart >= eventStart && recordingStart <= eventEnd;
      const endsWithinClass = recordingEnd >= eventStart && recordingEnd <= eventEnd;
      const coversClass = recordingStart <= eventStart && recordingEnd >= eventEnd;

      if (startsWithinClass || endsWithinClass || coversClass || overlapMs > 0) {
        verification.timeMatch = 'good';
        verification.calendarMatch = true;
        verification.confidence = Math.min(95, 70 + Math.round(overlapMs / (10 * 60000) * 5)); // Base 70 + up to 25 for overlap
      } else {
        verification.timeMatch = 'warning';
        verification.calendarMatch = false;
      }
    } else if (rec.recordedAt) {
      // Fallback: check generic class hours
      const recordingHour = new Date(rec.recordedAt).getHours();
      if (recordingHour >= 8 && recordingHour <= 17) {
        verification.timeMatch = 'good';
      } else {
        verification.timeMatch = 'warning';
      }
    }

    // Count segments within the class time window
    if (rec.transcriptSegments && Array.isArray(rec.transcriptSegments)) {
      const segments = rec.transcriptSegments as TranscriptSegment[];
      verification.totalSegments = segments.length;

      if (verification.effectiveStartSeconds !== null && verification.effectiveEndSeconds !== null) {
        // Count segments that fall within the class time window
        verification.relevantSegments = segments.filter((seg) => {
          const segStart = seg.start;
          const segEnd = seg.end;
          // Segment overlaps with class time window
          return segEnd > verification.effectiveStartSeconds! && segStart < verification.effectiveEndSeconds!;
        }).length;
      } else {
        verification.relevantSegments = segments.length;
      }
    }

    if (!rec.transcriptText) {
      return verification;
    }

    const transcriptLower = rec.transcriptText.toLowerCase();

    // Calculate scores for ALL classes
    for (const [classKey, keywords] of Object.entries(classKeywords)) {
      const matchedKeywords = keywords.filter((kw) => transcriptLower.includes(kw));
      verification.classScores[classKey] = {
        count: matchedKeywords.length,
        keywords: matchedKeywords,
      };
    }

    // Find best matching class
    let bestClass: string | null = null;
    let bestCount = 0;
    for (const [classKey, data] of Object.entries(verification.classScores)) {
      if (data.count > bestCount) {
        bestCount = data.count;
        bestClass = classKey;
      }
    }
    verification.bestMatchClass = bestClass;

    // Get current class keywords
    if (className) {
      const classLower = className.toLowerCase();
      const matchingKeywordSet = Object.entries(classKeywords).find(([key]) =>
        classLower.includes(key)
      );

      if (matchingKeywordSet) {
        const [currentClassKey, keywords] = matchingKeywordSet;
        const matchedKeywords = keywords.filter((kw) => transcriptLower.includes(kw));
        verification.keywordsFound = matchedKeywords;

        const matchCount = matchedKeywords.length;

        // Check if this is the best match
        verification.isBestMatch = !bestClass || classLower.includes(bestClass) || matchCount >= bestCount;

        // Calculate confidence - prioritize calendar match + keywords
        if (verification.calendarMatch) {
          // Calendar match is primary confidence factor
          if (matchCount >= 3) {
            verification.confidence = 98;
            verification.confidenceReason = `Time overlap: ${verification.overlapMinutes}min + ${matchCount} keywords (${matchedKeywords.slice(0, 3).join(', ')})`;
          } else if (matchCount >= 1) {
            verification.confidence = 92;
            verification.confidenceReason = `Time overlap: ${verification.overlapMinutes}min + keyword: ${matchedKeywords.join(', ')}`;
          } else {
            verification.confidence = 85;
            verification.confidenceReason = `Time overlap: ${verification.overlapMinutes}min (no keywords, but time matches)`;
          }
        } else {
          // No calendar match - keyword only (lower confidence)
          if (matchCount >= 5) {
            verification.confidence = 80;
            verification.confidenceReason = `Keywords only: ${matchedKeywords.slice(0, 5).join(', ')} (no calendar match)`;
          } else if (matchCount >= 3) {
            verification.confidence = 70;
            verification.confidenceReason = `Keywords only: ${matchedKeywords.join(', ')} (no calendar match)`;
          } else if (matchCount >= 1) {
            verification.confidence = 55;
            verification.confidenceReason = `Weak match: ${matchedKeywords.join(', ')} (no calendar match)`;
          } else {
            verification.confidence = 30;
            verification.confidenceReason = 'No calendar match, no keywords - likely wrong class';
          }
        }

        // Adjust if not best keyword match
        if (!verification.isBestMatch && bestClass) {
          verification.confidence = Math.max(40, verification.confidence - 20);
          verification.confidenceReason += ` (Warning: "${bestClass}" has more matches)`;
        }
      } else {
        verification.confidence = 60;
        verification.confidenceReason = 'No keywords defined for this class type';
      }
    }

    return verification;
  };

  // Simple confidence calculator for backwards compatibility
  const calculateConfidence = (rec: typeof dateRecordings[0]): number => {
    return calculateVerification(rec).confidence;
  };

  // Filter transcript text to only include segments within the class time window
  const getFilteredTranscript = (rec: typeof dateRecordings[0]): string | null => {
    if (!rec.transcriptText) return null;
    if (!rec.transcriptSegments || !Array.isArray(rec.transcriptSegments)) return rec.transcriptText;
    if (!classCalendarEvent || !rec.recordedAt) return rec.transcriptText;

    const verification = calculateVerification(rec);
    if (verification.effectiveStartSeconds === null || verification.effectiveEndSeconds === null) {
      return rec.transcriptText;
    }

    // Check if we need to filter (only if it's a partial recording)
    const isPartial = verification.effectiveStartSeconds > 0 ||
      verification.effectiveEndSeconds < (rec.durationSeconds || 0);

    if (!isPartial) return rec.transcriptText;

    // Filter segments to only include those within the class time
    const segments = rec.transcriptSegments as TranscriptSegment[];
    const filteredSegments = segments.filter((seg) => {
      return seg.end > verification.effectiveStartSeconds! && seg.start < verification.effectiveEndSeconds!;
    });

    // Combine filtered segment text
    if (filteredSegments.length === 0) return rec.transcriptText;

    return filteredSegments.map((seg) => seg.text).join(' ');
  };

  // Extract PDF URL from blocks
  const pdfBlock = blocks.find((b) => b.type === 'file' && (b.content as { mimeType?: string })?.mimeType === 'application/pdf');
  const pdfUrl = pdfBlock ? (pdfBlock.content as { url?: string })?.url : null;
  const pdfFilename = pdfBlock ? (pdfBlock.content as { filename?: string })?.filename : null;

  // Extract OCR text from remarkable notes
  const ocrText = childrenWithContent
    .flatMap((note) =>
      note.blocks
        .filter((b) => b.type === 'text' || b.content)
        .map((b) => (b.content as { text?: string })?.text || '')
    )
    .filter(Boolean)
    .join('\n\n');

  // Build combined class summary from all recording summaries
  const summaries = filteredRecordings
    .filter((rec) => rec.transcriptSummary)
    .map((rec) => rec.transcriptSummary as { overview?: string; keyPoints?: string[]; topics?: string[] });

  const combinedSummary = summaries.length > 0
    ? {
        overview: summaries[0]?.overview || 'Class session with ' + filteredRecordings.length + ' recordings.',
        keyPoints: [...new Set(summaries.flatMap((s) => s?.keyPoints || []))].slice(0, 5),
        topics: [...new Set(summaries.flatMap((s) => s?.topics || []))].slice(0, 8),
      }
    : null;

  // Calculate total duration
  const totalDuration = filteredRecordings.reduce((sum, rec) => sum + (rec.durationSeconds || 0), 0);

  // Calculate average confidence
  const confidenceScores = filteredRecordings.map(calculateConfidence);
  const avgConfidence = confidenceScores.length > 0
    ? Math.round(confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length)
    : 50;

  return c.json({
    success: true,
    data: {
      session: sessionPage,
      blocks,
      remarkableNotes: childrenWithContent,
      className,
      breadcrumbs,

      // Enhanced fields for better UX
      summary: combinedSummary,
      pdfUrl,
      pdfFilename,
      ocrText: ocrText.slice(0, 5000), // Limit OCR text length
      confidence: avgConfidence,
      stats: {
        totalRecordings: filteredRecordings.length,
        totalDurationMinutes: Math.round(totalDuration / 60),
        hasTranscripts: filteredRecordings.filter((r) => r.transcriptText).length,
        hasPdf: !!pdfUrl,
        hasOcrText: !!ocrText,
      },

      // Calendar event for this class (if found)
      calendarEvent: classCalendarEvent ? {
        id: classCalendarEvent.id,
        title: classCalendarEvent.title,
        startTime: classCalendarEvent.startTime,
        endTime: classCalendarEvent.endTime,
        location: classCalendarEvent.location,
      } : null,

      recordings: filteredRecordings.map((rec) => {
        const verification = calculateVerification(rec);
        const filteredText = getFilteredTranscript(rec);
        const isPartialRecording = verification.segmentNote !== null;

        return {
          id: rec.id,
          title: rec.originalFilename,
          recordedAt: rec.recordedAt,
          durationSeconds: rec.durationSeconds,
          // Effective duration within class time (for partial recordings)
          effectiveDurationSeconds: isPartialRecording && verification.effectiveStartSeconds !== null && verification.effectiveEndSeconds !== null
            ? verification.effectiveEndSeconds - verification.effectiveStartSeconds
            : rec.durationSeconds,
          status: rec.status,
          confidence: verification.confidence,
          transcript: rec.transcriptText
            ? {
                id: rec.transcriptId,
                // Full text (original recording)
                fullText: rec.transcriptText,
                // Filtered text (only segments within class time)
                text: filteredText,
                summary: rec.transcriptSummary,
                isFiltered: isPartialRecording && filteredText !== rec.transcriptText,
              }
            : null,
          // Verification data for UI
          verification: {
            keywordsFound: verification.keywordsFound,
            classScores: verification.classScores,
            bestMatchClass: verification.bestMatchClass,
            isBestMatch: verification.isBestMatch,
            confidenceReason: verification.confidenceReason,
            recordingTime: verification.recordingTime,
            timeMatch: verification.timeMatch,
            // Calendar-based matching info
            calendarMatch: verification.calendarMatch,
            overlapMinutes: verification.overlapMinutes,
            // Segment timing for partial recordings
            effectiveStartSeconds: verification.effectiveStartSeconds,
            effectiveEndSeconds: verification.effectiveEndSeconds,
            totalSegments: verification.totalSegments,
            relevantSegments: verification.relevantSegments,
            segmentNote: verification.segmentNote,
          },
        };
      }),
      totalRecordingsForDate: dateRecordings.length,
    },
  });
});

/**
 * POST /api/vault/pages/:id/move-to-para
 * Move a page to a PARA folder
 */
vaultPagesRouter.post('/:id/move-to-para', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid page ID format');
  }

  const body = await c.req.json();
  const schema = z.object({
    paraType: z.enum(['projects', 'areas', 'resources', 'archive']),
  });

  const parseResult = schema.safeParse(body);
  if (!parseResult.success) {
    throw new ValidationError('paraType must be one of: projects, areas, resources, archive');
  }

  try {
    const page = await vaultPageService.moveToPARA(id, parseResult.data.paraType);

    if (!page) {
      throw new NotFoundError('Vault page');
    }

    return c.json({
      success: true,
      data: page,
      message: `Page moved to ${parseResult.data.paraType}`,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not initialized')) {
      throw new ValidationError(error.message);
    }
    throw error;
  }
});

/**
 * GET /api/vault/pages/:id
 * Get a single page with blocks
 */
vaultPagesRouter.get('/:id', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid page ID format');
  }

  const includeBlocks = c.req.query('include_blocks') !== 'false';

  const page = includeBlocks
    ? await vaultPageService.getByIdWithBlocks(id)
    : await vaultPageService.getById(id);

  if (!page) {
    throw new NotFoundError('Vault page');
  }

  // Get breadcrumb
  const breadcrumbs = await vaultPageService.getBreadcrumb(id);

  return c.json({
    success: true,
    data: {
      ...page,
      breadcrumbs,
    },
  });
});

/**
 * GET /api/vault/pages/:id/children
 * Get child pages
 */
vaultPagesRouter.get('/:id/children', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid page ID format');
  }

  const children = await vaultPageService.getChildren(id);

  return c.json({
    success: true,
    data: children,
    count: children.length,
  });
});

/**
 * GET /api/vault/pages/:id/backlinks
 * Get pages that link to this page
 */
vaultPagesRouter.get('/:id/backlinks', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid page ID format');
  }

  const backlinks = await vaultPageService.getBacklinks(id);

  return c.json({
    success: true,
    data: backlinks,
    count: backlinks.length,
  });
});

/**
 * POST /api/vault/pages
 * Create a new page
 */
vaultPagesRouter.post('/', async (c) => {
  const body = await c.req.json();
  const parseResult = createPageSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const page = await vaultPageService.create(parseResult.data);

  return c.json(
    {
      success: true,
      data: page,
      message: 'Page created successfully',
    },
    201
  );
});

/**
 * PATCH /api/vault/pages/:id
 * Update a page
 */
vaultPagesRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid page ID format');
  }

  const body = await c.req.json();
  const parseResult = updatePageSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const updateData = Object.fromEntries(
    Object.entries(parseResult.data).filter(([_, v]) => v !== undefined)
  );

  if (Object.keys(updateData).length === 0) {
    throw new ValidationError('No valid fields to update');
  }

  try {
    const page = await vaultPageService.update(id, updateData);

    if (!page) {
      throw new NotFoundError('Vault page');
    }

    return c.json({
      success: true,
      data: page,
      message: 'Page updated successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('descendant')) {
      throw new ValidationError(error.message);
    }
    throw error;
  }
});

/**
 * POST /api/vault/pages/:id/favorite
 * Toggle favorite status
 */
vaultPagesRouter.post('/:id/favorite', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid page ID format');
  }

  const page = await vaultPageService.toggleFavorite(id);

  if (!page) {
    throw new NotFoundError('Vault page');
  }

  return c.json({
    success: true,
    data: page,
    message: page.isFavorite ? 'Added to favorites' : 'Removed from favorites',
  });
});

/**
 * POST /api/vault/pages/reorder
 * Reorder pages
 */
vaultPagesRouter.post('/reorder', async (c) => {
  const body = await c.req.json();
  const parseResult = reorderSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError('pageIds array of UUIDs is required');
  }

  await vaultPageService.reorder(parseResult.data.pageIds);

  return c.json({
    success: true,
    message: 'Pages reordered successfully',
  });
});

/**
 * DELETE /api/vault/pages/:id
 * Delete a page
 */
vaultPagesRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid page ID format');
  }

  try {
    const deleted = await vaultPageService.delete(id);

    if (!deleted) {
      throw new NotFoundError('Vault page');
    }

    return c.json({
      success: true,
      message: 'Page deleted successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Cannot delete system')) {
      throw new ValidationError(error.message);
    }
    throw error;
  }
});

// ============================================
// Deduplication Routes
// ============================================

/**
 * GET /api/vault/pages/duplicates
 * Find duplicate pages (same title under same parent)
 */
vaultPagesRouter.get('/duplicates', async (c) => {
  const duplicates = await vaultPageService.findDuplicates();

  // Convert Map to array for JSON response
  const duplicateGroups = Array.from(duplicates.entries()).map(([key, pages]) => ({
    key,
    title: pages[0]?.title || 'Unknown',
    parentId: pages[0]?.parentId || null,
    count: pages.length,
    pages: pages.map(p => ({
      id: p.id,
      title: p.title,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })),
  }));

  return c.json({
    success: true,
    data: duplicateGroups,
    totalDuplicateGroups: duplicates.size,
    totalDuplicatePages: duplicateGroups.reduce((acc, g) => acc + g.count - 1, 0),
  });
});

/**
 * POST /api/vault/pages/merge-duplicates
 * Merge all duplicate pages (keeps oldest, merges blocks from others)
 */
vaultPagesRouter.post('/merge-duplicates', async (c) => {
  const result = await vaultPageService.mergeDuplicates();

  return c.json({
    success: true,
    data: result,
    message: `Merged ${result.merged} blocks and deleted ${result.deleted} duplicate pages`,
  });
});

// ============================================
// Block Routes
// ============================================

/**
 * GET /api/vault/pages/:pageId/blocks
 * Get all blocks for a page
 */
vaultPagesRouter.get('/:pageId/blocks', async (c) => {
  const pageId = c.req.param('pageId');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pageId)) {
    throw new ValidationError('Invalid page ID format');
  }

  const blocks = await vaultBlockService.getByPage(pageId);

  return c.json({
    success: true,
    data: blocks,
    count: blocks.length,
  });
});

/**
 * POST /api/vault/pages/:pageId/blocks
 * Create a new block
 */
vaultPagesRouter.post('/:pageId/blocks', async (c) => {
  const pageId = c.req.param('pageId');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pageId)) {
    throw new ValidationError('Invalid page ID format');
  }

  const body = await c.req.json();
  const parseResult = createBlockSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  try {
    const block = await vaultBlockService.create(pageId, parseResult.data as any);

    return c.json(
      {
        success: true,
        data: block,
        message: 'Block created successfully',
      },
      201
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Page not found') {
      throw new NotFoundError('Vault page');
    }
    throw error;
  }
});

/**
 * POST /api/vault/pages/:pageId/blocks/batch
 * Batch block operations
 */
vaultPagesRouter.post('/:pageId/blocks/batch', async (c) => {
  const pageId = c.req.param('pageId');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pageId)) {
    throw new ValidationError('Invalid page ID format');
  }

  const body = await c.req.json();
  const parseResult = batchOperationSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const results = await vaultBlockService.batch(pageId, parseResult.data.operations as any);

  return c.json({
    success: true,
    data: results,
    message: 'Batch operations completed',
  });
});

// ============================================
// Block Routes (not under pages)
// ============================================

export const vaultBlocksRouter = new Hono();

/**
 * GET /api/vault/blocks/:id
 * Get a single block
 */
vaultBlocksRouter.get('/:id', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid block ID format');
  }

  const block = await vaultBlockService.getById(id);

  if (!block) {
    throw new NotFoundError('Vault block');
  }

  return c.json({
    success: true,
    data: block,
  });
});

/**
 * GET /api/vault/blocks/:id/children
 * Get child blocks (for nested blocks)
 */
vaultBlocksRouter.get('/:id/children', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid block ID format');
  }

  const children = await vaultBlockService.getChildren(id);

  return c.json({
    success: true,
    data: children,
    count: children.length,
  });
});

/**
 * PATCH /api/vault/blocks/:id
 * Update a block
 */
vaultBlocksRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid block ID format');
  }

  const body = await c.req.json();
  const parseResult = updateBlockSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const updateData = Object.fromEntries(
    Object.entries(parseResult.data).filter(([_, v]) => v !== undefined)
  );

  if (Object.keys(updateData).length === 0) {
    throw new ValidationError('No valid fields to update');
  }

  const block = await vaultBlockService.update(id, updateData as any);

  if (!block) {
    throw new NotFoundError('Vault block');
  }

  return c.json({
    success: true,
    data: block,
    message: 'Block updated successfully',
  });
});

/**
 * POST /api/vault/blocks/:id/move
 * Move a block
 */
vaultBlocksRouter.post('/:id/move', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid block ID format');
  }

  const body = await c.req.json();
  const parseResult = moveBlockSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  try {
    const block = await vaultBlockService.move(id, parseResult.data as any);

    if (!block) {
      throw new NotFoundError('Vault block');
    }

    return c.json({
      success: true,
      data: block,
      message: 'Block moved successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throw new NotFoundError(error.message);
    }
    throw error;
  }
});

/**
 * DELETE /api/vault/blocks/:id
 * Delete a block
 */
vaultBlocksRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid block ID format');
  }

  const deleted = await vaultBlockService.delete(id);

  if (!deleted) {
    throw new NotFoundError('Vault block');
  }

  return c.json({
    success: true,
    message: 'Block deleted successfully',
  });
});

export { vaultPagesRouter };

/**
 * JD Agent - Class Detection Service
 *
 * Analyzes recording transcripts to:
 * 1. Detect if content is from an MBA class
 * 2. Identify specific course (MBA501, MBA502, etc.)
 * 3. Extract lecture topic and metadata
 * 4. Detect class boundaries in long recordings
 */

import { db } from '../db/client';
import { vaultEntries } from '../db/schema';
import { eq, and, isNull } from 'drizzle-orm';

// Known MBA courses - expand as needed
const MBA_COURSES: Record<string, { name: string; keywords: string[]; professors?: string[] }> = {
  'MBA501': {
    name: 'Strategic Management',
    keywords: ['strategy', 'competitive advantage', 'porter', 'five forces', 'swot', 'strategic'],
    professors: [],
  },
  'MBA502': {
    name: 'Financial Accounting',
    keywords: ['accounting', 'balance sheet', 'income statement', 'gaap', 'depreciation', 'assets', 'liabilities'],
    professors: [],
  },
  'MBA503': {
    name: 'Marketing Management',
    keywords: ['marketing', 'segmentation', 'targeting', 'positioning', 'brand', '4ps', 'consumer'],
    professors: [],
  },
  'MBA504': {
    name: 'Operations Management',
    keywords: ['operations', 'supply chain', 'inventory', 'lean', 'six sigma', 'process'],
    professors: [],
  },
  'MBA505': {
    name: 'Organizational Behavior',
    keywords: ['leadership', 'motivation', 'team', 'culture', 'organizational', 'behavior'],
    professors: [],
  },
  'MBA506': {
    name: 'Economics',
    keywords: ['economics', 'microeconomics', 'macroeconomics', 'supply', 'demand', 'gdp', 'inflation'],
    professors: [],
  },
  'MBA507': {
    name: 'Finance',
    keywords: ['finance', 'npv', 'irr', 'capm', 'wacc', 'valuation', 'dcf', 'beta'],
    professors: [],
  },
  'MBA508': {
    name: 'Business Analytics',
    keywords: ['analytics', 'data', 'regression', 'statistics', 'hypothesis', 'model'],
    professors: [],
  },
  'MBA509': {
    name: 'Ethics & Leadership',
    keywords: ['ethics', 'corporate responsibility', 'stakeholder', 'governance'],
    professors: [],
  },
  'MBA510': {
    name: 'Entrepreneurship',
    keywords: ['startup', 'venture', 'entrepreneur', 'pitch', 'funding', 'business model'],
    professors: [],
  },
};

// Academic context indicators
const CLASS_INDICATORS = [
  'professor', 'lecture', 'class', 'syllabus', 'assignment', 'exam',
  'midterm', 'final', 'quiz', 'homework', 'textbook', 'chapter',
  'slide', 'presentation', 'today we', 'last class', 'next class',
  'office hours', 'teaching assistant', 'ta ', 'grade', 'rubric',
];

export interface ClassDetectionResult {
  isClass: boolean;
  confidence: number; // 0-1
  courseCode?: string;
  courseName?: string;
  lectureTitle?: string;
  topics: string[];
  classSegments?: ClassSegment[];
}

export interface ClassSegment {
  startTime: number; // seconds
  endTime: number;
  courseCode?: string;
  courseName?: string;
  topic?: string;
  transcriptText: string;
}

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: number;
}

/**
 * Detect if a transcript is from an MBA class and identify the course
 */
export function detectClass(
  transcriptText: string,
  segments?: TranscriptSegment[]
): ClassDetectionResult {
  const textLower = transcriptText.toLowerCase();

  // Check for explicit course mentions (MBA501, etc.)
  const courseMatch = textLower.match(/mba\s*(\d{3})/i);
  let detectedCourse: string | undefined;

  if (courseMatch) {
    const courseNum = courseMatch[1];
    detectedCourse = `MBA${courseNum}`;
  }

  // Count class indicators
  let classIndicatorCount = 0;
  for (const indicator of CLASS_INDICATORS) {
    if (textLower.includes(indicator)) {
      classIndicatorCount++;
    }
  }

  // Score each course by keyword matches
  const courseScores: { code: string; score: number; name: string }[] = [];

  for (const [code, course] of Object.entries(MBA_COURSES)) {
    let score = 0;
    for (const keyword of course.keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = textLower.match(regex);
      if (matches) {
        score += matches.length;
      }
    }
    if (score > 0) {
      courseScores.push({ code, score, name: course.name });
    }
  }

  // Sort by score
  courseScores.sort((a, b) => b.score - a.score);

  // Determine if this is a class
  const isClass = classIndicatorCount >= 2 ||
                  detectedCourse !== undefined ||
                  (courseScores.length > 0 && courseScores[0].score >= 3);

  // Calculate confidence
  let confidence = 0;
  if (detectedCourse) confidence += 0.5;
  if (classIndicatorCount >= 3) confidence += 0.3;
  if (courseScores.length > 0 && courseScores[0].score >= 5) confidence += 0.2;
  confidence = Math.min(confidence, 1);

  // Use explicit course mention or best scoring course
  const finalCourse = detectedCourse || (courseScores.length > 0 ? courseScores[0].code : undefined);
  const courseName = finalCourse ? MBA_COURSES[finalCourse]?.name : courseScores[0]?.name;

  // Extract topics from high-scoring keywords
  const topics: string[] = [];
  if (courseScores.length > 0) {
    const topCourse = MBA_COURSES[courseScores[0].code];
    for (const keyword of topCourse.keywords) {
      if (textLower.includes(keyword) && !topics.includes(keyword)) {
        topics.push(keyword);
      }
    }
  }

  // If we have segments, try to detect class boundaries
  let classSegments: ClassSegment[] | undefined;
  if (segments && segments.length > 0) {
    classSegments = detectClassBoundaries(segments, textLower);
  }

  return {
    isClass,
    confidence,
    courseCode: finalCourse,
    courseName,
    topics: topics.slice(0, 5),
    classSegments,
  };
}

/**
 * Detect class boundaries in a long recording
 * Looks for:
 * - Long silences (gaps between segments)
 * - Topic shifts
 * - Course code mentions
 */
function detectClassBoundaries(
  segments: TranscriptSegment[],
  fullTextLower: string
): ClassSegment[] {
  const classSegments: ClassSegment[] = [];

  // Find gaps longer than 5 minutes (potential class boundaries)
  const GAP_THRESHOLD = 300; // 5 minutes in seconds

  let currentSegmentStart = segments[0]?.start || 0;
  let currentSegmentTexts: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const nextSegment = segments[i + 1];

    currentSegmentTexts.push(segment.text);

    // Check for gap or end of segments
    const hasGap = nextSegment && (nextSegment.start - segment.end) > GAP_THRESHOLD;
    const isLast = i === segments.length - 1;

    if (hasGap || isLast) {
      const segmentText = currentSegmentTexts.join(' ');
      const segmentLower = segmentText.toLowerCase();

      // Try to detect course for this segment
      const courseMatch = segmentLower.match(/mba\s*(\d{3})/i);
      let courseCode: string | undefined;
      let courseName: string | undefined;

      if (courseMatch) {
        courseCode = `MBA${courseMatch[1]}`;
        courseName = MBA_COURSES[courseCode]?.name;
      }

      classSegments.push({
        startTime: currentSegmentStart,
        endTime: segment.end,
        courseCode,
        courseName,
        transcriptText: segmentText,
      });

      // Reset for next segment
      if (nextSegment) {
        currentSegmentStart = nextSegment.start;
        currentSegmentTexts = [];
      }
    }
  }

  return classSegments;
}

/**
 * Get or create the Vault folder hierarchy for a class
 * Returns the parent ID for the specific class folder
 *
 * Hierarchy: MBA -> Winter2026 -> [CourseCode] -> [Date - Topic]
 */
export async function getOrCreateClassFolder(
  courseCode: string,
  semester: string = 'Winter2026'
): Promise<string> {
  // 1. Get or create "MBA" root folder
  let mbaFolder = await db.query.vaultEntries.findFirst({
    where: and(
      eq(vaultEntries.title, 'MBA'),
      eq(vaultEntries.contentType, 'folder'),
      isNull(vaultEntries.parentId)
    ),
  });

  if (!mbaFolder) {
    const [created] = await db.insert(vaultEntries).values({
      title: 'MBA',
      content: '# MBA Program\n\nClass notes and recordings from MBA courses.',
      contentType: 'folder',
      context: 'MBA',
      source: 'system',
      tags: ['mba', 'education'],
    }).returning();
    mbaFolder = created;
  }

  // 2. Get or create semester folder (e.g., "Winter2026")
  let semesterFolder = await db.query.vaultEntries.findFirst({
    where: and(
      eq(vaultEntries.title, semester),
      eq(vaultEntries.contentType, 'folder'),
      eq(vaultEntries.parentId, mbaFolder.id)
    ),
  });

  if (!semesterFolder) {
    const [created] = await db.insert(vaultEntries).values({
      title: semester,
      content: `# ${semester}\n\nClass materials for ${semester} semester.`,
      contentType: 'folder',
      context: 'MBA',
      parentId: mbaFolder.id,
      source: 'system',
      tags: ['mba', semester.toLowerCase()],
    }).returning();
    semesterFolder = created;
  }

  // 3. Get or create course folder (e.g., "MBA501 - Strategic Management")
  const courseName = MBA_COURSES[courseCode]?.name || 'Unknown Course';
  const courseFolderTitle = `${courseCode} - ${courseName}`;

  let courseFolder = await db.query.vaultEntries.findFirst({
    where: and(
      eq(vaultEntries.title, courseFolderTitle),
      eq(vaultEntries.contentType, 'folder'),
      eq(vaultEntries.parentId, semesterFolder.id)
    ),
  });

  if (!courseFolder) {
    const [created] = await db.insert(vaultEntries).values({
      title: courseFolderTitle,
      content: `# ${courseFolderTitle}\n\nLecture notes and recordings.`,
      contentType: 'folder',
      context: courseCode,
      parentId: semesterFolder.id,
      source: 'system',
      tags: ['mba', courseCode.toLowerCase(), 'course'],
    }).returning();
    courseFolder = created;
  }

  return courseFolder.id;
}

/**
 * Create a Vault entry for a class recording
 */
export async function createClassVaultEntry(opts: {
  recordingId: string;
  courseCode: string;
  lectureDate: Date;
  title: string;
  summary: string;
  keyPoints: string[];
  transcript: string;
  topics: string[];
}): Promise<string> {
  const { recordingId, courseCode, lectureDate, title, summary, keyPoints, transcript, topics } = opts;

  // Get the course folder
  const parentId = await getOrCreateClassFolder(courseCode);

  // Format the lecture title with date
  const dateStr = lectureDate.toISOString().split('T')[0];
  const fullTitle = `${dateStr} - ${title}`;

  // Build the content
  const content = `# ${fullTitle}

## Summary
${summary}

## Key Points
${keyPoints.map(p => `- ${p}`).join('\n')}

## Topics Covered
${topics.map(t => `- ${t}`).join('\n')}

---

## Full Transcript

${transcript}
`;

  // Create the vault entry
  const [entry] = await db.insert(vaultEntries).values({
    title: fullTitle,
    content,
    contentType: 'lecture',
    context: courseCode,
    parentId,
    source: 'plaud',
    sourceRef: `recording:${recordingId}`,
    recordingId,
    sourceDate: lectureDate,
    tags: ['mba', courseCode.toLowerCase(), 'lecture', 'recording', ...topics.slice(0, 3)],
  }).returning();

  console.log(`[ClassDetection] Created vault entry ${entry.id} for ${fullTitle}`);

  return entry.id;
}

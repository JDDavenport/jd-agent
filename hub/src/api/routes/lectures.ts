/**
 * JD Agent - Lectures API Routes
 *
 * Serves lecture recordings from Plaud transcripts in the Obsidian vault.
 * Scans course-specific folders for .md transcripts and matching .mp3 files.
 */

import { Hono } from 'hono';
import * as fs from 'fs';
import * as path from 'path';

const lecturesRouter = new Hono();

// Map course IDs to Obsidian vault folder names
const COURSE_FOLDER_MAP: Record<string, string> = {
  'mba560': 'MBA 560 - Business Analytics',
  'mba580': 'MBA 580 - Business Strategy',
  'mba654': 'MBA 654 - Strategic Client',
  'mba664': 'MBA 664 - Venture Capital',
  'mba677': 'MBA 677R - Entrepreneurship',
};

// Base path to Obsidian vault
const VAULT_BASE = process.env.OBSIDIAN_VAULT_PATH || 
  path.join(process.env.HOME || '', 'Documents/Obsidian/JD Vault/MBA/Spring 2026');

interface TranscriptLine {
  timestamp: number; // seconds
  timestampText: string;
  speaker: string | null;
  text: string;
}

interface Lecture {
  id: string;
  courseId: string;
  date: string;
  title: string;
  durationMinutes: number | null;
  audioPath: string | null;
  transcriptPath: string;
  previewSnippet: string;
  hasAudio: boolean;
}

interface LectureDetail extends Lecture {
  transcript: TranscriptLine[];
  rawContent: string;
}

/**
 * Parse timestamp from various formats
 * Supports: [00:00], [MM:SS], [HH:MM:SS]
 */
function parseTimestamp(ts: string): number {
  const match = ts.match(/\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?/);
  if (!match) return 0;
  
  if (match[3]) {
    // HH:MM:SS format
    return parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]);
  } else {
    // MM:SS format
    return parseInt(match[1]) * 60 + parseInt(match[2]);
  }
}

/**
 * Parse a Plaud transcript markdown file
 */
function parseTranscript(content: string): TranscriptLine[] {
  const lines: TranscriptLine[] = [];
  const regex = /\[([^\]]+)\]:\s*(.*)/g;
  
  // Also handle format: [Speaker 0]: text
  const speakerRegex = /\[Speaker (\d+)\]:\s*(.*)/g;
  
  // Split by lines and process
  const contentLines = content.split('\n');
  let currentTimestamp = 0;
  let currentTimestampText = '00:00';
  
  for (const line of contentLines) {
    // Check for timestamp markers like [00:00] or [MM:SS]
    const timestampMatch = line.match(/^\s*\[(\d{1,2}:\d{2}(?::\d{2})?)\]/);
    if (timestampMatch) {
      currentTimestamp = parseTimestamp(timestampMatch[1]);
      currentTimestampText = timestampMatch[1];
    }
    
    // Check for speaker lines
    const speakerMatch = line.match(/\[Speaker (\d+)\]:\s*(.*)/);
    if (speakerMatch) {
      const text = speakerMatch[2].trim();
      if (text) {
        lines.push({
          timestamp: currentTimestamp,
          timestampText: currentTimestampText,
          speaker: `Speaker ${speakerMatch[1]}`,
          text,
        });
      }
    }
  }
  
  return lines;
}

/**
 * Find matching audio file for a transcript
 */
function findAudioFile(transcriptPath: string, date: string): string | null {
  const dir = path.dirname(transcriptPath);
  
  try {
    const files = fs.readdirSync(dir);
    // Look for mp3 files with matching date
    const audioFiles = files.filter(f => 
      f.endsWith('.mp3') && f.startsWith(date)
    );
    
    if (audioFiles.length > 0) {
      return path.join(dir, audioFiles[0]);
    }
    
    // Also check for audio embedded in markdown
    const content = fs.readFileSync(transcriptPath, 'utf-8');
    const embedMatch = content.match(/!\[\[([^\]]+\.mp3)\]\]/);
    if (embedMatch) {
      const embeddedPath = path.join(dir, embedMatch[1]);
      if (fs.existsSync(embeddedPath)) {
        return embeddedPath;
      }
    }
  } catch (e) {
    console.error('[Lectures] Error finding audio file:', e);
  }
  
  return null;
}

/**
 * Extract metadata from transcript frontmatter
 */
function extractFrontmatter(content: string): Record<string, string> {
  const meta: Record<string, string> = {};
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  
  if (match) {
    const lines = match[1].split('\n');
    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      if (key && valueParts.length > 0) {
        meta[key.trim()] = valueParts.join(':').trim();
      }
    }
  }
  
  return meta;
}

/**
 * GET /api/lectures/:courseId
 * List all lectures for a course
 */
lecturesRouter.get('/:courseId', async (c) => {
  try {
    const courseId = c.req.param('courseId');
    const folderName = COURSE_FOLDER_MAP[courseId];
    
    if (!folderName) {
      return c.json({
        success: true,
        data: [],
        message: `No lecture folder mapped for course: ${courseId}`,
      });
    }
    
    const plaudDir = path.join(VAULT_BASE, folderName, 'Plaud');
    
    if (!fs.existsSync(plaudDir)) {
      return c.json({
        success: true,
        data: [],
        message: `Plaud folder not found: ${plaudDir}`,
      });
    }
    
    const files = fs.readdirSync(plaudDir);
    const transcriptFiles = files.filter(f => f.endsWith('.md'));
    
    const lectures: Lecture[] = [];
    
    for (const file of transcriptFiles) {
      const filePath = path.join(plaudDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Extract date from filename (format: YYYY-MM-DD title.md)
      const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
      const date = dateMatch ? dateMatch[1] : '';
      
      // Extract title from filename
      const title = file
        .replace(/^\d{4}-\d{2}-\d{2}\s*/, '')
        .replace(/\.md$/, '')
        .trim() || 'Untitled Lecture';
      
      // Get frontmatter
      const meta = extractFrontmatter(content);
      const durationMinutes = meta.duration ? parseInt(meta.duration) : null;
      
      // Find audio file
      const audioPath = findAudioFile(filePath, date);
      
      // Get preview snippet (first few transcript lines)
      const transcript = parseTranscript(content);
      const previewSnippet = transcript.slice(0, 3)
        .map(l => l.text)
        .join(' ')
        .slice(0, 200);
      
      lectures.push({
        id: Buffer.from(filePath).toString('base64url'),
        courseId,
        date,
        title,
        durationMinutes,
        audioPath,
        transcriptPath: filePath,
        previewSnippet: previewSnippet || 'No transcript available',
        hasAudio: !!audioPath,
      });
    }
    
    // Sort by date, most recent first
    lectures.sort((a, b) => b.date.localeCompare(a.date));
    
    return c.json({ success: true, data: lectures });
  } catch (error) {
    console.error('[Lectures API] Error listing lectures:', error);
    return c.json(
      { success: false, error: { code: 'LIST_ERROR', message: String(error) } },
      500
    );
  }
});

/**
 * GET /api/lectures/:courseId/:lectureId
 * Get lecture detail with full transcript
 */
lecturesRouter.get('/:courseId/:lectureId', async (c) => {
  try {
    const lectureId = c.req.param('lectureId');
    const courseId = c.req.param('courseId');
    
    // Decode file path from ID
    const filePath = Buffer.from(lectureId, 'base64url').toString();
    
    if (!fs.existsSync(filePath)) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Lecture not found' } },
        404
      );
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const filename = path.basename(filePath);
    
    // Extract date and title
    const dateMatch = filename.match(/^(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : '';
    const title = filename
      .replace(/^\d{4}-\d{2}-\d{2}\s*/, '')
      .replace(/\.md$/, '')
      .trim() || 'Untitled Lecture';
    
    // Get frontmatter
    const meta = extractFrontmatter(content);
    const durationMinutes = meta.duration ? parseInt(meta.duration) : null;
    
    // Find audio file
    const audioPath = findAudioFile(filePath, date);
    
    // Parse full transcript
    const transcript = parseTranscript(content);
    
    const lecture: LectureDetail = {
      id: lectureId,
      courseId,
      date,
      title,
      durationMinutes,
      audioPath,
      transcriptPath: filePath,
      previewSnippet: transcript.slice(0, 3).map(l => l.text).join(' ').slice(0, 200),
      hasAudio: !!audioPath,
      transcript,
      rawContent: content,
    };
    
    return c.json({ success: true, data: lecture });
  } catch (error) {
    console.error('[Lectures API] Error getting lecture:', error);
    return c.json(
      { success: false, error: { code: 'GET_ERROR', message: String(error) } },
      500
    );
  }
});

/**
 * GET /api/lectures/:courseId/:lectureId/audio
 * Stream audio file for a lecture
 */
lecturesRouter.get('/:courseId/:lectureId/audio', async (c) => {
  try {
    const lectureId = c.req.param('lectureId');
    
    // Decode file path from ID
    const transcriptPath = Buffer.from(lectureId, 'base64url').toString();
    const filename = path.basename(transcriptPath);
    const dateMatch = filename.match(/^(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : '';
    
    const audioPath = findAudioFile(transcriptPath, date);
    
    if (!audioPath || !fs.existsSync(audioPath)) {
      return c.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Audio file not found' } },
        404
      );
    }
    
    const stat = fs.statSync(audioPath);
    const fileSize = stat.size;
    const range = c.req.header('Range');
    
    if (range) {
      // Handle range request for seeking
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;
      
      const file = fs.createReadStream(audioPath, { start, end });
      const chunks: Buffer[] = [];
      
      for await (const chunk of file) {
        chunks.push(chunk as Buffer);
      }
      
      return new Response(Buffer.concat(chunks), {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunkSize),
          'Content-Type': 'audio/mpeg',
        },
      });
    }
    
    // Full file response
    const audioBuffer = fs.readFileSync(audioPath);
    
    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(fileSize),
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (error) {
    console.error('[Lectures API] Error streaming audio:', error);
    return c.json(
      { success: false, error: { code: 'STREAM_ERROR', message: String(error) } },
      500
    );
  }
});

export { lecturesRouter };

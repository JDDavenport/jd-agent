import { Hono } from 'hono';
import { z } from 'zod';
import { readdir, readFile, stat } from 'fs/promises';
import { join, basename } from 'path';
import { existsSync } from 'fs';
import Groq from 'groq-sdk';
import OpenAI from 'openai';

const coursesRouter = new Hono();

// Initialize cloud LLM clients
const groqApiKey = process.env.GROQ_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

const groqClient = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;
const openaiClient = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

console.log('[Courses] LLM providers available:', {
  groq: !!groqClient,
  openai: !!openaiClient,
});

// Groq API helper - primary cloud provider (fast & free tier)
async function groqChat(
  systemPrompt: string, 
  messages: Array<{role: 'user' | 'assistant', content: string}>
): Promise<{ response: string; model: string }> {
  if (!groqClient) {
    throw new Error('Groq API key not configured');
  }
  
  const response = await groqClient.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 2048,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ],
  });
  
  return {
    response: response.choices[0]?.message?.content || 'Sorry, I could not generate a response.',
    model: 'llama-3.3-70b-versatile (Groq)',
  };
}

// OpenAI API helper - secondary cloud provider
async function openaiChat(
  systemPrompt: string, 
  messages: Array<{role: 'user' | 'assistant', content: string}>
): Promise<{ response: string; model: string }> {
  if (!openaiClient) {
    throw new Error('OpenAI API key not configured');
  }
  
  const response = await openaiClient.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 2048,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ],
  });
  
  return {
    response: response.choices[0]?.message?.content || 'Sorry, I could not generate a response.',
    model: 'gpt-4o-mini (OpenAI)',
  };
}

// Ollama API helper - fallback for offline use
async function ollamaChat(
  systemPrompt: string, 
  messages: Array<{role: 'user' | 'assistant', content: string}>
): Promise<{ response: string; model: string }> {
  const ollamaMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...messages,
  ];
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
  
  try {
    const response = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.1:8b',
        messages: ollamaMessages,
        stream: false,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }
    
    const data = await response.json();
    return {
      response: data.message?.content || 'Sorry, I could not generate a response.',
      model: 'llama3.1:8b (local Ollama)',
    };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Unified chat helper - tries Groq first, then OpenAI, then Ollama
async function courseTutorChat(
  systemPrompt: string,
  messages: Array<{role: 'user' | 'assistant', content: string}>
): Promise<{ response: string; model: string }> {
  // Try Groq first (fast cloud provider with good free tier)
  if (groqClient) {
    try {
      console.log('[Courses] Trying Groq...');
      return await groqChat(systemPrompt, messages);
    } catch (error) {
      console.warn('[Courses] Groq failed:', error);
    }
  }
  
  // Fallback to OpenAI
  if (openaiClient) {
    try {
      console.log('[Courses] Trying OpenAI fallback...');
      return await openaiChat(systemPrompt, messages);
    } catch (error) {
      console.warn('[Courses] OpenAI failed:', error);
    }
  }
  
  // Final fallback to local Ollama
  try {
    console.log('[Courses] Trying local Ollama fallback...');
    return await ollamaChat(systemPrompt, messages);
  } catch (error) {
    console.error('[Courses] All LLM providers failed:', error);
    throw new Error('No LLM provider available. Please check API keys or start Ollama.');
  }
}

// Course ID to Obsidian vault folder mapping
const COURSE_FOLDERS: Record<string, string> = {
  'mba560': 'MBA 560 - Business Analytics',
  'mba580': 'MBA 580 - Business Strategy',
  'ent': 'Entrepreneurial Innovation',
  'entrepreneurial-innovation': 'Entrepreneurial Innovation',
  'mba664': 'MBA 664 - Venture Capital',
  'mba677': 'MBA 677R - Entrepreneurship',
  'mba677r': 'MBA 677R - Entrepreneurship',
  'mba654': 'MBA 654 - Strategic Client',
  'mba693r': 'Post-MBA Career Strategy',
};

const COURSE_SUBJECTS: Record<string, string> = {
  'mba560': 'Business Analytics, Statistics, Data Analysis, Regression, Probability, Hypothesis Testing',
  'mba580': 'Business Strategy, Competitive Advantage, Porter\'s Five Forces, SWOT Analysis, Strategic Planning',
  'ent': 'Entrepreneurship, Innovation, Product Development, Design Thinking, Lean Startup',
  'entrepreneurial-innovation': 'Entrepreneurship, Innovation, Product Development, Design Thinking, Lean Startup',
  'mba664': 'Venture Capital, Private Equity, Investment Analysis, Due Diligence, Term Sheets',
  'mba677': 'Entrepreneurship Through Acquisition, Search Funds, Small Business Acquisition',
  'mba677r': 'Entrepreneurship Through Acquisition, Search Funds, Small Business Acquisition',
  'mba654': 'Client Acquisition, Sales, Marketing, Customer Retention, CRM',
  'mba693r': 'Career Strategy, Job Search, Networking, Personal Branding',
};

const VAULT_BASE = process.env.OBSIDIAN_VAULT_PATH || '/Users/jddavenport/Documents/Obsidian/JD Vault';
const MBA_PATH = join(VAULT_BASE, 'MBA', 'Spring 2026');

interface Lecture {
  id: string;
  date: string;
  title: string;
  duration?: string;
  preview: string;
  transcriptPath: string;
  audioPath?: string;
  hasAudio: boolean;
}

interface LectureDetail extends Lecture {
  transcript: string;
  segments: TranscriptSegment[];
}

interface TranscriptSegment {
  timestamp: string;
  seconds: number;
  text: string;
}

// Parse timestamp like [00:00] or [12:34] to seconds
function parseTimestamp(ts: string): number {
  const match = ts.match(/\[(\d{1,2}):(\d{2})\]/);
  if (!match) return 0;
  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  return minutes * 60 + seconds;
}

// Parse transcript markdown into segments
function parseTranscript(content: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const lines = content.split('\n');
  
  let currentSegment: TranscriptSegment | null = null;
  
  for (const line of lines) {
    const timestampMatch = line.match(/^\[(\d{1,2}:\d{2})\]/);
    if (timestampMatch) {
      if (currentSegment) {
        segments.push(currentSegment);
      }
      const timestamp = `[${timestampMatch[1]}]`;
      currentSegment = {
        timestamp,
        seconds: parseTimestamp(timestamp),
        text: line.replace(/^\[\d{1,2}:\d{2}\]\s*/, '').trim(),
      };
    } else if (currentSegment && line.trim()) {
      currentSegment.text += ' ' + line.trim();
    }
  }
  
  if (currentSegment) {
    segments.push(currentSegment);
  }
  
  return segments;
}

// Get lectures for a course
async function getLecturesForCourse(courseId: string): Promise<Lecture[]> {
  const folderName = COURSE_FOLDERS[courseId];
  if (!folderName) {
    return [];
  }

  const plaudPath = join(MBA_PATH, folderName, 'Plaud');
  
  if (!existsSync(plaudPath)) {
    return [];
  }

  const files = await readdir(plaudPath);
  const lectures: Lecture[] = [];

  // Group files by date prefix (transcripts and audio)
  const mdFiles = files.filter(f => f.endsWith('.md'));
  const mp3Files = files.filter(f => f.endsWith('.mp3'));

  for (const mdFile of mdFiles) {
    const fullPath = join(plaudPath, mdFile);
    const content = await readFile(fullPath, 'utf-8');
    
    // Extract date from filename (e.g., "2026-01-26 What an audacious...")
    const dateMatch = mdFile.match(/^(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : 'Unknown';
    
    // Title is the rest after date
    const title = mdFile
      .replace(/^\d{4}-\d{2}-\d{2}\s*/, '')
      .replace(/\.md$/, '')
      .trim() || 'Untitled Recording';

    // Find matching audio file (same date prefix)
    const audioFile = mp3Files.find(f => f.startsWith(date.replace(/-/g, '-')));
    
    // Get preview (first 150 chars of content, skip metadata)
    const contentLines = content.split('\n').filter(l => !l.startsWith('#') && !l.startsWith('---') && l.trim());
    const preview = contentLines.slice(0, 3).join(' ').substring(0, 150) + '...';

    // Create a stable ID from the filename
    const id = Buffer.from(mdFile).toString('base64url');

    lectures.push({
      id,
      date,
      title,
      preview,
      transcriptPath: fullPath,
      audioPath: audioFile ? join(plaudPath, audioFile) : undefined,
      hasAudio: !!audioFile,
    });
  }

  // Sort by date descending (most recent first)
  lectures.sort((a, b) => b.date.localeCompare(a.date));

  return lectures;
}

// GET /api/courses/:courseId/lectures - List lectures for a course
coursesRouter.get('/:courseId/lectures', async (c) => {
  const courseId = c.req.param('courseId');
  
  try {
    const lectures = await getLecturesForCourse(courseId);
    return c.json({
      success: true,
      data: lectures,
    });
  } catch (error) {
    console.error('[Courses] Error fetching lectures:', error);
    return c.json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch lectures' },
    }, 500);
  }
});

// GET /api/courses/:courseId/lectures/:lectureId - Get lecture detail with transcript
coursesRouter.get('/:courseId/lectures/:lectureId', async (c) => {
  const courseId = c.req.param('courseId');
  const lectureId = c.req.param('lectureId');
  
  try {
    const lectures = await getLecturesForCourse(courseId);
    const lecture = lectures.find(l => l.id === lectureId);
    
    if (!lecture) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Lecture not found' },
      }, 404);
    }

    // Read full transcript
    const content = await readFile(lecture.transcriptPath, 'utf-8');
    const segments = parseTranscript(content);

    const detail: LectureDetail = {
      ...lecture,
      transcript: content,
      segments,
    };

    return c.json({
      success: true,
      data: detail,
    });
  } catch (error) {
    console.error('[Courses] Error fetching lecture detail:', error);
    return c.json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch lecture' },
    }, 500);
  }
});

// GET /api/courses/:courseId/audio/:lectureId - Stream audio file
coursesRouter.get('/:courseId/audio/:lectureId', async (c) => {
  const courseId = c.req.param('courseId');
  const lectureId = c.req.param('lectureId');
  
  try {
    const lectures = await getLecturesForCourse(courseId);
    const lecture = lectures.find(l => l.id === lectureId);
    
    if (!lecture || !lecture.audioPath) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Audio not found' },
      }, 404);
    }

    const audioBuffer = await readFile(lecture.audioPath);
    const stats = await stat(lecture.audioPath);
    
    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': stats.size.toString(),
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (error) {
    console.error('[Courses] Error streaming audio:', error);
    return c.json({
      success: false,
      error: { code: 'STREAM_ERROR', message: 'Failed to stream audio' },
    }, 500);
  }
});

// Chat schema
const chatSchema = z.object({
  message: z.string().min(1),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
});

// POST /api/courses/:courseId/chat - Chat with course AI tutor (RAG-powered)
coursesRouter.post('/:courseId/chat', async (c) => {
  const courseId = c.req.param('courseId');
  const body = await c.req.json();
  
  const parseResult = chatSchema.safeParse(body);
  if (!parseResult.success) {
    return c.json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parseResult.error.message },
    }, 400);
  }

  const { message, history = [] } = parseResult.data;
  const folderName = COURSE_FOLDERS[courseId];
  const subject = COURSE_SUBJECTS[courseId] || 'Business';

  if (!folderName) {
    return c.json({
      success: false,
      error: { code: 'INVALID_COURSE', message: 'Course not found' },
    }, 404);
  }

  try {
    // Use vector search for RAG - get relevant context from indexed content
    const searchResults = await hybridSearch(message, courseId, {
      topK: 5,
      useHybrid: true,
    });

    // Build context from search results
    const contextParts: string[] = [];
    const citations: Array<{ source: string; content: string }> = [];
    
    for (const result of searchResults) {
      const sourceLabel = result.sourceType === 'lecture' 
        ? `📝 ${result.sourceTitle}${result.sourceDate ? ` (${result.sourceDate})` : ''}`
        : `📖 ${result.sourceTitle}${result.pageNumber ? ` p.${result.pageNumber}` : ''}`;
      
      contextParts.push(`[${sourceLabel}]\n${result.chunkText.slice(0, 600)}`);
      citations.push({
        source: sourceLabel,
        content: result.chunkText.slice(0, 100) + '...',
      });
    }

    const contextText = contextParts.length > 0 
      ? contextParts.join('\n\n---\n\n')
      : 'No specific content found for this query.';

    const systemPrompt = `You are an expert tutor for ${folderName} (${subject}). Answer based on the course materials provided.

RELEVANT COURSE MATERIALS:
${contextText}

Guidelines:
- Be concise and direct
- Cite sources when referencing specific content (e.g., "According to the Jan 15 lecture...")
- If the materials don't contain relevant information, say so
- Use markdown formatting for readability`;

    // Build conversation history
    const chatMessages: Array<{role: 'user' | 'assistant', content: string}> = [
      ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user' as const, content: message },
    ];

    const { response, model } = await courseTutorChat(systemPrompt, chatMessages);

    return c.json({
      success: true,
      data: {
        response,
        sources: citations.slice(0, 3), // Return top 3 citations
        model,
        contextUsed: searchResults.length,
      },
    });
  } catch (error) {
    console.error('[Courses] Chat error:', error);
    return c.json({
      success: false,
      error: { code: 'CHAT_ERROR', message: 'Failed to process chat' },
    }, 500);
  }
});

// GET /api/courses/:courseId/summary - Get course summary and stats
coursesRouter.get('/:courseId/summary', async (c) => {
  const courseId = c.req.param('courseId');
  
  try {
    const lectures = await getLecturesForCourse(courseId);
    
    return c.json({
      success: true,
      data: {
        courseId,
        folderName: COURSE_FOLDERS[courseId],
        lectureCount: lectures.length,
        lectures: lectures.map(l => ({
          date: l.date,
          title: l.title,
          hasAudio: l.hasAudio,
        })),
      },
    });
  } catch (error) {
    console.error('[Courses] Error fetching summary:', error);
    return c.json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch course summary' },
    }, 500);
  }
});

// Interface for Remarkable note
interface RemarkableNote {
  id: string;
  name: string;
  pdfPath: string;
  ocrText: string;
  pages: number;
}

// Get Remarkable notes for a course
async function getRemarkableNotesForCourse(courseId: string): Promise<RemarkableNote[]> {
  const folderName = COURSE_FOLDERS[courseId];
  if (!folderName) {
    return [];
  }

  const remarkablePath = join(MBA_PATH, folderName, 'Remarkable');
  
  if (!existsSync(remarkablePath)) {
    return [];
  }

  const files = await readdir(remarkablePath);
  const notes: RemarkableNote[] = [];

  // Find markdown files (which contain OCR text)
  const mdFiles = files.filter(f => f.endsWith('.md'));

  for (const mdFile of mdFiles) {
    const fullPath = join(remarkablePath, mdFile);
    const content = await readFile(fullPath, 'utf-8');
    
    // Parse frontmatter for pages count
    const pagesMatch = content.match(/pages:\s*(\d+)/);
    const pages = pagesMatch ? parseInt(pagesMatch[1], 10) : 0;
    
    // Extract OCR text (everything after "## OCR Text")
    const ocrMatch = content.match(/## OCR Text\n\n([\s\S]*)/);
    const ocrText = ocrMatch ? ocrMatch[1].trim() : '';
    
    // Find matching PDF
    const pdfFile = mdFile.replace('.md', '.pdf');
    const pdfPath = join(remarkablePath, pdfFile);
    
    const id = Buffer.from(mdFile).toString('base64url');
    const name = mdFile.replace('.md', '');

    notes.push({
      id,
      name,
      pdfPath: existsSync(pdfPath) ? pdfPath : '',
      ocrText,
      pages,
    });
  }

  return notes;
}

// Interface for class day (combines Plaud + Remarkable)
interface ClassDay {
  date: string;
  plaudRecordings: Array<{
    id: string;
    title: string;
    hasAudio: boolean;
    duration?: string;
  }>;
  remarkableNotes: Array<{
    id: string;
    name: string;
    pages: number;
    preview: string;
  }>;
}

// GET /api/courses/:courseId/class-days - Get combined class days with Plaud + Remarkable
coursesRouter.get('/:courseId/class-days', async (c) => {
  const courseId = c.req.param('courseId');
  
  try {
    const lectures = await getLecturesForCourse(courseId);
    const remarkableNotes = await getRemarkableNotesForCourse(courseId);
    
    // Group by date
    const byDate: Record<string, ClassDay> = {};
    
    // Add Plaud recordings
    for (const lecture of lectures) {
      if (!byDate[lecture.date]) {
        byDate[lecture.date] = {
          date: lecture.date,
          plaudRecordings: [],
          remarkableNotes: [],
        };
      }
      byDate[lecture.date].plaudRecordings.push({
        id: lecture.id,
        title: lecture.title,
        hasAudio: lecture.hasAudio,
      });
    }
    
    // Add Remarkable notes (not dated, so add to most recent date or create "undated" section)
    // For now, we'll return them separately since they're not dated in the same way
    
    // Convert to array and sort by date descending
    const classDays = Object.values(byDate)
      .sort((a, b) => b.date.localeCompare(a.date));
    
    return c.json({
      success: true,
      data: {
        classDays,
        remarkableNotes: remarkableNotes.map(n => ({
          id: n.id,
          name: n.name,
          pages: n.pages,
          preview: n.ocrText.substring(0, 200) + '...',
        })),
      },
    });
  } catch (error) {
    console.error('[Courses] Error fetching class days:', error);
    return c.json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch class days' },
    }, 500);
  }
});

// GET /api/courses/:courseId/remarkable - Get Remarkable notes for a course
coursesRouter.get('/:courseId/remarkable', async (c) => {
  const courseId = c.req.param('courseId');
  
  try {
    const notes = await getRemarkableNotesForCourse(courseId);
    return c.json({
      success: true,
      data: notes.map(n => ({
        id: n.id,
        name: n.name,
        pages: n.pages,
        preview: n.ocrText.substring(0, 200) + '...',
        ocrText: n.ocrText,
      })),
    });
  } catch (error) {
    console.error('[Courses] Error fetching remarkable notes:', error);
    return c.json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch remarkable notes' },
    }, 500);
  }
});

// GET /api/courses/:courseId/remarkable/:noteId/pdf - Serve Remarkable PDF
coursesRouter.get('/:courseId/remarkable/:noteId/pdf', async (c) => {
  const courseId = c.req.param('courseId');
  const noteId = c.req.param('noteId');
  
  try {
    const notes = await getRemarkableNotesForCourse(courseId);
    const note = notes.find(n => n.id === noteId);
    
    if (!note || !note.pdfPath) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'PDF not found' },
      }, 404);
    }

    const pdfBuffer = await readFile(note.pdfPath);
    const stats = await stat(note.pdfPath);
    
    return new Response(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': stats.size.toString(),
        'Content-Disposition': `inline; filename="${note.name}.pdf"`,
      },
    });
  } catch (error) {
    console.error('[Courses] Error serving PDF:', error);
    return c.json({
      success: false,
      error: { code: 'SERVE_ERROR', message: 'Failed to serve PDF' },
    }, 500);
  }
});

// ============================================
// VECTOR SEARCH ENDPOINTS
// ============================================

import { hybridSearch, keywordSearch, getSearchStats } from '../../services/course-vector-search';
import { indexCourse, getIndexStats } from '../../services/course-content-indexer';

// GET /api/courses/:courseId/search - Semantic search across course content
coursesRouter.get('/:courseId/search', async (c) => {
  const courseId = c.req.param('courseId');
  const query = c.req.query('q');
  const topK = parseInt(c.req.query('limit') || '20', 10);
  const sourceTypesParam = c.req.query('types'); // comma-separated: 'lecture,reading'
  const mode = c.req.query('mode') || 'hybrid'; // 'hybrid', 'vector', 'keyword'

  if (!query) {
    return c.json({
      success: false,
      error: { code: 'MISSING_QUERY', message: 'Query parameter "q" is required' },
    }, 400);
  }

  const folderName = COURSE_FOLDERS[courseId];
  if (!folderName) {
    return c.json({
      success: false,
      error: { code: 'INVALID_COURSE', message: 'Course not found' },
    }, 404);
  }

  try {
    const sourceTypes = sourceTypesParam?.split(',').filter(Boolean);
    
    let results;
    if (mode === 'keyword') {
      results = await keywordSearch(query, courseId, { topK, sourceTypes });
    } else {
      results = await hybridSearch(query, courseId, { 
        topK, 
        sourceTypes,
        useHybrid: mode === 'hybrid',
      });
    }

    return c.json({
      success: true,
      data: {
        query,
        courseId,
        mode,
        count: results.length,
        results: results.map(r => ({
          id: r.id,
          sourceType: r.sourceType,
          sourceTitle: r.sourceTitle,
          sourceDate: r.sourceDate,
          chunkText: r.chunkText,
          pageNumber: r.pageNumber,
          timestamp: r.startTimestampSeconds,
          score: r.fusedScore,
          vectorScore: r.vectorScore,
          keywordScore: r.keywordScore,
          metadata: r.metadata,
        })),
      },
    });
  } catch (error) {
    console.error('[Courses] Search error:', error);
    return c.json({
      success: false,
      error: { code: 'SEARCH_ERROR', message: 'Failed to search course content' },
    }, 500);
  }
});

// GET /api/courses/:courseId/search/stats - Get search index stats
coursesRouter.get('/:courseId/search/stats', async (c) => {
  const courseId = c.req.param('courseId');

  try {
    const stats = await getSearchStats(courseId);
    const indexStats = await getIndexStats(courseId);

    return c.json({
      success: true,
      data: {
        courseId,
        searchStats: stats,
        indexStats,
      },
    });
  } catch (error) {
    console.error('[Courses] Stats error:', error);
    return c.json({
      success: false,
      error: { code: 'STATS_ERROR', message: 'Failed to get search stats' },
    }, 500);
  }
});

// POST /api/courses/:courseId/index - Trigger content indexing for a course
coursesRouter.post('/:courseId/index', async (c) => {
  const courseId = c.req.param('courseId');

  const folderName = COURSE_FOLDERS[courseId];
  if (!folderName) {
    return c.json({
      success: false,
      error: { code: 'INVALID_COURSE', message: 'Course not found' },
    }, 404);
  }

  try {
    console.log(`[Courses] Starting index for course: ${courseId}`);
    const results = await indexCourse(courseId);

    const summary = {
      courseId,
      totalChunks: results.reduce((sum, r) => sum + r.chunksCreated, 0),
      totalEmbedded: results.reduce((sum, r) => sum + r.chunksEmbedded, 0),
      totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
      bySourceType: results.map(r => ({
        sourceType: r.sourceType,
        chunksCreated: r.chunksCreated,
        chunksEmbedded: r.chunksEmbedded,
        errors: r.errors.length,
      })),
    };

    return c.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('[Courses] Index error:', error);
    return c.json({
      success: false,
      error: { code: 'INDEX_ERROR', message: 'Failed to index course content' },
    }, 500);
  }
});

// GET /api/courses/:courseId/syllabus - Get syllabus content for a course
coursesRouter.get('/:courseId/syllabus', async (c) => {
  const courseId = c.req.param('courseId');

  try {
    // Import the db and schema here to avoid circular deps
    const { db } = await import('../../db/client');
    const { courseContentChunks } = await import('../../db/schema');
    const { eq, and, asc } = await import('drizzle-orm');

    // Fetch all syllabus chunks for this course
    const chunks = await db
      .select()
      .from(courseContentChunks)
      .where(
        and(
          eq(courseContentChunks.courseId, courseId),
          eq(courseContentChunks.sourceType, 'syllabus')
        )
      )
      .orderBy(asc(courseContentChunks.chunkIndex));

    if (chunks.length === 0) {
      return c.json({
        success: true,
        data: null,
        message: 'No syllabus found for this course',
      });
    }

    // Combine chunks into full syllabus content
    const syllabusContent = chunks.map(ch => ch.chunkText).join('\n\n');

    return c.json({
      success: true,
      data: {
        courseId,
        title: chunks[0]?.sourceTitle || `${courseId.toUpperCase()} Syllabus`,
        content: syllabusContent,
        chunkCount: chunks.length,
        lastUpdated: chunks[0]?.sourceDate,
      },
    });
  } catch (error) {
    console.error('[Courses] Syllabus error:', error);
    return c.json({
      success: false,
      error: { code: 'SYLLABUS_ERROR', message: 'Failed to fetch syllabus' },
    }, 500);
  }
});

export { coursesRouter };

/**
 * Study Help Chat API — "Class GPT"
 * 
 * Per-course RAG chat system. Gathers course materials (Canvas PDFs, 
 * lecture transcripts, recordings) as context and uses Claude to answer 
 * student questions with citations.
 */

import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { streamSSE } from 'hono/streaming';
import { db } from '../../db/client';
import {
  studyHelpChatMessages,
  studyHelpUserCourses,
  canvasMaterials,
  classes,
  recordings,
  transcripts,
} from '../../db/schema';
import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { getUserFromSession } from './study-help-auth';
import Anthropic from '@anthropic-ai/sdk';

const studyHelpChatRouter = new Hono();

const COOKIE_NAME = 'study_help_session';
const MAX_CONTEXT_CHARS = 80_000; // Leave room for system prompt + conversation
const MAX_HISTORY_MESSAGES = 20; // Last N messages to include in conversation
const MAX_MATERIAL_SNIPPETS = 15; // Max materials to include as context

// ============================================
// Helpers
// ============================================

interface Citation {
  name: string;
  url: string | null;
  type: string; // 'material' | 'recording' | 'transcript'
  snippet?: string;
}

/**
 * Gather course context from Canvas materials and recordings.
 * Returns formatted context string + list of available sources for citations.
 */
async function gatherCourseContext(canvasCourseId: string): Promise<{
  context: string;
  sources: Array<{ name: string; url: string | null; type: string; id: string }>;
}> {
  const sources: Array<{ name: string; url: string | null; type: string; id: string }> = [];
  const contextParts: string[] = [];
  let totalChars = 0;

  // 1. Find the class record matching this Canvas course ID
  const [classRecord] = await db
    .select()
    .from(classes)
    .where(eq(classes.canvasCourseId, canvasCourseId))
    .limit(1);

  // 2. Get Canvas materials (PDFs, slides, etc.) with extracted text
  if (classRecord) {
    const materials = await db
      .select()
      .from(canvasMaterials)
      .where(eq(canvasMaterials.courseId, classRecord.id))
      .orderBy(desc(canvasMaterials.updatedAt));

    for (const mat of materials) {
      if (totalChars >= MAX_CONTEXT_CHARS) break;

      const source = {
        name: mat.displayName || mat.fileName,
        url: mat.canvasUrl || mat.downloadUrl,
        type: 'material',
        id: mat.id,
      };
      sources.push(source);

      // Include extracted text or summary
      const content = mat.extractedText || mat.aiSummary;
      if (content) {
        const snippet = content.slice(0, Math.min(content.length, (MAX_CONTEXT_CHARS - totalChars) / MAX_MATERIAL_SNIPPETS));
        contextParts.push(
          `--- Material: "${source.name}" (${mat.materialType || mat.fileType}) ---\n${snippet}`
        );
        totalChars += snippet.length + 100;
      } else {
        // Still track the source even without text
        contextParts.push(
          `--- Material: "${source.name}" (${mat.materialType || mat.fileType}) [no text extracted] ---`
        );
        totalChars += 100;
      }
    }
  }

  // 3. Get recordings/transcripts for this course
  // Match by context field containing course name/code
  const courseName = classRecord?.name || '';
  const courseCode = classRecord?.code || '';

  if (courseName || courseCode) {
    // Search recordings by context matching the course
    const courseRecordings = await db
      .select({
        recording: recordings,
        transcript: transcripts,
      })
      .from(recordings)
      .leftJoin(transcripts, eq(transcripts.recordingId, recordings.id))
      .where(
        and(
          eq(recordings.recordingType, 'class'),
          eq(recordings.status, 'complete')
        )
      )
      .orderBy(desc(recordings.recordedAt))
      .limit(10);

    for (const { recording, transcript } of courseRecordings) {
      if (totalChars >= MAX_CONTEXT_CHARS) break;

      // Check if this recording's context matches the course
      const ctx = (recording.context || '').toLowerCase();
      const nameMatch = courseName && ctx.includes(courseName.toLowerCase());
      const codeMatch = courseCode && ctx.includes(courseCode.toLowerCase());

      if (!nameMatch && !codeMatch) continue;

      const source = {
        name: recording.originalFilename || `Recording ${recording.id.slice(0, 8)}`,
        url: null,
        type: 'recording',
        id: recording.id,
      };
      sources.push(source);

      if (transcript?.fullText) {
        const snippet = transcript.fullText.slice(
          0,
          Math.min(transcript.fullText.length, (MAX_CONTEXT_CHARS - totalChars) / 3)
        );
        contextParts.push(
          `--- Lecture Recording: "${source.name}" (${recording.recordedAt?.toLocaleDateString() || 'unknown date'}) ---\n${snippet}`
        );
        totalChars += snippet.length + 150;
      }

      // Include transcript summary if available
      if (transcript?.summary) {
        const summary = typeof transcript.summary === 'string'
          ? transcript.summary
          : JSON.stringify(transcript.summary);
        const summarySnippet = summary.slice(0, 2000);
        contextParts.push(
          `--- Lecture Summary: "${source.name}" ---\n${summarySnippet}`
        );
        totalChars += summarySnippet.length + 100;
      }
    }
  }

  return {
    context: contextParts.join('\n\n'),
    sources,
  };
}

function buildSystemPrompt(courseName: string, context: string, sources: Array<{ name: string; type: string }>): string {
  const sourceList = sources
    .map((s, i) => `  [${i + 1}] ${s.name} (${s.type})`)
    .join('\n');

  return `You are Class GPT, an AI study assistant for the course "${courseName}". 
You help students understand course material, prepare for exams, and master key concepts.

You have access to the following course materials:
${sourceList || '  (No materials available yet)'}

COURSE MATERIALS CONTEXT:
${context || '(No extracted content available)'}

INSTRUCTIONS:
- Answer questions about course material accurately, using the provided context
- When you reference specific information, cite the source material by name using [Source: "material name"] format
- If the student asks about something not covered in the materials, say so honestly
- Be concise but thorough — this is for studying, not entertainment
- Use markdown formatting for clarity (headers, bullet points, code blocks where appropriate)
- If asked to quiz the student, create practice questions based on the actual course material
- When summarizing, focus on key concepts, frameworks, and exam-relevant material
- Be encouraging and helpful — you're a study buddy, not a lecturer`;
}

// ============================================
// Routes
// ============================================

/**
 * POST /api/study-help/chat
 * Send a message and get an AI response with citations.
 * Supports streaming via SSE.
 */
studyHelpChatRouter.post('/', async (c) => {
  const sessionToken = getCookie(c, COOKIE_NAME);
  const user = await getUserFromSession(sessionToken);

  if (!user) {
    return c.json({
      success: false,
      error: { code: 'NOT_AUTHENTICATED', message: 'Please log in' },
    }, 401);
  }

  try {
    const body = await c.req.json();
    const { canvasCourseId, message, courseName: clientCourseName, stream: wantsStream } = body;

    if (!canvasCourseId || !message) {
      return c.json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'canvasCourseId and message are required' },
      }, 400);
    }

    // Verify the user has this course
    const [userCourse] = await db
      .select()
      .from(studyHelpUserCourses)
      .where(
        and(
          eq(studyHelpUserCourses.userId, user.id),
          eq(studyHelpUserCourses.canvasCourseId, canvasCourseId),
          eq(studyHelpUserCourses.isActive, true)
        )
      )
      .limit(1);

    // Allow chat even without formal enrollment (user might be using local course list)
    const courseName = userCourse?.courseName || clientCourseName || `Course ${canvasCourseId}`;

    // Save the user message
    await db.insert(studyHelpChatMessages).values({
      userId: user.id,
      canvasCourseId,
      role: 'user',
      content: message,
    });

    // Get recent chat history
    const history = await db
      .select()
      .from(studyHelpChatMessages)
      .where(
        and(
          eq(studyHelpChatMessages.userId, user.id),
          eq(studyHelpChatMessages.canvasCourseId, canvasCourseId)
        )
      )
      .orderBy(desc(studyHelpChatMessages.createdAt))
      .limit(MAX_HISTORY_MESSAGES);

    // Reverse to get chronological order (we fetched desc)
    const chronologicalHistory = history.reverse();

    // Gather course context (materials, transcripts)
    const { context, sources } = await gatherCourseContext(canvasCourseId);

    // Build messages for Claude
    const systemPrompt = buildSystemPrompt(courseName, context, sources);
    const claudeMessages = chronologicalHistory.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    if (wantsStream) {
      // Streaming response via SSE
      return streamSSE(c, async (stream) => {
        let fullResponse = '';
        
        try {
          const response = anthropic.messages.stream({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            system: systemPrompt,
            messages: claudeMessages,
          });

          for await (const event of response) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              const text = event.delta.text;
              fullResponse += text;
              await stream.writeSSE({
                data: JSON.stringify({ type: 'delta', text }),
              });
            }
          }

          // Extract citations from the response
          const citations = extractCitations(fullResponse, sources);

          // Save the assistant response
          await db.insert(studyHelpChatMessages).values({
            userId: user.id,
            canvasCourseId,
            role: 'assistant',
            content: fullResponse,
            citations,
          });

          // Send final event with citations
          await stream.writeSSE({
            data: JSON.stringify({
              type: 'done',
              citations,
              sources: sources.map((s) => ({ name: s.name, url: s.url, type: s.type })),
            }),
          });
        } catch (err) {
          console.error('[ClassGPT] Stream error:', err);
          await stream.writeSSE({
            data: JSON.stringify({
              type: 'error',
              message: err instanceof Error ? err.message : 'Stream failed',
            }),
          });
        }
      });
    }

    // Non-streaming response
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: claudeMessages,
    });

    const assistantContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    // Extract citations from the response
    const citations = extractCitations(assistantContent, sources);

    // Save the assistant response
    await db.insert(studyHelpChatMessages).values({
      userId: user.id,
      canvasCourseId,
      role: 'assistant',
      content: assistantContent,
      citations,
    });

    return c.json({
      success: true,
      data: {
        response: assistantContent,
        citations,
        sources: sources.map((s) => ({ name: s.name, url: s.url, type: s.type })),
        model: response.model,
      },
    });
  } catch (error) {
    console.error('[ClassGPT] Chat error:', error);
    return c.json({
      success: false,
      error: {
        code: 'CHAT_ERROR',
        message: error instanceof Error ? error.message : 'Failed to generate response',
      },
    }, 500);
  }
});

/**
 * GET /api/study-help/chat/history/:canvasCourseId
 * Get chat history for a course
 */
studyHelpChatRouter.get('/history/:canvasCourseId', async (c) => {
  const sessionToken = getCookie(c, COOKIE_NAME);
  const user = await getUserFromSession(sessionToken);

  if (!user) {
    return c.json({
      success: false,
      error: { code: 'NOT_AUTHENTICATED', message: 'Please log in' },
    }, 401);
  }

  try {
    const canvasCourseId = c.req.param('canvasCourseId');
    const limit = parseInt(c.req.query('limit') || '100');

    const messages = await db
      .select()
      .from(studyHelpChatMessages)
      .where(
        and(
          eq(studyHelpChatMessages.userId, user.id),
          eq(studyHelpChatMessages.canvasCourseId, canvasCourseId)
        )
      )
      .orderBy(asc(studyHelpChatMessages.createdAt))
      .limit(limit);

    return c.json({
      success: true,
      data: {
        messages: messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          citations: msg.citations,
          createdAt: msg.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error('[ClassGPT] History error:', error);
    return c.json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch chat history' },
    }, 500);
  }
});

/**
 * DELETE /api/study-help/chat/history/:canvasCourseId
 * Clear chat history for a course
 */
studyHelpChatRouter.delete('/history/:canvasCourseId', async (c) => {
  const sessionToken = getCookie(c, COOKIE_NAME);
  const user = await getUserFromSession(sessionToken);

  if (!user) {
    return c.json({
      success: false,
      error: { code: 'NOT_AUTHENTICATED', message: 'Please log in' },
    }, 401);
  }

  try {
    const canvasCourseId = c.req.param('canvasCourseId');

    const result = await db
      .delete(studyHelpChatMessages)
      .where(
        and(
          eq(studyHelpChatMessages.userId, user.id),
          eq(studyHelpChatMessages.canvasCourseId, canvasCourseId)
        )
      );

    return c.json({
      success: true,
      data: { message: 'Chat history cleared' },
    });
  } catch (error) {
    console.error('[ClassGPT] Clear history error:', error);
    return c.json({
      success: false,
      error: { code: 'DELETE_ERROR', message: 'Failed to clear chat history' },
    }, 500);
  }
});

/**
 * GET /api/study-help/chat/sources/:canvasCourseId
 * Get available context sources for a course (for UI display)
 */
studyHelpChatRouter.get('/sources/:canvasCourseId', async (c) => {
  const sessionToken = getCookie(c, COOKIE_NAME);
  const user = await getUserFromSession(sessionToken);

  if (!user) {
    return c.json({
      success: false,
      error: { code: 'NOT_AUTHENTICATED', message: 'Please log in' },
    }, 401);
  }

  try {
    const canvasCourseId = c.req.param('canvasCourseId');
    const { sources } = await gatherCourseContext(canvasCourseId);

    return c.json({
      success: true,
      data: {
        sources: sources.map((s) => ({ name: s.name, url: s.url, type: s.type })),
        totalSources: sources.length,
      },
    });
  } catch (error) {
    console.error('[ClassGPT] Sources error:', error);
    return c.json({
      success: false,
      error: { code: 'FETCH_ERROR', message: 'Failed to fetch sources' },
    }, 500);
  }
});

// ============================================
// Citation extraction
// ============================================

/**
 * Extract citations from the AI response by matching [Source: "name"] patterns
 * against the available sources.
 */
function extractCitations(
  response: string,
  sources: Array<{ name: string; url: string | null; type: string; id: string }>
): Citation[] {
  const citations: Citation[] = [];
  const seen = new Set<string>();

  // Match [Source: "name"] or [Source: name] patterns
  const sourcePattern = /\[Source:\s*"?([^"\]]+)"?\]/gi;
  let match;

  while ((match = sourcePattern.exec(response)) !== null) {
    const citedName = match[1].trim();
    if (seen.has(citedName.toLowerCase())) continue;
    seen.add(citedName.toLowerCase());

    // Find matching source
    const source = sources.find(
      (s) => s.name.toLowerCase().includes(citedName.toLowerCase()) ||
             citedName.toLowerCase().includes(s.name.toLowerCase())
    );

    citations.push({
      name: source?.name || citedName,
      url: source?.url || null,
      type: source?.type || 'unknown',
    });
  }

  // Also check if any source names appear naturally in the response
  for (const source of sources) {
    if (seen.has(source.name.toLowerCase())) continue;
    if (response.includes(source.name)) {
      seen.add(source.name.toLowerCase());
      citations.push({
        name: source.name,
        url: source.url,
        type: source.type,
      });
    }
  }

  return citations;
}

export { studyHelpChatRouter };

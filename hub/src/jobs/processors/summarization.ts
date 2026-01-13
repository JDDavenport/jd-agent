/**
 * JD Agent - Summarization Job Processor
 *
 * Handles summarization of transcripts using Ollama (local LLM):
 * 1. Get transcript from database
 * 2. Generate structured summary
 * 3. Extract: key points, decisions, commitments, questions, deadlines
 * 4. Store summary in database
 * 5. Queue task extraction job
 */

import { Job } from 'bullmq';
import { db } from '../../db/client';
import { recordings, transcripts, recordingSummaries, vaultEntries } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { addTaskExtractionJob } from '../queue';
import type { SummarizationJobData } from '../queue';
import { detectClass, createClassVaultEntry } from '../../services/class-detection-service';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';

// ============================================
// Summarization Prompts
// ============================================

const CLASS_SUMMARY_PROMPT = `You are an expert academic assistant. Analyze this class lecture transcript and provide a structured summary.

Extract the following:
1. **Summary**: A 2-3 paragraph overview of the lecture content
2. **Key Concepts**: List the main topics and concepts covered
3. **Important Points**: Bullet points of the most important information
4. **Deadlines Mentioned**: Any assignments, exams, or due dates mentioned (with dates if given)
5. **Questions Raised**: Any questions asked by the professor or that you should follow up on
6. **Action Items**: Any tasks or homework mentioned

Format your response as JSON:
{
  "summary": "...",
  "keyPoints": ["point 1", "point 2", ...],
  "topicsCovered": ["topic 1", "topic 2", ...],
  "deadlinesMentioned": [{"description": "...", "date": "YYYY-MM-DD or null"}],
  "questions": ["question 1", ...],
  "actionItems": ["action 1", ...]
}`;

const MEETING_SUMMARY_PROMPT = `You are an expert meeting assistant. Analyze this meeting transcript and provide a structured summary.

Extract the following:
1. **Summary**: A concise overview of what was discussed
2. **Key Decisions**: Any decisions that were made
3. **Commitments**: Who committed to do what (format: "Person: commitment")
4. **Action Items**: Tasks that need to be done
5. **Follow-ups Needed**: Items requiring follow-up
6. **Questions/Open Items**: Unresolved questions or items

Format your response as JSON:
{
  "summary": "...",
  "keyPoints": ["point 1", "point 2", ...],
  "decisions": ["decision 1", ...],
  "commitments": [{"person": "Name", "commitment": "What they committed to", "dueDate": "YYYY-MM-DD or null"}],
  "questions": ["question 1", ...],
  "actionItems": ["action 1", ...]
}`;

const CONVERSATION_SUMMARY_PROMPT = `You are a helpful assistant. Analyze this conversation transcript and provide a structured summary.

Extract the following:
1. **Summary**: Brief overview of the conversation
2. **Key Points**: Main topics discussed
3. **Commitments Made**: Any promises or commitments (by anyone)
4. **Follow-up Items**: Things that need to be followed up on
5. **People Mentioned**: Names of people referenced

Format your response as JSON:
{
  "summary": "...",
  "keyPoints": ["point 1", "point 2", ...],
  "commitments": [{"person": "Name", "commitment": "What they committed to", "dueDate": null}],
  "peopleMentioned": ["name 1", ...],
  "followUpItems": ["item 1", ...]
}`;

// ============================================
// Processor
// ============================================

export async function processSummarizationJob(job: Job<SummarizationJobData>): Promise<{
  success: boolean;
  summaryId?: string;
  error?: string;
}> {
  const { recordingId, transcriptId, recordingType, context } = job.data;

  console.log(`[Summarization] Processing transcript ${transcriptId} for recording ${recordingId} using Ollama (${OLLAMA_MODEL})`);

  // Check if Ollama is available
  try {
    const healthCheck = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!healthCheck.ok) {
      throw new Error('Ollama not responding');
    }
  } catch (e) {
    console.error('[Summarization] Ollama not available at', OLLAMA_URL);
    return { success: false, error: `Ollama not available. Start it with: ollama serve` };
  }

  try {
    // Update recording status
    await db.update(recordings)
      .set({ status: 'summarizing' })
      .where(eq(recordings.id, recordingId));

    // Get transcript
    const [transcript] = await db
      .select()
      .from(transcripts)
      .where(eq(transcripts.id, transcriptId))
      .limit(1);

    if (!transcript) {
      throw new Error('Transcript not found');
    }

    // Select prompt based on recording type
    let systemPrompt: string;
    switch (recordingType) {
      case 'class':
        systemPrompt = CLASS_SUMMARY_PROMPT;
        break;
      case 'meeting':
        systemPrompt = MEETING_SUMMARY_PROMPT;
        break;
      default:
        systemPrompt = CONVERSATION_SUMMARY_PROMPT;
    }

    // Call Ollama (local LLM)
    const prompt = `${systemPrompt}

IMPORTANT: Respond ONLY with valid JSON. No other text, no markdown code blocks, just the JSON object.

Here is the transcript:

${transcript.fullText}`;

    console.log(`[Summarization] Sending to Ollama (transcript length: ${transcript.fullText.length} chars)`);

    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 4000,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama error: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    let content = result.response;

    if (!content) {
      throw new Error('No response from Ollama');
    }

    // Clean up response - extract JSON if wrapped in markdown
    content = content.trim();
    if (content.startsWith('```json')) {
      content = content.slice(7);
    }
    if (content.startsWith('```')) {
      content = content.slice(3);
    }
    if (content.endsWith('```')) {
      content = content.slice(0, -3);
    }
    content = content.trim();

    // Parse JSON response
    const parsed = JSON.parse(content);

    // Store summary
    const [summary] = await db.insert(recordingSummaries).values({
      recordingId,
      summary: parsed.summary || '',
      keyPoints: parsed.keyPoints || [],
      decisions: parsed.decisions || [],
      commitments: parsed.commitments || [],
      questions: parsed.questions || [],
      deadlinesMentioned: parsed.deadlinesMentioned || parsed.followUpItems || [],
      topicsCovered: parsed.topicsCovered || [],
      modelUsed: `ollama/${OLLAMA_MODEL}`,
    }).returning();

    // Update recording status
    await db.update(recordings)
      .set({ 
        status: 'complete',
        processedAt: new Date(),
      })
      .where(eq(recordings.id, recordingId));

    // Get recording details
    const [recording] = await db
      .select()
      .from(recordings)
      .where(eq(recordings.id, recordingId))
      .limit(1);

    const recordingDate = recording?.recordedAt || new Date();

    // Detect if this is a class recording
    const classDetection = detectClass(
      transcript.fullText,
      transcript.segments as { start: number; end: number; text: string; speaker?: number }[] | undefined
    );

    console.log(`[Summarization] Class detection: isClass=${classDetection.isClass}, confidence=${classDetection.confidence}, course=${classDetection.courseCode}`);

    // Create vault entry based on detection
    if (classDetection.isClass && classDetection.courseCode) {
      // Create structured class vault entry in MBA hierarchy
      const lectureTitle = parsed.topicsCovered?.[0] || parsed.keyPoints?.[0] || 'Lecture';

      await createClassVaultEntry({
        recordingId,
        courseCode: classDetection.courseCode,
        lectureDate: recordingDate,
        title: lectureTitle,
        summary: parsed.summary || '',
        keyPoints: parsed.keyPoints || [],
        transcript: transcript.fullText,
        topics: classDetection.topics,
      });

      // Update recording type to 'class' if detected
      await db.update(recordings)
        .set({ recordingType: 'class', context: classDetection.courseCode })
        .where(eq(recordings.id, recordingId));

      console.log(`[Summarization] Created class vault entry for ${classDetection.courseCode}`);
    } else {
      // Create generic vault entry for non-class recordings
      const title = `${recordingType === 'class' ? 'Lecture' : recordingType === 'meeting' ? 'Meeting' : 'Recording'} - ${context || 'General'} - ${recordingDate.toLocaleDateString()}`;

      await db.insert(vaultEntries).values({
        title,
        content: `# ${title}\n\n## Summary\n${parsed.summary}\n\n## Key Points\n${(parsed.keyPoints || []).map((p: string) => `- ${p}`).join('\n')}\n\n## Full Transcript\n${transcript.fullText}`,
        contentType: recordingType === 'class' ? 'lecture' : 'meeting',
        context: context || 'General',
        tags: [recordingType, 'recording', 'auto-generated'],
        source: 'plaud',
        sourceRef: `recording:${recordingId}`,
        recordingId,
        sourceDate: recordingDate,
      });
    }

    // Queue task extraction if there are commitments or action items
    const hasActionableItems = 
      (parsed.commitments && parsed.commitments.length > 0) ||
      (parsed.actionItems && parsed.actionItems.length > 0) ||
      (parsed.deadlinesMentioned && parsed.deadlinesMentioned.length > 0);

    if (hasActionableItems) {
      await addTaskExtractionJob({
        recordingId,
        summaryId: summary.id,
        source: 'recording',
        context,
      });
      console.log(`[Summarization] Queued task extraction for ${recordingId}`);
    }

    console.log(`[Summarization] Created summary ${summary.id} for recording ${recordingId}`);

    return {
      success: true,
      summaryId: summary.id,
    };
  } catch (error) {
    console.error(`[Summarization] Failed for ${recordingId}:`, error);

    // Update recording with error
    await db.update(recordings)
      .set({
        status: 'failed',
        errorMessage: String(error),
      })
      .where(eq(recordings.id, recordingId));

    return {
      success: false,
      error: String(error),
    };
  }
}

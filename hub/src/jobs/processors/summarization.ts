/**
 * JD Agent - Summarization Job Processor
 * 
 * Handles summarization of transcripts using Claude/OpenAI:
 * 1. Get transcript from database
 * 2. Generate structured summary
 * 3. Extract: key points, decisions, commitments, questions, deadlines
 * 4. Store summary in database
 * 5. Queue task extraction job
 */

import { Job } from 'bullmq';
import OpenAI from 'openai';
import { db } from '../../db/client';
import { recordings, transcripts, recordingSummaries, vaultEntries } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { addTaskExtractionJob } from '../queue';
import type { SummarizationJobData } from '../queue';

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
  
  console.log(`[Summarization] Processing transcript ${transcriptId} for recording ${recordingId}`);

  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    console.error('[Summarization] OPENAI_API_KEY not configured');
    return { success: false, error: 'OpenAI not configured' };
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

    // Call OpenAI
    const openai = new OpenAI({ apiKey: openaiApiKey });
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Here is the transcript:\n\n${transcript.fullText}` },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 4000,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

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
      modelUsed: 'gpt-4-turbo-preview',
    }).returning();

    // Update recording status
    await db.update(recordings)
      .set({ 
        status: 'complete',
        processedAt: new Date(),
      })
      .where(eq(recordings.id, recordingId));

    // Create vault entry for the recording
    const [recording] = await db
      .select()
      .from(recordings)
      .where(eq(recordings.id, recordingId))
      .limit(1);

    const recordingDate = recording?.recordedAt || new Date();
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

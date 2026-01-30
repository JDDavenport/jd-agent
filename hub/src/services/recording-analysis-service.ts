/**
 * Recording Analysis Service
 *
 * Analyzes recording transcripts to generate summaries and extract action items.
 * Uses LLM providers for AI-powered analysis.
 */

import { getLLMProviderChain, type LLMMessage } from '../lib/providers';
import { db } from '../db/client';
import { transcripts, recordings } from '../db/schema';
import { eq } from 'drizzle-orm';

// ============================================
// Types
// ============================================

export interface ExtractedTask {
  title: string;
  description?: string;
  assignee?: string;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
  context: string; // The quote from transcript where task was mentioned
}

export interface RecordingSummary {
  overview: string;
  keyPoints: string[];
  participants?: string[];
  topics?: string[];
}

export interface RecordingAnalysis {
  summary: RecordingSummary;
  extractedTasks: ExtractedTask[];
  analyzedAt: string;
}

// ============================================
// Service
// ============================================

export class RecordingAnalysisService {
  private llm = getLLMProviderChain();

  /**
   * Analyze a recording transcript and save to database
   */
  async analyzeRecording(recordingId: string, forceReanalyze = false): Promise<RecordingAnalysis> {
    // Get transcript
    const [transcript] = await db
      .select()
      .from(transcripts)
      .where(eq(transcripts.recordingId, recordingId))
      .limit(1);

    if (!transcript) {
      throw new Error('No transcript found for this recording');
    }

    // Return cached analysis if exists and not forcing reanalyze
    if (!forceReanalyze && transcript.summary && transcript.analyzedAt) {
      return {
        summary: transcript.summary as RecordingSummary,
        extractedTasks: (transcript.extractedTasks as ExtractedTask[]) || [],
        analyzedAt: transcript.analyzedAt.toISOString(),
      };
    }

    // Get recording for context
    const [recording] = await db
      .select()
      .from(recordings)
      .where(eq(recordings.id, recordingId))
      .limit(1);

    const fullText = transcript.fullText;
    if (!fullText || fullText.length < 50) {
      throw new Error('Transcript is too short to analyze');
    }

    // Truncate if too long (roughly 100k chars = ~25k tokens)
    const truncatedText = fullText.length > 100000 ? fullText.slice(0, 100000) + '\n\n[Transcript truncated...]' : fullText;

    // Generate summary and extract tasks in parallel
    const [summary, tasks] = await Promise.all([
      this.generateSummary(truncatedText, recording?.originalFilename || 'Recording'),
      this.extractTasks(truncatedText),
    ]);

    const analyzedAt = new Date();

    // Save to database
    await db
      .update(transcripts)
      .set({
        summary: summary as unknown as Record<string, unknown>,
        extractedTasks: tasks as unknown as Record<string, unknown>[],
        analyzedAt,
      })
      .where(eq(transcripts.id, transcript.id));

    return {
      summary,
      extractedTasks: tasks,
      analyzedAt: analyzedAt.toISOString(),
    };
  }

  /**
   * Generate a summary of the transcript
   */
  private async generateSummary(transcript: string, title: string): Promise<RecordingSummary> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `You are an expert at summarizing meeting transcripts and conversations.
Your task is to analyze the transcript and provide a clear, actionable summary.

Respond in JSON format with this structure:
{
  "overview": "2-3 sentence high-level summary",
  "keyPoints": ["key point 1", "key point 2", ...],
  "participants": ["name or role if identifiable"],
  "topics": ["main topic 1", "main topic 2", ...]
}

Focus on:
- Main discussion points and decisions
- Any agreements or conclusions reached
- Important information shared
- Action items mentioned (just note them, don't detail)`,
      },
      {
        role: 'user',
        content: `Please summarize this transcript titled "${title}":\n\n${transcript}`,
      },
    ];

    const response = await this.llm.chat(messages, undefined, {
      temperature: 0.3,
      maxTokens: 2000,
    });

    try {
      // Extract JSON from response
      const jsonMatch = response.content?.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      return JSON.parse(jsonMatch[0]) as RecordingSummary;
    } catch (error) {
      console.error('[RecordingAnalysis] Failed to parse summary:', error);
      // Return a basic summary if parsing fails
      return {
        overview: response.content || 'Summary generation failed',
        keyPoints: [],
      };
    }
  }

  /**
   * Extract action items and tasks from the transcript
   */
  private async extractTasks(transcript: string): Promise<ExtractedTask[]> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `You are an expert at identifying action items and tasks from meeting transcripts.
Your task is to extract any tasks, to-dos, commitments, or action items mentioned.

Look for phrases like:
- "I'll do...", "I need to...", "We should..."
- "Can you...", "Please...", "Make sure to..."
- "Let's...", "We have to...", "The next step is..."
- "Action item:", "TODO:", "Follow up on..."
- Commitments or promises made
- Deadlines mentioned

Respond in JSON format with an array:
[
  {
    "title": "Brief task title (5-10 words)",
    "description": "More detail if available",
    "assignee": "Who should do it (if mentioned)",
    "priority": "low/medium/high based on urgency",
    "dueDate": "If a deadline is mentioned (ISO format)",
    "context": "The exact quote from transcript where this was mentioned"
  }
]

If no tasks are found, return an empty array [].
Be conservative - only extract clear action items, not general discussion topics.`,
      },
      {
        role: 'user',
        content: `Please extract action items from this transcript:\n\n${transcript}`,
      },
    ];

    const response = await this.llm.chat(messages, undefined, {
      temperature: 0.2,
      maxTokens: 3000,
    });

    try {
      // Extract JSON array from response
      const jsonMatch = response.content?.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        return [];
      }
      const tasks = JSON.parse(jsonMatch[0]) as ExtractedTask[];
      // Validate and clean tasks
      return tasks.filter(t => t.title && t.title.length > 0).slice(0, 20); // Max 20 tasks
    } catch (error) {
      console.error('[RecordingAnalysis] Failed to parse tasks:', error);
      return [];
    }
  }
}

// Singleton instance
export const recordingAnalysisService = new RecordingAnalysisService();

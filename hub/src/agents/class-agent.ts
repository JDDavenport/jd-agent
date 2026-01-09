/**
 * JD Agent - Class Sub-Agent
 * 
 * Specialized agent for each class/course:
 * - Trained on syllabus, lectures, notes, readings
 * - Can answer questions about course material
 * - Tracks assignments and deadlines
 * - Knows professor's expectations
 */

import OpenAI from 'openai';
import { db } from '../db/client';
import { classes, vaultEntries, tasks, recordings, transcripts, recordingSummaries } from '../db/schema';
import { eq, and, desc, ilike } from 'drizzle-orm';

// ============================================
// Types
// ============================================

export interface ClassContext {
  id: string;
  name: string;
  code: string | null;
  professor: string | null;
  semester: string | null;
  lectures: Array<{
    title: string;
    content: string;
    date?: Date;
  }>;
  assignments: Array<{
    title: string;
    description: string;
    dueDate: Date | null;
    status: string;
  }>;
  notes: Array<{
    title: string;
    content: string;
    date?: Date;
  }>;
}

export interface ClassAgentResponse {
  answer: string;
  sources: Array<{
    type: 'lecture' | 'note' | 'assignment' | 'syllabus';
    title: string;
    date?: Date;
  }>;
  relatedAssignments?: Array<{
    title: string;
    dueDate: Date | null;
  }>;
}

// ============================================
// Class Agent
// ============================================

export class ClassAgent {
  private classId: string;
  private className: string;
  private classCode: string | null;
  private openai: OpenAI | null = null;

  constructor(classData: { id: string; name: string; code: string | null }) {
    this.classId = classData.id;
    this.className = classData.name;
    this.classCode = classData.code;

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  /**
   * Get full class context for the agent
   */
  async getContext(): Promise<ClassContext> {
    // Get class info
    const [classInfo] = await db
      .select()
      .from(classes)
      .where(eq(classes.id, this.classId))
      .limit(1);

    // Get lectures and notes from vault
    const vaultResults = await db
      .select()
      .from(vaultEntries)
      .where(eq(vaultEntries.context, this.className))
      .orderBy(desc(vaultEntries.sourceDate))
      .limit(50);

    // Get assignments
    const assignmentResults = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.context, this.className),
          eq(tasks.source, 'canvas')
        )
      )
      .orderBy(desc(tasks.dueDate))
      .limit(30);

    // Get recording summaries
    const recordingResults = await db
      .select({
        recording: recordings,
        summary: recordingSummaries,
      })
      .from(recordings)
      .leftJoin(recordingSummaries, eq(recordingSummaries.recordingId, recordings.id))
      .where(eq(recordings.context, this.className))
      .orderBy(desc(recordings.recordedAt))
      .limit(20);

    // Build context
    const lectures = recordingResults
      .filter(r => r.summary)
      .map(r => ({
        title: `Lecture - ${r.recording.recordedAt?.toLocaleDateString() || 'Unknown date'}`,
        content: r.summary?.summary || '',
        date: r.recording.recordedAt || undefined,
      }));

    const notes = vaultResults.map(v => ({
      title: v.title,
      content: v.content || '',
      date: v.sourceDate || undefined,
    }));

    const assignments = assignmentResults.map(a => ({
      title: a.title,
      description: a.description || '',
      dueDate: a.dueDate,
      status: a.status,
    }));

    return {
      id: this.classId,
      name: this.className,
      code: classInfo?.code || this.classCode,
      professor: classInfo?.professor || null,
      semester: classInfo?.semester || null,
      lectures,
      assignments,
      notes,
    };
  }

  /**
   * Ask a question about the class
   */
  async query(question: string): Promise<ClassAgentResponse> {
    if (!this.openai) {
      return {
        answer: 'Class agent not configured. Please set OPENAI_API_KEY.',
        sources: [],
      };
    }

    // Get relevant context
    const context = await this.getContext();
    
    // Search for relevant content
    const relevantContent = await this.findRelevantContent(question, context);

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(context, relevantContent);

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
        max_tokens: 2000,
      });

      const answer = response.choices[0].message.content || 'I could not find an answer.';

      // Extract sources used
      const sources = relevantContent.map(c => ({
        type: c.type as 'lecture' | 'note' | 'assignment' | 'syllabus',
        title: c.title,
        date: c.date,
      }));

      // Find related assignments
      const relatedAssignments = context.assignments
        .filter(a => 
          question.toLowerCase().includes(a.title.toLowerCase()) ||
          a.title.toLowerCase().includes(question.toLowerCase().split(' ')[0])
        )
        .slice(0, 3)
        .map(a => ({
          title: a.title,
          dueDate: a.dueDate,
        }));

      return {
        answer,
        sources,
        relatedAssignments: relatedAssignments.length > 0 ? relatedAssignments : undefined,
      };
    } catch (error) {
      console.error(`[ClassAgent] Query failed for ${this.className}:`, error);
      return {
        answer: `Error processing question: ${error}`,
        sources: [],
      };
    }
  }

  /**
   * Find content relevant to the question
   */
  private async findRelevantContent(
    question: string,
    context: ClassContext
  ): Promise<Array<{ type: string; title: string; content: string; date?: Date }>> {
    const questionLower = question.toLowerCase();
    const results: Array<{ type: string; title: string; content: string; date?: Date; score: number }> = [];

    // Score lectures
    for (const lecture of context.lectures) {
      const score = this.scoreRelevance(questionLower, lecture.title, lecture.content);
      if (score > 0.1) {
        results.push({
          type: 'lecture',
          title: lecture.title,
          content: lecture.content,
          date: lecture.date,
          score,
        });
      }
    }

    // Score notes
    for (const note of context.notes) {
      const score = this.scoreRelevance(questionLower, note.title, note.content);
      if (score > 0.1) {
        results.push({
          type: 'note',
          title: note.title,
          content: note.content,
          date: note.date,
          score,
        });
      }
    }

    // Score assignments
    for (const assignment of context.assignments) {
      const score = this.scoreRelevance(questionLower, assignment.title, assignment.description);
      if (score > 0.1) {
        results.push({
          type: 'assignment',
          title: assignment.title,
          content: `Due: ${assignment.dueDate?.toLocaleDateString() || 'Unknown'}\nStatus: ${assignment.status}\n\n${assignment.description}`,
          score,
        });
      }
    }

    // Sort by score and take top 5
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 5).map(({ type, title, content, date }) => ({
      type,
      title,
      content,
      date,
    }));
  }

  /**
   * Score relevance of content to question
   */
  private scoreRelevance(question: string, title: string, content: string): number {
    const titleLower = title.toLowerCase();
    const contentLower = content.toLowerCase();
    const words = question.split(/\s+/).filter(w => w.length > 2);

    let score = 0;

    for (const word of words) {
      if (titleLower.includes(word)) score += 0.3;
      if (contentLower.includes(word)) score += 0.1;
    }

    // Boost for exact phrase matches
    if (contentLower.includes(question)) score += 0.5;

    return Math.min(score, 1.0);
  }

  /**
   * Build system prompt with context
   */
  private buildSystemPrompt(
    context: ClassContext,
    relevantContent: Array<{ type: string; title: string; content: string }>
  ): string {
    const contentSection = relevantContent
      .map(c => `## ${c.type.toUpperCase()}: ${c.title}\n${c.content}`)
      .join('\n\n---\n\n');

    const assignmentList = context.assignments
      .filter(a => a.status !== 'done')
      .slice(0, 5)
      .map(a => `- ${a.title} (Due: ${a.dueDate?.toLocaleDateString() || 'Unknown'})`)
      .join('\n');

    return `You are an expert teaching assistant for the course "${context.name}" (${context.code || 'No code'}).

COURSE INFORMATION:
- Professor: ${context.professor || 'Unknown'}
- Semester: ${context.semester || 'Current'}

YOUR ROLE:
1. Answer questions about course material accurately
2. Reference specific lectures or notes when relevant
3. Help with understanding concepts
4. Remind about upcoming assignments when relevant

CURRENT ASSIGNMENTS:
${assignmentList || 'No pending assignments'}

RELEVANT COURSE MATERIALS:
${contentSection || 'No specific materials found for this question.'}

INSTRUCTIONS:
- Be thorough but concise
- Cite which lecture or material you're drawing from
- If you don't have enough information, say so
- If the question relates to an assignment, mention the due date
- Don't make up information that isn't in the materials`;
  }

  /**
   * Get class summary
   */
  async getSummary(): Promise<{
    name: string;
    code: string | null;
    professor: string | null;
    lectureCount: number;
    noteCount: number;
    pendingAssignments: number;
    nextDeadline?: { title: string; dueDate: Date };
  }> {
    const context = await this.getContext();
    
    const pendingAssignments = context.assignments.filter(a => a.status !== 'done');
    const nextAssignment = pendingAssignments
      .filter(a => a.dueDate && a.dueDate > new Date())
      .sort((a, b) => (a.dueDate?.getTime() || 0) - (b.dueDate?.getTime() || 0))[0];

    return {
      name: context.name,
      code: context.code,
      professor: context.professor,
      lectureCount: context.lectures.length,
      noteCount: context.notes.length,
      pendingAssignments: pendingAssignments.length,
      nextDeadline: nextAssignment?.dueDate ? {
        title: nextAssignment.title,
        dueDate: nextAssignment.dueDate,
      } : undefined,
    };
  }
}

// ============================================
// Class Agent Manager
// ============================================

class ClassAgentManager {
  private agents: Map<string, ClassAgent> = new Map();

  /**
   * Get or create a class agent
   */
  async getAgent(classId: string): Promise<ClassAgent | null> {
    // Check cache
    if (this.agents.has(classId)) {
      return this.agents.get(classId)!;
    }

    // Load class from database
    const [classData] = await db
      .select()
      .from(classes)
      .where(eq(classes.id, classId))
      .limit(1);

    if (!classData) {
      return null;
    }

    // Create and cache agent
    const agent = new ClassAgent({
      id: classData.id,
      name: classData.name,
      code: classData.code,
    });

    this.agents.set(classId, agent);
    return agent;
  }

  /**
   * Get agent by class name or code
   */
  async getAgentByName(nameOrCode: string): Promise<ClassAgent | null> {
    const [classData] = await db
      .select()
      .from(classes)
      .where(
        ilike(classes.name, `%${nameOrCode}%`)
      )
      .limit(1);

    if (!classData) {
      // Try by code
      const [byCode] = await db
        .select()
        .from(classes)
        .where(ilike(classes.code, `%${nameOrCode}%`))
        .limit(1);

      if (!byCode) return null;
      return this.getAgent(byCode.id);
    }

    return this.getAgent(classData.id);
  }

  /**
   * List all available class agents
   */
  async listAgents(): Promise<Array<{
    id: string;
    name: string;
    code: string | null;
    status: string;
  }>> {
    const allClasses = await db
      .select()
      .from(classes)
      .where(eq(classes.status, 'active'));

    return allClasses.map(c => ({
      id: c.id,
      name: c.name,
      code: c.code,
      status: c.status,
    }));
  }

  /**
   * Clear agent cache
   */
  clearCache(): void {
    this.agents.clear();
  }
}

// ============================================
// Singleton instance
// ============================================

export const classAgentManager = new ClassAgentManager();

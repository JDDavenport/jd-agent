/**
 * JD Agent - Task Extraction Job Processor
 * 
 * Extracts tasks from recording summaries, emails, and notes:
 * - Commitments by Human JD → Create tasks
 * - Commitments by others → Create "waiting for" items
 * - Deadlines mentioned → Cross-reference with existing tasks
 */

import { Job } from 'bullmq';
import { db } from '../../db/client';
import { tasks, recordingSummaries, recordings } from '../../db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import type { TaskExtractionJobData } from '../queue';

interface Commitment {
  person: string;
  commitment: string;
  dueDate?: string | null;
}

interface Deadline {
  description: string;
  date?: string | null;
}

export async function processTaskExtractionJob(job: Job<TaskExtractionJobData>): Promise<{
  success: boolean;
  tasksCreated: number;
  waitingForCreated: number;
  error?: string;
}> {
  const { recordingId, summaryId, source, context } = job.data;
  
  console.log(`[TaskExtraction] Processing from ${source}: ${recordingId || summaryId}`);

  let tasksCreated = 0;
  let waitingForCreated = 0;

  try {
    let commitments: Commitment[] = [];
    let actionItems: string[] = [];
    let deadlines: Deadline[] = [];

    // Get data from summary if available
    if (summaryId) {
      const [summary] = await db
        .select()
        .from(recordingSummaries)
        .where(eq(recordingSummaries.id, summaryId))
        .limit(1);

      if (summary) {
        commitments = (summary.commitments as Commitment[]) || [];
        deadlines = (summary.deadlinesMentioned as Deadline[]) || [];
        // Key points might contain action items
        actionItems = (summary.keyPoints || []).filter((p: string) => 
          p.toLowerCase().includes('need to') ||
          p.toLowerCase().includes('should') ||
          p.toLowerCase().includes('must') ||
          p.toLowerCase().includes('action:')
        );
      }
    }

    // Process commitments - create tasks or waiting-for items
    for (const commitment of commitments) {
      const isMyCommitment = 
        commitment.person.toLowerCase().includes('jd') ||
        commitment.person.toLowerCase().includes('i ') ||
        commitment.person.toLowerCase().includes('me') ||
        commitment.person.toLowerCase() === 'self';

      // Parse due date if available
      let dueDate: Date | null = null;
      if (commitment.dueDate) {
        try {
          dueDate = new Date(commitment.dueDate);
          if (isNaN(dueDate.getTime())) {
            dueDate = null;
          }
        } catch {
          dueDate = null;
        }
      }

      if (isMyCommitment) {
        // Create a task
        await db.insert(tasks).values({
          title: commitment.commitment,
          description: `Extracted from ${source}${recordingId ? ` (recording: ${recordingId})` : ''}`,
          status: 'inbox',
          priority: 0,
          dueDate,
          dueDateIsHard: !!dueDate,
          source: source === 'recording' ? 'recording' : source === 'email' ? 'email' : 'manual',
          sourceRef: recordingId ? `recording:${recordingId}` : undefined,
          context: context || 'General',
        });
        tasksCreated++;
        console.log(`[TaskExtraction] Created task: ${commitment.commitment}`);
      } else {
        // Create a waiting-for item
        await db.insert(tasks).values({
          title: `Waiting for: ${commitment.person} - ${commitment.commitment}`,
          description: `Extracted from ${source}${recordingId ? ` (recording: ${recordingId})` : ''}`,
          status: 'waiting',
          priority: 0,
          dueDate,
          source: source === 'recording' ? 'recording' : source === 'email' ? 'email' : 'manual',
          sourceRef: recordingId ? `recording:${recordingId}` : undefined,
          context: context || 'General',
          waitingFor: commitment.person,
        });
        waitingForCreated++;
        console.log(`[TaskExtraction] Created waiting-for: ${commitment.person}`);
      }
    }

    // Process action items (usually my own tasks)
    for (const item of actionItems) {
      await db.insert(tasks).values({
        title: item.replace(/^action:\s*/i, '').trim(),
        description: `Extracted from ${source}${recordingId ? ` (recording: ${recordingId})` : ''}`,
        status: 'inbox',
        priority: 0,
        source: source === 'recording' ? 'recording' : source === 'email' ? 'email' : 'manual',
        sourceRef: recordingId ? `recording:${recordingId}` : undefined,
        context: context || 'General',
      });
      tasksCreated++;
    }

    // Process deadlines - check if they match existing tasks or create new ones
    for (const deadline of deadlines) {
      if (!deadline.date) continue;

      let deadlineDate: Date;
      try {
        deadlineDate = new Date(deadline.date);
        if (isNaN(deadlineDate.getTime())) continue;
      } catch {
        continue;
      }

      // Check if we already have a task with similar due date and context
      const existingTasks = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.context, context || 'General'),
            gte(tasks.dueDate, new Date(deadlineDate.getTime() - 24 * 60 * 60 * 1000)),
            lte(tasks.dueDate, new Date(deadlineDate.getTime() + 24 * 60 * 60 * 1000))
          )
        );

      if (existingTasks.length === 0) {
        // Create new task for this deadline
        await db.insert(tasks).values({
          title: deadline.description,
          description: `Deadline mentioned in ${source}`,
          status: 'upcoming',
          priority: 1,
          dueDate: deadlineDate,
          dueDateIsHard: true,
          source: source === 'recording' ? 'recording' : source === 'email' ? 'email' : 'manual',
          sourceRef: recordingId ? `recording:${recordingId}` : undefined,
          context: context || 'General',
        });
        tasksCreated++;
        console.log(`[TaskExtraction] Created deadline task: ${deadline.description}`);
      }
    }

    console.log(`[TaskExtraction] Complete: ${tasksCreated} tasks, ${waitingForCreated} waiting-for items`);

    return {
      success: true,
      tasksCreated,
      waitingForCreated,
    };
  } catch (error) {
    console.error(`[TaskExtraction] Failed:`, error);
    return {
      success: false,
      tasksCreated,
      waitingForCreated,
      error: String(error),
    };
  }
}

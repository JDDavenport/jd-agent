/**
 * JD Agent - Recurrence Instance Generator
 *
 * Processes recurring tasks and generates next instances:
 * - Triggered when a recurring task is completed
 * - Uses rrule package to calculate next occurrence
 * - Creates child task with recurrenceParentId set to parent
 */

import { Job } from 'bullmq';
import { db } from '../../db/client';
import { tasks } from '../../db/schema';
import { eq, isNotNull, and, ne, isNull } from 'drizzle-orm';
import { RRule } from 'rrule';
import type { RecurrenceGenerateJobData } from '../queue';

export async function processRecurrenceGenerateJob(job: Job<RecurrenceGenerateJobData>): Promise<{
  success: boolean;
  taskId?: string;
  nextDueDate?: string;
  error?: string;
}> {
  const { taskId, trigger } = job.data;

  console.log(`[Recurrence] Processing for task ${taskId} (trigger: ${trigger})`);

  try {
    // Get the parent task
    const [parentTask] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!parentTask) {
      console.log(`[Recurrence] Task ${taskId} not found`);
      return { success: false, error: 'Task not found' };
    }

    if (!parentTask.recurrenceRule) {
      console.log(`[Recurrence] Task ${taskId} has no recurrence rule`);
      return { success: false, error: 'No recurrence rule' };
    }

    // Parse the RRULE and calculate next occurrence
    const rule = RRule.fromString(`RRULE:${parentTask.recurrenceRule}`);

    // Get next occurrence after today
    const now = new Date();
    const nextDates = rule.after(now, true);

    if (!nextDates) {
      console.log(`[Recurrence] No future occurrences for task ${taskId}`);
      return { success: true, taskId, error: 'No future occurrences' };
    }

    const nextDueDate = nextDates;

    // Check if we already have an active instance for this parent
    const existingInstance = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.recurrenceParentId, taskId),
          ne(tasks.status, 'done'),
          ne(tasks.status, 'archived')
        )
      )
      .limit(1);

    if (existingInstance.length > 0) {
      console.log(`[Recurrence] Active instance already exists for task ${taskId}`);
      return {
        success: true,
        taskId: existingInstance[0].id,
        nextDueDate: existingInstance[0].dueDate?.toISOString(),
      };
    }

    // Create the next instance
    const [newTask] = await db
      .insert(tasks)
      .values({
        title: parentTask.title,
        description: parentTask.description,
        status: 'inbox',
        priority: parentTask.priority,
        dueDate: nextDueDate,
        dueDateIsHard: parentTask.dueDateIsHard,
        source: parentTask.source,
        context: parentTask.context,
        timeEstimateMinutes: parentTask.timeEstimateMinutes,
        energyLevel: parentTask.energyLevel,
        projectId: parentTask.projectId,
        recurrenceRule: parentTask.recurrenceRule, // Keep the recurrence rule for future instances
        recurrenceParentId: taskId, // Link to parent
      })
      .returning();

    console.log(`[Recurrence] Created instance ${newTask.id} due ${nextDueDate.toISOString()}`);

    return {
      success: true,
      taskId: newTask.id,
      nextDueDate: nextDueDate.toISOString(),
    };
  } catch (error) {
    console.error(`[Recurrence] Failed:`, error);
    return {
      success: false,
      error: String(error),
    };
  }
}

/**
 * Batch process all recurring tasks that need instances generated
 * Called by daily cron job
 */
export async function processRecurrenceBatchJob(job: Job): Promise<{
  success: boolean;
  instancesCreated: number;
  errors: string[];
}> {
  console.log(`[Recurrence] Running batch process`);

  const instancesCreated: string[] = [];
  const errors: string[] = [];

  try {
    // Find all active recurring tasks (not completed, have recurrenceRule)
    const recurringTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          isNotNull(tasks.recurrenceRule),
          ne(tasks.status, 'done'),
          ne(tasks.status, 'archived'),
          isNull(tasks.recurrenceParentId) // Only process parent tasks
        )
      );

    console.log(`[Recurrence] Found ${recurringTasks.length} recurring tasks`);

    for (const task of recurringTasks) {
      try {
        // Check if we need to create an instance
        const existingInstance = await db
          .select()
          .from(tasks)
          .where(
            and(
              eq(tasks.recurrenceParentId, task.id),
              ne(tasks.status, 'done'),
              ne(tasks.status, 'archived')
            )
          )
          .limit(1);

        if (existingInstance.length > 0) {
          // Already have an active instance
          continue;
        }

        // Parse RRULE and get next occurrence
        const rule = RRule.fromString(`RRULE:${task.recurrenceRule}`);
        const now = new Date();
        const nextDate = rule.after(now, true);

        if (!nextDate) {
          continue; // No future occurrences
        }

        // Create instance
        const [newTask] = await db
          .insert(tasks)
          .values({
            title: task.title,
            description: task.description,
            status: 'inbox',
            priority: task.priority,
            dueDate: nextDate,
            dueDateIsHard: task.dueDateIsHard,
            source: task.source,
            context: task.context,
            timeEstimateMinutes: task.timeEstimateMinutes,
            energyLevel: task.energyLevel,
            projectId: task.projectId,
            recurrenceRule: task.recurrenceRule,
            recurrenceParentId: task.id,
          })
          .returning();

        instancesCreated.push(newTask.id);
        console.log(`[Recurrence] Created instance for "${task.title}" due ${nextDate.toISOString()}`);
      } catch (error) {
        errors.push(`Task ${task.id}: ${String(error)}`);
      }
    }

    console.log(`[Recurrence] Batch complete: ${instancesCreated.length} instances created`);

    return {
      success: true,
      instancesCreated: instancesCreated.length,
      errors,
    };
  } catch (error) {
    console.error(`[Recurrence] Batch failed:`, error);
    return {
      success: false,
      instancesCreated: 0,
      errors: [String(error)],
    };
  }
}

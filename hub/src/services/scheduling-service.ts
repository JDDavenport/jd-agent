/**
 * Scheduling Service
 *
 * Manages the connection between:
 * - Task scheduled times
 * - Google Calendar events
 *
 * Key concept: "Due Date" = when it must be done by
 *              "Scheduled Time" = when you plan to work on it
 */

import { db } from '../db/client';
import { tasks, calendarEvents } from '../db/schema';
import { eq, and, isNotNull, isNull, gte, lte } from 'drizzle-orm';
import { getGoogleCalendar } from '../integrations/google-calendar';

const googleCalendar = getGoogleCalendar();

export interface ScheduleTaskInput {
  taskId: string;
  startTime: Date;
  endTime?: Date; // If not provided, uses task's time estimate or defaults to 1 hour
  createCalendarEvent?: boolean;
}

export interface ScheduleResult {
  success: boolean;
  taskId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  calendarEventId?: string;
  error?: string;
}

class SchedulingService {
  /**
   * Schedule a task for a specific time
   */
  async scheduleTask(input: ScheduleTaskInput): Promise<ScheduleResult> {
    const { taskId, startTime, createCalendarEvent = true } = input;
    
    // Get the task
    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);
    
    if (!task) {
      return {
        success: false,
        taskId,
        scheduledStart: startTime,
        scheduledEnd: startTime,
        error: 'Task not found',
      };
    }

    // Calculate end time
    const durationMinutes = task.timeEstimateMinutes || 60; // Default 1 hour
    const endTime = input.endTime || new Date(startTime.getTime() + durationMinutes * 60 * 1000);

    let calendarEventId: string | undefined;

    // Create calendar event if requested
    if (createCalendarEvent && googleCalendar.isConfigured()) {
      try {
        const eventId = await googleCalendar.createEvent({
          title: `📋 ${task.title}`,
          description: task.description || `Task: ${task.title}\nContext: ${task.context}`,
          startTime: startTime,
          endTime: endTime,
        });
        
        if (eventId) {
          calendarEventId = eventId;
        }
      } catch (error) {
        console.error('[SchedulingService] Failed to create calendar event:', error);
      }
    }

    // Update task with scheduled time
    await db
      .update(tasks)
      .set({
        scheduledStart: startTime,
        scheduledEnd: endTime,
        calendarEventId: calendarEventId,
        status: 'today', // Move to today if scheduling
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    return {
      success: true,
      taskId,
      scheduledStart: startTime,
      scheduledEnd: endTime,
      calendarEventId,
    };
  }

  /**
   * Get scheduled tasks for a date range
   */
  async getScheduledTasks(startDate: Date, endDate: Date) {
    const scheduled = await db
      .select()
      .from(tasks)
      .where(
        and(
          isNotNull(tasks.scheduledStart),
          gte(tasks.scheduledStart, startDate),
          lte(tasks.scheduledStart, endDate)
        )
      )
      .orderBy(tasks.scheduledStart);

    return scheduled;
  }

  /**
   * Get today's scheduled tasks
   */
  async getTodaysSchedule() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.getScheduledTasks(today, tomorrow);
  }

  /**
   * Unschedule a task (remove calendar event, clear times)
   */
  async unscheduleTask(taskId: string): Promise<{ success: boolean; error?: string }> {
    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    // Delete calendar event if exists
    if (task.calendarEventId && googleCalendar.isConfigured()) {
      try {
        await googleCalendar.deleteEvent(task.calendarEventId);
      } catch (error) {
        console.error('[SchedulingService] Failed to delete calendar event:', error);
      }
    }

    // Clear scheduled times
    await db
      .update(tasks)
      .set({
        scheduledStart: null,
        scheduledEnd: null,
        calendarEventId: null,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    return { success: true };
  }

  /**
   * Reschedule a task to a new time
   */
  async rescheduleTask(
    taskId: string,
    newStartTime: Date,
    newEndTime?: Date
  ): Promise<ScheduleResult> {
    // First unschedule
    await this.unscheduleTask(taskId);
    
    // Then schedule with new time
    return this.scheduleTask({
      taskId,
      startTime: newStartTime,
      endTime: newEndTime,
    });
  }

  /**
   * Auto-schedule tasks before their due dates
   * Finds unscheduled tasks with due dates and suggests time blocks
   */
  async suggestSchedule(daysAhead: number = 7): Promise<Array<{
    task: typeof tasks.$inferSelect;
    suggestedStart: Date;
    suggestedEnd: Date;
    reason: string;
  }>> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    // Get unscheduled tasks with due dates
    const unscheduled = await db
      .select()
      .from(tasks)
      .where(
        and(
          isNotNull(tasks.dueDate),
          gte(tasks.dueDate, now),
          lte(tasks.dueDate, futureDate),
          isNull(tasks.scheduledStart)
        )
      )
      .orderBy(tasks.dueDate);

    const suggestions: Array<{
      task: typeof tasks.$inferSelect;
      suggestedStart: Date;
      suggestedEnd: Date;
      reason: string;
    }> = [];

    for (const task of unscheduled) {
      if (!task.dueDate) continue;

      // Suggest scheduling 1-2 days before due date
      const dueDate = new Date(task.dueDate);
      const suggestedDate = new Date(dueDate);
      suggestedDate.setDate(suggestedDate.getDate() - 1); // Day before due
      suggestedDate.setHours(9, 0, 0, 0); // 9 AM

      const duration = task.timeEstimateMinutes || 60;
      const suggestedEnd = new Date(suggestedDate.getTime() + duration * 60 * 1000);

      suggestions.push({
        task,
        suggestedStart: suggestedDate,
        suggestedEnd,
        reason: `Due ${dueDate.toLocaleDateString()}`,
      });
    }

    return suggestions;
  }

  /**
   * Sync all scheduled tasks to calendar
   */
  async syncAllToCalendar(): Promise<{ synced: number; errors: string[] }> {
    const errors: string[] = [];
    let synced = 0;

    const scheduled = await db
      .select()
      .from(tasks)
      .where(
        and(
          isNotNull(tasks.scheduledStart),
          isNull(tasks.calendarEventId)
        )
      );

    for (const task of scheduled) {
      if (!task.scheduledStart || !task.scheduledEnd) continue;

      try {
        const eventId = await googleCalendar.createEvent({
          title: `📋 ${task.title}`,
          description: `Task: ${task.title}\nContext: ${task.context}`,
          startTime: task.scheduledStart,
          endTime: task.scheduledEnd,
        });

        if (eventId) {
          await db
            .update(tasks)
            .set({ calendarEventId: eventId })
            .where(eq(tasks.id, task.id));
          synced++;
        }
      } catch (error) {
        errors.push(`Failed to sync task ${task.id}: ${error}`);
      }
    }

    return { synced, errors };
  }
}

export const schedulingService = new SchedulingService();

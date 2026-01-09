/**
 * JD Agent - Time Blocking Service
 * 
 * Automatically schedules focus time for tasks:
 * - Analyzes calendar for available slots
 * - Creates time blocks based on task priority and due dates
 * - Respects user preferences (focus hours, buffer time)
 * - Integrates with Google Calendar
 */

import { db } from '../db/client';
import { tasks, calendarEvents, timeBlocks } from '../db/schema';
import { and, eq, gte, lte, not, desc, isNull, or, inArray } from 'drizzle-orm';
import { getGoogleCalendar } from '../integrations/google-calendar';

// ============================================
// Types
// ============================================

export interface TimeBlockPreferences {
  focusHoursStart: number;  // e.g., 9 for 9 AM
  focusHoursEnd: number;    // e.g., 17 for 5 PM
  minBlockDuration: number; // minutes
  maxBlockDuration: number; // minutes
  bufferBetweenBlocks: number; // minutes
  preferredDays: number[];  // 0=Sunday, 1=Monday, etc.
  avoidWeekends: boolean;
}

export interface TimeSlot {
  start: Date;
  end: Date;
  duration: number; // minutes
}

export interface TimeBlockSuggestion {
  taskId: string;
  taskTitle: string;
  suggestedSlot: TimeSlot;
  priority: number;
  reason: string;
}

export interface ScheduleResult {
  scheduled: number;
  failed: number;
  suggestions: TimeBlockSuggestion[];
}

// ============================================
// Default Preferences
// ============================================

const DEFAULT_PREFERENCES: TimeBlockPreferences = {
  focusHoursStart: 9,
  focusHoursEnd: 17,
  minBlockDuration: 30,
  maxBlockDuration: 120,
  bufferBetweenBlocks: 15,
  preferredDays: [1, 2, 3, 4, 5], // Monday-Friday
  avoidWeekends: true,
};

// ============================================
// Time Blocking Service
// ============================================

class TimeBlockingService {
  private preferences: TimeBlockPreferences = DEFAULT_PREFERENCES;

  /**
   * Update user preferences
   */
  setPreferences(prefs: Partial<TimeBlockPreferences>): void {
    this.preferences = { ...this.preferences, ...prefs };
  }

  /**
   * Get available time slots for a date range
   */
  async getAvailableSlots(
    startDate: Date,
    endDate: Date,
    minDuration: number = this.preferences.minBlockDuration
  ): Promise<TimeSlot[]> {
    // Get all calendar events in the range
    const events = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          gte(calendarEvents.startTime, startDate),
          lte(calendarEvents.endTime, endDate)
        )
      )
      .orderBy(calendarEvents.startTime);

    // Get all time blocks in the range
    const blocks = await db
      .select()
      .from(timeBlocks)
      .where(
        and(
          gte(timeBlocks.startTime, startDate),
          lte(timeBlocks.endTime, endDate),
          not(eq(timeBlocks.status, 'cancelled'))
        )
      )
      .orderBy(timeBlocks.startTime);

    // Combine all busy times
    const busyTimes: { start: Date; end: Date }[] = [
      ...events.map(e => ({ start: e.startTime, end: e.endTime })),
      ...blocks.map(b => ({ start: b.startTime, end: b.endTime })),
    ].sort((a, b) => a.start.getTime() - b.start.getTime());

    // Find gaps
    const availableSlots: TimeSlot[] = [];
    const current = new Date(startDate);

    while (current < endDate) {
      const dayOfWeek = current.getDay();
      
      // Skip non-preferred days
      if (!this.preferences.preferredDays.includes(dayOfWeek)) {
        current.setDate(current.getDate() + 1);
        current.setHours(this.preferences.focusHoursStart, 0, 0, 0);
        continue;
      }

      // Set focus hours for this day
      const dayStart = new Date(current);
      dayStart.setHours(this.preferences.focusHoursStart, 0, 0, 0);
      
      const dayEnd = new Date(current);
      dayEnd.setHours(this.preferences.focusHoursEnd, 0, 0, 0);

      // Start from the later of current or dayStart
      let slotStart = new Date(Math.max(current.getTime(), dayStart.getTime()));

      // Find busy periods for this day
      const dayBusy = busyTimes.filter(b => 
        b.start < dayEnd && b.end > dayStart
      );

      for (const busy of dayBusy) {
        // Add slot before this busy period
        if (slotStart < busy.start) {
          const slotEnd = new Date(Math.min(busy.start.getTime() - this.preferences.bufferBetweenBlocks * 60000, dayEnd.getTime()));
          const duration = (slotEnd.getTime() - slotStart.getTime()) / 60000;
          
          if (duration >= minDuration) {
            availableSlots.push({
              start: new Date(slotStart),
              end: new Date(slotEnd),
              duration,
            });
          }
        }
        
        // Move start past this busy period
        slotStart = new Date(busy.end.getTime() + this.preferences.bufferBetweenBlocks * 60000);
      }

      // Add remaining time until end of focus hours
      if (slotStart < dayEnd) {
        const duration = (dayEnd.getTime() - slotStart.getTime()) / 60000;
        
        if (duration >= minDuration) {
          availableSlots.push({
            start: new Date(slotStart),
            end: new Date(dayEnd),
            duration,
          });
        }
      }

      // Move to next day
      current.setDate(current.getDate() + 1);
      current.setHours(this.preferences.focusHoursStart, 0, 0, 0);
    }

    return availableSlots;
  }

  /**
   * Get tasks that need time blocks
   */
  async getTasksNeedingBlocks(): Promise<Array<{
    id: string;
    title: string;
    dueDate: Date | null;
    priority: number;
    estimatedMinutes: number | null;
    context: string;
  }>> {
    // Get incomplete tasks with due dates
    const incompleteTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          not(eq(tasks.status, 'done')),
          not(eq(tasks.status, 'cancelled')),
          not(isNull(tasks.dueDate))
        )
      )
      .orderBy(tasks.dueDate);

    // Filter out tasks that already have active time blocks
    const taskIds = incompleteTasks.map(t => t.id);
    
    if (taskIds.length === 0) {
      return [];
    }

    const existingBlocks = await db
      .select({ taskId: timeBlocks.taskId })
      .from(timeBlocks)
      .where(
        and(
          inArray(timeBlocks.taskId, taskIds),
          not(eq(timeBlocks.status, 'cancelled')),
          not(eq(timeBlocks.status, 'completed'))
        )
      );

    const blockedTaskIds = new Set(existingBlocks.map(b => b.taskId));

    return incompleteTasks
      .filter(t => !blockedTaskIds.has(t.id))
      .map(t => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate,
        priority: t.priority,
        estimatedMinutes: t.timeEstimateMinutes,
        context: t.context,
      }));
  }

  /**
   * Generate time block suggestions for unscheduled tasks
   */
  async generateSuggestions(): Promise<TimeBlockSuggestion[]> {
    const suggestions: TimeBlockSuggestion[] = [];
    
    // Get tasks needing blocks
    const tasksNeedingBlocks = await this.getTasksNeedingBlocks();
    
    if (tasksNeedingBlocks.length === 0) {
      return [];
    }

    // Get available slots for the next 2 weeks
    const now = new Date();
    const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const availableSlots = await this.getAvailableSlots(now, twoWeeksLater);

    // Sort tasks by priority and due date (higher priority number = more important)
    const sortedTasks = tasksNeedingBlocks.sort((a, b) => {
      // Higher priority first
      if (b.priority !== a.priority) return b.priority - a.priority;
      
      // Earlier due date first
      const aDue = a.dueDate?.getTime() || Infinity;
      const bDue = b.dueDate?.getTime() || Infinity;
      return aDue - bDue;
    });

    // Match tasks to slots
    const usedSlots = new Set<number>();

    for (const task of sortedTasks) {
      const requiredDuration = task.estimatedMinutes || 60; // Default 1 hour
      
      // Find best available slot
      for (let i = 0; i < availableSlots.length; i++) {
        if (usedSlots.has(i)) continue;
        
        const slot = availableSlots[i];
        
        // Slot must be before due date
        if (task.dueDate && slot.start >= task.dueDate) continue;
        
        // Slot must be long enough
        if (slot.duration < Math.min(requiredDuration, this.preferences.minBlockDuration)) continue;

        // Create suggestion
        const blockDuration = Math.min(
          requiredDuration,
          slot.duration,
          this.preferences.maxBlockDuration
        );

        const blockEnd = new Date(slot.start.getTime() + blockDuration * 60000);

        suggestions.push({
          taskId: task.id,
          taskTitle: task.title,
          suggestedSlot: {
            start: new Date(slot.start),
            end: blockEnd,
            duration: blockDuration,
          },
          priority: this.calculateBlockPriority(task, slot.start),
          reason: this.generateReason(task, slot),
        });

        // Mark slot as used (or partially used)
        if (slot.duration <= blockDuration + this.preferences.bufferBetweenBlocks) {
          usedSlots.add(i);
        } else {
          // Update slot to reflect remaining time
          availableSlots[i] = {
            start: new Date(blockEnd.getTime() + this.preferences.bufferBetweenBlocks * 60000),
            end: slot.end,
            duration: (slot.end.getTime() - blockEnd.getTime() - this.preferences.bufferBetweenBlocks * 60000) / 60000,
          };
        }

        break;
      }
    }

    return suggestions.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Create time blocks from suggestions
   */
  async createBlocksFromSuggestions(
    suggestionIds: string[],
    suggestions: TimeBlockSuggestion[]
  ): Promise<ScheduleResult> {
    let scheduled = 0;
    let failed = 0;

    const selectedSuggestions = suggestions.filter(s => 
      suggestionIds.includes(s.taskId)
    );

    for (const suggestion of selectedSuggestions) {
      try {
        // Create time block in database
        await db.insert(timeBlocks).values({
          id: crypto.randomUUID(),
          taskId: suggestion.taskId,
          startTime: suggestion.suggestedSlot.start,
          endTime: suggestion.suggestedSlot.end,
          status: 'scheduled',
          blockType: 'focus',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Optionally create calendar event
        const calendar = getGoogleCalendar();
        if (calendar.isConfigured()) {
          await calendar.createEvent({
            title: `🎯 Focus: ${suggestion.taskTitle}`,
            description: `Time block for task: ${suggestion.taskTitle}`,
            startTime: suggestion.suggestedSlot.start,
            endTime: suggestion.suggestedSlot.end,
          });
        }

        scheduled++;
      } catch (error) {
        console.error('[TimeBlocking] Failed to create block:', error);
        failed++;
      }
    }

    return {
      scheduled,
      failed,
      suggestions: selectedSuggestions,
    };
  }

  /**
   * Auto-schedule all unblocked tasks
   */
  async autoSchedule(): Promise<ScheduleResult> {
    const suggestions = await this.generateSuggestions();
    
    if (suggestions.length === 0) {
      return { scheduled: 0, failed: 0, suggestions: [] };
    }

    // Auto-approve top priority suggestions
    const topSuggestions = suggestions
      .filter(s => s.priority >= 7) // High priority
      .slice(0, 5); // Max 5 at a time

    return this.createBlocksFromSuggestions(
      topSuggestions.map(s => s.taskId),
      suggestions
    );
  }

  /**
   * Calculate priority score for a time block
   */
  private calculateBlockPriority(
    task: { dueDate: Date | null; priority: number },
    slotStart: Date
  ): number {
    let score = 5;

    // Priority boost based on numeric priority (higher = more important)
    score += Math.min(task.priority, 3);

    // Due date urgency
    if (task.dueDate) {
      const daysUntilDue = (task.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysUntilDue <= 1) score += 3;
      else if (daysUntilDue <= 3) score += 2;
      else if (daysUntilDue <= 7) score += 1;
    }

    // Prefer morning slots
    const hour = slotStart.getHours();
    if (hour >= 9 && hour <= 11) score += 0.5;

    return Math.min(score, 10);
  }

  /**
   * Generate human-readable reason for suggestion
   */
  private generateReason(
    task: { dueDate: Date | null; priority: number; title: string },
    slot: TimeSlot
  ): string {
    const reasons: string[] = [];

    if (task.dueDate) {
      const daysUntilDue = Math.ceil((task.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntilDue <= 1) reasons.push('Due tomorrow');
      else if (daysUntilDue <= 3) reasons.push(`Due in ${daysUntilDue} days`);
    }

    if (task.priority >= 2) {
      reasons.push('High priority');
    }

    const dayName = slot.start.toLocaleDateString('en-US', { weekday: 'long' });
    const time = slot.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    reasons.push(`${dayName} ${time} available`);

    return reasons.join(', ');
  }

  /**
   * Get today's time blocks
   */
  async getTodaysBlocks(): Promise<Array<{
    id: string;
    taskId: string;
    startTime: Date;
    endTime: Date;
    status: string;
    task?: { title: string; context: string };
  }>> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const blocks = await db
      .select({
        block: timeBlocks,
        task: tasks,
      })
      .from(timeBlocks)
      .leftJoin(tasks, eq(timeBlocks.taskId, tasks.id))
      .where(
        and(
          gte(timeBlocks.startTime, today),
          lte(timeBlocks.startTime, tomorrow),
          not(eq(timeBlocks.status, 'cancelled'))
        )
      )
      .orderBy(timeBlocks.startTime);

    return blocks.map(({ block, task }) => ({
      id: block.id,
      taskId: block.taskId || '',
      startTime: block.startTime,
      endTime: block.endTime,
      status: block.status,
      task: task ? {
        title: task.title,
        context: task.context,
      } : undefined,
    }));
  }

  /**
   * Mark a time block as completed
   */
  async completeBlock(blockId: string): Promise<boolean> {
    try {
      await db
        .update(timeBlocks)
        .set({ status: 'completed', updatedAt: new Date() })
        .where(eq(timeBlocks.id, blockId));
      return true;
    } catch (error) {
      console.error('[TimeBlocking] Failed to complete block:', error);
      return false;
    }
  }

  /**
   * Cancel a time block
   */
  async cancelBlock(blockId: string): Promise<boolean> {
    try {
      await db
        .update(timeBlocks)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(timeBlocks.id, blockId));
      return true;
    } catch (error) {
      console.error('[TimeBlocking] Failed to cancel block:', error);
      return false;
    }
  }
}

// ============================================
// Singleton instance
// ============================================

export const timeBlockingService = new TimeBlockingService();

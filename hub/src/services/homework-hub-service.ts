/**
 * Homework Hub Service
 *
 * Canvas Complete Phase 4: Centralized homework dashboard
 * - Due today, due this week, upcoming assignments
 * - Readings due with progress tracking
 * - Progress tracking for subtasks
 * - Urgency calculations
 */

import { db } from '../db/client';
import {
  canvasItems,
  canvasAssignmentSubtasks,
  canvasMaterials,
  tasks,
  classes,
} from '../db/schema';
import { eq, and, gte, lte, lt, desc, asc, isNull, sql, inArray } from 'drizzle-orm';
import { startOfDay, endOfDay, addDays, startOfWeek, endOfWeek, differenceInHours } from 'date-fns';

// ============================================
// Types
// ============================================

export interface HomeworkItem {
  id: string;
  title: string;
  courseName: string;
  courseCode: string | null;
  dueAt: Date | null;
  pointsPossible: number | null;
  estimatedMinutes: number | null;
  taskId: string | null;
  hasRubric: boolean;
  hasInstructions: boolean;
  url: string | null;
  // Progress
  subtaskCount: number;
  subtasksCompleted: number;
  progressPercent: number;
  // Urgency
  urgencyLevel: 'critical' | 'high' | 'medium' | 'low';
  hoursUntilDue: number | null;
  // Status
  status: 'not_started' | 'in_progress' | 'ready_to_submit' | 'completed';
}

export interface ReadingItem {
  id: string;
  fileName: string;
  displayName: string | null;
  courseName: string;
  courseCode: string | null;
  fileType: string;
  materialType: string | null;
  readStatus: string;
  readProgress: number;
  relatedAssignmentTitle: string | null;
  relatedAssignmentDueAt: Date | null;
}

export interface HomeworkHubData {
  dueToday: HomeworkItem[];
  dueThisWeek: HomeworkItem[];
  upcoming: HomeworkItem[];
  readingsDue: ReadingItem[];
  summary: {
    dueTodayCount: number;
    dueThisWeekCount: number;
    upcomingCount: number;
    unreadReadingsCount: number;
    totalEstimatedMinutesToday: number;
    totalEstimatedMinutesWeek: number;
    criticalCount: number;
  };
}

// ============================================
// Service
// ============================================

class HomeworkHubService {
  /**
   * Get complete homework hub data
   */
  async getHomeworkHubData(): Promise<HomeworkHubData> {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 }); // Monday start
    const twoWeeksOut = addDays(now, 14);

    // Fetch all active assignments
    const assignments = await db
      .select()
      .from(canvasItems)
      .where(
        and(
          eq(canvasItems.canvasType, 'assignment'),
          gte(canvasItems.dueAt, todayStart)
        )
      )
      .orderBy(asc(canvasItems.dueAt));

    // Fetch subtask counts for all assignments
    const subtaskCounts = await this.getSubtaskCounts(assignments.map((a) => a.id));

    // Fetch task completion status
    const taskIds = assignments.filter((a) => a.taskId).map((a) => a.taskId!);
    const taskStatuses = await this.getTaskStatuses(taskIds);

    // Process assignments into homework items
    const homeworkItems = assignments.map((assignment) => {
      const subtasks = subtaskCounts[assignment.id] || { total: 0, completed: 0 };
      const taskStatus = assignment.taskId ? taskStatuses[assignment.taskId] : null;

      return this.formatHomeworkItem(assignment, subtasks, taskStatus);
    });

    // Categorize by due date
    const dueToday = homeworkItems.filter(
      (item) => item.dueAt && item.dueAt >= todayStart && item.dueAt <= todayEnd
    );

    const dueThisWeek = homeworkItems.filter(
      (item) => item.dueAt && item.dueAt > todayEnd && item.dueAt <= weekEnd
    );

    const upcoming = homeworkItems.filter(
      (item) => item.dueAt && item.dueAt > weekEnd && item.dueAt <= twoWeeksOut
    );

    // Get readings due
    const readingsDue = await this.getReadingsDue();

    // Calculate summary
    const summary = {
      dueTodayCount: dueToday.length,
      dueThisWeekCount: dueThisWeek.length,
      upcomingCount: upcoming.length,
      unreadReadingsCount: readingsDue.filter((r) => r.readStatus === 'unread').length,
      totalEstimatedMinutesToday: dueToday.reduce((sum, item) => sum + (item.estimatedMinutes || 0), 0),
      totalEstimatedMinutesWeek: [...dueToday, ...dueThisWeek].reduce(
        (sum, item) => sum + (item.estimatedMinutes || 0),
        0
      ),
      criticalCount: homeworkItems.filter((item) => item.urgencyLevel === 'critical').length,
    };

    return {
      dueToday,
      dueThisWeek,
      upcoming,
      readingsDue,
      summary,
    };
  }

  /**
   * Get subtask counts for assignments
   */
  private async getSubtaskCounts(
    canvasItemIds: string[]
  ): Promise<Record<string, { total: number; completed: number }>> {
    if (canvasItemIds.length === 0) return {};

    const subtasks = await db
      .select({
        canvasItemId: canvasAssignmentSubtasks.canvasItemId,
        isCompleted: canvasAssignmentSubtasks.isCompleted,
      })
      .from(canvasAssignmentSubtasks)
      .where(inArray(canvasAssignmentSubtasks.canvasItemId, canvasItemIds));

    const counts: Record<string, { total: number; completed: number }> = {};
    for (const subtask of subtasks) {
      if (!counts[subtask.canvasItemId]) {
        counts[subtask.canvasItemId] = { total: 0, completed: 0 };
      }
      counts[subtask.canvasItemId].total++;
      if (subtask.isCompleted) {
        counts[subtask.canvasItemId].completed++;
      }
    }

    return counts;
  }

  /**
   * Get task completion statuses
   */
  private async getTaskStatuses(
    taskIds: string[]
  ): Promise<Record<string, { completed: boolean; completedAt: Date | null }>> {
    if (taskIds.length === 0) return {};

    const taskList = await db
      .select({
        id: tasks.id,
        completedAt: tasks.completedAt,
      })
      .from(tasks)
      .where(inArray(tasks.id, taskIds));

    const statuses: Record<string, { completed: boolean; completedAt: Date | null }> = {};
    for (const task of taskList) {
      statuses[task.id] = {
        completed: !!task.completedAt,
        completedAt: task.completedAt,
      };
    }

    return statuses;
  }

  /**
   * Format a canvas item into a homework item
   */
  private formatHomeworkItem(
    assignment: typeof canvasItems.$inferSelect,
    subtasks: { total: number; completed: number },
    taskStatus: { completed: boolean; completedAt: Date | null } | null
  ): HomeworkItem {
    const now = new Date();
    const hoursUntilDue = assignment.dueAt
      ? differenceInHours(assignment.dueAt, now)
      : null;

    // Calculate urgency
    let urgencyLevel: HomeworkItem['urgencyLevel'] = 'low';
    if (hoursUntilDue !== null) {
      if (hoursUntilDue < 0) urgencyLevel = 'critical'; // Past due
      else if (hoursUntilDue < 24) urgencyLevel = 'critical';
      else if (hoursUntilDue < 48) urgencyLevel = 'high';
      else if (hoursUntilDue < 72) urgencyLevel = 'medium';
    }

    // Calculate progress
    const progressPercent =
      subtasks.total > 0
        ? Math.round((subtasks.completed / subtasks.total) * 100)
        : 0;

    // Determine status
    let status: HomeworkItem['status'] = 'not_started';
    if (taskStatus?.completed) {
      status = 'completed';
    } else if (progressPercent === 100) {
      status = 'ready_to_submit';
    } else if (progressPercent > 0) {
      status = 'in_progress';
    }

    return {
      id: assignment.id,
      title: assignment.title,
      courseName: assignment.courseName,
      courseCode: null, // Could fetch from class mapping
      dueAt: assignment.dueAt,
      pointsPossible: assignment.pointsPossible,
      estimatedMinutes: assignment.estimatedMinutes,
      taskId: assignment.taskId,
      hasRubric: !!assignment.rubric,
      hasInstructions: !!assignment.instructions,
      url: assignment.url,
      subtaskCount: subtasks.total,
      subtasksCompleted: subtasks.completed,
      progressPercent,
      urgencyLevel,
      hoursUntilDue,
      status,
    };
  }

  /**
   * Get readings that are due or unread
   */
  private async getReadingsDue(): Promise<ReadingItem[]> {
    // Get unread and in-progress readings
    const readings = await db
      .select({
        id: canvasMaterials.id,
        fileName: canvasMaterials.fileName,
        displayName: canvasMaterials.displayName,
        courseId: canvasMaterials.courseId,
        fileType: canvasMaterials.fileType,
        materialType: canvasMaterials.materialType,
        readStatus: canvasMaterials.readStatus,
        readProgress: canvasMaterials.readProgress,
        relatedAssignmentIds: canvasMaterials.relatedAssignmentIds,
      })
      .from(canvasMaterials)
      .where(
        and(
          eq(canvasMaterials.materialType, 'reading'),
          sql`${canvasMaterials.readStatus} != 'completed'`
        )
      )
      .orderBy(asc(canvasMaterials.createdAt))
      .limit(10);

    // Get course names
    const courseIds = [...new Set(readings.map((r) => r.courseId))];
    const courseNames = await this.getCourseNames(courseIds);

    // Get related assignment info
    const relatedAssignmentInfo = await this.getRelatedAssignmentInfo(readings);

    return readings.map((reading) => ({
      id: reading.id,
      fileName: reading.fileName,
      displayName: reading.displayName,
      courseName: courseNames[reading.courseId] || 'Unknown Course',
      courseCode: null,
      fileType: reading.fileType,
      materialType: reading.materialType,
      readStatus: reading.readStatus,
      readProgress: reading.readProgress,
      relatedAssignmentTitle: relatedAssignmentInfo[reading.id]?.title || null,
      relatedAssignmentDueAt: relatedAssignmentInfo[reading.id]?.dueAt || null,
    }));
  }

  /**
   * Get course names by ID
   */
  private async getCourseNames(courseIds: string[]): Promise<Record<string, string>> {
    if (courseIds.length === 0) return {};

    const courseList = await db
      .select({ id: classes.id, name: classes.name })
      .from(classes)
      .where(inArray(classes.id, courseIds));

    const names: Record<string, string> = {};
    for (const course of courseList) {
      names[course.id] = course.name;
    }
    return names;
  }

  /**
   * Get related assignment info for readings
   */
  private async getRelatedAssignmentInfo(
    readings: Array<{ id: string; relatedAssignmentIds: string[] | null }>
  ): Promise<Record<string, { title: string; dueAt: Date | null }>> {
    const allAssignmentIds = readings
      .filter((r) => r.relatedAssignmentIds && r.relatedAssignmentIds.length > 0)
      .flatMap((r) => r.relatedAssignmentIds!);

    if (allAssignmentIds.length === 0) return {};

    const assignments = await db
      .select({ id: canvasItems.id, title: canvasItems.title, dueAt: canvasItems.dueAt })
      .from(canvasItems)
      .where(inArray(canvasItems.id, allAssignmentIds));

    const assignmentMap: Record<string, { title: string; dueAt: Date | null }> = {};
    for (const a of assignments) {
      assignmentMap[a.id] = { title: a.title, dueAt: a.dueAt };
    }

    const result: Record<string, { title: string; dueAt: Date | null }> = {};
    for (const reading of readings) {
      if (reading.relatedAssignmentIds && reading.relatedAssignmentIds.length > 0) {
        const firstAssignmentId = reading.relatedAssignmentIds[0];
        if (assignmentMap[firstAssignmentId]) {
          result[reading.id] = assignmentMap[firstAssignmentId];
        }
      }
    }

    return result;
  }

  /**
   * Get assignments due today with full details
   */
  async getDueToday(): Promise<HomeworkItem[]> {
    const data = await this.getHomeworkHubData();
    return data.dueToday;
  }

  /**
   * Get assignments due this week
   */
  async getDueThisWeek(): Promise<HomeworkItem[]> {
    const data = await this.getHomeworkHubData();
    return [...data.dueToday, ...data.dueThisWeek];
  }

  /**
   * Get critical/urgent assignments
   */
  async getCriticalAssignments(): Promise<HomeworkItem[]> {
    const data = await this.getHomeworkHubData();
    return [...data.dueToday, ...data.dueThisWeek, ...data.upcoming].filter(
      (item) => item.urgencyLevel === 'critical' || item.urgencyLevel === 'high'
    );
  }

  /**
   * Get homework summary for widgets
   */
  async getSummary(): Promise<HomeworkHubData['summary']> {
    const data = await this.getHomeworkHubData();
    return data.summary;
  }
}

export const homeworkHubService = new HomeworkHubService();

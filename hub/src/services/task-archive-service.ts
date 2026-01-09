import { eq, and, lte, sql, isNull } from 'drizzle-orm';
import { db } from '../db/client';
import { tasks, vaultEntries, projects } from '../db/schema';
import { format } from 'date-fns';

interface ArchivedTaskInfo {
  taskId: string;
  vaultEntryId: string;
  title: string;
  archivedAt: Date;
}

interface ArchiveResult {
  tasksArchived: number;
  entries: ArchivedTaskInfo[];
  errors: string[];
}

export class TaskArchiveService {
  /**
   * Archive a single completed task to the vault
   */
  async archiveTask(taskId: string): Promise<ArchivedTaskInfo | null> {
    // Get the task with project info
    const result = await db
      .select({
        task: tasks,
        project: {
          id: projects.id,
          name: projects.name,
          context: projects.context,
        },
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(eq(tasks.id, taskId))
      .limit(1);

    if (result.length === 0) return null;

    const { task, project } = result[0];

    if (task.status !== 'done') {
      throw new Error('Task must be completed before archiving');
    }

    // Build the archive content
    const content = this.buildArchiveContent(task, project);
    const tags = this.buildTags(task, project);

    // Create vault entry
    const [vaultEntry] = await db
      .insert(vaultEntries)
      .values({
        title: `✓ ${task.title}`,
        content,
        contentType: 'task_archive',
        context: task.context,
        tags,
        source: 'tasks',
        sourceRef: task.id,
        sourceDate: task.completedAt || new Date(),
      })
      .returning();

    // Update task status to archived
    await db
      .update(tasks)
      .set({
        status: 'archived',
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    return {
      taskId: task.id,
      vaultEntryId: vaultEntry.id,
      title: task.title,
      archivedAt: new Date(),
    };
  }

  /**
   * Archive all completed tasks older than specified days
   */
  async archiveCompletedTasks(daysOld: number = 1): Promise<ArchiveResult> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    // Find completed tasks that haven't been archived yet
    const completedTasks = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.status, 'done'),
          lte(tasks.completedAt, cutoffDate)
        )
      );

    const result: ArchiveResult = {
      tasksArchived: 0,
      entries: [],
      errors: [],
    };

    for (const { id } of completedTasks) {
      try {
        const archived = await this.archiveTask(id);
        if (archived) {
          result.tasksArchived++;
          result.entries.push(archived);
        }
      } catch (error) {
        result.errors.push(`Failed to archive task ${id}: ${error}`);
      }
    }

    return result;
  }

  /**
   * Get archived tasks from vault
   */
  async getArchivedTasks(context?: string, limit: number = 50) {
    const conditions = [eq(vaultEntries.contentType, 'task_archive')];

    if (context) {
      conditions.push(eq(vaultEntries.context, context));
    }

    return db
      .select()
      .from(vaultEntries)
      .where(and(...conditions))
      .orderBy(sql`${vaultEntries.sourceDate} DESC`)
      .limit(limit);
  }

  /**
   * Build markdown content for archived task
   */
  private buildArchiveContent(
    task: typeof tasks.$inferSelect,
    project: { id: string; name: string; context: string } | null
  ): string {
    const lines: string[] = [];

    // Task details
    if (task.description) {
      lines.push(task.description);
      lines.push('');
    }

    lines.push('---');
    lines.push('## Task Details');
    lines.push('');

    // Metadata table
    lines.push('| Field | Value |');
    lines.push('|-------|-------|');

    if (project) {
      lines.push(`| Project | ${project.name} |`);
    }

    lines.push(`| Context | ${task.context} |`);
    lines.push(`| Priority | ${this.getPriorityLabel(task.priority)} |`);

    if (task.dueDate) {
      lines.push(`| Due Date | ${format(task.dueDate, 'MMMM d, yyyy')} |`);
    }

    if (task.timeEstimateMinutes) {
      lines.push(`| Estimated Time | ${task.timeEstimateMinutes} minutes |`);
    }

    if (task.energyLevel) {
      lines.push(`| Energy Level | ${task.energyLevel} |`);
    }

    lines.push(`| Created | ${format(task.createdAt, 'MMMM d, yyyy')} |`);
    lines.push(`| Completed | ${format(task.completedAt || new Date(), 'MMMM d, yyyy h:mm a')} |`);
    lines.push(`| Source | ${task.source} |`);

    return lines.join('\n');
  }

  /**
   * Build tags for archived task
   */
  private buildTags(
    task: typeof tasks.$inferSelect,
    project: { id: string; name: string; context: string } | null
  ): string[] {
    const tags: string[] = ['completed-task'];

    if (project) {
      tags.push(`project:${project.name.toLowerCase().replace(/\s+/g, '-')}`);
    }

    if (task.source !== 'manual') {
      tags.push(`source:${task.source}`);
    }

    if (task.energyLevel) {
      tags.push(`energy:${task.energyLevel}`);
    }

    return tags;
  }

  /**
   * Get priority label
   */
  private getPriorityLabel(priority: number): string {
    switch (priority) {
      case 4: return '🔴 Urgent';
      case 3: return '🟠 High';
      case 2: return '🟡 Medium';
      case 1: return '🔵 Low';
      default: return '⚪ None';
    }
  }
}

export const taskArchiveService = new TaskArchiveService();

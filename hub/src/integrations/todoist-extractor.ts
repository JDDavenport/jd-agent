/**
 * Todoist Integration - Extract tasks for archival
 *
 * Provides:
 * - Extract all tasks (active and completed)
 * - Organize by project
 * - Preserve task metadata (labels, priority, due dates)
 * - Format as structured markdown for vault
 */

import { TodoistApi } from '@doist/todoist-api-typescript';
import type { RawEntry } from '../types';

// ============================================
// Types
// ============================================

export interface TodoistConfig {
  apiKey: string;
  includeCompleted?: boolean; // Include completed tasks
  includeProjects?: string[]; // Only these projects
  excludeProjects?: string[]; // Skip these projects
}

// ============================================
// Todoist Extractor
// ============================================

export class TodoistExtractor {
  private api: TodoistApi;
  private config: TodoistConfig;

  constructor(config: TodoistConfig) {
    this.config = {
      includeCompleted: true,
      ...config,
    };
    this.api = new TodoistApi(config.apiKey);
  }

  /**
   * Extract all tasks
   */
  async *extractAll(): AsyncGenerator<RawEntry> {
    console.log('Starting Todoist extraction...');

    try {
      // Get all projects first for context
      const projectsResponse = await this.api.getProjects();
      const projects = Array.isArray(projectsResponse) ? projectsResponse : [];
      const projectMap = new Map(projects.map(p => [p.id, p.name]));

      // Get active tasks
      const activeTasksResponse = await this.api.getTasks();
      const activeTasks = Array.isArray(activeTasksResponse) ? activeTasksResponse : [];
      console.log(`Found ${activeTasks.length} active tasks`);

      // Group tasks by project
      const tasksByProject = new Map<string, typeof activeTasks>();

      for (const task of activeTasks) {
        const projectId = task.projectId;
        const projectName = projectMap.get(projectId) || 'Inbox';

        // Filter by project if configured
        if (this.config.includeProjects && this.config.includeProjects.length > 0) {
          if (!this.config.includeProjects.includes(projectName)) {
            continue;
          }
        }

        if (this.config.excludeProjects?.includes(projectName)) {
          continue;
        }

        if (!tasksByProject.has(projectName)) {
          tasksByProject.set(projectName, []);
        }
        tasksByProject.get(projectName)!.push(task);
      }

      // Create one vault entry per project with all tasks
      for (const [projectName, tasks] of tasksByProject.entries()) {
        const content = this.formatProjectTasks(projectName, tasks);

        yield {
          title: `Todoist - ${projectName}`,
          content,
          source: 'manual', // Todoist not in enum, use manual
          sourceId: `todoist-${projectName}`,
          sourceUrl: 'https://todoist.com',
          sourcePath: `Todoist / ${projectName}`,
          createdAt: new Date(),
          modifiedAt: new Date(),
          rawMetadata: {
            projectName,
            taskCount: tasks.length,
            source: 'todoist',
          },
        };
      }

      console.log(`Extracted ${tasksByProject.size} Todoist projects`);
    } catch (error) {
      console.error('Error in Todoist extraction:', error);
      throw error;
    }
  }

  /**
   * Extract a single project
   */
  async extractProject(projectName: string): Promise<RawEntry | null> {
    try {
      const projects = await this.api.getProjects();
      const project = projects.find(p => p.name === projectName);

      if (!project) {
        console.error(`Project "${projectName}" not found`);
        return null;
      }

      const tasks = await this.api.getTasks({ projectId: project.id });
      const content = this.formatProjectTasks(projectName, tasks);

      return {
        title: `Todoist - ${projectName}`,
        content,
        source: 'manual',
        sourceId: `todoist-${projectName}`,
        sourceUrl: `https://todoist.com/app/project/${project.id}`,
        sourcePath: `Todoist / ${projectName}`,
        createdAt: new Date(),
        modifiedAt: new Date(),
        rawMetadata: {
          projectName,
          projectId: project.id,
          taskCount: tasks.length,
          source: 'todoist',
        },
      };
    } catch (error) {
      console.error(`Error extracting project ${projectName}:`, error);
      throw error;
    }
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Format tasks as structured markdown
   */
  private formatProjectTasks(projectName: string, tasks: any[]): string {
    let markdown = `# ${projectName}\n\n`;
    markdown += `**Total Tasks:** ${tasks.length}\n\n`;
    markdown += `---\n\n`;

    // Group by priority
    const p1Tasks = tasks.filter(t => t.priority === 4);
    const p2Tasks = tasks.filter(t => t.priority === 3);
    const p3Tasks = tasks.filter(t => t.priority === 2);
    const normalTasks = tasks.filter(t => t.priority === 1);

    if (p1Tasks.length > 0) {
      markdown += `## Priority 1 (Urgent)\n\n`;
      markdown += this.formatTaskList(p1Tasks);
      markdown += `\n`;
    }

    if (p2Tasks.length > 0) {
      markdown += `## Priority 2 (High)\n\n`;
      markdown += this.formatTaskList(p2Tasks);
      markdown += `\n`;
    }

    if (p3Tasks.length > 0) {
      markdown += `## Priority 3 (Medium)\n\n`;
      markdown += this.formatTaskList(p3Tasks);
      markdown += `\n`;
    }

    if (normalTasks.length > 0) {
      markdown += `## Normal Priority\n\n`;
      markdown += this.formatTaskList(normalTasks);
      markdown += `\n`;
    }

    return markdown;
  }

  /**
   * Format a list of tasks
   */
  private formatTaskList(tasks: any[]): string {
    let markdown = '';

    for (const task of tasks) {
      const checkbox = task.isCompleted ? 'x' : ' ';
      markdown += `- [${checkbox}] ${task.content}`;

      // Add metadata
      const metadata: string[] = [];

      if (task.due) {
        const dueDate = new Date(task.due.date);
        metadata.push(`📅 ${dueDate.toLocaleDateString()}`);
      }

      if (task.labels && task.labels.length > 0) {
        metadata.push(`🏷️ ${task.labels.join(', ')}`);
      }

      if (metadata.length > 0) {
        markdown += ` (${metadata.join(' | ')})`;
      }

      markdown += '\n';

      // Add description if present
      if (task.description) {
        markdown += `  > ${task.description}\n`;
      }

      // Add subtasks if present (Todoist doesn't expose these in basic API, would need to check)
    }

    return markdown;
  }

  /**
   * Get list of all projects
   */
  async getProjects(): Promise<{ id: string; name: string }[]> {
    try {
      const projectsResponse = await this.api.getProjects();
      const projects = Array.isArray(projectsResponse) ? projectsResponse : [];
      return projects.map(p => ({ id: p.id, name: p.name }));
    } catch (error) {
      console.error('Error getting projects:', error);
      return [];
    }
  }

  /**
   * Test API access
   */
  async testAccess(): Promise<boolean> {
    try {
      await this.api.getProjects();
      return true;
    } catch (error: any) {
      console.error('❌ Cannot access Todoist API');
      console.error('Error:', error.message);
      return false;
    }
  }
}

// ============================================
// Factory Function
// ============================================

export function createTodoistExtractor(apiKey: string, config?: Partial<TodoistConfig>): TodoistExtractor {
  return new TodoistExtractor({
    apiKey,
    ...config,
  });
}

// ============================================
// Utility: Quick test
// ============================================

export async function testTodoistAccess(apiKey: string): Promise<void> {
  try {
    const extractor = createTodoistExtractor(apiKey);

    console.log('Testing Todoist API access...');
    const hasAccess = await extractor.testAccess();

    if (!hasAccess) {
      console.error('❌ Cannot access Todoist');
      return;
    }

    console.log('✅ Todoist API access granted');

    console.log('\nAvailable projects:');
    const projects = await extractor.getProjects();
    projects.forEach(project => console.log(`  - ${project.name}`));

    console.log(`\n✅ Found ${projects.length} projects`);
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

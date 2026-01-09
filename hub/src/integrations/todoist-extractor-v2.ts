/**
 * Todoist Integration - Extract tasks using REST API v2
 *
 * Provides:
 * - Extract all tasks (active and completed)
 * - Organize by project
 * - Preserve task metadata (labels, priority, due dates)
 * - Format as structured markdown for vault
 */

import type { RawEntry } from '../types';

// ============================================
// Types
// ============================================

export interface TodoistConfig {
  apiKey: string;
  includeCompleted?: boolean;
}

interface TodoistTask {
  id: string;
  content: string;
  description: string;
  project_id: string;
  is_completed: boolean;
  labels: string[];
  priority: number;
  due?: {
    date: string;
    string: string;
  };
  created_at: string;
  url: string;
}

interface TodoistProject {
  id: string;
  name: string;
  color: string;
  is_favorite: boolean;
  url: string;
}

// ============================================
// Todoist Extractor
// ============================================

export class TodoistExtractorV2 {
  private config: TodoistConfig;
  private baseUrl = 'https://api.todoist.com/rest/v2';

  constructor(config: TodoistConfig) {
    this.config = {
      includeCompleted: true,
      ...config,
    };
  }

  /**
   * Extract all tasks
   */
  async *extractAll(): AsyncGenerator<RawEntry> {
    console.log('Starting Todoist extraction (REST API v2)...');

    try {
      // Get all projects first for context
      const projects = await this.getProjects();
      const projectMap = new Map(projects.map(p => [p.id, p.name]));

      console.log(`Found ${projects.length} Todoist projects`);

      // Get active tasks
      const tasks = await this.getTasks();
      console.log(`Found ${tasks.length} Todoist tasks`);

      // Group tasks by project
      const tasksByProject = new Map<string, TodoistTask[]>();

      for (const task of tasks) {
        const projectId = task.project_id;
        const projectName = projectMap.get(projectId) || 'Inbox';

        if (!tasksByProject.has(projectName)) {
          tasksByProject.set(projectName, []);
        }
        tasksByProject.get(projectName)!.push(task);
      }

      // Create one vault entry per project with all tasks
      for (const [projectName, projectTasks] of tasksByProject.entries()) {
        const content = this.formatProjectTasks(projectName, projectTasks);

        yield {
          title: `Todoist - ${projectName}`,
          content,
          source: 'manual', // Todoist not in enum, use manual
          sourceId: `todoist-project-${projectName}`,
          sourceUrl: 'https://todoist.com',
          sourcePath: `Todoist / ${projectName}`,
          createdAt: new Date(),
          modifiedAt: new Date(),
          rawMetadata: {
            projectName,
            taskCount: projectTasks.length,
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
   * Get all projects
   */
  async getProjects(): Promise<TodoistProject[]> {
    const response = await fetch(`${this.baseUrl}/projects`, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Todoist API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Get all tasks
   */
  async getTasks(): Promise<TodoistTask[]> {
    const response = await fetch(`${this.baseUrl}/tasks`, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Todoist API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Format tasks as structured markdown
   */
  private formatProjectTasks(projectName: string, tasks: TodoistTask[]): string {
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
  private formatTaskList(tasks: TodoistTask[]): string {
    let markdown = '';

    for (const task of tasks) {
      const checkbox = task.is_completed ? 'x' : ' ';
      markdown += `- [${checkbox}] ${task.content}`;

      // Add metadata
      const metadata: string[] = [];

      if (task.due) {
        metadata.push(`📅 ${task.due.string}`);
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
    }

    return markdown;
  }

  /**
   * Test API access
   */
  async testAccess(): Promise<boolean> {
    try {
      await this.getProjects();
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

export function createTodoistExtractor(apiKey: string, config?: Partial<TodoistConfig>): TodoistExtractorV2 {
  return new TodoistExtractorV2({
    apiKey,
    ...config,
  });
}

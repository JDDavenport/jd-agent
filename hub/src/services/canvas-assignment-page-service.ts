/**
 * Canvas Assignment Page Service
 *
 * Canvas Complete Phase 3: Auto-generates rich Vault pages for assignments
 * - Creates structured pages with assignment details, rubric, materials, and notes
 * - Links tasks to Vault pages for seamless navigation
 * - Syncs content between Canvas and Vault
 */

import { db } from '../db/client';
import {
  vaultPages,
  vaultBlocks,
  vaultReferences,
  canvasItems,
  canvasAssignmentPages,
  canvasMaterials,
  tasks,
} from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';

// ============================================
// Types
// ============================================

export interface AssignmentPageData {
  canvasItemId: string;
  title: string;
  courseName: string;
  dueAt: Date | null;
  pointsPossible: number | null;
  submissionTypes: string[] | null;
  allowedExtensions: string[] | null;
  instructions: string | null;
  instructionsHtml: string | null;
  rubric: RubricCriterion[] | null;
  estimatedMinutes: number | null;
  isGroupAssignment: boolean;
  hasPeerReview: boolean;
  url: string | null;
  taskId: string | null;
}

export interface RubricCriterion {
  id: string;
  criterion: string;
  description: string | null;
  points: number;
  ratings?: Array<{ description: string; points: number }>;
}

export interface AssignmentPageResult {
  pageId: string;
  blocksCreated: number;
  assignmentPageId: string;
}

// ============================================
// Service
// ============================================

class CanvasAssignmentPageService {
  /**
   * Create or update a Vault page for a Canvas assignment
   */
  async createAssignmentPage(
    data: AssignmentPageData,
    parentPageId?: string
  ): Promise<AssignmentPageResult> {
    // Check if page already exists
    const existing = await this.getAssignmentPageByCanvasItem(data.canvasItemId);
    if (existing) {
      // Update existing page
      return this.updateAssignmentPage(existing.id, data);
    }

    // Create the Vault page
    const [page] = await db
      .insert(vaultPages)
      .values({
        title: data.title,
        icon: '📝',
        parentId: parentPageId || null,
        paraType: 'projects', // Assignments are active projects
      })
      .returning();

    // Create content blocks
    const blocksCreated = await this.createAssignmentBlocks(page.id, data);

    // Create the assignment page link
    const [assignmentPage] = await db
      .insert(canvasAssignmentPages)
      .values({
        canvasItemId: data.canvasItemId,
        vaultPageId: page.id,
        instructionsSnapshot: data.instructions,
        rubricSnapshot: data.rubric,
      })
      .returning();

    // Update canvas item with vault page link
    await db
      .update(canvasItems)
      .set({ vaultPageId: page.id })
      .where(eq(canvasItems.id, data.canvasItemId));

    // Create reference from page to task if exists
    if (data.taskId) {
      await this.createTaskReference(page.id, data.taskId);
    }

    return {
      pageId: page.id,
      blocksCreated,
      assignmentPageId: assignmentPage.id,
    };
  }

  /**
   * Update an existing assignment page
   */
  private async updateAssignmentPage(
    assignmentPageId: string,
    data: AssignmentPageData
  ): Promise<AssignmentPageResult> {
    const [assignmentPage] = await db
      .select()
      .from(canvasAssignmentPages)
      .where(eq(canvasAssignmentPages.id, assignmentPageId));

    if (!assignmentPage) {
      throw new Error('Assignment page not found');
    }

    // Update the vault page title
    await db
      .update(vaultPages)
      .set({
        title: data.title,
        updatedAt: new Date(),
      })
      .where(eq(vaultPages.id, assignmentPage.vaultPageId));

    // Delete existing blocks and recreate
    await db.delete(vaultBlocks).where(eq(vaultBlocks.pageId, assignmentPage.vaultPageId));

    // Create new blocks
    const blocksCreated = await this.createAssignmentBlocks(assignmentPage.vaultPageId, data);

    // Update assignment page snapshot
    await db
      .update(canvasAssignmentPages)
      .set({
        instructionsSnapshot: data.instructions,
        rubricSnapshot: data.rubric,
        updatedAt: new Date(),
      })
      .where(eq(canvasAssignmentPages.id, assignmentPageId));

    return {
      pageId: assignmentPage.vaultPageId,
      blocksCreated,
      assignmentPageId,
    };
  }

  /**
   * Create content blocks for an assignment page
   */
  private async createAssignmentBlocks(pageId: string, data: AssignmentPageData): Promise<number> {
    const blocks: Array<{ type: string; content: Record<string, unknown>; sortOrder: number }> = [];
    let sortOrder = 0;

    // Header callout with key info
    blocks.push({
      type: 'callout',
      content: {
        icon: '📋',
        color: 'blue',
        text: this.formatHeaderCallout(data),
      },
      sortOrder: sortOrder++,
    });

    // Assignment Details heading
    blocks.push({
      type: 'heading_2',
      content: { text: 'Assignment Details' },
      sortOrder: sortOrder++,
    });

    // Details list
    const details = this.formatDetails(data);
    for (const detail of details) {
      blocks.push({
        type: 'bulleted_list',
        content: { text: detail },
        sortOrder: sortOrder++,
      });
    }

    // Divider
    blocks.push({
      type: 'divider',
      content: {},
      sortOrder: sortOrder++,
    });

    // Instructions section (if available)
    if (data.instructions) {
      blocks.push({
        type: 'heading_2',
        content: { text: 'Instructions' },
        sortOrder: sortOrder++,
      });

      // Split instructions into paragraphs
      const paragraphs = data.instructions.split(/\n\n+/).filter((p) => p.trim());
      for (const para of paragraphs) {
        blocks.push({
          type: 'text',
          content: { text: para.trim() },
          sortOrder: sortOrder++,
        });
      }

      blocks.push({
        type: 'divider',
        content: {},
        sortOrder: sortOrder++,
      });
    }

    // Rubric section (if available)
    if (data.rubric && data.rubric.length > 0) {
      blocks.push({
        type: 'heading_2',
        content: { text: 'Rubric' },
        sortOrder: sortOrder++,
      });

      // Create toggle for each rubric criterion
      for (const criterion of data.rubric) {
        blocks.push({
          type: 'toggle',
          content: {
            text: `${criterion.criterion} (${criterion.points} pts)`,
            description: criterion.description,
            ratings: criterion.ratings,
          },
          sortOrder: sortOrder++,
        });
      }

      // Total points
      const totalPoints = data.rubric.reduce((sum, c) => sum + c.points, 0);
      blocks.push({
        type: 'callout',
        content: {
          icon: '📊',
          color: 'gray',
          text: `**Total Rubric Points:** ${totalPoints}`,
        },
        sortOrder: sortOrder++,
      });

      blocks.push({
        type: 'divider',
        content: {},
        sortOrder: sortOrder++,
      });
    }

    // Materials section
    blocks.push({
      type: 'heading_2',
      content: { text: 'Materials' },
      sortOrder: sortOrder++,
    });

    // Get related materials
    const materials = await this.getRelatedMaterials(data.canvasItemId);
    if (materials.length > 0) {
      for (const material of materials) {
        blocks.push({
          type: 'file',
          content: {
            name: material.displayName || material.fileName,
            fileType: material.fileType,
            materialId: material.id,
            url: `/api/canvas-materials/${material.id}/view`,
          },
          sortOrder: sortOrder++,
        });
      }
    } else {
      blocks.push({
        type: 'text',
        content: { text: '_No materials attached yet_', italic: true },
        sortOrder: sortOrder++,
      });
    }

    blocks.push({
      type: 'divider',
      content: {},
      sortOrder: sortOrder++,
    });

    // Notes section
    blocks.push({
      type: 'heading_2',
      content: { text: 'My Notes' },
      sortOrder: sortOrder++,
    });

    blocks.push({
      type: 'text',
      content: { text: '', placeholder: 'Start taking notes here...' },
      sortOrder: sortOrder++,
    });

    blocks.push({
      type: 'divider',
      content: {},
      sortOrder: sortOrder++,
    });

    // Checklist section
    blocks.push({
      type: 'heading_2',
      content: { text: 'Checklist' },
      sortOrder: sortOrder++,
    });

    // Default checklist items
    const checklistItems = [
      'Read assignment instructions thoroughly',
      'Review rubric requirements',
      'Gather required materials',
      'Create outline/draft',
      'Complete first draft',
      'Review and proofread',
      'Submit assignment',
    ];

    for (const item of checklistItems) {
      blocks.push({
        type: 'todo',
        content: { text: item, checked: false },
        sortOrder: sortOrder++,
      });
    }

    // Canvas link at bottom
    if (data.url) {
      blocks.push({
        type: 'divider',
        content: {},
        sortOrder: sortOrder++,
      });

      blocks.push({
        type: 'bookmark',
        content: {
          url: data.url,
          title: 'View on Canvas',
          icon: '🔗',
        },
        sortOrder: sortOrder++,
      });
    }

    // Insert all blocks
    await db.insert(vaultBlocks).values(
      blocks.map((block) => ({
        pageId,
        type: block.type,
        content: block.content,
        sortOrder: block.sortOrder,
      }))
    );

    return blocks.length;
  }

  /**
   * Format the header callout with key assignment info
   */
  private formatHeaderCallout(data: AssignmentPageData): string {
    const parts = [];

    parts.push(`**Course:** ${data.courseName}`);

    if (data.dueAt) {
      const dueDate = new Date(data.dueAt);
      parts.push(`**Due:** ${dueDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })}`);
    }

    if (data.pointsPossible) {
      parts.push(`**Points:** ${data.pointsPossible}`);
    }

    if (data.estimatedMinutes) {
      const hours = Math.floor(data.estimatedMinutes / 60);
      const minutes = data.estimatedMinutes % 60;
      const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      parts.push(`**Est. Time:** ${timeStr}`);
    }

    return parts.join(' | ');
  }

  /**
   * Format assignment details as list items
   */
  private formatDetails(data: AssignmentPageData): string[] {
    const details = [];

    if (data.submissionTypes && data.submissionTypes.length > 0) {
      const types = data.submissionTypes.map((t) => t.replace(/_/g, ' ')).join(', ');
      details.push(`**Submission:** ${types}`);
    }

    if (data.allowedExtensions && data.allowedExtensions.length > 0) {
      details.push(`**Allowed Files:** ${data.allowedExtensions.join(', ')}`);
    }

    if (data.isGroupAssignment) {
      details.push('**Group Assignment:** Yes');
    }

    if (data.hasPeerReview) {
      details.push('**Peer Review:** Required');
    }

    return details;
  }

  /**
   * Get materials related to an assignment
   */
  private async getRelatedMaterials(canvasItemId: string) {
    const materials = await db
      .select()
      .from(canvasMaterials)
      .where(eq(canvasMaterials.canvasItemId, canvasItemId));

    return materials;
  }

  /**
   * Create a reference from page to task
   */
  private async createTaskReference(pageId: string, taskId: string): Promise<void> {
    await db.insert(vaultReferences).values({
      pageId,
      targetType: 'task',
      targetId: taskId,
    });
  }

  /**
   * Get assignment page by canvas item ID
   */
  async getAssignmentPageByCanvasItem(canvasItemId: string) {
    const [page] = await db
      .select()
      .from(canvasAssignmentPages)
      .where(eq(canvasAssignmentPages.canvasItemId, canvasItemId));

    return page || null;
  }

  /**
   * Get assignment page by task ID
   */
  async getAssignmentPageByTask(taskId: string) {
    // First find the canvas item linked to this task
    const [canvasItem] = await db
      .select()
      .from(canvasItems)
      .where(eq(canvasItems.taskId, taskId));

    if (!canvasItem) return null;

    return this.getAssignmentPageByCanvasItem(canvasItem.id);
  }

  /**
   * Get full assignment data for page creation
   */
  async getAssignmentDataForPage(canvasItemId: string): Promise<AssignmentPageData | null> {
    const [item] = await db
      .select()
      .from(canvasItems)
      .where(eq(canvasItems.id, canvasItemId));

    if (!item) return null;

    return {
      canvasItemId: item.id,
      title: item.title,
      courseName: item.courseName,
      dueAt: item.dueAt,
      pointsPossible: item.pointsPossible,
      submissionTypes: item.submissionTypes,
      allowedExtensions: item.allowedExtensions,
      instructions: item.instructions,
      instructionsHtml: item.instructionsHtml,
      rubric: item.rubric as RubricCriterion[] | null,
      estimatedMinutes: item.estimatedMinutes,
      isGroupAssignment: item.isGroupAssignment,
      hasPeerReview: item.hasPeerReview,
      url: item.url,
      taskId: item.taskId,
    };
  }

  /**
   * Create assignment pages for all assignments in a course
   */
  async createPagesForCourse(courseId: string, parentPageId?: string): Promise<number> {
    const assignments = await db
      .select()
      .from(canvasItems)
      .where(
        and(
          eq(canvasItems.courseId, courseId),
          eq(canvasItems.canvasType, 'assignment')
        )
      );

    let created = 0;
    for (const assignment of assignments) {
      const existing = await this.getAssignmentPageByCanvasItem(assignment.id);
      if (!existing) {
        const data = await this.getAssignmentDataForPage(assignment.id);
        if (data) {
          await this.createAssignmentPage(data, parentPageId);
          created++;
        }
      }
    }

    return created;
  }

  /**
   * Update user notes on an assignment page
   */
  async updateUserNotes(assignmentPageId: string, notes: string): Promise<void> {
    await db
      .update(canvasAssignmentPages)
      .set({
        userNotes: notes,
        updatedAt: new Date(),
      })
      .where(eq(canvasAssignmentPages.id, assignmentPageId));
  }

  /**
   * Get or create a course assignments folder
   */
  async getOrCreateCourseAssignmentsFolder(courseName: string): Promise<string> {
    // Look for existing folder
    const [existing] = await db
      .select()
      .from(vaultPages)
      .where(
        and(
          eq(vaultPages.title, `${courseName} Assignments`),
          eq(vaultPages.paraType, 'projects')
        )
      );

    if (existing) return existing.id;

    // Create new folder
    const [folder] = await db
      .insert(vaultPages)
      .values({
        title: `${courseName} Assignments`,
        icon: '📚',
        paraType: 'projects',
      })
      .returning();

    return folder.id;
  }
}

export const canvasAssignmentPageService = new CanvasAssignmentPageService();

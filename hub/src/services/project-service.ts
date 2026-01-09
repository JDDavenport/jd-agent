import { db } from '../db/client';
import { projects, sections, tasks } from '../db/schema';
import { eq, and, desc, asc, isNull, sql } from 'drizzle-orm';

export interface CreateProjectInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parentProjectId?: string;
  area?: string;
  context: string;
  defaultView?: 'list' | 'board' | 'calendar';
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  status?: 'active' | 'on_hold' | 'completed' | 'archived';
  isFavorite?: boolean;
  sortOrder?: number;
  defaultView?: 'list' | 'board' | 'calendar';
  targetCompletionDate?: Date | null;
}

export interface CreateSectionInput {
  projectId: string;
  name: string;
  sortOrder?: number;
}

class ProjectService {
  async list(filters?: { status?: string; area?: string; isFavorite?: boolean; name?: string; context?: string }) {
    const conditions = [];

    if (filters?.status) {
      conditions.push(eq(projects.status, filters.status));
    } else {
      // By default, exclude archived
      conditions.push(sql`${projects.status} != 'archived'`);
    }

    if (filters?.area) {
      conditions.push(eq(projects.area, filters.area));
    }

    if (filters?.isFavorite !== undefined) {
      conditions.push(eq(projects.isFavorite, filters.isFavorite));
    }

    if (filters?.name) {
      conditions.push(eq(projects.name, filters.name));
    }

    if (filters?.context) {
      conditions.push(eq(projects.context, filters.context));
    }

    const result = await db
      .select()
      .from(projects)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(projects.isFavorite), asc(projects.sortOrder), asc(projects.name));

    return result;
  }

  async getById(id: string) {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);

    return project || null;
  }

  async create(input: CreateProjectInput) {
    const [project] = await db
      .insert(projects)
      .values({
        name: input.name,
        description: input.description,
        color: input.color || '#808080',
        icon: input.icon,
        parentProjectId: input.parentProjectId,
        area: input.area,
        context: input.context,
        defaultView: input.defaultView || 'list',
      })
      .returning();

    return project;
  }

  async update(id: string, input: UpdateProjectInput) {
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.color !== undefined) updateData.color = input.color;
    if (input.icon !== undefined) updateData.icon = input.icon;
    if (input.status !== undefined) {
      updateData.status = input.status;
      if (input.status === 'completed') {
        updateData.completedAt = new Date();
      }
      if (input.status === 'archived') {
        updateData.archivedAt = new Date();
      }
    }
    if (input.isFavorite !== undefined) updateData.isFavorite = input.isFavorite;
    if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;
    if (input.defaultView !== undefined) updateData.defaultView = input.defaultView;
    if (input.targetCompletionDate !== undefined) {
      updateData.targetCompletionDate = input.targetCompletionDate;
    }

    const [project] = await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, id))
      .returning();

    return project || null;
  }

  async delete(id: string) {
    const [deleted] = await db
      .delete(projects)
      .where(eq(projects.id, id))
      .returning({ id: projects.id });

    return !!deleted;
  }

  async archive(id: string) {
    return this.update(id, { status: 'archived' });
  }

  async complete(id: string) {
    return this.update(id, { status: 'completed' });
  }

  // Sections
  async listSections(projectId: string) {
    return db
      .select()
      .from(sections)
      .where(eq(sections.projectId, projectId))
      .orderBy(asc(sections.sortOrder));
  }

  async createSection(input: CreateSectionInput) {
    // Get max sort order for project
    const existing = await db
      .select({ maxOrder: sql<number>`COALESCE(MAX(${sections.sortOrder}), -1)` })
      .from(sections)
      .where(eq(sections.projectId, input.projectId));

    const sortOrder = input.sortOrder ?? (existing[0]?.maxOrder ?? -1) + 1;

    const [section] = await db
      .insert(sections)
      .values({
        projectId: input.projectId,
        name: input.name,
        sortOrder,
      })
      .returning();

    return section;
  }

  async updateSection(id: string, input: { name?: string; sortOrder?: number; isCollapsed?: boolean }) {
    const updateData: Record<string, any> = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;
    if (input.isCollapsed !== undefined) updateData.isCollapsed = input.isCollapsed;

    const [section] = await db
      .update(sections)
      .set(updateData)
      .where(eq(sections.id, id))
      .returning();

    return section || null;
  }

  async deleteSection(id: string) {
    // Move tasks in this section to no section
    await db
      .update(tasks)
      .set({ sectionId: null })
      .where(eq(tasks.sectionId, id));

    const [deleted] = await db
      .delete(sections)
      .where(eq(sections.id, id))
      .returning({ id: sections.id });

    return !!deleted;
  }

  // Get project with task counts
  async getWithStats(id: string) {
    const project = await this.getById(id);
    if (!project) return null;

    const [stats] = await db
      .select({
        totalTasks: sql<number>`COUNT(*)`,
        completedTasks: sql<number>`SUM(CASE WHEN ${tasks.status} = 'done' THEN 1 ELSE 0 END)`,
      })
      .from(tasks)
      .where(eq(tasks.projectId, id));

    return {
      ...project,
      stats: {
        totalTasks: stats?.totalTasks ?? 0,
        completedTasks: stats?.completedTasks ?? 0,
      },
    };
  }
}

export const projectService = new ProjectService();

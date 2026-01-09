import { eq, asc } from 'drizzle-orm';
import { db } from '../db/client';
import { contexts } from '../db/schema';

export interface CreateContextInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdateContextInput {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  isActive?: boolean;
  sortOrder?: number;
}

class ContextService {
  async list() {
    return db
      .select()
      .from(contexts)
      .orderBy(asc(contexts.sortOrder), asc(contexts.name));
  }

  async getById(id: string) {
    const result = await db
      .select()
      .from(contexts)
      .where(eq(contexts.id, id))
      .limit(1);
    return result[0] || null;
  }

  async getByName(name: string) {
    const result = await db
      .select()
      .from(contexts)
      .where(eq(contexts.name, name))
      .limit(1);
    return result[0] || null;
  }

  async create(input: CreateContextInput) {
    const [context] = await db
      .insert(contexts)
      .values({
        name: input.name.startsWith('@') ? input.name : `@${input.name}`,
        description: input.description,
        color: input.color,
        icon: input.icon,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
      })
      .returning();
    return context;
  }

  async update(id: string, input: UpdateContextInput) {
    const [updated] = await db
      .update(contexts)
      .set({
        ...input,
        name: input.name
          ? input.name.startsWith('@')
            ? input.name
            : `@${input.name}`
          : undefined,
      })
      .where(eq(contexts.id, id))
      .returning();
    return updated;
  }

  async delete(id: string) {
    const [deleted] = await db
      .delete(contexts)
      .where(eq(contexts.id, id))
      .returning();
    return deleted;
  }

  async reorder(ids: string[]) {
    for (let i = 0; i < ids.length; i++) {
      await db
        .update(contexts)
        .set({ sortOrder: i })
        .where(eq(contexts.id, ids[i]));
    }
  }
}

export const contextService = new ContextService();

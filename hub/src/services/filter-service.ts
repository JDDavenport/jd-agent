import { eq, asc } from 'drizzle-orm';
import { db } from '../db/client';
import { filters } from '../db/schema';

export interface CreateFilterInput {
  name: string;
  query: string;
  color?: string;
  icon?: string;
  isFavorite?: boolean;
  sortOrder?: number;
}

export interface UpdateFilterInput {
  name?: string;
  query?: string;
  color?: string;
  icon?: string;
  isFavorite?: boolean;
  sortOrder?: number;
}

class FilterService {
  async list() {
    return db
      .select()
      .from(filters)
      .orderBy(asc(filters.sortOrder), asc(filters.name));
  }

  async getById(id: string) {
    const result = await db
      .select()
      .from(filters)
      .where(eq(filters.id, id))
      .limit(1);
    return result[0] || null;
  }

  async create(input: CreateFilterInput) {
    const [filter] = await db
      .insert(filters)
      .values({
        name: input.name,
        query: input.query,
        color: input.color,
        icon: input.icon,
        isFavorite: input.isFavorite ?? false,
        sortOrder: input.sortOrder ?? 0,
      })
      .returning();
    return filter;
  }

  async update(id: string, input: UpdateFilterInput) {
    const [updated] = await db
      .update(filters)
      .set(input)
      .where(eq(filters.id, id))
      .returning();
    return updated;
  }

  async delete(id: string) {
    const [deleted] = await db
      .delete(filters)
      .where(eq(filters.id, id))
      .returning();
    return deleted;
  }

  async reorder(ids: string[]) {
    for (let i = 0; i < ids.length; i++) {
      await db
        .update(filters)
        .set({ sortOrder: i })
        .where(eq(filters.id, ids[i]));
    }
  }
}

export const filterService = new FilterService();

import { eq, asc } from 'drizzle-orm';
import { db } from '../db/client';
import { labels } from '../db/schema';

export interface CreateLabelInput {
  name: string;
  color?: string;
  isFavorite?: boolean;
  sortOrder?: number;
}

export interface UpdateLabelInput {
  name?: string;
  color?: string;
  isFavorite?: boolean;
  sortOrder?: number;
}

class LabelService {
  async list() {
    return db
      .select()
      .from(labels)
      .orderBy(asc(labels.sortOrder), asc(labels.name));
  }

  async getById(id: string) {
    const result = await db
      .select()
      .from(labels)
      .where(eq(labels.id, id))
      .limit(1);
    return result[0] || null;
  }

  async getByName(name: string) {
    const result = await db
      .select()
      .from(labels)
      .where(eq(labels.name, name))
      .limit(1);
    return result[0] || null;
  }

  async create(input: CreateLabelInput) {
    const [label] = await db
      .insert(labels)
      .values({
        name: input.name,
        color: input.color ?? '#808080',
        isFavorite: input.isFavorite ?? false,
        sortOrder: input.sortOrder ?? 0,
      })
      .returning();
    return label;
  }

  async update(id: string, input: UpdateLabelInput) {
    const [updated] = await db
      .update(labels)
      .set(input)
      .where(eq(labels.id, id))
      .returning();
    return updated;
  }

  async delete(id: string) {
    const [deleted] = await db
      .delete(labels)
      .where(eq(labels.id, id))
      .returning();
    return deleted;
  }

  async reorder(ids: string[]) {
    for (let i = 0; i < ids.length; i++) {
      await db
        .update(labels)
        .set({ sortOrder: i })
        .where(eq(labels.id, ids[i]));
    }
  }
}

export const labelService = new LabelService();

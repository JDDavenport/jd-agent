import { eq, desc, ilike, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { people, interactions } from '../db/schema';

export interface CreatePersonInput {
  name: string;
  email?: string;
  phone?: string;
  howMet?: string;
  whereMet?: string;
  firstMetDate?: string;
  relationshipType?: string;
  keyFacts?: string[];
  notes?: string;
}

export interface UpdatePersonInput {
  name?: string;
  email?: string;
  phone?: string;
  howMet?: string;
  whereMet?: string;
  firstMetDate?: string;
  relationshipType?: string;
  keyFacts?: string[];
  notes?: string;
  lastInteractionDate?: string;
}

export interface CreateInteractionInput {
  personId: string;
  interactionDate: string;
  interactionType?: string;
  summary?: string;
  recordingId?: string;
  vaultEntryId?: string;
  commitmentsByThem?: string[];
  commitmentsByMe?: string[];
}

class PeopleService {
  async list(search?: string) {
    if (search) {
      return db
        .select()
        .from(people)
        .where(ilike(people.name, `%${search}%`))
        .orderBy(desc(people.lastInteractionDate), people.name);
    }
    return db
      .select()
      .from(people)
      .orderBy(desc(people.lastInteractionDate), people.name);
  }

  async getById(id: string) {
    const result = await db
      .select()
      .from(people)
      .where(eq(people.id, id))
      .limit(1);
    return result[0] || null;
  }

  async getWithInteractions(id: string) {
    const person = await this.getById(id);
    if (!person) return null;

    const personInteractions = await db
      .select()
      .from(interactions)
      .where(eq(interactions.personId, id))
      .orderBy(desc(interactions.interactionDate));

    return { ...person, interactions: personInteractions };
  }

  async create(input: CreatePersonInput) {
    const [person] = await db
      .insert(people)
      .values({
        name: input.name,
        email: input.email,
        phone: input.phone,
        howMet: input.howMet,
        whereMet: input.whereMet,
        firstMetDate: input.firstMetDate,
        relationshipType: input.relationshipType,
        keyFacts: input.keyFacts,
        notes: input.notes,
      })
      .returning();
    return person;
  }

  async update(id: string, input: UpdatePersonInput) {
    const [updated] = await db
      .update(people)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(people.id, id))
      .returning();
    return updated;
  }

  async delete(id: string) {
    const [deleted] = await db
      .delete(people)
      .where(eq(people.id, id))
      .returning();
    return deleted;
  }

  async addInteraction(input: CreateInteractionInput) {
    const [interaction] = await db
      .insert(interactions)
      .values({
        personId: input.personId,
        interactionDate: new Date(input.interactionDate),
        interactionType: input.interactionType,
        summary: input.summary,
        recordingId: input.recordingId,
        vaultEntryId: input.vaultEntryId,
        commitmentsByThem: input.commitmentsByThem,
        commitmentsByMe: input.commitmentsByMe,
      })
      .returning();

    // Update person's last interaction and count
    await db
      .update(people)
      .set({
        lastInteractionDate: input.interactionDate,
        interactionCount: sql`${people.interactionCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(people.id, input.personId));

    return interaction;
  }

  async getInteractions(personId: string) {
    return db
      .select()
      .from(interactions)
      .where(eq(interactions.personId, personId))
      .orderBy(desc(interactions.interactionDate));
  }
}

export const peopleService = new PeopleService();

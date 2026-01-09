/**
 * Voice Profile Service
 *
 * Manages voice profiles for speaker identification and speaker-to-name mapping.
 * Part of Phase 1 of the VIP Pipeline implementation.
 */

import { db } from '../db/client';
import { voiceProfiles, speakerMappings, transcripts, people } from '../db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';

export type VoiceProfileCategory = 'self' | 'family' | 'teacher' | 'classmate' | 'colleague' | 'other';

export interface CreateVoiceProfileInput {
  name: string;
  category: VoiceProfileCategory;
  personId?: string;
  notes?: string;
}

export interface UpdateVoiceProfileInput {
  name?: string;
  category?: VoiceProfileCategory;
  personId?: string | null;
  notes?: string | null;
  isActive?: boolean;
  confidenceThreshold?: number;
}

export interface AssignSpeakerInput {
  transcriptId: string;
  deepgramSpeakerId: number;
  voiceProfileId: string;
  confidence?: number;
}

export interface VoiceProfile {
  id: string;
  name: string;
  personId: string | null;
  category: string;
  sampleCount: number;
  totalDurationSeconds: number;
  isActive: boolean;
  confidenceThreshold: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  person?: {
    id: string;
    name: string;
  } | null;
}

export interface SpeakerMapping {
  id: string;
  transcriptId: string;
  deepgramSpeakerId: number;
  voiceProfileId: string | null;
  confidence: number | null;
  manuallyAssigned: boolean;
  assignedAt: Date | null;
  assignedBy: string | null;
  createdAt: Date;
  voiceProfile?: VoiceProfile | null;
}

export interface TranscriptSpeakers {
  transcriptId: string;
  speakerCount: number;
  speakers: Array<{
    deepgramSpeakerId: number;
    mapping: SpeakerMapping | null;
  }>;
}

class VoiceProfileService {
  /**
   * Create a new voice profile
   */
  async createProfile(input: CreateVoiceProfileInput): Promise<VoiceProfile> {
    const [profile] = await db
      .insert(voiceProfiles)
      .values({
        name: input.name,
        category: input.category,
        personId: input.personId || null,
        notes: input.notes || null,
      })
      .returning();

    return this.getProfile(profile.id) as Promise<VoiceProfile>;
  }

  /**
   * Get a voice profile by ID
   */
  async getProfile(id: string): Promise<VoiceProfile | null> {
    const [profile] = await db
      .select()
      .from(voiceProfiles)
      .where(eq(voiceProfiles.id, id));

    if (!profile) return null;

    // Get linked person if exists
    let person = null;
    if (profile.personId) {
      const [p] = await db
        .select({ id: people.id, name: people.name })
        .from(people)
        .where(eq(people.id, profile.personId));
      person = p || null;
    }

    return {
      ...profile,
      person,
    };
  }

  /**
   * List all voice profiles
   */
  async listProfiles(options?: {
    category?: VoiceProfileCategory;
    activeOnly?: boolean;
  }): Promise<VoiceProfile[]> {
    let query = db.select().from(voiceProfiles);

    const conditions = [];
    if (options?.category) {
      conditions.push(eq(voiceProfiles.category, options.category));
    }
    if (options?.activeOnly) {
      conditions.push(eq(voiceProfiles.isActive, true));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const profiles = await query.orderBy(desc(voiceProfiles.createdAt));

    // Fetch linked people
    const personIds = profiles.filter(p => p.personId).map(p => p.personId!);
    const peopleMap = new Map<string, { id: string; name: string }>();

    if (personIds.length > 0) {
      const peopleData = await db
        .select({ id: people.id, name: people.name })
        .from(people)
        .where(sql`${people.id} = ANY(${personIds})`);

      for (const p of peopleData) {
        peopleMap.set(p.id, p);
      }
    }

    return profiles.map(profile => ({
      ...profile,
      person: profile.personId ? peopleMap.get(profile.personId) || null : null,
    }));
  }

  /**
   * Update a voice profile
   */
  async updateProfile(id: string, input: UpdateVoiceProfileInput): Promise<VoiceProfile | null> {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.personId !== undefined) updateData.personId = input.personId;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;
    if (input.confidenceThreshold !== undefined) updateData.confidenceThreshold = input.confidenceThreshold;

    const [updated] = await db
      .update(voiceProfiles)
      .set(updateData)
      .where(eq(voiceProfiles.id, id))
      .returning();

    if (!updated) return null;

    return this.getProfile(id);
  }

  /**
   * Delete a voice profile
   */
  async deleteProfile(id: string): Promise<boolean> {
    const result = await db
      .delete(voiceProfiles)
      .where(eq(voiceProfiles.id, id))
      .returning({ id: voiceProfiles.id });

    return result.length > 0;
  }

  /**
   * Get speaker mappings for a transcript
   */
  async getTranscriptSpeakers(transcriptId: string): Promise<TranscriptSpeakers | null> {
    // Get the transcript to find speaker count
    const [transcript] = await db
      .select()
      .from(transcripts)
      .where(eq(transcripts.id, transcriptId));

    if (!transcript) return null;

    // Get existing mappings
    const mappings = await db
      .select()
      .from(speakerMappings)
      .where(eq(speakerMappings.transcriptId, transcriptId));

    // Get voice profiles for mappings
    const profileIds = mappings.filter(m => m.voiceProfileId).map(m => m.voiceProfileId!);
    const profilesMap = new Map<string, VoiceProfile>();

    if (profileIds.length > 0) {
      const profiles = await this.listProfiles();
      for (const p of profiles) {
        if (profileIds.includes(p.id)) {
          profilesMap.set(p.id, p);
        }
      }
    }

    // Build speaker list based on transcript's speakerCount
    const speakerCount = transcript.speakerCount || 0;
    const speakers: Array<{ deepgramSpeakerId: number; mapping: SpeakerMapping | null }> = [];

    for (let i = 0; i < speakerCount; i++) {
      const mapping = mappings.find(m => m.deepgramSpeakerId === i);
      speakers.push({
        deepgramSpeakerId: i,
        mapping: mapping
          ? {
              ...mapping,
              voiceProfile: mapping.voiceProfileId
                ? profilesMap.get(mapping.voiceProfileId) || null
                : null,
            }
          : null,
      });
    }

    return {
      transcriptId,
      speakerCount,
      speakers,
    };
  }

  /**
   * Assign a speaker to a voice profile
   */
  async assignSpeaker(input: AssignSpeakerInput): Promise<SpeakerMapping> {
    // Check if mapping already exists
    const [existing] = await db
      .select()
      .from(speakerMappings)
      .where(
        and(
          eq(speakerMappings.transcriptId, input.transcriptId),
          eq(speakerMappings.deepgramSpeakerId, input.deepgramSpeakerId)
        )
      );

    if (existing) {
      // Update existing mapping
      const [updated] = await db
        .update(speakerMappings)
        .set({
          voiceProfileId: input.voiceProfileId,
          confidence: input.confidence || null,
          manuallyAssigned: true,
          assignedAt: new Date(),
          assignedBy: 'user',
        })
        .where(eq(speakerMappings.id, existing.id))
        .returning();

      return updated;
    }

    // Create new mapping
    const [mapping] = await db
      .insert(speakerMappings)
      .values({
        transcriptId: input.transcriptId,
        deepgramSpeakerId: input.deepgramSpeakerId,
        voiceProfileId: input.voiceProfileId,
        confidence: input.confidence || null,
        manuallyAssigned: true,
        assignedAt: new Date(),
        assignedBy: 'user',
      })
      .returning();

    return mapping;
  }

  /**
   * Remove speaker assignment
   */
  async unassignSpeaker(transcriptId: string, deepgramSpeakerId: number): Promise<boolean> {
    const result = await db
      .delete(speakerMappings)
      .where(
        and(
          eq(speakerMappings.transcriptId, transcriptId),
          eq(speakerMappings.deepgramSpeakerId, deepgramSpeakerId)
        )
      )
      .returning({ id: speakerMappings.id });

    return result.length > 0;
  }

  /**
   * Initialize speaker mappings for a transcript
   * Creates empty mapping entries for each speaker detected
   */
  async initializeSpeakerMappings(transcriptId: string): Promise<void> {
    const [transcript] = await db
      .select()
      .from(transcripts)
      .where(eq(transcripts.id, transcriptId));

    if (!transcript || !transcript.speakerCount) return;

    // Check for existing mappings
    const existing = await db
      .select()
      .from(speakerMappings)
      .where(eq(speakerMappings.transcriptId, transcriptId));

    const existingSpeakerIds = new Set(existing.map(m => m.deepgramSpeakerId));

    // Create mappings for speakers that don't have them
    const newMappings = [];
    for (let i = 0; i < transcript.speakerCount; i++) {
      if (!existingSpeakerIds.has(i)) {
        newMappings.push({
          transcriptId,
          deepgramSpeakerId: i,
          voiceProfileId: null,
          confidence: null,
          manuallyAssigned: false,
        });
      }
    }

    if (newMappings.length > 0) {
      await db.insert(speakerMappings).values(newMappings);
    }
  }

  /**
   * Update voice profile statistics after a speaker assignment
   */
  async updateProfileStats(voiceProfileId: string): Promise<void> {
    // Count all mappings for this profile
    const mappings = await db
      .select()
      .from(speakerMappings)
      .where(eq(speakerMappings.voiceProfileId, voiceProfileId));

    // Get transcript durations
    const transcriptIds = [...new Set(mappings.map(m => m.transcriptId))];
    let totalDuration = 0;

    if (transcriptIds.length > 0) {
      const transcriptData = await db
        .select({ id: transcripts.id, recordingId: transcripts.recordingId })
        .from(transcripts)
        .where(sql`${transcripts.id} = ANY(${transcriptIds})`);

      // For now, just use sample count. Duration calculation would need recording data.
      totalDuration = transcriptData.length * 60; // Estimate 60 seconds per transcript
    }

    await db
      .update(voiceProfiles)
      .set({
        sampleCount: mappings.length,
        totalDurationSeconds: totalDuration,
        updatedAt: new Date(),
      })
      .where(eq(voiceProfiles.id, voiceProfileId));
  }

  /**
   * Get the "self" voice profile (JD's own voice)
   */
  async getSelfProfile(): Promise<VoiceProfile | null> {
    const [profile] = await db
      .select()
      .from(voiceProfiles)
      .where(and(eq(voiceProfiles.category, 'self'), eq(voiceProfiles.isActive, true)));

    if (!profile) return null;

    return this.getProfile(profile.id);
  }

  /**
   * Create the initial "self" profile for JD
   */
  async createSelfProfile(name: string = 'JD'): Promise<VoiceProfile> {
    const existing = await this.getSelfProfile();
    if (existing) {
      return existing;
    }

    return this.createProfile({
      name,
      category: 'self',
      notes: 'Primary user voice profile',
    });
  }
}

export const voiceProfileService = new VoiceProfileService();

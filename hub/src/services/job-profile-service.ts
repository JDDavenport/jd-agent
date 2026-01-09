import { eq, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { jobProfile, screeningAnswers } from '../db/schema';
import type {
  JobProfile,
  ScreeningAnswer,
  ScreeningCategory,
  UpdateJobProfileInput,
  CreateScreeningAnswerInput,
} from '@jd-agent/types';

// ============================================
// Job Profile Service
// ============================================

export class JobProfileService {
  /**
   * Get the job profile (creates one if it doesn't exist)
   */
  async get(): Promise<JobProfile> {
    const [profile] = await db.select().from(jobProfile).limit(1);

    if (!profile) {
      // Create default profile
      const [newProfile] = await db
        .insert(jobProfile)
        .values({
          autoApplyEnabled: false,
          autoApplyThreshold: 85,
          dailyApplicationLimit: 10,
          willingToRelocate: false,
        })
        .returning();

      return this.mapToJobProfile(newProfile);
    }

    return this.mapToJobProfile(profile);
  }

  /**
   * Update the job profile
   */
  async update(input: UpdateJobProfileInput): Promise<JobProfile> {
    // Get existing profile (creates if doesn't exist)
    const existing = await this.get();

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (input.targetTitles !== undefined) updateData.targetTitles = input.targetTitles;
    if (input.targetCompanies !== undefined) updateData.targetCompanies = input.targetCompanies;
    if (input.excludeCompanies !== undefined) updateData.excludeCompanies = input.excludeCompanies;
    if (input.minSalary !== undefined) updateData.minSalary = input.minSalary;
    if (input.maxSalary !== undefined) updateData.maxSalary = input.maxSalary;
    if (input.preferredLocations !== undefined) updateData.preferredLocations = input.preferredLocations;
    if (input.remotePreference !== undefined) updateData.remotePreference = input.remotePreference;
    if (input.willingToRelocate !== undefined) updateData.willingToRelocate = input.willingToRelocate;
    if (input.yearsExperience !== undefined) updateData.yearsExperience = input.yearsExperience;
    if (input.skills !== undefined) updateData.skills = input.skills;
    if (input.industries !== undefined) updateData.industries = input.industries;
    if (input.autoApplyEnabled !== undefined) updateData.autoApplyEnabled = input.autoApplyEnabled;
    if (input.autoApplyThreshold !== undefined) updateData.autoApplyThreshold = input.autoApplyThreshold;
    if (input.dailyApplicationLimit !== undefined) updateData.dailyApplicationLimit = input.dailyApplicationLimit;

    await db.update(jobProfile).set(updateData).where(eq(jobProfile.id, existing.id));

    return this.get();
  }

  /**
   * Create a screening answer
   */
  async createScreeningAnswer(input: CreateScreeningAnswerInput): Promise<ScreeningAnswer> {
    // If this is set as default for category, unset others
    if (input.isDefault && input.category) {
      await db
        .update(screeningAnswers)
        .set({ isDefault: false })
        .where(eq(screeningAnswers.category, input.category));
    }

    const [answer] = await db
      .insert(screeningAnswers)
      .values({
        questionPattern: input.questionPattern,
        answer: input.answer,
        category: input.category,
        isDefault: input.isDefault ?? false,
      })
      .returning();

    return this.mapToScreeningAnswer(answer);
  }

  /**
   * List all screening answers
   */
  async listScreeningAnswers(): Promise<ScreeningAnswer[]> {
    const results = await db
      .select()
      .from(screeningAnswers)
      .orderBy(desc(screeningAnswers.isDefault), desc(screeningAnswers.createdAt));

    return results.map((a) => this.mapToScreeningAnswer(a));
  }

  /**
   * Get screening answers by category
   */
  async getScreeningAnswersByCategory(category: ScreeningCategory): Promise<ScreeningAnswer[]> {
    const results = await db
      .select()
      .from(screeningAnswers)
      .where(eq(screeningAnswers.category, category))
      .orderBy(desc(screeningAnswers.isDefault));

    return results.map((a) => this.mapToScreeningAnswer(a));
  }

  /**
   * Get a screening answer by ID
   */
  async getScreeningAnswerById(id: string): Promise<ScreeningAnswer | null> {
    const [answer] = await db
      .select()
      .from(screeningAnswers)
      .where(eq(screeningAnswers.id, id))
      .limit(1);

    if (!answer) return null;
    return this.mapToScreeningAnswer(answer);
  }

  /**
   * Update a screening answer
   */
  async updateScreeningAnswer(
    id: string,
    input: Partial<CreateScreeningAnswerInput>
  ): Promise<ScreeningAnswer | null> {
    const existing = await this.getScreeningAnswerById(id);
    if (!existing) return null;

    // If this is set as default for category, unset others
    if (input.isDefault && (input.category || existing.category)) {
      const category = input.category || existing.category;
      await db
        .update(screeningAnswers)
        .set({ isDefault: false })
        .where(eq(screeningAnswers.category, category!));
    }

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (input.questionPattern !== undefined) updateData.questionPattern = input.questionPattern;
    if (input.answer !== undefined) updateData.answer = input.answer;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.isDefault !== undefined) updateData.isDefault = input.isDefault;

    await db.update(screeningAnswers).set(updateData).where(eq(screeningAnswers.id, id));

    return this.getScreeningAnswerById(id);
  }

  /**
   * Delete a screening answer
   */
  async deleteScreeningAnswer(id: string): Promise<boolean> {
    const result = await db
      .delete(screeningAnswers)
      .where(eq(screeningAnswers.id, id))
      .returning({ id: screeningAnswers.id });

    return result.length > 0;
  }

  /**
   * Find matching screening answer for a question
   */
  async findAnswerForQuestion(question: string): Promise<ScreeningAnswer | null> {
    const allAnswers = await this.listScreeningAnswers();
    const questionLower = question.toLowerCase();

    for (const answer of allAnswers) {
      const pattern = answer.questionPattern.toLowerCase();

      // Check if pattern matches as keywords or regex
      if (questionLower.includes(pattern)) {
        return answer;
      }

      // Try as regex
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(question)) {
          return answer;
        }
      } catch {
        // Not a valid regex, skip
      }
    }

    return null;
  }

  /**
   * Map database result to JobProfile type
   */
  private mapToJobProfile(row: any): JobProfile {
    return {
      id: row.id,
      targetTitles: row.targetTitles,
      targetCompanies: row.targetCompanies,
      excludeCompanies: row.excludeCompanies,
      minSalary: row.minSalary,
      maxSalary: row.maxSalary,
      preferredLocations: row.preferredLocations,
      remotePreference: row.remotePreference,
      willingToRelocate: row.willingToRelocate,
      yearsExperience: row.yearsExperience,
      skills: row.skills,
      industries: row.industries,
      autoApplyEnabled: row.autoApplyEnabled,
      autoApplyThreshold: row.autoApplyThreshold,
      dailyApplicationLimit: row.dailyApplicationLimit,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Map database result to ScreeningAnswer type
   */
  private mapToScreeningAnswer(row: any): ScreeningAnswer {
    return {
      id: row.id,
      questionPattern: row.questionPattern,
      answer: row.answer,
      category: row.category as ScreeningCategory | undefined,
      isDefault: row.isDefault,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

// Export singleton instance
export const jobProfileService = new JobProfileService();

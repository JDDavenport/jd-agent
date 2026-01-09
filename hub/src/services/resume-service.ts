import { eq, desc } from 'drizzle-orm';
import { db } from '../db/client';
import { resumeMetadata, jobs } from '../db/schema';
import type {
  ResumeMetadata,
  ResumeExperience,
  CreateResumeInput,
  UpdateResumeInput,
} from '@jd-agent/types';

// ============================================
// Resume Service
// ============================================

export class ResumeService {
  /**
   * Create a new resume entry
   */
  async create(input: CreateResumeInput): Promise<ResumeMetadata> {
    // If this is set as default, unset other defaults first
    if (input.isDefault) {
      await db
        .update(resumeMetadata)
        .set({ isDefault: false })
        .where(eq(resumeMetadata.isDefault, true));
    }

    const [resume] = await db
      .insert(resumeMetadata)
      .values({
        name: input.name,
        variant: input.variant,
        filePath: input.filePath,
        fileType: input.fileType,
        isDefault: input.isDefault ?? false,
        extractedSkills: input.extractedSkills,
        extractedExperience: input.extractedExperience as any,
      })
      .returning();

    return this.mapToResumeMetadata(resume);
  }

  /**
   * Get a resume by ID
   */
  async getById(id: string): Promise<ResumeMetadata | null> {
    const [resume] = await db
      .select()
      .from(resumeMetadata)
      .where(eq(resumeMetadata.id, id))
      .limit(1);

    if (!resume) return null;
    return this.mapToResumeMetadata(resume);
  }

  /**
   * Get the default resume
   */
  async getDefault(): Promise<ResumeMetadata | null> {
    const [resume] = await db
      .select()
      .from(resumeMetadata)
      .where(eq(resumeMetadata.isDefault, true))
      .limit(1);

    if (!resume) {
      // If no default, return the most recently created
      const [fallback] = await db
        .select()
        .from(resumeMetadata)
        .orderBy(desc(resumeMetadata.createdAt))
        .limit(1);

      if (!fallback) return null;
      return this.mapToResumeMetadata(fallback);
    }

    return this.mapToResumeMetadata(resume);
  }

  /**
   * List all resumes
   */
  async list(): Promise<ResumeMetadata[]> {
    const results = await db
      .select()
      .from(resumeMetadata)
      .orderBy(desc(resumeMetadata.isDefault), desc(resumeMetadata.createdAt));

    return results.map((r) => this.mapToResumeMetadata(r));
  }

  /**
   * Update a resume
   */
  async update(id: string, input: UpdateResumeInput): Promise<ResumeMetadata | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    // If setting as default, unset other defaults first
    if (input.isDefault) {
      await db
        .update(resumeMetadata)
        .set({ isDefault: false })
        .where(eq(resumeMetadata.isDefault, true));
    }

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.variant !== undefined) updateData.variant = input.variant;
    if (input.isDefault !== undefined) updateData.isDefault = input.isDefault;
    if (input.extractedSkills !== undefined) updateData.extractedSkills = input.extractedSkills;
    if (input.extractedExperience !== undefined) updateData.extractedExperience = input.extractedExperience;

    await db
      .update(resumeMetadata)
      .set(updateData)
      .where(eq(resumeMetadata.id, id));

    return this.getById(id);
  }

  /**
   * Set a resume as default
   */
  async setDefault(id: string): Promise<ResumeMetadata | null> {
    // Unset current default
    await db
      .update(resumeMetadata)
      .set({ isDefault: false })
      .where(eq(resumeMetadata.isDefault, true));

    // Set new default
    await db
      .update(resumeMetadata)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(resumeMetadata.id, id));

    return this.getById(id);
  }

  /**
   * Delete a resume
   */
  async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(resumeMetadata)
      .where(eq(resumeMetadata.id, id))
      .returning({ id: resumeMetadata.id });

    return result.length > 0;
  }

  /**
   * Mark resume as used for a job application
   */
  async markUsed(id: string): Promise<void> {
    await db
      .update(resumeMetadata)
      .set({ lastUsed: new Date(), updatedAt: new Date() })
      .where(eq(resumeMetadata.id, id));
  }

  /**
   * Get resumes by variant
   */
  async getByVariant(variant: string): Promise<ResumeMetadata[]> {
    const results = await db
      .select()
      .from(resumeMetadata)
      .where(eq(resumeMetadata.variant, variant))
      .orderBy(desc(resumeMetadata.lastUsed));

    return results.map((r) => this.mapToResumeMetadata(r));
  }

  /**
   * Select best resume for a job based on requirements
   * Returns the most suitable resume variant for the job
   */
  async selectForJob(jobId: string): Promise<ResumeMetadata | null> {
    // Get the job to understand requirements
    const [job] = await db
      .select()
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);

    if (!job) return this.getDefault();

    // Get all resumes
    const allResumes = await this.list();
    if (allResumes.length === 0) return null;
    if (allResumes.length === 1) return allResumes[0];

    // Simple matching: find resume with most skill overlap
    const jobRequirements = job.requirements || [];
    const jobTitle = job.title.toLowerCase();
    const jobDescription = (job.description || '').toLowerCase();

    let bestResume = allResumes[0];
    let bestScore = 0;

    for (const resume of allResumes) {
      let score = 0;

      // Variant matching
      if (resume.variant) {
        const variant = resume.variant.toLowerCase();
        if (jobTitle.includes(variant) || jobDescription.includes(variant)) {
          score += 10;
        }
      }

      // Skill matching
      if (resume.extractedSkills) {
        for (const skill of resume.extractedSkills) {
          const skillLower = skill.toLowerCase();
          if (
            jobRequirements.some((req) => req.toLowerCase().includes(skillLower)) ||
            jobDescription.includes(skillLower)
          ) {
            score += 2;
          }
        }
      }

      // Prefer default if scores are equal
      if (resume.isDefault) {
        score += 1;
      }

      if (score > bestScore) {
        bestScore = score;
        bestResume = resume;
      }
    }

    return bestResume;
  }

  /**
   * Map database result to ResumeMetadata type
   */
  private mapToResumeMetadata(row: any): ResumeMetadata {
    return {
      id: row.id,
      name: row.name,
      variant: row.variant,
      filePath: row.filePath,
      fileType: row.fileType,
      isDefault: row.isDefault,
      extractedSkills: row.extractedSkills,
      extractedExperience: row.extractedExperience as ResumeExperience[] | undefined,
      lastUsed: row.lastUsed?.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

// Export singleton instance
export const resumeService = new ResumeService();

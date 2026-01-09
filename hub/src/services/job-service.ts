import { eq, and, gte, lte, desc, asc, sql, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { jobs, applicationHistory, resumeMetadata, vaultEntries } from '../db/schema';
import type {
  JobStatus,
  JobPlatform,
  LocationType,
  JobContact,
  Interview,
  CreateJobInput,
  UpdateJobInput,
  ManualJobInput,
  JobFilters,
  JobStats,
} from '@jd-agent/types';

// ============================================
// Types
// ============================================

export interface JobWithResume {
  id: string;
  company: string;
  title: string;
  location: string | null;
  locationType: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryType: string | null;
  description: string | null;
  requirements: string[] | null;
  benefits: string[] | null;
  url: string | null;
  platform: string | null;
  platformJobId: string | null;
  status: string;
  matchScore: number | null;
  matchReason: string | null;
  appliedAt: Date | null;
  appliedVia: string | null;
  resumeUsedId: string | null;
  coverLetter: string | null;
  notes: string | null;
  nextFollowUp: Date | null;
  contacts: JobContact[] | null;
  interviews: Interview[] | null;
  vaultEntryId: string | null;
  createdAt: Date;
  updatedAt: Date;
  resume?: {
    id: string;
    name: string;
    variant: string | null;
  } | null;
}

// ============================================
// Job Service
// ============================================

export class JobService {
  /**
   * Create a new job entry
   */
  async create(input: CreateJobInput): Promise<JobWithResume> {
    const [job] = await db
      .insert(jobs)
      .values({
        company: input.company,
        title: input.title,
        location: input.location,
        locationType: input.locationType,
        salaryMin: input.salaryMin,
        salaryMax: input.salaryMax,
        salaryType: input.salaryType,
        description: input.description,
        requirements: input.requirements,
        benefits: input.benefits,
        url: input.url,
        platform: input.platform || 'manual',
        platformJobId: input.platformJobId,
        status: input.status || 'discovered',
        matchScore: input.matchScore,
        matchReason: input.matchReason,
        appliedAt: input.appliedAt ? new Date(input.appliedAt) : null,
        appliedVia: input.appliedVia,
        resumeUsedId: input.resumeUsedId,
        coverLetter: input.coverLetter,
        notes: input.notes,
        nextFollowUp: input.nextFollowUp ? new Date(input.nextFollowUp) : null,
        contacts: input.contacts as any,
      })
      .returning();

    // Log the creation
    await this.logHistory(job.id, 'created', null, input.status || 'discovered');

    return this.getById(job.id) as Promise<JobWithResume>;
  }

  /**
   * Create a manual job entry (for jobs applied outside the agent)
   */
  async createManual(input: ManualJobInput): Promise<JobWithResume> {
    const status = input.status || (input.appliedAt ? 'applied' : 'discovered');

    const [job] = await db
      .insert(jobs)
      .values({
        company: input.company,
        title: input.title,
        location: input.location,
        locationType: input.locationType,
        salaryMin: input.salaryMin,
        salaryMax: input.salaryMax,
        url: input.url,
        platform: 'manual',
        status,
        appliedAt: input.appliedAt ? new Date(input.appliedAt) : null,
        appliedVia: 'manual',
        resumeUsedId: input.resumeUsedId,
        coverLetter: input.coverLetter,
        notes: input.notes,
      })
      .returning();

    await this.logHistory(job.id, 'created', null, status, { source: 'manual_entry' });

    return this.getById(job.id) as Promise<JobWithResume>;
  }

  /**
   * Get a job by ID
   */
  async getById(id: string): Promise<JobWithResume | null> {
    const [job] = await db
      .select()
      .from(jobs)
      .where(eq(jobs.id, id))
      .limit(1);

    if (!job) return null;

    // Get associated resume if any
    let resume = null;
    if (job.resumeUsedId) {
      const [r] = await db
        .select({
          id: resumeMetadata.id,
          name: resumeMetadata.name,
          variant: resumeMetadata.variant,
        })
        .from(resumeMetadata)
        .where(eq(resumeMetadata.id, job.resumeUsedId))
        .limit(1);
      resume = r || null;
    }

    return {
      ...job,
      contacts: job.contacts as JobContact[] | null,
      interviews: job.interviews as Interview[] | null,
      resume,
    };
  }

  /**
   * List jobs with filters
   */
  async list(filters: JobFilters = {}): Promise<JobWithResume[]> {
    const conditions = [];

    if (filters.status) {
      conditions.push(eq(jobs.status, filters.status));
    }

    if (filters.statuses && filters.statuses.length > 0) {
      conditions.push(inArray(jobs.status, filters.statuses));
    }

    if (filters.platform) {
      conditions.push(eq(jobs.platform, filters.platform));
    }

    if (filters.company) {
      conditions.push(sql`${jobs.company} ILIKE ${`%${filters.company}%`}`);
    }

    if (filters.minMatchScore !== undefined) {
      conditions.push(gte(jobs.matchScore, filters.minMatchScore));
    }

    if (filters.appliedAfter) {
      conditions.push(gte(jobs.appliedAt, new Date(filters.appliedAfter)));
    }

    if (filters.appliedBefore) {
      conditions.push(lte(jobs.appliedAt, new Date(filters.appliedBefore)));
    }

    if (filters.hasFollowUp) {
      conditions.push(sql`${jobs.nextFollowUp} IS NOT NULL`);
    }

    const results = await db
      .select()
      .from(jobs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(jobs.updatedAt));

    return results.map((job) => ({
      ...job,
      contacts: job.contacts as JobContact[] | null,
      interviews: job.interviews as Interview[] | null,
      resume: null,
    }));
  }

  /**
   * Update a job
   */
  async update(id: string, input: UpdateJobInput): Promise<JobWithResume | null> {
    const existing = await this.getById(id);
    if (!existing) return null;

    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    // Track status change for history
    const statusChanged = input.status && input.status !== existing.status;
    const previousStatus = existing.status;

    // Map input to update data
    if (input.company !== undefined) updateData.company = input.company;
    if (input.title !== undefined) updateData.title = input.title;
    if (input.location !== undefined) updateData.location = input.location;
    if (input.locationType !== undefined) updateData.locationType = input.locationType;
    if (input.salaryMin !== undefined) updateData.salaryMin = input.salaryMin;
    if (input.salaryMax !== undefined) updateData.salaryMax = input.salaryMax;
    if (input.salaryType !== undefined) updateData.salaryType = input.salaryType;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.requirements !== undefined) updateData.requirements = input.requirements;
    if (input.benefits !== undefined) updateData.benefits = input.benefits;
    if (input.url !== undefined) updateData.url = input.url;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.matchScore !== undefined) updateData.matchScore = input.matchScore;
    if (input.matchReason !== undefined) updateData.matchReason = input.matchReason;
    if (input.appliedAt !== undefined) updateData.appliedAt = input.appliedAt ? new Date(input.appliedAt) : null;
    if (input.appliedVia !== undefined) updateData.appliedVia = input.appliedVia;
    if (input.resumeUsedId !== undefined) updateData.resumeUsedId = input.resumeUsedId;
    if (input.coverLetter !== undefined) updateData.coverLetter = input.coverLetter;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.nextFollowUp !== undefined) updateData.nextFollowUp = input.nextFollowUp ? new Date(input.nextFollowUp) : null;
    if (input.contacts !== undefined) updateData.contacts = input.contacts;
    if (input.interviews !== undefined) updateData.interviews = input.interviews;

    await db.update(jobs).set(updateData).where(eq(jobs.id, id));

    // Log status change
    if (statusChanged) {
      await this.logHistory(id, 'status_change', previousStatus, input.status!);
    }

    return this.getById(id);
  }

  /**
   * Mark job as applied
   */
  async markApplied(
    id: string,
    data: { resumeUsedId?: string; coverLetter?: string; appliedVia?: 'agent' | 'manual' }
  ): Promise<JobWithResume | null> {
    return this.update(id, {
      status: 'applied',
      appliedAt: new Date().toISOString(),
      appliedVia: data.appliedVia || 'manual',
      resumeUsedId: data.resumeUsedId,
      coverLetter: data.coverLetter,
    });
  }

  /**
   * Delete a job
   */
  async delete(id: string): Promise<boolean> {
    const result = await db.delete(jobs).where(eq(jobs.id, id)).returning({ id: jobs.id });
    return result.length > 0;
  }

  /**
   * Get jobs needing follow-up
   */
  async getFollowUps(): Promise<JobWithResume[]> {
    const now = new Date();
    const results = await db
      .select()
      .from(jobs)
      .where(and(
        lte(jobs.nextFollowUp, now),
        sql`${jobs.status} NOT IN ('rejected', 'withdrawn', 'accepted')`
      ))
      .orderBy(asc(jobs.nextFollowUp));

    return results.map((job) => ({
      ...job,
      contacts: job.contacts as JobContact[] | null,
      interviews: job.interviews as Interview[] | null,
      resume: null,
    }));
  }

  /**
   * Archive job to vault
   */
  async archiveToVault(id: string): Promise<{ vaultEntryId: string } | null> {
    const job = await this.getById(id);
    if (!job) return null;

    // Create vault entry
    const [entry] = await db
      .insert(vaultEntries)
      .values({
        title: `${job.title} at ${job.company}`,
        content: this.formatJobForVault(job),
        contentType: 'job_archive',
        context: 'career',
        source: 'jobs',
        sourceRef: job.id,
        tags: ['job', job.status, job.platform || 'manual'].filter(Boolean) as string[],
      })
      .returning();

    // Update job with vault entry ID
    await db.update(jobs).set({ vaultEntryId: entry.id }).where(eq(jobs.id, id));

    return { vaultEntryId: entry.id };
  }

  /**
   * Get dashboard statistics
   */
  async getStats(): Promise<JobStats> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get all jobs
    const allJobs = await db.select().from(jobs);

    // Count by status
    const byStatus: Record<string, number> = {};
    const byPlatform: Record<string, number> = {};

    allJobs.forEach((job) => {
      byStatus[job.status] = (byStatus[job.status] || 0) + 1;
      if (job.platform) {
        byPlatform[job.platform] = (byPlatform[job.platform] || 0) + 1;
      }
    });

    // This week stats
    const thisWeekApplied = allJobs.filter(
      (j) => j.appliedAt && new Date(j.appliedAt) >= weekAgo
    ).length;
    const thisWeekInterviews = allJobs.filter(
      (j) => j.status === 'interviewing' && new Date(j.updatedAt) >= weekAgo
    ).length;
    const thisWeekOffers = allJobs.filter(
      (j) => j.status === 'offered' && new Date(j.updatedAt) >= weekAgo
    ).length;
    const thisWeekRejections = allJobs.filter(
      (j) => j.status === 'rejected' && new Date(j.updatedAt) >= weekAgo
    ).length;

    // This month stats
    const thisMonthApplied = allJobs.filter(
      (j) => j.appliedAt && new Date(j.appliedAt) >= monthAgo
    ).length;
    const thisMonthInterviews = allJobs.filter(
      (j) => j.status === 'interviewing' && new Date(j.updatedAt) >= monthAgo
    ).length;
    const thisMonthOffers = allJobs.filter(
      (j) => j.status === 'offered' && new Date(j.updatedAt) >= monthAgo
    ).length;
    const thisMonthRejections = allJobs.filter(
      (j) => j.status === 'rejected' && new Date(j.updatedAt) >= monthAgo
    ).length;

    // Calculate rates
    const appliedJobs = allJobs.filter((j) => j.appliedAt);
    const responded = appliedJobs.filter((j) =>
      ['phone_screen', 'interviewing', 'offered', 'rejected'].includes(j.status)
    );
    const interviewed = appliedJobs.filter((j) =>
      ['interviewing', 'offered'].includes(j.status)
    );

    const responseRate = appliedJobs.length > 0
      ? (responded.length / appliedJobs.length) * 100
      : 0;
    const interviewRate = appliedJobs.length > 0
      ? (interviewed.length / appliedJobs.length) * 100
      : 0;

    // Average match score
    const jobsWithScore = allJobs.filter((j) => j.matchScore !== null);
    const averageMatchScore = jobsWithScore.length > 0
      ? jobsWithScore.reduce((acc, j) => acc + (j.matchScore || 0), 0) / jobsWithScore.length
      : 0;

    return {
      total: allJobs.length,
      byStatus: byStatus as Record<JobStatus, number>,
      byPlatform,
      thisWeek: {
        applied: thisWeekApplied,
        interviews: thisWeekInterviews,
        offers: thisWeekOffers,
        rejections: thisWeekRejections,
      },
      thisMonth: {
        applied: thisMonthApplied,
        interviews: thisMonthInterviews,
        offers: thisMonthOffers,
        rejections: thisMonthRejections,
      },
      responseRate,
      interviewRate,
      averageMatchScore,
    };
  }

  /**
   * Log action to history
   */
  private async logHistory(
    jobId: string,
    action: string,
    previousValue: string | null,
    newValue: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await db.insert(applicationHistory).values({
      jobId,
      action,
      previousValue,
      newValue,
      metadata: metadata as any,
    });
  }

  /**
   * Format job details for vault archival
   */
  private formatJobForVault(job: JobWithResume): string {
    const lines = [
      `# ${job.title} at ${job.company}`,
      '',
      `**Status:** ${job.status}`,
      `**Location:** ${job.location || 'Not specified'} (${job.locationType || 'Unknown'})`,
    ];

    if (job.salaryMin || job.salaryMax) {
      lines.push(`**Salary:** $${job.salaryMin || '?'}k - $${job.salaryMax || '?'}k`);
    }

    if (job.url) {
      lines.push(`**URL:** ${job.url}`);
    }

    if (job.appliedAt) {
      lines.push(`**Applied:** ${new Date(job.appliedAt).toLocaleDateString()}`);
    }

    if (job.matchScore) {
      lines.push(`**Match Score:** ${job.matchScore}%`);
    }

    if (job.description) {
      lines.push('', '## Description', '', job.description);
    }

    if (job.requirements && job.requirements.length > 0) {
      lines.push('', '## Requirements', '', ...job.requirements.map((r) => `- ${r}`));
    }

    if (job.notes) {
      lines.push('', '## Notes', '', job.notes);
    }

    if (job.coverLetter) {
      lines.push('', '## Cover Letter', '', job.coverLetter);
    }

    if (job.interviews && job.interviews.length > 0) {
      lines.push('', '## Interview History', '');
      job.interviews.forEach((interview) => {
        lines.push(`### ${interview.date} - ${interview.type}`);
        if (interview.with) lines.push(`With: ${interview.with}`);
        if (interview.notes) lines.push(interview.notes);
        if (interview.outcome) lines.push(`Outcome: ${interview.outcome}`);
        lines.push('');
      });
    }

    return lines.join('\n');
  }

  /**
   * Get application history for a job
   */
  async getHistory(jobId: string): Promise<any[]> {
    return db
      .select()
      .from(applicationHistory)
      .where(eq(applicationHistory.jobId, jobId))
      .orderBy(desc(applicationHistory.createdAt));
  }
}

// Export singleton instance
export const jobService = new JobService();

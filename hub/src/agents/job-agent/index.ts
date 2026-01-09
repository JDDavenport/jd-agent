import OpenAI from 'openai';
import { JOB_AGENT_TOOLS, type JobToolName } from './tools';
import { JOB_AGENT_SYSTEM_PROMPT, buildJobAgentContext } from './prompts';
import { jobService } from '../../services/job-service';
import { resumeService } from '../../services/resume-service';
import { jobProfileService } from '../../services/job-profile-service';
import type { JobStatus, Interview, JobContact } from '@jd-agent/types';

// ============================================
// Types
// ============================================

export interface JobAgentResponse {
  message: string;
  toolsUsed: string[];
  jobsAffected?: string[];
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// Convert our tool format to OpenAI function format
function convertToolsToOpenAI(): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return JOB_AGENT_TOOLS.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }));
}

// ============================================
// Job Agent Class
// ============================================

export class JobAgent {
  private client: OpenAI | null = null;
  private conversationHistory: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
  private maxHistoryLength = 20;
  private model = 'gpt-4-turbo-preview';

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
      console.log('[JobAgent] Initialized with OpenAI API');
    } else {
      console.log('[JobAgent] No OpenAI API key - agent will not function');
    }
  }

  /**
   * Check if the agent is configured
   */
  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Build the current context for the agent
   */
  async buildContext(): Promise<string> {
    const [profile, stats, followUps] = await Promise.all([
      jobProfileService.get(),
      jobService.getStats(),
      jobService.getFollowUps(),
    ]);

    return buildJobAgentContext(profile, stats, followUps.length);
  }

  /**
   * Execute a tool call
   */
  private async executeTool(name: JobToolName, input: Record<string, unknown>): Promise<ToolResult> {
    try {
      switch (name) {
        // ============================================
        // DISCOVERY TOOLS
        // ============================================
        case 'job_search': {
          // For now, search existing jobs in database
          // In future, this would call external job board APIs
          const profile = await jobProfileService.get();
          const minScore = (input.minMatchScore as number) || profile.autoApplyThreshold || 0;

          const jobs = await jobService.list({
            minMatchScore: minScore,
            company: input.location ? undefined : undefined, // Filter logic can be expanded
          });

          // Filter by query if provided
          let filtered = jobs;
          if (input.query) {
            const query = (input.query as string).toLowerCase();
            filtered = jobs.filter(
              (j) =>
                j.title.toLowerCase().includes(query) ||
                j.company.toLowerCase().includes(query) ||
                (j.description || '').toLowerCase().includes(query)
            );
          }

          const limit = (input.limit as number) || 20;
          return {
            success: true,
            data: {
              results: filtered.slice(0, limit).map((j) => ({
                id: j.id,
                company: j.company,
                title: j.title,
                location: j.location,
                locationType: j.locationType,
                matchScore: j.matchScore,
                status: j.status,
                platform: j.platform,
              })),
              total: filtered.length,
              message: `Found ${filtered.length} jobs matching criteria`,
            },
          };
        }

        case 'job_analyze': {
          if (input.jobId) {
            const job = await jobService.getById(input.jobId as string);
            if (!job) return { success: false, error: 'Job not found' };

            const profile = await jobProfileService.get();

            // Analyze job against profile
            const analysis = {
              job: {
                id: job.id,
                company: job.company,
                title: job.title,
                location: job.location,
                salaryRange:
                  job.salaryMin || job.salaryMax
                    ? `$${job.salaryMin || '?'}k - $${job.salaryMax || '?'}k`
                    : 'Not disclosed',
                requirements: job.requirements || [],
              },
              matchAnalysis: {
                currentScore: job.matchScore || 0,
                titleMatch: profile.targetTitles?.some((t: string) =>
                  job.title.toLowerCase().includes(t.toLowerCase())
                ),
                companyMatch: profile.targetCompanies?.includes(job.company),
                isExcluded: profile.excludeCompanies?.includes(job.company),
                salaryMeets: !profile.minSalary || (job.salaryMin && job.salaryMin >= profile.minSalary),
                locationMatch:
                  !profile.preferredLocations?.length ||
                  profile.preferredLocations.some((l: string) => job.location?.includes(l)),
              },
              skillGaps: this.identifySkillGaps(job.requirements || [], profile.skills || []),
              recommendation:
                job.matchScore && job.matchScore >= 70
                  ? 'Strong match - consider applying'
                  : job.matchScore && job.matchScore >= 50
                  ? 'Moderate match - review requirements carefully'
                  : 'May not be ideal fit - consider carefully',
            };

            return { success: true, data: analysis };
          }

          // If URL or content provided, would create new job entry
          // For now, return guidance
          return {
            success: false,
            error: 'Please provide a jobId. URL/content parsing not yet implemented.',
          };
        }

        case 'job_calculate_match': {
          const job = await jobService.getById(input.jobId as string);
          if (!job) return { success: false, error: 'Job not found' };

          const profile = await jobProfileService.get();
          const score = await this.calculateMatchScore(job, profile);

          // Update job with new score
          await jobService.update(job.id, {
            matchScore: score.total,
            matchReason: score.summary,
          });

          return {
            success: true,
            data: {
              jobId: job.id,
              company: job.company,
              title: job.title,
              matchScore: score.total,
              breakdown: score.breakdown,
              summary: score.summary,
            },
          };
        }

        case 'job_get_profile': {
          const profile = await jobProfileService.get();
          return { success: true, data: profile };
        }

        case 'job_update_profile': {
          const profile = await jobProfileService.update({
            targetTitles: input.targetTitles as string[] | undefined,
            targetCompanies: input.targetCompanies as string[] | undefined,
            excludeCompanies: input.excludeCompanies as string[] | undefined,
            minSalary: input.minSalary as number | undefined,
            preferredLocations: input.preferredLocations as string[] | undefined,
            remotePreference: input.remotePreference as string | undefined,
            skills: input.skills as string[] | undefined,
            autoApplyEnabled: input.autoApplyEnabled as boolean | undefined,
            autoApplyThreshold: input.autoApplyThreshold as number | undefined,
          });
          return {
            success: true,
            data: { profile, message: 'Profile updated successfully' },
          };
        }

        // ============================================
        // APPLICATION TOOLS
        // ============================================
        case 'job_select_resume': {
          const resume = await resumeService.selectForJob(input.jobId as string);
          if (!resume) return { success: false, error: 'No resumes available' };

          const job = await jobService.getById(input.jobId as string);
          return {
            success: true,
            data: {
              resume: {
                id: resume.id,
                name: resume.name,
                variant: resume.variant,
                isDefault: resume.isDefault,
              },
              job: job ? { company: job.company, title: job.title } : null,
              reason: `Selected ${resume.variant || 'default'} resume based on job requirements`,
            },
          };
        }

        case 'job_generate_cover_letter': {
          const job = await jobService.getById(input.jobId as string);
          if (!job) return { success: false, error: 'Job not found' };

          const resumeId = input.resumeId as string | undefined;
          const resume = resumeId
            ? await resumeService.getById(resumeId)
            : await resumeService.getDefault();

          const profile = await jobProfileService.get();
          const tone = (input.tone as string) || 'professional';
          const highlights = (input.highlights as string[]) || [];

          // Generate cover letter using AI
          const coverLetter = await this.generateCoverLetter(job, resume, profile, tone, highlights);

          // Save to job
          await jobService.update(job.id, { coverLetter });

          return {
            success: true,
            data: {
              coverLetter,
              job: { company: job.company, title: job.title },
              resumeUsed: resume?.name || 'None',
              message: 'Cover letter generated and saved to job',
            },
          };
        }

        case 'job_answer_screening': {
          const question = input.question as string;

          // Try to find existing answer
          const existingAnswer = await jobProfileService.findAnswerForQuestion(question);
          if (existingAnswer) {
            return {
              success: true,
              data: {
                question,
                answer: existingAnswer.answer,
                source: 'saved',
                category: existingAnswer.category,
              },
            };
          }

          // Generate new answer based on profile
          const profile = await jobProfileService.get();
          const generatedAnswer = await this.generateScreeningAnswer(question, profile);

          // Save if requested
          if (input.saveResponse) {
            await jobProfileService.createScreeningAnswer({
              questionPattern: question,
              answer: generatedAnswer,
              category: this.detectScreeningCategory(question),
            });
          }

          return {
            success: true,
            data: {
              question,
              answer: generatedAnswer,
              source: 'generated',
              saved: input.saveResponse || false,
            },
          };
        }

        case 'job_mark_applied': {
          const job = await jobService.markApplied(input.jobId as string, {
            resumeUsedId: input.resumeUsedId as string | undefined,
            coverLetter: input.coverLetter as string | undefined,
            appliedVia: (input.appliedVia as 'agent' | 'manual') || 'manual',
          });

          if (!job) return { success: false, error: 'Job not found' };

          // Add notes if provided
          if (input.notes) {
            await jobService.update(job.id, {
              notes: job.notes ? `${job.notes}\n\n${input.notes}` : (input.notes as string),
            });
          }

          return {
            success: true,
            data: {
              id: job.id,
              company: job.company,
              title: job.title,
              status: job.status,
              appliedAt: job.appliedAt,
              message: `Marked as applied to ${job.company}`,
            },
          };
        }

        // ============================================
        // TRACKING TOOLS
        // ============================================
        case 'job_list': {
          const jobs = await jobService.list({
            status: input.status as JobStatus | undefined,
            statuses: input.statuses as JobStatus[] | undefined,
            platform: input.platform as string | undefined,
            company: input.company as string | undefined,
            minMatchScore: input.minMatchScore as number | undefined,
          });

          const limit = (input.limit as number) || 50;
          return {
            success: true,
            data: {
              jobs: jobs.slice(0, limit).map((j) => ({
                id: j.id,
                company: j.company,
                title: j.title,
                status: j.status,
                matchScore: j.matchScore,
                appliedAt: j.appliedAt,
                nextFollowUp: j.nextFollowUp,
              })),
              total: jobs.length,
            },
          };
        }

        case 'job_get': {
          const job = await jobService.getById(input.jobId as string);
          if (!job) return { success: false, error: 'Job not found' };
          return { success: true, data: job };
        }

        case 'job_update_status': {
          const job = await jobService.update(input.jobId as string, {
            status: input.status as JobStatus,
            notes: input.notes as string | undefined,
          });

          if (!job) return { success: false, error: 'Job not found' };

          return {
            success: true,
            data: {
              id: job.id,
              company: job.company,
              title: job.title,
              status: job.status,
              message: `Updated ${job.company} status to ${job.status}`,
            },
          };
        }

        case 'job_add_note': {
          const job = await jobService.getById(input.jobId as string);
          if (!job) return { success: false, error: 'Job not found' };

          const timestamp = new Date().toISOString().split('T')[0];
          const newNote = `[${timestamp}] ${input.note}`;
          const updatedNotes = job.notes ? `${job.notes}\n\n${newNote}` : newNote;

          await jobService.update(job.id, { notes: updatedNotes });

          return {
            success: true,
            data: {
              id: job.id,
              company: job.company,
              message: 'Note added',
            },
          };
        }

        case 'job_schedule_followup': {
          const job = await jobService.update(input.jobId as string, {
            nextFollowUp: input.date as string,
          });

          if (!job) return { success: false, error: 'Job not found' };

          // Add reason to notes
          if (input.reason) {
            const timestamp = new Date().toISOString().split('T')[0];
            const note = `[${timestamp}] Follow-up scheduled for ${input.date}: ${input.reason}`;
            await jobService.update(job.id, {
              notes: job.notes ? `${job.notes}\n\n${note}` : note,
            });
          }

          return {
            success: true,
            data: {
              id: job.id,
              company: job.company,
              nextFollowUp: input.date,
              message: `Follow-up scheduled for ${input.date}`,
            },
          };
        }

        case 'job_add_interview': {
          const job = await jobService.getById(input.jobId as string);
          if (!job) return { success: false, error: 'Job not found' };

          const interview: Interview = {
            date: input.date as string,
            type: input.type as string,
            with: input.with as string | undefined,
            notes: input.notes as string | undefined,
            outcome: (input.outcome as string) || 'pending',
          };

          const interviews = job.interviews || [];
          interviews.push(interview);

          // Update status to interviewing if not already
          const newStatus =
            job.status === 'applied' || job.status === 'phone_screen' ? 'interviewing' : job.status;

          await jobService.update(job.id, {
            interviews,
            status: newStatus as JobStatus,
          });

          return {
            success: true,
            data: {
              id: job.id,
              company: job.company,
              interview,
              message: `Added ${input.type} interview`,
            },
          };
        }

        case 'job_add_contact': {
          const job = await jobService.getById(input.jobId as string);
          if (!job) return { success: false, error: 'Job not found' };

          const contact: JobContact = {
            name: input.name as string,
            role: input.role as string | undefined,
            email: input.email as string | undefined,
            phone: input.phone as string | undefined,
            linkedin: input.linkedin as string | undefined,
            notes: input.notes as string | undefined,
          };

          const contacts = job.contacts || [];
          contacts.push(contact);

          await jobService.update(job.id, { contacts });

          return {
            success: true,
            data: {
              id: job.id,
              company: job.company,
              contact,
              message: `Added contact: ${contact.name}`,
            },
          };
        }

        case 'job_archive': {
          const result = await jobService.archiveToVault(input.jobId as string);
          if (!result) return { success: false, error: 'Job not found' };

          return {
            success: true,
            data: {
              vaultEntryId: result.vaultEntryId,
              message: 'Job archived to vault',
            },
          };
        }

        // ============================================
        // STATS & REPORTING
        // ============================================
        case 'job_stats': {
          const stats = await jobService.getStats();
          return { success: true, data: stats };
        }

        case 'job_get_followups': {
          const followUps = await jobService.getFollowUps();
          return {
            success: true,
            data: {
              followUps: followUps.map((j) => ({
                id: j.id,
                company: j.company,
                title: j.title,
                status: j.status,
                nextFollowUp: j.nextFollowUp,
              })),
              count: followUps.length,
            },
          };
        }

        // ============================================
        // RESUME MANAGEMENT
        // ============================================
        case 'resume_list': {
          const resumes = await resumeService.list();
          return { success: true, data: resumes };
        }

        case 'resume_get': {
          const resume = await resumeService.getById(input.resumeId as string);
          if (!resume) return { success: false, error: 'Resume not found' };
          return { success: true, data: resume };
        }

        case 'resume_set_default': {
          const resume = await resumeService.setDefault(input.resumeId as string);
          if (!resume) return { success: false, error: 'Resume not found' };
          return {
            success: true,
            data: { resume, message: `Set ${resume.name} as default` },
          };
        }

        // ============================================
        // SCREENING ANSWER MANAGEMENT
        // ============================================
        case 'screening_list': {
          const category = input.category as string | undefined;
          const answers = category
            ? await jobProfileService.getScreeningAnswersByCategory(category as any)
            : await jobProfileService.listScreeningAnswers();
          return { success: true, data: answers };
        }

        case 'screening_save': {
          const answer = await jobProfileService.createScreeningAnswer({
            questionPattern: input.questionPattern as string,
            answer: input.answer as string,
            category: input.category as any,
            isDefault: input.isDefault as boolean | undefined,
          });
          return {
            success: true,
            data: { answer, message: 'Screening answer saved' },
          };
        }

        // ============================================
        // BROWSER AUTOMATION
        // ============================================
        case 'browser_login': {
          const { getAdapter } = await import('./adapters');
          const platform = input.platform as string;
          const adapter = getAdapter(platform as any);

          if (!adapter) {
            return { success: false, error: `Unknown platform: ${platform}` };
          }

          await adapter.initialize();

          // Get credentials from environment or input
          const email = (input.email as string) || process.env[`${platform.toUpperCase()}_EMAIL`];
          const password = (input.password as string) || process.env[`${platform.toUpperCase()}_PASSWORD`];

          if (!email || !password) {
            return {
              success: false,
              error: `Credentials required for ${platform}. Set ${platform.toUpperCase()}_EMAIL and ${platform.toUpperCase()}_PASSWORD environment variables or provide them directly.`,
            };
          }

          const success = await adapter.login({ email, password });
          return {
            success,
            data: { platform, message: success ? `Logged in to ${platform}` : `Failed to login to ${platform}` },
          };
        }

        case 'browser_search_jobs': {
          const { getAdapter } = await import('./adapters');
          const platform = input.platform as string;
          const adapter = getAdapter(platform as any);

          if (!adapter) {
            return { success: false, error: `Unknown platform: ${platform}` };
          }

          const filters: Record<string, string> = {};
          if (input.location) filters.location = input.location as string;
          if (input.remote) filters.remote = 'true';
          if (input.easyApply) filters.easyApply = 'true';

          const jobs = await adapter.searchJobs(input.query as string, filters);

          // Optionally save jobs to database
          const savedJobs = [];
          for (const job of jobs.slice(0, 10)) {
            try {
              const created = await jobService.create({
                company: job.company,
                title: job.title,
                location: job.location,
                url: job.url,
                platform: platform as any,
                platformJobId: job.platformJobId,
                status: 'discovered',
              });
              savedJobs.push(created);
            } catch (e) {
              console.log(`[JobAgent] Could not save job: ${e}`);
            }
          }

          return {
            success: true,
            data: {
              platform,
              query: input.query,
              found: jobs.length,
              saved: savedJobs.length,
              jobs: jobs.slice(0, 10).map((j) => ({
                title: j.title,
                company: j.company,
                location: j.location,
                url: j.url,
              })),
            },
          };
        }

        case 'browser_apply': {
          const { getAdapter } = await import('./adapters');
          const platform = input.platform as string;
          const adapter = getAdapter(platform as any);

          if (!adapter) {
            return { success: false, error: `Unknown platform: ${platform}` };
          }

          // Get default resume path
          const defaultResume = await resumeService.getDefault();
          const resumePath = (input.resumePath as string) || defaultResume?.filePath;

          if (!resumePath) {
            return { success: false, error: 'No resume path provided and no default resume found' };
          }

          const result = await adapter.applyToJob(
            input.jobUrl as string,
            resumePath,
            input.coverLetter as string | undefined
          );

          // If successful, update job status in database
          if (result.success) {
            const jobs = await jobService.list({ platform: platform as any });
            const matchingJob = jobs.find((j) => j.url === input.jobUrl);
            if (matchingJob) {
              await jobService.markApplied(matchingJob.id, {
                appliedVia: 'agent',
                resumeUsedId: defaultResume?.id,
                coverLetter: input.coverLetter as string | undefined,
              });
            }
          }

          return {
            success: result.success,
            data: {
              platform,
              jobUrl: input.jobUrl,
              message: result.message,
              screenshotPath: result.screenshotPath,
            },
          };
        }

        case 'browser_get_job_details': {
          const { getAdapter } = await import('./adapters');
          const platform = input.platform as string;
          const adapter = getAdapter(platform as any);

          if (!adapter) {
            return { success: false, error: `Unknown platform: ${platform}` };
          }

          const details = await adapter.getJobDetails(input.jobUrl as string);
          if (!details) {
            return { success: false, error: 'Could not get job details' };
          }

          return {
            success: true,
            data: details,
          };
        }

        default:
          return { success: false, error: `Unknown tool: ${name}` };
      }
    } catch (error) {
      console.error(`[JobAgent] Tool ${name} failed:`, error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Calculate match score between job and profile
   */
  private async calculateMatchScore(
    job: any,
    profile: any
  ): Promise<{ total: number; breakdown: Record<string, number>; summary: string }> {
    const breakdown: Record<string, number> = {
      titleMatch: 0,
      companyMatch: 0,
      salaryMatch: 0,
      locationMatch: 0,
      skillsMatch: 0,
      industryMatch: 0,
    };

    // Title match (25 points)
    if (profile.targetTitles?.length > 0) {
      const titleLower = job.title.toLowerCase();
      if (profile.targetTitles.some((t: string) => titleLower.includes(t.toLowerCase()))) {
        breakdown.titleMatch = 25;
      } else if (
        profile.targetTitles.some((t: string) =>
          t
            .toLowerCase()
            .split(' ')
            .some((word: string) => titleLower.includes(word))
        )
      ) {
        breakdown.titleMatch = 15;
      }
    } else {
      breakdown.titleMatch = 15; // Neutral if no target titles
    }

    // Company match (20 points)
    if (profile.excludeCompanies?.includes(job.company)) {
      breakdown.companyMatch = -50; // Heavy penalty
    } else if (profile.targetCompanies?.includes(job.company)) {
      breakdown.companyMatch = 20;
    } else {
      breakdown.companyMatch = 10; // Neutral
    }

    // Salary match (20 points)
    if (profile.minSalary && job.salaryMax) {
      if (job.salaryMax >= profile.minSalary) {
        breakdown.salaryMatch = 20;
      } else if (job.salaryMax >= profile.minSalary * 0.9) {
        breakdown.salaryMatch = 10;
      }
    } else {
      breakdown.salaryMatch = 10; // Unknown salary
    }

    // Location match (15 points)
    if (profile.remotePreference === 'remote_only') {
      breakdown.locationMatch = job.locationType === 'remote' ? 15 : 0;
    } else if (profile.preferredLocations?.length > 0) {
      if (profile.preferredLocations.some((l: string) => job.location?.includes(l))) {
        breakdown.locationMatch = 15;
      } else if (job.locationType === 'remote') {
        breakdown.locationMatch = 10;
      }
    } else {
      breakdown.locationMatch = 10; // No preference
    }

    // Skills match (20 points)
    if (profile.skills?.length > 0 && job.requirements?.length > 0) {
      const jobReqsLower = job.requirements.map((r: string) => r.toLowerCase()).join(' ');
      const matchedSkills = profile.skills.filter((s: string) =>
        jobReqsLower.includes(s.toLowerCase())
      );
      breakdown.skillsMatch = Math.min(20, (matchedSkills.length / profile.skills.length) * 20);
    } else {
      breakdown.skillsMatch = 10;
    }

    const total = Math.max(0, Math.min(100, Object.values(breakdown).reduce((a, b) => a + b, 0)));

    const summary =
      total >= 80
        ? 'Excellent match - highly aligned with your profile'
        : total >= 60
        ? 'Good match - meets most of your criteria'
        : total >= 40
        ? 'Moderate match - some alignment with preferences'
        : 'Low match - may not align well with your goals';

    return { total: Math.round(total), breakdown, summary };
  }

  /**
   * Identify skill gaps between job requirements and profile skills
   */
  private identifySkillGaps(requirements: string[], skills: string[]): string[] {
    const skillsLower = skills.map((s) => s.toLowerCase());
    const gaps: string[] = [];

    for (const req of requirements) {
      const reqLower = req.toLowerCase();
      if (!skillsLower.some((s) => reqLower.includes(s) || s.includes(reqLower))) {
        gaps.push(req);
      }
    }

    return gaps;
  }

  /**
   * Generate a cover letter using AI
   */
  private async generateCoverLetter(
    job: any,
    resume: any,
    profile: any,
    tone: string,
    highlights: string[]
  ): Promise<string> {
    if (!this.client) {
      return this.generateFallbackCoverLetter(job, resume, highlights);
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are a professional cover letter writer. Write concise, compelling cover letters that:
- Are tailored to the specific role and company
- Highlight relevant experience without being generic
- Show enthusiasm without being over-the-top
- Are 3-4 paragraphs max
- Use a ${tone} tone`,
          },
          {
            role: 'user',
            content: `Write a cover letter for this position:

Company: ${job.company}
Title: ${job.title}
Description: ${job.description || 'Not provided'}
Requirements: ${job.requirements?.join(', ') || 'Not specified'}

My skills: ${profile.skills?.join(', ') || 'Not specified'}
Years of experience: ${profile.yearsExperience || 'Not specified'}
${resume?.extractedSkills ? `Resume skills: ${resume.extractedSkills.join(', ')}` : ''}
${highlights.length > 0 ? `Specific points to highlight: ${highlights.join(', ')}` : ''}

Write only the cover letter body (no headers or signature).`,
          },
        ],
        max_tokens: 1000,
      });

      return response.choices[0].message.content || this.generateFallbackCoverLetter(job, resume, highlights);
    } catch (error) {
      console.error('[JobAgent] Cover letter generation failed:', error);
      return this.generateFallbackCoverLetter(job, resume, highlights);
    }
  }

  /**
   * Generate a basic cover letter without AI
   */
  private generateFallbackCoverLetter(job: any, resume: any, highlights: string[]): string {
    return `I am excited to apply for the ${job.title} position at ${job.company}.

${
  highlights.length > 0
    ? `My background includes: ${highlights.join(', ')}. `
    : ''
}I believe my skills and experience make me a strong candidate for this role.

${
  resume?.extractedSkills?.length > 0
    ? `My technical skills include ${resume.extractedSkills.slice(0, 5).join(', ')}, which align well with the requirements of this position.`
    : 'I have developed a diverse skill set that I believe would contribute to your team.'
}

I would welcome the opportunity to discuss how I can contribute to ${job.company}. Thank you for considering my application.`;
  }

  /**
   * Generate a screening answer using AI
   */
  private async generateScreeningAnswer(question: string, profile: any): Promise<string> {
    if (!this.client) {
      return this.generateFallbackScreeningAnswer(question, profile);
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are helping answer job application screening questions. Provide concise, professional answers based on the candidate's profile. Be truthful and direct.`,
          },
          {
            role: 'user',
            content: `Question: ${question}

Candidate profile:
- Years of experience: ${profile.yearsExperience || 'Not specified'}
- Skills: ${profile.skills?.join(', ') || 'Not specified'}
- Minimum salary expectation: ${profile.minSalary ? `$${profile.minSalary.toLocaleString()}` : 'Flexible'}
- Remote preference: ${profile.remotePreference || 'Flexible'}
- Willing to relocate: ${profile.willingToRelocate ? 'Yes' : 'No'}

Provide a brief, professional answer to the screening question.`,
          },
        ],
        max_tokens: 200,
      });

      return response.choices[0].message.content || this.generateFallbackScreeningAnswer(question, profile);
    } catch (error) {
      console.error('[JobAgent] Screening answer generation failed:', error);
      return this.generateFallbackScreeningAnswer(question, profile);
    }
  }

  /**
   * Generate a basic screening answer without AI
   */
  private generateFallbackScreeningAnswer(question: string, profile: any): string {
    const qLower = question.toLowerCase();

    if (qLower.includes('salary') || qLower.includes('compensation')) {
      return profile.minSalary
        ? `My salary expectation is $${profile.minSalary.toLocaleString()} or above, depending on the total compensation package.`
        : 'My salary expectations are flexible and dependent on the overall compensation package and role responsibilities.';
    }

    if (qLower.includes('remote') || qLower.includes('location') || qLower.includes('relocate')) {
      if (profile.remotePreference === 'remote_only') {
        return 'I am seeking remote opportunities.';
      } else if (profile.willingToRelocate) {
        return 'I am flexible with location and open to relocation for the right opportunity.';
      }
      return 'I am flexible with location arrangements.';
    }

    if (qLower.includes('experience') || qLower.includes('years')) {
      return profile.yearsExperience
        ? `I have ${profile.yearsExperience} years of professional experience.`
        : 'I have several years of relevant professional experience.';
    }

    if (qLower.includes('authorized') || qLower.includes('work in') || qLower.includes('visa')) {
      return 'Yes, I am authorized to work.';
    }

    return 'Please contact me for more details about this question.';
  }

  /**
   * Detect screening question category
   */
  private detectScreeningCategory(
    question: string
  ): 'work_auth' | 'salary' | 'availability' | 'experience' | 'relocation' | 'other' {
    const qLower = question.toLowerCase();

    if (qLower.includes('authorized') || qLower.includes('visa') || qLower.includes('sponsor')) {
      return 'work_auth';
    }
    if (qLower.includes('salary') || qLower.includes('compensation') || qLower.includes('pay')) {
      return 'salary';
    }
    if (qLower.includes('start') || qLower.includes('available') || qLower.includes('notice')) {
      return 'availability';
    }
    if (qLower.includes('experience') || qLower.includes('years')) {
      return 'experience';
    }
    if (qLower.includes('relocate') || qLower.includes('location') || qLower.includes('remote')) {
      return 'relocation';
    }
    return 'other';
  }

  /**
   * Chat with the job agent
   */
  async chat(userMessage: string): Promise<JobAgentResponse> {
    if (!this.client) {
      return {
        message: 'Agent not configured. Please set OPENAI_API_KEY environment variable.',
        toolsUsed: [],
      };
    }

    const toolsUsed: string[] = [];
    const jobsAffected: string[] = [];
    const context = await this.buildContext();
    const systemPrompt = JOB_AGENT_SYSTEM_PROMPT + context;

    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage,
    });

    // Trim history if too long
    if (this.conversationHistory.length > this.maxHistoryLength) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
    }

    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...this.conversationHistory,
      ];

      let response = await this.client.chat.completions.create({
        model: this.model,
        messages,
        tools: convertToolsToOpenAI(),
        tool_choice: 'auto',
      });

      let assistantMessage = response.choices[0].message;

      // Process tool calls in a loop until we get a final response
      while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        // Add assistant message with tool calls to history
        this.conversationHistory.push(assistantMessage);

        // Execute each tool call
        for (const toolCall of assistantMessage.tool_calls) {
          if (toolCall.type !== 'function') continue;

          const toolName = toolCall.function.name as JobToolName;
          const toolInput = JSON.parse(toolCall.function.arguments);

          console.log(`[JobAgent] Executing tool: ${toolName}`);
          toolsUsed.push(toolName);

          // Track affected jobs
          if (toolInput.jobId) {
            jobsAffected.push(toolInput.jobId);
          }

          const result = await this.executeTool(toolName, toolInput);

          // Add tool result to history
          this.conversationHistory.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }

        // Continue the conversation
        const continueMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
          { role: 'system', content: systemPrompt },
          ...this.conversationHistory,
        ];

        response = await this.client.chat.completions.create({
          model: this.model,
          messages: continueMessages,
          tools: convertToolsToOpenAI(),
          tool_choice: 'auto',
        });

        assistantMessage = response.choices[0].message;
      }

      // Extract final text response
      const finalMessage = assistantMessage.content || 'I completed the requested actions.';

      // Add final response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: finalMessage,
      });

      return {
        message: finalMessage,
        toolsUsed,
        jobsAffected: [...new Set(jobsAffected)],
      };
    } catch (error) {
      console.error('[JobAgent] Chat failed:', error);
      throw error;
    }
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
  }

  /**
   * Get conversation history length
   */
  getHistoryLength(): number {
    return this.conversationHistory.length;
  }
}

// ============================================
// Singleton instance
// ============================================

let agentInstance: JobAgent | null = null;

export function getJobAgent(): JobAgent {
  if (!agentInstance) {
    agentInstance = new JobAgent();
  }
  return agentInstance;
}

export default JobAgent;

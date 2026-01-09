import { Hono } from 'hono';
import { z } from 'zod';
import { jobService } from '../../services/job-service';
import { resumeService } from '../../services/resume-service';
import { jobProfileService } from '../../services/job-profile-service';
import { getJobAgent } from '../../agents/job-agent';
import { ValidationError, NotFoundError } from '../middleware/error-handler';

const jobsRouter = new Hono();

// ============================================
// Validation Schemas
// ============================================

const jobStatusEnum = z.enum([
  'discovered',
  'saved',
  'applying',
  'applied',
  'phone_screen',
  'interviewing',
  'offered',
  'rejected',
  'withdrawn',
  'accepted',
]);

const jobPlatformEnum = z.enum([
  'linkedin',
  'indeed',
  'greenhouse',
  'lever',
  'workday',
  'glassdoor',
  'angellist',
  'manual',
  'other',
]);

const locationTypeEnum = z.enum(['remote', 'hybrid', 'onsite']);

const remotePreferenceEnum = z.enum(['remote_only', 'hybrid_ok', 'onsite_ok']);

const screeningCategoryEnum = z.enum([
  'work_auth',
  'salary',
  'availability',
  'experience',
  'relocation',
  'other',
]);

const contactSchema = z.object({
  name: z.string(),
  title: z.string().optional(),
  email: z.string().optional(),
  linkedin: z.string().optional(),
  notes: z.string().optional(),
});

const interviewSchema = z.object({
  date: z.string(),
  type: z.string(),
  with: z.string().optional(),
  notes: z.string().optional(),
  outcome: z.string().optional(),
});

const createJobSchema = z.object({
  company: z.string().min(1, 'Company is required'),
  title: z.string().min(1, 'Title is required'),
  location: z.string().optional(),
  locationType: locationTypeEnum.optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  salaryType: z.string().optional(),
  description: z.string().optional(),
  requirements: z.array(z.string()).optional(),
  benefits: z.array(z.string()).optional(),
  url: z.string().optional(),
  platform: jobPlatformEnum.optional(),
  platformJobId: z.string().optional(),
  status: jobStatusEnum.optional(),
  matchScore: z.number().min(0).max(100).optional(),
  matchReason: z.string().optional(),
  appliedAt: z.string().optional(),
  appliedVia: z.enum(['agent', 'manual']).optional(),
  resumeUsedId: z.string().uuid().optional(),
  coverLetter: z.string().optional(),
  notes: z.string().optional(),
  nextFollowUp: z.string().optional(),
  contacts: z.array(contactSchema).optional(),
});

const updateJobSchema = createJobSchema.partial().extend({
  interviews: z.array(interviewSchema).optional(),
});

const manualJobSchema = z.object({
  company: z.string().min(1, 'Company is required'),
  title: z.string().min(1, 'Title is required'),
  location: z.string().optional(),
  locationType: locationTypeEnum.optional(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
  url: z.string().optional(),
  appliedAt: z.string().optional(),
  status: jobStatusEnum.optional(),
  notes: z.string().optional(),
  resumeUsedId: z.string().uuid().optional(),
  coverLetter: z.string().optional(),
});

const jobFiltersSchema = z.object({
  status: jobStatusEnum.optional(),
  statuses: z.string().optional(), // comma-separated
  platform: jobPlatformEnum.optional(),
  company: z.string().optional(),
  minMatchScore: z.coerce.number().optional(),
  appliedAfter: z.string().optional(),
  appliedBefore: z.string().optional(),
  hasFollowUp: z.coerce.boolean().optional(),
});

// ============================================
// Job Routes
// ============================================

/**
 * GET /api/jobs
 * List jobs with optional filters
 */
jobsRouter.get('/', async (c) => {
  const query = c.req.query();
  const parseResult = jobFiltersSchema.safeParse(query);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.message);
  }

  const filters = parseResult.data;

  // Parse comma-separated statuses
  if (filters.statuses) {
    (filters as any).statuses = filters.statuses.split(',') as any;
  }

  const jobs = await jobService.list(filters as any);

  return c.json({
    success: true,
    data: jobs,
    count: jobs.length,
  });
});

/**
 * GET /api/jobs/stats
 * Get dashboard statistics
 */
jobsRouter.get('/stats', async (c) => {
  const stats = await jobService.getStats();

  return c.json({
    success: true,
    data: stats,
  });
});

/**
 * GET /api/jobs/follow-ups
 * Get jobs needing follow-up
 */
jobsRouter.get('/follow-ups', async (c) => {
  const jobs = await jobService.getFollowUps();

  return c.json({
    success: true,
    data: jobs,
    count: jobs.length,
  });
});

/**
 * POST /api/jobs
 * Create a new job
 */
jobsRouter.post('/', async (c) => {
  const body = await c.req.json();
  const parseResult = createJobSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const job = await jobService.create(parseResult.data as any);

  return c.json(
    {
      success: true,
      data: job,
      message: 'Job created successfully',
    },
    201
  );
});

/**
 * POST /api/jobs/manual
 * Create a manual job entry (for jobs applied outside the agent)
 */
jobsRouter.post('/manual', async (c) => {
  const body = await c.req.json();
  const parseResult = manualJobSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const job = await jobService.createManual(parseResult.data as any);

  return c.json(
    {
      success: true,
      data: job,
      message: 'Manual job entry created successfully',
    },
    201
  );
});

// ============================================
// Resume Routes
// ============================================

/**
 * GET /api/jobs/resumes
 * List all resumes
 */
jobsRouter.get('/resumes', async (c) => {
  const resumes = await resumeService.list();

  return c.json({
    success: true,
    data: resumes,
    count: resumes.length,
  });
});

/**
 * GET /api/jobs/resumes/default
 * Get the default resume
 */
jobsRouter.get('/resumes/default', async (c) => {
  const resume = await resumeService.getDefault();

  return c.json({
    success: true,
    data: resume,
  });
});

/**
 * GET /api/jobs/resumes/:id
 * Get a resume by ID
 */
jobsRouter.get('/resumes/:id', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid resume ID format');
  }

  const resume = await resumeService.getById(id);

  if (!resume) {
    throw new NotFoundError('Resume');
  }

  return c.json({
    success: true,
    data: resume,
  });
});

const createResumeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  variant: z.string().optional(),
  filePath: z.string().min(1, 'File path is required'),
  fileType: z.string().optional(),
  isDefault: z.boolean().optional(),
  extractedSkills: z.array(z.string()).optional(),
  extractedExperience: z
    .array(
      z.object({
        company: z.string(),
        title: z.string(),
        dates: z.string(),
        highlights: z.array(z.string()).optional(),
      })
    )
    .optional(),
});

/**
 * POST /api/jobs/resumes
 * Create a new resume entry
 */
jobsRouter.post('/resumes', async (c) => {
  const body = await c.req.json();
  const parseResult = createResumeSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const resume = await resumeService.create(parseResult.data as any);

  return c.json(
    {
      success: true,
      data: resume,
      message: 'Resume created successfully',
    },
    201
  );
});

/**
 * PATCH /api/jobs/resumes/:id
 * Update a resume
 */
jobsRouter.patch('/resumes/:id', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid resume ID format');
  }

  const body = await c.req.json();

  const resume = await resumeService.update(id, body);

  if (!resume) {
    throw new NotFoundError('Resume');
  }

  return c.json({
    success: true,
    data: resume,
    message: 'Resume updated successfully',
  });
});

/**
 * POST /api/jobs/resumes/:id/set-default
 * Set a resume as default
 */
jobsRouter.post('/resumes/:id/set-default', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid resume ID format');
  }

  const resume = await resumeService.setDefault(id);

  if (!resume) {
    throw new NotFoundError('Resume');
  }

  return c.json({
    success: true,
    data: resume,
    message: 'Resume set as default',
  });
});

/**
 * DELETE /api/jobs/resumes/:id
 * Delete a resume
 */
jobsRouter.delete('/resumes/:id', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid resume ID format');
  }

  const deleted = await resumeService.delete(id);

  if (!deleted) {
    throw new NotFoundError('Resume');
  }

  return c.json({
    success: true,
    message: 'Resume deleted successfully',
  });
});

/**
 * POST /api/jobs/resumes/select/:jobId
 * Select the best resume for a job
 */
jobsRouter.post('/resumes/select/:jobId', async (c) => {
  const jobId = c.req.param('jobId');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) {
    throw new ValidationError('Invalid job ID format');
  }

  const resume = await resumeService.selectForJob(jobId);

  return c.json({
    success: true,
    data: resume,
  });
});

// ============================================
// Profile Routes
// ============================================

/**
 * GET /api/jobs/profile
 * Get job profile
 */
jobsRouter.get('/profile', async (c) => {
  const profile = await jobProfileService.get();

  return c.json({
    success: true,
    data: profile,
  });
});

const updateProfileSchema = z.object({
  targetTitles: z.array(z.string()).optional(),
  targetCompanies: z.array(z.string()).optional(),
  excludeCompanies: z.array(z.string()).optional(),
  minSalary: z.number().optional(),
  maxSalary: z.number().optional(),
  preferredLocations: z.array(z.string()).optional(),
  remotePreference: remotePreferenceEnum.optional(),
  willingToRelocate: z.boolean().optional(),
  yearsExperience: z.number().optional(),
  skills: z.array(z.string()).optional(),
  industries: z.array(z.string()).optional(),
  autoApplyEnabled: z.boolean().optional(),
  autoApplyThreshold: z.number().min(0).max(100).optional(),
  dailyApplicationLimit: z.number().min(1).optional(),
});

/**
 * PATCH /api/jobs/profile
 * Update job profile
 */
jobsRouter.patch('/profile', async (c) => {
  const body = await c.req.json();
  const parseResult = updateProfileSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const profile = await jobProfileService.update(parseResult.data as any);

  return c.json({
    success: true,
    data: profile,
    message: 'Profile updated successfully',
  });
});

// ============================================
// Screening Answer Routes
// ============================================

/**
 * GET /api/jobs/screening
 * List all screening answers
 */
jobsRouter.get('/screening', async (c) => {
  const answers = await jobProfileService.listScreeningAnswers();

  return c.json({
    success: true,
    data: answers,
    count: answers.length,
  });
});

const createScreeningSchema = z.object({
  questionPattern: z.string().min(1, 'Question pattern is required'),
  answer: z.string().min(1, 'Answer is required'),
  category: screeningCategoryEnum.optional(),
  isDefault: z.boolean().optional(),
});

/**
 * POST /api/jobs/screening
 * Create a screening answer
 */
jobsRouter.post('/screening', async (c) => {
  const body = await c.req.json();
  const parseResult = createScreeningSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const answer = await jobProfileService.createScreeningAnswer(parseResult.data as any);

  return c.json(
    {
      success: true,
      data: answer,
      message: 'Screening answer created successfully',
    },
    201
  );
});

/**
 * PATCH /api/jobs/screening/:id
 * Update a screening answer
 */
jobsRouter.patch('/screening/:id', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid screening answer ID format');
  }

  const body = await c.req.json();

  const answer = await jobProfileService.updateScreeningAnswer(id, body);

  if (!answer) {
    throw new NotFoundError('Screening answer');
  }

  return c.json({
    success: true,
    data: answer,
    message: 'Screening answer updated successfully',
  });
});

/**
 * DELETE /api/jobs/screening/:id
 * Delete a screening answer
 */
jobsRouter.delete('/screening/:id', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid screening answer ID format');
  }

  const deleted = await jobProfileService.deleteScreeningAnswer(id);

  if (!deleted) {
    throw new NotFoundError('Screening answer');
  }

  return c.json({
    success: true,
    message: 'Screening answer deleted successfully',
  });
});

/**
 * POST /api/jobs/screening/match
 * Find matching screening answer for a question
 */
jobsRouter.post('/screening/match', async (c) => {
  const body = await c.req.json();

  if (!body.question) {
    throw new ValidationError('Question is required');
  }

  const answer = await jobProfileService.findAnswerForQuestion(body.question);

  return c.json({
    success: true,
    data: answer,
  });
});

// ============================================
// Agent Chat Routes
// ============================================

const chatSchema = z.object({
  message: z.string().min(1, 'Message is required'),
});

/**
 * POST /api/jobs/chat
 * Chat with the Job Agent
 */
jobsRouter.post('/chat', async (c) => {
  const body = await c.req.json();
  const parseResult = chatSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const agent = getJobAgent();

  if (!agent.isConfigured()) {
    return c.json({
      success: false,
      error: {
        code: 'AGENT_NOT_CONFIGURED',
        message: 'Job Agent is not configured. Please set OPENAI_API_KEY environment variable.',
      },
    }, 503);
  }

  try {
    const response = await agent.chat(parseResult.data.message);

    return c.json({
      success: true,
      data: {
        message: response.message,
        toolsUsed: response.toolsUsed,
        jobsAffected: response.jobsAffected,
      },
    });
  } catch (error) {
    console.error('[JobAgent] Chat error:', error);
    return c.json({
      success: false,
      error: {
        code: 'AGENT_ERROR',
        message: 'An error occurred while processing your request.',
      },
    }, 500);
  }
});

/**
 * POST /api/jobs/chat/clear
 * Clear the Job Agent conversation history
 */
jobsRouter.post('/chat/clear', async (c) => {
  const agent = getJobAgent();
  agent.clearHistory();

  return c.json({
    success: true,
    message: 'Conversation history cleared',
  });
});

/**
 * GET /api/jobs/chat/status
 * Get Job Agent status
 */
jobsRouter.get('/chat/status', async (c) => {
  const agent = getJobAgent();

  return c.json({
    success: true,
    data: {
      configured: agent.isConfigured(),
      historyLength: agent.getHistoryLength(),
    },
  });
});

// ============================================
// Dynamic Job Routes (MUST BE LAST - /:id matches any path segment)
// ============================================

/**
 * GET /api/jobs/:id
 * Get a single job by ID
 */
jobsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid job ID format');
  }

  const job = await jobService.getById(id);

  if (!job) {
    throw new NotFoundError('Job');
  }

  return c.json({
    success: true,
    data: job,
  });
});

/**
 * GET /api/jobs/:id/history
 * Get application history for a job
 */
jobsRouter.get('/:id/history', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid job ID format');
  }

  const history = await jobService.getHistory(id);

  return c.json({
    success: true,
    data: history,
  });
});

/**
 * PATCH /api/jobs/:id
 * Update a job
 */
jobsRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid job ID format');
  }

  const body = await c.req.json();
  const parseResult = updateJobSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const job = await jobService.update(id, parseResult.data as any);

  if (!job) {
    throw new NotFoundError('Job');
  }

  return c.json({
    success: true,
    data: job,
    message: 'Job updated successfully',
  });
});

/**
 * POST /api/jobs/:id/apply
 * Mark a job as applied
 */
jobsRouter.post('/:id/apply', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid job ID format');
  }

  const body = await c.req.json().catch(() => ({}));

  const job = await jobService.markApplied(id, {
    resumeUsedId: body.resumeUsedId,
    coverLetter: body.coverLetter,
    appliedVia: body.appliedVia || 'manual',
  });

  if (!job) {
    throw new NotFoundError('Job');
  }

  return c.json({
    success: true,
    data: job,
    message: 'Job marked as applied',
  });
});

/**
 * POST /api/jobs/:id/archive
 * Archive a job to vault
 */
jobsRouter.post('/:id/archive', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid job ID format');
  }

  const result = await jobService.archiveToVault(id);

  if (!result) {
    throw new NotFoundError('Job');
  }

  return c.json({
    success: true,
    data: result,
    message: 'Job archived to vault',
  });
});

/**
 * DELETE /api/jobs/:id
 * Delete a job
 */
jobsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw new ValidationError('Invalid job ID format');
  }

  const deleted = await jobService.delete(id);

  if (!deleted) {
    throw new NotFoundError('Job');
  }

  return c.json({
    success: true,
    message: 'Job deleted successfully',
  });
});

export { jobsRouter };

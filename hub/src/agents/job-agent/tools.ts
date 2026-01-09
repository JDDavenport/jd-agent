import type Anthropic from '@anthropic-ai/sdk';

/**
 * Tool definitions for the Job Agent
 *
 * These define what actions the job agent can take for job discovery,
 * application, and tracking.
 */

export const JOB_AGENT_TOOLS: Anthropic.Tool[] = [
  // ============================================
  // DISCOVERY TOOLS
  // ============================================
  {
    name: 'job_search',
    description: `Search for jobs based on criteria. Uses the user's job profile to find matching positions.
Returns a list of jobs with match scores based on profile alignment.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query (e.g., "senior software engineer", "ML engineer", "product manager")',
        },
        location: {
          type: 'string',
          description: 'Location filter (e.g., "San Francisco", "Remote", "New York")',
        },
        platforms: {
          type: 'array',
          items: { type: 'string' },
          description: 'Platforms to search (linkedin, indeed, greenhouse, lever). If not specified, searches all configured.',
        },
        minMatchScore: {
          type: 'number',
          description: 'Minimum match score (0-100) for results. Defaults to profile\'s auto-apply threshold.',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return. Default 20.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'job_analyze',
    description: `Deep analysis of a job posting. Extracts requirements, compares against profile,
identifies strengths/gaps, and provides application recommendations.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        jobId: {
          type: 'string',
          description: 'ID of an existing job in the database',
        },
        url: {
          type: 'string',
          description: 'URL of a job posting to analyze (creates new job entry)',
        },
        content: {
          type: 'string',
          description: 'Raw job description text to analyze (creates new job entry)',
        },
      },
    },
  },
  {
    name: 'job_calculate_match',
    description: `Calculate match score between a job and the user's profile.
Returns a detailed breakdown of how well the job matches preferences, skills, and requirements.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        jobId: {
          type: 'string',
          description: 'ID of the job to score',
        },
      },
      required: ['jobId'],
    },
  },
  {
    name: 'job_get_profile',
    description: 'Get the user\'s job profile with preferences, target companies, skills, and auto-apply settings.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'job_update_profile',
    description: 'Update the user\'s job profile preferences.',
    input_schema: {
      type: 'object' as const,
      properties: {
        targetTitles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Job titles to target (e.g., ["Software Engineer", "Senior SWE", "ML Engineer"])',
        },
        targetCompanies: {
          type: 'array',
          items: { type: 'string' },
          description: 'Dream companies to prioritize',
        },
        excludeCompanies: {
          type: 'array',
          items: { type: 'string' },
          description: 'Companies to avoid',
        },
        minSalary: {
          type: 'number',
          description: 'Minimum acceptable salary',
        },
        preferredLocations: {
          type: 'array',
          items: { type: 'string' },
          description: 'Preferred locations',
        },
        remotePreference: {
          type: 'string',
          enum: ['remote_only', 'hybrid_ok', 'onsite_ok', 'any'],
          description: 'Remote work preference',
        },
        skills: {
          type: 'array',
          items: { type: 'string' },
          description: 'Skills to highlight/match against',
        },
        autoApplyEnabled: {
          type: 'boolean',
          description: 'Enable automatic applications for high-match jobs',
        },
        autoApplyThreshold: {
          type: 'number',
          description: 'Minimum match score for auto-apply (default 85)',
        },
      },
    },
  },

  // ============================================
  // APPLICATION TOOLS
  // ============================================
  {
    name: 'job_select_resume',
    description: `Select the best resume variant for a specific job application.
Analyzes job requirements against available resumes and picks the best match.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        jobId: {
          type: 'string',
          description: 'ID of the job to apply for',
        },
      },
      required: ['jobId'],
    },
  },
  {
    name: 'job_generate_cover_letter',
    description: `Generate a tailored cover letter for a specific job application.
Uses job requirements, company info, and resume to create a personalized letter.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        jobId: {
          type: 'string',
          description: 'ID of the job',
        },
        resumeId: {
          type: 'string',
          description: 'ID of resume to base letter on. Uses default if not specified.',
        },
        tone: {
          type: 'string',
          enum: ['professional', 'enthusiastic', 'conversational', 'formal'],
          description: 'Tone of the cover letter. Default professional.',
        },
        highlights: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific achievements or experiences to highlight',
        },
      },
      required: ['jobId'],
    },
  },
  {
    name: 'job_answer_screening',
    description: `Answer a screening question using saved responses or generate a new one.
Searches saved screening answers first, then generates based on profile if not found.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        question: {
          type: 'string',
          description: 'The screening question to answer',
        },
        jobId: {
          type: 'string',
          description: 'Job ID for context (optional)',
        },
        saveResponse: {
          type: 'boolean',
          description: 'Save the generated response for future use',
        },
      },
      required: ['question'],
    },
  },
  {
    name: 'job_mark_applied',
    description: `Mark a job as applied and record application details.
Updates job status and logs to application history.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        jobId: {
          type: 'string',
          description: 'ID of the job',
        },
        resumeUsedId: {
          type: 'string',
          description: 'ID of resume used for application',
        },
        coverLetter: {
          type: 'string',
          description: 'Cover letter content used',
        },
        appliedVia: {
          type: 'string',
          enum: ['agent', 'manual'],
          description: 'How the application was submitted',
        },
        notes: {
          type: 'string',
          description: 'Notes about the application',
        },
      },
      required: ['jobId'],
    },
  },

  // ============================================
  // TRACKING TOOLS
  // ============================================
  {
    name: 'job_list',
    description: 'List jobs with optional filters. Shows job pipeline status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['discovered', 'saved', 'applying', 'applied', 'phone_screen', 'interviewing', 'offered', 'rejected', 'withdrawn', 'accepted'],
          description: 'Filter by single status',
        },
        statuses: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by multiple statuses',
        },
        platform: {
          type: 'string',
          description: 'Filter by platform (linkedin, indeed, etc.)',
        },
        company: {
          type: 'string',
          description: 'Filter by company name (partial match)',
        },
        minMatchScore: {
          type: 'number',
          description: 'Minimum match score',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return',
        },
      },
    },
  },
  {
    name: 'job_get',
    description: 'Get detailed information about a specific job.',
    input_schema: {
      type: 'object' as const,
      properties: {
        jobId: {
          type: 'string',
          description: 'ID of the job',
        },
      },
      required: ['jobId'],
    },
  },
  {
    name: 'job_update_status',
    description: `Update a job's status in the pipeline. Logs change to history.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        jobId: {
          type: 'string',
          description: 'ID of the job',
        },
        status: {
          type: 'string',
          enum: ['discovered', 'saved', 'applying', 'applied', 'phone_screen', 'interviewing', 'offered', 'rejected', 'withdrawn', 'accepted'],
          description: 'New status',
        },
        notes: {
          type: 'string',
          description: 'Notes about the status change',
        },
      },
      required: ['jobId', 'status'],
    },
  },
  {
    name: 'job_add_note',
    description: 'Add a note to a job. Useful for tracking interactions, prep notes, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        jobId: {
          type: 'string',
          description: 'ID of the job',
        },
        note: {
          type: 'string',
          description: 'Note content to append',
        },
      },
      required: ['jobId', 'note'],
    },
  },
  {
    name: 'job_schedule_followup',
    description: 'Schedule a follow-up reminder for a job application.',
    input_schema: {
      type: 'object' as const,
      properties: {
        jobId: {
          type: 'string',
          description: 'ID of the job',
        },
        date: {
          type: 'string',
          description: 'Follow-up date in ISO format',
        },
        reason: {
          type: 'string',
          description: 'Reason for follow-up (added to notes)',
        },
      },
      required: ['jobId', 'date'],
    },
  },
  {
    name: 'job_add_interview',
    description: 'Add an interview to a job\'s history.',
    input_schema: {
      type: 'object' as const,
      properties: {
        jobId: {
          type: 'string',
          description: 'ID of the job',
        },
        date: {
          type: 'string',
          description: 'Interview date/time in ISO format',
        },
        type: {
          type: 'string',
          enum: ['phone', 'video', 'onsite', 'technical', 'behavioral', 'panel', 'final'],
          description: 'Type of interview',
        },
        with: {
          type: 'string',
          description: 'Who the interview is with (name, title)',
        },
        notes: {
          type: 'string',
          description: 'Prep notes or post-interview notes',
        },
        outcome: {
          type: 'string',
          enum: ['pending', 'passed', 'failed', 'cancelled'],
          description: 'Interview outcome',
        },
      },
      required: ['jobId', 'date', 'type'],
    },
  },
  {
    name: 'job_add_contact',
    description: 'Add a contact person for a job (recruiter, hiring manager, etc.).',
    input_schema: {
      type: 'object' as const,
      properties: {
        jobId: {
          type: 'string',
          description: 'ID of the job',
        },
        name: {
          type: 'string',
          description: 'Contact name',
        },
        role: {
          type: 'string',
          description: 'Role (recruiter, hiring_manager, interviewer)',
        },
        email: {
          type: 'string',
          description: 'Email address',
        },
        phone: {
          type: 'string',
          description: 'Phone number',
        },
        linkedin: {
          type: 'string',
          description: 'LinkedIn profile URL',
        },
        notes: {
          type: 'string',
          description: 'Notes about the contact',
        },
      },
      required: ['jobId', 'name'],
    },
  },
  {
    name: 'job_archive',
    description: 'Archive a job to the vault for long-term storage. Saves all details, notes, and history.',
    input_schema: {
      type: 'object' as const,
      properties: {
        jobId: {
          type: 'string',
          description: 'ID of the job to archive',
        },
      },
      required: ['jobId'],
    },
  },

  // ============================================
  // STATS & REPORTING
  // ============================================
  {
    name: 'job_stats',
    description: 'Get job search statistics including application counts, response rates, and pipeline health.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'job_get_followups',
    description: 'Get jobs that need follow-up (follow-up date has passed).',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },

  // ============================================
  // RESUME MANAGEMENT
  // ============================================
  {
    name: 'resume_list',
    description: 'List all resumes with their variants and skills.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'resume_get',
    description: 'Get details of a specific resume.',
    input_schema: {
      type: 'object' as const,
      properties: {
        resumeId: {
          type: 'string',
          description: 'ID of the resume',
        },
      },
      required: ['resumeId'],
    },
  },
  {
    name: 'resume_set_default',
    description: 'Set a resume as the default for applications.',
    input_schema: {
      type: 'object' as const,
      properties: {
        resumeId: {
          type: 'string',
          description: 'ID of the resume to set as default',
        },
      },
      required: ['resumeId'],
    },
  },

  // ============================================
  // SCREENING ANSWER MANAGEMENT
  // ============================================
  {
    name: 'screening_list',
    description: 'List all saved screening question answers.',
    input_schema: {
      type: 'object' as const,
      properties: {
        category: {
          type: 'string',
          enum: ['work_auth', 'salary', 'availability', 'experience', 'relocation', 'other'],
          description: 'Filter by category',
        },
      },
    },
  },
  {
    name: 'screening_save',
    description: 'Save a new screening question/answer pair for future use.',
    input_schema: {
      type: 'object' as const,
      properties: {
        questionPattern: {
          type: 'string',
          description: 'Question text or regex pattern to match',
        },
        answer: {
          type: 'string',
          description: 'Answer to use',
        },
        category: {
          type: 'string',
          enum: ['work_auth', 'salary', 'availability', 'experience', 'relocation', 'other'],
          description: 'Category of question',
        },
        isDefault: {
          type: 'boolean',
          description: 'Set as default answer for this category',
        },
      },
      required: ['questionPattern', 'answer'],
    },
  },

  // ============================================
  // BROWSER AUTOMATION TOOLS
  // ============================================
  {
    name: 'browser_login',
    description: `Login to a job board platform. Required before searching or applying to jobs on that platform.
Supported platforms: linkedin, mbaexchange`,
    input_schema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          enum: ['linkedin', 'mbaexchange'],
          description: 'Platform to login to',
        },
        email: {
          type: 'string',
          description: 'Email/username for login',
        },
        password: {
          type: 'string',
          description: 'Password for login',
        },
      },
      required: ['platform'],
    },
  },
  {
    name: 'browser_search_jobs',
    description: `Search for jobs on a job board platform using browser automation.
Returns job listings that can be saved to the database and applied to.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          enum: ['linkedin', 'mbaexchange'],
          description: 'Platform to search on',
        },
        query: {
          type: 'string',
          description: 'Search query (job title, keywords, etc.)',
        },
        location: {
          type: 'string',
          description: 'Location filter',
        },
        remote: {
          type: 'boolean',
          description: 'Filter for remote jobs only',
        },
        easyApply: {
          type: 'boolean',
          description: 'Filter for Easy Apply jobs only (LinkedIn)',
        },
      },
      required: ['platform', 'query'],
    },
  },
  {
    name: 'browser_apply',
    description: `Apply to a job using browser automation.
Handles Easy Apply (LinkedIn) or standard application forms.
Requires being logged in to the platform first.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          enum: ['linkedin', 'mbaexchange'],
          description: 'Platform the job is on',
        },
        jobUrl: {
          type: 'string',
          description: 'URL of the job posting',
        },
        resumePath: {
          type: 'string',
          description: 'Path to resume file to upload',
        },
        coverLetter: {
          type: 'string',
          description: 'Cover letter text (optional)',
        },
      },
      required: ['platform', 'jobUrl'],
    },
  },
  {
    name: 'browser_get_job_details',
    description: 'Get detailed information about a job from a job board using browser automation.',
    input_schema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          enum: ['linkedin', 'mbaexchange'],
          description: 'Platform the job is on',
        },
        jobUrl: {
          type: 'string',
          description: 'URL of the job posting',
        },
      },
      required: ['platform', 'jobUrl'],
    },
  },
];

// Tool name type for type safety
export type JobToolName =
  // Discovery
  | 'job_search'
  | 'job_analyze'
  | 'job_calculate_match'
  | 'job_get_profile'
  | 'job_update_profile'
  // Application
  | 'job_select_resume'
  | 'job_generate_cover_letter'
  | 'job_answer_screening'
  | 'job_mark_applied'
  // Tracking
  | 'job_list'
  | 'job_get'
  | 'job_update_status'
  | 'job_add_note'
  | 'job_schedule_followup'
  | 'job_add_interview'
  | 'job_add_contact'
  | 'job_archive'
  // Stats
  | 'job_stats'
  | 'job_get_followups'
  // Resume
  | 'resume_list'
  | 'resume_get'
  | 'resume_set_default'
  // Screening
  | 'screening_list'
  | 'screening_save'
  // Browser automation
  | 'browser_login'
  | 'browser_search_jobs'
  | 'browser_apply'
  | 'browser_get_job_details';

import type Anthropic from '@anthropic-ai/sdk';

/**
 * Tool definitions for the Master Agent
 * 
 * These define what actions the agent can take and the parameters
 * each action accepts.
 */

export const AGENT_TOOLS: Anthropic.Tool[] = [
  // ============================================
  // TASK TOOLS
  // ============================================
  {
    name: 'task_create',
    description: `Create a new task in the task system. Use this when Human JD mentions something they need to do.

IMPORTANT - Task Status Logic:
- If NO scheduledStart is provided → task goes to 'inbox' (not fully baked, needs clarification)
- If scheduledStart IS provided → task is 'today' (if scheduled today) or 'upcoming' (if scheduled for future)

A task is "fully baked" when it has a specific scheduled date/time to work on it.
The dueDate is the DEADLINE (when it must be done BY).
The scheduledStart is WHEN they plan to WORK on it (separate concept).`,
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Task title - should be action-oriented and start with a verb (e.g., "Complete assignment 3", "Review notes for midterm")',
        },
        description: {
          type: 'string',
          description: 'Additional details about the task',
        },
        dueDate: {
          type: 'string',
          description: 'DEADLINE - when the task must be completed BY. ISO 8601 format (e.g., "2026-01-10T23:59:00Z"). This is NOT when they will work on it.',
        },
        dueDateIsHard: {
          type: 'boolean',
          description: 'True if this is a hard deadline (assignment due, meeting), false for soft targets',
        },
        scheduledStart: {
          type: 'string',
          description: 'WORK TIME - when they plan to START working on this task. ISO 8601 format. If provided, task is "fully baked" and will be scheduled (not inbox).',
        },
        scheduledEnd: {
          type: 'string',
          description: 'When they plan to FINISH working on this task. If not provided, will be calculated from timeEstimateMinutes or default to 1 hour after start.',
        },
        source: {
          type: 'string',
          enum: ['email', 'canvas', 'meeting', 'recording', 'manual', 'calendar', 'remarkable', 'chat'],
          description: 'Where this task originated from. Use "chat" for tasks created via conversation.',
        },
        context: {
          type: 'string',
          description: 'The class, project, or life area (e.g., "CS401", "MBA501", "Personal", "Work")',
        },
        priority: {
          type: 'number',
          description: 'Priority level: 0 (none), 1 (low), 2 (medium), 3 (high), 4 (urgent)',
        },
        timeEstimateMinutes: {
          type: 'number',
          description: 'Estimated time to complete in minutes',
        },
        energyLevel: {
          type: 'string',
          enum: ['high', 'low', 'admin'],
          description: 'Energy level required: high (deep focus), low (routine), admin (administrative)',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'task_list',
    description: 'List tasks with optional filters. Use this to see what tasks exist, check today\'s tasks, or find tasks in a specific context.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['inbox', 'today', 'upcoming', 'waiting', 'someday', 'done', 'archived'],
          description: 'Filter by task status',
        },
        context: {
          type: 'string',
          description: 'Filter by context (class, project, etc.)',
        },
        dueBefore: {
          type: 'string',
          description: 'ISO date - show tasks due before this date',
        },
        dueAfter: {
          type: 'string',
          description: 'ISO date - show tasks due after this date',
        },
        includeCompleted: {
          type: 'boolean',
          description: 'Include completed tasks in results',
        },
      },
    },
  },
  {
    name: 'task_update',
    description: 'Update an existing task. Use this to change status, update due dates, or modify task details.',
    input_schema: {
      type: 'object' as const,
      properties: {
        taskId: {
          type: 'string',
          description: 'The UUID of the task to update',
        },
        title: {
          type: 'string',
          description: 'New title for the task',
        },
        status: {
          type: 'string',
          enum: ['inbox', 'today', 'upcoming', 'waiting', 'someday', 'done', 'archived'],
          description: 'New status for the task',
        },
        dueDate: {
          type: 'string',
          description: 'New due date in ISO format, or null to remove',
        },
        priority: {
          type: 'number',
          description: 'New priority level (0-4)',
        },
        context: {
          type: 'string',
          description: 'New context',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'task_complete',
    description: 'Mark a task as complete. Use this when Human JD finishes a task.',
    input_schema: {
      type: 'object' as const,
      properties: {
        taskId: {
          type: 'string',
          description: 'The UUID of the task to complete',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'task_counts',
    description: 'Get counts of tasks by status. Useful for a quick overview of the task system state.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },

  // ============================================
  // VAULT TOOLS
  // ============================================
  {
    name: 'vault_search',
    description: 'Search the knowledge vault using full-text search. Use this to find notes, summaries, or reference material.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Natural language search query (e.g., "neural networks", "strategy discussion", "midterm material")',
        },
        context: {
          type: 'string',
          description: 'Filter results to a specific context (class, project, etc.)',
        },
        contentType: {
          type: 'string',
          enum: ['note', 'recording_summary', 'lecture', 'meeting', 'article', 'reference'],
          description: 'Filter by content type',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'vault_create',
    description: 'Create a new entry in the knowledge vault. Use this to save notes, summaries, or reference material.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Title for the entry (e.g., "2026-01-05 Lecture - CS401 Neural Networks")',
        },
        content: {
          type: 'string',
          description: 'The content in markdown format',
        },
        contentType: {
          type: 'string',
          enum: ['note', 'recording_summary', 'lecture', 'meeting', 'article', 'reference'],
          description: 'Type of content',
        },
        context: {
          type: 'string',
          description: 'Context (class, project, etc.)',
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tags for categorization',
        },
        source: {
          type: 'string',
          enum: ['remarkable', 'plaud', 'email', 'manual', 'web', 'canvas'],
          description: 'Where this content came from',
        },
      },
      required: ['title', 'contentType', 'context', 'source'],
    },
  },
  {
    name: 'vault_get',
    description: 'Get a specific vault entry by ID. Use this to retrieve full content of a search result.',
    input_schema: {
      type: 'object' as const,
      properties: {
        entryId: {
          type: 'string',
          description: 'The UUID of the vault entry',
        },
      },
      required: ['entryId'],
    },
  },
  {
    name: 'vault_stats',
    description: 'Get statistics about the knowledge vault. Shows counts by context, type, and source.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'vault_smart_add',
    description: `Intelligently add data to the vault with automatic classification. Use this when:
- Human JD says something like "remember this", "save this", or uses "-vault"
- They share contact info, passwords, important dates, or any data to remember later

The agent will automatically:
1. Detect the content type (person info, credential, note, reference, etc.)
2. Assign appropriate tags
3. Choose the right category/context
4. Store securely

Examples of what to save:
- "John's birthday is March 15" → person type, linked to John
- "WiFi password: MySecret123" → credential type, tagged as wifi
- "SSN: 123-45-6789" → financial type, sensitive
- "Meeting notes from today..." → meeting_notes type
- Random info to remember → note type`,
    input_schema: {
      type: 'object' as const,
      properties: {
        content: {
          type: 'string',
          description: 'The raw content/data to save. Can be anything - contact info, passwords, notes, etc.',
        },
        title: {
          type: 'string',
          description: 'Optional title. If not provided, will be auto-generated from content.',
        },
        relatedPersonName: {
          type: 'string',
          description: 'If this info relates to a specific person, their name (will try to link to people database)',
        },
        isSensitive: {
          type: 'boolean',
          description: 'Mark as sensitive if contains passwords, SSN, financial info, etc.',
        },
        suggestedTags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional tags to add',
        },
      },
      required: ['content'],
    },
  },

  // ============================================
  // CALENDAR TOOLS
  // ============================================
  {
    name: 'calendar_today',
    description: 'Get today\'s calendar events. Use this to see the schedule for today.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'calendar_upcoming',
    description: 'Get upcoming calendar events for the next N days.',
    input_schema: {
      type: 'object' as const,
      properties: {
        days: {
          type: 'number',
          description: 'Number of days to look ahead (default: 7)',
        },
      },
    },
  },
  {
    name: 'calendar_query',
    description: 'Query calendar events within a date range.',
    input_schema: {
      type: 'object' as const,
      properties: {
        startDate: {
          type: 'string',
          description: 'Start of date range in ISO format',
        },
        endDate: {
          type: 'string',
          description: 'End of date range in ISO format',
        },
        eventType: {
          type: 'string',
          enum: ['class', 'meeting', 'deadline', 'personal', 'blocked_time'],
          description: 'Filter by event type',
        },
      },
      required: ['startDate', 'endDate'],
    },
  },
  {
    name: 'calendar_create',
    description: `Create a new calendar event. Will sync to Google Calendar if configured.
Can include attendees (people who should be at the event) and location/address.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Event title',
        },
        description: {
          type: 'string',
          description: 'Event description',
        },
        startTime: {
          type: 'string',
          description: 'Start time in ISO format',
        },
        endTime: {
          type: 'string',
          description: 'End time in ISO format',
        },
        location: {
          type: 'string',
          description: 'Event location/address (e.g., "123 Main St, City" or "Room 301")',
        },
        attendees: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of attendee names or emails (e.g., ["John Smith", "jane@email.com"])',
        },
        eventType: {
          type: 'string',
          enum: ['class', 'meeting', 'deadline', 'personal', 'blocked_time'],
          description: 'Type of event',
        },
        context: {
          type: 'string',
          description: 'Related context (class, project)',
        },
      },
      required: ['title', 'startTime', 'endTime'],
    },
  },
  {
    name: 'calendar_check_conflicts',
    description: 'Check if a proposed time slot has conflicts with existing events.',
    input_schema: {
      type: 'object' as const,
      properties: {
        startTime: {
          type: 'string',
          description: 'Proposed start time in ISO format',
        },
        endTime: {
          type: 'string',
          description: 'Proposed end time in ISO format',
        },
      },
      required: ['startTime', 'endTime'],
    },
  },
  {
    name: 'calendar_from_image',
    description: `Extract event details from a screenshot/image and create a calendar event.
Use this when Human JD shares a screenshot of an event invite, flyer, or any image containing event information.
The agent will use vision to extract: title, date, time, location, attendees, etc.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        imageUrl: {
          type: 'string',
          description: 'URL of the image to analyze (must be publicly accessible or base64 data URL)',
        },
        imageBase64: {
          type: 'string',
          description: 'Base64-encoded image data (without the data:image prefix)',
        },
        additionalContext: {
          type: 'string',
          description: 'Any additional context about the event (e.g., "this is for next week", "John invited me to this")',
        },
      },
    },
  },

  // ============================================
  // CANVAS/INGESTION TOOLS
  // ============================================
  {
    name: 'canvas_sync',
    description: 'Sync assignments and content from Canvas LMS. This imports upcoming assignments as tasks and course announcements to the vault.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'canvas_assignments',
    description: 'Get upcoming assignments from Canvas LMS courses.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },

  // ============================================
  // TIME TRACKING TOOLS
  // ============================================
  {
    name: 'time_log',
    description: 'Log daily time tracking data including screen time, productive time, and waste time.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format. Defaults to today.',
        },
        totalScreenTimeMinutes: {
          type: 'number',
          description: 'Total screen time in minutes',
        },
        productiveMinutes: {
          type: 'number',
          description: 'Productive time in minutes',
        },
        wasteMinutes: {
          type: 'number',
          description: 'Wasted time in minutes',
        },
      },
    },
  },
  {
    name: 'time_report',
    description: 'Get a daily productivity report with insights and trends.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: {
          type: 'string',
          description: 'Date in YYYY-MM-DD format. Defaults to today.',
        },
      },
    },
  },
  {
    name: 'time_stats',
    description: 'Get time tracking statistics for a period (last N days).',
    input_schema: {
      type: 'object' as const,
      properties: {
        days: {
          type: 'number',
          description: 'Number of days to analyze. Default is 7.',
        },
      },
    },
  },

  // ============================================
  // SCHEDULING TOOLS
  // ============================================
  {
    name: 'schedule_task',
    description: 'Schedule a task for a specific time. This creates a calendar block and tracks when the user plans to work on it (separate from due date).',
    input_schema: {
      type: 'object' as const,
      properties: {
        taskId: {
          type: 'string',
          description: 'The ID of the task to schedule',
        },
        startTime: {
          type: 'string',
          description: 'Start time in ISO 8601 format (e.g., "2026-01-10T14:00:00Z")',
        },
        endTime: {
          type: 'string',
          description: 'Optional end time. If not provided, uses task time estimate or defaults to 1 hour.',
        },
        createCalendarEvent: {
          type: 'boolean',
          description: 'Whether to create a Google Calendar event. Default true.',
        },
      },
      required: ['taskId', 'startTime'],
    },
  },
  {
    name: 'schedule_suggestions',
    description: 'Get scheduling suggestions for unscheduled tasks with due dates. Helps plan when to work on upcoming tasks.',
    input_schema: {
      type: 'object' as const,
      properties: {
        days: {
          type: 'number',
          description: 'Look ahead this many days for tasks. Default is 7.',
        },
      },
    },
  },
  {
    name: 'schedule_today',
    description: 'Get today\'s scheduled tasks with their time blocks.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'unschedule_task',
    description: 'Remove a task from the schedule and delete its calendar event.',
    input_schema: {
      type: 'object' as const,
      properties: {
        taskId: {
          type: 'string',
          description: 'The ID of the task to unschedule',
        },
      },
      required: ['taskId'],
    },
  },

  // ============================================
  // SYSTEM TOOLS
  // ============================================
  {
    name: 'system_health',
    description: 'Check overall system health and status.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'integrity_check',
    description: 'Run integrity checks on the system data to find and optionally fix issues.',
    input_schema: {
      type: 'object' as const,
      properties: {
        autoFix: {
          type: 'boolean',
          description: 'Whether to automatically fix fixable issues. Default is false.',
        },
      },
    },
  },

  // ============================================
  // PEOPLE TOOLS
  // ============================================
  {
    name: 'people_create',
    description: `Add a new person to the people database. Use this when Human JD mentions someone new they want to remember.
Store contact info, how they met, relationship type, and any key facts.`,
    input_schema: {
      type: 'object' as const,
      properties: {
        name: {
          type: 'string',
          description: 'Full name of the person',
        },
        email: {
          type: 'string',
          description: 'Email address',
        },
        phone: {
          type: 'string',
          description: 'Phone number',
        },
        howMet: {
          type: 'string',
          description: 'How they met (e.g., "MBA orientation", "Through mutual friend Sarah")',
        },
        whereMet: {
          type: 'string',
          description: 'Where they met (e.g., "Stanford campus", "Tech conference")',
        },
        firstMetDate: {
          type: 'string',
          description: 'When they first met in YYYY-MM-DD format',
        },
        relationshipType: {
          type: 'string',
          enum: ['professor', 'classmate', 'colleague', 'friend', 'family', 'other'],
          description: 'Type of relationship',
        },
        keyFacts: {
          type: 'array',
          items: { type: 'string' },
          description: 'Important facts to remember about this person (interests, birthday, family, etc.)',
        },
        notes: {
          type: 'string',
          description: 'Additional notes about this person',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'people_search',
    description: 'Search for people in the database by name.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Name or partial name to search for',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'people_get',
    description: 'Get full details about a specific person including their interaction history.',
    input_schema: {
      type: 'object' as const,
      properties: {
        personId: {
          type: 'string',
          description: 'The UUID of the person',
        },
      },
      required: ['personId'],
    },
  },
  {
    name: 'people_update',
    description: 'Update information about a person. Use this to add new key facts, update contact info, or add notes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        personId: {
          type: 'string',
          description: 'The UUID of the person to update',
        },
        name: {
          type: 'string',
          description: 'Updated name',
        },
        email: {
          type: 'string',
          description: 'Updated email',
        },
        phone: {
          type: 'string',
          description: 'Updated phone',
        },
        keyFacts: {
          type: 'array',
          items: { type: 'string' },
          description: 'Key facts (replaces existing)',
        },
        notes: {
          type: 'string',
          description: 'Updated notes',
        },
        relationshipType: {
          type: 'string',
          enum: ['professor', 'classmate', 'colleague', 'friend', 'family', 'other'],
          description: 'Updated relationship type',
        },
      },
      required: ['personId'],
    },
  },
  {
    name: 'people_add_interaction',
    description: 'Log an interaction with a person. Use this to track meetings, calls, or conversations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        personId: {
          type: 'string',
          description: 'The UUID of the person',
        },
        interactionDate: {
          type: 'string',
          description: 'Date of interaction in ISO format',
        },
        interactionType: {
          type: 'string',
          description: 'Type of interaction (e.g., "meeting", "call", "email", "coffee")',
        },
        summary: {
          type: 'string',
          description: 'Brief summary of what was discussed',
        },
        commitmentsByThem: {
          type: 'array',
          items: { type: 'string' },
          description: 'Things they committed to do',
        },
        commitmentsByMe: {
          type: 'array',
          items: { type: 'string' },
          description: 'Things Human JD committed to do',
        },
      },
      required: ['personId', 'interactionDate'],
    },
  },

  // ============================================
  // UTILITY TOOLS
  // ============================================
  {
    name: 'get_current_context',
    description: 'Get the current context including today\'s tasks, upcoming events, and system status. Use this at the start of a conversation to understand the current state.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },

  // ============================================
  // JOB HUNTING TOOLS
  // ============================================
  {
    name: 'job_search',
    description: 'Search for jobs in the job hunting database. Returns jobs matching the query with their status and match scores.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query (company, title, or keywords)',
        },
        status: {
          type: 'string',
          enum: ['discovered', 'saved', 'applying', 'applied', 'phone_screen', 'interviewing', 'offered', 'rejected', 'withdrawn', 'accepted'],
          description: 'Filter by job status',
        },
        limit: {
          type: 'number',
          description: 'Maximum results (default 10)',
        },
      },
    },
  },
  {
    name: 'job_stats',
    description: 'Get job hunting statistics including application counts, response rates, and pipeline health.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'job_update_status',
    description: 'Update a job\'s status in the pipeline (e.g., mark as applied, interviewing, rejected).',
    input_schema: {
      type: 'object' as const,
      properties: {
        jobId: {
          type: 'string',
          description: 'ID of the job to update',
        },
        status: {
          type: 'string',
          enum: ['discovered', 'saved', 'applying', 'applied', 'phone_screen', 'interviewing', 'offered', 'rejected', 'withdrawn', 'accepted'],
          description: 'New status',
        },
        notes: {
          type: 'string',
          description: 'Optional notes about the status change',
        },
      },
      required: ['jobId', 'status'],
    },
  },
  {
    name: 'job_followups',
    description: 'Get jobs that need follow-up (scheduled follow-up date has passed).',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
];

// Tool name type for type safety
export type ToolName =
  | 'task_create'
  | 'task_list'
  | 'task_update'
  | 'task_complete'
  | 'task_counts'
  | 'vault_search'
  | 'vault_create'
  | 'vault_get'
  | 'vault_stats'
  | 'vault_smart_add'
  | 'calendar_today'
  | 'calendar_upcoming'
  | 'calendar_query'
  | 'calendar_create'
  | 'calendar_check_conflicts'
  | 'calendar_from_image'
  | 'canvas_sync'
  | 'canvas_assignments'
  | 'time_log'
  | 'time_report'
  | 'time_stats'
  | 'schedule_task'
  | 'schedule_suggestions'
  | 'schedule_today'
  | 'unschedule_task'
  | 'system_health'
  | 'integrity_check'
  | 'people_create'
  | 'people_search'
  | 'people_get'
  | 'people_update'
  | 'people_add_interaction'
  | 'get_current_context'
  | 'job_search'
  | 'job_stats'
  | 'job_update_status'
  | 'job_followups';

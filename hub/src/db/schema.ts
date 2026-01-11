import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  real,
  jsonb,
  date,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ============================================
// PROJECTS (GTD: Projects = outcomes requiring multiple actions)
// ============================================

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    linearId: text('linear_id').unique(),

    // Core
    name: text('name').notNull(),
    description: text('description'),
    color: text('color').default('#808080'),
    icon: text('icon'),

    // Status
    status: text('status').default('active').notNull(), // active, on_hold, completed, archived

    // Hierarchy
    parentProjectId: uuid('parent_project_id'), // Self-reference for sub-projects

    // Area of responsibility (GTD: Areas)
    area: text('area'), // 'Work', 'Personal', 'School', 'Health'
    context: text('context').notNull(), // Legacy - Class, personal, work

    // Organization
    isFavorite: boolean('is_favorite').default(false).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),

    // Views
    defaultView: text('default_view').default('list'), // 'list', 'board', 'calendar'

    // Goal tracking
    targetCompletionDate: date('target_completion_date'),

    // Vault integration
    vaultFolderId: uuid('vault_folder_id'), // All project notes go here

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (table) => [
    index('projects_status_idx').on(table.status),
    index('projects_area_idx').on(table.area),
    index('projects_parent_idx').on(table.parentProjectId),
  ]
);

// ============================================
// SECTIONS (Todoist-style sections within projects)
// ============================================

export const sections = pgTable(
  'sections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    isCollapsed: boolean('is_collapsed').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('sections_project_idx').on(table.projectId)]
);

// ============================================
// CONTEXTS (GTD: @contexts - WHERE/HOW you can do work)
// ============================================

export const contexts = pgTable('contexts', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(), // '@computer', '@home', '@errands', '@calls'
  description: text('description'),
  color: text('color'),
  icon: text('icon'),
  isActive: boolean('is_active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================
// LABELS (Todoist-style tags for cross-cutting concerns)
// ============================================

export const labels = pgTable('labels', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  color: text('color').default('#808080'),
  isFavorite: boolean('is_favorite').default(false).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================
// FILTERS (Todoist-style saved filters)
// ============================================

export const filters = pgTable('filters', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  query: text('query').notNull(), // Filter query string
  color: text('color'),
  icon: text('icon'),
  isFavorite: boolean('is_favorite').default(false).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================
// TASKS (GTD: Next Actions, Calendar, Waiting For, Someday)
// ============================================

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    linearId: text('linear_id').unique(),

    // Core
    title: text('title').notNull(),
    description: text('description'),

    // GTD Status
    status: text('status').default('inbox').notNull(),
    // 'inbox'     = Unclarified (GTD: Capture)
    // 'next'      = Next action (GTD: Do ASAP)
    // 'scheduled' = Has a specific date/time (GTD: Calendar)
    // 'waiting'   = Delegated/Waiting for (GTD: Waiting For)
    // 'someday'   = Someday/Maybe (GTD: Someday)
    // 'done'      = Completed
    // 'archived'  = In vault, searchable

    // Priority (Todoist-style: 0=none, 1=low, 2=med, 3=high, 4=urgent)
    priority: integer('priority').default(0).notNull(),

    // Dates
    dueDate: timestamp('due_date', { withTimezone: true }),
    dueDateIsHard: boolean('due_date_is_hard').default(false).notNull(), // True = immovable deadline
    scheduledStart: timestamp('scheduled_start', { withTimezone: true }), // When to START working
    scheduledEnd: timestamp('scheduled_end', { withTimezone: true }), // When to STOP (for time blocks)

    // Organization (GTD: Organize)
    projectId: uuid('project_id').references(() => projects.id),
    parentTaskId: uuid('parent_task_id'), // Subtasks
    sectionId: uuid('section_id').references(() => sections.id), // Within project

    // Contexts (GTD: @contexts) - stored as array for multiple contexts
    taskContexts: text('task_contexts').array(), // ['@computer', '@home', '@calls']
    context: text('context').notNull(), // Legacy single context field

    // Labels (Todoist-style tags)
    taskLabels: text('task_labels').array(), // ['urgent', 'client-x', 'q1-goals']

    // Estimates
    timeEstimateMinutes: integer('time_estimate_minutes'),
    energyLevel: text('energy_level'), // 'high', 'low', 'admin'

    // Dependencies (GTD: Blocked)
    blockedBy: uuid('blocked_by'), // References another task
    waitingFor: text('waiting_for'), // Person we're waiting on
    waitingSince: timestamp('waiting_since', { withTimezone: true }),

    // Recurrence
    recurrenceRule: text('recurrence_rule'), // RRULE format
    recurrenceParentId: uuid('recurrence_parent_id'), // Original recurring task

    // Source tracking
    source: text('source').notNull(), // 'manual', 'email', 'canvas', 'chat', 'quick-add', 'api'
    sourceRef: text('source_ref'), // External ID (email ID, assignment ID, etc.)

    // Calendar integration
    calendarEventId: text('calendar_event_id'), // Google Calendar event ID

    // Completion
    completedAt: timestamp('completed_at', { withTimezone: true }),
    completedBy: text('completed_by'), // 'user', 'auto', 'agent'

    // Vault integration (completed tasks become vault entries)
    vaultEntryId: uuid('vault_entry_id'),

    // Order
    sortOrder: integer('sort_order').default(0).notNull(),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),

    // Sync
    syncedAt: timestamp('synced_at', { withTimezone: true }),
    syncStatus: text('sync_status').default('pending'), // pending, synced, conflict
  },
  (table) => [
    index('tasks_status_idx').on(table.status),
    index('tasks_due_date_idx').on(table.dueDate),
    index('tasks_context_idx').on(table.context),
    index('tasks_project_idx').on(table.projectId),
    index('tasks_section_idx').on(table.sectionId),
  ]
);

// ============================================
// RECORDINGS
// ============================================

export const recordings = pgTable(
  'recordings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    filePath: text('file_path').notNull(),
    originalFilename: text('original_filename'),
    durationSeconds: integer('duration_seconds'),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),

    // Classification
    recordingType: text('recording_type').notNull(), // class, meeting, conversation, other
    context: text('context'),

    // Processing status
    status: text('status').default('pending').notNull(), // pending, transcribing, summarizing, complete, failed

    // Timestamps
    recordedAt: timestamp('recorded_at', { withTimezone: true }),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),

    // Error tracking
    errorMessage: text('error_message'),
    retryCount: integer('retry_count').default(0).notNull(),
  },
  (table) => [
    index('recordings_status_idx').on(table.status),
    index('recordings_type_idx').on(table.recordingType),
  ]
);

// ============================================
// TRANSCRIPTS
// ============================================

export const transcripts = pgTable('transcripts', {
  id: uuid('id').primaryKey().defaultRandom(),
  recordingId: uuid('recording_id')
    .references(() => recordings.id, { onDelete: 'cascade' })
    .notNull(),
  fullText: text('full_text').notNull(),
  segments: jsonb('segments'), // Array of {start, end, text, speaker}
  wordCount: integer('word_count'),
  speakerCount: integer('speaker_count'),
  confidenceScore: real('confidence_score'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================
// VOICE PROFILES (Speaker Identification)
// ============================================

export const voiceProfiles = pgTable(
  'voice_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(), // Display name for this speaker
    personId: uuid('person_id').references(() => people.id, { onDelete: 'set null' }),

    // Category for organization
    category: text('category').notNull(), // 'self', 'family', 'teacher', 'classmate', 'colleague', 'other'

    // Voice characteristics (for embedding matching)
    sampleCount: integer('sample_count').default(0).notNull(),
    totalDurationSeconds: integer('total_duration_seconds').default(0).notNull(),

    // Voice embedding (512-dim pyannote vector, added via migration)
    // embedding: vector('embedding', { dimensions: 512 }),
    embeddingUpdatedAt: timestamp('embedding_updated_at', { withTimezone: true }),

    // Recognition settings
    isActive: boolean('is_active').default(true).notNull(),
    confidenceThreshold: real('confidence_threshold').default(0.75).notNull(),

    // Notes and context
    notes: text('notes'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('voice_profiles_person_idx').on(table.personId),
    index('voice_profiles_category_idx').on(table.category),
    index('voice_profiles_active_idx').on(table.isActive),
  ]
);

// ============================================
// SPEAKER MAPPINGS (Per-transcript speaker identification)
// ============================================

export const speakerMappings = pgTable(
  'speaker_mappings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    transcriptId: uuid('transcript_id')
      .references(() => transcripts.id, { onDelete: 'cascade' })
      .notNull(),
    deepgramSpeakerId: integer('deepgram_speaker_id').notNull(), // 0, 1, 2 from Deepgram
    voiceProfileId: uuid('voice_profile_id').references(() => voiceProfiles.id, { onDelete: 'set null' }),

    // Confidence and verification
    confidence: real('confidence'),
    manuallyAssigned: boolean('manually_assigned').default(false).notNull(),
    assignedAt: timestamp('assigned_at', { withTimezone: true }),
    assignedBy: text('assigned_by'), // 'user', 'auto'

    // Auto-matching fields
    autoMatched: boolean('auto_matched').default(false).notNull(),
    needsVerification: boolean('needs_verification').default(false).notNull(),
    matchScore: real('match_score'), // Cosine similarity score from embedding match

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('speaker_mappings_transcript_idx').on(table.transcriptId),
    index('speaker_mappings_profile_idx').on(table.voiceProfileId),
    index('speaker_mappings_speaker_idx').on(table.transcriptId, table.deepgramSpeakerId),
    index('speaker_mappings_auto_matched_idx').on(table.autoMatched),
    index('speaker_mappings_needs_verification_idx').on(table.needsVerification),
  ]
);

// ============================================
// VOICE SAMPLES (Speaker embedding training data)
// ============================================

export const voiceSamples = pgTable(
  'voice_samples',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    voiceProfileId: uuid('voice_profile_id')
      .references(() => voiceProfiles.id, { onDelete: 'cascade' })
      .notNull(),

    // Source information
    transcriptId: uuid('transcript_id').references(() => transcripts.id, { onDelete: 'set null' }),
    recordingId: uuid('recording_id').references(() => recordings.id, { onDelete: 'set null' }),
    deepgramSpeakerId: integer('deepgram_speaker_id'),

    // Time range within recording
    startTimeSeconds: real('start_time_seconds').notNull(),
    endTimeSeconds: real('end_time_seconds').notNull(),
    durationSeconds: real('duration_seconds').notNull(),

    // Audio storage (R2 path to extracted segment, optional)
    audioPath: text('audio_path'),

    // Embedding (512-dim pyannote vector, added via migration)
    // embedding: vector('embedding', { dimensions: 512 }),
    embeddingModel: text('embedding_model').default('pyannote-embedding'),

    // Quality metadata
    quality: text('quality'), // 'good', 'fair', 'poor'
    signalToNoise: real('signal_to_noise'), // SNR if available

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('voice_samples_profile_idx').on(table.voiceProfileId),
    index('voice_samples_transcript_idx').on(table.transcriptId),
    index('voice_samples_recording_idx').on(table.recordingId),
  ]
);

// ============================================
// RECORDING SUMMARIES
// ============================================

export const recordingSummaries = pgTable('recording_summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  recordingId: uuid('recording_id')
    .references(() => recordings.id, { onDelete: 'cascade' })
    .notNull(),
  summary: text('summary').notNull(),
  keyPoints: text('key_points').array(),
  decisions: text('decisions').array(),
  commitments: jsonb('commitments'), // Array of {person, commitment, due_date}
  questions: text('questions').array(),
  deadlinesMentioned: jsonb('deadlines_mentioned'), // Array of {description, date}
  topicsCovered: text('topics_covered').array(),
  modelUsed: text('model_used'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================
// VAULT ENTRIES (Notion-like knowledge base)
// ============================================

export const vaultEntries = pgTable(
  'vault_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Core
    title: text('title').notNull(),
    content: text('content'), // Markdown
    contentType: text('content_type').notNull(),
    // 'note', 'document', 'meeting', 'recording', 'task_archive',
    // 'email', 'article', 'reference', 'template', 'journal'

    // Organization (Notion-like hierarchy)
    parentId: uuid('parent_id'), // Self-reference for nested pages
    projectId: uuid('project_id').references(() => projects.id), // Linked project
    context: text('context').notNull(), // Class name, project, personal, reference
    tags: text('tags').array(),
    category: text('category'), // AI-classified category

    // Source tracking
    source: text('source').notNull(), // remarkable, plaud, email, manual, web, canvas, etc.
    sourceRef: text('source_ref'),
    sourceId: text('source_id'), // Original ID in source system
    sourceUrl: text('source_url'), // Link back to original
    sourcePath: text('source_path'), // Folder path in source system
    sourceDate: timestamp('source_date', { withTimezone: true }),

    // For archived tasks (GTD: completed tasks become vault entries)
    originalTaskId: uuid('original_task_id'),
    taskCompletedAt: timestamp('task_completed_at', { withTimezone: true }),
    taskProject: text('task_project'),
    taskContexts: text('task_contexts').array(),

    // For recordings
    recordingId: uuid('recording_id').references(() => recordings.id),
    recordingDurationSeconds: integer('recording_duration_seconds'),
    recordingTranscript: text('recording_transcript'),
    recordingSummary: text('recording_summary'),

    // For files
    filePath: text('file_path'),
    fileType: text('file_type'),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),

    // Related items
    relatedEntries: uuid('related_entries').array(),

    // Processing state
    isProcessed: boolean('is_processed').default(false).notNull(),
    needsReview: boolean('needs_review').default(false).notNull(),
    isDuplicate: boolean('is_duplicate').default(false).notNull(),
    duplicateOf: uuid('duplicate_of'), // Reference to canonical entry

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    importedAt: timestamp('imported_at', { withTimezone: true }),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  },
  (table) => [
    index('vault_context_idx').on(table.context),
    index('vault_type_idx').on(table.contentType),
    index('vault_category_idx').on(table.category),
    index('vault_source_idx').on(table.source),
    index('vault_source_id_idx').on(table.sourceId),
    index('vault_project_idx').on(table.projectId),
    index('vault_parent_idx').on(table.parentId),
    index('vault_is_processed_idx').on(table.isProcessed),
    index('vault_needs_review_idx').on(table.needsReview),
  ]
);

// ============================================
// VAULT EMBEDDINGS (for semantic search)
// ============================================

export const vaultEmbeddings = pgTable('vault_embeddings', {
  id: uuid('id').primaryKey().defaultRandom(),
  entryId: uuid('entry_id')
    .references(() => vaultEntries.id, { onDelete: 'cascade' })
    .notNull(),
  chunkIndex: integer('chunk_index').default(0).notNull(),
  contentChunk: text('content_chunk').notNull(),
  // Note: vector type requires pgvector extension - will be added via migration
  // embedding: vector('embedding', { dimensions: 1024 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================
// VAULT ATTACHMENTS
// ============================================

export const vaultAttachments = pgTable('vault_attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  entryId: uuid('entry_id')
    .references(() => vaultEntries.id, { onDelete: 'cascade' })
    .notNull(),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  size: bigint('size', { mode: 'number' }).notNull(),
  storagePath: text('storage_path').notNull(), // Path in R2/local storage
  extractedText: text('extracted_text'), // If we extracted text from it
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================
// VAULT PAGES (Notion-like block-based pages)
// ============================================

export const vaultPages = pgTable(
  'vault_pages',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Hierarchy
    parentId: uuid('parent_id'), // Self-reference for nested pages

    // Core properties
    title: text('title').notNull().default('Untitled'),
    icon: text('icon'), // Emoji or icon identifier
    coverImage: text('cover_image'), // URL to cover image

    // Organization
    isFavorite: boolean('is_favorite').default(false).notNull(),
    isArchived: boolean('is_archived').default(false).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),

    // Legacy link (optional - for migration from vault_entries)
    legacyEntryId: uuid('legacy_entry_id').references(() => vaultEntries.id),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    lastViewedAt: timestamp('last_viewed_at', { withTimezone: true }),
  },
  (table) => [
    index('vault_pages_parent_idx').on(table.parentId),
    index('vault_pages_favorite_idx').on(table.isFavorite),
    index('vault_pages_archived_idx').on(table.isArchived),
    index('vault_pages_sort_idx').on(table.sortOrder),
  ]
);

// ============================================
// VAULT BLOCKS (Content blocks within pages)
// ============================================

export const vaultBlocks = pgTable(
  'vault_blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Relationships
    pageId: uuid('page_id')
      .references(() => vaultPages.id, { onDelete: 'cascade' })
      .notNull(),
    parentBlockId: uuid('parent_block_id'), // For nested blocks (e.g., toggle children)

    // Block properties
    type: text('type').notNull(), // text, heading_1, heading_2, heading_3, bulleted_list, numbered_list, todo, toggle, quote, callout, divider, code, image, file, bookmark
    content: jsonb('content').notNull().default({}), // Block-specific content as JSON

    // Ordering
    sortOrder: integer('sort_order').default(0).notNull(),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('vault_blocks_page_idx').on(table.pageId),
    index('vault_blocks_parent_idx').on(table.parentBlockId),
    index('vault_blocks_order_idx').on(table.pageId, table.parentBlockId, table.sortOrder),
  ]
);

// ============================================
// VAULT REFERENCES (Cross-system links)
// ============================================

export const vaultReferences = pgTable(
  'vault_references',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Source (where the reference is)
    pageId: uuid('page_id')
      .references(() => vaultPages.id, { onDelete: 'cascade' })
      .notNull(),
    blockId: uuid('block_id').references(() => vaultBlocks.id, { onDelete: 'cascade' }),

    // Target (what it references)
    targetType: text('target_type').notNull(), // page, task, goal, calendar_event, person
    targetId: uuid('target_id').notNull(),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('vault_references_page_idx').on(table.pageId),
    index('vault_references_block_idx').on(table.blockId),
    index('vault_references_target_idx').on(table.targetType, table.targetId),
  ]
);

// ============================================
// SYNC STATE (for ongoing sync tracking)
// ============================================

export const syncState = pgTable('sync_state', {
  id: uuid('id').primaryKey().defaultRandom(),
  source: text('source').notNull().unique(), // notion, google_drive, google_docs, apple_notes
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }).notNull(),
  lastCursor: text('last_cursor'), // For paginated APIs
  lastModifiedTime: timestamp('last_modified_time', { withTimezone: true }), // For incremental sync
  status: text('status').default('idle').notNull(), // idle, running, error
  errorMessage: text('error_message'),
  itemsProcessed: integer('items_processed').default(0).notNull(),
  itemsAdded: integer('items_added').default(0).notNull(),
  itemsUpdated: integer('items_updated').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================
// PEOPLE DATABASE
// ============================================

export const people = pgTable(
  'people',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone'),
    howMet: text('how_met'),
    whereMet: text('where_met'),
    firstMetDate: date('first_met_date'),
    relationshipType: text('relationship_type'), // professor, classmate, colleague, friend, family, other
    keyFacts: text('key_facts').array(),
    notes: text('notes'),
    lastInteractionDate: date('last_interaction_date'),
    interactionCount: integer('interaction_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('people_name_idx').on(table.name)]
);

// ============================================
// INTERACTIONS
// ============================================

export const interactions = pgTable('interactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  personId: uuid('person_id')
    .references(() => people.id, { onDelete: 'cascade' })
    .notNull(),
  interactionDate: timestamp('interaction_date', { withTimezone: true }).notNull(),
  interactionType: text('interaction_type'), // meeting, class, email, call, message
  summary: text('summary'),
  recordingId: uuid('recording_id').references(() => recordings.id),
  vaultEntryId: uuid('vault_entry_id').references(() => vaultEntries.id),
  commitmentsByThem: text('commitments_by_them').array(),
  commitmentsByMe: text('commitments_by_me').array(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================
// CALENDAR EVENTS
// ============================================

export const calendarEvents = pgTable(
  'calendar_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    googleEventId: text('google_event_id').unique(),
    title: text('title').notNull(),
    description: text('description'),
    location: text('location'),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }).notNull(),
    allDay: boolean('all_day').default(false).notNull(),
    eventType: text('event_type'), // class, meeting, deadline, personal, blocked_time
    context: text('context'),
    attendees: text('attendees').array(), // Array of attendee names or email addresses
    alertSent: boolean('alert_sent').default(false).notNull(),
    syncedAt: timestamp('synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('calendar_start_idx').on(table.startTime)]
);

// ============================================
// CLASSES
// ============================================

export const classes = pgTable('classes', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  code: text('code'),
  professor: text('professor'),
  canvasCourseId: text('canvas_course_id'),
  schedule: jsonb('schedule'), // Array of {day, start_time, end_time, location}
  agentSystemPrompt: text('agent_system_prompt'),
  status: text('status').default('active').notNull(), // active, completed, dropped
  semester: text('semester'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================
// CEREMONIES
// ============================================

export const ceremonies = pgTable('ceremonies', {
  id: uuid('id').primaryKey().defaultRandom(),
  ceremonyType: text('ceremony_type').notNull(), // morning, evening, weekly
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  skipped: boolean('skipped').default(false).notNull(),
  skipReason: text('skip_reason'),
  notes: text('notes'),
  content: jsonb('content'), // ceremony content as JSON
  deliveryStatus: text('delivery_status'), // delivered, failed, pending
  deliveryChannel: text('delivery_channel'), // telegram, sms, email
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================
// TIME TRACKING
// ============================================

export const timeTracking = pgTable('time_tracking', {
  id: uuid('id').primaryKey().defaultRandom(),
  date: date('date').notNull(),
  totalScreenTimeMinutes: integer('total_screen_time_minutes'),
  productiveMinutes: integer('productive_minutes'),
  wasteMinutes: integer('waste_minutes'),
  appBreakdown: jsonb('app_breakdown'), // {app_name: minutes}
  categoryBreakdown: jsonb('category_breakdown'), // {productive: X, waste: Y, neutral: Z}
  tasksPlanned: integer('tasks_planned'),
  tasksCompleted: integer('tasks_completed'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================
// SYSTEM LOGS
// ============================================

export const systemLogs = pgTable('system_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  logType: text('log_type').notNull(), // error, warning, info, audit
  component: text('component'),
  message: text('message').notNull(),
  details: jsonb('details'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================
// INTEGRITY CHECKS
// ============================================

export const integrityChecks = pgTable('integrity_checks', {
  id: uuid('id').primaryKey().defaultRandom(),
  checkType: text('check_type').notNull(),
  passed: boolean('passed').notNull(),
  details: jsonb('details'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================
// TIME BLOCKS
// ============================================

export const timeBlocks = pgTable(
  'time_blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id').references(() => tasks.id),
    title: text('title'),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }).notNull(),
    status: text('status').default('scheduled').notNull(), // scheduled, in_progress, completed, cancelled
    blockType: text('block_type').default('focus').notNull(), // focus, buffer, break, admin
    googleEventId: text('google_event_id'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('time_blocks_start_idx').on(table.startTime)]
);

// ============================================
// EMAIL MESSAGES (for tracking processed emails)
// ============================================

export const emailMessages = pgTable(
  'email_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: text('message_id').unique().notNull(),
    threadId: text('thread_id'),
    fromEmail: text('from_email'),
    fromName: text('from_name'),
    subject: text('subject'),
    snippet: text('snippet'),
    receivedAt: timestamp('received_at', { withTimezone: true }),
    priority: text('priority').default('normal'), // high, normal, low
    category: text('category'), // action_required, fyi, newsletter, etc.
    summary: text('summary'),
    actionItems: text('action_items').array(),
    processed: boolean('processed').default(false).notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('email_processed_idx').on(table.processed),
    index('email_received_idx').on(table.receivedAt),
  ]
);

// ============================================
// VAULT CONNECTIONS (Notion-like backlinks)
// ============================================

export const vaultConnections = pgTable(
  'vault_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id')
      .references(() => vaultEntries.id, { onDelete: 'cascade' })
      .notNull(),
    targetId: uuid('target_id')
      .references(() => vaultEntries.id, { onDelete: 'cascade' })
      .notNull(),
    connectionType: text('connection_type').default('reference'), // 'reference', 'parent', 'related', 'blocks', 'mentions'
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('vault_connections_source_idx').on(table.sourceId),
    index('vault_connections_target_idx').on(table.targetId),
  ]
);

// ============================================
// VAULT ENTRY VERSIONS (Content versioning)
// ============================================

export const vaultEntryVersions = pgTable(
  'vault_entry_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entryId: uuid('entry_id')
      .references(() => vaultEntries.id, { onDelete: 'cascade' })
      .notNull(),
    versionNumber: integer('version_number').notNull(),

    // Versioned content snapshot
    title: text('title').notNull(),
    content: text('content'),
    tags: text('tags').array(),
    category: text('category'),

    // Metadata
    changeDescription: text('change_description'), // Optional description of what changed
    changedBy: text('changed_by').default('user'), // 'user', 'agent', 'system', 'auto'
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('vault_entry_versions_entry_idx').on(table.entryId),
    index('vault_entry_versions_version_idx').on(table.entryId, table.versionNumber),
  ]
);

// ============================================
// TASK COMMENTS (Collaboration)
// ============================================

export const taskComments = pgTable(
  'task_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .references(() => tasks.id, { onDelete: 'cascade' })
      .notNull(),
    content: text('content').notNull(),
    author: text('author').default('user'), // 'user', 'agent', 'system'
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('task_comments_task_idx').on(table.taskId)]
);

// ============================================
// ACTIVITY LOG (Audit trail)
// ============================================

export const activityLog = pgTable(
  'activity_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    entityType: text('entity_type').notNull(), // 'task', 'project', 'vault'
    entityId: uuid('entity_id').notNull(),
    action: text('action').notNull(), // 'created', 'updated', 'completed', 'deleted'
    changes: jsonb('changes'),
    actor: text('actor').default('user'), // 'user', 'agent', 'system'
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('activity_log_entity_idx').on(table.entityType, table.entityId),
    index('activity_log_created_idx').on(table.createdAt),
  ]
);

// ============================================
// GOALS (High-level objectives)
// ============================================
// Supports 6 life areas: spiritual, personal, fitness, family, professional, school

export const goals = pgTable(
  'goals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    description: text('description'),

    // Life area (standardized to 6 categories)
    lifeArea: text('life_area'), // 'spiritual', 'personal', 'fitness', 'family', 'professional', 'school'
    area: text('area'), // Legacy field - 'Work', 'Personal', 'Health', 'MBA', etc.

    // Goal type and measurement
    goalType: text('goal_type').default('achievement'), // 'achievement' (one-time), 'maintenance' (ongoing), 'growth' (progressive)
    metricType: text('metric_type'), // 'percentage', 'count', 'boolean', 'milestone'
    targetValue: real('target_value'),
    currentValue: real('current_value').default(0),
    unit: text('unit'), // e.g., "books", "miles", "hours"

    // Timeline
    startDate: date('start_date'),
    targetDate: date('target_date'),

    // Hierarchy
    level: text('level').default('quarterly'), // 'yearly', 'semester', 'quarterly', 'monthly'
    parentGoalId: uuid('parent_goal_id'), // For goal hierarchy

    // Status
    status: text('status').default('active'), // 'active', 'completed', 'abandoned', 'paused'
    priority: integer('priority').default(2), // 1 = highest, 5 = lowest

    // Motivation (important for coaching)
    motivation: text('motivation'), // User's "why" for this goal
    vision: text('vision'), // What success looks like

    // Progress tracking
    progressPercentage: real('progress_percentage').default(0), // 0-100

    // Review tracking
    reviewFrequency: text('review_frequency').default('weekly'), // 'daily', 'weekly', 'monthly'
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),

    // Vault integration
    vaultEntryId: uuid('vault_entry_id'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('goals_status_idx').on(table.status),
    index('goals_area_idx').on(table.area),
    index('goals_life_area_idx').on(table.lifeArea),
    index('goals_level_idx').on(table.level),
    index('goals_parent_idx').on(table.parentGoalId),
    index('goals_priority_idx').on(table.priority),
  ]
);

// ============================================
// DAILY REVIEWS (GTD: Daily reflection + Journal)
// ============================================
// Extended for Daily Journal & Review app workflow:
// Step 1: Habits Review, Step 2: Goals Review, Step 3: Journal Entry,
// Step 4: Tasks Review, Step 5: Classes Review, Step 6: Tomorrow Preview,
// Step 7: Complete & Save

export const dailyReviews = pgTable(
  'daily_reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    date: date('date').notNull().unique(),

    // Legacy fields (GTD daily review)
    tasksPlanned: integer('tasks_planned'),
    tasksCompleted: integer('tasks_completed'),
    tasksAdded: integer('tasks_added'),
    inboxStart: integer('inbox_start'),
    inboxEnd: integer('inbox_end'),
    reflection: text('reflection'), // Legacy reflection field

    // Journal entry (Step 3)
    journalText: text('journal_text'), // Main journal content (markdown)
    wordCount: integer('word_count'),

    // Tasks reviewed with reflections (Step 4)
    tasksReviewed: jsonb('tasks_reviewed'), // Array of {taskId, taskTitle, reflectionNote}

    // Classes reviewed (Step 5)
    classesReviewed: jsonb('classes_reviewed'), // Array of {classId, className, pageId, reflectionNote}

    // Metrics captured during review
    habitsCompletedCount: integer('habits_completed_count'),
    habitsTotalCount: integer('habits_total_count'),
    goalsReviewedCount: integer('goals_reviewed_count'),
    tomorrowEventsCount: integer('tomorrow_events_count'),
    tomorrowTasksCount: integer('tomorrow_tasks_count'),

    // User metadata
    tags: text('tags').array(),
    mood: text('mood'), // 'great', 'good', 'okay', 'difficult', 'terrible'

    // Review progress tracking
    currentStep: integer('current_step').default(1), // 1-7 for wizard progress
    reviewCompleted: boolean('review_completed').default(false),
    reviewDurationSeconds: integer('review_duration_seconds'),

    // Vault integration - completed review saved as vault page
    vaultPageId: uuid('vault_page_id').references(() => vaultPages.id),

    // Timestamps
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('daily_reviews_date_idx').on(table.date),
    index('daily_reviews_completed_idx').on(table.reviewCompleted),
    index('daily_reviews_vault_page_idx').on(table.vaultPageId),
  ]
);

// ============================================
// HABITS (Atomic Habits / Implementation Intentions)
// ============================================
// Scientific basis:
// - Implementation Intentions (Gollwitzer): specific when/where triggers
// - Habit Stacking (BJ Fogg): link to existing routines
// - Don't Break the Chain (Seinfeld): streak visualization
// - 2-Day Rule (D'Avella): missing once doesn't break streak

export const habits = pgTable(
  'habits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(), // "Upper body workout"
    description: text('description'),
    goalId: uuid('goal_id').references(() => goals.id, { onDelete: 'set null' }), // Links to parent goal

    // Frequency: Flexible scheduling
    frequency: text('frequency').notNull().default('daily'), // 'daily', 'weekly', 'specific_days'
    frequencyDays: integer('frequency_days').array(), // [1,2] = Mon,Tue (0=Sun, 1=Mon, etc.)
    timesPerWeek: integer('times_per_week'), // For 'weekly' frequency: "3x per week"

    // When to do it (Implementation Intentions)
    timeOfDay: text('time_of_day'), // 'morning', 'afternoon', 'evening', 'anytime'
    cueHabit: text('cue_habit'), // "After morning coffee" - habit stacking
    specificTime: text('specific_time'), // "07:00" - optional exact time

    // Context / Life Area
    lifeArea: text('life_area'), // 'spiritual', 'personal', 'fitness', 'family', 'professional', 'school'
    area: text('area'), // Legacy: 'Health', 'Work', 'Personal', 'MBA'
    context: text('context'), // @gym, @home, @office

    // Tracking
    targetPerDay: integer('target_per_day').default(1), // For habits like "drink 8 glasses of water"
    currentStreak: integer('current_streak').default(0),
    longestStreak: integer('longest_streak').default(0),
    totalCompletions: integer('total_completions').default(0),

    // Auto-task generation
    autoCreateTask: boolean('auto_create_task').default(false), // Generate task each scheduled day
    taskTemplate: text('task_template'), // Template for auto-generated task title

    // Status
    isActive: boolean('is_active').default(true),
    pausedUntil: date('paused_until'), // Temporary pause (vacation, etc.)

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('habits_goal_idx').on(table.goalId),
    index('habits_active_idx').on(table.isActive),
    index('habits_area_idx').on(table.area),
    index('habits_life_area_idx').on(table.lifeArea),
  ]
);

export const habitCompletions = pgTable(
  'habit_completions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    habitId: uuid('habit_id').references(() => habits.id, { onDelete: 'cascade' }).notNull(),
    date: date('date').notNull(),
    completedCount: integer('completed_count').default(1), // For multi-target habits
    completedAt: timestamp('completed_at', { withTimezone: true }).defaultNow().notNull(),
    notes: text('notes'),

    // Quality tracking (optional)
    qualityRating: integer('quality_rating'), // 1-5 rating for quality of completion
    durationMinutes: integer('duration_minutes'), // Actual time spent

    // Skip tracking (intentional misses don't break streaks)
    skipped: boolean('skipped').default(false),
    skipReason: text('skip_reason'), // 'rest_day', 'sick', 'travel', 'other'
  },
  (table) => [
    index('habit_completions_habit_idx').on(table.habitId),
    index('habit_completions_date_idx').on(table.date),
    // Unique constraint: one completion record per habit per day
    index('habit_completions_unique_idx').on(table.habitId, table.date),
  ]
);

// ============================================
// MILESTONES (Goal checkpoints)
// ============================================

export const milestones = pgTable(
  'milestones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    goalId: uuid('goal_id')
      .references(() => goals.id, { onDelete: 'cascade' })
      .notNull(),

    // Core fields
    title: text('title').notNull(),
    description: text('description'),

    // Timeline
    targetDate: date('target_date'),
    orderIndex: integer('order_index').notNull().default(0), // For sequencing

    // Status
    status: text('status').default('pending').notNull(), // 'pending', 'in_progress', 'completed', 'skipped'
    completedAt: timestamp('completed_at', { withTimezone: true }),
    evidence: text('evidence'), // Notes about how milestone was achieved

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('milestones_goal_idx').on(table.goalId),
    index('milestones_status_idx').on(table.status),
    index('milestones_target_date_idx').on(table.targetDate),
  ]
);

// ============================================
// GOAL TASKS (Links tasks to goals/milestones)
// ============================================

export const goalTasks = pgTable(
  'goal_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    goalId: uuid('goal_id').references(() => goals.id, { onDelete: 'cascade' }),
    milestoneId: uuid('milestone_id').references(() => milestones.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id')
      .references(() => tasks.id, { onDelete: 'cascade' })
      .notNull(),
    linkType: text('link_type').default('action'), // 'action' | 'milestone' | 'checkin'
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('goal_tasks_goal_idx').on(table.goalId),
    index('goal_tasks_milestone_idx').on(table.milestoneId),
    index('goal_tasks_task_idx').on(table.taskId),
  ]
);

// ============================================
// HABIT TASKS (Links auto-generated tasks to habits)
// ============================================

export const habitTasks = pgTable(
  'habit_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    habitId: uuid('habit_id')
      .references(() => habits.id, { onDelete: 'cascade' })
      .notNull(),
    taskId: uuid('task_id')
      .references(() => tasks.id, { onDelete: 'cascade' })
      .notNull(),
    scheduledDate: date('scheduled_date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('habit_tasks_habit_idx').on(table.habitId),
    index('habit_tasks_task_idx').on(table.taskId),
    index('habit_tasks_date_idx').on(table.scheduledDate),
  ]
);

// ============================================
// GOAL REFLECTIONS (Journaling/progress notes)
// ============================================

export const goalReflections = pgTable(
  'goal_reflections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    goalId: uuid('goal_id')
      .references(() => goals.id, { onDelete: 'cascade' })
      .notNull(),

    // Content
    content: text('content').notNull(),
    reflectionType: text('reflection_type').default('progress').notNull(), // 'progress', 'obstacle', 'win', 'adjustment'
    sentiment: text('sentiment'), // 'positive', 'neutral', 'negative', 'mixed'

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('goal_reflections_goal_idx').on(table.goalId),
    index('goal_reflections_type_idx').on(table.reflectionType),
    index('goal_reflections_created_idx').on(table.createdAt),
  ]
);

// ============================================
// JOB HUNTING - RESUME METADATA
// ============================================

export const resumeMetadata = pgTable(
  'resume_metadata',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    variant: text('variant'), // engineering, product, leadership, general
    filePath: text('file_path').notNull(),
    fileType: text('file_type'), // pdf, docx
    isDefault: boolean('is_default').default(false).notNull(),
    extractedSkills: text('extracted_skills').array(),
    extractedExperience: jsonb('extracted_experience'), // Array of {company, title, dates, highlights}
    lastUsed: timestamp('last_used', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('resume_variant_idx').on(table.variant)]
);

// ============================================
// JOB HUNTING - JOBS
// ============================================

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Core job info
    company: text('company').notNull(),
    title: text('title').notNull(),
    location: text('location'),
    locationType: text('location_type'), // remote, hybrid, onsite

    // Compensation
    salaryMin: integer('salary_min'),
    salaryMax: integer('salary_max'),
    salaryType: text('salary_type'), // annual, hourly

    // Job details
    description: text('description'),
    requirements: text('requirements').array(),
    benefits: text('benefits').array(),

    // Source/platform info
    url: text('url'),
    platform: text('platform'), // linkedin, indeed, greenhouse, lever, workday, manual, other
    platformJobId: text('platform_job_id'),

    // Status tracking
    status: text('status').notNull().default('discovered'),
    // discovered, saved, applying, applied, phone_screen, interviewing, offered, rejected, withdrawn, accepted

    // AI matching
    matchScore: real('match_score'), // 0-100
    matchReason: text('match_reason'),

    // Application details
    appliedAt: timestamp('applied_at', { withTimezone: true }),
    appliedVia: text('applied_via'), // agent, manual
    resumeUsedId: uuid('resume_used_id').references(() => resumeMetadata.id),
    coverLetter: text('cover_letter'),

    // Notes and follow-up
    notes: text('notes'),
    nextFollowUp: timestamp('next_follow_up', { withTimezone: true }),

    // Contacts at company
    contacts: jsonb('contacts'), // Array of {name, title, email, linkedin}

    // Interview tracking
    interviews: jsonb('interviews'), // Array of {date, type, with, notes, outcome}

    // Vault integration
    vaultEntryId: uuid('vault_entry_id'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('jobs_status_idx').on(table.status),
    index('jobs_company_idx').on(table.company),
    index('jobs_platform_idx').on(table.platform),
    index('jobs_applied_at_idx').on(table.appliedAt),
    index('jobs_match_score_idx').on(table.matchScore),
  ]
);

// ============================================
// JOB HUNTING - USER PROFILE
// ============================================

export const jobProfile = pgTable('job_profile', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Target preferences
  targetTitles: text('target_titles').array(),
  targetCompanies: text('target_companies').array(),
  excludeCompanies: text('exclude_companies').array(),

  // Salary requirements
  minSalary: integer('min_salary'),
  maxSalary: integer('max_salary'),

  // Location preferences
  preferredLocations: text('preferred_locations').array(),
  remotePreference: text('remote_preference'), // remote_only, hybrid_ok, onsite_ok
  willingToRelocate: boolean('willing_to_relocate').default(false).notNull(),

  // Experience
  yearsExperience: integer('years_experience'),
  skills: text('skills').array(),
  industries: text('industries').array(),

  // Automation settings
  autoApplyEnabled: boolean('auto_apply_enabled').default(false).notNull(),
  autoApplyThreshold: integer('auto_apply_threshold').default(85), // Min match score to auto-apply
  dailyApplicationLimit: integer('daily_application_limit').default(10),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================
// JOB HUNTING - SCREENING ANSWERS
// ============================================

export const screeningAnswers = pgTable(
  'screening_answers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    questionPattern: text('question_pattern').notNull(), // Keywords or regex to match questions
    answer: text('answer').notNull(),
    category: text('category'), // work_auth, salary, availability, experience, relocation, etc.
    isDefault: boolean('is_default').default(false).notNull(), // Use as default for category
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('screening_category_idx').on(table.category)]
);

// ============================================
// JOB HUNTING - APPLICATION HISTORY
// ============================================

export const applicationHistory = pgTable(
  'application_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .references(() => jobs.id, { onDelete: 'cascade' })
      .notNull(),
    action: text('action').notNull(), // status_change, note_added, interview_scheduled, followup_set, contact_added
    previousValue: text('previous_value'),
    newValue: text('new_value'),
    metadata: jsonb('metadata'), // Additional context for the action
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('app_history_job_idx').on(table.jobId),
    index('app_history_created_idx').on(table.createdAt),
  ]
);

// ============================================
// CANVAS INTEGRITY - CANVAS ITEMS
// ============================================

export const canvasItems = pgTable(
  'canvas_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Canvas Identity
    canvasId: text('canvas_id').notNull().unique(),
    canvasType: text('canvas_type').notNull(), // assignment, quiz, discussion, announcement, module_item
    courseId: uuid('course_id').references(() => classes.id, { onDelete: 'cascade' }),
    courseName: text('course_name').notNull(),

    // Item Details
    title: text('title').notNull(),
    description: text('description'),
    url: text('url'),

    // Dates
    dueAt: timestamp('due_at', { withTimezone: true }),
    availableFrom: timestamp('available_from', { withTimezone: true }),
    availableUntil: timestamp('available_until', { withTimezone: true }),

    // Academic Details
    pointsPossible: real('points_possible'),
    submissionTypes: text('submission_types').array(),
    isQuiz: boolean('is_quiz').default(false).notNull(),
    isDiscussion: boolean('is_discussion').default(false).notNull(),
    isGraded: boolean('is_graded').default(true).notNull(),

    // Discovery
    discoveredVia: text('discovered_via').notNull(), // api, browser_assignments, browser_modules, browser_home
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow().notNull(),
    lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),

    // Task Linkage
    taskId: uuid('task_id').references(() => tasks.id),
    projectId: uuid('project_id').references(() => projects.id),
    syncStatus: text('sync_status').default('pending').notNull(), // pending, synced, mismatch, orphaned

    // Verification
    browserVerified: boolean('browser_verified').default(false).notNull(),
    apiVerified: boolean('api_verified').default(false).notNull(),
    lastBrowserCheck: timestamp('last_browser_check', { withTimezone: true }),
    lastApiCheck: timestamp('last_api_check', { withTimezone: true }),
    verificationScreenshot: text('verification_screenshot'),

    // Raw Canvas data
    canvasData: jsonb('canvas_data'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('canvas_items_course_idx').on(table.courseId),
    index('canvas_items_due_idx').on(table.dueAt),
    index('canvas_items_type_idx').on(table.canvasType),
    index('canvas_items_sync_idx').on(table.syncStatus),
    index('canvas_items_task_idx').on(table.taskId),
  ]
);

// ============================================
// CANVAS INTEGRITY - AUDIT LOGS
// ============================================

export const canvasAudits = pgTable(
  'canvas_audits',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Audit Metadata
    auditType: text('audit_type').notNull(), // full, incremental, quick_check
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    status: text('status').notNull(), // running, completed, failed

    // Scope
    coursesAudited: integer('courses_audited'),
    pagesVisited: integer('pages_visited'),
    screenshotsCaptured: integer('screenshots_captured'),

    // Findings
    itemsDiscovered: integer('items_discovered'),
    tasksVerified: integer('tasks_verified'),
    tasksCreated: integer('tasks_created'),
    tasksUpdated: integer('tasks_updated'),
    discrepanciesFound: integer('discrepancies_found'),

    // Integrity Score (0-100)
    integrityScore: integer('integrity_score'),

    // Results
    findings: jsonb('findings'),
    errors: jsonb('errors'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('canvas_audits_type_idx').on(table.auditType),
    index('canvas_audits_status_idx').on(table.status),
    index('canvas_audits_started_idx').on(table.startedAt),
  ]
);

// ============================================
// CANVAS INTEGRITY - CLASS PROJECT MAPPING
// ============================================

export const classProjectMapping = pgTable(
  'class_project_mapping',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Canvas Class
    canvasCourseId: text('canvas_course_id').notNull().unique(),
    canvasCourseName: text('canvas_course_name').notNull(),
    canvasCourseCode: text('canvas_course_code'),

    // Task System Project
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),

    // Class Metadata
    professorName: text('professor_name'),
    semester: text('semester'),
    credits: integer('credits'),

    // Schedule
    meetingDays: text('meeting_days').array(),
    meetingTimeStart: text('meeting_time_start'),
    meetingTimeEnd: text('meeting_time_end'),
    location: text('location'),

    // Status
    isActive: boolean('is_active').default(true).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('class_project_mapping_project_idx').on(table.projectId),
    index('class_project_mapping_active_idx').on(table.isActive),
  ]
);

// ============================================
// CANVAS INTEGRITY - SCHEDULE TRACKING
// ============================================

export const canvasScheduleTracking = pgTable(
  'canvas_schedule_tracking',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    canvasItemId: uuid('canvas_item_id')
      .references(() => canvasItems.id, { onDelete: 'cascade' })
      .notNull(),
    taskId: uuid('task_id')
      .references(() => tasks.id, { onDelete: 'cascade' })
      .notNull(),

    // Schedule Status
    isScheduled: boolean('is_scheduled').default(false).notNull(),
    scheduledStart: timestamp('scheduled_start', { withTimezone: true }),
    scheduledEnd: timestamp('scheduled_end', { withTimezone: true }),
    calendarEventId: text('calendar_event_id'),

    // Reminder Status
    reminderSent: boolean('reminder_sent').default(false).notNull(),
    reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),
    reminderCount: integer('reminder_count').default(0).notNull(),

    // Status
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('canvas_schedule_item_idx').on(table.canvasItemId),
    index('canvas_schedule_task_idx').on(table.taskId),
    index('canvas_schedule_is_scheduled_idx').on(table.isScheduled),
  ]
);

// ============================================
// VAULT INGESTION PIPELINE (VIP)
// ============================================

export const recordingBatches = pgTable(
  'recording_batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    batchDate: date('batch_date').notNull(),
    status: text('status').default('processing').notNull(), // processing, complete, failed
    totalFiles: integer('total_files').default(0).notNull(),
    processedFiles: integer('processed_files').default(0).notNull(),
    totalDurationSeconds: integer('total_duration_seconds').default(0),
    calendarEventsMatched: integer('calendar_events_matched').default(0),
    segmentsCreated: integer('segments_created').default(0),
    transcriptsCreated: integer('transcripts_created').default(0),
    vaultPagesCreated: integer('vault_pages_created').default(0),
    tasksCreated: integer('tasks_created').default(0),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('recording_batches_date_idx').on(table.batchDate),
    index('recording_batches_status_idx').on(table.status),
    index('recording_batches_date_status_idx').on(table.batchDate, table.status),
  ]
);

export const recordingSegments = pgTable(
  'recording_segments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    batchId: uuid('batch_id')
      .references(() => recordingBatches.id, { onDelete: 'cascade' })
      .notNull(),
    recordingId: uuid('recording_id')
      .references(() => recordings.id, { onDelete: 'cascade' })
      .notNull(),
    startTimeSeconds: real('start_time_seconds').notNull(),
    endTimeSeconds: real('end_time_seconds').notNull(),
    segmentType: text('segment_type').notNull(), // class, conversation, other
    calendarEventId: uuid('calendar_event_id').references(() => calendarEvents.id),
    className: text('class_name'), // MBA Finance, etc.
    confidenceScore: real('confidence_score'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('recording_segments_batch_idx').on(table.batchId),
    index('recording_segments_recording_idx').on(table.recordingId),
    index('recording_segments_type_idx').on(table.segmentType),
    index('recording_segments_calendar_idx').on(table.calendarEventId),
  ]
);

export const extractedItems = pgTable(
  'extracted_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    batchId: uuid('batch_id')
      .references(() => recordingBatches.id, { onDelete: 'cascade' })
      .notNull(),
    segmentId: uuid('segment_id')
      .references(() => recordingSegments.id, { onDelete: 'cascade' })
      .notNull(),
    itemType: text('item_type').notNull(), // task, summary, key_point, deadline, commitment
    content: text('content').notNull(),
    priority: integer('priority').default(0),
    dueDate: timestamp('due_date', { withTimezone: true }),
    assignedTo: text('assigned_to'), // person name
    taskId: uuid('task_id').references(() => tasks.id), // if converted to task
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('extracted_items_batch_idx').on(table.batchId),
    index('extracted_items_segment_idx').on(table.segmentId),
    index('extracted_items_type_idx').on(table.itemType),
    index('extracted_items_task_idx').on(table.taskId),
  ]
);

export const classPages = pgTable(
  'class_pages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    calendarEventId: uuid('calendar_event_id')
      .references(() => calendarEvents.id, { onDelete: 'cascade' })
      .notNull(),
    vaultPageId: uuid('vault_page_id')
      .references(() => vaultPages.id, { onDelete: 'cascade' })
      .notNull(),
    batchId: uuid('batch_id')
      .references(() => recordingBatches.id, { onDelete: 'cascade' })
      .notNull(),
    transcriptContent: text('transcript_content'),
    summaryContent: text('summary_content'),
    keyTakeaways: text('key_takeaways').array(),
    actionItems: text('action_items').array(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('class_pages_calendar_idx').on(table.calendarEventId),
    index('class_pages_vault_idx').on(table.vaultPageId),
    index('class_pages_batch_idx').on(table.batchId),
  ]
);

// ============================================
// INTEGRATION CREDENTIALS (OAuth tokens, API keys)
// ============================================

export const integrationCredentials = pgTable(
  'integration_credentials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    integration: text('integration').notNull().unique(), // 'whoop', 'google', 'notion', etc.
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    tokenType: text('token_type'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    scope: text('scope'),
    metadata: jsonb('metadata'), // Additional integration-specific data
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('integration_credentials_integration_idx').on(table.integration)]
);

// ============================================
// AI INSIGHTS (Command Center Phase 3)
// ============================================

export const aiInsights = pgTable(
  'ai_insights',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Type and categorization
    insightType: text('insight_type').notNull(), // 'pattern', 'warning', 'suggestion', 'alert'
    category: text('category').notNull(), // 'workload', 'habit', 'goal', 'health', 'productivity'

    // Content
    title: text('title').notNull(),
    description: text('description').notNull(),
    severity: text('severity').default('info').notNull(), // 'info', 'warning', 'critical'

    // Actionability
    actionable: boolean('actionable').default(true).notNull(),
    actionLabel: text('action_label'), // "Schedule focus time", "Review habits"
    actionTarget: text('action_target'), // URL or route to navigate to

    // Additional data
    data: jsonb('data'), // Any insight-specific data

    // State
    isDismissed: boolean('is_dismissed').default(false).notNull(),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }),

    // Expiration
    expiresAt: timestamp('expires_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('ai_insights_type_idx').on(table.insightType),
    index('ai_insights_category_idx').on(table.category),
    index('ai_insights_severity_idx').on(table.severity),
    index('ai_insights_dismissed_idx').on(table.isDismissed),
    index('ai_insights_expires_idx').on(table.expiresAt),
  ]
);

// ============================================
// SYSTEM HEALTH LOGS (Command Center Phase 3)
// ============================================

export const systemHealthLogs = pgTable(
  'system_health_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Integration identification
    integration: text('integration').notNull(), // 'canvas', 'google_calendar', 'whoop', etc.

    // Health status
    status: text('status').notNull(), // 'healthy', 'degraded', 'down'
    latencyMs: integer('latency_ms'),

    // Error tracking
    errorMessage: text('error_message'),
    errorCount: integer('error_count').default(0).notNull(),

    // Sync tracking
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),

    // Additional metadata
    metadata: jsonb('metadata'), // API quotas, rate limits, etc.

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('system_health_integration_idx').on(table.integration),
    index('system_health_status_idx').on(table.status),
    index('system_health_created_idx').on(table.createdAt),
  ]
);

// ============================================
// REMARKABLE NOTES (Handwritten Notes Integration)
// ============================================
// Tracks handwritten notes from Remarkable tablet with:
// - Automatic class assignment via naming convention
// - OCR processing for searchability
// - Content merging with Plaud transcripts

export const remarkableNotes = pgTable(
  'remarkable_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Remarkable file tracking
    remarkableFileId: text('remarkable_file_id').unique().notNull(), // Unique ID from Remarkable Cloud or hash
    originalFilename: text('original_filename').notNull(),
    uploadTimestamp: timestamp('upload_timestamp', { withTimezone: true }).notNull(),

    // Classification
    classificationType: text('classification_type').notNull(), // 'class_note' or 'general'

    // For class notes (parsed from naming convention: MBA/[Semester]/[ClassCode]/[YYYY-MM-DD])
    semester: text('semester'), // e.g., 'Spring2026', 'Fall2025'
    classCode: text('class_code'), // e.g., 'MGMT501', 'ACCT600'
    noteDate: date('note_date'),

    // File storage
    pdfPath: text('pdf_path').notNull(), // Path to stored PDF (local or R2)
    ocrText: text('ocr_text'), // Extracted text from OCR
    ocrConfidence: real('ocr_confidence'), // 0-100 confidence score

    // Relationships
    pageId: uuid('page_id').references(() => vaultPages.id, { onDelete: 'set null' }), // Links to class day page
    vaultEntryId: uuid('vault_entry_id').references(() => vaultEntries.id, { onDelete: 'set null' }), // Legacy vault entry

    // Processing status
    processedAt: timestamp('processed_at', { withTimezone: true }),
    syncStatus: text('sync_status').default('pending').notNull(), // 'pending', 'processing', 'complete', 'failed', 'needs_review'
    errorMessage: text('error_message'),

    // Metadata
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
    pageCount: integer('page_count'),
    hasMergedContent: boolean('has_merged_content').default(false).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('remarkable_notes_class_date_idx').on(table.classCode, table.noteDate),
    index('remarkable_notes_sync_status_idx').on(table.syncStatus),
    index('remarkable_notes_classification_idx').on(table.classificationType),
    index('remarkable_notes_semester_idx').on(table.semester),
    index('remarkable_notes_page_idx').on(table.pageId),
    index('remarkable_notes_remarkable_id_idx').on(table.remarkableFileId),
  ]
);

// ============================================
// REMARKABLE SYNC STATE (For daily sync tracking)
// ============================================

export const remarkableSyncState = pgTable('remarkable_sync_state', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Sync metadata
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }).notNull(),
  lastSyncWindowStart: timestamp('last_sync_window_start', { withTimezone: true }),
  lastSyncWindowEnd: timestamp('last_sync_window_end', { withTimezone: true }),

  // Sync results
  itemsProcessed: integer('items_processed').default(0).notNull(),
  itemsAdded: integer('items_added').default(0).notNull(),
  itemsSkipped: integer('items_skipped').default(0).notNull(),
  itemsFailed: integer('items_failed').default(0).notNull(),

  // Status
  status: text('status').default('idle').notNull(), // 'idle', 'running', 'completed', 'failed'
  errorMessage: text('error_message'),

  // OCR stats
  ocrSuccessCount: integer('ocr_success_count').default(0).notNull(),
  ocrFailureCount: integer('ocr_failure_count').default(0).notNull(),
  averageOcrConfidence: real('average_ocr_confidence'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================
// TEST SESSIONS (Parallel AI Testing)
// ============================================
// Tracks AI-powered test sessions for parallel execution.
// Each session runs a TestingAgent with isolated browser and screenshot storage.

export const testSessions = pgTable(
  'test_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Status tracking
    status: text('status').default('pending').notNull(),
    // 'pending', 'running', 'completed', 'failed', 'cancelled'

    // Configuration (stored as JSON)
    config: jsonb('config').notNull(), // Full TestingConfig object
    baseUrl: text('base_url').notNull(),
    apiBaseUrl: text('api_base_url').notNull(),
    testScope: text('test_scope').notNull(), // 'full', 'smoke', 'specific'
    specificPages: text('specific_pages').array(),
    maxIterations: integer('max_iterations').default(50),
    headless: boolean('headless').default(true),

    // Progress tracking
    progress: jsonb('progress'), // {currentIteration, maxIterations, currentPage, ...}
    currentIteration: integer('current_iteration').default(0),

    // Results (populated on completion)
    result: jsonb('result'), // Full TestResult object
    passed: integer('passed'),
    failed: integer('failed'),
    warnings: integer('warnings'),
    totalFindings: integer('total_findings'),
    summary: text('summary'),
    recommendations: text('recommendations').array(),

    // Screenshot storage (isolated per session)
    screenshotDir: text('screenshot_dir').notNull(),
    screenshotPaths: text('screenshot_paths').array(),

    // Error tracking
    errorMessage: text('error_message'),
    errorStack: text('error_stack'),

    // Job tracking (BullMQ)
    jobId: text('job_id'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),
  },
  (table) => [
    index('test_sessions_status_idx').on(table.status),
    index('test_sessions_created_idx').on(table.createdAt),
    index('test_sessions_job_idx').on(table.jobId),
  ]
);

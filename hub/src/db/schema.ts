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
// TAG CATEGORIES (Grouping for controlled taxonomy)
// ============================================

export const tagCategories = pgTable('tag_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(), // 'status', 'type', 'context', 'priority', 'area', 'project'
  description: text('description'),
  color: text('color').default('#808080'),
  icon: text('icon'), // emoji or icon name
  sortOrder: integer('sort_order').default(0).notNull(),
  isSystem: boolean('is_system').default(false).notNull(), // System categories can't be deleted
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

  // Controlled taxonomy fields
  categoryId: uuid('category_id').references(() => tagCategories.id, { onDelete: 'set null' }),
  description: text('description'),
  aliases: text('aliases').array(), // Alternative names for auto-suggestion
  isSystem: boolean('is_system').default(false).notNull(), // System tags can't be deleted
  usageCount: integer('usage_count').default(0).notNull(), // Track popularity
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
    // Composite index for dashboard queries filtering on status + due_date
    index('tasks_status_due_idx').on(table.status, table.dueDate),
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
  // AI-generated analysis
  summary: jsonb('summary'), // {overview, keyPoints, participants, topics}
  extractedTasks: jsonb('extracted_tasks'), // Array of {title, description, assignee, priority, dueDate, context}
  analyzedAt: timestamp('analyzed_at', { withTimezone: true }),
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
    // Index for dashboard "recent entries" queries
    index('vault_entries_created_at_idx').on(table.createdAt),
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

    // PARA folder structure
    paraType: text('para_type'), // 'projects' | 'areas' | 'resources' | 'archive' | null
    isSystem: boolean('is_system').default(false).notNull(), // Protects PARA root folders

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
    index('vault_pages_para_type_idx').on(table.paraType),
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
    // Composite index for efficient habit completion range queries (habit + date lookups)
    index('habit_completions_habit_date_idx').on(table.habitId, table.date),
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
    // Composite index for efficient "latest reflection per goal" lookups
    index('goal_reflections_goal_created_idx').on(table.goalId, table.createdAt),
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

    // Rich Assignment Details (Canvas Complete Phase 1)
    instructions: text('instructions'), // Cleaned text instructions
    instructionsHtml: text('instructions_html'), // Original HTML
    rubric: jsonb('rubric'), // [{criterion, points, description, ratings}]
    allowedExtensions: text('allowed_extensions').array(), // ['.pdf', '.docx']
    wordCountMin: integer('word_count_min'),
    wordCountMax: integer('word_count_max'),
    isGroupAssignment: boolean('is_group_assignment').default(false).notNull(),
    hasPeerReview: boolean('has_peer_review').default(false).notNull(),
    attachedFileIds: text('attached_file_ids').array(), // Canvas file IDs
    estimatedMinutes: integer('estimated_minutes'), // AI-estimated time
    lockInfo: jsonb('lock_info'), // Lock/unlock information
    gradingType: text('grading_type'), // points, percent, letter_grade, gpa_scale, pass_fail

    // Discovery
    discoveredVia: text('discovered_via').notNull(), // api, browser_assignments, browser_modules, browser_home
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow().notNull(),
    lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),

    // Task Linkage
    taskId: uuid('task_id').references(() => tasks.id),
    projectId: uuid('project_id').references(() => projects.id),
    vaultPageId: uuid('vault_page_id').references(() => vaultPages.id), // Assignment detail page
    syncStatus: text('sync_status').default('pending').notNull(), // pending, synced, mismatch, orphaned

    // Submission & Grading (Canvas Complete Phase 5)
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    grade: text('grade'), // Letter grade or status
    score: real('score'), // Numeric score
    gradedAt: timestamp('graded_at', { withTimezone: true }),
    isLate: boolean('is_late').default(false).notNull(),
    isMissing: boolean('is_missing').default(false).notNull(),

    // Canvas IDs for API calls
    canvasCourseId: text('canvas_course_id'),
    canvasAssignmentId: text('canvas_assignment_id'),

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
    index('canvas_items_vault_page_idx').on(table.vaultPageId),
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
// CANVAS COMPLETE - ASSIGNMENT SUBTASKS
// ============================================

export const canvasAssignmentSubtasks = pgTable(
  'canvas_assignment_subtasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    canvasItemId: uuid('canvas_item_id')
      .references(() => canvasItems.id, { onDelete: 'cascade' })
      .notNull(),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),

    title: text('title').notNull(),
    subtaskType: text('subtask_type'), // reading, research, writing, review, submission
    sortOrder: integer('sort_order').default(0).notNull(),
    isCompleted: boolean('is_completed').default(false).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),

    // AI generation tracking
    generatedBy: text('generated_by').default('manual').notNull(), // 'ai' or 'manual'
    generationPrompt: text('generation_prompt'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('canvas_subtasks_item_idx').on(table.canvasItemId),
    index('canvas_subtasks_task_idx').on(table.taskId),
  ]
);

// ============================================
// CANVAS COMPLETE - ASSIGNMENT VAULT PAGES
// ============================================

export const canvasAssignmentPages = pgTable(
  'canvas_assignment_pages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    canvasItemId: uuid('canvas_item_id')
      .references(() => canvasItems.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    vaultPageId: uuid('vault_page_id')
      .references(() => vaultPages.id, { onDelete: 'cascade' })
      .notNull(),

    // Embedded content snapshots
    instructionsSnapshot: text('instructions_snapshot'),
    rubricSnapshot: jsonb('rubric_snapshot'),

    // User additions
    userNotes: text('user_notes'),
    submissionDraftPath: text('submission_draft_path'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('canvas_assignment_pages_vault_idx').on(table.vaultPageId)]
);

// ============================================
// CANVAS COMPLETE - COURSE MATERIALS
// ============================================

export const canvasMaterials = pgTable(
  'canvas_materials',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Canvas Identity
    canvasItemId: uuid('canvas_item_id').references(() => canvasItems.id, { onDelete: 'set null' }),
    canvasFileId: text('canvas_file_id').unique(), // Canvas's file ID
    courseId: uuid('course_id')
      .references(() => classes.id, { onDelete: 'cascade' })
      .notNull(),

    // File Details
    fileName: text('file_name').notNull(),
    displayName: text('display_name'),
    fileType: text('file_type').notNull(), // pdf, pptx, docx, xlsx, url
    mimeType: text('mime_type'),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
    localPath: text('local_path'), // hub/storage/canvas/...
    downloadUrl: text('download_url'),
    canvasUrl: text('canvas_url'),

    // Organization
    moduleName: text('module_name'),
    modulePosition: integer('module_position'),
    materialType: text('material_type'), // case, reading, lecture, syllabus, template, data

    // Content Extraction
    pageCount: integer('page_count'),
    extractedText: text('extracted_text'), // For search
    aiSummary: text('ai_summary'),

    // Vault Integration
    vaultPageId: uuid('vault_page_id').references(() => vaultPages.id, { onDelete: 'set null' }),

    // Reading Tracking
    readStatus: text('read_status').default('unread').notNull(), // unread, in_progress, completed
    readProgress: integer('read_progress').default(0).notNull(), // 0-100%
    lastReadAt: timestamp('last_read_at', { withTimezone: true }),

    // Relationships
    relatedAssignmentIds: uuid('related_assignment_ids').array(), // Links to canvas_items

    // Sync Tracking
    downloadedAt: timestamp('downloaded_at', { withTimezone: true }),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('canvas_materials_course_idx').on(table.courseId),
    index('canvas_materials_canvas_item_idx').on(table.canvasItemId),
    index('canvas_materials_file_type_idx').on(table.fileType),
    index('canvas_materials_material_type_idx').on(table.materialType),
    index('canvas_materials_read_status_idx').on(table.readStatus),
    index('canvas_materials_vault_page_idx').on(table.vaultPageId),
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
// REMARKABLE VAULT SYNC (MBA Folder Mapping)
// ============================================

/**
 * Tracks mapping between Remarkable folders/documents and Vault pages
 * Used for MBA folder sync to maintain 1:1 structure
 */
export const remarkableVaultSync = pgTable(
  'remarkable_vault_sync',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Remarkable reference
    remarkableId: text('remarkable_id').unique().notNull(), // Document or folder ID from Remarkable Cloud
    remarkableType: text('remarkable_type').notNull(), // 'folder' | 'document'
    remarkablePath: text('remarkable_path'), // Full path like 'BYU MBA/Winter2026/MGMT501'
    remarkableName: text('remarkable_name').notNull(), // Display name

    // Vault reference
    vaultPageId: uuid('vault_page_id')
      .references(() => vaultPages.id, { onDelete: 'set null' }),

    // For class documents, normalized fields
    semester: text('semester'), // 'Winter2026'
    classCode: text('class_code'), // 'MGMT501'
    noteDate: date('note_date'), // Date grouped from document

    // PDF and OCR storage
    pdfStoragePath: text('pdf_storage_path'), // Path to stored PDF
    ocrText: text('ocr_text'), // Extracted OCR text
    ocrPageId: uuid('ocr_page_id')
      .references(() => vaultPages.id, { onDelete: 'set null' }), // Child OCR page

    // Sync tracking
    remarkableHash: text('remarkable_hash'), // Content hash for change detection
    remarkableLastModified: bigint('remarkable_last_modified', { mode: 'number' }),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    syncStatus: text('sync_status').default('pending').notNull(), // 'pending', 'syncing', 'synced', 'error'
    errorMessage: text('error_message'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('remarkable_vault_sync_remarkable_idx').on(table.remarkableId),
    index('remarkable_vault_sync_vault_page_idx').on(table.vaultPageId),
    index('remarkable_vault_sync_class_date_idx').on(table.classCode, table.noteDate),
    index('remarkable_vault_sync_type_idx').on(table.remarkableType),
    index('remarkable_vault_sync_path_idx').on(table.remarkablePath),
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
// FINANCE - PLAID ACCOUNTS (Connected bank/credit accounts)
// ============================================

export const plaidAccounts = pgTable(
  'plaid_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Plaid identifiers
    itemId: text('item_id').notNull(), // Plaid item ID (one per institution link)
    accountId: text('account_id').notNull().unique(), // Plaid account ID (unique per account)
    institutionId: text('institution_id'),
    institutionName: text('institution_name').notNull(),

    // Encrypted credentials (AES-256-GCM)
    accessTokenEncrypted: text('access_token_encrypted').notNull(),
    accessTokenIv: text('access_token_iv').notNull(),

    // Account info
    accountMask: text('account_mask'), // Last 4 digits
    accountName: text('account_name'),
    accountType: text('account_type'), // 'credit', 'depository', 'loan', 'investment'
    accountSubtype: text('account_subtype'), // 'credit card', 'checking', 'savings'

    // Current balance (stored as cents/integer)
    currentBalanceCents: integer('current_balance_cents'),
    availableBalanceCents: integer('available_balance_cents'),
    limitCents: integer('limit_cents'), // For credit cards
    isoCurrencyCode: text('iso_currency_code').default('USD'),

    // Sync state
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    lastSyncCursor: text('last_sync_cursor'), // For Plaid transactions sync
    syncStatus: text('sync_status').default('active'), // 'active', 'error', 'disconnected'
    errorCode: text('error_code'),
    errorMessage: text('error_message'),

    // User preferences
    isHidden: boolean('is_hidden').default(false),
    displayName: text('display_name'), // User-set name

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('plaid_accounts_item_idx').on(table.itemId),
    index('plaid_accounts_status_idx').on(table.syncStatus),
  ]
);

// ============================================
// FINANCE - TRANSACTIONS (Individual financial transactions)
// ============================================

export const financeTransactions = pgTable(
  'finance_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    plaidAccountId: uuid('plaid_account_id')
      .references(() => plaidAccounts.id, { onDelete: 'cascade' })
      .notNull(),

    // Plaid identifiers
    plaidTransactionId: text('plaid_transaction_id').unique(),

    // Transaction details
    amountCents: integer('amount_cents').notNull(), // Positive = expense, negative = income/refund
    isoCurrencyCode: text('iso_currency_code').default('USD'),
    date: date('date').notNull(),
    datetime: timestamp('datetime', { withTimezone: true }),

    // Merchant info
    merchantName: text('merchant_name'),
    merchantEntityId: text('merchant_entity_id'), // Plaid merchant ID
    name: text('name').notNull(), // Transaction description

    // Categorization
    plaidCategory: text('plaid_category').array(), // Plaid's categories
    plaidCategoryId: text('plaid_category_id'),
    category: text('category'), // Our normalized category
    subcategory: text('subcategory'),
    aiCategorized: boolean('ai_categorized').default(false),

    // Status
    pending: boolean('pending').default(false),

    // Location (optional)
    location: jsonb('location'), // { address, city, region, postalCode, country, lat, lon }

    // Payment info
    paymentChannel: text('payment_channel'), // 'online', 'in_store', 'other'
    paymentMeta: jsonb('payment_meta'),

    // User overrides
    userCategory: text('user_category'), // Manual override
    userNote: text('user_note'),
    isExcluded: boolean('is_excluded').default(false), // Exclude from reports

    // Vault integration (receipts)
    receiptVaultPageId: uuid('receipt_vault_page_id').references(() => vaultPages.id, {
      onDelete: 'set null',
    }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('finance_transactions_account_idx').on(table.plaidAccountId),
    index('finance_transactions_date_idx').on(table.date),
    index('finance_transactions_category_idx').on(table.category),
    index('finance_transactions_plaid_id_idx').on(table.plaidTransactionId),
    index('finance_transactions_pending_idx').on(table.pending),
  ]
);

// ============================================
// FINANCE - BUDGETS (Monthly/category spending limits)
// ============================================

export const financeBudgets = pgTable(
  'finance_budgets',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Budget definition
    name: text('name').notNull(),
    groupName: text('group_name'),
    category: text('category').notNull(), // Category to track
    groupOrder: integer('group_order').default(0),
    budgetOrder: integer('budget_order').default(0),

    // Amount (stored as cents)
    amountCents: integer('amount_cents').notNull(), // Monthly budget limit

    // Target rules (YNAB-style)
    targetType: text('target_type').default('monthly'),
    targetAmountCents: integer('target_amount_cents'),
    targetDate: date('target_date'),

    // Period
    periodType: text('period_type').default('monthly'), // 'weekly', 'monthly', 'yearly'
    startDate: date('start_date'),
    endDate: date('end_date'), // null = ongoing

    // Rollover
    rolloverEnabled: boolean('rollover_enabled').default(false),
    rolloverAmountCents: integer('rollover_amount_cents').default(0),
    carryoverOverspent: boolean('carryover_overspent').default(true),

    // Alerts
    alertThreshold: integer('alert_threshold').default(80), // Percentage to alert (0-100)
    alertsEnabled: boolean('alerts_enabled').default(true),

    // Status
    isActive: boolean('is_active').default(true),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('finance_budgets_category_idx').on(table.category),
    index('finance_budgets_active_idx').on(table.isActive),
  ]
);

// ============================================
// FINANCE - BUDGET ALLOCATIONS (Per-month assigned amounts)
// ============================================

export const financeBudgetAllocations = pgTable(
  'finance_budget_allocations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    budgetId: uuid('budget_id')
      .notNull()
      .references(() => financeBudgets.id, { onDelete: 'cascade' }),
    month: text('month').notNull(), // YYYY-MM
    amountCents: integer('amount_cents').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('finance_budget_allocations_budget_idx').on(table.budgetId),
    index('finance_budget_allocations_month_idx').on(table.month),
    index('finance_budget_allocations_unique_idx').on(table.budgetId, table.month),
  ]
);

// ============================================
// FINANCE - INSIGHTS (AI-generated analysis)
// ============================================

export const financeInsights = pgTable(
  'finance_insights',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Insight type
    insightType: text('insight_type').notNull(),
    // 'spending_spike', 'unusual_transaction', 'budget_warning',
    // 'savings_opportunity', 'recurring_detected', 'payment_reminder'

    category: text('category'), // Related category

    // Content
    title: text('title').notNull(),
    description: text('description').notNull(),
    severity: text('severity').default('info'), // 'info', 'warning', 'alert'

    // Related data
    relatedTransactionIds: uuid('related_transaction_ids').array(),
    data: jsonb('data'), // Additional context

    // Actions
    actionable: boolean('actionable').default(false),
    actionType: text('action_type'), // 'create_task', 'adjust_budget', 'review'
    actionPayload: jsonb('action_payload'),

    // State
    isDismissed: boolean('is_dismissed').default(false),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }),
    isActioned: boolean('is_actioned').default(false),
    actionedAt: timestamp('actioned_at', { withTimezone: true }),

    // Expiry
    expiresAt: timestamp('expires_at', { withTimezone: true }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('finance_insights_type_idx').on(table.insightType),
    index('finance_insights_dismissed_idx').on(table.isDismissed),
    index('finance_insights_expires_idx').on(table.expiresAt),
  ]
);

// ============================================
// FINANCE - BUDGET REPORTS (Daily/Weekly report history)
// ============================================

export const budgetReports = pgTable(
  'budget_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Report type
    reportType: text('report_type').notNull(), // 'daily', 'weekly', 'monthly'
    reportDate: date('report_date').notNull(),

    // Report data (JSON snapshot of the report)
    data: jsonb('data').notNull(),

    // Delivery status
    emailSentAt: timestamp('email_sent_at', { withTimezone: true }),
    smsSentAt: timestamp('sms_sent_at', { withTimezone: true }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('budget_reports_type_date_idx').on(table.reportType, table.reportDate),
  ]
);

// ============================================
// FINANCE - BUDGET REPORT PREFERENCES
// ============================================

export const budgetReportPreferences = pgTable('budget_report_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),

  // Daily report settings
  dailyEmailEnabled: boolean('daily_email_enabled').default(true).notNull(),
  dailySmsEnabled: boolean('daily_sms_enabled').default(true).notNull(),
  dailyTime: text('daily_time').default('07:00').notNull(), // HH:MM format

  // Weekly report settings
  weeklyEmailEnabled: boolean('weekly_email_enabled').default(true).notNull(),
  weeklySmsEnabled: boolean('weekly_sms_enabled').default(true).notNull(),
  weeklyDay: integer('weekly_day').default(0).notNull(), // 0 = Sunday
  weeklyTime: text('weekly_time').default('09:00').notNull(), // HH:MM format

  // Alert settings
  alertsEnabled: boolean('alerts_enabled').default(true).notNull(),
  largeTransactionThresholdCents: integer('large_transaction_threshold_cents').default(10000).notNull(),
  unusualSpendingMultiplier: real('unusual_spending_multiplier').default(2.0).notNull(),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ============================================
// FINANCE - RECURRING TRANSACTIONS (Detected subscriptions/bills)
// ============================================

export const financeRecurring = pgTable(
  'finance_recurring',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Pattern info
    merchantName: text('merchant_name').notNull(),
    category: text('category'),

    // Amount (may vary slightly)
    averageAmountCents: integer('average_amount_cents').notNull(),
    lastAmountCents: integer('last_amount_cents'),

    // Frequency
    frequency: text('frequency').notNull(), // 'weekly', 'biweekly', 'monthly', 'yearly'
    predictedNextDate: date('predicted_next_date'),

    // History
    firstOccurrence: date('first_occurrence'),
    lastOccurrence: date('last_occurrence'),
    occurrenceCount: integer('occurrence_count').default(0),

    // Related transactions
    transactionIds: uuid('transaction_ids').array(),

    // User settings
    isActive: boolean('is_active').default(true),
    userLabel: text('user_label'), // User-friendly name

    // Task integration (payment reminders)
    reminderEnabled: boolean('reminder_enabled').default(false),
    reminderDaysBefore: integer('reminder_days_before').default(3),
    lastTaskId: uuid('last_task_id').references(() => tasks.id, { onDelete: 'set null' }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('finance_recurring_merchant_idx').on(table.merchantName),
    index('finance_recurring_next_date_idx').on(table.predictedNextDate),
    index('finance_recurring_active_idx').on(table.isActive),
  ]
);

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

// ============================================
// ACQUISITION LEADS (Boomer Business Finder)
// ============================================

export const acquisitionLeads = pgTable(
  'acquisition_leads',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Utah Registry Data
    entityNumber: text('entity_number').unique().notNull(),
    businessName: text('business_name').notNull(),
    dbaName: text('dba_name'),
    entityType: text('entity_type'), // LLC, Corporation, Partnership, etc.
    subtype: text('subtype'),

    // Filing Info
    filingDate: timestamp('filing_date', { withTimezone: true }),
    businessAge: integer('business_age'), // Years since filing
    status: text('status'), // Active, Inactive, etc.
    statusDetails: text('status_details'), // Current, Delinquent, etc.

    // Registered Agent & Address
    registeredAgent: text('registered_agent'),
    principalAddress: text('principal_address'),
    mailingAddress: text('mailing_address'),

    // Owner/Contact Info (from enrichment)
    ownerName: text('owner_name'),
    ownerLinkedIn: text('owner_linkedin'),
    ownerEmail: text('owner_email'),
    ownerPhone: text('owner_phone'),
    websiteUrl: text('website_url'),

    // Google Places Data
    googlePlaceId: text('google_place_id'),
    googleRating: real('google_rating'),
    googleReviewCount: integer('google_review_count'),

    // Yelp Data
    yelpBusinessId: text('yelp_business_id'),
    yelpRating: real('yelp_rating'),
    yelpReviewCount: integer('yelp_review_count'),

    // Business Classification
    industry: text('industry'),
    naicsCode: text('naics_code'),
    employeeCount: integer('employee_count'),
    revenueEstimate: text('revenue_estimate'), // Range like "$1M-$5M"

    // AI Scoring
    acquisitionScore: integer('acquisition_score'), // 0-100
    scoreBreakdown: jsonb('score_breakdown'), // { ageFit: 15, entityType: 10, ... }
    automationPotential: text('automation_potential'), // 'high', 'medium', 'low'
    scoreSummary: text('score_summary'),

    // Pipeline Stage
    pipelineStage: text('pipeline_stage').default('new').notNull(),
    // 'new', 'researching', 'qualified', 'outreach', 'conversation', 'negotiating', 'closed_won', 'closed_lost', 'passed'

    // CRM Tracking
    lastContactedAt: timestamp('last_contacted_at', { withTimezone: true }),
    nextFollowUpAt: timestamp('next_follow_up_at', { withTimezone: true }),
    contactAttempts: integer('contact_attempts').default(0).notNull(),

    // Flags
    isFavorite: boolean('is_favorite').default(false).notNull(),
    isHot: boolean('is_hot').default(false).notNull(),
    doNotContact: boolean('do_not_contact').default(false).notNull(),
    passReason: text('pass_reason'),

    // Notes & Vault Link
    notes: text('notes'),
    vaultEntryId: uuid('vault_entry_id').references(() => vaultEntries.id),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    enrichedAt: timestamp('enriched_at', { withTimezone: true }),
    scoredAt: timestamp('scored_at', { withTimezone: true }),
  },
  (table) => [
    index('acquisition_leads_stage_idx').on(table.pipelineStage),
    index('acquisition_leads_score_idx').on(table.acquisitionScore),
    index('acquisition_leads_entity_idx').on(table.entityNumber),
    index('acquisition_leads_favorite_idx').on(table.isFavorite),
    index('acquisition_leads_hot_idx').on(table.isHot),
    index('acquisition_leads_follow_up_idx').on(table.nextFollowUpAt),
  ]
);

// ============================================
// ACQUISITION INTERACTIONS (CRM Activity Log)
// ============================================

export const acquisitionInteractions = pgTable(
  'acquisition_interactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    leadId: uuid('lead_id')
      .references(() => acquisitionLeads.id, { onDelete: 'cascade' })
      .notNull(),

    // Interaction Details
    interactionType: text('interaction_type').notNull(),
    // 'call', 'email', 'meeting', 'site_visit', 'linkedin', 'letter', 'note'
    interactionDate: timestamp('interaction_date', { withTimezone: true }).notNull(),
    direction: text('direction'), // 'inbound', 'outbound'

    // Content
    subject: text('subject'),
    summary: text('summary'),
    outcome: text('outcome'), // 'positive', 'neutral', 'negative', 'no_response'

    // Follow-up
    followUpNeeded: boolean('follow_up_needed').default(false).notNull(),
    followUpDate: timestamp('follow_up_date', { withTimezone: true }),
    followUpNotes: text('follow_up_notes'),

    // Links to other systems
    taskId: uuid('task_id').references(() => tasks.id),
    recordingId: uuid('recording_id').references(() => recordings.id),
    emailMessageId: uuid('email_message_id').references(() => emailMessages.id),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('acquisition_interactions_lead_idx').on(table.leadId),
    index('acquisition_interactions_date_idx').on(table.interactionDate),
    index('acquisition_interactions_type_idx').on(table.interactionType),
  ]
);

// ============================================
// ACQUISITION ENRICHMENT LOG (Track Data Sources)
// ============================================

export const acquisitionEnrichmentLog = pgTable(
  'acquisition_enrichment_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    leadId: uuid('lead_id')
      .references(() => acquisitionLeads.id, { onDelete: 'cascade' })
      .notNull(),

    // Source Details
    source: text('source').notNull(),
    // 'utah_registry', 'google_places', 'yelp', 'linkedin', 'website', 'dnb'
    status: text('status').notNull(),
    // 'success', 'not_found', 'error', 'rate_limited'

    // Results
    dataFound: jsonb('data_found'), // What fields were populated
    errorMessage: text('error_message'),

    // Timestamps
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('acquisition_enrichment_lead_idx').on(table.leadId),
    index('acquisition_enrichment_source_idx').on(table.source),
  ]
);

// ============================================
// JUPYTER NOTEBOOKS (Data Analysis Integration)
// ============================================

/**
 * Tracks Jupyter notebooks synced to vault for search and reference.
 * Notebooks are stored in /hub/storage/notebooks/ and synced automatically.
 */
export const jupyterNotebooks = pgTable(
  'jupyter_notebooks',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // File tracking
    filename: text('filename').notNull(),
    filePath: text('file_path').notNull().unique(),
    fileHash: text('file_hash').notNull(), // SHA256 for change detection

    // Notebook metadata (parsed from .ipynb)
    kernelName: text('kernel_name'), // e.g., 'python3'
    kernelDisplayName: text('kernel_display_name'), // e.g., 'Python 3'
    cellCount: integer('cell_count').default(0),
    codeCellCount: integer('code_cell_count').default(0),
    markdownCellCount: integer('markdown_cell_count').default(0),

    // Content extraction for search
    extractedText: text('extracted_text'), // Combined text from all cells
    extractedCode: text('extracted_code'), // Just code cells
    extractedMarkdown: text('extracted_markdown'), // Just markdown cells

    // Vault integration
    vaultPageId: uuid('vault_page_id').references(() => vaultPages.id, { onDelete: 'set null' }),
    vaultEntryId: uuid('vault_entry_id').references(() => vaultEntries.id, { onDelete: 'set null' }), // Legacy

    // Processing status
    syncStatus: text('sync_status').default('pending').notNull(), // 'pending', 'processing', 'synced', 'error'
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    errorMessage: text('error_message'),

    // File stats
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
    notebookModifiedAt: timestamp('notebook_modified_at', { withTimezone: true }),

    // Source tracking
    source: text('source').default('local'), // 'local', 'upload'

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('jupyter_notebooks_file_path_idx').on(table.filePath),
    index('jupyter_notebooks_sync_status_idx').on(table.syncStatus),
    index('jupyter_notebooks_vault_page_idx').on(table.vaultPageId),
    index('jupyter_notebooks_kernel_idx').on(table.kernelName),
  ]
);

// ============================================
// CRYPTO TRACKER (PoW Coins)
// ============================================

export const cryptoCoins = pgTable(
  'crypto_coins',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Identity
    coingeckoId: text('coingecko_id').notNull().unique(),
    symbol: text('symbol').notNull(),
    name: text('name').notNull(),

    // PoW metadata
    algorithm: text('algorithm'),
    genesisDate: date('genesis_date'),
    privacyLevel: text('privacy_level').default('none').notNull(), // none, optional, default, mandatory
    miningPoolStatsId: text('mining_poolstats_id'),

    // Links
    websiteUrl: text('website_url'),
    githubUrl: text('github_url'),
    whitepaperUrl: text('whitepaper_url'),
    explorerUrl: text('explorer_url'),
    redditUrl: text('reddit_url'),
    discordUrl: text('discord_url'),
    telegramUrl: text('telegram_url'),

    // Cypherpunk scores (0-10)
    privacyScore: real('privacy_score'),
    decentralizationScore: real('decentralization_score'),
    censorshipResistanceScore: real('censorship_resistance_score'),
    devActivityScore: real('dev_activity_score'),
    maturityScore: real('maturity_score'),
    cypherpunkScore: real('cypherpunk_score'),

    // Development metrics (GitHub)
    githubStars: integer('github_stars'),
    githubForks: integer('github_forks'),
    githubOpenIssues: integer('github_open_issues'),
    githubContributorCount: integer('github_contributor_count'),
    githubPushedAt: timestamp('github_pushed_at', { withTimezone: true }),
    githubUpdatedAt: timestamp('github_updated_at', { withTimezone: true }),
    lastDevDataAt: timestamp('last_dev_data_at', { withTimezone: true }),

    // Display
    sortOrder: integer('sort_order').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),

    // Latest market snapshot (denormalized for fast table view)
    priceUsd: real('price_usd'),
    marketCap: bigint('market_cap', { mode: 'number' }),
    volume24h: bigint('volume_24h', { mode: 'number' }),
    priceChange24h: real('price_change_24h'),
    priceChange7d: real('price_change_7d'),
    circulatingSupply: bigint('circulating_supply', { mode: 'number' }),
    maxSupply: bigint('max_supply', { mode: 'number' }),
    athPriceUsd: real('ath_price_usd'),
    athDate: timestamp('ath_date', { withTimezone: true }),
    lastMarketDataAt: timestamp('last_market_data_at', { withTimezone: true }),

    // Latest network snapshot
    networkHashRate: real('network_hash_rate'),
    networkHashRateUnit: text('network_hash_rate_unit'),
    networkDifficulty: real('network_difficulty'),
    networkBlockHeight: bigint('network_block_height', { mode: 'number' }),
    networkBlockTimeActual: real('network_block_time_actual'),
    networkBlockTimeTarget: real('network_block_time_target'),
    networkBlockReward: real('network_block_reward'),
    lastNetworkDataAt: timestamp('last_network_data_at', { withTimezone: true }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('crypto_coins_symbol_idx').on(table.symbol),
    index('crypto_coins_algorithm_idx').on(table.algorithm),
    index('crypto_coins_privacy_idx').on(table.privacyLevel),
    index('crypto_coins_active_idx').on(table.isActive),
    index('crypto_coins_market_cap_idx').on(table.marketCap),
  ]
);

export const cryptoMarketData = pgTable(
  'crypto_market_data',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    coinId: uuid('coin_id')
      .references(() => cryptoCoins.id, { onDelete: 'cascade' })
      .notNull(),

    priceUsd: real('price_usd'),
    marketCap: bigint('market_cap', { mode: 'number' }),
    volume24h: bigint('volume_24h', { mode: 'number' }),
    priceChange24h: real('price_change_24h'),
    priceChange7d: real('price_change_7d'),
    circulatingSupply: bigint('circulating_supply', { mode: 'number' }),
    maxSupply: bigint('max_supply', { mode: 'number' }),
    athPriceUsd: real('ath_price_usd'),
    athDate: timestamp('ath_date', { withTimezone: true }),

    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('crypto_market_data_coin_idx').on(table.coinId),
    index('crypto_market_data_time_idx').on(table.timestamp),
  ]
);

export const cryptoNetworkData = pgTable(
  'crypto_network_data',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    coinId: uuid('coin_id')
      .references(() => cryptoCoins.id, { onDelete: 'cascade' })
      .notNull(),

    hashRate: real('hash_rate'),
    hashRateUnit: text('hash_rate_unit'),
    difficulty: real('difficulty'),
    blockHeight: bigint('block_height', { mode: 'number' }),
    blockTimeActual: real('block_time_actual'),
    blockTimeTarget: real('block_time_target'),
    blockReward: real('block_reward'),

    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('crypto_network_data_coin_idx').on(table.coinId),
    index('crypto_network_data_time_idx').on(table.timestamp),
  ]
);

export const cryptoMiningPools = pgTable(
  'crypto_mining_pools',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    coinId: uuid('coin_id')
      .references(() => cryptoCoins.id, { onDelete: 'cascade' })
      .notNull(),

    poolName: text('pool_name').notNull(),
    hashRatePercentage: real('hash_rate_percentage'),

    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('crypto_mining_pools_coin_idx').on(table.coinId),
    index('crypto_mining_pools_time_idx').on(table.timestamp),
  ]
);

// ============================================
// AD EXCHANGE (Gadz.io)
// ============================================

export const adSpaces = pgTable(
  'ad_spaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Ownership
    creatorAddress: text('creator_address').notNull(),
    creatorAddressEncrypted: text('creator_address_encrypted'),
    creatorAddressHash: text('creator_address_hash'),
    currentOwnerAddress: text('current_owner_address').notNull(),
    currentOwnerAddressEncrypted: text('current_owner_address_encrypted'),
    currentOwnerAddressHash: text('current_owner_address_hash'),
    previousOwnerAddress: text('previous_owner_address'),
    previousOwnerAddressEncrypted: text('previous_owner_address_encrypted'),
    previousOwnerAddressHash: text('previous_owner_address_hash'),

    // Inventory
    weeklyImpressions: bigint('weekly_impressions', { mode: 'number' }).notNull(),

    // Pricing
    currentReservePrice: real('current_reserve_price').notNull(),
    ownershipTransferPrice: real('ownership_transfer_price'),
    weeklyHoldingFee: real('weekly_holding_fee').notNull(),

    // Contract terms
    creatorSaleSharePercent: real('creator_sale_share_percent').notNull(),
    creatorFeeSharePercent: real('creator_fee_share_percent').notNull(),
    customContractTerms: jsonb('custom_contract_terms'),

    // Metadata
    name: text('name').notNull(),
    description: text('description'),
    category: text('category'),
    tags: text('tags').array(),

    // Status
    isActive: boolean('is_active').default(true),
    isAdultAllowed: boolean('is_adult_allowed').default(false),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    ownershipAcquiredAt: timestamp('ownership_acquired_at', { withTimezone: true }),
    lastPaymentAt: timestamp('last_payment_at', { withTimezone: true }),
    nextPaymentDue: timestamp('next_payment_due', { withTimezone: true }),
  },
  (table) => [
    index('ad_spaces_owner_idx').on(table.currentOwnerAddress),
    index('ad_spaces_creator_idx').on(table.creatorAddress),
    index('ad_spaces_active_idx').on(table.isActive),
    index('ad_spaces_category_idx').on(table.category),
  ]
);

export const advertiserAllocations = pgTable(
  'advertiser_allocations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adSpaceId: uuid('ad_space_id')
      .references(() => adSpaces.id, { onDelete: 'cascade' })
      .notNull(),

    // Ownership
    currentOwnerAddress: text('current_owner_address').notNull(),
    currentOwnerAddressEncrypted: text('current_owner_address_encrypted'),
    currentOwnerAddressHash: text('current_owner_address_hash'),
    previousOwnerAddress: text('previous_owner_address'),
    previousOwnerAddressEncrypted: text('previous_owner_address_encrypted'),
    previousOwnerAddressHash: text('previous_owner_address_hash'),

    // Allocation
    allocationUnits: integer('allocation_units').notNull(),
    impressionsPerWeek: bigint('impressions_per_week', { mode: 'number' }).notNull(),

    // Pricing
    acquisitionPrice: real('acquisition_price'),
    weeklyFee: real('weekly_fee').notNull(),

    // Creative
    creativeAssetUrls: text('creative_asset_urls').array(),
    clickThroughUrl: text('click_through_url'),
    contentCategory: text('content_category'),
    isAdult: boolean('is_adult').default(false),
    moderationStatus: text('moderation_status').default('pending'),
    moderationReason: text('moderation_reason'),
    flaggedAt: timestamp('flagged_at', { withTimezone: true }),

    // Status
    isActive: boolean('is_active').default(true),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    allocationAcquiredAt: timestamp('allocation_acquired_at', { withTimezone: true }),
    lastPaymentAt: timestamp('last_payment_at', { withTimezone: true }),
    nextPaymentDue: timestamp('next_payment_due', { withTimezone: true }),
  },
  (table) => [
    index('advertiser_allocations_ad_space_idx').on(table.adSpaceId),
    index('advertiser_allocations_owner_idx').on(table.currentOwnerAddress),
    index('advertiser_allocations_active_idx').on(table.isActive),
  ]
);

export const adPayments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    paymentType: text('payment_type').notNull(),

    // References
    adSpaceId: uuid('ad_space_id').references(() => adSpaces.id, { onDelete: 'set null' }),
    allocationId: uuid('allocation_id').references(() => advertiserAllocations.id, { onDelete: 'set null' }),

    // Transaction
    payerAddress: text('payer_address').notNull(),
    payerAddressEncrypted: text('payer_address_encrypted'),
    payerAddressHash: text('payer_address_hash'),
    amount: real('amount').notNull(),
    transactionHash: text('transaction_hash'),

    // Revenue distribution
    revenueDistribution: jsonb('revenue_distribution'),

    // Status
    status: text('status').notNull(),

    // Timestamps
    dueDate: timestamp('due_date', { withTimezone: true }).notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('ad_payments_due_idx').on(table.dueDate, table.status),
    index('ad_payments_space_idx').on(table.adSpaceId),
    index('ad_payments_allocation_idx').on(table.allocationId),
  ]
);

export const ownershipTransfers = pgTable(
  'ownership_transfers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    transferType: text('transfer_type').notNull(),

    // References
    adSpaceId: uuid('ad_space_id').references(() => adSpaces.id, { onDelete: 'set null' }),
    allocationId: uuid('allocation_id').references(() => advertiserAllocations.id, { onDelete: 'set null' }),

    // Transfer details
    fromAddress: text('from_address').notNull(),
    fromAddressEncrypted: text('from_address_encrypted'),
    fromAddressHash: text('from_address_hash'),
    toAddress: text('to_address').notNull(),
    toAddressEncrypted: text('to_address_encrypted'),
    toAddressHash: text('to_address_hash'),
    transferPrice: real('transfer_price'),
    reason: text('reason').notNull(),

    // Transaction
    transactionHash: text('transaction_hash'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('ownership_transfers_space_idx').on(table.adSpaceId),
    index('ownership_transfers_allocation_idx').on(table.allocationId),
    index('ownership_transfers_type_idx').on(table.transferType),
  ]
);

export const performanceMetrics = pgTable(
  'performance_metrics',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adSpaceId: uuid('ad_space_id').references(() => adSpaces.id, { onDelete: 'cascade' }),
    allocationId: uuid('allocation_id').references(() => advertiserAllocations.id, { onDelete: 'cascade' }),

    // Time period
    periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),

    // Metrics
    impressionsDelivered: bigint('impressions_delivered', { mode: 'number' }).default(0),
    clicks: bigint('clicks', { mode: 'number' }).default(0),
    ctr: real('ctr'),
    revenueGenerated: real('revenue_generated'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('performance_metrics_space_idx').on(table.adSpaceId),
    index('performance_metrics_allocation_idx').on(table.allocationId),
    index('performance_metrics_period_idx').on(table.periodStart, table.periodEnd),
  ]
);

export const marketListings = pgTable(
  'market_listings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingType: text('listing_type').notNull(),

    // References
    adSpaceId: uuid('ad_space_id').references(() => adSpaces.id, { onDelete: 'set null' }),
    allocationId: uuid('allocation_id').references(() => advertiserAllocations.id, { onDelete: 'set null' }),

    // Listing details
    sellerAddress: text('seller_address').notNull(),
    sellerAddressEncrypted: text('seller_address_encrypted'),
    sellerAddressHash: text('seller_address_hash'),
    askPrice: real('ask_price').notNull(),
    minPrice: real('min_price'),

    // Status
    status: text('status').notNull(),

    // Timestamps
    listedAt: timestamp('listed_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    soldAt: timestamp('sold_at', { withTimezone: true }),
  },
  (table) => [
    index('market_listings_status_idx').on(table.status),
    index('market_listings_space_idx').on(table.adSpaceId),
    index('market_listings_allocation_idx').on(table.allocationId),
  ]
);

export const adSpacePriceHistory = pgTable(
  'ad_space_price_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adSpaceId: uuid('ad_space_id')
      .references(() => adSpaces.id, { onDelete: 'cascade' })
      .notNull(),
    priceType: text('price_type').notNull(), // reserve, transfer, listing
    price: real('price').notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
    metadata: jsonb('metadata'),
  },
  (table) => [
    index('ad_space_price_history_space_idx').on(table.adSpaceId),
    index('ad_space_price_history_recorded_idx').on(table.recordedAt),
  ]
);

// ============================================
// SOSATISFYING.COM (Community Content Platform)
// ============================================

export const sosUsers = pgTable(
  'sos_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    username: text('username').notNull().unique(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    avatarUrl: text('avatar_url'),
    bio: text('bio'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    isBanned: boolean('is_banned').default(false).notNull(),
    ageVerified21Plus: boolean('age_verified_21plus').default(false).notNull(),
  },
  (table) => [
    index('sos_users_username_idx').on(table.username),
    index('sos_users_email_idx').on(table.email),
  ]
);

export const sosGroups = pgTable(
  'sos_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().unique(),
    displayTitle: text('display_title').notNull(),
    description: text('description'),
    category: text('category'),
    is21Plus: boolean('is_21plus').default(false).notNull(),
    bannerUrl: text('banner_url'),
    iconUrl: text('icon_url'),
    creatorId: uuid('creator_id').references(() => sosUsers.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    subscriberCount: integer('subscriber_count').default(0).notNull(),
    rules: jsonb('rules'),
  },
  (table) => [
    index('sos_groups_name_idx').on(table.name),
    index('sos_groups_category_idx').on(table.category),
    index('sos_groups_creator_idx').on(table.creatorId),
  ]
);

export const sosPosts = pgTable(
  'sos_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .references(() => sosGroups.id, { onDelete: 'cascade' })
      .notNull(),
    authorId: uuid('author_id').references(() => sosUsers.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    contentType: text('content_type').notNull(),
    contentUrl: text('content_url'),
    contentText: text('content_text'),
    thumbnailUrl: text('thumbnail_url'),
    is21Plus: boolean('is_21plus').default(false).notNull(),
    isOriginalContent: boolean('is_original_content').default(false).notNull(),
    flair: text('flair'),
    upvotes: integer('upvotes').default(0).notNull(),
    downvotes: integer('downvotes').default(0).notNull(),
    commentCount: integer('comment_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    isDeleted: boolean('is_deleted').default(false).notNull(),
    isPinned: boolean('is_pinned').default(false).notNull(),
  },
  (table) => [
    index('sos_posts_group_idx').on(table.groupId),
    index('sos_posts_created_idx').on(table.createdAt),
    index('sos_posts_group_created_idx').on(table.groupId, table.createdAt),
  ]
);

export const sosComments: ReturnType<typeof pgTable> = pgTable(
  'sos_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .references(() => sosPosts.id, { onDelete: 'cascade' })
      .notNull(),
    authorId: uuid('author_id').references(() => sosUsers.id, { onDelete: 'set null' }),
    parentCommentId: uuid('parent_comment_id').references(() => sosComments.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    upvotes: integer('upvotes').default(0).notNull(),
    downvotes: integer('downvotes').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    isDeleted: boolean('is_deleted').default(false).notNull(),
    depth: integer('depth').default(0).notNull(),
  },
  (table) => [
    index('sos_comments_post_idx').on(table.postId),
    index('sos_comments_post_created_idx').on(table.postId, table.createdAt),
  ]
);

export const sosVotes = pgTable(
  'sos_votes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => sosUsers.id, { onDelete: 'cascade' })
      .notNull(),
    postId: uuid('post_id').references(() => sosPosts.id, { onDelete: 'cascade' }),
    commentId: uuid('comment_id').references(() => sosComments.id, { onDelete: 'cascade' }),
    voteType: integer('vote_type').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sos_votes_user_idx').on(table.userId),
    index('sos_votes_post_idx').on(table.postId),
    index('sos_votes_comment_idx').on(table.commentId),
  ]
);

export const sosSubscriptions = pgTable(
  'sos_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => sosUsers.id, { onDelete: 'cascade' })
      .notNull(),
    groupId: uuid('group_id')
      .references(() => sosGroups.id, { onDelete: 'cascade' })
      .notNull(),
    subscribedAt: timestamp('subscribed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sos_subscriptions_user_idx').on(table.userId),
    index('sos_subscriptions_group_idx').on(table.groupId),
  ]
);

export const sosModerators = pgTable(
  'sos_moderators',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => sosUsers.id, { onDelete: 'cascade' })
      .notNull(),
    groupId: uuid('group_id')
      .references(() => sosGroups.id, { onDelete: 'cascade' })
      .notNull(),
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
    permissions: jsonb('permissions'),
  },
  (table) => [
    index('sos_moderators_user_idx').on(table.userId),
    index('sos_moderators_group_idx').on(table.groupId),
  ]
);

export const sosReports = pgTable(
  'sos_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reporterId: uuid('reporter_id').references(() => sosUsers.id, { onDelete: 'set null' }),
    postId: uuid('post_id').references(() => sosPosts.id, { onDelete: 'cascade' }),
    commentId: uuid('comment_id').references(() => sosComments.id, { onDelete: 'cascade' }),
    reason: text('reason').notNull(),
    details: text('details'),
    status: text('status').default('pending').notNull(),
    reviewedBy: uuid('reviewed_by').references(() => sosUsers.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('sos_reports_status_idx').on(table.status),
    index('sos_reports_post_idx').on(table.postId),
    index('sos_reports_comment_idx').on(table.commentId),
  ]
);

export const sosAdRevenue = pgTable(
  'sos_ad_revenue',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    groupId: uuid('group_id')
      .references(() => sosGroups.id, { onDelete: 'cascade' })
      .notNull(),
    date: date('date').notNull(),
    impressions: integer('impressions').default(0).notNull(),
    clicks: integer('clicks').default(0).notNull(),
    revenueCents: integer('revenue_cents').default(0).notNull(),
    creatorShareCents: integer('creator_share_cents').default(0).notNull(),
  },
  (table) => [
    index('sos_ad_revenue_group_idx').on(table.groupId),
    index('sos_ad_revenue_date_idx').on(table.date),
  ]
);

// ============================================
// AI AGENT TREE STRATEGIC ROADMAP
// ============================================

/**
 * Roadmap phases representing major strategic milestones.
 * Phase 1: Acquisition & Optimization (0-12 months)
 * Phase 2: Full Business Automation (1-3 years)
 * Phase 3: Platform & Equity Model (3-5+ years)
 */
export const roadmapPhases = pgTable(
  'roadmap_phases',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Phase Identity
    phaseNumber: integer('phase_number').notNull().unique(),
    title: text('title').notNull(),
    subtitle: text('subtitle'),
    timeline: text('timeline').notNull(), // '0-12 months', '1-3 years', etc.

    // Status & Progress
    status: text('status').default('not_started').notNull(), // not_started, in_progress, completed
    progress: integer('progress').default(0).notNull(), // 0-100

    // Visual
    color: text('color').notNull(), // Tailwind gradient class e.g., 'from-emerald-500 to-teal-500'
    icon: text('icon').notNull(), // Emoji icon

    // Strategy Details
    goal: text('goal').notNull(),
    strategy: text('strategy').notNull(),
    outcome: text('outcome').notNull(),
    keyMetrics: jsonb('key_metrics').$type<string[]>().default([]).notNull(),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('roadmap_phases_status_idx').on(table.status),
    index('roadmap_phases_number_idx').on(table.phaseNumber),
  ]
);

/**
 * Roadmap milestones within each phase.
 * Tracks individual deliverables and their progress.
 */
export const roadmapMilestones = pgTable(
  'roadmap_milestones',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Parent Phase
    phaseId: uuid('phase_id')
      .references(() => roadmapPhases.id, { onDelete: 'cascade' })
      .notNull(),

    // Milestone Details
    title: text('title').notNull(),
    description: text('description'),
    sortOrder: integer('sort_order').default(0).notNull(),

    // Status
    status: text('status').default('pending').notNull(), // pending, in_progress, completed, blocked

    // Dates
    targetDate: date('target_date'),
    completedDate: date('completed_date'),

    // Metrics (optional tracking data)
    metrics: jsonb('metrics').$type<Array<{ label: string; target: string | number; current?: string | number }>>(),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('roadmap_milestones_phase_idx').on(table.phaseId),
    index('roadmap_milestones_status_idx').on(table.status),
    index('roadmap_milestones_sort_idx').on(table.phaseId, table.sortOrder),
  ]
);

// ============================================
// SCREEN TIME REPORTS (iOS productivity tracking)
// ============================================

export const screenTimeReports = pgTable(
  'screen_time_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    reportDate: date('report_date').notNull(),
    deviceId: text('device_id').notNull(),

    // Core metrics
    totalScreenTimeMinutes: integer('total_screen_time_minutes').notNull().default(0),
    pickupCount: integer('pickup_count').default(0),
    notificationCount: integer('notification_count').default(0),

    // Detailed breakdown
    categoryBreakdown: jsonb('category_breakdown').default({}),
    topApps: jsonb('top_apps').default([]),
    hourlyBreakdown: jsonb('hourly_breakdown').default([]),

    // Sync metadata
    syncedAt: timestamp('synced_at', { withTimezone: true }).defaultNow().notNull(),
    sourceVersion: text('source_version'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('screen_time_date_idx').on(table.reportDate),
    index('screen_time_device_idx').on(table.deviceId),
  ]
);

// ============================================
// COMMUNICATION MONITORING
// ============================================
// Tracks messages from all communication channels (Gmail, Outlook, iMessage, phone calls)
// with AI triage results and notification status

export const communicationMessages = pgTable(
  'communication_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Channel identification
    channel: text('channel').notNull(), // 'gmail', 'outlook', 'imessage', 'sms', 'phone_call'
    externalId: text('external_id').notNull(), // ID from source system
    threadId: text('thread_id'), // For threaded conversations

    // Sender info
    fromAddress: text('from_address').notNull(), // Email or phone
    fromName: text('from_name'),
    toAddress: text('to_address'), // Recipient

    // Content
    subject: text('subject'), // For emails
    preview: text('preview'), // First 200 chars
    fullContent: text('full_content'), // Full message body

    // Call-specific fields
    callType: text('call_type'), // 'incoming', 'outgoing', 'missed'
    callDuration: integer('call_duration'), // seconds

    // Timestamps
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull(),

    // Triage results
    triaged: boolean('triaged').default(false).notNull(),
    triagedAt: timestamp('triaged_at', { withTimezone: true }),
    importance: text('importance'), // 'critical', 'urgent', 'normal', 'low'
    category: text('category'), // 'action_required', 'fyi', 'social', 'spam', 'personal'
    requiresAction: boolean('requires_action'),
    triageReasoning: text('triage_reasoning'),

    // Notification tracking
    notified: boolean('notified').default(false).notNull(),
    notifiedAt: timestamp('notified_at', { withTimezone: true }),
    notificationChannel: text('notification_channel'), // 'sms', 'telegram', 'none'

    // Processing
    processed: boolean('processed').default(false).notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    linkedTaskId: uuid('linked_task_id').references(() => tasks.id),

    // Metadata
    metadata: jsonb('metadata'), // Channel-specific data

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('comm_messages_channel_idx').on(table.channel),
    index('comm_messages_external_id_idx').on(table.externalId),
    index('comm_messages_from_idx').on(table.fromAddress),
    index('comm_messages_received_idx').on(table.receivedAt),
    index('comm_messages_triaged_idx').on(table.triaged),
    index('comm_messages_importance_idx').on(table.importance),
    index('comm_messages_notified_idx').on(table.notified),
  ]
);

// VIP contacts for instant notification (bypass AI triage delay)
export const communicationVipContacts = pgTable(
  'communication_vip_contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Contact identification
    identifier: text('identifier').notNull().unique(), // Email or phone
    identifierType: text('identifier_type').notNull(), // 'email', 'phone'
    name: text('name'),

    // Priority settings
    priority: text('priority').default('high').notNull(), // 'critical', 'high', 'normal'
    alwaysNotify: boolean('always_notify').default(true).notNull(),

    // Notification preferences
    notifyOnEmail: boolean('notify_on_email').default(true).notNull(),
    notifyOnMessage: boolean('notify_on_message').default(true).notNull(),
    notifyOnCall: boolean('notify_on_call').default(true).notNull(),

    // Metadata
    notes: text('notes'),
    personId: uuid('person_id').references(() => people.id),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('comm_vip_identifier_idx').on(table.identifier),
    index('comm_vip_priority_idx').on(table.priority),
  ]
);

// Session storage for browser-based scrapers (Outlook)
export const communicationScraperSessions = pgTable(
  'communication_scraper_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    channel: text('channel').notNull().unique(), // 'outlook', etc.

    // Session data
    sessionData: jsonb('session_data'), // Encrypted cookies/tokens

    // Status
    isValid: boolean('is_valid').default(true).notNull(),
    lastValidated: timestamp('last_validated', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),

    // Error tracking
    lastError: text('last_error'),
    errorCount: integer('error_count').default(0).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('comm_scraper_channel_idx').on(table.channel),
    index('comm_scraper_valid_idx').on(table.isValid),
  ]
);

// Monitor status tracking for system health display
export const communicationMonitorStatus = pgTable(
  'communication_monitor_status',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    channel: text('channel').notNull().unique(), // 'gmail', 'outlook', 'imessage', 'phone_calls'

    // Status
    status: text('status').default('unknown').notNull(), // 'healthy', 'degraded', 'error', 'disabled'
    enabled: boolean('enabled').default(true).notNull(),

    // Last check info
    lastCheckAt: timestamp('last_check_at', { withTimezone: true }),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    lastErrorAt: timestamp('last_error_at', { withTimezone: true }),
    lastErrorMessage: text('last_error_message'),

    // Stats
    unreadCount: integer('unread_count').default(0),
    urgentCount: integer('urgent_count').default(0),
    messagesCheckedToday: integer('messages_checked_today').default(0),
    alertsSentToday: integer('alerts_sent_today').default(0),

    // Channel-specific
    sessionValid: boolean('session_valid'), // For Outlook
    hasAccess: boolean('has_access'), // For iMessage (Full Disk Access)

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('comm_monitor_channel_idx').on(table.channel),
    index('comm_monitor_status_idx').on(table.status),
  ]
);

// ============================================
// READ HELP - Personal Book Learning Assistant
// ============================================

export const readHelpBooks = pgTable(
  'read_help_books',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Core metadata
    title: text('title').notNull(),
    author: text('author'),
    isbn: text('isbn'),
    publisher: text('publisher'),
    publishedYear: integer('published_year'),

    // File info
    filePath: text('file_path').notNull(),
    fileSizeBytes: integer('file_size_bytes'),
    fileHash: text('file_hash'), // SHA256 for deduplication
    pageCount: integer('page_count'),
    coverImagePath: text('cover_image_path'),

    // Processing status
    status: text('status').default('processing').notNull(), // processing, ready, error
    processingError: text('processing_error'),
    processingProgress: integer('processing_progress').default(0), // 0-100

    // Content info
    totalWordCount: integer('total_word_count'),
    language: text('language').default('en'),

    // User metadata
    tags: text('tags').array(),
    notes: text('notes'),
    rating: integer('rating'), // 1-5

    // Reading state
    isArchived: boolean('is_archived').default(false).notNull(),
    lastReadAt: timestamp('last_read_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('read_help_books_status_idx').on(table.status),
    index('read_help_books_title_idx').on(table.title),
    index('read_help_books_author_idx').on(table.author),
    index('read_help_books_archived_idx').on(table.isArchived),
  ]
);

export const readHelpChapters = pgTable(
  'read_help_chapters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookId: uuid('book_id')
      .references(() => readHelpBooks.id, { onDelete: 'cascade' })
      .notNull(),

    // Chapter info
    chapterNumber: integer('chapter_number').notNull(),
    title: text('title'),
    startPage: integer('start_page'),
    endPage: integer('end_page'),

    // Content
    content: text('content').notNull(),
    wordCount: integer('word_count'),

    // AI-generated summaries (cached)
    summaryShort: text('summary_short'), // ~500 words, 5 min read
    summaryMedium: text('summary_medium'), // ~1500 words, 15 min read
    summaryLong: text('summary_long'), // ~3000 words, 30 min read
    summaryGeneratedAt: timestamp('summary_generated_at', { withTimezone: true }),

    // Key concepts extracted
    keyConcepts: jsonb('key_concepts'), // [{term, definition, pageNumbers}]
    keyQuotes: jsonb('key_quotes'), // [{quote, pageNumber, context}]
    frameworks: jsonb('frameworks'), // [{name, description, pageNumbers}]

    // Images extracted from PDF (charts, diagrams, figures)
    images: jsonb('images').default(sql`'[]'::jsonb`), // [{path, pageNumber, caption?, type: "chart"|"diagram"|"figure"}]

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('read_help_chapters_book_idx').on(table.bookId),
    index('read_help_chapters_number_idx').on(table.chapterNumber),
  ]
);

// Full-text search index using PostgreSQL tsvector
export const readHelpSearchIndex = pgTable(
  'read_help_search_index',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookId: uuid('book_id')
      .references(() => readHelpBooks.id, { onDelete: 'cascade' })
      .notNull(),
    chapterId: uuid('chapter_id')
      .references(() => readHelpChapters.id, { onDelete: 'cascade' }),

    // Content chunk (pages are split into searchable chunks)
    pageNumber: integer('page_number'),
    chunkIndex: integer('chunk_index').default(0), // Multiple chunks per page
    content: text('content').notNull(),

    // Search vector (automatically populated by trigger)
    searchVector: text('search_vector'), // Will store tsvector as text, convert in queries

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('read_help_search_book_idx').on(table.bookId),
    index('read_help_search_chapter_idx').on(table.chapterId),
    index('read_help_search_page_idx').on(table.pageNumber),
  ]
);

export const readHelpConversations = pgTable(
  'read_help_conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookId: uuid('book_id')
      .references(() => readHelpBooks.id, { onDelete: 'cascade' })
      .notNull(),
    chapterId: uuid('chapter_id')
      .references(() => readHelpChapters.id, { onDelete: 'set null' }),

    // Conversation context
    title: text('title'), // Auto-generated from first message
    context: text('context'), // 'chapter', 'book', 'general'

    // Messages array: [{role: 'user'|'assistant', content: string, timestamp: string, citations?: [{page, text}]}]
    messages: jsonb('messages').default('[]').notNull(),

    // Token tracking for context management
    totalTokens: integer('total_tokens').default(0),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('read_help_conv_book_idx').on(table.bookId),
    index('read_help_conv_chapter_idx').on(table.chapterId),
  ]
);

export const readHelpHighlights = pgTable(
  'read_help_highlights',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookId: uuid('book_id')
      .references(() => readHelpBooks.id, { onDelete: 'cascade' })
      .notNull(),
    chapterId: uuid('chapter_id')
      .references(() => readHelpChapters.id, { onDelete: 'set null' }),

    // Location
    pageNumber: integer('page_number'),
    startOffset: integer('start_offset'), // Character offset in page content
    endOffset: integer('end_offset'),

    // Content
    highlightedText: text('highlighted_text').notNull(),
    note: text('note'),

    // Styling
    color: text('color').default('yellow').notNull(), // yellow, green, blue, pink, purple

    // Tags for organization
    tags: text('tags').array(),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('read_help_highlights_book_idx').on(table.bookId),
    index('read_help_highlights_chapter_idx').on(table.chapterId),
    index('read_help_highlights_page_idx').on(table.pageNumber),
  ]
);

export const readHelpQuizzes = pgTable(
  'read_help_quizzes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookId: uuid('book_id')
      .references(() => readHelpBooks.id, { onDelete: 'cascade' })
      .notNull(),
    chapterId: uuid('chapter_id')
      .references(() => readHelpChapters.id, { onDelete: 'set null' }),

    // Quiz metadata
    title: text('title'),
    difficulty: text('difficulty').default('medium'), // easy, medium, hard
    questionCount: integer('question_count').notNull(),

    // Questions: [{id, type: 'multiple_choice'|'true_false'|'short_answer', question, options?, correctAnswer, explanation, pageRef}]
    questions: jsonb('questions').notNull(),

    // Results (null until taken)
    answers: jsonb('answers'), // [{questionId, userAnswer, isCorrect}]
    score: real('score'), // 0-100
    completedAt: timestamp('completed_at', { withTimezone: true }),

    // Spaced repetition
    nextReviewAt: timestamp('next_review_at', { withTimezone: true }),
    reviewCount: integer('review_count').default(0),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('read_help_quizzes_book_idx').on(table.bookId),
    index('read_help_quizzes_chapter_idx').on(table.chapterId),
    index('read_help_quizzes_review_idx').on(table.nextReviewAt),
  ]
);

export const readHelpProgress = pgTable(
  'read_help_progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookId: uuid('book_id')
      .references(() => readHelpBooks.id, { onDelete: 'cascade' })
      .notNull()
      .unique(), // One progress record per book

    // Current position
    currentPage: integer('current_page').default(1).notNull(),
    currentChapterId: uuid('current_chapter_id')
      .references(() => readHelpChapters.id, { onDelete: 'set null' }),

    // Progress tracking
    percentComplete: real('percent_complete').default(0).notNull(),
    pagesRead: integer('pages_read').default(0).notNull(),
    chaptersCompleted: integer('chapters_completed').default(0).notNull(),

    // Time tracking
    totalReadingTimeMinutes: integer('total_reading_time_minutes').default(0).notNull(),
    averageSessionMinutes: integer('average_session_minutes'),
    sessionCount: integer('session_count').default(0).notNull(),

    // Reading sessions log: [{startedAt, endedAt, pagesRead, chapterId}]
    sessions: jsonb('sessions').default('[]'),

    // Completion
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),

    lastReadAt: timestamp('last_read_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('read_help_progress_book_idx').on(table.bookId),
    index('read_help_progress_last_read_idx').on(table.lastReadAt),
  ]
);

// Flashcards for spaced repetition learning
export const readHelpFlashcards = pgTable(
  'read_help_flashcards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookId: uuid('book_id')
      .references(() => readHelpBooks.id, { onDelete: 'cascade' })
      .notNull(),
    chapterId: uuid('chapter_id')
      .references(() => readHelpChapters.id, { onDelete: 'set null' }),

    // Card content
    front: text('front').notNull(), // Question or term
    back: text('back').notNull(), // Answer or definition
    pageReference: integer('page_reference'),

    // Card type
    cardType: text('card_type').default('concept').notNull(), // concept, quote, framework, custom

    // Spaced repetition (SM-2 algorithm)
    easeFactor: real('ease_factor').default(2.5).notNull(), // Difficulty multiplier
    interval: integer('interval').default(1).notNull(), // Days until next review
    repetitions: integer('repetitions').default(0).notNull(), // Successful reviews in a row
    nextReviewAt: timestamp('next_review_at', { withTimezone: true }),
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),

    // Stats
    totalReviews: integer('total_reviews').default(0).notNull(),
    correctCount: integer('correct_count').default(0).notNull(),

    // Status
    isArchived: boolean('is_archived').default(false).notNull(),
    isSuspended: boolean('is_suspended').default(false).notNull(), // Temporarily skip

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('read_help_flashcards_book_idx').on(table.bookId),
    index('read_help_flashcards_chapter_idx').on(table.chapterId),
    index('read_help_flashcards_review_idx').on(table.nextReviewAt),
    index('read_help_flashcards_archived_idx').on(table.isArchived),
  ]
);

// ============================================
// READ HELP - YouTube Video Learning
// ============================================

export const readHelpVideos = pgTable(
  'read_help_videos',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // YouTube info
    youtubeId: text('youtube_id').notNull().unique(),
    youtubeUrl: text('youtube_url').notNull(),
    title: text('title').notNull(),
    channelName: text('channel_name'),
    channelId: text('channel_id'),
    description: text('description'),
    thumbnailUrl: text('thumbnail_url'),
    durationSeconds: integer('duration_seconds'),
    publishedAt: timestamp('published_at', { withTimezone: true }),

    // Canvas integration
    canvasCourseId: text('canvas_course_id'),
    canvasModuleItemId: text('canvas_module_item_id'),
    canvasModuleName: text('canvas_module_name'),

    // Content
    transcript: text('transcript'),
    transcriptLanguage: text('transcript_language').default('en'),
    transcriptSource: text('transcript_source'), // 'youtube_auto', 'youtube_manual', 'whisper'
    wordCount: integer('word_count'),

    // AI-generated summaries (cached)
    summaryShort: text('summary_short'), // ~500 words, 5 min read
    summaryMedium: text('summary_medium'), // ~1500 words, 15 min read  
    summaryLong: text('summary_long'), // ~3000 words, 30 min read
    summaryGeneratedAt: timestamp('summary_generated_at', { withTimezone: true }),

    // Key concepts
    keyConcepts: jsonb('key_concepts'), // [{term, definition, timestamps}]
    keyPoints: jsonb('key_points'), // [{point, timestamp, context}]

    // Processing status
    status: text('status').default('pending').notNull(), // pending, processing, ready, error
    processingError: text('processing_error'),

    // User metadata
    tags: text('tags').array(),
    notes: text('notes'),
    rating: integer('rating'), // 1-5

    // State
    isArchived: boolean('is_archived').default(false).notNull(),
    lastWatchedAt: timestamp('last_watched_at', { withTimezone: true }),
    watchProgress: integer('watch_progress').default(0), // seconds watched

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('read_help_videos_youtube_id_idx').on(table.youtubeId),
    index('read_help_videos_status_idx').on(table.status),
    index('read_help_videos_canvas_course_idx').on(table.canvasCourseId),
    index('read_help_videos_archived_idx').on(table.isArchived),
  ]
);

// ============================================
// STUDY HELP - MULTI-TENANT AUTH
// ============================================

// Institutions (universities with Canvas LMS)
export const studyHelpInstitutions = pgTable(
  'study_help_institutions',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Institution info
    name: text('name').notNull(), // 'Brigham Young University'
    domain: text('domain').notNull().unique(), // 'byu.edu'
    shortName: text('short_name'), // 'BYU'
    logoUrl: text('logo_url'),

    // Canvas LMS configuration
    canvasBaseUrl: text('canvas_base_url').notNull(), // 'https://byu.instructure.com'
    canvasClientId: text('canvas_client_id'), // OAuth app ID
    canvasClientSecretEncrypted: text('canvas_client_secret_encrypted'), // Encrypted

    // Status
    enabled: boolean('enabled').default(true).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('study_help_institutions_domain_idx').on(table.domain),
    index('study_help_institutions_enabled_idx').on(table.enabled),
  ]
);

// Users
export const studyHelpUsers = pgTable(
  'study_help_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Basic info
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    name: text('name'),

    // Institution link
    institutionId: uuid('institution_id').references(() => studyHelpInstitutions.id),

    // Canvas OAuth tokens (encrypted at rest)
    canvasAccessTokenEncrypted: text('canvas_access_token_encrypted'),
    canvasRefreshTokenEncrypted: text('canvas_refresh_token_encrypted'),
    canvasTokenExpiresAt: timestamp('canvas_token_expires_at', { withTimezone: true }),
    canvasUserId: text('canvas_user_id'),

    // Email verification
    emailVerified: boolean('email_verified').default(false).notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    emailVerificationToken: text('email_verification_token'),
    emailVerificationExpiresAt: timestamp('email_verification_expires_at', { withTimezone: true }),

    // Password reset
    passwordResetToken: text('password_reset_token'),
    passwordResetExpiresAt: timestamp('password_reset_expires_at', { withTimezone: true }),

    // Status
    isActive: boolean('is_active').default(true).notNull(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('study_help_users_email_idx').on(table.email),
    index('study_help_users_institution_idx').on(table.institutionId),
    index('study_help_users_canvas_user_idx').on(table.canvasUserId),
    index('study_help_users_active_idx').on(table.isActive),
  ]
);

// User sessions
export const studyHelpSessions = pgTable(
  'study_help_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => studyHelpUsers.id, { onDelete: 'cascade' })
      .notNull(),

    // Session token (hashed)
    tokenHash: text('token_hash').notNull().unique(),

    // Expiration
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

    // Session metadata
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    deviceType: text('device_type'), // 'desktop', 'mobile', 'tablet'

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('study_help_sessions_user_idx').on(table.userId),
    index('study_help_sessions_token_idx').on(table.tokenHash),
    index('study_help_sessions_expires_idx').on(table.expiresAt),
  ]
);

// User courses (per-user course enrollments from Canvas)
export const studyHelpUserCourses = pgTable(
  'study_help_user_courses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .references(() => studyHelpUsers.id, { onDelete: 'cascade' })
      .notNull(),

    // Canvas course info
    canvasCourseId: text('canvas_course_id').notNull(),
    courseName: text('course_name').notNull(),
    courseCode: text('course_code'),
    term: text('term'), // 'Winter 2026'

    // Status
    isActive: boolean('is_active').default(true).notNull(),
    isPinned: boolean('is_pinned').default(false).notNull(),

    // Sync tracking
    lastContentSyncAt: timestamp('last_content_sync_at', { withTimezone: true }),
    lastTaskSyncAt: timestamp('last_task_sync_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('study_help_user_courses_user_idx').on(table.userId),
    index('study_help_user_courses_canvas_idx').on(table.canvasCourseId),
    index('study_help_user_courses_active_idx').on(table.isActive),
  ]
);

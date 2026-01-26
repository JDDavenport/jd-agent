// Task Types
export type TaskStatus = 'inbox' | 'today' | 'upcoming' | 'waiting' | 'someday' | 'done' | 'archived';
export type TaskSource = 'manual' | 'email' | 'canvas' | 'meeting' | 'recording' | 'chat';
export type EnergyLevel = 'high' | 'low' | 'admin';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: number;
  dueDate?: string;
  dueDateIsHard: boolean;
  scheduledStart?: string;
  scheduledEnd?: string;
  source: TaskSource;
  sourceRef?: string;
  context: string;
  taskContexts?: string[];
  taskLabels?: string[];
  timeEstimateMinutes?: number;
  energyLevel?: EnergyLevel;
  blockedBy?: string;
  waitingFor?: string;
  waitingSince?: string;
  projectId?: string;
  parentTaskId?: string;
  sectionId?: string;
  calendarEventId?: string;
  recurrenceRule?: string;
  recurrenceParentId?: string;
  completedBy?: string;
  vaultEntryId?: string;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  dueDate?: string;
  context: string;
  source?: TaskSource;
  timeEstimateMinutes?: number;
  energyLevel?: EnergyLevel;
  priority?: number;
  projectId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  dueDate?: string | null;
  context?: string;
  timeEstimateMinutes?: number;
  energyLevel?: EnergyLevel;
  priority?: number;
}

export interface TaskFilters {
  status?: TaskStatus;
  context?: string;
  source?: TaskSource;
  dueBefore?: string;
  dueAfter?: string;
  projectId?: string;
  includeCompleted?: boolean;
}

// Project Types
export type ProjectView = 'list' | 'board' | 'calendar';

export interface Project {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parentProjectId?: string;
  area?: string;
  isFavorite: boolean;
  isArchived: boolean;
  sortOrder?: number;
  defaultView: ProjectView;
  targetCompletionDate?: string;
  vaultFolderId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  archivedAt?: string;
}

export interface Section {
  id: string;
  projectId: string;
  name: string;
  sortOrder: number;
  isCollapsed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  parentProjectId?: string;
  area?: string;
  defaultView?: ProjectView;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  isFavorite?: boolean;
  isArchived?: boolean;
  sortOrder?: number;
  defaultView?: ProjectView;
  targetCompletionDate?: string | null;
}

export interface CreateSectionInput {
  projectId: string;
  name: string;
  sortOrder?: number;
}

// Goal Types
export type GoalStatus = 'active' | 'completed' | 'paused' | 'abandoned';
export type GoalMetricType = 'boolean' | 'numeric' | 'percentage' | 'milestone';
export type LifeArea = 'spiritual' | 'personal' | 'fitness' | 'family' | 'professional' | 'school';

export interface Goal {
  id: string;
  title: string;
  description?: string;
  status: GoalStatus;
  metricType?: GoalMetricType;
  targetValue?: number;
  currentValue?: number;
  progressPercentage: number;
  lifeArea?: LifeArea;
  targetDate?: string;
  startDate?: string;
  priority: number;
  motivation?: string;
  vision?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// Calendar Types
export type EventType = 'class' | 'meeting' | 'deadline' | 'personal' | 'blocked_time';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  eventType?: EventType;
  context?: string;
  googleEventId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCalendarEventInput {
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  allDay?: boolean;
  eventType?: EventType;
  context?: string;
}

// Vault Entry Types (legacy)
export type VaultContentType =
  | 'note'
  | 'recording_summary'
  | 'lecture'
  | 'meeting'
  | 'article'
  | 'reference'
  | 'resume'
  | 'document'
  | 'journal'
  | 'class_notes'
  | 'meeting_notes'
  | 'task_archive'
  | 'snippet'
  | 'template'
  | 'other';

export type VaultSource =
  | 'remarkable'
  | 'plaud'
  | 'email'
  | 'manual'
  | 'web'
  | 'canvas'
  | 'notion'
  | 'google_drive'
  | 'google_docs'
  | 'apple_notes';

export interface VaultEntry {
  id: string;
  title: string;
  content?: string;
  contentType: VaultContentType;
  source: VaultSource;
  sourceRef?: string;
  context: string;
  tags: string[];
  parentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VaultTreeNode {
  id: string;
  title: string;
  contentType: string;
  context: string;
  parentId: string | null;
  children: VaultTreeNode[];
  createdAt: string;
  updatedAt: string;
}

export interface VaultBreadcrumb {
  id: string;
  title: string;
}

export interface VaultAttachment {
  id: string;
  entryId: string;
  filename: string;
  mimeType: string;
  size: number;
  storagePath: string;
  extractedText?: string;
  uploadedAt: string;
}

export interface CreateVaultInput {
  title: string;
  content?: string;
  contentType: VaultContentType;
  source?: VaultSource;
  context: string;
  tags?: string[];
  parentId?: string;
}

export interface VaultSearchParams {
  query: string;
  context?: string;
  contentType?: VaultContentType;
  limit?: number;
}

// PARA Types
export type PARAType = 'projects' | 'areas' | 'resources' | 'archive';

export interface PARAFolder {
  id: string;
  title: string;
  paraType: PARAType;
  icon: string | null;
  childCount: number;
}

export interface InitializePARAResult {
  created: number;
  existing: number;
  folders: PARAFolder[];
}

// Vault Pages (Notion-like)
export interface VaultPage {
  id: string;
  parentId?: string | null;
  title: string;
  icon?: string | null;
  coverImage?: string | null;
  isFavorite: boolean;
  isArchived: boolean;
  sortOrder: number;
  paraType?: PARAType | null;
  isSystem?: boolean;
  legacyEntryId?: string | null;
  createdAt: string;
  updatedAt: string;
  lastViewedAt?: string | null;
}

export interface VaultPageTreeNode {
  id: string;
  title: string;
  icon?: string | null;
  parentId: string | null;
  isFavorite: boolean;
  paraType?: PARAType | null;
  isSystem?: boolean;
  children: VaultPageTreeNode[];
  createdAt: string;
  updatedAt: string;
}

export interface VaultPageBreadcrumb {
  id: string;
  title: string;
  icon?: string | null;
}

export interface CreateVaultPageInput {
  title?: string;
  parentId?: string | null;
  icon?: string | null;
  coverImage?: string | null;
}

export interface UpdateVaultPageInput {
  title?: string;
  icon?: string | null;
  coverImage?: string | null;
  isFavorite?: boolean;
  isArchived?: boolean;
  parentId?: string | null;
  sortOrder?: number;
}

// Vault Blocks
export type VaultBlockType =
  | 'text'
  | 'heading_1'
  | 'heading_2'
  | 'heading_3'
  | 'bulleted_list'
  | 'numbered_list'
  | 'todo'
  | 'toggle'
  | 'quote'
  | 'callout'
  | 'divider'
  | 'code'
  | 'image'
  | 'file'
  | 'bookmark'
  | 'page_link'
  | 'task_link'
  | 'goal_link';

export interface TextBlockContent {
  text: string;
  marks?: Array<{
    type: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code' | 'link';
    attrs?: { href?: string };
  }>;
}

export interface HeadingBlockContent {
  text: string;
  level: 1 | 2 | 3;
}

export interface TodoBlockContent {
  text: string;
  checked: boolean;
}

export interface CalloutBlockContent {
  text: string;
  emoji?: string;
  color?: 'gray' | 'brown' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'pink' | 'red';
}

export interface CodeBlockContent {
  code: string;
  language?: string;
  caption?: string;
}

export interface ImageBlockContent {
  url: string;
  caption?: string;
  width?: number;
}

export interface FileBlockContent {
  url: string;
  filename: string;
  size?: number;
  mimeType?: string;
}

export interface BookmarkBlockContent {
  url: string;
  title?: string;
  description?: string;
  favicon?: string;
  image?: string;
}

export interface PageLinkBlockContent {
  pageId: string;
  title?: string;
}

export interface TaskLinkBlockContent {
  taskId: string;
  title?: string;
  status?: string;
}

export interface GoalLinkBlockContent {
  goalId: string;
  title?: string;
}

export type VaultBlockContent =
  | TextBlockContent
  | HeadingBlockContent
  | TodoBlockContent
  | CalloutBlockContent
  | CodeBlockContent
  | ImageBlockContent
  | FileBlockContent
  | BookmarkBlockContent
  | PageLinkBlockContent
  | TaskLinkBlockContent
  | GoalLinkBlockContent
  | Record<string, unknown>;

export interface VaultBlock {
  id: string;
  pageId: string;
  parentBlockId?: string | null;
  type: VaultBlockType;
  content: VaultBlockContent;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVaultBlockInput {
  type: VaultBlockType;
  content: VaultBlockContent;
  parentBlockId?: string | null;
  afterBlockId?: string | null;
}

export interface UpdateVaultBlockInput {
  type?: VaultBlockType;
  content?: VaultBlockContent;
}

export interface MoveVaultBlockInput {
  pageId?: string;
  parentBlockId?: string | null;
  afterBlockId?: string | null;
}

export interface BatchBlockOperation {
  op: 'create' | 'update' | 'delete' | 'move';
  blockId?: string;
  data?: CreateVaultBlockInput | UpdateVaultBlockInput | MoveVaultBlockInput;
}

// ============================================
// Journal Types
// ============================================

export type ReviewMood = 'great' | 'good' | 'okay' | 'difficult' | 'terrible';

export interface HabitForReview {
  id: string;
  name: string;
  emoji?: string;
  frequency: string;
  targetDays?: string[];
  currentStreak: number;
  longestStreak: number;
  isCompletedToday: boolean;
  completionId?: string;
}

export interface GoalForReview {
  id: string;
  title: string;
  lifeArea: string;
  progress: number;
  targetDate?: string;
  status: string;
}

export interface CompletedTaskForReview {
  id: string;
  title: string;
  completedAt: string;
  projectName?: string;
  context: string;
}

export interface ClassNoteForReview {
  id: string;
  className: string;
  pageId?: string;
  noteDate: string;
}

export interface TomorrowEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  eventType?: string;
}

export interface TomorrowTask {
  id: string;
  title: string;
  dueDate?: string;
  priority: number;
}

export interface TomorrowHabit {
  id: string;
  name: string;
  emoji?: string;
}

export interface DailyReviewData {
  date: string;
  review: DailyReview | null;
  habits: HabitForReview[];
  goals: GoalForReview[];
  completedTasks: CompletedTaskForReview[];
  classNotes: ClassNoteForReview[];
  tomorrow: {
    events: TomorrowEvent[];
    tasks: TomorrowTask[];
    habits: TomorrowHabit[];
  };
}

export interface DailyReview {
  id: string;
  date: string;
  journalText?: string;
  mood?: ReviewMood;
  tags: string[];
  tasksReviewed: TaskReflection[];
  classesReviewed: ClassReflection[];
  currentStep: number;
  reviewCompleted: boolean;
  habitsCompletedCount: number;
  habitsTotalCount: number;
  goalsReviewedCount: number;
  tomorrowEventsCount: number;
  tomorrowTasksCount: number;
  reviewDurationSeconds?: number;
  vaultPageId?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskReflection {
  taskId: string;
  taskTitle: string;
  completedAt?: string;
  projectName?: string;
  reflectionNote?: string;
}

export interface ClassReflection {
  classId: string;
  className: string;
  pageId?: string;
  reflectionNote?: string;
}

export interface SaveReviewInput {
  id: string;
  journalText?: string;
  mood?: ReviewMood;
  tags?: string[];
  tasksReviewed?: TaskReflection[];
  classesReviewed?: ClassReflection[];
  currentStep?: number;
}

export interface CompleteReviewInput {
  id: string;
  journalText: string;
  mood: ReviewMood;
  tags: string[];
  reviewDurationSeconds: number;
}

export interface ReviewHistoryItem {
  id: string;
  date: string;
  mood?: ReviewMood;
  journalText?: string;
  wordCount: number;
  tags: string[];
  habitsCompletedCount: number;
  habitsTotalCount: number;
  completedAt?: string;
}

// ============================================
// MBA Class Types
// ============================================

export interface ClassSummary {
  code: string;
  name: string;
  semester: string;
  noteCount: number;
  lastNoteDate?: string;
  hasPlaud: boolean;
  hasRemarkable: boolean;
  nextClass?: string;
}

export interface ClassDay {
  date: string;
  hasTypedNotes: boolean;
  hasPlaudRecording: boolean;
  hasRemarkableNotes: boolean;
  isCombined: boolean;
  vaultPageId?: string;
  plaudRecordingId?: string;
  remarkableNoteId?: string;
}

export interface ClassDayContent {
  classCode: string;
  noteDate: string;
  semester: string;
  typedNotes?: string;
  plaudTranscript?: string;
  remarkableOcr?: string;
  remarkablePdfPath?: string;
  combinedMarkdown?: string;
  vaultPageId?: string;
}

export interface ClassDetails {
  class: {
    id: string;
    code: string;
    name: string;
    semester?: string;
  };
  classDays: ClassDay[];
  totalDays: number;
  combinedCount: number;
  pendingCombine: number;
}

// ============================================
// MBA Classes Types (Vault-Based)
// ============================================

export interface MbaRecording {
  id: string;
  title: string;
  recordedAt: string;
  durationSeconds?: number;
  hasTranscript: boolean;
  status: string;
}

export interface MbaRemarkableNote {
  id: string;
  title: string;
  icon?: string | null;
}

export interface MbaClassSession {
  id: string;
  date: string;
  icon?: string | null;
  remarkableNotes: MbaRemarkableNote[];
  recordings: MbaRecording[];
}

export interface MbaClass {
  id: string;
  title: string;
  icon?: string | null;
  sessions: MbaClassSession[];
}

export interface MbaSemester {
  id: string;
  title: string;
  icon?: string | null;
  classes: MbaClass[];
}

export interface MbaClassesResponse {
  root: {
    id: string;
    title: string;
    icon?: string | null;
  };
  semesters: MbaSemester[];
  stats: {
    totalSemesters: number;
    totalClasses: number;
    totalSessions: number;
    sessionsWithRecordings: number;
    totalRecordings: number;
  };
}

export interface MbaClassSummary {
  overview: string;
  keyPoints: string[];
  topics: string[];
}

export interface MbaClassSessionStats {
  totalRecordings: number;
  totalDurationMinutes: number;
  hasTranscripts: number;
  hasPdf: boolean;
  hasOcrText: boolean;
}

export interface MbaClassSessionResponse {
  session: VaultPage;
  blocks: VaultBlock[];
  remarkableNotes: Array<VaultPage & { blocks: VaultBlock[] }>;
  className: string | null;
  breadcrumbs: VaultPageBreadcrumb[];

  // Enhanced fields
  summary: MbaClassSummary | null;
  pdfUrl: string | null;
  pdfFilename: string | null;
  ocrText: string;
  confidence: number;
  stats: MbaClassSessionStats;
  calendarEvent?: {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    location?: string | null;
  } | null;

  recordings: Array<{
    id: string;
    title: string;
    recordedAt: string;
    durationSeconds?: number;
    // Effective duration within class time (for partial recordings)
    effectiveDurationSeconds?: number;
    status: string;
    confidence: number;
    transcript?: {
      id: string;
      // Full text (original recording)
      fullText?: string;
      // Filtered text (only segments within class time)
      text: string;
      summary?: MbaClassSummary;
      // Whether the text was filtered for partial recording
      isFiltered?: boolean;
    } | null;
    verification?: {
      keywordsFound: string[];
      classScores: Record<string, { count: number; keywords: string[] }>;
      bestMatchClass: string | null;
      isBestMatch: boolean;
      confidenceReason: string;
      recordingTime: string | null;
      timeMatch: 'good' | 'warning' | 'unknown';
      // Calendar-based matching info
      calendarMatch?: boolean;
      overlapMinutes?: number | null;
      // Segment timing for partial recordings
      effectiveStartSeconds?: number | null;
      effectiveEndSeconds?: number | null;
      totalSegments?: number;
      relevantSegments?: number;
      segmentNote?: string | null;
    };
  }>;
  totalRecordingsForDate: number;
}

// ============================================
// Archive Types
// ============================================

export interface ArchivedTask {
  id: string;
  title: string;
  content?: string;
  context: string;
  sourceDate: string;
  tags: string[];
  sourceRef?: string;
}

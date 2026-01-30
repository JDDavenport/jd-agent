// Re-export courses
export * from './courses';

// Task types (from tasks app)
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
  subtaskCount?: number;
  completedSubtaskCount?: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// Book types (from read-help)
export interface Book {
  id: string;
  title: string;
  author: string | null;
  pageCount: number | null;
  status: string;
  tags: string[] | null;
  isArchived: boolean;
  lastReadAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Chapter {
  id: string;
  bookId: string;
  chapterNumber: number;
  title: string | null;
  startPage: number | null;
  endPage: number | null;
  content: string;
  wordCount: number | null;
  summaryShort: string | null;
  summaryMedium: string | null;
  summaryLong: string | null;
  keyConcepts?: KeyConcept[] | null;
  createdAt: string;
}

export interface KeyConcept {
  term: string;
  definition: string;
  pageNumbers: number[];
}

export interface Flashcard {
  id: string;
  bookId: string;
  chapterId: string;
  front: string;
  back: string;
  nextReviewAt: string;
  easeFactor: number;
  repetitions: number;
  interval: number;
  createdAt: string;
}

export interface ReadingProgress {
  id: string;
  bookId: string;
  currentPage: number;
  percentComplete: number;
  pagesRead: number;
  chaptersCompleted: number;
  totalReadingTimeMinutes: number;
  lastReadAt: string | null;
}

// Course types
export interface Course {
  id: string;
  code: string;
  name: string;
  color?: string;
}

// Study item - unified type for dashboard
export interface StudyItem {
  id: string;
  type: 'task' | 'reading' | 'quiz' | 'assignment';
  title: string;
  course?: string;
  courseColor?: string;
  dueDate?: string;
  timeEstimateMinutes?: number;
  priority: number;
  status: 'not_started' | 'in_progress' | 'completed';
  sourceId: string; // Original task/reading ID
  sourceType: 'task' | 'book' | 'chapter';
}

// Calendar event
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  allDay: boolean;
  eventType?: string;
  context?: string;
}

// Pomodoro types
export interface PomodoroSession {
  id: string;
  studyItemId?: string;
  startedAt: string;
  endedAt?: string;
  durationMinutes: number;
  type: 'work' | 'short_break' | 'long_break';
  completed: boolean;
}

export type SummaryLength = 'short' | 'medium' | 'long';

// Video types
export interface Video {
  id: string;
  youtubeId: string;
  youtubeUrl: string;
  title: string;
  channelName: string | null;
  channelId: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  publishedAt: string | null;
  canvasCourseId: string | null;
  canvasModuleItemId: string | null;
  canvasModuleName: string | null;
  transcript: string | null;
  transcriptLanguage: string | null;
  transcriptSource: string | null;
  wordCount: number | null;
  summaryShort: string | null;
  summaryMedium: string | null;
  summaryLong: string | null;
  summaryGeneratedAt: string | null;
  keyConcepts: Array<{ term: string; definition: string; context: string }> | null;
  keyPoints: Array<{ point: string; timestamp: number; context: string }> | null;
  status: 'pending' | 'processing' | 'ready' | 'error';
  processingError: string | null;
  tags: string[] | null;
  notes: string | null;
  rating: number | null;
  isArchived: boolean;
  lastWatchedAt: string | null;
  watchProgress: number;
  createdAt: string;
  updatedAt: string;
}

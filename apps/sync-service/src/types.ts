// Unified schemas for Study Aide Sync Service

export interface Task {
  id: string;
  courseId: string;
  title: string;
  type: 'assignment' | 'quiz' | 'discussion' | 'page' | 'file' | 'announcement';
  dueDate: string | null;
  description: string;
  status: 'pending' | 'submitted' | 'graded' | 'missing' | 'none';
  points: number | null;
  url: string | null;
  sourceType: 'canvas' | 'plaud' | 'remarkable';
  rawId: string; // Original ID from source
}

export interface Content {
  id: string;
  courseId: string;
  title: string;
  type: 'page' | 'file' | 'recording' | 'note' | 'video' | 'pdf' | 'slides' | 'link';
  url: string | null;
  sourceType: 'canvas' | 'plaud' | 'remarkable';
  rawId: string;
  moduleId?: string;
  moduleName?: string;
  transcript?: string;
  filePath?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Course {
  id: string;
  canvasId: string;
  name: string;
  code: string;
  term: string;
}

export interface Module {
  id: string;
  courseId: string;
  name: string;
  position: number;
  items: ModuleItem[];
}

export interface ModuleItem {
  id: string;
  moduleId: string;
  title: string;
  type: 'Assignment' | 'Quiz' | 'Discussion' | 'Page' | 'File' | 'ExternalUrl' | 'SubHeader';
  contentId: string | null;
  position: number;
  url: string | null;
}

export interface Grade {
  courseId: string;
  assignmentId: string;
  score: number | null;
  possiblePoints: number;
  grade: string | null;
  submittedAt: string | null;
  gradedAt: string | null;
}

export interface CalendarEvent {
  id: string;
  courseId: string | null;
  title: string;
  description: string;
  startAt: string;
  endAt: string | null;
  type: 'assignment' | 'event';
}

export interface PlaudRecording {
  id: string;
  folderName: string;
  date: string;
  time: string;
  transcript: string | null;
  audioPath: string | null;
  matchedCourseId: string | null;
  matchedClassName: string | null;
}

export interface RemarkableNote {
  id: string;
  name: string;
  folder: string;
  modifiedAt: string;
  content: string | null;
  matchedCourseId: string | null;
}

// Gold standard structure
export interface GoldStandard {
  generatedAt: string;
  courses: Course[];
  tasks: Task[];
  content: Content[];
  modules: Module[];
  grades: Grade[];
  calendarEvents: CalendarEvent[];
  plaudRecordings: PlaudRecording[];
  remarkableNotes: RemarkableNote[];
}

// Verification result
export interface VerificationResult {
  coursesMatch: { total: number; matched: number };
  tasksMatch: { total: number; matched: number; missing: string[] };
  contentMatch: { total: number; matched: number; missing: string[] };
  summary: string;
}

// Canvas API response types
export interface CanvasAssignment {
  id: number;
  name: string;
  description: string | null;
  due_at: string | null;
  points_possible: number | null;
  submission_types: string[];
  html_url: string;
  has_submitted_submissions: boolean;
  published: boolean;
}

export interface CanvasModule {
  id: number;
  name: string;
  position: number;
  items_count: number;
  items_url: string;
}

export interface CanvasModuleItem {
  id: number;
  module_id: number;
  title: string;
  type: string;
  content_id: number | null;
  position: number;
  html_url: string | null;
  external_url: string | null;
}

export interface CanvasPage {
  page_id: number;
  url: string;
  title: string;
  body: string | null;
  html_url: string;
}

export interface CanvasFile {
  id: number;
  display_name: string;
  filename: string;
  url: string;
  content_type: string;
  size: number;
}

export interface CanvasAnnouncement {
  id: number;
  title: string;
  message: string;
  posted_at: string;
  html_url: string;
}

export interface CanvasSubmission {
  assignment_id: number;
  score: number | null;
  grade: string | null;
  submitted_at: string | null;
  graded_at: string | null;
  workflow_state: string;
}

export interface CanvasCalendarEvent {
  id: number;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  context_code: string;
  type: string;
  assignment?: { id: number };
}

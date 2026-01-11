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

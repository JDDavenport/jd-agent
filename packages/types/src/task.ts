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
  taskContexts?: string[]; // GTD @contexts
  taskLabels?: string[]; // Todoist-style labels
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

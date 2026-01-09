export type TaskStatus = 'inbox' | 'today' | 'upcoming' | 'waiting' | 'someday' | 'done' | 'archived';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskSource = 'email' | 'canvas' | 'meeting' | 'recording' | 'manual' | 'calendar' | 'remarkable' | 'linear';
export type EnergyLevel = 'high' | 'low' | 'admin';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  dueDateIsHard: boolean;
  completedAt: string | null;
  source: TaskSource;
  sourceRef: string | null;
  context: string | null;
  timeEstimateMinutes: number | null;
  energyLevel: EnergyLevel | null;
  waitingFor: string | null;
  projectId: string | null;
  parentTaskId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  dueDateIsHard?: boolean;
  source?: TaskSource;
  sourceRef?: string;
  context?: string;
  timeEstimateMinutes?: number;
  energyLevel?: EnergyLevel;
  waitingFor?: string;
  projectId?: string;
  parentTaskId?: string;
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  completedAt?: string;
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

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

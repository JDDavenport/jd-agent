import apiClient from './client';
import type { Task, CreateTaskInput, UpdateTaskInput, TaskFilters } from '../types/task';

export const getTasks = async (filters?: TaskFilters): Promise<Task[]> => {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.context) params.append('context', filters.context);
  if (filters?.source) params.append('source', filters.source);
  if (filters?.dueBefore) params.append('dueBefore', filters.dueBefore);
  if (filters?.dueAfter) params.append('dueAfter', filters.dueAfter);
  if (filters?.projectId) params.append('projectId', filters.projectId);
  if (filters?.includeCompleted !== undefined) {
    params.append('includeCompleted', filters.includeCompleted.toString());
  }
  // Request all tasks for client-side filtering (backend defaults to 30)
  params.append('limit', '1000');

  return apiClient.get(`/tasks?${params.toString()}`);
};

export const getTodayTasks = async (): Promise<Task[]> => {
  return apiClient.get('/tasks/today');
};

export const getTask = async (id: string): Promise<Task> => {
  return apiClient.get(`/tasks/${id}`);
};

export const createTask = async (data: CreateTaskInput): Promise<Task> => {
  return apiClient.post('/tasks', data);
};

export const updateTask = async (id: string, data: UpdateTaskInput): Promise<Task> => {
  return apiClient.patch(`/tasks/${id}`, data);
};

export const completeTask = async (id: string): Promise<Task> => {
  return apiClient.post(`/tasks/${id}/complete`);
};

export const deleteTask = async (id: string): Promise<void> => {
  await apiClient.delete(`/tasks/${id}`);
};

import type {
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  TaskFilters,
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  Section,
  CreateSectionInput,
  CalendarEvent,
  CreateCalendarEventInput,
} from './types';

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`API ${method} ${path} failed: ${response.status}`);
    }

    const data = await response.json();
    return data.data ?? data;
  }

  // Tasks
  async listTasks(filters?: TaskFilters): Promise<Task[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.context) params.set('context', filters.context);
    const query = params.toString();
    return this.request('GET', `/api/tasks${query ? `?${query}` : ''}`);
  }

  async getTodayTasks(): Promise<Task[]> {
    return this.request('GET', '/api/tasks/today');
  }

  async getInboxTasks(): Promise<Task[]> {
    return this.request('GET', '/api/tasks/inbox');
  }

  async getTask(id: string): Promise<Task> {
    return this.request('GET', `/api/tasks/${id}`);
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    return this.request('POST', '/api/tasks', input);
  }

  async updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
    return this.request('PATCH', `/api/tasks/${id}`, input);
  }

  async completeTask(id: string): Promise<Task> {
    return this.request('POST', `/api/tasks/${id}/complete`);
  }

  async deleteTask(id: string): Promise<void> {
    return this.request('DELETE', `/api/tasks/${id}`);
  }

  // Projects
  async listProjects(): Promise<Project[]> {
    return this.request('GET', '/api/projects');
  }

  async getProject(id: string): Promise<Project> {
    return this.request('GET', `/api/projects/${id}`);
  }

  async createProject(input: CreateProjectInput): Promise<Project> {
    return this.request('POST', '/api/projects', input);
  }

  async updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
    return this.request('PATCH', `/api/projects/${id}`, input);
  }

  async deleteProject(id: string): Promise<void> {
    return this.request('DELETE', `/api/projects/${id}`);
  }

  // Sections
  async listSections(projectId: string): Promise<Section[]> {
    return this.request('GET', `/api/projects/${projectId}/sections`);
  }

  async createSection(input: CreateSectionInput): Promise<Section> {
    return this.request('POST', `/api/projects/${input.projectId}/sections`, input);
  }

  // Calendar
  async listCalendarEvents(): Promise<CalendarEvent[]> {
    return this.request('GET', '/api/calendar');
  }

  async getTodayEvents(): Promise<CalendarEvent[]> {
    return this.request('GET', '/api/calendar/today');
  }

  async createCalendarEvent(input: CreateCalendarEventInput): Promise<CalendarEvent> {
    return this.request('POST', '/api/calendar', input);
  }

  // Health
  async getHealth(): Promise<{ status: string }> {
    return this.request('GET', '/api/health');
  }
}

export function createClient(baseUrl: string = 'http://localhost:3000'): ApiClient {
  return new ApiClient(baseUrl);
}

export type {
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  Project,
  Section,
  CalendarEvent,
};

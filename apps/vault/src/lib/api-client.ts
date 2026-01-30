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
  Goal,
  VaultEntry,
  CreateVaultInput,
  VaultSearchParams,
  VaultTreeNode,
  VaultBreadcrumb,
  VaultAttachment,
  CalendarEvent,
  CreateCalendarEventInput,
  VaultPage,
  VaultPageTreeNode,
  VaultPageBreadcrumb,
  CreateVaultPageInput,
  UpdateVaultPageInput,
  VaultBlock,
  CreateVaultBlockInput,
  UpdateVaultBlockInput,
  MoveVaultBlockInput,
  BatchBlockOperation,
  DailyReviewData,
  DailyReview,
  SaveReviewInput,
  CompleteReviewInput,
  ReviewHistoryItem,
  ArchivedTask,
  PARAType,
  PARAFolder,
  InitializePARAResult,
  ClassSummary,
  ClassDetails,
  ClassDayContent,
  MbaClassesResponse,
  MbaClassSessionResponse,
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

  // Vault (legacy entries)
  async listVault(): Promise<VaultEntry[]> {
    return this.request('GET', '/api/vault');
  }

  async searchVault(params: VaultSearchParams): Promise<VaultEntry[]> {
    const query = new URLSearchParams({ query: params.query });
    if (params.context) query.set('context', params.context);
    if (params.limit) query.set('limit', String(params.limit));
    return this.request('GET', `/api/vault/search?${query}`);
  }

  async createVaultEntry(input: CreateVaultInput): Promise<VaultEntry> {
    return this.request('POST', '/api/vault', input);
  }

  async getVaultEntry(id: string): Promise<VaultEntry> {
    return this.request('GET', `/api/vault/${id}`);
  }

  async updateVaultEntry(id: string, input: Partial<CreateVaultInput>): Promise<VaultEntry> {
    return this.request('PATCH', `/api/vault/${id}`, input);
  }

  async deleteVaultEntry(id: string): Promise<void> {
    return this.request('DELETE', `/api/vault/${id}`);
  }

  async getVaultTree(): Promise<VaultTreeNode[]> {
    return this.request('GET', '/api/vault/tree');
  }

  async getVaultChildren(parentId: string | null): Promise<VaultEntry[]> {
    const path = parentId ? `/api/vault/${parentId}/children` : '/api/vault/children';
    return this.request('GET', path);
  }

  async getVaultBreadcrumb(id: string): Promise<VaultBreadcrumb[]> {
    return this.request('GET', `/api/vault/${id}/breadcrumb`);
  }

  async moveVaultEntry(id: string, parentId: string | null): Promise<VaultEntry> {
    return this.request('POST', `/api/vault/${id}/move`, { parentId });
  }

  async getVaultEntryAttachments(id: string): Promise<VaultAttachment[]> {
    return this.request('GET', `/api/vault/${id}/attachments`);
  }

  // Vault Pages (Notion-like block-based pages)
  async listVaultPages(options?: { archived?: boolean }): Promise<VaultPage[]> {
    const params = new URLSearchParams();
    if (options?.archived !== undefined) params.set('archived', String(options.archived));
    const query = params.toString();
    return this.request('GET', `/api/vault/pages${query ? `?${query}` : ''}`);
  }

  async getVaultPageTree(options?: { archived?: boolean }): Promise<VaultPageTreeNode[]> {
    const params = new URLSearchParams();
    if (options?.archived !== undefined) params.set('archived', String(options.archived));
    const query = params.toString();
    return this.request('GET', `/api/vault/pages/tree${query ? `?${query}` : ''}`);
  }

  async getVaultPageFavorites(): Promise<VaultPage[]> {
    return this.request('GET', '/api/vault/pages/favorites');
  }

  async quickFindVaultPages(query: string, limit?: number): Promise<VaultPage[]> {
    const params = new URLSearchParams({ q: query });
    if (limit) params.set('limit', String(limit));
    return this.request('GET', `/api/vault/pages/quick-find?${params}`);
  }

  async getVaultPage(id: string, includeBlocks = true): Promise<VaultPage & { blocks?: VaultBlock[]; breadcrumbs: VaultPageBreadcrumb[] }> {
    const params = new URLSearchParams();
    if (!includeBlocks) params.set('include_blocks', 'false');
    const query = params.toString();
    return this.request('GET', `/api/vault/pages/${id}${query ? `?${query}` : ''}`);
  }

  async getVaultPageChildren(id: string): Promise<VaultPage[]> {
    return this.request('GET', `/api/vault/pages/${id}/children`);
  }

  async getVaultPageBacklinks(id: string): Promise<Array<{ id: string; title: string; icon: string | null }>> {
    return this.request('GET', `/api/vault/pages/${id}/backlinks`);
  }

  async createVaultPage(input: CreateVaultPageInput): Promise<VaultPage> {
    return this.request('POST', '/api/vault/pages', input);
  }

  async updateVaultPage(id: string, input: UpdateVaultPageInput): Promise<VaultPage> {
    return this.request('PATCH', `/api/vault/pages/${id}`, input);
  }

  async toggleVaultPageFavorite(id: string): Promise<VaultPage> {
    return this.request('POST', `/api/vault/pages/${id}/favorite`);
  }

  async reorderVaultPages(pageIds: string[]): Promise<void> {
    return this.request('POST', '/api/vault/pages/reorder', { pageIds });
  }

  async deleteVaultPage(id: string): Promise<void> {
    return this.request('DELETE', `/api/vault/pages/${id}`);
  }

  // PARA Organization
  async getPARAFolders(): Promise<PARAFolder[]> {
    return this.request('GET', '/api/vault/pages/para/folders');
  }

  async getPARAPages(paraType: PARAType): Promise<VaultPage[]> {
    return this.request('GET', `/api/vault/pages/para/${paraType}`);
  }

  async initializePARA(): Promise<InitializePARAResult> {
    return this.request('POST', '/api/vault/pages/para/initialize');
  }

  async moveToPARA(pageId: string, paraType: PARAType): Promise<VaultPage> {
    return this.request('POST', `/api/vault/pages/${pageId}/move-to-para?paraType=${paraType}`);
  }

  // MBA Classes
  async getMbaClasses(): Promise<MbaClassesResponse> {
    return this.request('GET', '/api/vault/pages/mba-classes');
  }

  async getMbaClassSession(sessionId: string): Promise<MbaClassSessionResponse> {
    return this.request('GET', `/api/vault/pages/mba-classes/${sessionId}`);
  }

  // Vault Blocks
  async getVaultBlocks(pageId: string): Promise<VaultBlock[]> {
    return this.request('GET', `/api/vault/pages/${pageId}/blocks`);
  }

  async getVaultBlock(id: string): Promise<VaultBlock> {
    return this.request('GET', `/api/vault/blocks/${id}`);
  }

  async getVaultBlockChildren(id: string): Promise<VaultBlock[]> {
    return this.request('GET', `/api/vault/blocks/${id}/children`);
  }

  async createVaultBlock(pageId: string, input: CreateVaultBlockInput): Promise<VaultBlock> {
    return this.request('POST', `/api/vault/pages/${pageId}/blocks`, input);
  }

  async updateVaultBlock(id: string, input: UpdateVaultBlockInput): Promise<VaultBlock> {
    return this.request('PATCH', `/api/vault/blocks/${id}`, input);
  }

  async moveVaultBlock(id: string, input: MoveVaultBlockInput): Promise<VaultBlock> {
    return this.request('POST', `/api/vault/blocks/${id}/move`, input);
  }

  async deleteVaultBlock(id: string): Promise<void> {
    return this.request('DELETE', `/api/vault/blocks/${id}`);
  }

  async batchVaultBlocks(pageId: string, operations: BatchBlockOperation[]): Promise<VaultBlock[]> {
    return this.request('POST', `/api/vault/pages/${pageId}/blocks/batch`, { operations });
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

  // Chat
  async chat(message: string): Promise<{ message: string; toolsUsed: string[] }> {
    return this.request('POST', '/api/chat', { message });
  }

  // Health
  async getHealth(): Promise<{ status: string }> {
    return this.request('GET', '/api/health');
  }

  // ============================================
  // Journal / Daily Review
  // ============================================

  async getDailyReviewData(date?: string): Promise<DailyReviewData> {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    const query = params.toString();
    return this.request('GET', `/api/journal/daily-review${query ? `?${query}` : ''}`);
  }

  async saveReviewDraft(input: SaveReviewInput): Promise<DailyReview> {
    return this.request('POST', '/api/journal/daily-review/save', input);
  }

  async completeReview(input: CompleteReviewInput): Promise<{ review: DailyReview; vaultPageId?: string }> {
    return this.request('POST', '/api/journal/daily-review/complete', input);
  }

  async getReviewHistory(page = 1, limit = 20): Promise<{ items: ReviewHistoryItem[]; total: number; page: number; limit: number }> {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    return this.request('GET', `/api/journal/daily-review/history?${params}`);
  }

  async searchReviews(query: string): Promise<ReviewHistoryItem[]> {
    const params = new URLSearchParams({ q: query });
    return this.request('GET', `/api/journal/daily-review/search?${params}`);
  }

  async toggleHabitCompletion(habitId: string, date?: string): Promise<{ completed: boolean; completionId?: string }> {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    const query = params.toString();
    return this.request('POST', `/api/journal/habits/${habitId}/toggle${query ? `?${query}` : ''}`);
  }

  // ============================================
  // Task Archive
  // ============================================

  async getArchivedTasks(context?: string, limit = 50): Promise<ArchivedTask[]> {
    const params = new URLSearchParams();
    if (context) params.set('context', context);
    params.set('limit', String(limit));
    return this.request('GET', `/api/vault?contentType=task_archive&${params}`);
  }

  // ============================================
  // Goals
  // ============================================

  async listGoals(status?: string): Promise<Goal[]> {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    const query = params.toString();
    return this.request('GET', `/api/goals${query ? `?${query}` : ''}`);
  }

  async getGoal(id: string): Promise<Goal> {
    return this.request('GET', `/api/goals/${id}`);
  }

  async searchGoals(query: string, limit = 10): Promise<Goal[]> {
    // Since the goals API may not have a search endpoint, we'll filter locally
    const goals = await this.listGoals('active');
    const queryLower = query.toLowerCase();
    return goals
      .filter(goal => goal.title.toLowerCase().includes(queryLower))
      .slice(0, limit);
  }

  // ============================================
  // Quick Search for Entity Linking
  // ============================================

  async quickSearchTasks(query: string, limit = 10): Promise<Task[]> {
    // Get active tasks and filter by query
    const tasks = await this.listTasks({ status: 'today' });
    const inboxTasks = await this.getInboxTasks();
    const allTasks = [...tasks, ...inboxTasks];
    const queryLower = query.toLowerCase();
    return allTasks
      .filter(task => task.title.toLowerCase().includes(queryLower))
      .slice(0, limit);
  }

  // ============================================
  // MBA Classes
  // ============================================

  async listClasses(): Promise<ClassSummary[]> {
    return this.request('GET', '/api/classes');
  }

  async getClass(code: string): Promise<ClassDetails> {
    return this.request('GET', `/api/classes/${code}`);
  }

  async getClassDayContent(code: string, date: string): Promise<ClassDayContent> {
    return this.request('GET', `/api/classes/${code}/${date}`);
  }

  async combineClassNotes(code: string, date: string): Promise<{ vaultPageId: string }> {
    return this.request('POST', `/api/classes/${code}/${date}/combine`);
  }

  async combineAllPendingClassNotes(): Promise<{ merged: number; errors: string[] }> {
    return this.request('POST', '/api/classes/combine-all');
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
  Goal,
  VaultEntry,
  VaultTreeNode,
  VaultBreadcrumb,
  VaultAttachment,
  CalendarEvent,
  VaultPage,
  VaultPageTreeNode,
  VaultPageBreadcrumb,
  CreateVaultPageInput,
  UpdateVaultPageInput,
  VaultBlock,
  CreateVaultBlockInput,
  UpdateVaultBlockInput,
  MoveVaultBlockInput,
  BatchBlockOperation,
  DailyReviewData,
  DailyReview,
  SaveReviewInput,
  CompleteReviewInput,
  ReviewHistoryItem,
  ArchivedTask,
  PARAType,
  PARAFolder,
  InitializePARAResult,
  ClassSummary,
  ClassDetails,
  ClassDayContent,
};

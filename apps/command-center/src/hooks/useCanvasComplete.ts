/**
 * Canvas Complete Hooks
 *
 * React Query hooks for Canvas Complete Phase 1 features:
 * - Enhanced assignment details
 * - Homework dashboard data
 * - Subtask management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================
// Types
// ============================================

export interface RubricCriterion {
  id: string;
  criterion: string;
  description: string | null;
  points: number;
  ratings: Array<{ description: string; points: number }>;
}

export interface AssignmentSubtask {
  id: string;
  canvasItemId: string;
  taskId: string | null;
  title: string;
  subtaskType: string | null;
  sortOrder: number;
  isCompleted: boolean;
  completedAt: string | null;
  generatedBy: string;
  createdAt: string;
}

export interface CanvasAssignmentFull {
  id: string;
  canvasId: string;
  title: string;
  courseName: string;
  url: string | null;

  // Dates
  dueAt: string | null;
  availableFrom: string | null;
  availableUntil: string | null;

  // Academic details
  pointsPossible: number | null;
  gradingType: string | null;
  submissionTypes: string[] | null;
  allowedExtensions: string[] | null;

  // Canvas Complete enhanced fields
  instructions: string | null;
  instructionsHtml: string | null;
  rubric: RubricCriterion[] | null;
  totalRubricPoints: number | null;
  wordCountMin: number | null;
  wordCountMax: number | null;
  isGroupAssignment: boolean;
  hasPeerReview: boolean;
  estimatedMinutes: number | null;
  lockInfo: Record<string, unknown> | null;

  // Related data
  taskId: string | null;
  projectId: string | null;
  vaultPageId: string | null;
  subtasks: AssignmentSubtask[];

  // Metadata
  syncStatus: string;
  lastVerifiedAt: string | null;
}

export interface HomeworkItem {
  id: string;
  title: string;
  courseName: string;
  dueAt: string | null;
  pointsPossible: number | null;
  estimatedMinutes: number | null;
  taskId: string | null;
  hasRubric: boolean;
  hasInstructions: boolean;
}

export interface HomeworkDashboard {
  dueToday: HomeworkItem[];
  dueThisWeek: HomeworkItem[];
  summary: {
    dueTodayCount: number;
    dueThisWeekCount: number;
    totalEstimatedMinutes: number;
    totalEstimatedHours: number;
  };
}

// ============================================
// API Functions
// ============================================

async function fetchCanvasAssignmentByTask(taskId: string): Promise<CanvasAssignmentFull | null> {
  // First get the canvas item for this task
  const response = await fetch(`/api/canvas-integrity/by-task/${taskId}`);
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error('Failed to fetch canvas item');
  }
  const result = await response.json();
  if (!result.success) return null;

  // Then get full details
  const fullResponse = await fetch(`/api/canvas-integrity/assignments/${result.data.id}/full`);
  if (!fullResponse.ok) return null;
  const fullResult = await fullResponse.json();
  return fullResult.data;
}

async function fetchCanvasAssignment(canvasItemId: string): Promise<CanvasAssignmentFull | null> {
  const response = await fetch(`/api/canvas-integrity/assignments/${canvasItemId}/full`);
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error('Failed to fetch canvas assignment');
  }
  const result = await response.json();
  return result.data;
}

async function fetchHomeworkDashboard(): Promise<HomeworkDashboard> {
  const response = await fetch('/api/canvas-integrity/homework');
  if (!response.ok) {
    throw new Error('Failed to fetch homework dashboard');
  }
  const result = await response.json();
  return result.data;
}

async function fetchAssignmentSubtasks(canvasItemId: string): Promise<AssignmentSubtask[]> {
  const response = await fetch(`/api/canvas-integrity/assignments/${canvasItemId}/subtasks`);
  if (!response.ok) {
    throw new Error('Failed to fetch subtasks');
  }
  const result = await response.json();
  return result.data;
}

async function createSubtask(canvasItemId: string, data: { title: string; subtaskType?: string }): Promise<AssignmentSubtask> {
  const response = await fetch(`/api/canvas-integrity/assignments/${canvasItemId}/subtasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to create subtask');
  }
  const result = await response.json();
  return result.data;
}

async function updateSubtask(subtaskId: string, data: Partial<AssignmentSubtask>): Promise<AssignmentSubtask> {
  const response = await fetch(`/api/canvas-integrity/subtasks/${subtaskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error('Failed to update subtask');
  }
  const result = await response.json();
  return result.data;
}

async function deleteSubtask(subtaskId: string): Promise<void> {
  const response = await fetch(`/api/canvas-integrity/subtasks/${subtaskId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete subtask');
  }
}

// ============================================
// Hooks
// ============================================

/**
 * Get full Canvas assignment details by task ID
 */
export function useCanvasAssignmentByTask(taskId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['canvas-assignment-by-task', taskId],
    queryFn: () => fetchCanvasAssignmentByTask(taskId!),
    enabled: options?.enabled !== false && !!taskId,
    staleTime: 30000,
  });
}

/**
 * Get full Canvas assignment details by canvas item ID
 */
export function useCanvasAssignment(canvasItemId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['canvas-assignment', canvasItemId],
    queryFn: () => fetchCanvasAssignment(canvasItemId!),
    enabled: options?.enabled !== false && !!canvasItemId,
    staleTime: 30000,
  });
}

/**
 * Get homework dashboard data (due today, due this week)
 */
export function useHomeworkDashboard() {
  return useQuery({
    queryKey: ['homework-dashboard'],
    queryFn: fetchHomeworkDashboard,
    staleTime: 60000, // 1 minute
    refetchInterval: 300000, // Refresh every 5 minutes
  });
}

/**
 * Get subtasks for an assignment
 */
export function useAssignmentSubtasks(canvasItemId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['assignment-subtasks', canvasItemId],
    queryFn: () => fetchAssignmentSubtasks(canvasItemId!),
    enabled: options?.enabled !== false && !!canvasItemId,
    staleTime: 30000,
  });
}

/**
 * Create a new subtask
 */
export function useCreateSubtask(canvasItemId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { title: string; subtaskType?: string }) => createSubtask(canvasItemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-subtasks', canvasItemId] });
      queryClient.invalidateQueries({ queryKey: ['canvas-assignment', canvasItemId] });
      queryClient.invalidateQueries({ queryKey: ['canvas-assignment-by-task'] });
    },
  });
}

/**
 * Update a subtask (including toggling completion)
 */
export function useUpdateSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ subtaskId, data }: { subtaskId: string; data: Partial<AssignmentSubtask> }) =>
      updateSubtask(subtaskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-subtasks'] });
      queryClient.invalidateQueries({ queryKey: ['canvas-assignment'] });
      queryClient.invalidateQueries({ queryKey: ['canvas-assignment-by-task'] });
    },
  });
}

/**
 * Toggle subtask completion
 */
export function useToggleSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ subtaskId, isCompleted }: { subtaskId: string; isCompleted: boolean }) =>
      updateSubtask(subtaskId, { isCompleted, completedAt: isCompleted ? new Date().toISOString() : null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-subtasks'] });
      queryClient.invalidateQueries({ queryKey: ['canvas-assignment'] });
      queryClient.invalidateQueries({ queryKey: ['canvas-assignment-by-task'] });
    },
  });
}

/**
 * Delete a subtask
 */
export function useDeleteSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (subtaskId: string) => deleteSubtask(subtaskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-subtasks'] });
      queryClient.invalidateQueries({ queryKey: ['canvas-assignment'] });
      queryClient.invalidateQueries({ queryKey: ['canvas-assignment-by-task'] });
    },
  });
}

// ============================================
// Phase 3: Assignment Page Hooks
// ============================================

export interface AssignmentPage {
  id: string;
  canvasItemId: string;
  vaultPageId: string;
  instructionsSnapshot: string | null;
  rubricSnapshot: unknown;
  userNotes: string | null;
  submissionDraftPath: string | null;
  createdAt: string;
  updatedAt: string;
}

async function fetchAssignmentPage(canvasItemId: string): Promise<AssignmentPage | null> {
  const response = await fetch(`/api/canvas-integrity/assignments/${canvasItemId}/page`);
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error('Failed to fetch assignment page');
  }
  const result = await response.json();
  return result.data;
}

async function fetchAssignmentPageByTask(taskId: string): Promise<AssignmentPage | null> {
  const response = await fetch(`/api/canvas-integrity/by-task/${taskId}/page`);
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error('Failed to fetch assignment page');
  }
  const result = await response.json();
  return result.data;
}

async function createAssignmentPage(canvasItemId: string, parentPageId?: string): Promise<{
  pageId: string;
  assignmentPageId: string;
  alreadyExisted: boolean;
}> {
  const response = await fetch(`/api/canvas-integrity/assignments/${canvasItemId}/create-page`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parentPageId }),
  });
  if (!response.ok) throw new Error('Failed to create assignment page');
  const result = await response.json();
  return result.data;
}

async function getOrCreateAssignmentPage(canvasItemId: string): Promise<AssignmentPage> {
  const response = await fetch(`/api/canvas-integrity/assignments/${canvasItemId}/page-or-create`);
  if (!response.ok) throw new Error('Failed to get/create assignment page');
  const result = await response.json();
  return result.data;
}

async function updateAssignmentNotes(assignmentPageId: string, notes: string): Promise<void> {
  const response = await fetch(`/api/canvas-integrity/assignment-pages/${assignmentPageId}/notes`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  });
  if (!response.ok) throw new Error('Failed to update notes');
}

/**
 * Get assignment page by canvas item ID
 */
export function useAssignmentPage(canvasItemId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['assignment-page', canvasItemId],
    queryFn: () => fetchAssignmentPage(canvasItemId!),
    enabled: options?.enabled !== false && !!canvasItemId,
    staleTime: 30000,
  });
}

/**
 * Get assignment page by task ID
 */
export function useAssignmentPageByTask(taskId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['assignment-page-by-task', taskId],
    queryFn: () => fetchAssignmentPageByTask(taskId!),
    enabled: options?.enabled !== false && !!taskId,
    staleTime: 30000,
  });
}

/**
 * Create an assignment page
 */
export function useCreateAssignmentPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ canvasItemId, parentPageId }: { canvasItemId: string; parentPageId?: string }) =>
      createAssignmentPage(canvasItemId, parentPageId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['assignment-page', variables.canvasItemId] });
      queryClient.invalidateQueries({ queryKey: ['canvas-assignment', variables.canvasItemId] });
    },
  });
}

/**
 * Get or create an assignment page (lazy creation)
 */
export function useGetOrCreateAssignmentPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (canvasItemId: string) => getOrCreateAssignmentPage(canvasItemId),
    onSuccess: (_, canvasItemId) => {
      queryClient.invalidateQueries({ queryKey: ['assignment-page', canvasItemId] });
    },
  });
}

/**
 * Update notes on an assignment page
 */
export function useUpdateAssignmentNotes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ assignmentPageId, notes }: { assignmentPageId: string; notes: string }) =>
      updateAssignmentNotes(assignmentPageId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-page'] });
      queryClient.invalidateQueries({ queryKey: ['assignment-page-by-task'] });
    },
  });
}

// ============================================
// Phase 5: Submission Hooks
// ============================================

export interface SubmissionStatus {
  canvasItemId: string;
  hasSubmission: boolean;
  submissionType: string | null;
  submittedAt: string | null;
  attempt: number;
  grade: string | null;
  score: number | null;
  late: boolean;
  missing: boolean;
  workflowState: string;
  comments: Array<{
    id: number;
    author_id: number;
    author_name: string;
    comment: string;
    created_at: string;
  }>;
  attachments: Array<{
    id: number;
    display_name: string;
    filename: string;
    url: string;
    size: number;
  }>;
}

export interface CanSubmitResult {
  allowed: boolean;
  reason?: string;
  submissionTypes: string[];
  allowedExtensions: string[];
}

export interface SubmissionResult {
  submissionId: number;
  attempt: number;
  submittedAt: string;
}

async function fetchSubmissionStatus(canvasItemId: string): Promise<SubmissionStatus | null> {
  const response = await fetch(`/api/canvas-integrity/assignments/${canvasItemId}/submission`);
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error('Failed to fetch submission status');
  }
  const result = await response.json();
  return result.data;
}

async function fetchCanSubmit(canvasItemId: string): Promise<CanSubmitResult> {
  const response = await fetch(`/api/canvas-integrity/assignments/${canvasItemId}/submission/can-submit`);
  if (!response.ok) throw new Error('Failed to check submission eligibility');
  const result = await response.json();
  return result.data;
}

async function submitText(canvasItemId: string, textBody: string): Promise<SubmissionResult> {
  const response = await fetch(`/api/canvas-integrity/assignments/${canvasItemId}/submit/text`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ textBody }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to submit text');
  }
  const result = await response.json();
  return result.data;
}

async function submitUrl(canvasItemId: string, url: string): Promise<SubmissionResult> {
  const response = await fetch(`/api/canvas-integrity/assignments/${canvasItemId}/submit/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to submit URL');
  }
  const result = await response.json();
  return result.data;
}

async function submitFile(canvasItemId: string, filePath: string, fileName?: string): Promise<SubmissionResult> {
  const response = await fetch(`/api/canvas-integrity/assignments/${canvasItemId}/submit/file`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath, fileName }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to submit file');
  }
  const result = await response.json();
  return result.data;
}

/**
 * Get current submission status for an assignment
 */
export function useSubmissionStatus(canvasItemId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['submission-status', canvasItemId],
    queryFn: () => fetchSubmissionStatus(canvasItemId!),
    enabled: options?.enabled !== false && !!canvasItemId,
    staleTime: 30000,
  });
}

/**
 * Check if submission is allowed for an assignment
 */
export function useCanSubmit(canvasItemId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['can-submit', canvasItemId],
    queryFn: () => fetchCanSubmit(canvasItemId!),
    enabled: options?.enabled !== false && !!canvasItemId,
    staleTime: 60000,
  });
}

/**
 * Submit text entry to Canvas
 */
export function useSubmitText() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ canvasItemId, textBody }: { canvasItemId: string; textBody: string }) =>
      submitText(canvasItemId, textBody),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['submission-status', variables.canvasItemId] });
      queryClient.invalidateQueries({ queryKey: ['canvas-assignment', variables.canvasItemId] });
      queryClient.invalidateQueries({ queryKey: ['homework-hub'] });
    },
  });
}

/**
 * Submit URL to Canvas
 */
export function useSubmitUrl() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ canvasItemId, url }: { canvasItemId: string; url: string }) =>
      submitUrl(canvasItemId, url),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['submission-status', variables.canvasItemId] });
      queryClient.invalidateQueries({ queryKey: ['canvas-assignment', variables.canvasItemId] });
      queryClient.invalidateQueries({ queryKey: ['homework-hub'] });
    },
  });
}

/**
 * Submit file to Canvas
 */
export function useSubmitFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ canvasItemId, filePath, fileName }: { canvasItemId: string; filePath: string; fileName?: string }) =>
      submitFile(canvasItemId, filePath, fileName),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['submission-status', variables.canvasItemId] });
      queryClient.invalidateQueries({ queryKey: ['canvas-assignment', variables.canvasItemId] });
      queryClient.invalidateQueries({ queryKey: ['homework-hub'] });
    },
  });
}

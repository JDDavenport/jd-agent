/**
 * Canvas Materials Hooks
 *
 * React Query hooks for Canvas Complete Phase 2:
 * - Course materials browsing
 * - Reading progress tracking
 * - Material downloads
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================
// Types
// ============================================

export interface CanvasMaterial {
  id: string;
  canvasItemId: string | null;
  canvasFileId: string | null;
  courseId: string;
  fileName: string;
  displayName: string | null;
  fileType: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  localPath: string | null;
  downloadUrl: string | null;
  canvasUrl: string | null;
  moduleName: string | null;
  modulePosition: number | null;
  materialType: string | null;
  pageCount: number | null;
  extractedText: string | null;
  aiSummary: string | null;
  vaultPageId: string | null;
  readStatus: 'unread' | 'in_progress' | 'completed';
  readProgress: number;
  lastReadAt: string | null;
  relatedAssignmentIds: string[] | null;
  downloadedAt: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialsFilter {
  courseId?: string;
  fileType?: string;
  materialType?: string;
  readStatus?: 'unread' | 'in_progress' | 'completed';
}

export interface ReadingProgress {
  readStatus: 'unread' | 'in_progress' | 'completed';
  readProgress: number;
}

export interface GroupedMaterials {
  [moduleName: string]: CanvasMaterial[];
}

export interface UnreadCounts {
  [courseId: string]: number;
}

// ============================================
// API Functions
// ============================================

async function fetchMaterials(filter?: MaterialsFilter): Promise<CanvasMaterial[]> {
  const params = new URLSearchParams();
  if (filter?.courseId) params.set('courseId', filter.courseId);
  if (filter?.fileType) params.set('fileType', filter.fileType);
  if (filter?.materialType) params.set('materialType', filter.materialType);
  if (filter?.readStatus) params.set('readStatus', filter.readStatus);

  const url = `/api/canvas-materials${params.toString() ? `?${params.toString()}` : ''}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch materials');
  const result = await response.json();
  return result.data;
}

async function fetchMaterialsByCourse(courseId: string): Promise<GroupedMaterials> {
  const response = await fetch(`/api/canvas-materials/by-course/${courseId}`);
  if (!response.ok) throw new Error('Failed to fetch materials for course');
  const result = await response.json();
  return result.data;
}

async function fetchMaterial(id: string): Promise<CanvasMaterial> {
  const response = await fetch(`/api/canvas-materials/${id}`);
  if (!response.ok) throw new Error('Failed to fetch material');
  const result = await response.json();
  return result.data;
}

async function fetchReadings(courseId?: string): Promise<CanvasMaterial[]> {
  const url = courseId
    ? `/api/canvas-materials/readings?courseId=${courseId}`
    : '/api/canvas-materials/readings';
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch readings');
  const result = await response.json();
  return result.data;
}

async function fetchUnreadCounts(): Promise<UnreadCounts> {
  const response = await fetch('/api/canvas-materials/unread-counts');
  if (!response.ok) throw new Error('Failed to fetch unread counts');
  const result = await response.json();
  return result.data;
}

async function fetchMaterialsForAssignment(canvasItemId: string): Promise<CanvasMaterial[]> {
  const response = await fetch(`/api/canvas-materials/for-assignment/${canvasItemId}`);
  if (!response.ok) throw new Error('Failed to fetch materials for assignment');
  const result = await response.json();
  return result.data;
}

async function updateReadingProgress(id: string, progress: ReadingProgress): Promise<CanvasMaterial> {
  const response = await fetch(`/api/canvas-materials/${id}/progress`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(progress),
  });
  if (!response.ok) throw new Error('Failed to update reading progress');
  const result = await response.json();
  return result.data;
}

async function syncCourseMaterials(canvasCourseId: number, courseId: string, courseCode: string): Promise<{ filesAdded: number; moduleFilesAdded: number; totalAdded: number }> {
  const response = await fetch(`/api/canvas-materials/sync/${canvasCourseId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courseId, courseCode }),
  });
  if (!response.ok) throw new Error('Failed to sync materials');
  const result = await response.json();
  return result.data;
}

// ============================================
// Hooks
// ============================================

/**
 * Get all materials with optional filters
 */
export function useCanvasMaterials(filter?: MaterialsFilter) {
  return useQuery({
    queryKey: ['canvas-materials', filter],
    queryFn: () => fetchMaterials(filter),
    staleTime: 60000, // 1 minute
  });
}

/**
 * Get materials for a course grouped by module
 */
export function useCourseMaterials(courseId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['canvas-materials-by-course', courseId],
    queryFn: () => fetchMaterialsByCourse(courseId!),
    enabled: options?.enabled !== false && !!courseId,
    staleTime: 60000,
  });
}

/**
 * Get a single material by ID
 */
export function useCanvasMaterial(id: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['canvas-material', id],
    queryFn: () => fetchMaterial(id!),
    enabled: options?.enabled !== false && !!id,
    staleTime: 30000,
  });
}

/**
 * Get reading list (optionally filtered by course)
 */
export function useReadingList(courseId?: string) {
  return useQuery({
    queryKey: ['canvas-readings', courseId],
    queryFn: () => fetchReadings(courseId),
    staleTime: 60000,
  });
}

/**
 * Get unread material counts per course
 */
export function useUnreadCounts() {
  return useQuery({
    queryKey: ['canvas-materials-unread-counts'],
    queryFn: fetchUnreadCounts,
    staleTime: 60000,
    refetchInterval: 300000, // Refresh every 5 minutes
  });
}

/**
 * Get materials related to an assignment
 */
export function useAssignmentMaterials(canvasItemId: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['canvas-materials-for-assignment', canvasItemId],
    queryFn: () => fetchMaterialsForAssignment(canvasItemId!),
    enabled: options?.enabled !== false && !!canvasItemId,
    staleTime: 30000,
  });
}

/**
 * Update reading progress for a material
 */
export function useUpdateReadingProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, progress }: { id: string; progress: ReadingProgress }) =>
      updateReadingProgress(id, progress),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['canvas-material', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['canvas-materials'] });
      queryClient.invalidateQueries({ queryKey: ['canvas-materials-by-course'] });
      queryClient.invalidateQueries({ queryKey: ['canvas-readings'] });
      queryClient.invalidateQueries({ queryKey: ['canvas-materials-unread-counts'] });
    },
  });
}

/**
 * Mark a material as started (reading in progress)
 */
export function useMarkAsStarted() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      updateReadingProgress(id, { readStatus: 'in_progress', readProgress: 0 }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['canvas-material', id] });
      queryClient.invalidateQueries({ queryKey: ['canvas-materials'] });
      queryClient.invalidateQueries({ queryKey: ['canvas-materials-unread-counts'] });
    },
  });
}

/**
 * Mark a material as completed
 */
export function useMarkAsCompleted() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      updateReadingProgress(id, { readStatus: 'completed', readProgress: 100 }),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['canvas-material', id] });
      queryClient.invalidateQueries({ queryKey: ['canvas-materials'] });
      queryClient.invalidateQueries({ queryKey: ['canvas-materials-unread-counts'] });
    },
  });
}

/**
 * Sync materials from Canvas for a course
 */
export function useSyncCourseMaterials() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ canvasCourseId, courseId, courseCode }: { canvasCourseId: number; courseId: string; courseCode: string }) =>
      syncCourseMaterials(canvasCourseId, courseId, courseCode),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['canvas-materials'] });
      queryClient.invalidateQueries({ queryKey: ['canvas-materials-by-course', variables.courseId] });
      queryClient.invalidateQueries({ queryKey: ['canvas-materials-unread-counts'] });
    },
  });
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get file type icon based on material type
 */
export function getMaterialIcon(fileType: string): string {
  switch (fileType.toLowerCase()) {
    case 'pdf':
      return '📄';
    case 'pptx':
    case 'ppt':
      return '📊';
    case 'docx':
    case 'doc':
      return '📝';
    case 'xlsx':
    case 'xls':
      return '📈';
    case 'url':
      return '🔗';
    default:
      return '📎';
  }
}

/**
 * Get readable status label
 */
export function getStatusLabel(status: string): string {
  switch (status) {
    case 'unread':
      return 'Unread';
    case 'in_progress':
      return 'In Progress';
    case 'completed':
      return 'Completed';
    default:
      return status;
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Canvas API client for onboarding + sync
 * Uses Better Auth cookies for authentication (credentials: 'include')
 */

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

async function fetchCanvas<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });
  const json: ApiResponse<T> = await response.json();
  if (!json.success) {
    throw new Error(json.error?.message || 'Request failed');
  }
  return json.data as T;
}

// ============================================
// Types
// ============================================

export interface CanvasProfile {
  id: number;
  name: string;
  avatarUrl?: string;
}

export interface CanvasCoursePreview {
  id: string;
  name: string;
  code: string;
  state: string;
}

export interface ConnectResult {
  profile: CanvasProfile;
  courses: CanvasCoursePreview[];
}

export interface CanvasStatus {
  connected: boolean;
  canvasUserId: string | null;
  lastSyncAt: string | null;
  institution: {
    name: string;
    shortName: string;
    canvasBaseUrl: string;
  } | null;
}

export interface SyncStatusResult {
  connected: boolean;
  lastSyncAt: string | null;
  coursesCount: number;
  courses: Array<{
    name: string;
    code: string | null;
    lastSync: string | null;
  }>;
}

export interface SyncResult {
  courses: number;
  assignments: number;
  modules: number;
  pages: number;
  files: number;
  discussions: number;
  quizzes: number;
  announcements: number;
  errors: string[];
}

export interface UserCourse {
  id: string;
  canvasCourseId: string;
  courseName: string;
  courseCode: string | null;
  term: string | null;
  isPinned: boolean;
  lastContentSyncAt: string | null;
}

// ============================================
// API Functions
// ============================================

export async function connectCanvas(canvasUrl: string, canvasToken: string): Promise<ConnectResult> {
  return fetchCanvas<ConnectResult>(`${API_BASE}/canvas/connect`, {
    method: 'POST',
    body: JSON.stringify({ canvasUrl, canvasToken }),
  });
}

export async function getCanvasStatus(): Promise<CanvasStatus> {
  return fetchCanvas<CanvasStatus>(`${API_BASE}/canvas/status`);
}

export async function getCanvasCourses(): Promise<{ courses: UserCourse[] }> {
  return fetchCanvas<{ courses: UserCourse[] }>(`${API_BASE}/canvas/courses`);
}

export async function triggerSync(courseIds?: string[]): Promise<SyncResult> {
  return fetchCanvas<SyncResult>(`${API_BASE}/canvas/sync`, {
    method: 'POST',
    body: JSON.stringify({ courseIds }),
  });
}

export async function getSyncStatus(): Promise<SyncStatusResult> {
  return fetchCanvas<SyncStatusResult>(`${API_BASE}/canvas/sync/status`);
}

export async function disconnectCanvas(): Promise<void> {
  await fetchCanvas(`${API_BASE}/canvas/disconnect`, { method: 'DELETE' });
}

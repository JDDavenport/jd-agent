import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Get API URL from environment or use relative path for same-origin
const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    const baseUrl = import.meta.env.VITE_API_URL;
    if (baseUrl.endsWith('/api')) {
      return baseUrl;
    }
    return baseUrl.replace(/\/$/, '') + '/api';
  }
  return '/api';
};

const API_BASE = `${getApiBaseUrl()}/canvas-integrity`;

// Types
interface CanvasItem {
  id: string;
  canvasId: string;
  canvasType: 'assignment' | 'quiz' | 'discussion' | 'announcement' | 'module_item';
  courseId?: string;
  courseName: string;
  title: string;
  description?: string;
  url?: string;
  dueAt?: string;
  pointsPossible?: number;
  syncStatus: 'pending' | 'synced' | 'mismatch' | 'orphaned';
  taskId?: string;
  projectId?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface ClassMapping {
  id: string;
  canvasCourseId: string;
  canvasCourseName: string;
  canvasCourseCode?: string;
  projectId: string;
  professorName?: string;
  semester?: string;
  isActive: boolean;
  createdAt: string;
}

interface IntegrityStatus {
  totalItems: number;
  syncedItems: number;
  pendingItems: number;
  mismatchItems: number;
  orphanedItems: number;
  lastAuditAt?: string;
  lastAuditType?: string;
  lastAuditDuration?: number;
  upcomingAssignments: number;
  overdueAssignments: number;
}

interface AuditResult {
  id: string;
  auditType: 'full' | 'incremental' | 'quick';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  itemsChecked: number;
  itemsCreated: number;
  itemsUpdated: number;
  errors: string[];
}

// Fetch helpers
async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || 'Request failed');
  }
  return res.json();
}

// Hooks
interface ApiStatusResponse {
  items: {
    total: string;
    synced: string;
    pending: string;
    mismatch: string;
    orphaned: string;
  };
  syncPercentage: number;
  integrityScore: number | null;
  lastAuditAt: string | null;
  lastAuditStatus: string | null;
  unscheduledCount: number;
  activeCourses: number;
}

export function useCanvasStatus() {
  return useQuery({
    queryKey: ['canvas-integrity', 'status'],
    queryFn: async () => {
      const data = await fetchJson<{ success: boolean; data: ApiStatusResponse }>(`${API_BASE}/status`);
      const apiData = data.data;
      // Transform API response to match UI interface
      return {
        totalItems: parseInt(apiData.items.total) || 0,
        syncedItems: parseInt(apiData.items.synced) || 0,
        pendingItems: parseInt(apiData.items.pending) || 0,
        mismatchItems: parseInt(apiData.items.mismatch) || 0,
        orphanedItems: parseInt(apiData.items.orphaned) || 0,
        lastAuditAt: apiData.lastAuditAt,
        lastAuditType: apiData.lastAuditStatus,
        upcomingAssignments: apiData.unscheduledCount || 0,
        overdueAssignments: 0,
      } as IntegrityStatus;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

export function useCanvasItems(filters?: { courseId?: string; type?: string; syncStatus?: string }) {
  const params = new URLSearchParams();
  if (filters?.courseId) params.set('courseId', filters.courseId);
  if (filters?.type) params.set('type', filters.type);
  if (filters?.syncStatus) params.set('syncStatus', filters.syncStatus);

  return useQuery({
    queryKey: ['canvas-integrity', 'items', filters],
    queryFn: async () => {
      const url = `${API_BASE}/items${params.toString() ? `?${params}` : ''}`;
      const data = await fetchJson<{ success: boolean; data: CanvasItem[] }>(url);
      return data.data;
    },
  });
}

export function useClassMappings() {
  return useQuery({
    queryKey: ['canvas-integrity', 'mappings'],
    queryFn: async () => {
      const data = await fetchJson<{ success: boolean; data: ClassMapping[] }>(`${API_BASE}/mappings`);
      return data.data;
    },
  });
}

export function useAuditHistory(limit = 10) {
  return useQuery({
    queryKey: ['canvas-integrity', 'audits', limit],
    queryFn: async () => {
      const data = await fetchJson<{ success: boolean; data: AuditResult[] }>(`${API_BASE}/audits?limit=${limit}`);
      return data.data;
    },
  });
}

export function useUnscheduledItems() {
  return useQuery({
    queryKey: ['canvas-integrity', 'unscheduled'],
    queryFn: async () => {
      const data = await fetchJson<{ success: boolean; data: CanvasItem[] }>(`${API_BASE}/unscheduled`);
      return data.data;
    },
  });
}

export function useTriggerAudit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (auditType: 'full' | 'incremental' | 'quick') => {
      return fetchJson<{ success: boolean; data: AuditResult }>(`${API_BASE}/audit`, {
        method: 'POST',
        body: JSON.stringify({ auditType }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canvas-integrity'] });
    },
  });
}

export function useVerifyItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      return fetchJson<{ success: boolean }>(`${API_BASE}/items/${itemId}/verify`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canvas-integrity', 'items'] });
      queryClient.invalidateQueries({ queryKey: ['canvas-integrity', 'status'] });
    },
  });
}

export function useSendNudge() {
  return useMutation({
    mutationFn: async () => {
      return fetchJson<{ success: boolean; message: string }>(`${API_BASE}/nudge`, {
        method: 'POST',
      });
    },
  });
}

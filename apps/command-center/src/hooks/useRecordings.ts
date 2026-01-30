import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Recording {
  id: string;
  filePath: string;
  originalFilename: string | null;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
  recordingType: string;
  context: string | null;
  status: string;
  recordedAt: string | null;
  uploadedAt: string;
  processedAt: string | null;
  errorMessage: string | null;
  hasTranscript: boolean;
}

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker?: number;
}

interface Transcript {
  id: string;
  fullText: string;
  segments: TranscriptSegment[] | null;
  wordCount: number | null;
  speakerCount: number | null;
  confidenceScore: number | null;
  speakerLabels: Record<number, string>;
  // AI-generated analysis
  summary?: RecordingSummary | null;
  extractedTasks?: ExtractedTask[] | null;
  analyzedAt?: string | null;
}

interface RecordingWithTranscript extends Recording {
  transcript: Transcript | null;
}

interface RecordingsResponse {
  success: boolean;
  data: Recording[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface RecordingDetailResponse {
  success: boolean;
  data: RecordingWithTranscript;
}

interface AudioUrlResponse {
  success: boolean;
  data: {
    url: string;
    expiresIn: number;
  };
}

interface RecordingStats {
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  totalDurationSeconds: number;
  recentCount: number;
}

interface StatsResponse {
  success: boolean;
  data: RecordingStats;
}

// Fetch recordings list
export function useRecordings(options?: {
  limit?: number;
  offset?: number;
  status?: string;
  type?: string;
}) {
  const { limit = 20, offset = 0, status, type } = options || {};

  return useQuery({
    queryKey: ['recordings', { limit, offset, status, type }],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      params.set('offset', String(offset));
      if (status) params.set('status', status);
      if (type) params.set('type', type);

      const response = await fetch(`${API_URL}/api/recordings?${params}`);
      if (!response.ok) throw new Error('Failed to fetch recordings');
      const data: RecordingsResponse = await response.json();
      return data;
    },
  });
}

// Fetch single recording with transcript
export function useRecording(id: string | null) {
  return useQuery({
    queryKey: ['recording', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await fetch(`${API_URL}/api/recordings/${id}`);
      if (!response.ok) throw new Error('Failed to fetch recording');
      const data: RecordingDetailResponse = await response.json();
      return data.data;
    },
    enabled: !!id,
  });
}

// Get audio URL
export function useAudioUrl(id: string | null) {
  return useQuery({
    queryKey: ['recording-audio', id],
    queryFn: async () => {
      if (!id) return null;
      const response = await fetch(`${API_URL}/api/recordings/${id}/audio-url`);
      if (!response.ok) throw new Error('Failed to get audio URL');
      const data: AudioUrlResponse = await response.json();
      // Handle relative URLs by prepending API base
      let url = data.data.url;
      if (url.startsWith('/api/')) {
        url = `${API_URL}${url}`;
      }
      return { ...data.data, url };
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 30, // 30 minutes (URL valid for 1 hour)
  });
}

// Get recording stats
export function useRecordingStats() {
  return useQuery({
    queryKey: ['recording-stats'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/recordings/stats/summary`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data: StatsResponse = await response.json();
      return data.data;
    },
  });
}

// Update speaker label
export function useUpdateSpeaker() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      recordingId,
      deepgramSpeakerId,
      speakerName,
    }: {
      recordingId: string;
      deepgramSpeakerId: number;
      speakerName: string;
    }) => {
      const response = await fetch(`${API_URL}/api/recordings/${recordingId}/speakers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deepgramSpeakerId, speakerName }),
      });
      if (!response.ok) throw new Error('Failed to update speaker');
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recording', variables.recordingId] });
    },
  });
}

// Reprocess recording
export function useReprocessRecording() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recordingId: string) => {
      const response = await fetch(`${API_URL}/api/recordings/${recordingId}/reprocess`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to reprocess recording');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recordings'] });
      queryClient.invalidateQueries({ queryKey: ['recording-stats'] });
    },
  });
}

// Trigger sync
export function useSyncRecordings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_URL}/api/ingestion/plaud/sync`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to sync recordings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recordings'] });
      queryClient.invalidateQueries({ queryKey: ['recording-stats'] });
    },
  });
}

// Format duration
export function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Format file size
export function formatFileSize(bytes: number | null): string {
  if (!bytes) return '--';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================
// Analysis Types
// ============================================

export interface ExtractedTask {
  title: string;
  description?: string;
  assignee?: string;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
  context: string;
}

export interface RecordingSummary {
  overview: string;
  keyPoints: string[];
  participants?: string[];
  topics?: string[];
}

export interface RecordingAnalysis {
  summary: RecordingSummary;
  extractedTasks: ExtractedTask[];
  analyzedAt: string;
}

// ============================================
// Analysis Hooks
// ============================================

// Analyze recording (generate summary + extract tasks)
export function useAnalyzeRecording() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recordingId: string) => {
      const response = await fetch(`${API_URL}/api/recordings/${recordingId}/analyze`, {
        method: 'POST',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to analyze recording');
      }
      const data = await response.json();
      return data.data as RecordingAnalysis;
    },
    onSuccess: (_, recordingId) => {
      queryClient.invalidateQueries({ queryKey: ['recording', recordingId] });
    },
  });
}

// Export tasks to task system
export function useExportTasks() {
  return useMutation({
    mutationFn: async ({
      recordingId,
      tasks,
    }: {
      recordingId: string;
      tasks: Array<{
        title: string;
        description?: string;
        priority?: 'low' | 'medium' | 'high';
        dueDate?: string;
      }>;
    }) => {
      const response = await fetch(`${API_URL}/api/recordings/${recordingId}/export-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to export tasks');
      }
      return response.json();
    },
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Types
export interface RemarkableDocument {
  id: string;
  name: string;
  type: 'DocumentType' | 'CollectionType';
  parent: string | null;
  lastModified: number;
  pageCount?: number;
  hash?: string;
}

export interface FolderTreeNode {
  id: string;
  name: string;
  type: string;
  children: RemarkableDocument[];
  subfolders: FolderTreeNode[];
}

export interface MbaStatus {
  configured: boolean;
  mbaFolderFound: boolean;
  folderStructure: FolderTreeNode[];
  syncedDocuments: number;
  pendingDocuments: number;
  lastSyncAt?: string;
}

export interface CloudStatus {
  configured: boolean;
  polling: boolean;
  lastSync: string;
  documentCount: number;
  hasValidUserToken: boolean;
}

export interface SyncResult {
  success: boolean;
  foldersProcessed: number;
  documentsProcessed: number;
  pagesCreated: number;
  errors: string[];
}

// Hooks

/**
 * Get Remarkable Cloud status
 */
export function useRemarkableCloudStatus() {
  return useQuery({
    queryKey: ['remarkable', 'cloud', 'status'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/ingestion/remarkable/cloud/status`);
      if (!response.ok) throw new Error('Failed to fetch cloud status');
      const data = await response.json();
      return data.data as CloudStatus;
    },
    refetchInterval: 30000,
  });
}

/**
 * Get MBA folder sync status
 */
export function useRemarkableMbaStatus() {
  return useQuery({
    queryKey: ['remarkable', 'mba', 'status'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/ingestion/remarkable/mba/status`);
      if (!response.ok) throw new Error('Failed to fetch MBA status');
      const data = await response.json();
      return data.data as MbaStatus;
    },
    refetchInterval: 30000,
  });
}

/**
 * Get MBA folder tree structure
 */
export function useRemarkableMbaTree() {
  return useQuery({
    queryKey: ['remarkable', 'mba', 'tree'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/ingestion/remarkable/mba/tree`);
      if (!response.ok) throw new Error('Failed to fetch MBA tree');
      const data = await response.json();
      return data.data as {
        rootFolder: { id: string; name: string };
        tree: FolderTreeNode[];
      };
    },
  });
}

/**
 * Get all Remarkable documents
 */
export function useRemarkableDocuments() {
  return useQuery({
    queryKey: ['remarkable', 'cloud', 'documents'],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/ingestion/remarkable/cloud/documents`);
      if (!response.ok) throw new Error('Failed to fetch documents');
      const data = await response.json();
      return data.data as RemarkableDocument[];
    },
  });
}

/**
 * Sync with Remarkable Cloud
 */
export function useSyncRemarkableCloud() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_URL}/api/ingestion/remarkable/cloud/sync`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to sync with cloud');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarkable'] });
    },
  });
}

/**
 * Run MBA folder sync to Vault (as background job)
 */
export function useSyncMbaFolder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await fetch(`${API_URL}/api/ingestion/remarkable/mba/jobs/sync`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to queue MBA sync job');
      const data = await response.json();
      return data as { success: boolean; data: { jobId: string }; message: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['remarkable'] });
    },
  });
}

/**
 * Render a document to PDF
 */
export function useRenderDocument() {
  return useMutation({
    mutationFn: async (documentId: string) => {
      const response = await fetch(`${API_URL}/api/ingestion/remarkable/cloud/render/${documentId}`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to render document');
      const data = await response.json();
      return data.data as {
        documentId: string;
        documentName: string;
        pdfPath: string;
        pdfUrl: string;
        ocrText: string;
        ocrCharCount: number;
      };
    },
  });
}

// Utility functions

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function getDocumentIcon(type: string): string {
  return type === 'CollectionType' ? '📁' : '📝';
}

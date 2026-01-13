import apiClient from './client';

// Remarkable Cloud Integration Types
export interface RemarkableCloudStatus {
  configured: boolean;
  polling: boolean;
  lastSync: string | null;
  documentCount: number;
  hasValidUserToken: boolean;
}

export interface RemarkableDocument {
  id: string;
  name: string;
  lastModified: string;
}

export interface RemarkableSyncResult {
  success: boolean;
  documentsFound: number;
  changes: Array<{
    document: RemarkableDocument;
    changeType: 'new' | 'updated';
  }>;
  errors: string[];
}

export interface RemarkableRenderResult {
  documentId: string;
  documentName: string;
  pdfPath: string;
}

export const integrationsApi = {
  // Remarkable Cloud
  getRemarkableCloudStatus: () =>
    apiClient.get<RemarkableCloudStatus>('/ingestion/remarkable/cloud/status'),

  getRemarkableDocuments: () =>
    apiClient.get<RemarkableDocument[]>('/ingestion/remarkable/cloud/documents'),

  getRemarkablePending: () =>
    apiClient.get<{ changes: Array<{ document: RemarkableDocument; changeType: string }> }>(
      '/ingestion/remarkable/cloud/pending'
    ),

  syncRemarkableCloud: () =>
    apiClient.post<RemarkableSyncResult>('/ingestion/remarkable/cloud/sync'),

  renderRemarkableDocument: (documentId: string) =>
    apiClient.post<RemarkableRenderResult>(`/ingestion/remarkable/cloud/render/${documentId}`),

  startRemarkablePolling: (intervalMinutes?: number) =>
    apiClient.post('/ingestion/remarkable/cloud/polling/start', { intervalMinutes }),

  stopRemarkablePolling: () =>
    apiClient.post('/ingestion/remarkable/cloud/polling/stop'),

  clearRemarkableState: () =>
    apiClient.delete('/ingestion/remarkable/cloud/state'),

  // Google Drive Remarkable Sync
  getRemarkableGDriveStatus: () =>
    apiClient.get('/ingestion/remarkable/gdrive/status'),

  syncRemarkableGDrive: () =>
    apiClient.post('/ingestion/remarkable/gdrive/sync'),
};

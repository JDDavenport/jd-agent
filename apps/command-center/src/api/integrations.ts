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
    apiClient.get<RemarkableCloudStatus>('/ingestion/remarkable/cloud/status').then((r) => r.data),

  getRemarkableDocuments: () =>
    apiClient.get<RemarkableDocument[]>('/ingestion/remarkable/cloud/documents').then((r) => r.data),

  getRemarkablePending: () =>
    apiClient
      .get<{ changes: Array<{ document: RemarkableDocument; changeType: string }> }>(
        '/ingestion/remarkable/cloud/pending'
      )
      .then((r) => r.data),

  syncRemarkableCloud: () =>
    apiClient.post<RemarkableSyncResult>('/ingestion/remarkable/cloud/sync').then((r) => r.data),

  renderRemarkableDocument: (documentId: string) =>
    apiClient
      .post<RemarkableRenderResult>(`/ingestion/remarkable/cloud/render/${documentId}`)
      .then((r) => r.data),

  startRemarkablePolling: (intervalMinutes?: number) =>
    apiClient
      .post('/ingestion/remarkable/cloud/polling/start', { intervalMinutes })
      .then((r) => r.data),

  stopRemarkablePolling: () =>
    apiClient.post('/ingestion/remarkable/cloud/polling/stop').then((r) => r.data),

  clearRemarkableState: () =>
    apiClient.delete('/ingestion/remarkable/cloud/state').then((r) => r.data),

  // Google Drive Remarkable Sync
  getRemarkableGDriveStatus: () =>
    apiClient.get('/ingestion/remarkable/gdrive/status').then((r) => r.data),

  syncRemarkableGDrive: () =>
    apiClient.post('/ingestion/remarkable/gdrive/sync').then((r) => r.data),
};

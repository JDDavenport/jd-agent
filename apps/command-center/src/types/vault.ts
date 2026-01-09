export type VaultContentType = 'note' | 'recording_summary' | 'lecture' | 'meeting' | 'article' | 'reference';
export type VaultSource = 'remarkable' | 'plaud' | 'email' | 'manual' | 'web' | 'canvas';

export interface VaultEntry {
  id: string;
  title: string;
  content: string;
  contentType: VaultContentType;
  context: string | null;
  tags: string[];
  source: VaultSource;
  sourceRef: string | null;
  sourceDate: string | null;
  recordingId: string | null;
  relatedEntries: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateVaultEntryInput {
  title: string;
  content: string;
  contentType?: VaultContentType;
  context?: string;
  tags?: string[];
  source?: VaultSource;
  sourceRef?: string;
  sourceDate?: string;
  recordingId?: string;
  relatedEntries?: string[];
}

export interface UpdateVaultEntryInput extends Partial<CreateVaultEntryInput> {}

export interface VaultFilters {
  context?: string;
  contentType?: VaultContentType;
  source?: VaultSource;
  tags?: string[];
  fromDate?: string;
  toDate?: string;
  recordingId?: string;
}

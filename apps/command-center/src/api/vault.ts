import apiClient from './client';
import type { VaultEntry, CreateVaultEntryInput, UpdateVaultEntryInput, VaultFilters } from '../types/vault';

export const getVaultEntries = async (filters?: VaultFilters): Promise<VaultEntry[]> => {
  const params = new URLSearchParams();
  if (filters?.context) params.append('context', filters.context);
  if (filters?.contentType) params.append('contentType', filters.contentType);
  if (filters?.source) params.append('source', filters.source);
  if (filters?.tags && filters.tags.length > 0) {
    filters.tags.forEach(tag => params.append('tags', tag));
  }
  if (filters?.fromDate) params.append('fromDate', filters.fromDate);
  if (filters?.toDate) params.append('toDate', filters.toDate);

  return apiClient.get(`/vault?${params.toString()}`);
};

export const searchVault = async (query: string, filters?: VaultFilters): Promise<VaultEntry[]> => {
  const params = new URLSearchParams({ query });
  if (filters?.context) params.append('context', filters.context);
  if (filters?.contentType) params.append('contentType', filters.contentType);

  return apiClient.get(`/vault/search?${params.toString()}`);
};

export const getVaultEntry = async (id: string): Promise<VaultEntry> => {
  return apiClient.get(`/vault/${id}`);
};

export const createVaultEntry = async (data: CreateVaultEntryInput): Promise<VaultEntry> => {
  return apiClient.post('/vault', data);
};

export const updateVaultEntry = async (id: string, data: UpdateVaultEntryInput): Promise<VaultEntry> => {
  return apiClient.patch(`/vault/${id}`, data);
};

export const deleteVaultEntry = async (id: string): Promise<void> => {
  await apiClient.delete(`/vault/${id}`);
};

export const getVaultContexts = async (): Promise<string[]> => {
  return apiClient.get('/vault/contexts');
};

export const getVaultTags = async (): Promise<string[]> => {
  return apiClient.get('/vault/tags');
};

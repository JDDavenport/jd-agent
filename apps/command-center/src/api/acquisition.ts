/**
 * Acquisition API Functions
 *
 * API functions for the Boomer Business Finder / Acquisition module.
 */

import apiClient from './client';
import type {
  AcquisitionLead,
  AcquisitionLeadWithInteractions,
  AcquisitionInteraction,
  LeadFilters,
  PipelineStats,
  ImportResult,
  CreateLeadInput,
  UpdateLeadInput,
  CreateInteractionInput,
  StageChangeInput,
  ScraperBusiness,
} from '../types/acquisition';

// ============================================
// Leads
// ============================================

export const getLeads = (filters?: LeadFilters): Promise<AcquisitionLead[]> => {
  const params = new URLSearchParams();
  if (filters) {
    if (filters.search) params.append('search', filters.search);
    if (filters.stages?.length) params.append('stages', filters.stages.join(','));
    if (filters.minScore !== undefined) params.append('minScore', filters.minScore.toString());
    if (filters.maxScore !== undefined) params.append('maxScore', filters.maxScore.toString());
    if (filters.minAge !== undefined) params.append('minAge', filters.minAge.toString());
    if (filters.maxAge !== undefined) params.append('maxAge', filters.maxAge.toString());
    if (filters.entityTypes?.length) params.append('entityTypes', filters.entityTypes.join(','));
    if (filters.isFavorite !== undefined) params.append('isFavorite', filters.isFavorite.toString());
    if (filters.isHot !== undefined) params.append('isHot', filters.isHot.toString());
    if (filters.hasFollowUp !== undefined) params.append('hasFollowUp', filters.hasFollowUp.toString());
    if (filters.needsEnrichment !== undefined) params.append('needsEnrichment', filters.needsEnrichment.toString());
    if (filters.limit !== undefined) params.append('limit', filters.limit.toString());
    if (filters.offset !== undefined) params.append('offset', filters.offset.toString());
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortDir) params.append('sortDir', filters.sortDir);
  }
  const query = params.toString();
  return apiClient.get(`/acquisition/leads${query ? `?${query}` : ''}`);
};

export const getLead = (id: string): Promise<AcquisitionLeadWithInteractions> =>
  apiClient.get(`/acquisition/leads/${id}`);

export const createLead = (data: CreateLeadInput): Promise<AcquisitionLead> =>
  apiClient.post('/acquisition/leads', data);

export const updateLead = (id: string, data: UpdateLeadInput): Promise<AcquisitionLead> =>
  apiClient.patch(`/acquisition/leads/${id}`, data);

export const deleteLead = (id: string): Promise<void> =>
  apiClient.delete(`/acquisition/leads/${id}`);

// ============================================
// Import
// ============================================

export const importLeads = (businesses: ScraperBusiness[]): Promise<ImportResult> =>
  apiClient.post('/acquisition/leads/import', { businesses });

// ============================================
// Pipeline Management
// ============================================

export const changeLeadStage = (id: string, data: StageChangeInput): Promise<AcquisitionLead> =>
  apiClient.post(`/acquisition/leads/${id}/stage`, data);

export const toggleFavorite = (id: string): Promise<AcquisitionLead> =>
  apiClient.post(`/acquisition/leads/${id}/favorite`);

export const toggleHot = (id: string): Promise<AcquisitionLead> =>
  apiClient.post(`/acquisition/leads/${id}/hot`);

export const passOnLead = (id: string, reason: string): Promise<AcquisitionLead> =>
  apiClient.post(`/acquisition/leads/${id}/pass`, { reason });

export const setFollowUp = (id: string, followUpDate: string): Promise<AcquisitionLead> =>
  apiClient.post(`/acquisition/leads/${id}/follow-up`, { followUpDate });

// ============================================
// Interactions
// ============================================

export const getInteractions = (leadId: string): Promise<AcquisitionInteraction[]> =>
  apiClient.get(`/acquisition/leads/${leadId}/interactions`);

export const logInteraction = (leadId: string, data: CreateInteractionInput): Promise<AcquisitionInteraction> =>
  apiClient.post(`/acquisition/leads/${leadId}/interactions`, data);

// ============================================
// Stats & Dashboard
// ============================================

export const getStats = (): Promise<PipelineStats> =>
  apiClient.get('/acquisition/stats');

export const getFollowUps = (limit = 20): Promise<AcquisitionLead[]> =>
  apiClient.get(`/acquisition/follow-ups?limit=${limit}`);

export const getHotLeads = (limit = 10): Promise<AcquisitionLead[]> =>
  apiClient.get(`/acquisition/hot?limit=${limit}`);

export const getTopLeads = (limit = 10, minScore = 50): Promise<AcquisitionLead[]> =>
  apiClient.get(`/acquisition/top?limit=${limit}&minScore=${minScore}`);

// ============================================
// Enrichment
// ============================================

export const getEnrichmentHistory = (leadId: string): Promise<any[]> =>
  apiClient.get(`/acquisition/leads/${leadId}/enrichment`);

export const getLeadsNeedingEnrichment = (source = 'google_places', limit = 50): Promise<AcquisitionLead[]> =>
  apiClient.get(`/acquisition/needs-enrichment?source=${source}&limit=${limit}`);

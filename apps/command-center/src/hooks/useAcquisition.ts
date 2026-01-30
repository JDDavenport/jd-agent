/**
 * useAcquisition Hooks
 *
 * React Query hooks for the Boomer Business Finder / Acquisition module.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
  importLeads,
  changeLeadStage,
  toggleFavorite,
  toggleHot,
  passOnLead,
  setFollowUp,
  getInteractions,
  logInteraction,
  getStats,
  getFollowUps,
  getHotLeads,
  getTopLeads,
} from '../api/acquisition';
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
// Query Keys
// ============================================

export const acquisitionKeys = {
  all: ['acquisition'] as const,
  leads: () => [...acquisitionKeys.all, 'leads'] as const,
  leadsList: (filters?: LeadFilters) => [...acquisitionKeys.leads(), 'list', filters] as const,
  lead: (id: string) => [...acquisitionKeys.leads(), id] as const,
  interactions: (leadId: string) => [...acquisitionKeys.all, 'interactions', leadId] as const,
  stats: () => [...acquisitionKeys.all, 'stats'] as const,
  followUps: () => [...acquisitionKeys.all, 'followUps'] as const,
  hotLeads: () => [...acquisitionKeys.all, 'hot'] as const,
  topLeads: () => [...acquisitionKeys.all, 'top'] as const,
};

// ============================================
// Lead Queries
// ============================================

export function useLeads(filters?: LeadFilters) {
  return useQuery<AcquisitionLead[]>({
    queryKey: acquisitionKeys.leadsList(filters),
    queryFn: () => getLeads(filters),
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useLead(id: string | undefined) {
  return useQuery<AcquisitionLeadWithInteractions>({
    queryKey: acquisitionKeys.lead(id!),
    queryFn: () => getLead(id!),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

// ============================================
// Lead Mutations
// ============================================

export function useCreateLead() {
  const queryClient = useQueryClient();

  return useMutation<AcquisitionLead, Error, CreateLeadInput>({
    mutationFn: createLead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: acquisitionKeys.leads() });
      queryClient.invalidateQueries({ queryKey: acquisitionKeys.stats() });
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation<AcquisitionLead, Error, { id: string; data: UpdateLeadInput }>({
    mutationFn: ({ id, data }) => updateLead(id, data),
    onSuccess: (lead) => {
      queryClient.invalidateQueries({ queryKey: acquisitionKeys.leads() });
      queryClient.invalidateQueries({ queryKey: acquisitionKeys.lead(lead.id) });
      queryClient.invalidateQueries({ queryKey: acquisitionKeys.stats() });
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: deleteLead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: acquisitionKeys.leads() });
      queryClient.invalidateQueries({ queryKey: acquisitionKeys.stats() });
    },
  });
}

// ============================================
// Import Mutation
// ============================================

export function useImportLeads() {
  const queryClient = useQueryClient();

  return useMutation<ImportResult, Error, ScraperBusiness[]>({
    mutationFn: importLeads,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: acquisitionKeys.leads() });
      queryClient.invalidateQueries({ queryKey: acquisitionKeys.stats() });
    },
  });
}

// ============================================
// Pipeline Mutations
// ============================================

export function useChangeStage() {
  const queryClient = useQueryClient();

  return useMutation<AcquisitionLead, Error, { id: string; data: StageChangeInput }>({
    mutationFn: ({ id, data }) => changeLeadStage(id, data),
    onSuccess: (lead) => {
      queryClient.invalidateQueries({ queryKey: acquisitionKeys.leads() });
      queryClient.invalidateQueries({ queryKey: acquisitionKeys.lead(lead.id) });
      queryClient.invalidateQueries({ queryKey: acquisitionKeys.stats() });
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation<AcquisitionLead, Error, string>({
    mutationFn: toggleFavorite,
    onSuccess: (lead) => {
      queryClient.invalidateQueries({ queryKey: acquisitionKeys.leads() });
      queryClient.invalidateQueries({ queryKey: acquisitionKeys.lead(lead.id) });
    },
  });
}

export function useToggleHot() {
  const queryClient = useQueryClient();

  return useMutation<AcquisitionLead, Error, string>({
    mutationFn: toggleHot,
    onSuccess: (lead) => {
      queryClient.invalidateQueries({ queryKey: acquisitionKeys.leads() });
      queryClient.invalidateQueries({ queryKey: acquisitionKeys.lead(lead.id) });
      queryClient.invalidateQueries({ queryKey: acquisitionKeys.hotLeads() });
    },
  });
}

export function usePassOnLead() {
  const queryClient = useQueryClient();

  return useMutation<AcquisitionLead, Error, { id: string; reason: string }>({
    mutationFn: ({ id, reason }) => passOnLead(id, reason),
    onSuccess: (lead) => {
      queryClient.invalidateQueries({ queryKey: acquisitionKeys.leads() });
      queryClient.invalidateQueries({ queryKey: acquisitionKeys.lead(lead.id) });
      queryClient.invalidateQueries({ queryKey: acquisitionKeys.stats() });
    },
  });
}

export function useSetFollowUp() {
  const queryClient = useQueryClient();

  return useMutation<AcquisitionLead, Error, { id: string; followUpDate: string }>({
    mutationFn: ({ id, followUpDate }) => setFollowUp(id, followUpDate),
    onSuccess: (lead) => {
      queryClient.invalidateQueries({ queryKey: acquisitionKeys.leads() });
      queryClient.invalidateQueries({ queryKey: acquisitionKeys.lead(lead.id) });
      queryClient.invalidateQueries({ queryKey: acquisitionKeys.followUps() });
    },
  });
}

// ============================================
// Interaction Mutations
// ============================================

export function useInteractions(leadId: string | undefined) {
  return useQuery<AcquisitionInteraction[]>({
    queryKey: acquisitionKeys.interactions(leadId!),
    queryFn: () => getInteractions(leadId!),
    enabled: !!leadId,
    staleTime: 30 * 1000,
  });
}

export function useLogInteraction() {
  const queryClient = useQueryClient();

  return useMutation<AcquisitionInteraction, Error, { leadId: string; data: CreateInteractionInput }>({
    mutationFn: ({ leadId, data }) => logInteraction(leadId, data),
    onSuccess: (_, { leadId }) => {
      queryClient.invalidateQueries({ queryKey: acquisitionKeys.interactions(leadId) });
      queryClient.invalidateQueries({ queryKey: acquisitionKeys.lead(leadId) });
      queryClient.invalidateQueries({ queryKey: acquisitionKeys.followUps() });
    },
  });
}

// ============================================
// Stats & Dashboard Queries
// ============================================

export function useAcquisitionStats() {
  return useQuery<PipelineStats>({
    queryKey: acquisitionKeys.stats(),
    queryFn: getStats,
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 60 * 1000,
  });
}

export function useFollowUps(limit = 20) {
  return useQuery<AcquisitionLead[]>({
    queryKey: [...acquisitionKeys.followUps(), limit],
    queryFn: () => getFollowUps(limit),
    staleTime: 60 * 1000,
  });
}

export function useHotLeads(limit = 10) {
  return useQuery<AcquisitionLead[]>({
    queryKey: [...acquisitionKeys.hotLeads(), limit],
    queryFn: () => getHotLeads(limit),
    staleTime: 60 * 1000,
  });
}

export function useTopLeads(limit = 10, minScore = 50) {
  return useQuery<AcquisitionLead[]>({
    queryKey: [...acquisitionKeys.topLeads(), limit, minScore],
    queryFn: () => getTopLeads(limit, minScore),
    staleTime: 60 * 1000,
  });
}

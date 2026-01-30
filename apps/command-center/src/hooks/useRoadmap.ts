import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getPhases,
  getPhase,
  createPhase,
  updatePhase,
  deletePhase,
  getMilestones,
  getMilestone,
  createMilestone,
  updateMilestone,
  deleteMilestone,
  getStats,
  seedRoadmap,
} from '../api/roadmap';
import type {
  Phase,
  PhaseWithMilestones,
  Milestone,
  RoadmapStats,
  CreatePhaseInput,
  UpdatePhaseInput,
  CreateMilestoneInput,
  UpdateMilestoneInput,
} from '../types/roadmap';

export const roadmapKeys = {
  all: ['roadmap'] as const,
  phases: () => [...roadmapKeys.all, 'phases'] as const,
  phase: (id: string) => [...roadmapKeys.phases(), id] as const,
  milestones: () => [...roadmapKeys.all, 'milestones'] as const,
  milestonesForPhase: (phaseId: string) => [...roadmapKeys.milestones(), phaseId] as const,
  milestone: (id: string) => [...roadmapKeys.milestones(), 'detail', id] as const,
  stats: () => [...roadmapKeys.all, 'stats'] as const,
};

export function usePhases() {
  return useQuery<PhaseWithMilestones[]>({
    queryKey: roadmapKeys.phases(),
    queryFn: getPhases,
    staleTime: 60 * 1000,
  });
}

export function usePhase(id: string | undefined) {
  return useQuery<PhaseWithMilestones>({
    queryKey: roadmapKeys.phase(id!),
    queryFn: () => getPhase(id!),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

export function useCreatePhase() {
  const queryClient = useQueryClient();

  return useMutation<Phase, Error, CreatePhaseInput>({
    mutationFn: createPhase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roadmapKeys.phases() });
      queryClient.invalidateQueries({ queryKey: roadmapKeys.stats() });
    },
  });
}

export function useUpdatePhase() {
  const queryClient = useQueryClient();

  return useMutation<Phase, Error, { id: string; data: UpdatePhaseInput }>({
    mutationFn: ({ id, data }) => updatePhase(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: roadmapKeys.phases() });
      queryClient.invalidateQueries({ queryKey: roadmapKeys.phase(variables.id) });
      queryClient.invalidateQueries({ queryKey: roadmapKeys.stats() });
    },
  });
}

export function useDeletePhase() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: deletePhase,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roadmapKeys.phases() });
      queryClient.invalidateQueries({ queryKey: roadmapKeys.stats() });
    },
  });
}

export function useMilestones(phaseId?: string) {
  return useQuery<Milestone[]>({
    queryKey: roadmapKeys.milestonesForPhase(phaseId || 'all'),
    queryFn: () => getMilestones(phaseId),
    staleTime: 60 * 1000,
  });
}

export function useMilestone(id: string | undefined) {
  return useQuery<Milestone>({
    queryKey: roadmapKeys.milestone(id || ''),
    queryFn: () => getMilestone(id!),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

export function useCreateMilestone() {
  const queryClient = useQueryClient();

  return useMutation<Milestone, Error, CreateMilestoneInput>({
    mutationFn: createMilestone,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roadmapKeys.phases() });
      queryClient.invalidateQueries({ queryKey: roadmapKeys.milestones() });
      queryClient.invalidateQueries({ queryKey: roadmapKeys.stats() });
    },
  });
}

export function useUpdateMilestone() {
  const queryClient = useQueryClient();

  return useMutation<Milestone, Error, { id: string; data: UpdateMilestoneInput }>({
    mutationFn: ({ id, data }) => updateMilestone(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: roadmapKeys.phases() });
      queryClient.invalidateQueries({ queryKey: roadmapKeys.milestones() });
      queryClient.invalidateQueries({ queryKey: roadmapKeys.milestone(variables.id) });
      queryClient.invalidateQueries({ queryKey: roadmapKeys.stats() });
    },
  });
}

export function useDeleteMilestone() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: deleteMilestone,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roadmapKeys.phases() });
      queryClient.invalidateQueries({ queryKey: roadmapKeys.milestones() });
      queryClient.invalidateQueries({ queryKey: roadmapKeys.stats() });
    },
  });
}

export function useRoadmapStats() {
  return useQuery<RoadmapStats>({
    queryKey: roadmapKeys.stats(),
    queryFn: getStats,
    staleTime: 60 * 1000,
  });
}

export function useSeedRoadmap() {
  const queryClient = useQueryClient();

  return useMutation<{ seeded: boolean; message: string }, Error, void>({
    mutationFn: seedRoadmap,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roadmapKeys.phases() });
      queryClient.invalidateQueries({ queryKey: roadmapKeys.stats() });
    },
  });
}

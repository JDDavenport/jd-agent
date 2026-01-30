import apiClient from './client';
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

// ============================================
// Phases
// ============================================

export const getPhases = (): Promise<PhaseWithMilestones[]> =>
  apiClient.get('/roadmap/phases');

export const getPhase = (id: string): Promise<PhaseWithMilestones> =>
  apiClient.get(`/roadmap/phases/${id}`);

export const createPhase = (data: CreatePhaseInput): Promise<Phase> =>
  apiClient.post('/roadmap/phases', data);

export const updatePhase = (id: string, data: UpdatePhaseInput): Promise<Phase> =>
  apiClient.patch(`/roadmap/phases/${id}`, data);

export const deletePhase = (id: string): Promise<void> =>
  apiClient.delete(`/roadmap/phases/${id}`);

// ============================================
// Milestones
// ============================================

export const getMilestones = (phaseId?: string): Promise<Milestone[]> => {
  const query = phaseId ? `?phaseId=${phaseId}` : '';
  return apiClient.get(`/roadmap/milestones${query}`);
};

export const getMilestone = (id: string): Promise<Milestone> =>
  apiClient.get(`/roadmap/milestones/${id}`);

export const createMilestone = (data: CreateMilestoneInput): Promise<Milestone> =>
  apiClient.post('/roadmap/milestones', data);

export const updateMilestone = (id: string, data: UpdateMilestoneInput): Promise<Milestone> =>
  apiClient.patch(`/roadmap/milestones/${id}`, data);

export const deleteMilestone = (id: string): Promise<void> =>
  apiClient.delete(`/roadmap/milestones/${id}`);

// ============================================
// Stats & Utility
// ============================================

export const getStats = (): Promise<RoadmapStats> =>
  apiClient.get('/roadmap/stats');

export const seedRoadmap = (): Promise<{ seeded: boolean; message: string }> =>
  apiClient.post('/roadmap/seed');

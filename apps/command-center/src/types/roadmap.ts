export type PhaseStatus = 'not_started' | 'in_progress' | 'completed';
export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

export interface MilestoneMetric {
  label: string;
  target: string | number;
  current?: string | number;
}

// Milestone as stored in database
export interface Milestone {
  id: string;
  phaseId: string;
  title: string;
  description: string | null;
  sortOrder: number;
  status: MilestoneStatus;
  targetDate: string | null;
  completedDate: string | null;
  metrics: MilestoneMetric[] | null;
  createdAt: string;
  updatedAt: string;
}

// Phase as stored in database
export interface Phase {
  id: string;
  phaseNumber: number;
  title: string;
  subtitle: string | null;
  timeline: string;
  status: PhaseStatus;
  progress: number; // 0-100
  color: string;
  icon: string;
  goal: string;
  strategy: string;
  outcome: string;
  keyMetrics: string[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

// Phase with milestones joined
export interface PhaseWithMilestones extends Phase {
  milestones: Milestone[];
}

export interface RoadmapStats {
  totalMilestones: number;
  completedMilestones: number;
  inProgressMilestones: number;
  currentPhase: number;
  overallProgress: number;
}

// ============================================
// API Input Types
// ============================================

export interface CreatePhaseInput {
  phaseNumber: number;
  title: string;
  subtitle?: string;
  timeline: string;
  status?: PhaseStatus;
  progress?: number;
  color: string;
  icon: string;
  goal: string;
  strategy: string;
  outcome: string;
  keyMetrics?: string[];
}

export interface UpdatePhaseInput {
  title?: string;
  subtitle?: string;
  timeline?: string;
  status?: PhaseStatus;
  progress?: number;
  color?: string;
  icon?: string;
  goal?: string;
  strategy?: string;
  outcome?: string;
  keyMetrics?: string[];
}

export interface CreateMilestoneInput {
  phaseId: string;
  title: string;
  description?: string;
  sortOrder?: number;
  status?: MilestoneStatus;
  targetDate?: string;
  metrics?: MilestoneMetric[];
}

export interface UpdateMilestoneInput {
  title?: string;
  description?: string;
  sortOrder?: number;
  status?: MilestoneStatus;
  targetDate?: string;
  completedDate?: string;
  metrics?: MilestoneMetric[];
}

// ============================================
// Status display configurations
// ============================================

export const MILESTONE_STATUS_CONFIG: Record<MilestoneStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: 'Pending', color: 'text-text-muted', bgColor: 'bg-dark-card-hover' },
  in_progress: { label: 'In Progress', color: 'text-accent', bgColor: 'bg-accent/20' },
  completed: { label: 'Completed', color: 'text-success', bgColor: 'bg-success/20' },
  blocked: { label: 'Blocked', color: 'text-error', bgColor: 'bg-error/20' },
};

export const PHASE_STATUS_CONFIG: Record<PhaseStatus, { label: string; color: string }> = {
  not_started: { label: 'Not Started', color: 'text-text-muted' },
  in_progress: { label: 'In Progress', color: 'text-accent' },
  completed: { label: 'Completed', color: 'text-success' },
};

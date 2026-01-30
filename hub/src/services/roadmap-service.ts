/**
 * Roadmap Service - AI Agent Tree Strategic Planning
 *
 * Manages roadmap phases and milestones for the company strategy:
 * - Phase 1: Acquisition & Optimization (0-12 months)
 * - Phase 2: Full Business Automation (1-3 years)
 * - Phase 3: Platform & Equity Model (3-5+ years)
 */

import { eq, desc, asc, and } from 'drizzle-orm';
import { db } from '../db/client';
import { roadmapPhases, roadmapMilestones } from '../db/schema';

// Types
export type PhaseStatus = 'not_started' | 'in_progress' | 'completed';
export type MilestoneStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

export interface MilestoneMetric {
  label: string;
  target: string | number;
  current?: string | number;
}

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

export interface RoadmapStats {
  totalMilestones: number;
  completedMilestones: number;
  inProgressMilestones: number;
  currentPhase: number;
  overallProgress: number;
}

export interface PhaseWithMilestones {
  id: string;
  phaseNumber: number;
  title: string;
  subtitle: string | null;
  timeline: string;
  status: string;
  progress: number;
  color: string;
  icon: string;
  goal: string;
  strategy: string;
  outcome: string;
  keyMetrics: string[];
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  milestones: Array<{
    id: string;
    phaseId: string;
    title: string;
    description: string | null;
    sortOrder: number;
    status: string;
    targetDate: string | null;
    completedDate: string | null;
    metrics: MilestoneMetric[] | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
}

class RoadmapService {
  // ============================================
  // PHASE OPERATIONS
  // ============================================

  /**
   * Get all phases with their milestones
   */
  async getPhases(): Promise<PhaseWithMilestones[]> {
    const phases = await db
      .select()
      .from(roadmapPhases)
      .orderBy(asc(roadmapPhases.phaseNumber));

    const milestones = await db
      .select()
      .from(roadmapMilestones)
      .orderBy(asc(roadmapMilestones.sortOrder));

    // Group milestones by phase
    const milestonesByPhase = new Map<string, typeof milestones>();
    for (const m of milestones) {
      const existing = milestonesByPhase.get(m.phaseId) || [];
      existing.push(m);
      milestonesByPhase.set(m.phaseId, existing);
    }

    return phases.map((p) => ({
      ...p,
      milestones: milestonesByPhase.get(p.id) || [],
    }));
  }

  /**
   * Get a single phase by ID
   */
  async getPhaseById(id: string) {
    const [phase] = await db
      .select()
      .from(roadmapPhases)
      .where(eq(roadmapPhases.id, id))
      .limit(1);

    if (!phase) return null;

    const milestones = await db
      .select()
      .from(roadmapMilestones)
      .where(eq(roadmapMilestones.phaseId, id))
      .orderBy(asc(roadmapMilestones.sortOrder));

    return { ...phase, milestones };
  }

  /**
   * Create a new phase
   */
  async createPhase(input: CreatePhaseInput) {
    const [phase] = await db
      .insert(roadmapPhases)
      .values({
        phaseNumber: input.phaseNumber,
        title: input.title,
        subtitle: input.subtitle,
        timeline: input.timeline,
        status: input.status || 'not_started',
        progress: input.progress || 0,
        color: input.color,
        icon: input.icon,
        goal: input.goal,
        strategy: input.strategy,
        outcome: input.outcome,
        keyMetrics: input.keyMetrics || [],
      })
      .returning();

    return phase;
  }

  /**
   * Update a phase
   */
  async updatePhase(id: string, input: UpdatePhaseInput) {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.title !== undefined) updateData.title = input.title;
    if (input.subtitle !== undefined) updateData.subtitle = input.subtitle;
    if (input.timeline !== undefined) updateData.timeline = input.timeline;
    if (input.status !== undefined) {
      updateData.status = input.status;
      if (input.status === 'completed') {
        updateData.completedAt = new Date();
      }
    }
    if (input.progress !== undefined) updateData.progress = input.progress;
    if (input.color !== undefined) updateData.color = input.color;
    if (input.icon !== undefined) updateData.icon = input.icon;
    if (input.goal !== undefined) updateData.goal = input.goal;
    if (input.strategy !== undefined) updateData.strategy = input.strategy;
    if (input.outcome !== undefined) updateData.outcome = input.outcome;
    if (input.keyMetrics !== undefined) updateData.keyMetrics = input.keyMetrics;

    const [phase] = await db
      .update(roadmapPhases)
      .set(updateData)
      .where(eq(roadmapPhases.id, id))
      .returning();

    return phase || null;
  }

  /**
   * Delete a phase (and cascade delete milestones)
   */
  async deletePhase(id: string) {
    const [deleted] = await db
      .delete(roadmapPhases)
      .where(eq(roadmapPhases.id, id))
      .returning({ id: roadmapPhases.id });

    return !!deleted;
  }

  /**
   * Recalculate phase progress based on milestones
   */
  async recalculatePhaseProgress(phaseId: string) {
    const milestones = await db
      .select()
      .from(roadmapMilestones)
      .where(eq(roadmapMilestones.phaseId, phaseId));

    if (milestones.length === 0) {
      await db
        .update(roadmapPhases)
        .set({ progress: 0, updatedAt: new Date() })
        .where(eq(roadmapPhases.id, phaseId));
      return;
    }

    const completed = milestones.filter((m) => m.status === 'completed').length;
    const progress = Math.round((completed / milestones.length) * 100);

    // Determine phase status
    let status: PhaseStatus = 'not_started';
    if (progress === 100) {
      status = 'completed';
    } else if (progress > 0 || milestones.some((m) => m.status === 'in_progress')) {
      status = 'in_progress';
    }

    await db
      .update(roadmapPhases)
      .set({
        progress,
        status,
        updatedAt: new Date(),
        completedAt: status === 'completed' ? new Date() : null,
      })
      .where(eq(roadmapPhases.id, phaseId));
  }

  // ============================================
  // MILESTONE OPERATIONS
  // ============================================

  /**
   * Get milestones for a phase
   */
  async getMilestones(phaseId: string) {
    return db
      .select()
      .from(roadmapMilestones)
      .where(eq(roadmapMilestones.phaseId, phaseId))
      .orderBy(asc(roadmapMilestones.sortOrder));
  }

  /**
   * Get a single milestone by ID
   */
  async getMilestoneById(id: string) {
    const [milestone] = await db
      .select()
      .from(roadmapMilestones)
      .where(eq(roadmapMilestones.id, id))
      .limit(1);

    return milestone || null;
  }

  /**
   * Create a new milestone
   */
  async createMilestone(input: CreateMilestoneInput) {
    // Get max sort order for this phase
    const existing = await db
      .select({ sortOrder: roadmapMilestones.sortOrder })
      .from(roadmapMilestones)
      .where(eq(roadmapMilestones.phaseId, input.phaseId))
      .orderBy(desc(roadmapMilestones.sortOrder))
      .limit(1);

    const maxSortOrder = existing[0]?.sortOrder ?? -1;

    const [milestone] = await db
      .insert(roadmapMilestones)
      .values({
        phaseId: input.phaseId,
        title: input.title,
        description: input.description,
        sortOrder: input.sortOrder ?? maxSortOrder + 1,
        status: input.status || 'pending',
        targetDate: input.targetDate,
        metrics: input.metrics,
      })
      .returning();

    // Recalculate phase progress
    await this.recalculatePhaseProgress(input.phaseId);

    return milestone;
  }

  /**
   * Update a milestone
   */
  async updateMilestone(id: string, input: UpdateMilestoneInput) {
    // Get current milestone to know phase
    const current = await this.getMilestoneById(id);
    if (!current) return null;

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.sortOrder !== undefined) updateData.sortOrder = input.sortOrder;
    if (input.status !== undefined) {
      updateData.status = input.status;
      if (input.status === 'completed' && !current.completedDate) {
        updateData.completedDate = new Date().toISOString().split('T')[0];
      }
    }
    if (input.targetDate !== undefined) updateData.targetDate = input.targetDate;
    if (input.completedDate !== undefined) updateData.completedDate = input.completedDate;
    if (input.metrics !== undefined) updateData.metrics = input.metrics;

    const [milestone] = await db
      .update(roadmapMilestones)
      .set(updateData)
      .where(eq(roadmapMilestones.id, id))
      .returning();

    // Recalculate phase progress
    if (milestone) {
      await this.recalculatePhaseProgress(current.phaseId);
    }

    return milestone || null;
  }

  /**
   * Delete a milestone
   */
  async deleteMilestone(id: string) {
    // Get phase ID first
    const milestone = await this.getMilestoneById(id);
    if (!milestone) return false;

    const [deleted] = await db
      .delete(roadmapMilestones)
      .where(eq(roadmapMilestones.id, id))
      .returning({ id: roadmapMilestones.id });

    // Recalculate phase progress
    if (deleted) {
      await this.recalculatePhaseProgress(milestone.phaseId);
    }

    return !!deleted;
  }

  // ============================================
  // STATS & ANALYTICS
  // ============================================

  /**
   * Get roadmap statistics
   */
  async getStats(): Promise<RoadmapStats> {
    const phases = await db.select().from(roadmapPhases).orderBy(asc(roadmapPhases.phaseNumber));
    const milestones = await db.select().from(roadmapMilestones);

    const totalMilestones = milestones.length;
    const completedMilestones = milestones.filter((m) => m.status === 'completed').length;
    const inProgressMilestones = milestones.filter((m) => m.status === 'in_progress').length;

    // Find current phase (first in_progress or first not_started)
    const inProgressPhase = phases.find((p) => p.status === 'in_progress');
    const currentPhase = inProgressPhase?.phaseNumber || phases.find((p) => p.status === 'not_started')?.phaseNumber || 1;

    // Overall progress (average of all phases)
    const overallProgress = phases.length > 0
      ? Math.round(phases.reduce((sum, p) => sum + p.progress, 0) / phases.length)
      : 0;

    return {
      totalMilestones,
      completedMilestones,
      inProgressMilestones,
      currentPhase,
      overallProgress,
    };
  }

  // ============================================
  // SEEDING (Initial Data)
  // ============================================

  /**
   * Seed initial roadmap data if empty
   */
  async seedIfEmpty() {
    const existing = await db.select({ id: roadmapPhases.id }).from(roadmapPhases).limit(1);
    if (existing.length > 0) return false;

    // Phase 1: Acquisition & Optimization
    const phase1 = await this.createPhase({
      phaseNumber: 1,
      title: 'Acquisition & Optimization',
      subtitle: 'Build the Foundation',
      timeline: '0-12 months',
      status: 'in_progress',
      progress: 35,
      color: 'from-emerald-500 to-teal-500',
      icon: '🎯',
      goal: 'Acquire companies where our product can serve as a CTO/tech replacement',
      strategy: 'Lower expenses by replacing technical overhead with AI agents',
      outcome: 'Increased profitability through operational efficiency',
      keyMetrics: ['Cost reduction %', 'Time to integration', 'Profitability improvement'],
    });

    // Phase 2: Full Business Automation
    const phase2 = await this.createPhase({
      phaseNumber: 2,
      title: 'Full Business Automation',
      subtitle: 'Scale the Model',
      timeline: '1-3 years',
      status: 'not_started',
      progress: 0,
      color: 'from-violet-500 to-purple-500',
      icon: '🤖',
      goal: 'Build AI agents that replace/outperform human roles across all functions',
      strategy: 'Create comprehensive AI agent suite for end-to-end business operations',
      outcome: 'Fully automated business operations with minimal human oversight',
      keyMetrics: ['Functions automated', 'Performance vs human baseline', 'Client adoption'],
    });

    // Phase 3: Platform & Equity Model
    const phase3 = await this.createPhase({
      phaseNumber: 3,
      title: 'Platform & Equity Model',
      subtitle: 'Democratize Access',
      timeline: '3-5+ years',
      status: 'not_started',
      progress: 0,
      color: 'from-amber-500 to-orange-500',
      icon: '🌐',
      goal: 'Open platform where anyone can plug in their business',
      strategy: '20% equity stake in exchange for full AI business operations',
      outcome: 'Democratized access to AI-powered business management',
      keyMetrics: ['Companies onboarded', 'Total portfolio value', 'Platform revenue'],
    });

    // Phase 1 Milestones
    await this.createMilestone({
      phaseId: phase1.id,
      title: 'CRM & Lead Pipeline Setup',
      description: 'Build acquisition tracking system with Utah business data integration',
      status: 'completed',
      metrics: [{ label: 'Leads imported', target: 1000, current: 847 }],
    });
    await this.createMilestone({
      phaseId: phase1.id,
      title: 'AI Agent CTO Prototype',
      description: 'Develop initial AI agent that can replace basic CTO functions',
      status: 'in_progress',
      targetDate: '2025-03-01',
      metrics: [
        { label: 'Functions automated', target: 10, current: 4 },
        { label: 'Cost savings', target: '$50k/mo', current: '$12k/mo' },
      ],
    });
    await this.createMilestone({
      phaseId: phase1.id,
      title: 'First Acquisition',
      description: 'Complete first business acquisition and AI integration',
      status: 'pending',
      targetDate: '2025-06-01',
      metrics: [{ label: 'Target valuation', target: '$500k-2M' }],
    });
    await this.createMilestone({
      phaseId: phase1.id,
      title: 'Playbook Development',
      description: 'Document repeatable acquisition and optimization process',
      status: 'pending',
      targetDate: '2025-09-01',
    });
    await this.createMilestone({
      phaseId: phase1.id,
      title: '3 Successful Acquisitions',
      description: 'Complete three acquisitions with demonstrated profitability improvement',
      status: 'pending',
      targetDate: '2025-12-01',
      metrics: [
        { label: 'Acquisitions', target: 3, current: 0 },
        { label: 'Avg profit increase', target: '40%', current: '0%' },
      ],
    });

    // Phase 2 Milestones
    await this.createMilestone({
      phaseId: phase2.id,
      title: 'Sales AI Agent',
      description: 'Automated lead qualification, outreach, and follow-up system',
      status: 'pending',
      targetDate: '2026-03-01',
      metrics: [{ label: 'Conversion rate', target: '> human baseline' }],
    });
    await this.createMilestone({
      phaseId: phase2.id,
      title: 'Marketing AI Agent',
      description: 'Content creation, campaign management, and analytics',
      status: 'pending',
      targetDate: '2026-06-01',
    });
    await this.createMilestone({
      phaseId: phase2.id,
      title: 'Accounting AI Agent',
      description: 'Bookkeeping, invoicing, financial reporting automation',
      status: 'pending',
      targetDate: '2026-09-01',
    });
    await this.createMilestone({
      phaseId: phase2.id,
      title: 'Operations AI Agent',
      description: 'Inventory, scheduling, vendor management automation',
      status: 'pending',
      targetDate: '2026-12-01',
    });
    await this.createMilestone({
      phaseId: phase2.id,
      title: 'Customer Service AI Agent',
      description: 'Support tickets, chat, phone system automation',
      status: 'pending',
      targetDate: '2027-03-01',
    });
    await this.createMilestone({
      phaseId: phase2.id,
      title: 'Full Suite Integration',
      description: 'Unified AI business operating system',
      status: 'pending',
      targetDate: '2027-12-01',
      metrics: [
        { label: 'Businesses running on platform', target: 10 },
        { label: 'Human headcount reduction', target: '80%' },
      ],
    });

    // Phase 3 Milestones
    await this.createMilestone({
      phaseId: phase3.id,
      title: 'Self-Service Platform MVP',
      description: 'Basic onboarding flow for new businesses',
      status: 'pending',
      targetDate: '2028-06-01',
    });
    await this.createMilestone({
      phaseId: phase3.id,
      title: 'Equity Model Launch',
      description: '20% equity for full-service AI operations',
      status: 'pending',
      targetDate: '2028-12-01',
      metrics: [{ label: 'First equity deals', target: 5 }],
    });
    await this.createMilestone({
      phaseId: phase3.id,
      title: 'Industry Vertical Expansion',
      description: 'Specialized solutions for retail, services, manufacturing',
      status: 'pending',
      targetDate: '2029-06-01',
    });
    await this.createMilestone({
      phaseId: phase3.id,
      title: '100 Portfolio Companies',
      description: 'Scale to 100 businesses on the platform',
      status: 'pending',
      targetDate: '2030-01-01',
      metrics: [
        { label: 'Portfolio companies', target: 100 },
        { label: 'Combined revenue', target: '$100M' },
      ],
    });

    return true;
  }
}

export const roadmapService = new RoadmapService();

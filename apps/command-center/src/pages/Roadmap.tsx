/**
 * AI Agent Tree - Strategic Roadmap Page
 *
 * Visualizes the company strategy across three strategic phases:
 * 1. Acquisition & Optimization (0-12 months)
 * 2. Full Business Automation (1-3 years)
 * 3. Platform & Equity Model (3-5+ years)
 */

import { useState, useEffect } from 'react';
import Card from '../components/common/Card';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import {
  usePhases,
  useRoadmapStats,
  useUpdateMilestone,
  useSeedRoadmap,
} from '../hooks/useRoadmap';
import {
  type Milestone,
  type MilestoneStatus,
  type RoadmapStats,
  MILESTONE_STATUS_CONFIG,
} from '../types/roadmap';

export default function Roadmap() {
  const { data: phases, isLoading: phasesLoading, error: phasesError } = usePhases();
  const { data: stats } = useRoadmapStats();
  const updateMilestone = useUpdateMilestone();
  const seedRoadmap = useSeedRoadmap();

  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [editingMilestone, setEditingMilestone] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'cards'>('timeline');

  // Auto-expand the first in-progress phase
  useEffect(() => {
    if (phases && phases.length > 0 && expandedPhases.size === 0) {
      const inProgressPhase = phases.find((p) => p.status === 'in_progress');
      if (inProgressPhase) {
        setExpandedPhases(new Set([inProgressPhase.id]));
      } else {
        setExpandedPhases(new Set([phases[0].id]));
      }
    }
  }, [phases]);

  const togglePhaseExpanded = (phaseId: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phaseId)) {
        next.delete(phaseId);
      } else {
        next.add(phaseId);
      }
      return next;
    });
  };

  const handleMilestoneStatusChange = (milestoneId: string, status: MilestoneStatus) => {
    updateMilestone.mutate({
      id: milestoneId,
      data: { status },
    });
    setEditingMilestone(null);
  };

  const handleSeedData = () => {
    seedRoadmap.mutate();
  };

  // Loading state
  if (phasesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  // Error state
  if (phasesError) {
    return (
      <div className="space-y-6 animate-fade-in">
        <EmptyState
          icon="⚠️"
          title="Failed to load roadmap"
          description={phasesError.message}
        />
      </div>
    );
  }

  // Empty state - offer to seed data
  if (!phases || phases.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-accent to-accent-light bg-clip-text text-transparent">
              Strategic Roadmap
            </h1>
            <p className="text-text-muted mt-1">AI Agent Tree - Acquisition & Automation Pipeline</p>
          </div>
        </div>
        <Card className="text-center py-12">
          <div className="text-6xl mb-4">🌳</div>
          <h3 className="text-xl font-semibold mb-2">No Roadmap Data</h3>
          <p className="text-text-muted mb-6 max-w-md mx-auto">
            Get started by seeding the roadmap with the AI Agent Tree strategic phases and milestones.
          </p>
          <button
            onClick={handleSeedData}
            disabled={seedRoadmap.isPending}
            className="px-6 py-3 bg-accent text-white rounded-lg hover:bg-accent-light transition-colors disabled:opacity-50"
          >
            {seedRoadmap.isPending ? 'Seeding...' : 'Initialize Roadmap'}
          </button>
        </Card>
      </div>
    );
  }

  // Calculate display stats (use API stats or compute from phases)
  const displayStats: RoadmapStats = stats || {
    totalMilestones: phases.reduce((sum, p) => sum + p.milestones.length, 0),
    completedMilestones: phases.reduce(
      (sum, p) => sum + p.milestones.filter((m) => m.status === 'completed').length,
      0
    ),
    inProgressMilestones: phases.reduce(
      (sum, p) => sum + p.milestones.filter((m) => m.status === 'in_progress').length,
      0
    ),
    currentPhase: phases.find((p) => p.status === 'in_progress')?.phaseNumber || 1,
    overallProgress: Math.round(
      phases.reduce((sum, p) => sum + p.progress, 0) / phases.length
    ),
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-accent to-accent-light bg-clip-text text-transparent">
            Strategic Roadmap
          </h1>
          <p className="text-text-muted mt-1">AI Agent Tree - Acquisition & Automation Pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('timeline')}
            className={`px-4 py-2 rounded-lg transition-all ${
              viewMode === 'timeline'
                ? 'bg-accent text-white'
                : 'bg-dark-card text-text-muted hover:bg-dark-card-hover'
            }`}
          >
            Timeline
          </button>
          <button
            onClick={() => setViewMode('cards')}
            className={`px-4 py-2 rounded-lg transition-all ${
              viewMode === 'cards'
                ? 'bg-accent text-white'
                : 'bg-dark-card text-text-muted hover:bg-dark-card-hover'
            }`}
          >
            Cards
          </button>
        </div>
      </div>

      {/* Overall Progress */}
      <Card className="bg-gradient-to-r from-dark-card to-dark-card-hover">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Overall Progress</h2>
            <p className="text-sm text-text-muted">Currently in Phase {displayStats.currentPhase}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-accent">{displayStats.overallProgress}%</div>
            <p className="text-sm text-text-muted">
              {displayStats.completedMilestones}/{displayStats.totalMilestones} milestones
            </p>
          </div>
        </div>
        <div className="h-3 bg-dark-bg rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent to-accent-light transition-all duration-500"
            style={{ width: `${displayStats.overallProgress}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-text-muted">
          <span>Phase 1: Acquisition</span>
          <span>Phase 2: Automation</span>
          <span>Phase 3: Platform</span>
        </div>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Milestones" value={displayStats.totalMilestones} icon="🎯" />
        <StatCard label="Completed" value={displayStats.completedMilestones} icon="✅" color="green" />
        <StatCard label="In Progress" value={displayStats.inProgressMilestones} icon="🚧" color="purple" />
        <StatCard
          label="Current Phase"
          value={displayStats.currentPhase}
          icon={phases[displayStats.currentPhase - 1]?.icon || '📍'}
          color="blue"
        />
      </div>

      {/* Timeline View */}
      {viewMode === 'timeline' ? (
        <div className="relative">
          {/* Timeline Line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-dark-border" />

          {phases.map((phase, index) => (
            <div key={phase.id} className="relative mb-8 last:mb-0">
              {/* Phase Node */}
              <div
                className={`absolute left-4 w-8 h-8 rounded-full flex items-center justify-center text-lg
                  ${phase.status === 'completed' ? 'bg-success' : phase.status === 'in_progress' ? 'bg-accent' : 'bg-dark-card-hover'}
                  border-4 border-dark-bg z-10`}
              >
                {phase.icon}
              </div>

              {/* Phase Card */}
              <div className="ml-16">
                <Card
                  className={`cursor-pointer transition-all hover:border-accent/50 ${
                    expandedPhases.has(phase.id) ? 'border-accent/30' : ''
                  }`}
                  onClick={() => togglePhaseExpanded(phase.id)}
                >
                  {/* Phase Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium bg-gradient-to-r ${phase.color} text-white`}
                        >
                          Phase {phase.phaseNumber}
                        </span>
                        <span className="text-sm text-text-muted">{phase.timeline}</span>
                        <PhaseStatusBadge status={phase.status} />
                      </div>
                      <h3 className="text-xl font-semibold mb-1">{phase.title}</h3>
                      <p className="text-text-muted">{phase.subtitle}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{phase.progress}%</div>
                      <p className="text-sm text-text-muted">
                        {phase.milestones.filter((m) => m.status === 'completed').length}/
                        {phase.milestones.length}
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-2 bg-dark-bg rounded-full overflow-hidden mt-4">
                    <div
                      className={`h-full bg-gradient-to-r ${phase.color} transition-all duration-500`}
                      style={{ width: `${phase.progress}%` }}
                    />
                  </div>

                  {/* Expanded Content */}
                  {expandedPhases.has(phase.id) && (
                    <div className="mt-6 pt-6 border-t border-dark-border animate-fade-in">
                      {/* Goals & Strategy */}
                      <div className="grid md:grid-cols-3 gap-4 mb-6">
                        <div className="p-4 bg-dark-bg rounded-lg">
                          <h4 className="text-sm font-medium text-text-muted mb-1">Goal</h4>
                          <p className="text-sm">{phase.goal}</p>
                        </div>
                        <div className="p-4 bg-dark-bg rounded-lg">
                          <h4 className="text-sm font-medium text-text-muted mb-1">Strategy</h4>
                          <p className="text-sm">{phase.strategy}</p>
                        </div>
                        <div className="p-4 bg-dark-bg rounded-lg">
                          <h4 className="text-sm font-medium text-text-muted mb-1">Outcome</h4>
                          <p className="text-sm">{phase.outcome}</p>
                        </div>
                      </div>

                      {/* Key Metrics */}
                      <div className="mb-6">
                        <h4 className="text-sm font-medium text-text-muted mb-2">Key Metrics</h4>
                        <div className="flex flex-wrap gap-2">
                          {phase.keyMetrics.map((metric) => (
                            <span
                              key={metric}
                              className="px-3 py-1 bg-dark-bg rounded-full text-sm"
                            >
                              {metric}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Milestones */}
                      <div>
                        <h4 className="text-sm font-medium text-text-muted mb-3">Milestones</h4>
                        <div className="space-y-3">
                          {phase.milestones.map((milestone) => (
                            <MilestoneCard
                              key={milestone.id}
                              milestone={milestone}
                              isEditing={editingMilestone === milestone.id}
                              isUpdating={updateMilestone.isPending}
                              onEdit={() => setEditingMilestone(milestone.id)}
                              onStatusChange={(status) =>
                                handleMilestoneStatusChange(milestone.id, status)
                              }
                              onCancel={() => setEditingMilestone(null)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Expand/Collapse Indicator */}
                  <div className="flex justify-center mt-4">
                    <svg
                      className={`w-5 h-5 text-text-muted transition-transform ${
                        expandedPhases.has(phase.id) ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </Card>
              </div>

              {/* Connection to next phase */}
              {index < phases.length - 1 && (
                <div className="absolute left-[1.9rem] top-8 h-full w-0.5">
                  <div
                    className={`h-full ${
                      phase.status === 'completed' ? 'bg-success' : 'bg-dark-border'
                    }`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        /* Cards View */
        <div className="grid md:grid-cols-3 gap-6">
          {phases.map((phase) => (
            <Card key={phase.id} className="flex flex-col">
              {/* Phase Header */}
              <div className={`h-2 bg-gradient-to-r ${phase.color} rounded-t-lg -mx-6 -mt-6 mb-4`} />
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl">{phase.icon}</span>
                <PhaseStatusBadge status={phase.status} />
              </div>
              <h3 className="text-xl font-semibold mb-1">{phase.title}</h3>
              <p className="text-sm text-text-muted mb-4">{phase.timeline}</p>

              {/* Progress */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Progress</span>
                  <span className="font-medium">{phase.progress}%</span>
                </div>
                <div className="h-2 bg-dark-bg rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${phase.color} transition-all duration-500`}
                    style={{ width: `${phase.progress}%` }}
                  />
                </div>
              </div>

              {/* Goal */}
              <p className="text-sm text-text-muted mb-4 flex-1">{phase.goal}</p>

              {/* Milestones Summary */}
              <div className="pt-4 border-t border-dark-border">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Milestones</span>
                  <span>
                    <span className="text-success">
                      {phase.milestones.filter((m) => m.status === 'completed').length}
                    </span>
                    <span className="text-text-muted"> / {phase.milestones.length}</span>
                  </span>
                </div>
                <div className="flex gap-1 mt-2">
                  {phase.milestones.map((m) => (
                    <div
                      key={m.id}
                      className={`h-1.5 flex-1 rounded-full ${
                        m.status === 'completed'
                          ? 'bg-success'
                          : m.status === 'in_progress'
                            ? 'bg-accent'
                            : 'bg-dark-border'
                      }`}
                      title={m.title}
                    />
                  ))}
                </div>
              </div>

              {/* View Details Button */}
              <button
                onClick={() => {
                  setViewMode('timeline');
                  setExpandedPhases(new Set([phase.id]));
                }}
                className="mt-4 w-full py-2 text-center text-sm text-accent hover:text-accent-light transition-colors"
              >
                View Details →
              </button>
            </Card>
          ))}
        </div>
      )}

      {/* Vision Statement */}
      <Card className="text-center py-8 bg-gradient-to-br from-dark-card via-dark-card to-accent/5">
        <div className="text-4xl mb-4">🌳</div>
        <h3 className="text-xl font-semibold mb-2">AI Agent Tree Vision</h3>
        <p className="text-text-muted max-w-2xl mx-auto">
          Building the future of business operations through AI. From targeted acquisitions to a
          platform that democratizes access to AI-powered business management for everyone.
        </p>
        <div className="flex justify-center gap-8 mt-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">20%</div>
            <div className="text-sm text-text-muted">Equity Model</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">100+</div>
            <div className="text-sm text-text-muted">Portfolio Goal</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-accent">$100M</div>
            <div className="text-sm text-text-muted">Revenue Target</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// Phase Status Badge Component
function PhaseStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; classes: string }> = {
    not_started: { label: 'Not Started', classes: 'bg-dark-card-hover text-text-muted' },
    in_progress: { label: 'In Progress', classes: 'bg-accent/20 text-accent' },
    completed: { label: 'Completed', classes: 'bg-success/20 text-success' },
  };
  const { label, classes } = config[status] || config.not_started;
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${classes}`}>{label}</span>;
}

// Milestone Card Component
function MilestoneCard({
  milestone,
  isEditing,
  isUpdating,
  onEdit,
  onStatusChange,
  onCancel,
}: {
  milestone: Milestone;
  isEditing: boolean;
  isUpdating: boolean;
  onEdit: () => void;
  onStatusChange: (status: MilestoneStatus) => void;
  onCancel: () => void;
}) {
  const statusConfig = MILESTONE_STATUS_CONFIG[milestone.status as MilestoneStatus] || MILESTONE_STATUS_CONFIG.pending;

  return (
    <div
      className={`p-4 rounded-lg border transition-all ${
        milestone.status === 'completed'
          ? 'bg-success/5 border-success/20'
          : milestone.status === 'in_progress'
            ? 'bg-accent/5 border-accent/20'
            : 'bg-dark-bg border-dark-border'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`w-2 h-2 rounded-full ${
                milestone.status === 'completed'
                  ? 'bg-success'
                  : milestone.status === 'in_progress'
                    ? 'bg-accent animate-pulse'
                    : 'bg-dark-border'
              }`}
            />
            <h5 className="font-medium">{milestone.title}</h5>
          </div>
          {milestone.description && (
            <p className="text-sm text-text-muted mb-2">{milestone.description}</p>
          )}

          {/* Metrics */}
          {milestone.metrics && milestone.metrics.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {milestone.metrics.map((metric) => (
                <span
                  key={metric.label}
                  className="px-2 py-1 bg-dark-card rounded text-xs"
                >
                  {metric.label}: {metric.current !== undefined ? `${metric.current} / ` : ''}
                  {metric.target}
                </span>
              ))}
            </div>
          )}

          {/* Dates */}
          <div className="flex items-center gap-4 text-xs text-text-muted">
            {milestone.targetDate && (
              <span>Target: {new Date(milestone.targetDate).toLocaleDateString()}</span>
            )}
            {milestone.completedDate && (
              <span className="text-success">
                Completed: {new Date(milestone.completedDate).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {/* Status / Edit */}
        <div className="flex items-center gap-2">
          {isEditing ? (
            <div className="flex flex-col gap-1">
              {(['completed', 'in_progress', 'pending', 'blocked'] as MilestoneStatus[]).map(
                (status) => (
                  <button
                    key={status}
                    onClick={() => onStatusChange(status)}
                    disabled={isUpdating}
                    className={`px-3 py-1 rounded text-xs ${MILESTONE_STATUS_CONFIG[status].bgColor} ${MILESTONE_STATUS_CONFIG[status].color} disabled:opacity-50`}
                  >
                    {MILESTONE_STATUS_CONFIG[status].label}
                  </button>
                )
              )}
              <button
                onClick={onCancel}
                className="px-3 py-1 rounded text-xs bg-dark-card hover:bg-dark-card-hover"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={onEdit}
              className={`px-3 py-1 rounded text-xs ${statusConfig.bgColor} ${statusConfig.color} hover:opacity-80 transition-opacity`}
            >
              {statusConfig.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon?: string;
  color?: string;
}) {
  const colorClasses: Record<string, string> = {
    purple: 'text-accent',
    green: 'text-success',
    red: 'text-error',
    blue: 'text-blue-400',
    yellow: 'text-warning',
  };

  return (
    <Card className="text-center">
      <div className={`text-2xl font-bold ${color ? colorClasses[color] : 'text-white'}`}>
        {icon && <span className="mr-1">{icon}</span>}
        {value}
      </div>
      <div className="text-sm text-text-muted mt-1">{label}</div>
    </Card>
  );
}

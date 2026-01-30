/**
 * PipelineBoard Component
 *
 * Kanban-style board view for acquisition pipeline stages.
 * Click on a lead to view details, use the stage selector to move leads.
 */

import { useState } from 'react';
import {
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_COLORS,
  type PipelineStage,
  type AcquisitionLead,
} from '../../types/acquisition';
import { useChangeStage, useToggleFavorite, useToggleHot } from '../../hooks/useAcquisition';

interface PipelineBoardProps {
  leads: AcquisitionLead[];
  onSelectLead: (id: string) => void;
  selectedLeadId?: string;
}

// Active pipeline stages (excluding closed states for main board)
const ACTIVE_STAGES: PipelineStage[] = [
  'new',
  'researching',
  'qualified',
  'outreach',
  'conversation',
  'negotiating',
];

export default function PipelineBoard({
  leads,
  onSelectLead,
  selectedLeadId,
}: PipelineBoardProps) {
  const changeStage = useChangeStage();
  const toggleFavorite = useToggleFavorite();
  const toggleHot = useToggleHot();
  const [movingLead, setMovingLead] = useState<string | null>(null);

  // Group leads by stage
  const leadsByStage = ACTIVE_STAGES.reduce(
    (acc, stage) => {
      acc[stage] = leads.filter((lead) => lead.pipelineStage === stage);
      return acc;
    },
    {} as Record<PipelineStage, AcquisitionLead[]>
  );

  const handleMoveToStage = async (leadId: string, newStage: PipelineStage) => {
    setMovingLead(leadId);
    try {
      await changeStage.mutateAsync({ id: leadId, data: { stage: newStage } });
    } finally {
      setMovingLead(null);
    }
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {ACTIVE_STAGES.map((stage) => (
        <PipelineColumn
          key={stage}
          stage={stage}
          leads={leadsByStage[stage]}
          selectedLeadId={selectedLeadId}
          movingLeadId={movingLead}
          onSelectLead={onSelectLead}
          onMoveToStage={handleMoveToStage}
          onToggleFavorite={(id) => toggleFavorite.mutate(id)}
          onToggleHot={(id) => toggleHot.mutate(id)}
        />
      ))}
    </div>
  );
}

interface PipelineColumnProps {
  stage: PipelineStage;
  leads: AcquisitionLead[];
  selectedLeadId?: string;
  movingLeadId: string | null;
  onSelectLead: (id: string) => void;
  onMoveToStage: (leadId: string, stage: PipelineStage) => void;
  onToggleFavorite: (id: string) => void;
  onToggleHot: (id: string) => void;
}

function PipelineColumn({
  stage,
  leads,
  selectedLeadId,
  movingLeadId,
  onSelectLead,
  onMoveToStage,
  onToggleFavorite,
  onToggleHot,
}: PipelineColumnProps) {
  return (
    <div className="flex-shrink-0 w-72">
      {/* Column Header */}
      <div className={`px-3 py-2 rounded-t-lg ${PIPELINE_STAGE_COLORS[stage]}`}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{PIPELINE_STAGE_LABELS[stage]}</h3>
          <span className="text-sm opacity-75">{leads.length}</span>
        </div>
      </div>

      {/* Column Content */}
      <div className="bg-dark-card rounded-b-lg min-h-96 p-2 space-y-2">
        {leads.length === 0 ? (
          <div className="text-center text-text-muted py-8 text-sm">
            No leads in this stage
          </div>
        ) : (
          leads.map((lead) => (
            <PipelineCard
              key={lead.id}
              lead={lead}
              isSelected={lead.id === selectedLeadId}
              isMoving={lead.id === movingLeadId}
              currentStage={stage}
              onSelect={() => onSelectLead(lead.id)}
              onMoveToStage={(newStage) => onMoveToStage(lead.id, newStage)}
              onToggleFavorite={() => onToggleFavorite(lead.id)}
              onToggleHot={() => onToggleHot(lead.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface PipelineCardProps {
  lead: AcquisitionLead;
  isSelected: boolean;
  isMoving: boolean;
  currentStage: PipelineStage;
  onSelect: () => void;
  onMoveToStage: (stage: PipelineStage) => void;
  onToggleFavorite: () => void;
  onToggleHot: () => void;
}

function PipelineCard({
  lead,
  isSelected,
  isMoving,
  currentStage,
  onSelect,
  onMoveToStage,
  onToggleFavorite,
  onToggleHot,
}: PipelineCardProps) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  const scoreColor =
    lead.acquisitionScore !== null
      ? lead.acquisitionScore >= 70
        ? 'text-green-400'
        : lead.acquisitionScore >= 50
          ? 'text-yellow-400'
          : 'text-gray-400'
      : 'text-gray-500';

  // Get next logical stage
  const currentIndex = ACTIVE_STAGES.indexOf(currentStage);
  const nextStage = currentIndex < ACTIVE_STAGES.length - 1 ? ACTIVE_STAGES[currentIndex + 1] : null;
  const prevStage = currentIndex > 0 ? ACTIVE_STAGES[currentIndex - 1] : null;

  return (
    <div
      className={`bg-dark-bg rounded-lg p-3 cursor-pointer transition-all hover:bg-dark-card-hover ${
        isSelected ? 'ring-2 ring-accent' : ''
      } ${isMoving ? 'opacity-50' : ''}`}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{lead.businessName}</h4>
          {lead.dbaName && (
            <p className="text-xs text-text-muted truncate">DBA: {lead.dbaName}</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {lead.isFavorite && <span className="text-yellow-400 text-xs">⭐</span>}
          {lead.isHot && <span className="text-xs">🔥</span>}
        </div>
      </div>

      {/* Meta info */}
      <div className="flex items-center gap-2 text-xs text-text-muted mb-2">
        <span>{lead.entityType || 'Unknown'}</span>
        {lead.businessAge && (
          <>
            <span>•</span>
            <span>{lead.businessAge}y</span>
          </>
        )}
      </div>

      {/* Score */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {lead.acquisitionScore !== null && (
            <span className={`text-sm font-bold ${scoreColor}`}>
              {lead.acquisitionScore}
            </span>
          )}
          {lead.automationPotential && (
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${
                lead.automationPotential === 'high'
                  ? 'bg-green-500/20 text-green-400'
                  : lead.automationPotential === 'medium'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-gray-500/20 text-gray-400'
              }`}
            >
              {lead.automationPotential}
            </span>
          )}
        </div>

        {/* Ratings */}
        <div className="flex items-center gap-2 text-xs">
          {lead.googleRating && (
            <span className="flex items-center gap-0.5">
              <span className="text-yellow-400">★</span>
              {lead.googleRating.toFixed(1)}
            </span>
          )}
          {lead.yelpRating && (
            <span className="flex items-center gap-0.5">
              <span className="text-red-400">★</span>
              {lead.yelpRating.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      {/* Follow-up indicator */}
      {lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) <= new Date() && (
        <div className="text-xs text-orange-400 flex items-center gap-1 mb-2">
          <span>📅</span>
          Follow-up due
        </div>
      )}

      {/* Quick Actions */}
      <div
        className="flex items-center justify-between pt-2 border-t border-dark-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleFavorite}
            className={`p-1 rounded hover:bg-dark-card transition-colors ${
              lead.isFavorite ? 'text-yellow-400' : 'text-gray-500 hover:text-yellow-400'
            }`}
            title={lead.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            ⭐
          </button>
          <button
            onClick={onToggleHot}
            className={`p-1 rounded hover:bg-dark-card transition-colors ${
              lead.isHot ? 'text-red-400' : 'text-gray-500 hover:text-red-400'
            }`}
            title={lead.isHot ? 'Unmark as hot' : 'Mark as hot'}
          >
            🔥
          </button>
        </div>

        {/* Move buttons */}
        <div className="flex items-center gap-1">
          {prevStage && (
            <button
              onClick={() => onMoveToStage(prevStage)}
              className="p-1 text-gray-500 hover:text-white hover:bg-dark-card rounded transition-colors"
              title={`Move to ${PIPELINE_STAGE_LABELS[prevStage]}`}
              disabled={isMoving}
            >
              ←
            </button>
          )}
          <button
            onClick={() => setShowMoveMenu(!showMoveMenu)}
            className="px-2 py-1 text-xs text-gray-500 hover:text-white hover:bg-dark-card rounded transition-colors"
            title="Move to stage..."
          >
            ⋮
          </button>
          {nextStage && (
            <button
              onClick={() => onMoveToStage(nextStage)}
              className="p-1 text-gray-500 hover:text-white hover:bg-dark-card rounded transition-colors"
              title={`Move to ${PIPELINE_STAGE_LABELS[nextStage]}`}
              disabled={isMoving}
            >
              →
            </button>
          )}
        </div>
      </div>

      {/* Move Menu Dropdown */}
      {showMoveMenu && (
        <div className="mt-2 p-2 bg-dark-card rounded-lg border border-dark-border">
          <p className="text-xs text-text-muted mb-2">Move to:</p>
          <div className="flex flex-wrap gap-1">
            {ACTIVE_STAGES.filter((s) => s !== currentStage).map((stage) => (
              <button
                key={stage}
                onClick={() => {
                  onMoveToStage(stage);
                  setShowMoveMenu(false);
                }}
                className={`px-2 py-1 text-xs rounded transition-colors ${PIPELINE_STAGE_COLORS[stage]} hover:opacity-80`}
                disabled={isMoving}
              >
                {PIPELINE_STAGE_LABELS[stage]}
              </button>
            ))}
            <button
              onClick={() => {
                onMoveToStage('passed');
                setShowMoveMenu(false);
              }}
              className="px-2 py-1 text-xs rounded bg-gray-500/20 text-gray-400 hover:opacity-80"
              disabled={isMoving}
            >
              Pass
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

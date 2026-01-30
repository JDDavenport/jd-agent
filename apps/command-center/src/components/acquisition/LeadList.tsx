/**
 * LeadList Component
 *
 * Displays a list of acquisition leads with quick actions.
 */

import Card from '../common/Card';
import {
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_COLORS,
  type AcquisitionLead,
} from '../../types/acquisition';

interface LeadListProps {
  leads: AcquisitionLead[];
  selectedLeadId?: string;
  onSelectLead: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onToggleHot: (id: string) => void;
}

export default function LeadList({
  leads,
  selectedLeadId,
  onSelectLead,
  onToggleFavorite,
  onToggleHot,
}: LeadListProps) {
  return (
    <div className="space-y-2">
      {leads.map((lead) => (
        <LeadRow
          key={lead.id}
          lead={lead}
          isSelected={lead.id === selectedLeadId}
          onSelect={() => onSelectLead(lead.id)}
          onToggleFavorite={() => onToggleFavorite(lead.id)}
          onToggleHot={() => onToggleHot(lead.id)}
        />
      ))}
    </div>
  );
}

interface LeadRowProps {
  lead: AcquisitionLead;
  isSelected: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
  onToggleHot: () => void;
}

function LeadRow({ lead, isSelected, onSelect, onToggleFavorite, onToggleHot }: LeadRowProps) {
  const hasScore = lead.acquisitionScore !== null;
  const scoreColor = hasScore
    ? lead.acquisitionScore! >= 70
      ? 'text-green-400'
      : lead.acquisitionScore! >= 50
        ? 'text-yellow-400'
        : 'text-gray-400'
    : 'text-gray-500';

  return (
    <Card
      className={`cursor-pointer transition-all hover:bg-dark-card-hover ${
        isSelected ? 'ring-2 ring-accent' : ''
      }`}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between gap-4">
        {/* Left: Business Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{lead.businessName}</h3>
            {lead.isFavorite && <span className="text-yellow-400">⭐</span>}
            {lead.isHot && <span>🔥</span>}
          </div>
          <div className="flex items-center gap-3 text-sm text-text-muted mt-1">
            <span>{lead.entityType || 'Unknown Type'}</span>
            <span>•</span>
            <span>{lead.businessAge ? `${lead.businessAge} years` : 'Age unknown'}</span>
            {lead.statusDetails && (
              <>
                <span>•</span>
                <span className={lead.statusDetails === 'Current' ? 'text-green-400' : 'text-yellow-400'}>
                  {lead.statusDetails}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Middle: Score */}
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className={`text-lg font-bold ${scoreColor}`}>
              {hasScore ? lead.acquisitionScore : '—'}
            </div>
            <div className="text-xs text-text-muted">Score</div>
          </div>
        </div>

        {/* Right: Stage & Actions */}
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${PIPELINE_STAGE_COLORS[lead.pipelineStage]}`}
          >
            {PIPELINE_STAGE_LABELS[lead.pipelineStage]}
          </span>

          {/* Quick Actions */}
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={onToggleFavorite}
              className={`p-1.5 rounded hover:bg-dark-bg transition-colors ${
                lead.isFavorite ? 'text-yellow-400' : 'text-gray-500 hover:text-yellow-400'
              }`}
              title={lead.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              ⭐
            </button>
            <button
              onClick={onToggleHot}
              className={`p-1.5 rounded hover:bg-dark-bg transition-colors ${
                lead.isHot ? 'text-red-400' : 'text-gray-500 hover:text-red-400'
              }`}
              title={lead.isHot ? 'Unmark as hot' : 'Mark as hot'}
            >
              🔥
            </button>
          </div>
        </div>
      </div>

      {/* Follow-up indicator */}
      {lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) <= new Date() && (
        <div className="mt-2 pt-2 border-t border-dark-border">
          <span className="text-xs text-orange-400 flex items-center gap-1">
            <span>📅</span>
            Follow-up due: {new Date(lead.nextFollowUpAt).toLocaleDateString()}
          </span>
        </div>
      )}

      {/* Enrichment data preview */}
      {(lead.googleRating || lead.yelpRating || lead.websiteUrl) && (
        <div className="mt-2 pt-2 border-t border-dark-border flex items-center gap-4 text-sm text-text-muted">
          {lead.googleRating && (
            <span className="flex items-center gap-1">
              <span className="text-yellow-400">★</span>
              {lead.googleRating.toFixed(1)} Google
            </span>
          )}
          {lead.yelpRating && (
            <span className="flex items-center gap-1">
              <span className="text-red-400">★</span>
              {lead.yelpRating.toFixed(1)} Yelp
            </span>
          )}
          {lead.websiteUrl && (
            <a
              href={lead.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              🌐 Website
            </a>
          )}
        </div>
      )}
    </Card>
  );
}

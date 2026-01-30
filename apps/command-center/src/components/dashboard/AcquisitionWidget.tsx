/**
 * AcquisitionWidget - Dashboard Widget
 *
 * Compact dashboard widget showing acquisition pipeline status:
 * - Pipeline summary (counts by stage)
 * - Hot leads needing attention
 * - Upcoming follow-ups
 * - Recent high-score discoveries
 */

import { Link } from 'react-router-dom';
import {
  useAcquisitionStats,
  useHotLeads,
  useFollowUps,
  useTopLeads,
} from '../../hooks/useAcquisition';
import {
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_COLORS,
  type AcquisitionLead,
} from '../../types/acquisition';
import LoadingSpinner from '../common/LoadingSpinner';
import { CollapsibleSection } from './shared';

// Compact lead item for lists
function LeadItem({ lead, badge }: { lead: AcquisitionLead; badge?: React.ReactNode }) {
  const scoreColor =
    lead.acquisitionScore !== null
      ? lead.acquisitionScore >= 70
        ? 'text-green-400'
        : lead.acquisitionScore >= 50
          ? 'text-yellow-400'
          : 'text-gray-400'
      : 'text-gray-500';

  return (
    <div className="flex items-center justify-between p-2 bg-dark-bg rounded-lg hover:bg-dark-card-hover transition-colors group">
      <div className="flex-1 min-w-0 mr-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate group-hover:text-accent transition-colors">
            {lead.businessName}
          </span>
          {badge}
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
          <span className={PIPELINE_STAGE_COLORS[lead.pipelineStage].split(' ')[1]}>
            {PIPELINE_STAGE_LABELS[lead.pipelineStage]}
          </span>
          {lead.entityType && (
            <>
              <span>•</span>
              <span>{lead.entityType}</span>
            </>
          )}
        </div>
      </div>
      {lead.acquisitionScore !== null && (
        <span className={`text-sm font-bold ${scoreColor}`}>
          {lead.acquisitionScore}
        </span>
      )}
    </div>
  );
}

// Pipeline stage bar visualization
function PipelineBar({ stats }: { stats: Record<string, number> }) {
  const stages = ['new', 'researching', 'qualified', 'outreach', 'conversation', 'negotiating'] as const;
  const total = Object.values(stats).reduce((sum, count) => sum + count, 0);

  if (total === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden bg-dark-bg">
        {stages.map((stage) => {
          const count = stats[stage] || 0;
          const percentage = (count / total) * 100;
          if (percentage === 0) return null;

          // Extract background color from the stage color class
          const bgColor = PIPELINE_STAGE_COLORS[stage].split(' ')[0];

          return (
            <div
              key={stage}
              className={`${bgColor} transition-all`}
              style={{ width: `${percentage}%` }}
              title={`${PIPELINE_STAGE_LABELS[stage]}: ${count}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {stages.map((stage) => {
          const count = stats[stage] || 0;
          if (count === 0) return null;

          return (
            <div key={stage} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${PIPELINE_STAGE_COLORS[stage].split(' ')[0]}`} />
              <span className="text-text-muted">
                {PIPELINE_STAGE_LABELS[stage]}: {count}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AcquisitionWidget() {
  const { data: stats, isLoading: statsLoading } = useAcquisitionStats();
  const { data: hotLeads, isLoading: hotLoading } = useHotLeads(5);
  const { data: followUps, isLoading: followUpsLoading } = useFollowUps(5);
  const { data: topLeads, isLoading: topLoading } = useTopLeads(5, 60);

  const isLoading = statsLoading || hotLoading || followUpsLoading || topLoading;

  if (isLoading) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Acquisition Pipeline</h2>
        </div>
        <LoadingSpinner />
      </div>
    );
  }

  const hasHotLeads = (hotLeads?.length || 0) > 0;
  const hasFollowUps = (followUps?.length || 0) > 0;
  const hasTopLeads = (topLeads?.length || 0) > 0;
  const totalLeads = stats?.total || 0;

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Acquisition Pipeline</h2>
          {stats && stats.avgScore > 0 && (
            <p className="text-xs text-text-muted mt-0.5">
              Avg score: {stats.avgScore}/100
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {stats && stats.hot > 0 && (
            <span className="badge badge-warning text-xs">
              {stats.hot} hot
            </span>
          )}
          <Link
            to="/acquisition"
            className="text-xs text-accent hover:text-accent-light transition-colors"
          >
            View all →
          </Link>
        </div>
      </div>

      {/* Pipeline Summary */}
      {totalLeads === 0 ? (
        <div className="text-center py-6">
          <div className="text-4xl mb-2">🏢</div>
          <p className="text-text-muted text-sm">No leads yet</p>
          <Link
            to="/acquisition"
            className="text-xs text-accent hover:text-accent-light mt-2 inline-block"
          >
            Import businesses →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Pipeline Bar */}
          {stats && <PipelineBar stats={stats.byStage} />}

          {/* Quick Stats Row */}
          <div className="grid grid-cols-3 gap-2 text-center py-2 border-y border-dark-border">
            <div>
              <div className="text-lg font-bold text-white">{totalLeads}</div>
              <div className="text-xs text-text-muted">Total</div>
            </div>
            <div>
              <div className="text-lg font-bold text-purple-400">
                {stats?.byStage.qualified || 0}
              </div>
              <div className="text-xs text-text-muted">Qualified</div>
            </div>
            <div>
              <div className="text-lg font-bold text-orange-400">
                {stats?.needsFollowUp || 0}
              </div>
              <div className="text-xs text-text-muted">Follow-ups</div>
            </div>
          </div>

          {/* Hot Leads */}
          {hasHotLeads && (
            <CollapsibleSection
              title="Hot Leads"
              count={hotLeads!.length}
              headerColor="text-red-400"
              icon={<span>🔥</span>}
              defaultOpen={true}
            >
              {hotLeads!.map((lead) => (
                <LeadItem key={lead.id} lead={lead} />
              ))}
            </CollapsibleSection>
          )}

          {/* Follow-ups Due */}
          {hasFollowUps && (
            <CollapsibleSection
              title="Follow-ups Due"
              count={followUps!.length}
              headerColor="text-orange-400"
              icon={<span>📅</span>}
              defaultOpen={!hasHotLeads}
            >
              {followUps!.map((lead) => (
                <LeadItem
                  key={lead.id}
                  lead={lead}
                  badge={
                    lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) < new Date() ? (
                      <span className="text-xs text-orange-400">overdue</span>
                    ) : null
                  }
                />
              ))}
            </CollapsibleSection>
          )}

          {/* Top Scored Leads */}
          {hasTopLeads && (
            <CollapsibleSection
              title="Top Prospects"
              count={topLeads!.length}
              headerColor="text-green-400"
              icon={<span>⭐</span>}
              defaultOpen={!hasHotLeads && !hasFollowUps}
            >
              {topLeads!.map((lead) => (
                <LeadItem key={lead.id} lead={lead} />
              ))}
            </CollapsibleSection>
          )}
        </div>
      )}
    </div>
  );
}

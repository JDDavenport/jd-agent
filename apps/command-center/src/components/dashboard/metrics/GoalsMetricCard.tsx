/**
 * GoalsMetricCard
 *
 * Displays active goals count with overall progress.
 * Shows goals by life area breakdown.
 */

import MetricCardBase from '../shared/MetricCardBase';
import ProgressBar from '../shared/ProgressBar';
import type { GoalsMetric } from '../../../types/dashboard';

interface GoalsMetricCardProps {
  data: GoalsMetric | undefined;
  isLoading?: boolean;
  error?: Error | null;
}

// Life area icons
const AREA_ICONS: Record<string, string> = {
  spiritual: '🙏',
  personal: '🌟',
  fitness: '💪',
  family: '👨‍👩‍👧‍👦',
  professional: '💼',
  school: '📚',
};

export function GoalsMetricCard({ data, isLoading, error }: GoalsMetricCardProps) {
  return (
    <MetricCardBase
      title="Goals & Progress"
      value={data?.active || 0}
      icon="🎯"
      color="text-accent"
      href="/goals"
      isLoading={isLoading}
      error={error}
      tooltip="Click to view all goals"
    >
      {data && (
        <div className="space-y-2">
          {/* Overall progress */}
          <div className="flex items-center gap-2">
            <ProgressBar
              value={data.overallProgress}
              color={
                data.overallProgress >= 75
                  ? 'bg-success'
                  : data.overallProgress >= 50
                  ? 'bg-accent'
                  : data.overallProgress >= 25
                  ? 'bg-warning'
                  : 'bg-error'
              }
              size="sm"
            />
            <span className="text-xs text-text-muted whitespace-nowrap">
              {data.overallProgress}%
            </span>
          </div>

          {/* Life area breakdown */}
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(data.byArea).map(([area, count]) => (
              <span
                key={area}
                className="flex items-center gap-0.5 text-xs text-text-muted"
                title={`${area}: ${count} goal${count !== 1 ? 's' : ''}`}
              >
                <span>{AREA_ICONS[area] || '📋'}</span>
                <span>{count}</span>
              </span>
            ))}
          </div>

          {/* Alerts */}
          {data.needsAttention > 0 && (
            <p className="text-xs text-warning">
              {data.needsAttention} need{data.needsAttention === 1 ? 's' : ''} attention
            </p>
          )}
        </div>
      )}
    </MetricCardBase>
  );
}

export default GoalsMetricCard;

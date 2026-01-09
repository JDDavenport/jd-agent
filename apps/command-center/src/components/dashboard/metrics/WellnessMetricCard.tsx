/**
 * WellnessMetricCard
 *
 * Displays recovery score and wellness status.
 * Shows recommendation based on recovery status.
 */

import MetricCardBase from '../shared/MetricCardBase';
import type { WellnessMetric, WellnessStatus } from '../../../types/dashboard';

interface WellnessMetricCardProps {
  data: WellnessMetric | undefined;
  isLoading?: boolean;
  error?: Error | null;
}

// Status colors and icons
const STATUS_CONFIG: Record<
  WellnessStatus,
  { color: string; icon: string; label: string }
> = {
  excellent: { color: 'text-success', icon: '💚', label: 'Excellent' },
  good: { color: 'text-accent', icon: '💙', label: 'Good' },
  fair: { color: 'text-warning', icon: '💛', label: 'Fair' },
  poor: { color: 'text-error', icon: '❤️', label: 'Poor' },
  unknown: { color: 'text-text-muted', icon: '❓', label: 'Unknown' },
  not_configured: { color: 'text-text-muted', icon: '⚙️', label: 'Not Set Up' },
};

export function WellnessMetricCard({ data, isLoading, error }: WellnessMetricCardProps) {
  const status = data?.status || 'unknown';
  const config = STATUS_CONFIG[status];

  // Format display value
  const displayValue =
    data?.recoveryScore !== null && data?.recoveryScore !== undefined
      ? data.recoveryScore
      : '—';

  return (
    <MetricCardBase
      title="Recovery"
      value={displayValue}
      icon={config.icon}
      color={config.color}
      href="/personal-health"
      isLoading={isLoading}
      error={error}
      tooltip="Click to view personal health"
    >
      {data && (
        <div className="space-y-2">
          {/* Status badge */}
          <div className="flex items-center justify-between">
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                status === 'excellent'
                  ? 'bg-success/20 text-success'
                  : status === 'good'
                  ? 'bg-accent/20 text-accent'
                  : status === 'fair'
                  ? 'bg-warning/20 text-warning'
                  : status === 'poor'
                  ? 'bg-error/20 text-error'
                  : 'bg-dark-border text-text-muted'
              }`}
            >
              {config.label}
            </span>
            {data.sleepHours !== null && data.sleepHours !== undefined && (
              <span className="text-xs text-text-muted">
                🛏️ {data.sleepHours}h sleep
              </span>
            )}
          </div>

          {/* Recommendation */}
          {data.recommendation ? (
            <p className="text-xs text-text-muted line-clamp-2">
              {data.recommendation}
            </p>
          ) : status === 'not_configured' ? (
            <p className="text-xs text-text-muted">
              Connect Whoop to track recovery
            </p>
          ) : null}
        </div>
      )}
    </MetricCardBase>
  );
}

export default WellnessMetricCard;

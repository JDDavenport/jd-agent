/**
 * VaultMetricCard
 *
 * Displays vault entry count with type breakdown.
 * Shows recent additions count.
 */

import MetricCardBase from '../shared/MetricCardBase';
import type { VaultMetric } from '../../../types/dashboard';

interface VaultMetricCardProps {
  data: VaultMetric | undefined;
  isLoading?: boolean;
  error?: Error | null;
}

export function VaultMetricCard({ data, isLoading, error }: VaultMetricCardProps) {
  // Vault app runs on port 5175
  const vaultAppUrl = 'http://localhost:5175';

  return (
    <MetricCardBase
      title="Vault Entries"
      value={data?.totalEntries || 0}
      icon="📝"
      color="text-warning"
      externalHref={vaultAppUrl}
      isLoading={isLoading}
      error={error}
      tooltip="Click to open Vault app"
    >
      {data && (
        <div className="space-y-2">
          {/* Recent additions */}
          {data.recentCount > 0 ? (
            <p className="text-xs text-success">
              +{data.recentCount} in last 24h
            </p>
          ) : (
            <p className="text-xs text-text-muted">No recent additions</p>
          )}

          {/* Type breakdown */}
          <div className="flex items-center gap-3 text-xs">
            {data.byType.notes > 0 && (
              <span className="flex items-center gap-1">
                <span>📄</span>
                <span className="text-text-muted">{data.byType.notes}</span>
              </span>
            )}
            {data.byType.recordings > 0 && (
              <span className="flex items-center gap-1">
                <span>🎙️</span>
                <span className="text-text-muted">{data.byType.recordings}</span>
              </span>
            )}
            {data.byType.documents > 0 && (
              <span className="flex items-center gap-1">
                <span>📑</span>
                <span className="text-text-muted">{data.byType.documents}</span>
              </span>
            )}
            {data.byType.other > 0 && (
              <span className="flex items-center gap-1">
                <span>📦</span>
                <span className="text-text-muted">{data.byType.other}</span>
              </span>
            )}
          </div>
        </div>
      )}
    </MetricCardBase>
  );
}

export default VaultMetricCard;

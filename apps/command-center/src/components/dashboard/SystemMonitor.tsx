/**
 * SystemMonitor - Phase 3
 *
 * Displays system health and integration status including:
 * - Integration status grid (green/yellow/red)
 * - Last sync times
 * - Overall system health
 */

import { useSystemMonitor } from '../../hooks/useDashboardEnhanced';
import LoadingSpinner from '../common/LoadingSpinner';
import { formatDistanceToNow, parseISO } from 'date-fns';
import type { IntegrationHealth } from '../../types/dashboard';

const STATUS_CONFIG = {
  healthy: { color: 'bg-success', label: 'Healthy', dotColor: 'bg-success' },
  degraded: { color: 'bg-warning', label: 'Degraded', dotColor: 'bg-warning' },
  down: { color: 'bg-error', label: 'Down', dotColor: 'bg-error' },
  not_configured: { color: 'bg-dark-border', label: 'Not Setup', dotColor: 'bg-dark-border' },
};

function IntegrationItem({ integration }: { integration: IntegrationHealth }) {
  const config = STATUS_CONFIG[integration.status];

  return (
    <div className="flex items-center justify-between p-2 bg-dark-bg rounded-lg">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${config.dotColor}`} />
        <span className="text-sm text-text">{integration.displayName}</span>
      </div>
      <div className="text-right">
        {integration.status === 'not_configured' ? (
          <span className="text-xs text-text-muted">Not configured</span>
        ) : integration.lastSyncAt ? (
          <span className="text-xs text-text-muted">
            {formatDistanceToNow(parseISO(integration.lastSyncAt), { addSuffix: true })}
          </span>
        ) : (
          <span className="text-xs text-text-muted">Never synced</span>
        )}
      </div>
    </div>
  );
}

function SystemMonitor() {
  const { data, isLoading, error } = useSystemMonitor();

  if (isLoading) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">System Health</h2>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">System Health</h2>
        <p className="text-error text-sm">Failed to load system status</p>
      </div>
    );
  }

  const overallConfig = STATUS_CONFIG[data?.overallStatus || 'healthy'];

  // Separate configured and unconfigured integrations
  const configuredIntegrations = data?.integrations.filter(i => i.status !== 'not_configured') || [];
  const unconfiguredIntegrations = data?.integrations.filter(i => i.status === 'not_configured') || [];

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔧</span>
          <h2 className="text-lg font-semibold">System Health</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${overallConfig.dotColor}`} />
          <span className="text-sm text-text-muted">
            {data?.healthyCount}/{data?.totalCount} healthy
          </span>
        </div>
      </div>

      {/* Overall Status Banner */}
      {data?.overallStatus !== 'healthy' && (
        <div className={`mb-4 p-3 rounded-lg ${
          data?.overallStatus === 'down'
            ? 'bg-error/10 border border-error/30'
            : 'bg-warning/10 border border-warning/30'
        }`}>
          <p className={`text-sm font-medium ${
            data?.overallStatus === 'down' ? 'text-error' : 'text-warning'
          }`}>
            {data?.overallStatus === 'down'
              ? 'Some integrations are down'
              : 'Some integrations are degraded'}
          </p>
        </div>
      )}

      {/* Active Integrations */}
      <div className="space-y-2 mb-4">
        <h3 className="text-xs text-text-muted uppercase tracking-wider mb-2">
          Active Integrations
        </h3>
        {configuredIntegrations.length > 0 ? (
          configuredIntegrations.map((integration) => (
            <IntegrationItem key={integration.name} integration={integration} />
          ))
        ) : (
          <p className="text-sm text-text-muted">No integrations configured</p>
        )}
      </div>

      {/* Unconfigured Integrations */}
      {unconfiguredIntegrations.length > 0 && (
        <div className="pt-3 border-t border-dark-border">
          <h3 className="text-xs text-text-muted uppercase tracking-wider mb-2">
            Available Integrations
          </h3>
          <div className="space-y-2">
            {unconfiguredIntegrations.map((integration) => (
              <IntegrationItem key={integration.name} integration={integration} />
            ))}
          </div>
        </div>
      )}

      {/* Last Updated */}
      {data?.lastUpdated && (
        <p className="text-xs text-text-muted mt-4 text-center">
          Updated {formatDistanceToNow(parseISO(data.lastUpdated), { addSuffix: true })}
        </p>
      )}
    </div>
  );
}

export default SystemMonitor;

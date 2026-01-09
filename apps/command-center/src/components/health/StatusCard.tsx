import type { ServiceStatus, IntegrationStatus } from '../../types/health';

interface StatusCardProps {
  service?: ServiceStatus;
  integration?: IntegrationStatus;
}

function StatusCard({ service, integration }: StatusCardProps) {
  if (service) {
    const statusColors = {
      healthy: 'bg-success text-white',
      degraded: 'bg-warning text-white',
      down: 'bg-error text-white',
    };

    const statusIcons = {
      healthy: '✓',
      degraded: '⚠',
      down: '✕',
    };

    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-text">{service.name}</h3>
          <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[service.status]}`}>
            {statusIcons[service.status]} {service.status}
          </span>
        </div>

        <div className="space-y-2 text-sm">
          {service.responseTime !== undefined && (
            <div className="flex justify-between">
              <span className="text-text-muted">Response Time</span>
              <span className="text-text">{service.responseTime}ms</span>
            </div>
          )}

          <div className="flex justify-between">
            <span className="text-text-muted">Last Check</span>
            <span className="text-text">{new Date(service.lastCheck).toLocaleTimeString()}</span>
          </div>

          {service.message && (
            <div className="mt-3 p-2 bg-dark-card-hover rounded text-text-muted">
              {service.message}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (integration) {
    const statusColor = integration.connected ? 'bg-success text-white' : 'bg-error text-white';
    const statusIcon = integration.connected ? '✓' : '✕';
    const statusText = integration.connected ? 'Connected' : 'Disconnected';

    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-text">{integration.name}</h3>
          <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor}`}>
            {statusIcon} {statusText}
          </span>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-text-muted">Enabled</span>
            <span className="text-text">{integration.enabled ? 'Yes' : 'No'}</span>
          </div>

          {integration.lastSync && (
            <div className="flex justify-between">
              <span className="text-text-muted">Last Sync</span>
              <span className="text-text">{new Date(integration.lastSync).toLocaleString()}</span>
            </div>
          )}

          {integration.error && (
            <div className="mt-3 p-2 bg-error/10 border border-error rounded text-error text-xs">
              {integration.error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}

export default StatusCard;

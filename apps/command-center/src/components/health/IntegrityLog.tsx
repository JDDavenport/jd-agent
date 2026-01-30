import type { IntegrityCheck } from '../../types/health';
import LoadingSpinner from '../common/LoadingSpinner';

interface IntegrityLogProps {
  checks: IntegrityCheck[];
  isLoading?: boolean;
}

function IntegrityLog({ checks, isLoading }: IntegrityLogProps) {
  if (isLoading) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Integrity Checks</h2>
        <div className="flex justify-center py-8">
          <LoadingSpinner size="md" />
        </div>
      </div>
    );
  }

  const statusColors = {
    pass: 'text-success',
    fail: 'text-error',
    warning: 'text-warning',
  };

  const statusIcons = {
    pass: '✓',
    fail: '✕',
    warning: '⚠',
  };

  const statusBadgeColors = {
    pass: 'bg-success/10 text-success border border-success/20',
    fail: 'bg-error/10 text-error border border-error/20',
    warning: 'bg-warning/10 text-warning border border-warning/20',
  };

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Integrity Checks</h2>

      {checks.length === 0 ? (
        <p className="text-text-muted text-center py-8">No integrity checks found</p>
      ) : (
        <div className="space-y-3">
          {checks.map((check) => {
            const parsedDate = new Date(check.timestamp);
            const timestampLabel = Number.isNaN(parsedDate.getTime())
              ? 'Unknown'
              : parsedDate.toLocaleString();

            return (
              <div key={check.id} className="p-3 bg-dark-card-hover rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className={`text-lg ${statusColors[check.status]}`}>
                      {statusIcons[check.status]}
                    </span>
                    <span className="font-medium text-text">{check.type}</span>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${statusBadgeColors[check.status]}`}>
                    {check.status}
                  </span>
                </div>

                <p className="text-sm text-text-muted mb-2">
                  {check.message || 'No details provided'}
                </p>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">
                    {timestampLabel}
                  </span>

                  {check.details && Object.keys(check.details).length > 0 && (
                    <button className="text-accent hover:underline">
                      View Details
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default IntegrityLog;

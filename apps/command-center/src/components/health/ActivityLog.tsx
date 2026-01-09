import type { ActivityLog as ActivityLogType } from '../../types/health';
import LoadingSpinner from '../common/LoadingSpinner';

interface ActivityLogProps {
  logs: ActivityLogType[];
  isLoading?: boolean;
}

function ActivityLog({ logs, isLoading }: ActivityLogProps) {
  if (isLoading) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
        <div className="flex justify-center py-8">
          <LoadingSpinner size="md" />
        </div>
      </div>
    );
  }

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'task':
        return '✓';
      case 'ceremony':
        return '🔔';
      case 'sync':
        return '🔄';
      case 'integrity':
        return '🔍';
      case 'error':
        return '⚠';
      default:
        return '•';
    }
  };

  const getLogColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'text-error';
      case 'ceremony':
        return 'text-accent';
      case 'sync':
        return 'text-info';
      default:
        return 'text-text-muted';
    }
  };

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>

      {logs.length === 0 ? (
        <p className="text-text-muted text-center py-8">No recent activity</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start space-x-3 p-2 hover:bg-dark-card-hover rounded">
              <span className={`text-lg ${getLogColor(log.type)} flex-shrink-0`}>
                {getLogIcon(log.type)}
              </span>

              <div className="flex-1 min-w-0">
                <p className="text-sm text-text">{log.message}</p>
                <p className="text-xs text-text-muted mt-1">
                  {new Date(log.timestamp).toLocaleString()}
                </p>
              </div>

              {log.metadata && (
                <button className="text-xs text-accent hover:underline flex-shrink-0">
                  Details
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ActivityLog;

/**
 * TasksMetricCard
 *
 * Displays today's tasks with priority breakdown and completion rate.
 * Clicks through to the external Tasks app.
 */

import MetricCardBase from '../shared/MetricCardBase';
import ProgressBar from '../shared/ProgressBar';
import type { TasksMetric } from '../../../types/dashboard';

interface TasksMetricCardProps {
  data: TasksMetric | undefined;
  isLoading?: boolean;
  error?: Error | null;
}

export function TasksMetricCard({ data, isLoading, error }: TasksMetricCardProps) {
  const totalActive = data
    ? data.byPriority.high + data.byPriority.medium + data.byPriority.low
    : 0;

  // Tasks app runs on port 5180
  const tasksAppUrl = 'http://localhost:5180';

  return (
    <MetricCardBase
      title="Tasks Today"
      value={data?.today || 0}
      icon="✅"
      color={data?.overdue && data.overdue > 0 ? 'text-error' : 'text-accent'}
      externalHref={tasksAppUrl}
      isLoading={isLoading}
      error={error}
      tooltip="Click to open Tasks app"
    >
      {data && (
        <div className="space-y-2">
          {/* Completion progress */}
          <ProgressBar
            value={data.completionRate}
            color={
              data.completionRate >= 80
                ? 'bg-success'
                : data.completionRate >= 50
                ? 'bg-warning'
                : 'bg-error'
            }
            size="sm"
          />

          {/* Priority breakdown */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              {data.byPriority.high > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-error" />
                  <span className="text-text-muted">{data.byPriority.high}</span>
                </span>
              )}
              {data.byPriority.medium > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-warning" />
                  <span className="text-text-muted">{data.byPriority.medium}</span>
                </span>
              )}
              {data.byPriority.low > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-dark-border" />
                  <span className="text-text-muted">{data.byPriority.low}</span>
                </span>
              )}
            </div>
            {data.overdue > 0 && (
              <span className="text-error">{data.overdue} overdue</span>
            )}
          </div>

          {/* Completion text */}
          <p className="text-xs text-text-muted">
            {data.completed} of {data.today + data.completed} completed ({data.completionRate}%)
          </p>
        </div>
      )}
    </MetricCardBase>
  );
}

export default TasksMetricCard;

/**
 * EventsMetricCard
 *
 * Displays today's events with countdown to next event.
 * Shows event type breakdown.
 */

import MetricCardBase from '../shared/MetricCardBase';
import type { EventsMetric } from '../../../types/dashboard';

interface EventsMetricCardProps {
  data: EventsMetric | undefined;
  isLoading?: boolean;
  error?: Error | null;
}

function formatTimeUntil(minutes: number): string {
  if (minutes < 0) return 'Started';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function EventsMetricCard({ data, isLoading, error }: EventsMetricCardProps) {
  // For now, we don't have a dedicated calendar page, so we'll link to the dashboard
  // In the future, this could link to Google Calendar or a dedicated calendar view

  return (
    <MetricCardBase
      title="Events Today"
      value={data?.today || 0}
      icon="📅"
      color="text-success"
      href="/" // Could be updated to link to calendar when available
      isLoading={isLoading}
      error={error}
      tooltip="Today's calendar events"
    >
      {data && (
        <div className="space-y-2">
          {/* Next event countdown */}
          {data.nextEvent ? (
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted truncate flex-1 mr-2">
                Next: {data.nextEvent.title}
              </span>
              <span
                className={`text-xs font-medium ${
                  data.nextEvent.startsIn <= 15
                    ? 'text-error'
                    : data.nextEvent.startsIn <= 60
                    ? 'text-warning'
                    : 'text-text-muted'
                }`}
              >
                {formatTimeUntil(data.nextEvent.startsIn)}
              </span>
            </div>
          ) : (
            <p className="text-xs text-text-muted">No upcoming events</p>
          )}

          {/* Event type breakdown */}
          <div className="flex items-center gap-3 text-xs">
            {data.byType.class > 0 && (
              <span className="flex items-center gap-1">
                <span className="text-blue-400">📚</span>
                <span className="text-text-muted">{data.byType.class}</span>
              </span>
            )}
            {data.byType.meeting > 0 && (
              <span className="flex items-center gap-1">
                <span>👥</span>
                <span className="text-text-muted">{data.byType.meeting}</span>
              </span>
            )}
            {data.byType.personal > 0 && (
              <span className="flex items-center gap-1">
                <span>🏠</span>
                <span className="text-text-muted">{data.byType.personal}</span>
              </span>
            )}
            {data.byType.other > 0 && (
              <span className="flex items-center gap-1">
                <span>📌</span>
                <span className="text-text-muted">{data.byType.other}</span>
              </span>
            )}
          </div>
        </div>
      )}
    </MetricCardBase>
  );
}

export default EventsMetricCard;

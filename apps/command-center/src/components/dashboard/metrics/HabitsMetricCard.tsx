/**
 * HabitsMetricCard
 *
 * Displays habit completion for today with longest streak.
 * Shows a 7-day mini calendar of habit completion.
 */

import MetricCardBase from '../shared/MetricCardBase';
import MiniCalendar from '../shared/MiniCalendar';
import type { HabitsMetric } from '../../../types/dashboard';

interface HabitsMetricCardProps {
  data: HabitsMetric | undefined;
  isLoading?: boolean;
  error?: Error | null;
}

export function HabitsMetricCard({ data, isLoading, error }: HabitsMetricCardProps) {
  // Format the display value
  const displayValue = data
    ? `${data.completedToday}/${data.totalDueToday}`
    : '0/0';

  return (
    <MetricCardBase
      title="Habits Today"
      value={displayValue}
      icon="🔥"
      color={
        data?.completionRate === 100
          ? 'text-success'
          : data?.completionRate && data.completionRate >= 50
          ? 'text-warning'
          : 'text-text-muted'
      }
      href="/habits"
      isLoading={isLoading}
      error={error}
      tooltip="Click to view all habits"
    >
      {data && (
        <div className="space-y-2">
          {/* Longest streak */}
          {data.longestStreak ? (
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted truncate flex-1 mr-2">
                Best: {data.longestStreak.title}
              </span>
              <span className="text-xs font-medium text-accent whitespace-nowrap">
                🔥 {data.longestStreak.days}d
              </span>
            </div>
          ) : (
            <p className="text-xs text-text-muted">No active streaks</p>
          )}

          {/* 7-day calendar */}
          <div className="flex justify-center">
            <MiniCalendar
              days={data.weekCalendar}
              activeColor="bg-success"
              inactiveColor="bg-dark-border"
            />
          </div>

          {/* Completion rate */}
          <p className="text-xs text-text-muted text-center">
            {data.completionRate}% complete today
          </p>
        </div>
      )}
    </MetricCardBase>
  );
}

export default HabitsMetricCard;

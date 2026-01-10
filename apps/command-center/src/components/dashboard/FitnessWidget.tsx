/**
 * FitnessWidget - Phase 3
 *
 * Displays fitness and wellness data from Whoop including:
 * - Workout streak badge
 * - Today's recovery score
 * - Average sleep hours
 * - Last workout info
 */

import { useFitness } from '../../hooks/useDashboardEnhanced';
import LoadingSpinner from '../common/LoadingSpinner';
import { ProgressBar } from './shared';
import { format, parseISO } from 'date-fns';

function FitnessWidget() {
  const { data, isLoading, error } = useFitness();

  if (isLoading) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Fitness</h2>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Fitness</h2>
        <p className="text-error text-sm">Failed to load fitness data</p>
      </div>
    );
  }

  // Check if Whoop is configured
  const isConfigured = data?.todayRecovery !== null || data?.workoutStreak > 0;

  if (!isConfigured) {
    return (
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">💪</span>
          <h2 className="text-lg font-semibold">Fitness</h2>
        </div>
        <div className="text-center py-6">
          <p className="text-3xl mb-2">⌚</p>
          <p className="text-text-muted text-sm">Connect Whoop to see fitness metrics</p>
        </div>
      </div>
    );
  }

  // Get recovery status color and label
  const getRecoveryStatus = (score: number | null) => {
    if (score === null) return { color: 'bg-dark-border', label: 'Unknown', textColor: 'text-text-muted' };
    if (score >= 67) return { color: 'bg-success', label: 'Green', textColor: 'text-success' };
    if (score >= 34) return { color: 'bg-warning', label: 'Yellow', textColor: 'text-warning' };
    return { color: 'bg-error', label: 'Red', textColor: 'text-error' };
  };

  const recoveryStatus = getRecoveryStatus(data?.todayRecovery || null);

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">💪</span>
          <h2 className="text-lg font-semibold">Fitness</h2>
        </div>
        {data?.workoutStreak && data.workoutStreak > 0 && (
          <span className="badge badge-accent text-xs">
            🔥 {data.workoutStreak} day streak
          </span>
        )}
      </div>

      {/* Recovery Score */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-text-muted">Today's Recovery</span>
          <span className={`text-2xl font-bold ${recoveryStatus.textColor}`}>
            {data?.todayRecovery !== null && data?.todayRecovery !== undefined ? `${data.todayRecovery}%` : '--'}
          </span>
        </div>
        <ProgressBar
          value={data?.todayRecovery || 0}
          color={recoveryStatus.color}
          size="md"
        />
        <p className={`text-xs mt-1 ${recoveryStatus.textColor}`}>
          {recoveryStatus.label} zone
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Average Sleep */}
        <div className="p-3 bg-dark-bg rounded-lg">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-sm">😴</span>
            <span className="text-xs text-text-muted">Avg Sleep</span>
          </div>
          <p className="text-lg font-semibold text-text">
            {data?.averageSleep ? `${data.averageSleep}h` : '--'}
          </p>
        </div>

        {/* Last Workout */}
        <div className="p-3 bg-dark-bg rounded-lg">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-sm">🏋️</span>
            <span className="text-xs text-text-muted">Last Workout</span>
          </div>
          {data?.lastWorkout ? (
            <>
              <p className="text-sm font-semibold text-text truncate">
                {data.lastWorkout.type}
              </p>
              <p className="text-xs text-text-muted">
                {format(parseISO(data.lastWorkout.date), 'MMM d')}
              </p>
            </>
          ) : (
            <p className="text-sm text-text-muted">No recent</p>
          )}
        </div>
      </div>

      {/* Sleep Trend (if available) */}
      {data?.sleepTrend && data.sleepTrend.length > 0 && (
        <div className="mt-4 pt-4 border-t border-dark-border">
          <h3 className="text-xs text-text-muted mb-2">Sleep Trend (7 days)</h3>
          <div className="flex items-end gap-1 h-12">
            {data.sleepTrend.map((day) => {
              const heightPercent = (day.hours / 10) * 100; // Max 10 hours
              return (
                <div
                  key={day.date}
                  className="flex-1 bg-accent/50 rounded-t"
                  style={{ height: `${Math.min(100, heightPercent)}%` }}
                  title={`${day.hours}h on ${format(parseISO(day.date), 'MMM d')}`}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default FitnessWidget;

/**
 * FitnessWidget - Phase 3
 *
 * Displays fitness and wellness data from Whoop and Garmin including:
 * - Workout streak badge
 * - Today's recovery score
 * - Average sleep hours
 * - Last workout info
 * - Recent Garmin activities
 */

import { useQuery } from '@tanstack/react-query';
import { useFitness } from '../../hooks/useDashboardEnhanced';
import { healthApi, type GarminActivity, type GarminStatus } from '../../api/health';
import LoadingSpinner from '../common/LoadingSpinner';
import { ProgressBar } from './shared';
import { format, parseISO } from 'date-fns';

function FitnessWidget() {
  const { data, isLoading, error, refetch, isFetching } = useFitness();

  const { data: garminStatus } = useQuery<GarminStatus>({
    queryKey: ['garmin-status-widget'],
    queryFn: healthApi.getGarminStatus,
    staleTime: 5 * 60 * 1000,
  });

  const { data: garminActivities } = useQuery<GarminActivity[]>({
    queryKey: ['garmin-activities-widget'],
    queryFn: () => healthApi.getGarminActivities(1),
    enabled: garminStatus?.configured && garminStatus?.authenticated,
    staleTime: 5 * 60 * 1000,
  });

  const latestGarminActivity = garminActivities?.[0];

  // Debug logging
  console.log('[FitnessWidget] State:', { data, isLoading, error, hasData: !!data });

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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Fitness</h2>
          <button
            onClick={() => refetch()}
            className="text-xs text-accent hover:text-accent-hover"
          >
            Retry
          </button>
        </div>
        <div className="text-center py-4">
          <p className="text-error text-sm mb-2">Failed to load fitness data</p>
          <p className="text-text-muted text-xs">{String(error)}</p>
        </div>
      </div>
    );
  }

  // Check if we have any data at all
  if (!data) {
    console.log('[FitnessWidget] No data received');
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

  // Check if Whoop is configured - fixed logic to check for undefined vs null
  const hasRecoveryData = data.todayRecovery !== null && data.todayRecovery !== undefined;
  const hasWorkoutData = data.workoutStreak > 0;
  const isConfigured = hasRecoveryData || hasWorkoutData;

  console.log('[FitnessWidget] Configuration check:', {
    todayRecovery: data.todayRecovery,
    workoutStreak: data.workoutStreak,
    hasRecoveryData,
    hasWorkoutData,
    isConfigured,
  });

  if (!isConfigured) {
    return (
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">💪</span>
            <h2 className="text-lg font-semibold">Fitness</h2>
          </div>
          <button
            onClick={() => refetch()}
            className="text-xs text-accent hover:text-accent-hover"
          >
            Refresh
          </button>
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
          {isFetching && !isLoading && (
            <span className="text-xs text-accent animate-pulse">↻</span>
          )}
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

      {/* Latest Garmin Activity */}
      {garminStatus?.configured && garminStatus?.authenticated && latestGarminActivity && (
        <div className="mt-4 pt-4 border-t border-dark-border">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">⌚</span>
            <h3 className="text-xs text-text-muted">Latest Garmin Activity</h3>
          </div>
          <div className="p-3 bg-dark-bg rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">
                  {latestGarminActivity.activityType === 'running' ? '🏃' :
                   latestGarminActivity.activityType === 'cycling' ? '🚴' :
                   latestGarminActivity.activityType === 'swimming' ? '🏊' :
                   latestGarminActivity.activityType === 'walking' ? '🚶' :
                   latestGarminActivity.activityType === 'yoga' ? '🧘' :
                   latestGarminActivity.activityType === 'strength_training' ? '💪' :
                   '🏋️'}
                </span>
                <div>
                  <p className="text-sm font-semibold text-text truncate">
                    {latestGarminActivity.activityName}
                  </p>
                  <p className="text-xs text-text-muted">
                    {format(parseISO(latestGarminActivity.startTime), 'MMM d, h:mm a')}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs">
              {latestGarminActivity.duration && (
                <span className="text-text-muted">
                  ⏱️ {Math.round(latestGarminActivity.duration / 60)}m
                </span>
              )}
              {latestGarminActivity.calories && (
                <span className="text-text-muted">
                  🔥 {latestGarminActivity.calories} cal
                </span>
              )}
              {latestGarminActivity.avgHR && (
                <span className="text-text-muted">
                  ❤️ {latestGarminActivity.avgHR} bpm
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FitnessWidget;

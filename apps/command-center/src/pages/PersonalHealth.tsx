import { useQuery } from '@tanstack/react-query';
import { healthApi, type PersonalHealthData } from '../api/health';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';

// Get the API base URL for OAuth redirects (needs full URL, not relative)
const getApiOrigin = (): string => {
  if (import.meta.env.VITE_API_URL) {
    // VITE_API_URL is the hub URL without /api suffix
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }
  // In development, API is on same origin
  return '';
};

function PersonalHealth() {
  const { data: healthData, isLoading, error, refetch } = useQuery<PersonalHealthData>({
    queryKey: ['personal-health'],
    queryFn: healthApi.getPersonalHealth,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  const getRecoveryColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 60) return 'text-accent';
    if (score >= 40) return 'text-warning';
    return 'text-error';
  };

  const getRecoveryStatus = (score: number) => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    console.error('Personal health error:', error);
    return (
      <div className="card">
        <p className="text-error">Failed to load health data: {error instanceof Error ? error.message : 'Unknown error'}</p>
        <p className="text-sm text-text-muted mt-2">
          Check the browser console for more details.
        </p>
        <Button onClick={() => refetch()} className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-accent to-accent-light bg-clip-text text-transparent">
            Personal Health
          </h1>
          <p className="text-text-muted mt-1">
            Track your recovery, sleep, and fitness metrics from Whoop
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="secondary"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            {isLoading ? 'Refreshing...' : '🔄 Refresh'}
          </Button>
        </div>
      </div>

      {!healthData?.configured || !healthData?.authorized ? (
        <div className="card">
          <div className="text-center py-8">
            <div className="text-6xl mb-4">💚</div>
            <h2 className="text-xl font-semibold mb-2">
              {!healthData?.configured
                ? 'Whoop Integration Not Configured'
                : 'Connect Your Whoop Account'}
            </h2>
            <p className="text-text-muted mb-4">
              {healthData?.message || 'Connect your Whoop account to view your personal health metrics.'}
            </p>
            <a
              href={`${getApiOrigin()}${healthData?.authorizeUrl || '/api/whoop/authorize'}`}
              className="inline-flex items-center justify-center px-6 py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg transition-colors no-underline"
            >
              🔗 Connect Whoop
            </a>
            <p className="text-xs text-text-muted mt-4">
              You'll be redirected to Whoop to authorize access to your health data.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Recovery Score */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="card">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <span className="mr-2">💚</span>
                Recovery Score
              </h3>
              {healthData.recovery ? (
                <div className="space-y-3">
                  <div className="text-center">
                    <p className={`text-4xl font-bold ${getRecoveryColor(healthData.recovery.score)}`}>
                      {healthData.recovery.score}
                    </p>
                    <p className="text-sm text-text-muted">
                      {getRecoveryStatus(healthData.recovery.score)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-text-muted">Resting HR</p>
                      <p className="font-semibold">{healthData.recovery.restingHeartRate} bpm</p>
                    </div>
                    <div>
                      <p className="text-text-muted">HRV</p>
                      <p className="font-semibold">{healthData.recovery.hrv} ms</p>
                    </div>
                  </div>
                  <p className="text-xs text-text-muted text-center">
                    Updated: {new Date(healthData.recovery.createdAt).toLocaleDateString()}
                  </p>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-text-muted">No recovery data available</p>
                </div>
              )}
            </div>

            {/* Sleep Data */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <span className="mr-2">😴</span>
                Last Night's Sleep
              </h3>
              {healthData.sleep ? (
                <div className="space-y-3">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-accent">
                      {healthData.sleep.totalSleepHours}h
                    </p>
                    <p className="text-sm text-text-muted">Total Sleep</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-center">
                      <p className="text-text-muted">Deep</p>
                      <p className="font-semibold">{healthData.sleep.deepSleepMinutes}m</p>
                    </div>
                    <div className="text-center">
                      <p className="text-text-muted">REM</p>
                      <p className="font-semibold">{healthData.sleep.remSleepMinutes}m</p>
                    </div>
                    <div className="text-center">
                      <p className="text-text-muted">Light</p>
                      <p className="font-semibold">{healthData.sleep.lightSleepMinutes}m</p>
                    </div>
                  </div>
                  <div className="text-xs text-text-muted text-center">
                    <p>Sleep needed: {healthData.sleep.sleepNeeded.baselineHours}h</p>
                    <p>
                      {new Date(healthData.sleep.start).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })} - {new Date(healthData.sleep.end).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-text-muted">No sleep data available</p>
                </div>
              )}
            </div>

            {/* Health Insights */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <span className="mr-2">📊</span>
                Health Insights
              </h3>
              <div className="space-y-3">
                {healthData.recovery && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Recovery Status</span>
                    <span className={`text-sm font-semibold ${getRecoveryColor(healthData.recovery.score)}`}>
                      {getRecoveryStatus(healthData.recovery.score)}
                    </span>
                  </div>
                )}

                {healthData.sleep && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Sleep Quality</span>
                    <span className="text-sm font-semibold text-accent">
                      {parseFloat(healthData.sleep.totalSleepHours) >= 7 ? 'Good' :
                       parseFloat(healthData.sleep.totalSleepHours) >= 6 ? 'Fair' : 'Poor'}
                    </span>
                  </div>
                )}

                {healthData.recovery && healthData.sleep && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Overall Readiness</span>
                    <span className="text-sm font-semibold text-success">
                      {healthData.recovery.score >= 70 && parseFloat(healthData.sleep.totalSleepHours) >= 7
                        ? 'High'
                        : healthData.recovery.score >= 50 || parseFloat(healthData.sleep.totalSleepHours) >= 6
                        ? 'Medium'
                        : 'Low'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary">
                <a
                  href="https://app.whoop.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="no-underline"
                >
                  📱 Open Whoop App
                </a>
              </Button>
              <Button variant="secondary" onClick={() => refetch()}>
                🔄 Refresh Data
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default PersonalHealth;
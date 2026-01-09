import type { HealthMetrics } from '../../types/health';

interface MetricChartProps {
  metrics: HealthMetrics;
}

function MetricChart({ metrics }: MetricChartProps) {
  const maxTasks = Math.max(...metrics.dailyStats.map((d) => d.tasksCompleted), 1);
  const maxTime = Math.max(...metrics.dailyStats.map((d) => d.timeTracked), 1);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const formatHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="card">
      <h2 className="text-lg font-semibold mb-4">7-Day Activity</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-dark-card-hover p-3 rounded-lg">
          <p className="text-xs text-text-muted mb-1">Tasks Completed</p>
          <p className="text-2xl font-bold text-text">{metrics.tasksCompleted7d}</p>
        </div>
        <div className="bg-dark-card-hover p-3 rounded-lg">
          <p className="text-xs text-text-muted mb-1">Time Tracked</p>
          <p className="text-2xl font-bold text-text">{formatHours(metrics.timeTracked7d)}</p>
        </div>
        <div className="bg-dark-card-hover p-3 rounded-lg">
          <p className="text-xs text-text-muted mb-1">Vault Entries</p>
          <p className="text-2xl font-bold text-text">{metrics.vaultEntries7d}</p>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-text">Daily Tasks</h3>
        <div className="space-y-2">
          {metrics.dailyStats.map((day) => (
            <div key={day.date} className="flex items-center space-x-3">
              <span className="text-xs text-text-muted w-8">{formatDate(day.date)}</span>
              <div className="flex-1 bg-dark-card-hover rounded-full h-6 relative overflow-hidden">
                <div
                  className="bg-accent h-full rounded-full transition-all duration-300"
                  style={{ width: `${(day.tasksCompleted / maxTasks) * 100}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-text">
                  {day.tasksCompleted > 0 ? `${day.tasksCompleted} tasks` : ''}
                </span>
              </div>
            </div>
          ))}
        </div>

        <h3 className="text-sm font-semibold text-text mt-6">Time Tracked</h3>
        <div className="space-y-2">
          {metrics.dailyStats.map((day) => (
            <div key={day.date} className="flex items-center space-x-3">
              <span className="text-xs text-text-muted w-8">{formatDate(day.date)}</span>
              <div className="flex-1 bg-dark-card-hover rounded-full h-6 relative overflow-hidden">
                <div
                  className="bg-info h-full rounded-full transition-all duration-300"
                  style={{ width: `${(day.timeTracked / maxTime) * 100}%` }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-text">
                  {day.timeTracked > 0 ? formatHours(day.timeTracked) : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MetricChart;

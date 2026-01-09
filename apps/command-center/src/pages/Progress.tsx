import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useProgressOverview,
  useWeeklyReport,
  useAllAreasProgress,
  useTopStreaks,
} from '../hooks/useProgress';
import {
  useGoalsNeedingAttention,
  useUpcomingMilestones,
  useWinReflections,
  useGenerateTasks,
} from '../hooks/useGoals';
import { LIFE_AREAS, type LifeArea } from '../types/goals';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Button from '../components/common/Button';
import Card from '../components/common/Card';

function Progress() {
  const [selectedArea, setSelectedArea] = useState<LifeArea | undefined>();

  const { data: overview, isLoading: overviewLoading } = useProgressOverview();
  const { data: weeklyReport } = useWeeklyReport();
  const { data: areasProgress } = useAllAreasProgress();
  const { data: topStreaks } = useTopStreaks(5);
  const { data: alertGoals } = useGoalsNeedingAttention();
  const { data: upcomingMilestones } = useUpcomingMilestones(7);
  const { data: recentWins } = useWinReflections(5);

  const generateTasks = useGenerateTasks();

  if (overviewLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-accent to-accent-light bg-clip-text text-transparent">
            Progress Dashboard
          </h1>
          <p className="text-text-muted mt-1">Track your journey across all life areas</p>
        </div>
        <Button
          variant="secondary"
          onClick={() => generateTasks.mutate()}
          disabled={generateTasks.isPending}
        >
          {generateTasks.isPending ? 'Generating...' : 'Generate Tasks'}
        </Button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Goals"
          value={overview?.goals.active || 0}
          total={overview?.goals.total}
          color="accent"
        />
        <StatCard
          label="Habits Today"
          value={overview?.habits.completedToday || 0}
          total={overview?.habits.totalDueToday}
          color="success"
          suffix={`${overview?.habits.completionRate || 0}%`}
        />
        <StatCard
          label="Avg Progress"
          value={`${overview?.goals.averageProgress || 0}%`}
          color="accent-light"
        />
        <StatCard
          label="Avg Health"
          value={`${overview?.goals.averageHealth || 0}%`}
          color={(overview?.goals.averageHealth ?? 0) >= 70 ? 'success' : (overview?.goals.averageHealth ?? 0) >= 40 ? 'warning' : 'error'}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Life Area Progress */}
          <Card>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span>🌈</span> Life Area Progress
            </h2>
            <div className="space-y-4">
              {Object.values(LIFE_AREAS).map(area => {
                const areaData = areasProgress?.find(a => a.area.key === area.key);
                const progress = areaData?.goals.averageProgress || 0;

                return (
                  <div
                    key={area.key}
                    className={`p-4 rounded-lg border transition-all cursor-pointer ${
                      selectedArea === area.key
                        ? 'border-accent bg-accent/5'
                        : 'border-dark-border hover:border-accent/50'
                    }`}
                    onClick={() => setSelectedArea(selectedArea === area.key ? undefined : area.key)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                          style={{ backgroundColor: `${area.color}20` }}
                        >
                          {area.icon}
                        </div>
                        <div>
                          <h3 className="font-semibold">{area.name}</h3>
                          <p className="text-xs text-text-muted">{area.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">{Math.round(progress)}%</div>
                        <div className="text-xs text-text-muted">
                          {areaData?.goals.active || 0} goals • {areaData?.habits.total || 0} habits
                        </div>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div className="h-2 bg-dark-bg rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${progress}%`, backgroundColor: area.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Weekly Report */}
          {weeklyReport && (
            <Card>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span>📅</span> This Week
              </h2>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 bg-dark-bg rounded-lg">
                  <div className="text-2xl font-bold text-success">{weeklyReport.habits.completed}</div>
                  <div className="text-xs text-text-muted">Habits Done</div>
                </div>
                <div className="text-center p-3 bg-dark-bg rounded-lg">
                  <div className="text-2xl font-bold text-accent">{weeklyReport.goals.milestonesCompleted}</div>
                  <div className="text-xs text-text-muted">Milestones</div>
                </div>
                <div className="text-center p-3 bg-dark-bg rounded-lg">
                  <div className="text-2xl font-bold">{weeklyReport.goals.reflectionsAdded}</div>
                  <div className="text-xs text-text-muted">Reflections</div>
                </div>
              </div>

              {weeklyReport.highlights.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-success mb-2">Highlights</h4>
                  <ul className="space-y-1">
                    {weeklyReport.highlights.map((h, i) => (
                      <li key={i} className="text-sm text-text-muted flex items-start gap-2">
                        <span className="text-success">✓</span> {h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {weeklyReport.improvements.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-warning mb-2">Areas to Improve</h4>
                  <ul className="space-y-1">
                    {weeklyReport.improvements.map((imp, i) => (
                      <li key={i} className="text-sm text-text-muted flex items-start gap-2">
                        <span className="text-warning">!</span> {imp}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Alerts */}
          {alertGoals && alertGoals.length > 0 && (
            <Card className="border-warning/50">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-warning">
                <span>⚠️</span> Needs Attention
              </h3>
              <div className="space-y-2">
                {alertGoals.slice(0, 4).map(goal => (
                  <Link
                    key={goal.id}
                    to="/goals"
                    className="block p-2 bg-dark-bg rounded-lg hover:bg-dark-card-hover transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span>{goal.lifeArea && LIFE_AREAS[goal.lifeArea]?.icon || '🎯'}</span>
                        <span className="text-sm">{goal.title}</span>
                      </span>
                      <span className="text-xs text-warning">{goal.healthScore}%</span>
                    </div>
                  </Link>
                ))}
              </div>
            </Card>
          )}

          {/* Upcoming Milestones */}
          <Card>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <span>🏁</span> Upcoming Milestones
            </h3>
            {!upcomingMilestones || upcomingMilestones.length === 0 ? (
              <p className="text-text-muted text-sm">No upcoming milestones</p>
            ) : (
              <div className="space-y-2">
                {upcomingMilestones.slice(0, 5).map((m: any) => (
                  <div key={m.id} className="p-2 bg-dark-bg rounded-lg">
                    <div className="font-medium text-sm">{m.title}</div>
                    <div className="flex items-center justify-between text-xs text-text-muted mt-1">
                      <span>{m.goalTitle}</span>
                      {m.targetDate && (
                        <span>{new Date(m.targetDate).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Top Streaks */}
          <Card>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <span>🔥</span> Top Streaks
            </h3>
            {!topStreaks || topStreaks.length === 0 ? (
              <p className="text-text-muted text-sm">No active streaks</p>
            ) : (
              <div className="space-y-2">
                {topStreaks.map(s => (
                  <div key={s.habitId} className="flex items-center justify-between p-2 bg-dark-bg rounded-lg">
                    <span className="flex items-center gap-2 text-sm">
                      <span>{s.lifeArea && LIFE_AREAS[s.lifeArea]?.icon || '🔄'}</span>
                      <span>{s.habitTitle}</span>
                    </span>
                    <span className="font-bold text-accent">{s.currentStreak} days</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent Wins */}
          <Card>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <span>🏆</span> Recent Wins
            </h3>
            {!recentWins || recentWins.length === 0 ? (
              <p className="text-text-muted text-sm">No recent wins</p>
            ) : (
              <div className="space-y-2">
                {recentWins.map(w => (
                  <div key={w.id} className="p-2 bg-dark-bg rounded-lg">
                    <p className="text-sm">{w.content}</p>
                    <div className="flex items-center justify-between text-xs text-text-muted mt-1">
                      <span>{w.goalTitle}</span>
                      <span>{new Date(w.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Quick Links */}
          <Card>
            <h3 className="font-semibold mb-3">Quick Links</h3>
            <div className="space-y-2">
              <Link
                to="/goals"
                className="flex items-center justify-between p-2 bg-dark-bg rounded-lg hover:bg-dark-card-hover transition-all"
              >
                <span className="flex items-center gap-2">
                  <span>🎯</span> Goals
                </span>
                <span className="text-accent">→</span>
              </Link>
              <Link
                to="/habits"
                className="flex items-center justify-between p-2 bg-dark-bg rounded-lg hover:bg-dark-card-hover transition-all"
              >
                <span className="flex items-center gap-2">
                  <span>🔄</span> Habits
                </span>
                <span className="text-accent">→</span>
              </Link>
              <a
                href="http://localhost:5174"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2 bg-dark-bg rounded-lg hover:bg-dark-card-hover transition-all"
              >
                <span className="flex items-center gap-2">
                  <span>✅</span> Tasks App
                </span>
                <span className="text-accent">↗</span>
              </a>
              <a
                href="http://localhost:5175"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2 bg-dark-bg rounded-lg hover:bg-dark-card-hover transition-all"
              >
                <span className="flex items-center gap-2">
                  <span>📚</span> Vault App
                </span>
                <span className="text-accent">↗</span>
              </a>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  label,
  value,
  total,
  suffix,
  color,
}: {
  label: string;
  value: number | string;
  total?: number;
  suffix?: string;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    accent: 'text-accent',
    'accent-light': 'text-accent-light',
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-error',
  };

  return (
    <Card>
      <div className="text-sm text-text-muted mb-1">{label}</div>
      <div className={`text-2xl font-bold ${colorClasses[color] || 'text-text'}`}>
        {value}
        {total !== undefined && <span className="text-text-muted text-lg">/{total}</span>}
      </div>
      {suffix && <div className="text-xs text-text-muted mt-1">{suffix}</div>}
    </Card>
  );
}

export default Progress;

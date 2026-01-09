import { useGoals, useTodaysHabits, useCompleteHabit } from '../../hooks/useGoals';
import { LIFE_AREAS } from '../../types/goals';
import { CheckCircleIcon, FireIcon, BoltIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';

function GoalsPanel() {
  const { data: goals, isLoading: goalsLoading } = useGoals({ status: 'active' });
  const { data: todaysHabits, isLoading: habitsLoading } = useTodaysHabits();
  const completeHabit = useCompleteHabit();

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-success';
    if (progress >= 50) return 'bg-accent';
    return 'bg-warning';
  };

  const getStreakIcon = (streak: number) => {
    if (streak >= 7) return <FireIcon className="w-4 h-4 text-orange-500" />;
    if (streak >= 3) return <BoltIcon className="w-4 h-4 text-yellow-500" />;
    return null;
  };

  const handleCompleteHabit = (habitId: string) => {
    completeHabit.mutate({ id: habitId });
  };

  
  if (goalsLoading || habitsLoading) {
    return (
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Goals & Habits</h2>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-dark-bg rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Calculate goal progress
  const goalsWithProgress = (goals || [])
    .map((g) => ({
      id: g.id,
      title: g.title,
      progress: g.progressPercentage || 0,
      targetDate: g.targetDate,
      area: g.lifeArea,
    }))
    .slice(0, 3);

  // Get habits for today (all today's habits are due)
  const dueHabits = (todaysHabits || []).slice(0, 5);

  return (
    <div className="card">
      <h2 className="text-xl font-semibold mb-4">Goals & Habits</h2>

      {/* Today's Habits */}
      {dueHabits.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-text-muted mb-3">Today's Habits</h3>
          <div className="space-y-2">
            {dueHabits.map((habit) => (
              <div
                key={habit.id}
                className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                  habit.completedToday ? 'bg-success/10' : 'bg-dark-bg hover:bg-dark-border'
                }`}
              >
                <button
                  onClick={() => !habit.completedToday && handleCompleteHabit(habit.id)}
                  disabled={habit.completedToday || completeHabit.isPending}
                  className="flex-shrink-0"
                >
                  {habit.completedToday ? (
                    <CheckCircleSolid className="w-6 h-6 text-success" />
                  ) : (
                    <CheckCircleIcon className="w-6 h-6 text-text-muted hover:text-success" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium truncate ${
                      habit.completedToday ? 'text-text-muted line-through' : 'text-text'
                    }`}
                  >
                    {habit.title}
                  </p>
                  {habit.currentStreak > 0 && (
                    <div className="flex items-center gap-1 text-xs text-text-muted">
                      {getStreakIcon(habit.currentStreak)}
                      <span>{habit.currentStreak}d streak</span>
                    </div>
                  )}
                </div>
                              </div>
            ))}
          </div>
        </div>
      )}

      {/* Goals Progress */}
      {goalsWithProgress.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-text-muted mb-3">Goals Progress</h3>
          <div className="space-y-4">
            {goalsWithProgress.map((goal) => (
              <div key={goal.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-text text-sm">{goal.title}</h4>
                    <p className="text-xs text-text-muted">
                      {goal.area && <span>{LIFE_AREAS[goal.area]?.name}</span>}
                      {goal.targetDate && (
                        <span>
                          {goal.area && ' · '}
                          Due {new Date(goal.targetDate).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-accent">{goal.progress}%</span>
                </div>

                <div className="w-full h-2 bg-dark-bg rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getProgressColor(goal.progress)} transition-all duration-500`}
                    style={{ width: `${Math.min(goal.progress, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {goalsWithProgress.length === 0 && dueHabits.length === 0 && (
        <div className="text-center py-6 text-text-muted">
          <p className="text-sm">No active goals or habits</p>
          <p className="text-xs mt-1">Create some to track your progress!</p>
        </div>
      )}

      {/* Stats summary */}
      {(goalsWithProgress.length > 0 || dueHabits.length > 0) && (
        <div className="mt-4 pt-4 border-t border-dark-border">
          <div className="flex justify-between text-xs text-text-muted">
            <span>{goals?.length || 0} active goals</span>
            <span>
              {dueHabits.filter((h) => h.completedToday).length}/{dueHabits.length} habits done
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default GoalsPanel;

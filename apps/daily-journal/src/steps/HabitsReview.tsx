import { clsx } from 'clsx';
import { useToggleHabit } from '../hooks';
import type { HabitReviewData } from '@jd-agent/types';
import { CheckIcon, FireIcon } from '@heroicons/react/24/solid';

interface Props {
  habits: HabitReviewData[];
  date: string;
}

export function HabitsReview({ habits, date }: Props) {
  const toggleHabit = useToggleHabit();

  const handleToggle = async (habitId: string) => {
    await toggleHabit.mutateAsync({ habitId, date });
  };

  const dueHabits = habits.filter((h) => h.isDueToday);
  const completedCount = dueHabits.filter((h) => h.completedToday).length;
  const completionRate = dueHabits.length > 0
    ? Math.round((completedCount / dueHabits.length) * 100)
    : 0;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Habits Review</h2>
        <p className="text-sm text-gray-500 mt-1">
          {completedCount}/{dueHabits.length} habits completed today ({completionRate}%)
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all duration-300"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </div>

      {dueHabits.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No habits scheduled for today.
        </div>
      ) : (
        <div className="space-y-3">
          {dueHabits.map((habit) => (
            <div
              key={habit.id}
              className={clsx(
                'flex items-center justify-between p-4 rounded-lg border transition-all',
                habit.completedToday
                  ? 'bg-green-50 border-green-200'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              )}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleToggle(habit.id)}
                  disabled={toggleHabit.isPending}
                  className={clsx(
                    'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors',
                    habit.completedToday
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-gray-300 hover:border-green-500'
                  )}
                >
                  {habit.completedToday && <CheckIcon className="w-4 h-4" />}
                </button>
                <div>
                  <p
                    className={clsx(
                      'font-medium',
                      habit.completedToday ? 'text-green-700' : 'text-gray-900'
                    )}
                  >
                    {habit.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {habit.lifeArea && (
                      <span className="text-xs text-gray-500">{habit.lifeArea}</span>
                    )}
                    {habit.timeOfDay && (
                      <span className="text-xs text-gray-400">
                        {habit.timeOfDay}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {habit.currentStreak > 0 && (
                  <div
                    className={clsx(
                      'flex items-center gap-1 px-2 py-1 rounded-full text-sm',
                      habit.currentStreak >= 7
                        ? 'bg-orange-100 text-orange-600'
                        : 'bg-gray-100 text-gray-600'
                    )}
                  >
                    <FireIcon className="w-4 h-4" />
                    <span className="font-medium">{habit.currentStreak}d</span>
                  </div>
                )}

                {habit.streakStatus === 'at_risk' && !habit.completedToday && (
                  <span className="text-xs text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full">
                    At risk
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Non-due habits */}
      {habits.filter((h) => !h.isDueToday).length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            Not scheduled for today
          </h3>
          <div className="space-y-2 opacity-60">
            {habits
              .filter((h) => !h.isDueToday)
              .map((habit) => (
                <div
                  key={habit.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
                >
                  <span className="text-gray-600">{habit.title}</span>
                  {habit.currentStreak > 0 && (
                    <span className="text-xs text-gray-400">
                      🔥 {habit.currentStreak}d streak
                    </span>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

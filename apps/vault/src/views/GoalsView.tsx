import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FlagIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  PauseCircleIcon,
  PlayCircleIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import { api } from '../api';
import type { Goal } from '../api';

const LIFE_AREA_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  spiritual: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-300 dark:border-purple-700' },
  personal: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-700' },
  fitness: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', border: 'border-green-300 dark:border-green-700' },
  family: { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-300 dark:border-pink-700' },
  professional: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-700' },
  school: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-300 dark:border-indigo-700' },
};

const LIFE_AREA_ICONS: Record<string, string> = {
  spiritual: '🙏',
  personal: '🌟',
  fitness: '💪',
  family: '👨‍👩‍👧‍👦',
  professional: '💼',
  school: '📚',
};

interface GoalsViewProps {
  onGoalSelect?: (goalId: string) => void;
}

export function GoalsView({ onGoalSelect }: GoalsViewProps) {
  const [filter, setFilter] = useState<'active' | 'all' | 'completed'>('active');
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);

  const { data: goals = [], isLoading, error } = useQuery({
    queryKey: ['goals', filter],
    queryFn: () => api.listGoals(filter === 'all' ? undefined : filter),
  });

  const getProgressColor = (progress: number) => {
    if (progress >= 80) return 'bg-green-500 dark:bg-green-400';
    if (progress >= 50) return 'bg-yellow-500 dark:bg-yellow-400';
    if (progress >= 25) return 'bg-orange-500 dark:bg-orange-400';
    return 'bg-red-500 dark:bg-red-400';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleSolid className="w-5 h-5 text-green-500" />;
      case 'paused':
        return <PauseCircleIcon className="w-5 h-5 text-yellow-500" />;
      case 'abandoned':
        return <CheckCircleIcon className="w-5 h-5 text-gray-400" />;
      default:
        return <PlayCircleIcon className="w-5 h-5 text-blue-500" />;
    }
  };

  // Group goals by life area
  const goalsByArea = goals.reduce((acc, goal) => {
    const area = goal.lifeArea || 'other';
    if (!acc[area]) acc[area] = [];
    acc[area].push(goal);
    return acc;
  }, {} as Record<string, Goal[]>);

  if (isLoading) {
    return (
      <div className="flex-1 p-8 bg-white dark:bg-gray-900">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-8 bg-white dark:bg-gray-900">
        <div className="text-red-500 dark:text-red-400">Failed to load goals</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="px-8 py-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FlagIcon className="w-8 h-8 text-green-500" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Goals</h1>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
            {(['active', 'completed', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  filter === f
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="mt-4 grid grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {goals.filter(g => g.status === 'active').length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Active Goals</div>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {goals.filter(g => g.status === 'completed').length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Completed</div>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {goals.length > 0
                ? Math.round(goals.reduce((acc, g) => acc + g.progressPercentage, 0) / goals.length)
                : 0}%
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Avg Progress</div>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {Object.keys(goalsByArea).length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Life Areas</div>
          </div>
        </div>
      </div>

      {/* Goals List by Area */}
      <div className="p-8 space-y-8">
        {Object.entries(goalsByArea).map(([area, areaGoals]) => {
          const colors = LIFE_AREA_COLORS[area] || LIFE_AREA_COLORS.personal;
          const icon = LIFE_AREA_ICONS[area] || '🎯';

          return (
            <div key={area}>
              {/* Area Header */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">{icon}</span>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 capitalize">
                  {area}
                </h2>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${colors.bg} ${colors.text}`}>
                  {areaGoals.length} {areaGoals.length === 1 ? 'goal' : 'goals'}
                </span>
              </div>

              {/* Goals in this area */}
              <div className="space-y-3">
                {areaGoals.map((goal) => (
                  <div
                    key={goal.id}
                    className={`p-4 rounded-lg border ${colors.border} bg-white dark:bg-gray-800 hover:shadow-md transition-shadow`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Status Icon */}
                      <div className="flex-shrink-0 pt-0.5">
                        {getStatusIcon(goal.status)}
                      </div>

                      {/* Goal Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3
                            className="text-base font-medium text-gray-900 dark:text-gray-100 cursor-pointer hover:text-purple-600 dark:hover:text-purple-400"
                            onClick={() => onGoalSelect?.(goal.id)}
                          >
                            {goal.title}
                          </h3>
                          {goal.priority && goal.priority <= 2 && (
                            <span className="px-1.5 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
                              P{goal.priority}
                            </span>
                          )}
                        </div>

                        {goal.description && (
                          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                            {goal.description}
                          </p>
                        )}

                        {/* Progress Bar */}
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-gray-600 dark:text-gray-400">Progress</span>
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {goal.progressPercentage}%
                            </span>
                          </div>
                          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${getProgressColor(goal.progressPercentage)} transition-all duration-300`}
                              style={{ width: `${goal.progressPercentage}%` }}
                            />
                          </div>
                        </div>

                        {/* Expandable Details */}
                        {expandedGoal === goal.id && (
                          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2 text-sm">
                            {goal.targetDate && (
                              <div className="flex items-center justify-between">
                                <span className="text-gray-500 dark:text-gray-400">Target Date</span>
                                <span className="text-gray-900 dark:text-gray-100">
                                  {new Date(goal.targetDate).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                            {goal.metricType && goal.targetValue && (
                              <div className="flex items-center justify-between">
                                <span className="text-gray-500 dark:text-gray-400">Target</span>
                                <span className="text-gray-900 dark:text-gray-100">
                                  {goal.currentValue || 0} / {goal.targetValue}
                                </span>
                              </div>
                            )}
                            {goal.motivation && (
                              <div className="mt-2">
                                <span className="text-gray-500 dark:text-gray-400">Why it matters:</span>
                                <p className="mt-1 text-gray-700 dark:text-gray-300">{goal.motivation}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Expand/Collapse */}
                      <button
                        onClick={() => setExpandedGoal(expandedGoal === goal.id ? null : goal.id)}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <ChevronRightIcon
                          className={`w-5 h-5 text-gray-400 transition-transform ${
                            expandedGoal === goal.id ? 'rotate-90' : ''
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {goals.length === 0 && (
          <div className="text-center py-12">
            <FlagIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No goals yet</h3>
            <p className="text-gray-500 dark:text-gray-400">
              Create your first goal to start tracking your progress.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

import type { GoalsByDomain } from '@jd-agent/types';

interface Props {
  goals: GoalsByDomain[];
}

export function GoalsReview({ goals }: Props) {
  const totalGoals = goals.reduce((sum, area) => sum + area.goals.length, 0);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Goals Review</h2>
        <p className="text-sm text-gray-500 mt-1">
          {totalGoals} active goal{totalGoals !== 1 ? 's' : ''} across{' '}
          {goals.length} life area{goals.length !== 1 ? 's' : ''}
        </p>
      </div>

      {goals.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No active goals. Consider setting some goals to track your progress.
        </div>
      ) : (
        <div className="space-y-6">
          {goals.map((area) => (
            <div
              key={area.domain}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden"
            >
              {/* Area header */}
              <div
                className="px-4 py-3 border-b"
                style={{ backgroundColor: `${area.color}10` }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{area.icon}</span>
                  <h3 className="font-medium capitalize" style={{ color: area.color }}>
                    {area.domain}
                  </h3>
                  <span className="text-xs text-gray-500 ml-auto">
                    {area.goals.length} goal{area.goals.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Goals list */}
              <div className="divide-y divide-gray-100">
                {area.goals.map((goal) => (
                  <div key={goal.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{goal.title}</h4>
                        {goal.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                            {goal.description}
                          </p>
                        )}
                        {goal.motivation && (
                          <p className="text-sm text-gray-400 mt-2 italic">
                            "{goal.motivation}"
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        {/* Progress indicator */}
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 transition-all"
                              style={{
                                width: `${goal.progressPercentage}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs font-medium text-gray-500">
                            {Math.round(goal.progressPercentage)}%
                          </span>
                        </div>

                        {/* Target date */}
                        {goal.targetDate && (
                          <span className="text-xs text-gray-400">
                            Target: {new Date(goal.targetDate).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Associated habits */}
                    {goal.associatedHabits.length > 0 && (
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-xs text-gray-400">Habits:</span>
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                          {goal.associatedHabits.length} linked
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-600 text-center">
          Take a moment to reflect on your "why" for each goal. Are you still committed?
        </p>
      </div>
    </div>
  );
}

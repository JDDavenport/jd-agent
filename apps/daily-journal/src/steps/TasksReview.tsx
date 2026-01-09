import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import type { TaskReviewData, TaskReflection } from '@jd-agent/types';
import { CheckCircleIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/solid';

interface Props {
  tasks: TaskReviewData[];
  reflections: TaskReflection[];
  onReflection: (taskId: string, taskTitle: string, note: string) => void;
}

export function TasksReview({ tasks, reflections, onReflection }: Props) {
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  const getReflection = (taskId: string) => {
    return reflections.find((r) => r.taskId === taskId)?.reflectionNote || '';
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Tasks Review</h2>
        <p className="text-sm text-gray-500 mt-1">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''} completed today
        </p>
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <CheckCircleIcon className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p>No tasks completed today.</p>
          <p className="text-sm mt-2">That's okay - rest is important too!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const isExpanded = expandedTask === task.id;
            const reflection = getReflection(task.id);

            return (
              <div
                key={task.id}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden"
              >
                <button
                  onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                        {task.projectName && (
                          <span className="bg-gray-100 px-2 py-0.5 rounded">
                            {task.projectName}
                          </span>
                        )}
                        <span>
                          Completed at{' '}
                          {format(parseISO(task.completedAt), 'h:mm a')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {reflection && (
                      <span className="text-xs text-blue-500">Has note</span>
                    )}
                    {isExpanded ? (
                      <ChevronUpIcon className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                    {task.description && (
                      <p className="text-sm text-gray-600 mb-3">
                        {task.description}
                      </p>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reflection (optional)
                      </label>
                      <textarea
                        value={reflection}
                        onChange={(e) =>
                          onReflection(task.id, task.title, e.target.value)
                        }
                        placeholder="Any thoughts on how this went?"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        rows={2}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-600 text-center">
          Click on a task to add a reflection about how it went.
        </p>
      </div>
    </div>
  );
}

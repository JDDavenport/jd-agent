import { useMemo } from 'react';
import { isPast, isToday, parseISO } from 'date-fns';
import { ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { TaskCard } from '../components/TaskCard';
import { InlineAddTask } from '../components/InlineAddTask';
import { useTodayTasks, useCompleteTask } from '../hooks/useTasks';
import type { Task } from '../api';

export function TodayView() {
  const { data: tasks, isLoading } = useTodayTasks();
  const completeTask = useCompleteTask();

  const { overdue, scheduled, anytime, completed } = useMemo(() => {
    if (!tasks) return { overdue: [], scheduled: [], anytime: [], completed: [] };

    const overdue: Task[] = [];
    const scheduled: Task[] = [];
    const anytime: Task[] = [];
    const completed: Task[] = [];

    tasks.forEach((task) => {
      if (task.status === 'done') {
        completed.push(task);
      } else if (task.dueDate) {
        const dueDate = parseISO(task.dueDate);
        if (isPast(dueDate) && !isToday(dueDate)) {
          overdue.push(task);
        } else if (task.scheduledStart) {
          scheduled.push(task);
        } else {
          anytime.push(task);
        }
      } else {
        anytime.push(task);
      }
    });

    // Sort scheduled by time
    scheduled.sort((a, b) => {
      if (!a.scheduledStart || !b.scheduledStart) return 0;
      return new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime();
    });

    // Sort by priority
    const sortByPriority = (a: Task, b: Task) => (b.priority || 0) - (a.priority || 0);
    overdue.sort(sortByPriority);
    anytime.sort(sortByPriority);

    return { overdue, scheduled, anytime, completed };
  }, [tasks]);

  const handleComplete = (id: string) => {
    completeTask.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const totalTasks = (tasks?.length || 0) - completed.length;
  const completedCount = completed.length;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress bar */}
      {totalTasks + completedCount > 0 && (
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{
                  width: `${(completedCount / (totalTasks + completedCount)) * 100}%`,
                }}
              />
            </div>
            <span className="text-sm text-gray-500">
              {completedCount}/{totalTasks + completedCount} done
            </span>
          </div>
        </div>
      )}

      {/* Overdue Section */}
      {overdue.length > 0 && (
        <section className="border-b border-gray-100">
          <div className="px-6 py-3 bg-red-50 flex items-center gap-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
            <h2 className="text-sm font-semibold text-red-700">
              Overdue ({overdue.length})
            </h2>
          </div>
          <div>
            {overdue.map((task) => (
              <TaskCard key={task.id} task={task} onComplete={handleComplete} />
            ))}
          </div>
        </section>
      )}

      {/* Scheduled Section */}
      {scheduled.length > 0 && (
        <section className="border-b border-gray-100">
          <div className="px-6 py-3 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">
              Scheduled ({scheduled.length})
            </h2>
          </div>
          <div>
            {scheduled.map((task) => (
              <TaskCard key={task.id} task={task} onComplete={handleComplete} />
            ))}
          </div>
        </section>
      )}

      {/* Anytime Section */}
      <section className="border-b border-gray-100">
        {anytime.length > 0 && (
          <>
            <div className="px-6 py-3 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">
                Anytime Today ({anytime.length})
              </h2>
            </div>
            <div>
              {anytime.map((task) => (
                <TaskCard key={task.id} task={task} onComplete={handleComplete} />
              ))}
            </div>
          </>
        )}
        <InlineAddTask
          status="today"
          placeholder="Add a task for today..."
        />
      </section>

      {/* Completed Section */}
      {completed.length > 0 && (
        <section>
          <div className="px-6 py-3 bg-gray-50 flex items-center gap-2">
            <CheckCircleIcon className="w-5 h-5 text-green-500" />
            <h2 className="text-sm font-semibold text-gray-500">
              Completed ({completed.length})
            </h2>
          </div>
          <div>
            {completed.map((task) => (
              <TaskCard key={task.id} task={task} onComplete={handleComplete} />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {totalTasks === 0 && completedCount === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircleIcon className="w-8 h-8 text-green-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">All caught up!</h3>
          <p className="text-gray-500">No tasks for today. Enjoy your free time!</p>
        </div>
      )}
    </div>
  );
}

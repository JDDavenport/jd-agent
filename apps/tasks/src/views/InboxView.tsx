import { useMemo } from 'react';
import { InboxIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { TaskCard } from '../components/TaskCard';
import { InlineAddTask } from '../components/InlineAddTask';
import { useTasks, useCompleteTask } from '../hooks/useTasks';
import type { Task } from '../api';

interface InboxViewProps {
  onSelectTask?: (task: Task) => void;
}

export function InboxView({ onSelectTask }: InboxViewProps) {
  const { data: allTasks, isLoading } = useTasks();
  const completeTask = useCompleteTask();

  // Inbox = tasks without projects, due dates, or scheduled dates (unprocessed tasks)
  const tasks = useMemo(() => {
    if (!allTasks) return [];
    return allTasks.filter(
      (task) =>
        task.status !== 'done' &&
        task.status !== 'archived' &&
        !task.projectId &&
        !task.dueDate &&
        !task.scheduledStart
    );
  }, [allTasks]);

  const handleComplete = (id: string) => {
    completeTask.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <SparklesIcon className="w-8 h-8 text-blue-500" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">Inbox Zero!</h3>
        <p className="text-gray-500 max-w-sm">
          All tasks have been processed. Great job staying on top of things!
        </p>
      </div>
    );
  }

  return (
    <div data-testid="inbox-view" className="max-w-3xl mx-auto">
      {/* Info banner */}
      <div data-testid="inbox-banner" className="px-6 py-4 bg-blue-50 border-b border-blue-100">
        <div className="flex items-start gap-3">
          <InboxIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p data-testid="inbox-count" className="text-sm text-blue-800">
              <strong>{tasks.length} items</strong> waiting to be processed.
            </p>
            <p className="text-xs text-blue-600 mt-1">
              For each task, ask: "What's the next action?" Then schedule, delegate, or do it.
            </p>
          </div>
        </div>
      </div>

      {/* Task list */}
      <div data-testid="inbox-task-list">
        {tasks.map((task, index) => (
          <TaskCard key={task.id} task={task} index={index} onComplete={handleComplete} onSelect={onSelectTask} />
        ))}
        <InlineAddTask
          status="inbox"
          placeholder="Add to inbox..."
        />
      </div>

      {/* GTD tip */}
      <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
        <p className="text-xs text-gray-500 text-center">
          <strong>GTD Tip:</strong> Process items top-to-bottom. Don't skip around!
        </p>
      </div>
    </div>
  );
}

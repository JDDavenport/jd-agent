import { TaskCard } from './TaskCard';
import type { Task } from '@jd-agent/types';

interface TaskListProps {
  tasks: Task[];
  isLoading?: boolean;
  emptyMessage?: string;
  onComplete: (id: string) => void;
  onSelect?: (task: Task) => void;
}

export function TaskList({
  tasks,
  isLoading,
  emptyMessage = 'No tasks',
  onComplete,
  onSelect,
}: TaskListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 bg-gray-100 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          onComplete={onComplete}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

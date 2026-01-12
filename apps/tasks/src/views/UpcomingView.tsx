import { useMemo } from 'react';
import {
  format,
  addDays,
  startOfDay,
  parseISO,
} from 'date-fns';
import { CalendarDaysIcon } from '@heroicons/react/24/outline';
import { TaskCard } from '../components/TaskCard';
import { InlineAddTask } from '../components/InlineAddTask';
import { useTasks, useCompleteTask } from '../hooks/useTasks';
import type { Task } from '../api';

interface DayGroup {
  date: Date;
  label: string;
  tasks: Task[];
}

interface UpcomingViewProps {
  onSelectTask?: (task: Task) => void;
}

export function UpcomingView({ onSelectTask }: UpcomingViewProps) {
  const { data: tasks, isLoading } = useTasks();
  const completeTask = useCompleteTask();

  const dayGroups = useMemo(() => {
    if (!tasks) return [];

    // Filter to upcoming tasks (not done, has due date in future)
    const upcomingTasks = tasks.filter(
      (t) => t.status !== 'done' && t.dueDate
    );

    // Group by day
    const groups: Map<string, DayGroup> = new Map();
    const today = startOfDay(new Date());

    // Create next 7 days + "Later" bucket
    for (let i = 0; i < 7; i++) {
      const date = addDays(today, i);
      const key = format(date, 'yyyy-MM-dd');
      let label = format(date, 'EEEE, MMMM d');
      if (i === 0) label = 'Today';
      if (i === 1) label = 'Tomorrow';
      groups.set(key, { date, label, tasks: [] });
    }

    // Add "Next Week" and "Later" groups
    groups.set('next-week', {
      date: addDays(today, 7),
      label: 'Next Week',
      tasks: [],
    });
    groups.set('later', {
      date: addDays(today, 14),
      label: 'Later',
      tasks: [],
    });

    // Sort tasks into groups
    upcomingTasks.forEach((task) => {
      const dueDate = parseISO(task.dueDate!);
      const daysDiff = Math.floor(
        (startOfDay(dueDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff < 0) {
        // Overdue - put in today
        const todayKey = format(today, 'yyyy-MM-dd');
        groups.get(todayKey)?.tasks.push(task);
      } else if (daysDiff < 7) {
        const key = format(dueDate, 'yyyy-MM-dd');
        groups.get(key)?.tasks.push(task);
      } else if (daysDiff < 14) {
        groups.get('next-week')?.tasks.push(task);
      } else {
        groups.get('later')?.tasks.push(task);
      }
    });

    // Convert to array and filter empty groups (except today)
    return Array.from(groups.values()).filter(
      (g, i) => g.tasks.length > 0 || i === 0
    );
  }, [tasks]);

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

  const totalTasks = dayGroups.reduce((acc, g) => acc + g.tasks.length, 0);

  if (totalTasks === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <CalendarDaysIcon className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">No upcoming tasks</h3>
        <p className="text-gray-500 max-w-sm">
          Schedule some tasks to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {dayGroups.map((group) => (
        <section key={group.label} className="border-b border-gray-100 last:border-0">
          <div className="px-6 py-3 bg-gray-50 sticky top-0 z-10">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              {group.label}
              {group.tasks.length > 0 && (
                <span className="text-gray-400 font-normal">({group.tasks.length})</span>
              )}
            </h2>
          </div>
          {group.tasks.length > 0 ? (
            <div>
              {group.tasks.map((task) => (
                <TaskCard key={task.id} task={task} onComplete={handleComplete} onSelect={onSelectTask} />
              ))}
            </div>
          ) : (
            <div className="px-6 py-4 text-sm text-gray-400">No tasks scheduled</div>
          )}
          <InlineAddTask
            status="upcoming"
            placeholder={`Add task for ${group.label.toLowerCase()}...`}
          />
        </section>
      ))}
    </div>
  );
}

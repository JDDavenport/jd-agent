import { useMemo, useState } from 'react';
import { format, parseISO, startOfDay, endOfDay, addDays, isSameDay } from 'date-fns';
import {
  CheckCircleIcon,
  ClockIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon,
  ChevronRightIcon,
  BookOpenIcon,
  PlayIcon,
  AcademicCapIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import clsx from 'clsx';
import { useSchoolTasks, useCompleteTask } from '../hooks/useStudy';
import { matchCourse, COURSES } from '../types/courses';
import type { Task } from '../types';

export function ThisWeekView() {
  const { data: tasks, isLoading } = useSchoolTasks();
  const completeTask = useCompleteTask();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Calculate date range: tomorrow through next Friday
  const { startDate, endDate, dayGroups } = useMemo(() => {
    const today = new Date();
    const tomorrow = startOfDay(addDays(today, 1));
    
    // Find next Friday (or this Friday if today is before Friday)
    let nextFriday = new Date(today);
    const dayOfWeek = nextFriday.getDay();
    const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 5 + (7 - dayOfWeek);
    nextFriday = addDays(nextFriday, daysUntilFriday + 7); // Next week's Friday
    nextFriday = endOfDay(nextFriday);

    // Filter and group tasks by date
    const weekTasks = (tasks || []).filter(task => {
      if (!task.dueDate || task.status === 'done') return false;
      const dueDate = parseISO(task.dueDate);
      return dueDate >= tomorrow && dueDate <= nextFriday;
    });

    // Group by date
    const groups: Map<string, Task[]> = new Map();
    weekTasks.forEach(task => {
      const dateKey = format(parseISO(task.dueDate!), 'yyyy-MM-dd');
      if (!groups.has(dateKey)) groups.set(dateKey, []);
      groups.get(dateKey)!.push(task);
    });

    // Sort each group by course
    groups.forEach((tasks, key) => {
      tasks.sort((a, b) => (a.context || '').localeCompare(b.context || ''));
    });

    // Convert to sorted array
    const sortedGroups = Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, tasks]) => ({
        date,
        dateObj: parseISO(date),
        tasks,
      }));

    return {
      startDate: tomorrow,
      endDate: nextFriday,
      dayGroups: sortedGroups,
    };
  }, [tasks]);

  const handleComplete = async (taskId: string) => {
    await completeTask.mutateAsync(taskId);
  };

  const totalTasks = dayGroups.reduce((sum, g) => sum + g.tasks.length, 0);
  const totalMinutes = dayGroups.reduce((sum, g) => 
    sum + g.tasks.reduce((s, t) => s + (t.timeEstimateMinutes || 30), 0), 0
  );

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">This Week</h1>
        <p className="text-gray-500 mt-1">
          {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
        </p>
        <div className="flex gap-4 mt-4">
          <div className="bg-blue-50 rounded-lg px-4 py-2">
            <span className="text-2xl font-bold text-blue-700">{totalTasks}</span>
            <span className="text-blue-600 ml-2">tasks</span>
          </div>
          <div className="bg-purple-50 rounded-lg px-4 py-2">
            <span className="text-2xl font-bold text-purple-700">
              {Math.round(totalMinutes / 60)}h {totalMinutes % 60}m
            </span>
            <span className="text-purple-600 ml-2">estimated</span>
          </div>
        </div>
      </div>

      {/* Day Groups */}
      {dayGroups.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <CheckCircleSolid className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <p className="text-gray-600">No tasks due this week. You're all caught up!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {dayGroups.map(({ date, dateObj, tasks }) => (
            <div key={date} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Day Header */}
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-gray-900">
                      {format(dateObj, 'EEEE')}
                    </span>
                    <span className="text-gray-500 ml-2">
                      {format(dateObj, 'MMMM d')}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Tasks */}
              <div className="divide-y divide-gray-100">
                {tasks.map(task => {
                  const course = matchCourse(task.context, task.taskLabels);
                  return (
                    <TaskRow
                      key={task.id}
                      task={task}
                      course={course}
                      onComplete={handleComplete}
                      onClick={() => setSelectedTask(task)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  course,
  onComplete,
  onClick,
}: {
  task: Task;
  course: ReturnType<typeof matchCourse>;
  onComplete: (id: string) => void;
  onClick: () => void;
}) {
  const [completing, setCompleting] = useState(false);

  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (completing) return;
    setCompleting(true);
    try {
      await onComplete(task.id);
    } finally {
      setTimeout(() => setCompleting(false), 2000);
    }
  };

  // Build Canvas URL
  const canvasUrl = useMemo(() => {
    if (!task.sourceRef?.startsWith('canvas:')) return null;
    const parts = task.sourceRef.split(':');
    const type = parts[1];
    const id = parts[2];
    
    const courseIds: Record<string, string> = {
      'mba560': '32991',
      'mba580': '33202',
      'entrepreneurial-innovation': '33259',
      'mba664': '34638',
      'mba677': '34458',
      'mba654': '34642',
      'mba693r': '34634',
    };
    
    const courseId = course?.id ? courseIds[course.id] : null;
    if (!courseId || !id || !/^\d+$/.test(id)) return null;
    
    return `https://byu.instructure.com/courses/${courseId}/${type === 'quiz' ? 'quizzes' : 'assignments'}/${id}`;
  }, [task.sourceRef, course]);

  return (
    <div
      className="flex items-center gap-3 p-4 hover:bg-gray-50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      {/* Checkbox */}
      <button
        onClick={handleComplete}
        disabled={completing}
        className={clsx(
          'w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
          completing
            ? 'bg-blue-100 border-blue-400 animate-pulse'
            : 'border-gray-300 hover:border-green-500 hover:bg-green-50'
        )}
      >
        {completing ? (
          <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <CheckCircleIcon className="w-4 h-4 text-gray-300 hover:text-green-500" />
        )}
      </button>

      {/* Course Badge */}
      {course && (
        <span className={clsx('text-lg', course.icon ? '' : course.color)}>
          {course.icon || '📚'}
        </span>
      )}

      {/* Task Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{task.title}</p>
        <p className="text-sm text-gray-500">{course?.shortName || task.context}</p>
      </div>

      {/* Time Estimate */}
      {task.timeEstimateMinutes && (
        <span className="flex items-center gap-1 text-sm text-gray-400">
          <ClockIcon className="w-4 h-4" />
          {task.timeEstimateMinutes}m
        </span>
      )}

      {/* Canvas Link */}
      {canvasUrl && (
        <a
          href={canvasUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
        >
          Canvas
        </a>
      )}

      <ChevronRightIcon className="w-5 h-5 text-gray-400" />
    </div>
  );
}

export default ThisWeekView;

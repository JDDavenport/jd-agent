import { useMemo, useState } from 'react';
import { format, parseISO, isPast, isToday, differenceInDays } from 'date-fns';
import {
  CheckCircleIcon,
  ClockIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import clsx from 'clsx';
import { useSchoolTasks, useCompleteTask } from '../hooks/useStudy';
import type { Task } from '../types';

// Course colors
const COURSE_COLORS: Record<string, string> = {
  'MBA560': 'bg-blue-100 text-blue-800 border-blue-200',
  'MBA580': 'bg-purple-100 text-purple-800 border-purple-200',
  'MBA654': 'bg-green-100 text-green-800 border-green-200',
  'MBA664': 'bg-amber-100 text-amber-800 border-amber-200',
  'MBA677': 'bg-rose-100 text-rose-800 border-rose-200',
  'MBA693R': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'default': 'bg-gray-100 text-gray-800 border-gray-200',
};

const COURSES = [
  { id: 'all', name: 'All Courses' },
  { id: 'MBA560', name: 'MBA 560 - Analytics' },
  { id: 'MBA580', name: 'MBA 580 - Strategy' },
  { id: 'MBA654', name: 'MBA 654 - Client Acq.' },
  { id: 'MBA664', name: 'MBA 664 - VC/PE' },
  { id: 'MBA677', name: 'MBA 677 - ETA' },
  { id: 'MBA693R', name: 'MBA 693R - Career' },
];

function getCourseColor(context: string): string {
  const upper = context?.toUpperCase() || '';
  for (const [key, value] of Object.entries(COURSE_COLORS)) {
    if (key !== 'default' && upper.includes(key)) return value;
  }
  return COURSE_COLORS.default;
}

function getCourseName(context: string): string {
  const upper = context?.toUpperCase() || '';
  if (upper.includes('MBA560')) return 'Analytics';
  if (upper.includes('MBA580')) return 'Strategy';
  if (upper.includes('MBA654')) return 'Client Acq.';
  if (upper.includes('MBA664')) return 'VC/PE';
  if (upper.includes('MBA677')) return 'ETA';
  if (upper.includes('MBA693R')) return 'Career';
  return context || 'General';
}

export function TasksView() {
  const { data: tasks, isLoading } = useSchoolTasks();
  const completeTask = useCompleteTask();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('all');
  const [showCompleted, setShowCompleted] = useState(false);

  const filteredTasks = useMemo(() => {
    if (!tasks) return { overdue: [], today: [], upcoming: [], later: [], completed: [] };

    const filtered = tasks.filter((task) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!task.title.toLowerCase().includes(query) && 
            !task.description?.toLowerCase().includes(query)) {
          return false;
        }
      }
      
      // Course filter
      if (selectedCourse !== 'all') {
        if (!task.context?.toUpperCase().includes(selectedCourse)) {
          return false;
        }
      }
      
      return true;
    });

    const overdue: Task[] = [];
    const today: Task[] = [];
    const upcoming: Task[] = []; // Next 7 days
    const later: Task[] = [];
    const completed: Task[] = [];

    for (const task of filtered) {
      if (task.status === 'done') {
        completed.push(task);
        continue;
      }

      if (!task.dueDate) {
        later.push(task);
        continue;
      }

      const dueDate = parseISO(task.dueDate);
      const daysUntil = differenceInDays(dueDate, new Date());

      if (isPast(dueDate) && !isToday(dueDate)) {
        overdue.push(task);
      } else if (isToday(dueDate)) {
        today.push(task);
      } else if (daysUntil <= 7) {
        upcoming.push(task);
      } else {
        later.push(task);
      }
    }

    // Sort each group by due date and priority
    const sortFn = (a: Task, b: Task) => {
      const aDue = a.dueDate ? parseISO(a.dueDate).getTime() : Infinity;
      const bDue = b.dueDate ? parseISO(b.dueDate).getTime() : Infinity;
      if (aDue !== bDue) return aDue - bDue;
      return (b.priority || 0) - (a.priority || 0);
    };

    overdue.sort(sortFn);
    today.sort(sortFn);
    upcoming.sort(sortFn);
    later.sort(sortFn);

    return { overdue, today, upcoming, later, completed };
  }, [tasks, searchQuery, selectedCourse]);

  const totalActive = filteredTasks.overdue.length + filteredTasks.today.length + 
                      filteredTasks.upcoming.length + filteredTasks.later.length;

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="h-12 bg-gray-200 rounded-lg" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">School Tasks</h1>
        <p className="text-gray-600 mt-1">
          {totalActive} active tasks • {filteredTasks.completed.length} completed
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          {/* Course filter */}
          <div className="relative">
            <FunnelIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
            >
              {COURSES.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Show completed tasks
        </label>
      </div>

      {/* Task Lists */}
      <div className="space-y-6">
        {/* Overdue */}
        {filteredTasks.overdue.length > 0 && (
          <TaskSection
            title="Overdue"
            tasks={filteredTasks.overdue}
            variant="danger"
            onComplete={(id) => completeTask.mutate(id)}
          />
        )}

        {/* Today */}
        {filteredTasks.today.length > 0 && (
          <TaskSection
            title="Due Today"
            tasks={filteredTasks.today}
            variant="warning"
            onComplete={(id) => completeTask.mutate(id)}
          />
        )}

        {/* Upcoming */}
        {filteredTasks.upcoming.length > 0 && (
          <TaskSection
            title="This Week"
            tasks={filteredTasks.upcoming}
            variant="default"
            onComplete={(id) => completeTask.mutate(id)}
          />
        )}

        {/* Later */}
        {filteredTasks.later.length > 0 && (
          <TaskSection
            title="Later / No Due Date"
            tasks={filteredTasks.later}
            variant="muted"
            onComplete={(id) => completeTask.mutate(id)}
          />
        )}

        {/* Completed */}
        {showCompleted && filteredTasks.completed.length > 0 && (
          <TaskSection
            title="Completed"
            tasks={filteredTasks.completed}
            variant="completed"
            onComplete={(id) => completeTask.mutate(id)}
          />
        )}

        {/* Empty state */}
        {totalActive === 0 && !showCompleted && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">All caught up!</h3>
            <p className="text-gray-500 mt-1">No active school tasks. Time for a break!</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface TaskSectionProps {
  title: string;
  tasks: Task[];
  variant: 'danger' | 'warning' | 'default' | 'muted' | 'completed';
  onComplete: (id: string) => void;
}

function TaskSection({ title, tasks, variant, onComplete }: TaskSectionProps) {
  const headerColors = {
    danger: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    default: 'bg-blue-50 border-blue-200 text-blue-800',
    muted: 'bg-gray-50 border-gray-200 text-gray-700',
    completed: 'bg-green-50 border-green-200 text-green-800',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className={clsx('px-4 py-3 border-b', headerColors[variant])}>
        <h2 className="font-semibold">{title} ({tasks.length})</h2>
      </div>
      <div className="divide-y divide-gray-100">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} onComplete={onComplete} />
        ))}
      </div>
    </div>
  );
}

interface TaskRowProps {
  task: Task;
  onComplete: (id: string) => void;
}

function TaskRow({ task, onComplete }: TaskRowProps) {
  const isCompleted = task.status === 'done';

  return (
    <div
      className={clsx(
        'flex items-start gap-3 p-4 transition-colors',
        isCompleted ? 'bg-gray-50' : 'hover:bg-gray-50'
      )}
    >
      <button
        onClick={() => !isCompleted && onComplete(task.id)}
        disabled={isCompleted}
        className={clsx(
          'mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
          isCompleted
            ? 'bg-green-500 border-green-500 text-white'
            : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50'
        )}
      >
        {isCompleted && <CheckCircleSolid className="w-5 h-5" />}
      </button>

      <div className="flex-1 min-w-0">
        <p className={clsx('font-medium', isCompleted ? 'text-gray-500 line-through' : 'text-gray-900')}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{task.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span className={clsx('text-xs px-2 py-0.5 rounded border', getCourseColor(task.context))}>
            {getCourseName(task.context)}
          </span>
          {task.timeEstimateMinutes && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <ClockIcon className="w-3 h-3" />
              {task.timeEstimateMinutes}m
            </span>
          )}
          {task.dueDate && (
            <span className="text-xs text-gray-500">
              Due {format(parseISO(task.dueDate), 'MMM d')}
            </span>
          )}
          {task.source === 'canvas' && (
            <span className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-700">
              Canvas
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

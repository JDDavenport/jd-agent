import { useMemo, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format, parseISO, isPast, isToday, isTomorrow, differenceInDays } from 'date-fns';
import {
  CheckCircleIcon,
  ClockIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  PlayIcon,
  AcademicCapIcon,
  ChevronRightIcon,
  ListBulletIcon,
  VideoCameraIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import clsx from 'clsx';
import { useSchoolTasks, useBooks, useCompleteTask, useDueFlashcards, useVideos, useMaterialsByCanvasCourseId } from '../hooks/useStudy';
import { getCourseById, matchCourse, CANVAS_COURSE_IDS } from '../types/courses';
import { TaskDetailModal } from '../components/TaskDetailModal';
import { ClassGPTView } from '../components/ClassGPTView';
import type { Task, Book, Video } from '../types';
import type { CourseMaterial } from '../api';

type TabId = 'overview' | 'tasks' | 'readings' | 'calendar' | 'chat';

export function CourseView() {
  const { courseId } = useParams<{ courseId: string }>();
  const course = getCourseById(courseId || '');
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Get Canvas course ID for video filtering
  const canvasCourseId = course?.id ? CANVAS_COURSE_IDS[course.id] : undefined;

  const { data: allTasks, isLoading: tasksLoading } = useSchoolTasks();
  const { data: allBooks, isLoading: booksLoading } = useBooks();
  const { data: allVideos, isLoading: videosLoading } = useVideos(canvasCourseId);
  const { data: canvasMaterials, isLoading: materialsLoading } = useMaterialsByCanvasCourseId(canvasCourseId);
  const { data: allFlashcards } = useDueFlashcards();
  const completeTask = useCompleteTask();

  // Filter tasks for this course
  const courseTasks = useMemo(() => {
    if (!allTasks || !course) return [];
    return allTasks.filter((task) => {
      const taskCourse = matchCourse(task.context, task.taskLabels);
      return taskCourse?.id === course.id;
    });
  }, [allTasks, course]);

  // Filter books for this course (by tags or title matching)
  const courseBooks = useMemo(() => {
    if (!allBooks || !course) return [];
    return allBooks.filter((book) => {
      const searchText = [
        book.title,
        ...(book.tags || []),
      ].join(' ').toLowerCase();
      
      return (
        searchText.includes(course.code.toLowerCase().replace(/\s+/g, '')) ||
        searchText.includes(course.shortName.toLowerCase()) ||
        searchText.includes(course.name.toLowerCase()) ||
        searchText.includes(course.id.toLowerCase())
      );
    });
  }, [allBooks, course]);

  // Videos are already filtered by Canvas course ID in the hook
  const courseVideos = allVideos || [];

  // Stats
  const stats = useMemo(() => {
    const activeTasks = courseTasks.filter((t) => t.status !== 'done');
    const completedTasks = courseTasks.filter((t) => t.status === 'done');
    const overdueTasks = activeTasks.filter((t) => {
      if (!t.dueDate) return false;
      const due = parseISO(t.dueDate);
      return isPast(due) && !isToday(due);
    });
    const dueSoonTasks = activeTasks.filter((t) => {
      if (!t.dueDate) return false;
      const due = parseISO(t.dueDate);
      const days = differenceInDays(due, new Date());
      return days >= 0 && days <= 3;
    });

    const totalMinutes = activeTasks.reduce(
      (sum, t) => sum + (t.timeEstimateMinutes || 15),
      0
    );

    return {
      active: activeTasks.length,
      completed: completedTasks.length,
      overdue: overdueTasks.length,
      dueSoon: dueSoonTasks.length,
      readings: courseBooks.length,
      videos: courseVideos.length,
      materials: canvasMaterials?.length || 0,
      estimatedHours: Math.round(totalMinutes / 60 * 10) / 10,
    };
  }, [courseTasks, courseBooks, courseVideos, canvasMaterials]);

  const handleCompleteTask = useCallback(async (taskId: string) => {
    await completeTask.mutateAsync(taskId);
    if (selectedTask?.id === taskId) {
      setSelectedTask(null);
    }
  }, [completeTask, selectedTask]);

  if (!course) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">Course not found</p>
      </div>
    );
  }

  if (tasksLoading || booksLoading || videosLoading || materialsLoading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-10 w-64 bg-gray-200 rounded" />
          <div className="h-32 bg-gray-200 rounded-xl" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; count?: number; icon?: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'tasks', label: 'Tasks', count: stats.active },
    { id: 'readings', label: 'Materials', count: stats.readings + stats.videos + stats.materials },
    { id: 'chat', label: 'Class GPT', icon: <SparklesIcon className="w-4 h-4 inline mr-1" /> },
    { id: 'calendar', label: 'Calendar' },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className={clsx('rounded-xl p-6 mb-6', course.bgColor, 'border', course.borderColor)}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{course.icon}</span>
              <div>
                <h1 className={clsx('text-2xl font-bold', course.color)}>{course.name}</h1>
                <p className="text-gray-600">{course.code} • Winter 2026</p>
              </div>
            </div>
          </div>
          <Link
            to="/timer"
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
              'bg-white hover:bg-gray-50 border', course.borderColor, course.color
            )}
          >
            <PlayIcon className="w-5 h-5" />
            Study Now
          </Link>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <QuickStat
            icon={<ClockIcon className="w-5 h-5" />}
            label="Active Tasks"
            value={stats.active}
            color={course.color}
          />
          <QuickStat
            icon={<ExclamationTriangleIcon className="w-5 h-5" />}
            label="Due Soon"
            value={stats.dueSoon}
            color={stats.dueSoon > 0 ? 'text-red-600' : course.color}
          />
          <QuickStat
            icon={<BookOpenIcon className="w-5 h-5" />}
            label="Readings"
            value={stats.readings}
            color={course.color}
          />
          <QuickStat
            icon={<ChartBarIcon className="w-5 h-5" />}
            label="Est. Hours"
            value={stats.estimatedHours}
            color={course.color}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex-1 px-4 py-3 text-sm font-medium transition-colors relative',
                activeTab === tab.id
                  ? clsx(course.color, course.bgColor)
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              )}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={clsx(
                  'ml-2 text-xs px-1.5 py-0.5 rounded-full',
                  activeTab === tab.id
                    ? 'bg-white/50'
                    : 'bg-gray-200'
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-4">
          {activeTab === 'overview' && (
            <OverviewTab
              course={course}
              tasks={courseTasks}
              books={courseBooks}
              onComplete={handleCompleteTask}
              onTaskClick={setSelectedTask}
            />
          )}
          {activeTab === 'tasks' && (
            <TasksTab
              course={course}
              tasks={courseTasks}
              onComplete={handleCompleteTask}
              onTaskClick={setSelectedTask}
            />
          )}
          {activeTab === 'readings' && (
            <ReadingsTab course={course} books={courseBooks} videos={courseVideos} materials={canvasMaterials || []} />
          )}
          {activeTab === 'chat' && canvasCourseId && (
            <ClassGPTView course={course} canvasCourseId={canvasCourseId} />
          )}
          {activeTab === 'calendar' && (
            <CalendarTab course={course} tasks={courseTasks} onTaskClick={setSelectedTask} />
          )}
        </div>
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          course={course}
          books={allBooks || []}
          onClose={() => setSelectedTask(null)}
          onComplete={handleCompleteTask}
        />
      )}
    </div>
  );
}

function QuickStat({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="bg-white/50 rounded-lg p-3">
      <div className={clsx('flex items-center gap-2', color)}>
        {icon}
        <span className="text-sm font-medium text-gray-600">{label}</span>
      </div>
      <p className={clsx('text-2xl font-bold mt-1', color)}>{value}</p>
    </div>
  );
}

// ============================================
// Overview Tab
// ============================================

interface OverviewTabProps {
  course: ReturnType<typeof getCourseById>;
  tasks: Task[];
  books: Book[];
  onComplete: (id: string) => void;
  onTaskClick: (task: Task) => void;
}

function OverviewTab({ course, tasks, books, onComplete, onTaskClick }: OverviewTabProps) {
  // Get urgent tasks (due within 3 days or overdue)
  const urgentTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        if (t.status === 'done') return false;
        if (!t.dueDate) return false;
        const due = parseISO(t.dueDate);
        const days = differenceInDays(due, new Date());
        return days <= 3;
      })
      .sort((a, b) => {
        const aDue = a.dueDate ? parseISO(a.dueDate).getTime() : Infinity;
        const bDue = b.dueDate ? parseISO(b.dueDate).getTime() : Infinity;
        return aDue - bDue;
      })
      .slice(0, 5);
  }, [tasks]);

  // Recent/active readings
  const recentReadings = books.filter((b) => b.status === 'ready').slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Urgent Tasks */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
          Coming Up
        </h3>
        {urgentTasks.length > 0 ? (
          <div className="space-y-2">
            {urgentTasks.map((task) => (
              <TaskRow 
                key={task.id} 
                task={task} 
                onComplete={onComplete} 
                onClick={() => onTaskClick(task)}
              />
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm py-4 text-center bg-gray-50 rounded-lg">
            No urgent tasks — you're all caught up! 🎉
          </p>
        )}
      </div>

      {/* Readings */}
      <div>
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <BookOpenIcon className="w-5 h-5 text-blue-500" />
          Course Readings
        </h3>
        {recentReadings.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {recentReadings.map((book) => (
              <BookCard key={book.id} book={book} courseId={course?.id || ''} />
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm py-4 text-center bg-gray-50 rounded-lg">
            No readings uploaded for this course yet
          </p>
        )}
      </div>

      {/* Progress Summary */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 mb-2">Course Progress</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Tasks Completed</span>
              <span className="font-medium">
                {tasks.filter((t) => t.status === 'done').length} / {tasks.length}
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={clsx('h-full rounded-full', course?.bgColor?.replace('bg-', 'bg-').replace('-50', '-500'))}
                style={{
                  width: `${tasks.length ? (tasks.filter((t) => t.status === 'done').length / tasks.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Tasks Tab
// ============================================

interface TasksTabProps {
  course: ReturnType<typeof getCourseById>;
  tasks: Task[];
  onComplete: (id: string) => void;
  onTaskClick: (task: Task) => void;
}

function TasksTab({ course, tasks, onComplete, onTaskClick }: TasksTabProps) {
  const [showCompleted, setShowCompleted] = useState(false);

  const { overdue, today, upcoming, later, completed } = useMemo(() => {
    const overdue: Task[] = [];
    const today: Task[] = [];
    const upcoming: Task[] = [];
    const later: Task[] = [];
    const completed: Task[] = [];

    for (const task of tasks) {
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

    const sortFn = (a: Task, b: Task) => {
      const aDue = a.dueDate ? parseISO(a.dueDate).getTime() : Infinity;
      const bDue = b.dueDate ? parseISO(b.dueDate).getTime() : Infinity;
      return aDue - bDue;
    };

    return {
      overdue: overdue.sort(sortFn),
      today: today.sort(sortFn),
      upcoming: upcoming.sort(sortFn),
      later: later.sort(sortFn),
      completed,
    };
  }, [tasks]);

  const activeCount = overdue.length + today.length + upcoming.length + later.length;

  return (
    <div className="space-y-4">
      {/* Toggle completed */}
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">
          {activeCount} active • {completed.length} completed
        </p>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="rounded border-gray-300 text-blue-600"
          />
          Show completed
        </label>
      </div>

      {/* Task Groups */}
      {overdue.length > 0 && (
        <TaskGroup
          title="Overdue"
          tasks={overdue}
          onComplete={onComplete}
          onTaskClick={onTaskClick}
          variant="danger"
        />
      )}
      {today.length > 0 && (
        <TaskGroup
          title="Due Today"
          tasks={today}
          onComplete={onComplete}
          onTaskClick={onTaskClick}
          variant="warning"
        />
      )}
      {upcoming.length > 0 && (
        <TaskGroup
          title="This Week"
          tasks={upcoming}
          onComplete={onComplete}
          onTaskClick={onTaskClick}
          variant="default"
        />
      )}
      {later.length > 0 && (
        <TaskGroup
          title="Later / No Date"
          tasks={later}
          onComplete={onComplete}
          onTaskClick={onTaskClick}
          variant="muted"
        />
      )}
      {showCompleted && completed.length > 0 && (
        <TaskGroup
          title="Completed"
          tasks={completed}
          onComplete={onComplete}
          onTaskClick={onTaskClick}
          variant="completed"
        />
      )}

      {activeCount === 0 && (
        <div className="text-center py-8">
          <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-2" />
          <p className="text-gray-600">All tasks completed!</p>
        </div>
      )}
    </div>
  );
}

function TaskGroup({
  title,
  tasks,
  onComplete,
  onTaskClick,
  variant,
}: {
  title: string;
  tasks: Task[];
  onComplete: (id: string) => void;
  onTaskClick: (task: Task) => void;
  variant: 'danger' | 'warning' | 'default' | 'muted' | 'completed';
}) {
  const colors = {
    danger: 'bg-red-50 border-red-100 text-red-800',
    warning: 'bg-amber-50 border-amber-100 text-amber-800',
    default: 'bg-blue-50 border-blue-100 text-blue-800',
    muted: 'bg-gray-50 border-gray-100 text-gray-700',
    completed: 'bg-green-50 border-green-100 text-green-800',
  };

  return (
    <div className="rounded-lg border overflow-hidden">
      <div className={clsx('px-3 py-2 border-b', colors[variant])}>
        <h4 className="text-sm font-semibold">{title} ({tasks.length})</h4>
      </div>
      <div className="divide-y divide-gray-100">
        {tasks.map((task) => (
          <TaskRow 
            key={task.id} 
            task={task} 
            onComplete={onComplete} 
            onClick={() => onTaskClick(task)}
          />
        ))}
      </div>
    </div>
  );
}

function TaskRow({
  task,
  onComplete,
  onClick,
}: {
  task: Task;
  onComplete: (id: string) => void;
  onClick?: () => void;
}) {
  const [completing, setCompleting] = useState(false);
  const isCompleted = task.status === 'done';
  const isDeliverables = task.title.toLowerCase().includes('deliverables');
  const dueText = task.dueDate
    ? formatDueDate(task.dueDate)
    : null;

  const handleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isCompleted || completing) return;
    setCompleting(true);
    try {
      await onComplete(task.id);
    } finally {
      // Reset after a delay in case the mutation fails
      setTimeout(() => setCompleting(false), 2000);
    }
  };

  return (
    <div 
      className={clsx(
        'flex items-start gap-3 p-3 cursor-pointer transition-colors',
        isCompleted ? 'bg-gray-50' : 'hover:bg-blue-50/50'
      )}
      onClick={onClick}
    >
      <button
        onClick={handleComplete}
        disabled={isCompleted || completing}
        title={isCompleted ? 'Completed' : 'Click to mark complete'}
        className={clsx(
          'mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
          isCompleted
            ? 'bg-green-500 border-green-500 text-white'
            : completing
            ? 'bg-blue-100 border-blue-400 animate-pulse'
            : 'border-gray-300 hover:border-green-500 hover:bg-green-50 group'
        )}
      >
        {isCompleted ? (
          <CheckCircleSolid className="w-6 h-6" />
        ) : completing ? (
          <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <CheckCircleIcon className="w-4 h-4 text-gray-300 group-hover:text-green-500" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={clsx('font-medium', isCompleted ? 'text-gray-500 line-through' : 'text-gray-900')}>
            {task.title}
          </p>
          {isDeliverables && !isCompleted && (
            <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
              <ListBulletIcon className="w-3 h-3" />
              Multiple
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
          {task.timeEstimateMinutes && (
            <span className="flex items-center gap-1">
              <ClockIcon className="w-3 h-3" />
              {task.timeEstimateMinutes}m
            </span>
          )}
          {dueText && <span>{dueText}</span>}
        </div>
      </div>
      <ChevronRightIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
    </div>
  );
}

function formatDueDate(dueDate: string): string {
  const date = parseISO(dueDate);
  if (isPast(date) && !isToday(date)) return 'Overdue';
  if (isToday(date)) return 'Today';
  if (isTomorrow(date)) return 'Tomorrow';
  return format(date, 'MMM d');
}

// ============================================
// Readings Tab (now includes videos)
// ============================================

interface ReadingsTabProps {
  course: ReturnType<typeof getCourseById>;
  books: Book[];
  videos: Video[];
  materials: CourseMaterial[];
}

function ReadingsTab({ course, books, videos, materials }: ReadingsTabProps) {
  const readyBooks = books.filter((b) => b.status === 'ready');
  const processingBooks = books.filter((b) => b.status === 'processing');
  const readyVideos = videos.filter((v) => v.status === 'ready');
  const processingVideos = videos.filter((v) => v.status === 'pending' || v.status === 'processing');

  // Group materials by module
  const materialsByModule = useMemo(() => {
    const grouped: Record<string, CourseMaterial[]> = {};
    for (const m of materials) {
      const key = m.moduleName || 'Other Materials';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(m);
    }
    return Object.entries(grouped);
  }, [materials]);

  const hasContent = readyBooks.length > 0 || readyVideos.length > 0 || materials.length > 0;
  const hasProcessing = processingBooks.length > 0 || processingVideos.length > 0;

  return (
    <div className="space-y-6">
      {hasProcessing && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            {processingBooks.length > 0 && `${processingBooks.length} reading(s) processing`}
            {processingBooks.length > 0 && processingVideos.length > 0 && ' • '}
            {processingVideos.length > 0 && `${processingVideos.length} video(s) processing`}
          </p>
        </div>
      )}

      {/* Canvas Materials Section */}
      {materials.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <BookOpenIcon className="w-5 h-5 text-orange-500" />
            Course Materials ({materials.length})
          </h3>
          <div className="space-y-4">
            {materialsByModule.map(([moduleName, moduleItems]) => (
              <div key={moduleName} className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700">{moduleName}</h4>
                </div>
                <div className="divide-y divide-gray-100">
                  {moduleItems.map((material) => (
                    <MaterialRow key={material.id} material={material} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Videos Section */}
      {readyVideos.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <VideoCameraIcon className="w-5 h-5 text-red-500" />
            Videos ({readyVideos.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {readyVideos.map((video) => (
              <VideoCard key={video.id} video={video} courseId={course?.id || ''} />
            ))}
          </div>
        </div>
      )}

      {/* Readings Section */}
      {readyBooks.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <BookOpenIcon className="w-5 h-5 text-blue-500" />
            Uploaded PDFs ({readyBooks.length})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {readyBooks.map((book) => (
              <BookCard key={book.id} book={book} courseId={course?.id || ''} expanded />
            ))}
          </div>
        </div>
      )}

      {!hasContent && (
        <div className="text-center py-12">
          <BookOpenIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No materials for this course</p>
          <p className="text-sm text-gray-500 mt-1">
            Run Canvas sync to add PDFs and videos
          </p>
        </div>
      )}
    </div>
  );
}

function MaterialRow({ material }: { material: CourseMaterial }) {
  const getTypeIcon = (type: string) => {
    if (type.includes('pdf') || type.includes('doc')) return '📄';
    if (type.includes('ppt') || type.includes('slide')) return '📊';
    if (type.includes('page')) return '📝';
    if (type.includes('video')) return '🎬';
    if (type.includes('link')) return '🔗';
    return '📁';
  };

  return (
    <a
      href={material.canvasUrl || material.downloadUrl || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors"
    >
      <span className="text-lg">{getTypeIcon(material.fileType)}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {material.displayName || material.fileName}
        </p>
        {material.materialType && (
          <span className="text-xs text-gray-500 capitalize">{material.materialType}</span>
        )}
      </div>
      {material.readStatus === 'completed' ? (
        <CheckCircleSolid className="w-5 h-5 text-green-500 flex-shrink-0" />
      ) : material.readProgress > 0 ? (
        <span className="text-xs text-orange-600">{material.readProgress}%</span>
      ) : null}
      <ChevronRightIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
    </a>
  );
}

function VideoCard({
  video,
  courseId,
}: {
  video: Video;
  courseId: string;
}) {
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
  };

  return (
    <Link
      to={`/course/${courseId}/videos/${video.id}`}
      className="flex gap-4 rounded-lg border border-gray-200 p-4 hover:border-red-300 hover:shadow-sm transition-all"
    >
      <div className="flex-shrink-0 w-24 h-16 bg-black rounded overflow-hidden relative">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
            <PlayIcon className="w-8 h-8 text-white" />
          </div>
        )}
        {video.durationSeconds && (
          <span className="absolute bottom-1 right-1 text-xs bg-black/80 text-white px-1 rounded">
            {formatDuration(video.durationSeconds)}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-gray-900 line-clamp-2">{video.title}</h4>
        {video.channelName && (
          <p className="text-sm text-gray-500 mt-1">{video.channelName}</p>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {video.status === 'ready' && video.summaryShort && (
            <span className="text-xs px-1.5 py-0.5 bg-green-50 text-green-600 rounded flex items-center gap-1">
              ✓ Summary
            </span>
          )}
          {video.canvasModuleName && (
            <span className="text-xs px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded">
              {video.canvasModuleName.slice(0, 30)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function BookCard({
  book,
  courseId,
  expanded = false,
}: {
  book: Book;
  courseId: string;
  expanded?: boolean;
}) {
  return (
    <Link
      to={`/course/${courseId}/readings/${book.id}`}
      className={clsx(
        'block rounded-lg border border-gray-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all',
        expanded && 'flex gap-4'
      )}
    >
      <div className="flex-shrink-0 w-12 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded flex items-center justify-center">
        <BookOpenIcon className="w-6 h-6 text-white" />
      </div>
      <div className="flex-1 min-w-0 mt-3 sm:mt-0">
        <h4 className="font-medium text-gray-900 line-clamp-2">{book.title}</h4>
        {book.author && (
          <p className="text-sm text-gray-500 mt-1">{book.author}</p>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {book.pageCount && (
            <span className="text-xs text-gray-400">{book.pageCount} pages</span>
          )}
          {book.tags && book.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

// ============================================
// Calendar Tab
// ============================================

interface CalendarTabProps {
  course: ReturnType<typeof getCourseById>;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

function CalendarTab({ course, tasks, onTaskClick }: CalendarTabProps) {
  // Group tasks by due date
  const tasksByDate = useMemo(() => {
    const groups: Record<string, Task[]> = {};

    for (const task of tasks) {
      if (task.status === 'done' || !task.dueDate) continue;
      const dateKey = format(parseISO(task.dueDate), 'yyyy-MM-dd');
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(task);
    }

    // Sort by date
    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 10);
  }, [tasks]);

  if (tasksByDate.length === 0) {
    return (
      <div className="text-center py-12">
        <CalendarDaysIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">No upcoming deadlines</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tasksByDate.map(([dateStr, dateTasks]) => {
        const date = parseISO(dateStr);
        const isOverdue = isPast(date) && !isToday(date);

        return (
          <div
            key={dateStr}
            className={clsx(
              'rounded-lg border p-4',
              isOverdue
                ? 'bg-red-50 border-red-200'
                : isToday(date)
                ? 'bg-amber-50 border-amber-200'
                : 'bg-white border-gray-200'
            )}
          >
            <div className="flex items-center gap-2 mb-3">
              <CalendarDaysIcon className={clsx(
                'w-5 h-5',
                isOverdue ? 'text-red-600' : isToday(date) ? 'text-amber-600' : 'text-gray-600'
              )} />
              <h4 className={clsx(
                'font-semibold',
                isOverdue ? 'text-red-800' : isToday(date) ? 'text-amber-800' : 'text-gray-900'
              )}>
                {format(date, 'EEEE, MMMM d')}
                {isToday(date) && <span className="ml-2 text-sm font-normal">(Today)</span>}
                {isOverdue && <span className="ml-2 text-sm font-normal">(Overdue)</span>}
              </h4>
            </div>
            <div className="space-y-2">
              {dateTasks.map((task) => (
                <div 
                  key={task.id} 
                  className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white/50 p-1 rounded"
                  onClick={() => onTaskClick(task)}
                >
                  <span className={clsx(
                    'w-2 h-2 rounded-full',
                    course?.bgColor?.replace('bg-', 'bg-').replace('-50', '-500') || 'bg-blue-500'
                  )} />
                  <span className="text-gray-700 flex-1">{task.title}</span>
                  {task.timeEstimateMinutes && (
                    <span className="text-gray-400">~{task.timeEstimateMinutes}m</span>
                  )}
                  <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

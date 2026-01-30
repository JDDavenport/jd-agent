import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO, differenceInDays, isPast, isToday } from 'date-fns';
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  BookOpenIcon,
  AcademicCapIcon,
  ArrowRightIcon,
  PlayIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import clsx from 'clsx';
import { useSchoolTasks, useTodayTasks, useBooks, useCompleteTask, useDueFlashcards } from '../hooks/useStudy';
import { COURSES, matchCourse, getCourseById } from '../types/courses';
import type { Task, Book } from '../types';
import type { Course } from '../types/courses';

export function DashboardView() {
  const { data: schoolTasks, isLoading: tasksLoading } = useSchoolTasks();
  const { data: books, isLoading: booksLoading } = useBooks();
  const { data: dueFlashcards } = useDueFlashcards();
  const completeTask = useCompleteTask();

  // Group tasks by course
  const courseData = useMemo(() => {
    if (!schoolTasks) return [];

    const data: Array<{
      course: Course;
      activeTasks: Task[];
      urgentTasks: Task[];
      totalMinutes: number;
      completedCount: number;
    }> = [];

    for (const course of COURSES) {
      const courseTasks = schoolTasks.filter((task) => {
        const taskCourse = matchCourse(task.context, task.taskLabels);
        return taskCourse?.id === course.id;
      });

      const activeTasks = courseTasks.filter((t) => t.status !== 'done');
      const completedCount = courseTasks.filter((t) => t.status === 'done').length;

      const urgentTasks = activeTasks.filter((t) => {
        if (!t.dueDate) return false;
        const due = parseISO(t.dueDate);
        const days = differenceInDays(due, new Date());
        return days <= 2 || (isPast(due) && !isToday(due));
      });

      const totalMinutes = activeTasks.reduce(
        (sum, t) => sum + (t.timeEstimateMinutes || 15),
        0
      );

      if (courseTasks.length > 0 || activeTasks.length > 0) {
        data.push({
          course,
          activeTasks,
          urgentTasks,
          totalMinutes,
          completedCount,
        });
      }
    }

    // Sort by urgent tasks, then active tasks
    data.sort((a, b) => {
      if (a.urgentTasks.length !== b.urgentTasks.length) {
        return b.urgentTasks.length - a.urgentTasks.length;
      }
      return b.activeTasks.length - a.activeTasks.length;
    });

    return data;
  }, [schoolTasks]);

  // Get all urgent tasks across courses
  const allUrgentTasks = useMemo(() => {
    if (!schoolTasks) return [];
    return schoolTasks
      .filter((task) => {
        if (task.status === 'done') return false;
        if (!task.dueDate) return false;
        const due = parseISO(task.dueDate);
        const days = differenceInDays(due, new Date());
        return days <= 1 || (isPast(due) && !isToday(due));
      })
      .sort((a, b) => {
        const aDue = a.dueDate ? parseISO(a.dueDate).getTime() : Infinity;
        const bDue = b.dueDate ? parseISO(b.dueDate).getTime() : Infinity;
        return aDue - bDue;
      })
      .slice(0, 5);
  }, [schoolTasks]);

  // Overall stats
  const stats = useMemo(() => {
    if (!schoolTasks) return { active: 0, completed: 0, totalHours: 0 };
    const active = schoolTasks.filter((t) => t.status !== 'done').length;
    const completed = schoolTasks.filter((t) => t.status === 'done').length;
    const totalMinutes = schoolTasks
      .filter((t) => t.status !== 'done')
      .reduce((sum, t) => sum + (t.timeEstimateMinutes || 15), 0);
    return {
      active,
      completed,
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    };
  }, [schoolTasks]);

  const flashcardCount = dueFlashcards?.length || 0;

  if (tasksLoading || booksLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded-lg" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Good {getGreeting()}, JD 👋</h1>
          <p className="text-gray-600 mt-1">
            {format(new Date(), "EEEE, MMMM d")} — {stats.active} tasks across {courseData.length} courses
          </p>
        </div>
        <Link
          to="/timer"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <PlayIcon className="w-5 h-5" />
          Start Studying
        </Link>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<ClockIcon className="w-5 h-5" />}
          label="Est. Study Time"
          value={`${stats.totalHours}h`}
          color="blue"
        />
        <StatCard
          icon={<ExclamationTriangleIcon className="w-5 h-5" />}
          label="Due Today/Tomorrow"
          value={allUrgentTasks.length}
          color={allUrgentTasks.length > 0 ? 'red' : 'gray'}
        />
        <StatCard
          icon={<CheckCircleIcon className="w-5 h-5" />}
          label="Completed"
          value={stats.completed}
          color="green"
        />
        <StatCard
          icon={<AcademicCapIcon className="w-5 h-5" />}
          label="Flashcards Due"
          value={flashcardCount}
          color="purple"
          linkTo="/flashcards"
        />
      </div>

      {/* Urgent Tasks Alert */}
      {allUrgentTasks.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
            <h2 className="font-semibold text-red-800">Needs Attention</h2>
          </div>
          <div className="space-y-2">
            {allUrgentTasks.map((task) => {
              const taskCourse = matchCourse(task.context, task.taskLabels);
              return (
                <div
                  key={task.id}
                  className="flex items-center gap-3 bg-white rounded-lg p-3 border border-red-100"
                >
                  <button
                    onClick={() => completeTask.mutate(task.id)}
                    className="w-5 h-5 rounded-full border-2 border-gray-300 hover:border-green-500 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {taskCourse && (
                        <span className={clsx('text-xs px-2 py-0.5 rounded', taskCourse.bgColor, taskCourse.color)}>
                          {taskCourse.shortName}
                        </span>
                      )}
                      <span className="text-xs text-red-600 font-medium">
                        {formatDueDate(task.dueDate)}
                      </span>
                    </div>
                  </div>
                  {taskCourse && (
                    <Link
                      to={`/course/${taskCourse.id}`}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <ArrowRightIcon className="w-5 h-5" />
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Course Cards */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Courses</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {COURSES.map((course) => {
            const data = courseData.find((d) => d.course.id === course.id);
            return (
              <CourseCard
                key={course.id}
                course={course}
                activeTasks={data?.activeTasks.length || 0}
                urgentTasks={data?.urgentTasks.length || 0}
                totalMinutes={data?.totalMinutes || 0}
                completedCount={data?.completedCount || 0}
              />
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/flashcards"
          className="flex items-center gap-4 p-4 bg-purple-50 border border-purple-200 rounded-xl hover:bg-purple-100 transition-colors"
        >
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
            <AcademicCapIcon className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <p className="font-semibold text-purple-900">Review Flashcards</p>
            <p className="text-sm text-purple-700">{flashcardCount} cards due</p>
          </div>
        </Link>

        <Link
          to="/timer"
          className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors"
        >
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <ClockIcon className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-blue-900">Focus Session</p>
            <p className="text-sm text-blue-700">Start a pomodoro timer</p>
          </div>
        </Link>

        <div className="flex items-center gap-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
            <ChartBarIcon className="w-6 h-6 text-gray-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Weekly Progress</p>
            <p className="text-sm text-gray-600">
              {stats.completed} tasks done
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper components
function StatCard({
  icon,
  label,
  value,
  color,
  linkTo,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: 'red' | 'blue' | 'green' | 'purple' | 'gray';
  linkTo?: string;
}) {
  const colorClasses = {
    red: 'bg-red-50 border-red-100 text-red-600',
    blue: 'bg-blue-50 border-blue-100 text-blue-600',
    green: 'bg-green-50 border-green-100 text-green-600',
    purple: 'bg-purple-50 border-purple-100 text-purple-600',
    gray: 'bg-gray-50 border-gray-100 text-gray-600',
  };

  const content = (
    <div className={clsx('rounded-xl border p-4', colorClasses[color], linkTo && 'hover:shadow-md transition-shadow')}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium opacity-80">{label}</span>
      </div>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );

  if (linkTo) {
    return <Link to={linkTo}>{content}</Link>;
  }
  return content;
}

function CourseCard({
  course,
  activeTasks,
  urgentTasks,
  totalMinutes,
  completedCount,
}: {
  course: Course;
  activeTasks: number;
  urgentTasks: number;
  totalMinutes: number;
  completedCount: number;
}) {
  const totalTasks = activeTasks + completedCount;
  const progressPercent = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

  return (
    <Link
      to={`/course/${course.id}`}
      className={clsx(
        'block rounded-xl border p-4 hover:shadow-md transition-all',
        course.bgColor,
        course.borderColor
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{course.icon}</span>
          <div>
            <h3 className={clsx('font-semibold', course.color)}>{course.shortName}</h3>
            <p className="text-xs text-gray-600">{course.code}</p>
          </div>
        </div>
        {urgentTasks > 0 && (
          <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 font-medium">
            {urgentTasks} urgent
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className={clsx('text-xl font-bold', course.color)}>{activeTasks}</p>
          <p className="text-xs text-gray-500">Active</p>
        </div>
        <div>
          <p className={clsx('text-xl font-bold', course.color)}>{completedCount}</p>
          <p className="text-xs text-gray-500">Done</p>
        </div>
        <div>
          <p className={clsx('text-xl font-bold', course.color)}>
            {Math.round(totalMinutes / 60 * 10) / 10}h
          </p>
          <p className="text-xs text-gray-500">Est.</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="h-1.5 bg-white/50 rounded-full overflow-hidden">
          <div
            className={clsx('h-full rounded-full transition-all', course.color.replace('text-', 'bg-'))}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </Link>
  );
}

function formatDueDate(dueDate: string | undefined): string {
  if (!dueDate) return '';
  const date = parseISO(dueDate);
  if (isPast(date) && !isToday(date)) return 'Overdue!';
  if (isToday(date)) return 'Due today';
  return `Due ${format(date, 'MMM d')}`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

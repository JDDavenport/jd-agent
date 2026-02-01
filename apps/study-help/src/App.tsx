import { Routes, Route, NavLink, useLocation, useParams } from 'react-router-dom';
import { useState, useMemo } from 'react';
import {
  HomeIcon,
  BookOpenIcon,
  ClockIcon,
  CalendarDaysIcon,
  AcademicCapIcon,
  Bars3Icon,
  XMarkIcon,
  ChevronRightIcon,
  FolderIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useSchoolTasks } from './hooks/useStudy';
import { COURSES, getCourseById, matchCourse } from './types/courses';
import type { Course } from './types/courses';
import { useAuth } from './contexts/AuthContext';
import { ProtectedRoute, GuestRoute } from './components/ProtectedRoute';

// Views
import { DashboardView } from './views/DashboardView';
import { ThisWeekView } from './views/ThisWeekView';
import { CourseView } from './views/CourseView';
import { ReadingDetailView } from './views/ReadingDetailView';
import { VideoDetailView } from './views/VideoDetailView';
import { LectureDetailView } from './views/LectureDetailView';
import { PomodoroView } from './views/PomodoroView';
import { FlashcardsView } from './views/FlashcardsView';
import { CanvasView } from './views/CanvasView';
import { LoginView } from './views/LoginView';
import { SignupView } from './views/SignupView';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { data: tasks } = useSchoolTasks();
  const { isAuthenticated, isLoading } = useAuth();

  // Show auth routes when not authenticated
  if (!isAuthenticated && !isLoading) {
    return (
      <Routes>
        <Route
          path="/login"
          element={
            <GuestRoute>
              <LoginView />
            </GuestRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <GuestRoute>
              <SignupView />
            </GuestRoute>
          }
        />
        <Route path="*" element={<LoginView />} />
      </Routes>
    );
  }

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg
            className="animate-spin h-10 w-10 text-blue-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  // Count tasks per course
  const taskCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!tasks) return counts;

    for (const task of tasks) {
      if (task.status === 'done') continue;
      const course = matchCourse(task.context, task.taskLabels);
      if (course) {
        counts[course.id] = (counts[course.id] || 0) + 1;
      }
    }
    return counts;
  }, [tasks]);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Study Dashboard';
    if (path.startsWith('/course/')) {
      const courseId = path.split('/')[2];
      const course = getCourseById(courseId);
      return course?.shortName || 'Course';
    }
    if (path.startsWith('/readings/')) return 'Reading';
    if (path === '/timer') return 'Study Timer';
    if (path === '/flashcards') return 'Flashcards';
    return 'Study Help';
  };

  return (
    <div className="h-full bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-72 transform bg-white shadow-lg transition-transform duration-300 lg:hidden overflow-y-auto',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <AcademicCapIcon className="h-8 w-8 text-blue-600" />
            <span className="text-xl font-bold text-gray-900">Study Help</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        <SidebarContent taskCounts={taskCounts} onNavigate={() => setSidebarOpen(false)} />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex min-h-0 flex-1 flex-col bg-white border-r border-gray-200">
          <div className="flex h-16 items-center px-4 border-b border-gray-200">
            <AcademicCapIcon className="h-8 w-8 text-blue-600" />
            <span className="ml-2 text-xl font-bold text-gray-900">Study Help</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <SidebarContent taskCounts={taskCounts} />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col lg:pl-72">
        {/* Mobile header */}
        <div className="sticky top-0 z-10 flex h-16 items-center gap-4 bg-white border-b border-gray-200 px-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-500 hover:text-gray-700"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
          <span className="text-lg font-semibold text-gray-900">{getPageTitle()}</span>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<DashboardView />} />
            <Route path="/course/:courseId" element={<CourseView />} />
            <Route path="/course/:courseId/readings/:bookId" element={<ReadingDetailView />} />
            <Route path="/course/:courseId/readings/:bookId/chapters/:chapterId" element={<ReadingDetailView />} />
            <Route path="/course/:courseId/videos/:videoId" element={<VideoDetailView />} />
            <Route path="/course/:courseId/lectures/:lectureId" element={<LectureDetailView />} />
            <Route path="/readings/:bookId" element={<ReadingDetailView />} />
            <Route path="/readings/:bookId/chapters/:chapterId" element={<ReadingDetailView />} />
            <Route path="/videos/:videoId" element={<VideoDetailView />} />
            <Route path="/this-week" element={<ThisWeekView />} />
            <Route path="/canvas" element={<CanvasView />} />
            <Route path="/canvas/:courseSlug" element={<CanvasView />} />
            <Route path="/canvas/:courseSlug/:section" element={<CanvasView />} />
            <Route path="/timer" element={<PomodoroView />} />
            <Route path="/flashcards" element={<FlashcardsView />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

interface SidebarContentProps {
  taskCounts: Record<string, number>;
  onNavigate?: () => void;
}

function SidebarContent({ taskCounts, onNavigate }: SidebarContentProps) {
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    onNavigate?.();
  };

  return (
    <div className="py-4 flex flex-col h-full">
      {/* Overview */}
      <div className="px-3 mb-4">
        <NavLink
          to="/"
          onClick={onNavigate}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-100'
            )
          }
        >
          <HomeIcon className="h-5 w-5" />
          Overview
        </NavLink>
        <NavLink
          to="/this-week"
          onClick={onNavigate}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-orange-50 text-orange-700'
                : 'text-gray-700 hover:bg-gray-100'
            )
          }
        >
          <CalendarDaysIcon className="h-5 w-5" />
          This Week
        </NavLink>
        <NavLink
          to="/canvas"
          onClick={onNavigate}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-purple-50 text-purple-700'
                : 'text-gray-700 hover:bg-gray-100'
            )
          }
        >
          <FolderIcon className="h-5 w-5" />
          Canvas Content
        </NavLink>
      </div>

      {/* Courses */}
      <div className="px-3 mb-2">
        <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Courses
        </h3>
      </div>
      <div className="px-3 space-y-1">
        {COURSES.map((course) => (
          <CourseNavItem
            key={course.id}
            course={course}
            taskCount={taskCounts[course.id] || 0}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      {/* Tools */}
      <div className="px-3 mt-6 mb-2">
        <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Tools
        </h3>
      </div>
      <div className="px-3 space-y-1">
        <NavLink
          to="/timer"
          onClick={onNavigate}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-100'
            )
          }
        >
          <ClockIcon className="h-5 w-5" />
          Study Timer
        </NavLink>
        <NavLink
          to="/flashcards"
          onClick={onNavigate}
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
              isActive
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-700 hover:bg-gray-100'
            )
          }
        >
          <AcademicCapIcon className="h-5 w-5" />
          All Flashcards
        </NavLink>
      </div>

      {/* Semester info */}
      <div className="px-6 mt-8">
        <div className="rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 p-4 text-white">
          <p className="text-xs font-medium opacity-80">Winter 2026</p>
          <p className="text-lg font-bold">BYU MBA</p>
          <p className="text-xs mt-1 opacity-80">7 courses active</p>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User info & logout */}
      {user && (
        <div className="px-4 py-4 border-t border-gray-200 mt-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-sm font-medium text-blue-700">
                {user.name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user.name || 'Student'}
              </p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title="Sign out"
            >
              <ArrowRightOnRectangleIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface CourseNavItemProps {
  course: Course;
  taskCount: number;
  onNavigate?: () => void;
}

function CourseNavItem({ course, taskCount, onNavigate }: CourseNavItemProps) {
  const location = useLocation();
  const isActive = location.pathname.startsWith(`/course/${course.id}`);

  return (
    <NavLink
      to={`/course/${course.id}`}
      onClick={onNavigate}
      className={clsx(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
        isActive
          ? clsx(course.bgColor, course.color)
          : 'text-gray-700 hover:bg-gray-100'
      )}
    >
      <span className="text-lg">{course.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="truncate">{course.shortName}</p>
        <p className={clsx('text-xs', isActive ? 'opacity-70' : 'text-gray-500')}>
          {course.code}
        </p>
      </div>
      {taskCount > 0 && (
        <span
          className={clsx(
            'text-xs px-2 py-0.5 rounded-full',
            isActive ? 'bg-white/30' : 'bg-gray-200 text-gray-600'
          )}
        >
          {taskCount}
        </span>
      )}
    </NavLink>
  );
}

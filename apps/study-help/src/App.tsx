import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import {
  SignedIn,
  SignedOut,
  SignIn,
  SignUp,
  UserButton,
} from '@clerk/clerk-react';
import {
  HomeIcon,
  BookOpenIcon,
  ClockIcon,
  AcademicCapIcon,
  Bars3Icon,
  XMarkIcon,
  ChevronRightIcon,
  CalendarDaysIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useSchoolTasks } from './hooks/useStudy';
import { COURSES, getCourseById, matchCourse } from './types/courses';
import type { Course } from './types/courses';

// Views
import { LandingPage } from './views/LandingPage';
import { DashboardView } from './views/DashboardView';
import { ThisWeekView } from './views/ThisWeekView';
import { CourseView } from './views/CourseView';
import { ReadingDetailView } from './views/ReadingDetailView';
import { VideoDetailView } from './views/VideoDetailView';
import { PomodoroView } from './views/PomodoroView';
import { FlashcardsView } from './views/FlashcardsView';
import { ErrorBoundary } from './ErrorBoundary';
import { ClerkTokenProvider } from './components/ClerkTokenProvider';
import { CanvasConnectView } from './views/CanvasConnectView';

export default function App() {
  return (
    <>
      <SignedOut>
        <Routes>
          <Route path="/sign-in/*" element={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
            </div>
          } />
          <Route path="/sign-up/*" element={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
            </div>
          } />
          <Route path="*" element={<LandingPage />} />
        </Routes>
      </SignedOut>
      <SignedIn>
        <ClerkTokenProvider>
          <AuthenticatedApp />
        </ClerkTokenProvider>
      </SignedIn>
    </>
  );
}

function AuthenticatedApp() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { data: tasks } = useSchoolTasks();

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
          <div className="flex h-16 items-center justify-between px-4 border-b border-gray-200">
            <div className="flex items-center">
              <AcademicCapIcon className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">Study Help</span>
            </div>
            <UserButton afterSignOutUrl="/" />
          </div>
          <div className="flex-1 overflow-y-auto">
            <SidebarContent taskCounts={taskCounts} />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col lg:pl-72">
        {/* Mobile header */}
        <div className="sticky top-0 z-10 flex h-16 items-center justify-between bg-white border-b border-gray-200 px-4 lg:hidden">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-gray-500 hover:text-gray-700"
            >
              <Bars3Icon className="h-6 w-6" />
            </button>
            <span className="text-lg font-semibold text-gray-900">{getPageTitle()}</span>
          </div>
          <UserButton afterSignOutUrl="/" />
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<ErrorBoundary><DashboardView /></ErrorBoundary>} />
              <Route path="/course/:courseId" element={<ErrorBoundary><CourseView /></ErrorBoundary>} />
              <Route path="/course/:courseId/readings/:bookId" element={<ErrorBoundary><ReadingDetailView /></ErrorBoundary>} />
              <Route path="/course/:courseId/readings/:bookId/chapters/:chapterId" element={<ErrorBoundary><ReadingDetailView /></ErrorBoundary>} />
              <Route path="/course/:courseId/videos/:videoId" element={<ErrorBoundary><VideoDetailView /></ErrorBoundary>} />
              <Route path="/readings/:bookId" element={<ErrorBoundary><ReadingDetailView /></ErrorBoundary>} />
              <Route path="/readings/:bookId/chapters/:chapterId" element={<ErrorBoundary><ReadingDetailView /></ErrorBoundary>} />
              <Route path="/videos/:videoId" element={<ErrorBoundary><VideoDetailView /></ErrorBoundary>} />
              <Route path="/this-week" element={<ErrorBoundary><ThisWeekView /></ErrorBoundary>} />
              <Route path="/timer" element={<ErrorBoundary><PomodoroView /></ErrorBoundary>} />
              <Route path="/flashcards" element={<ErrorBoundary><FlashcardsView /></ErrorBoundary>} />
              <Route path="/canvas/connect" element={<ErrorBoundary><CanvasConnectView /></ErrorBoundary>} />
              {/* Redirect sign-in/sign-up to home when already authenticated */}
              <Route path="/sign-in/*" element={<Navigate to="/" replace />} />
              <Route path="/sign-up/*" element={<Navigate to="/" replace />} />
            </Routes>
          </ErrorBoundary>
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

  return (
    <div className="py-4">
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

      {/* Canvas connect */}
      <div className="px-3 mt-6 mb-2">
        <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Settings
        </h3>
      </div>
      <div className="px-3 space-y-1">
        <NavLink
          to="/canvas/connect"
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
          <LinkIcon className="h-5 w-5" />
          Connect Canvas
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

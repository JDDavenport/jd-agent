import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { useState, useMemo } from 'react';
import {
  HomeIcon,
  BookOpenIcon,
  ClockIcon,
  CalendarDaysIcon,
  AcademicCapIcon,
  Bars3Icon,
  XMarkIcon,
  FolderIcon,
  ArrowRightOnRectangleIcon,
  PlusIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useSchoolTasks } from './hooks/useStudy';
import { useUserCourses, useHasCourses } from './hooks/useUserCourses';
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
import { CourseSetupView } from './views/CourseSetupView';
import { DownloadView } from './views/DownloadView';

// Color mapping for dynamic courses
const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
  rose: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
  cyan: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700' },
  amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  gray: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700' },
};

// Map canvasCourseId to internal course ID for routing
const canvasIdToInternalId: Record<string, string> = {
  '32991': 'mba560',
  '33202': 'mba580',
  '33259': 'entrepreneurial-innovation',
  '34638': 'mba664',
  '34458': 'mba677',
  '34642': 'mba654',
  '34634': 'mba693r',
};

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { data: tasks } = useSchoolTasks();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: userCourses, isLoading: coursesLoading } = useUserCourses();
  const { hasCourses, isLoading: hasCoursesLoading } = useHasCourses();

  // Count tasks per course - MUST be before any early returns (React hooks rule)
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

  // Show auth routes when not authenticated
  if (!isAuthenticated && !authLoading) {
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
        <Route path="/download" element={<DownloadView />} />
        <Route path="*" element={<LoginView />} />
      </Routes>
    );
  }

  // Show loading state while checking auth
  if (authLoading || (isAuthenticated && hasCoursesLoading)) {
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

  // Redirect to course setup if no courses
  if (isAuthenticated && !hasCourses && location.pathname !== '/setup-courses') {
    return (
      <Routes>
        <Route path="/setup-courses" element={<CourseSetupView />} />
        <Route path="*" element={<Navigate to="/setup-courses" replace />} />
      </Routes>
    );
  }

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
            <span className="text-xl font-bold text-gray-900">Study Aide</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        <SidebarContent 
          taskCounts={taskCounts} 
          userCourses={userCourses || []} 
          onNavigate={() => setSidebarOpen(false)} 
        />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex min-h-0 flex-1 flex-col bg-white border-r border-gray-200">
          <div className="flex h-16 items-center px-4 border-b border-gray-200">
            <AcademicCapIcon className="h-8 w-8 text-blue-600" />
            <span className="ml-2 text-xl font-bold text-gray-900">Study Aide</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <SidebarContent 
              taskCounts={taskCounts} 
              userCourses={userCourses || []} 
            />
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
            <Route path="/setup-courses" element={<CourseSetupView />} />
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
            <Route path="/download" element={<DownloadView />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

interface UserCourse {
  id: string;
  canvasCourseId: string;
  courseName: string;
  courseCode: string | null;
  term: string | null;
  isPinned: boolean;
  icon: string;
  color: string;
}

interface SidebarContentProps {
  taskCounts: Record<string, number>;
  userCourses: UserCourse[];
  onNavigate?: () => void;
}

function SidebarContent({ taskCounts, userCourses, onNavigate }: SidebarContentProps) {
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

      {/* User's Courses */}
      <div className="px-3 mb-2 flex items-center justify-between">
        <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          My Courses
        </h3>
        <NavLink
          to="/setup-courses"
          onClick={onNavigate}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="Manage courses"
        >
          <Cog6ToothIcon className="h-4 w-4" />
        </NavLink>
      </div>
      <div className="px-3 space-y-1">
        {userCourses.length > 0 ? (
          userCourses.map((course) => {
            const internalId = canvasIdToInternalId[course.canvasCourseId] || course.canvasCourseId;
            return (
              <UserCourseNavItem
                key={course.id}
                course={course}
                internalId={internalId}
                taskCount={taskCounts[internalId] || 0}
                onNavigate={onNavigate}
              />
            );
          })
        ) : (
          <NavLink
            to="/setup-courses"
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-100 border-2 border-dashed border-gray-200"
          >
            <PlusIcon className="h-5 w-5" />
            Add courses
          </NavLink>
        )}
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
          <p className="text-xs mt-1 opacity-80">{userCourses.length} courses active</p>
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

interface UserCourseNavItemProps {
  course: UserCourse;
  internalId: string;
  taskCount: number;
  onNavigate?: () => void;
}

function UserCourseNavItem({ course, internalId, taskCount, onNavigate }: UserCourseNavItemProps) {
  const location = useLocation();
  const isActive = location.pathname.startsWith(`/course/${internalId}`);
  const colors = colorClasses[course.color] || colorClasses.gray;

  // Generate short name from course name
  const shortName = course.courseName
    .split(/[\/\-]/)
    .map(s => s.trim().split(' ')[0])
    .join('/');

  return (
    <NavLink
      to={`/course/${internalId}`}
      onClick={onNavigate}
      className={clsx(
        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
        isActive
          ? clsx(colors.bg, colors.text)
          : 'text-gray-700 hover:bg-gray-100'
      )}
    >
      <span className="text-lg">{course.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="truncate">{shortName}</p>
        <p className={clsx('text-xs', isActive ? 'opacity-70' : 'text-gray-500')}>
          {course.courseCode}
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

/**
 * Dashboard - Command Center v2.0
 *
 * Main dashboard page with enhanced metric cards, widgets, and sections.
 * Features:
 * - Lazy loaded heavy components for performance
 * - Cascading data loading to prevent server overload
 * - Keyboard shortcuts for navigation
 * - Accessible with ARIA labels and focus management
 * - Responsive layout for mobile/tablet/desktop
 */

import { lazy, Suspense, useState, useEffect } from 'react';
import StatsCards from '../components/dashboard/StatsCards';
import TodayTasks from '../components/dashboard/TodayTasks';
import WeekCalendar from '../components/dashboard/WeekCalendar';
import DeadlineWidget from '../components/dashboard/DeadlineWidget';
import GoalsPanel from '../components/dashboard/GoalsPanel';
import LoadingSpinner from '../components/common/LoadingSpinner';
import KeyboardShortcutsModal from '../components/common/KeyboardShortcutsModal';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

// Lazy load heavy components for better initial load performance
const CanvasHub = lazy(() => import('../components/dashboard/CanvasHub'));
const FitnessWidget = lazy(() => import('../components/dashboard/FitnessWidget'));
const SystemMonitor = lazy(() => import('../components/dashboard/SystemMonitor'));
const FinanceWidget = lazy(() => import('../components/dashboard/FinanceWidget'));
const AIInsights = lazy(() => import('../components/dashboard/AIInsights'));
const QuickChat = lazy(() => import('../components/dashboard/QuickChat'));
const AcquisitionWidget = lazy(() => import('../components/dashboard/AcquisitionWidget'));
const HomeworkHubWidget = lazy(() => import('../components/dashboard/HomeworkHubWidget'));
const GradesWidget = lazy(() => import('../components/dashboard/GradesWidget'));

// Loading fallback for lazy components
function SectionLoader() {
  return (
    <div className="card min-h-[200px] flex items-center justify-center">
      <LoadingSpinner size="sm" />
    </div>
  );
}

function Dashboard() {
  const [showShortcuts, setShowShortcuts] = useState(false);
  // Cascading loading phases to prevent server overload
  // More aggressive staggering: 5 phases with 1.5s delays
  const [loadPhase, setLoadPhase] = useState(1);

  useEffect(() => {
    const timers = [
      setTimeout(() => setLoadPhase(2), 1500),  // Tasks
      setTimeout(() => setLoadPhase(3), 3000),  // Calendar
      setTimeout(() => setLoadPhase(4), 4500),  // Integrations row
      setTimeout(() => setLoadPhase(5), 6000),  // Goals & Chat
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // Enable keyboard shortcuts
  useKeyboardShortcuts({
    enabled: !showShortcuts, // Disable when modal is open
    onHelp: () => setShowShortcuts(true),
  });

  return (
    <div
      className="space-y-6 animate-fade-in"
      role="main"
      aria-label="Command Center Dashboard"
    >
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-accent to-accent-light bg-clip-text text-transparent">
            Command Center
          </h1>
          <p className="text-text-muted mt-1">
            Welcome back! Here's what's happening today.
          </p>
        </div>
        <button
          onClick={() => setShowShortcuts(true)}
          className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-dark-card transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Show keyboard shortcuts"
          title="Keyboard shortcuts (?)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M6 8h.001" />
            <path d="M10 8h.001" />
            <path d="M14 8h.001" />
            <path d="M18 8h.001" />
            <path d="M6 12h.001" />
            <path d="M10 12h.001" />
            <path d="M14 12h.001" />
            <path d="M18 12h.001" />
            <path d="M6 16h12" />
          </svg>
        </button>
      </header>

      {/* Row 1: Stats Cards (6 metric cards) */}
      <section aria-label="Key metrics">
        <StatsCards />
      </section>

      {/* Row 2: Tasks, Homework Hub, and Deadlines - Load in Phase 2 */}
      {loadPhase >= 2 ? (
        <section
          className="grid grid-cols-1 lg:grid-cols-4 gap-6"
          aria-label="Tasks, homework, and deadlines"
        >
          <div className="lg:col-span-2">
            <TodayTasks />
          </div>
          <div>
            <Suspense fallback={<SectionLoader />}>
              <HomeworkHubWidget compact />
            </Suspense>
          </div>
          <div>
            <DeadlineWidget />
          </div>
        </section>
      ) : (
        <section className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-2"><SectionLoader /></div>
          <div><SectionLoader /></div>
          <div><SectionLoader /></div>
        </section>
      )}

      {/* Row 3: Calendar and AI Insights - Load in Phase 3 */}
      {loadPhase >= 3 ? (
        <section
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          aria-label="Calendar and insights"
        >
          <div className="lg:col-span-2">
            <WeekCalendar />
          </div>
          <div>
            <Suspense fallback={<SectionLoader />}>
              <AIInsights />
            </Suspense>
          </div>
        </section>
      ) : (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2"><SectionLoader /></div>
          <div><SectionLoader /></div>
        </section>
      )}

      {/* Row 4: Grades, Fitness, Finance, System Monitor - Load in Phase 4 */}
      {loadPhase >= 4 ? (
        <section
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          aria-label="Integrations overview"
        >
          <Suspense fallback={<SectionLoader />}>
            <GradesWidget compact />
          </Suspense>
          <Suspense fallback={<SectionLoader />}>
            <FitnessWidget />
          </Suspense>
          <Suspense fallback={<SectionLoader />}>
            <FinanceWidget />
          </Suspense>
          <Suspense fallback={<SectionLoader />}>
            <SystemMonitor />
          </Suspense>
        </section>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <SectionLoader />
          <SectionLoader />
          <SectionLoader />
          <SectionLoader />
        </section>
      )}

      {/* Row 5: Goals, Acquisition, and Quick Chat - Load in Phase 5 */}
      {loadPhase >= 5 ? (
        <section
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          aria-label="Goals, acquisition, and chat"
        >
          <GoalsPanel />
          <Suspense fallback={<SectionLoader />}>
            <AcquisitionWidget />
          </Suspense>
          <Suspense fallback={<SectionLoader />}>
            <QuickChat />
          </Suspense>
        </section>
      ) : (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SectionLoader />
          <SectionLoader />
          <SectionLoader />
        </section>
      )}

      {/* Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={showShortcuts}
        onClose={() => setShowShortcuts(false)}
      />
    </div>
  );
}

export default Dashboard;

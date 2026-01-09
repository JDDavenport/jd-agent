import StatsCards from '../components/dashboard/StatsCards';
import TodayTasks from '../components/dashboard/TodayTasks';
import WeekCalendar from '../components/dashboard/WeekCalendar';
import DeadlineWidget from '../components/dashboard/DeadlineWidget';
import QuickChat from '../components/dashboard/QuickChat';
import GoalsPanel from '../components/dashboard/GoalsPanel';
// Phase 3 Components
import CanvasHub from '../components/dashboard/CanvasHub';
import FitnessWidget from '../components/dashboard/FitnessWidget';
import SystemMonitor from '../components/dashboard/SystemMonitor';
import AIInsights from '../components/dashboard/AIInsights';

function Dashboard() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-accent to-accent-light bg-clip-text text-transparent">
          Command Center
        </h1>
        <p className="text-text-muted mt-1">
          Welcome back! Here's what's happening today.
        </p>
      </div>

      {/* Row 1: Stats Cards (6 metric cards) */}
      <StatsCards />

      {/* Row 2: Tasks and Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TodayTasks />
        </div>
        <div>
          <DeadlineWidget />
        </div>
      </div>

      {/* Row 3: Calendar and AI Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <WeekCalendar />
        </div>
        <div>
          <AIInsights />
        </div>
      </div>

      {/* Row 4: Canvas, Fitness, System Monitor */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <CanvasHub />
        <FitnessWidget />
        <SystemMonitor />
      </div>

      {/* Row 5: Goals and Quick Chat */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GoalsPanel />
        <QuickChat />
      </div>
    </div>
  );
}

export default Dashboard;

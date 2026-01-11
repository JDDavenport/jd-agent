import { useState, useEffect, useCallback } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  parseISO,
  isToday,
} from 'date-fns';
import { useCalendarEvents } from '../hooks/useCalendar';
import { useTodayTasks, useCompleteTask } from '../hooks/useTasks';
import MonthView from '../components/calendar/MonthView';
import WeekView from '../components/calendar/WeekView';
import DayView from '../components/calendar/DayView';
import EventModal from '../components/calendar/EventModal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import type { CalendarEvent } from '../types/calendar';
import type { Task } from '../types/task';

type ViewMode = 'month' | 'week' | 'day';

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'border-red-500',
  high: 'border-orange-500',
  medium: 'border-yellow-500',
  low: 'border-blue-500',
};

function TaskItem({ task, onComplete }: { task: Task; onComplete: (id: string) => void }) {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isToday(parseISO(task.dueDate));

  return (
    <div
      className={`p-3 bg-dark-bg rounded-lg border-l-4 ${PRIORITY_COLORS[task.priority] || 'border-accent'} hover:bg-dark-card-hover transition-colors`}
    >
      <div className="flex items-start gap-3">
        <button
          onClick={() => onComplete(task.id)}
          className="mt-0.5 w-5 h-5 rounded-full border-2 border-text-muted hover:border-accent hover:bg-accent/20 transition-colors flex-shrink-0"
          title="Complete task"
        />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{task.title}</div>
          <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
            {task.dueDate && (
              <span className={isOverdue ? 'text-red-400' : ''}>
                {format(parseISO(task.dueDate), 'h:mm a')}
              </span>
            )}
            {task.timeEstimateMinutes && (
              <span>{task.timeEstimateMinutes}m</span>
            )}
            {task.context && (
              <span className="px-1.5 py-0.5 bg-dark-card rounded text-xs">
                @{task.context}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TasksSidebar() {
  const { data: tasks = [], isLoading, error } = useTodayTasks();
  const completeMutation = useCompleteTask();

  const handleComplete = (id: string) => {
    completeMutation.mutate(id);
  };

  // Separate scheduled vs unscheduled tasks
  const scheduledTasks = tasks.filter((t: Task) => t.dueDate);
  const unscheduledTasks = tasks.filter((t: Task) => !t.dueDate);

  // Sort scheduled by time
  const sortedScheduled = [...scheduledTasks].sort((a: Task, b: Task) => {
    if (!a.dueDate || !b.dueDate) return 0;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  if (isLoading) {
    return (
      <div className="card h-full">
        <h3 className="text-lg font-semibold mb-4">Today's Tasks</h3>
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error) {
    const isNetworkError = error.message?.includes('Network') || error.message?.includes('ECONNREFUSED');
    return (
      <div className="card h-full">
        <h3 className="text-lg font-semibold mb-4">Today's Tasks</h3>
        <div className="text-center py-8">
          <svg className="w-12 h-12 mx-auto text-text-muted mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm text-text-muted">
            {isNetworkError ? (
              <>
                <span className="text-warning">Hub API not reachable</span>
                <br />
                <span className="text-xs">Run: bun run hub</span>
              </>
            ) : (
              error.message
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Today's Tasks</h3>
        <span className="text-sm text-text-muted">{tasks.length} tasks</span>
      </div>

      {tasks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-text-muted py-8">
          <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <p className="text-sm">No tasks for today</p>
          <p className="text-xs mt-1">Enjoy your free time!</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Scheduled Tasks */}
          {sortedScheduled.length > 0 && (
            <div>
              <h4 className="text-xs uppercase text-text-muted tracking-wide mb-2">Scheduled</h4>
              <div className="space-y-2">
                {sortedScheduled.map((task: Task) => (
                  <TaskItem key={task.id} task={task} onComplete={handleComplete} />
                ))}
              </div>
            </div>
          )}

          {/* Unscheduled Tasks */}
          {unscheduledTasks.length > 0 && (
            <div>
              <h4 className="text-xs uppercase text-text-muted tracking-wide mb-2">To Do</h4>
              <div className="space-y-2">
                {unscheduledTasks.map((task: Task) => (
                  <TaskItem key={task.id} task={task} onComplete={handleComplete} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Calendar() {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);

  // Calculate date range based on view
  const getDateRange = () => {
    switch (viewMode) {
      case 'month': {
        const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
        const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
        return { start, end };
      }
      case 'week': {
        const start = startOfWeek(currentDate, { weekStartsOn: 0 });
        const end = endOfWeek(currentDate, { weekStartsOn: 0 });
        return { start, end };
      }
      case 'day': {
        return { start: currentDate, end: currentDate };
      }
    }
  };

  const { start, end } = getDateRange();
  const { data: events = [], isLoading, error } = useCalendarEvents(
    format(start, 'yyyy-MM-dd'),
    format(end, 'yyyy-MM-dd')
  );

  // Navigation functions
  const goToToday = () => setCurrentDate(new Date());

  const goToPrevious = () => {
    switch (viewMode) {
      case 'month':
        setCurrentDate(subMonths(currentDate, 1));
        break;
      case 'week':
        setCurrentDate(subWeeks(currentDate, 1));
        break;
      case 'day':
        setCurrentDate(subDays(currentDate, 1));
        break;
    }
  };

  const goToNext = () => {
    switch (viewMode) {
      case 'month':
        setCurrentDate(addMonths(currentDate, 1));
        break;
      case 'week':
        setCurrentDate(addWeeks(currentDate, 1));
        break;
      case 'day':
        setCurrentDate(addDays(currentDate, 1));
        break;
    }
  };

  // Event handlers
  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setSelectedSlot(null);
    setShowEventModal(true);
  };

  const handleSlotClick = (start: Date, end: Date) => {
    setSelectedSlot({ start, end });
    setSelectedEvent(null);
    setShowEventModal(true);
  };

  const handleDateClick = (date: Date) => {
    setCurrentDate(date);
    if (viewMode === 'month') {
      setViewMode('day');
    }
  };

  const handleCloseModal = () => {
    setShowEventModal(false);
    setSelectedEvent(null);
    setSelectedSlot(null);
  };

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger if modal is open or typing in input
      if (showEventModal) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault();
          setShowEventModal(true);
          break;
        case 't':
          e.preventDefault();
          goToToday();
          break;
        case 'm':
          e.preventDefault();
          setViewMode('month');
          break;
        case 'w':
          e.preventDefault();
          setViewMode('week');
          break;
        case 'd':
          e.preventDefault();
          setViewMode('day');
          break;
        case 'arrowleft':
          e.preventDefault();
          goToPrevious();
          break;
        case 'arrowright':
          e.preventDefault();
          goToNext();
          break;
      }
    },
    [showEventModal, viewMode, currentDate]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Get header title based on view
  const getHeaderTitle = () => {
    switch (viewMode) {
      case 'month':
        return format(currentDate, 'MMMM yyyy');
      case 'week': {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
        if (weekStart.getMonth() === weekEnd.getMonth()) {
          return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'd, yyyy')}`;
        }
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
      }
      case 'day':
        return format(currentDate, 'EEEE, MMMM d, yyyy');
    }
  };

  // Check if error is network-related
  const isNetworkError = error?.message?.includes('Network') || error?.message?.includes('ECONNREFUSED');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-accent to-accent-light bg-clip-text text-transparent">
            Calendar
          </h1>
          <p className="text-text-muted mt-1">Manage your schedule and events</p>
        </div>
        <button
          onClick={() => setShowEventModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Event
        </button>
      </div>

      {/* Navigation Bar */}
      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* View Switcher */}
          <div className="flex gap-1 bg-dark-bg rounded-lg p-1">
            {(['month', 'week', 'day'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  viewMode === mode
                    ? 'bg-accent text-white'
                    : 'text-text-muted hover:text-text hover:bg-dark-card-hover'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* Date Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevious}
              className="p-2 rounded-lg hover:bg-dark-card-hover transition-colors"
              aria-label="Previous"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goToToday}
              className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-dark-card-hover transition-colors"
            >
              Today
            </button>
            <button
              onClick={goToNext}
              className="p-2 rounded-lg hover:bg-dark-card-hover transition-colors"
              aria-label="Next"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Current Period Title */}
          <h2 className="text-xl font-semibold min-w-[200px] text-center">{getHeaderTitle()}</h2>

          {/* Keyboard Shortcuts Hint */}
          <div className="text-xs text-text-muted hidden lg:block">
            <span className="px-1.5 py-0.5 bg-dark-bg rounded">N</span> New event
            <span className="ml-2 px-1.5 py-0.5 bg-dark-bg rounded">T</span> Today
            <span className="ml-2 px-1.5 py-0.5 bg-dark-bg rounded">M/W/D</span> Views
          </div>
        </div>
      </div>

      {/* Main Content: Calendar + Tasks Sidebar */}
      <div className="flex gap-6">
        {/* Calendar View */}
        <div className="flex-1 card min-h-[600px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-96 text-center">
              <svg className="w-16 h-16 text-text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {isNetworkError ? (
                <>
                  <p className="text-lg text-warning mb-2">Hub API not reachable</p>
                  <p className="text-sm text-text-muted mb-4">
                    The calendar needs the backend to be running.
                  </p>
                  <div className="bg-dark-bg rounded-lg p-4 text-left">
                    <p className="text-xs text-text-muted mb-2">Start the hub with:</p>
                    <code className="text-sm text-accent">bun run hub</code>
                  </div>
                </>
              ) : (
                <p className="text-error">{error.message || 'Failed to load calendar events'}</p>
              )}
            </div>
          ) : (
            <>
              {viewMode === 'month' && (
                <MonthView
                  currentDate={currentDate}
                  events={events}
                  onEventClick={handleEventClick}
                  onDateClick={handleDateClick}
                />
              )}
              {viewMode === 'week' && (
                <WeekView
                  currentDate={currentDate}
                  events={events}
                  onEventClick={handleEventClick}
                  onSlotClick={handleSlotClick}
                />
              )}
              {viewMode === 'day' && (
                <DayView
                  currentDate={currentDate}
                  events={events}
                  onEventClick={handleEventClick}
                  onSlotClick={handleSlotClick}
                />
              )}
            </>
          )}
        </div>

        {/* Tasks Sidebar */}
        <div className="w-80 flex-shrink-0 hidden xl:block">
          <TasksSidebar />
        </div>
      </div>

      {/* Event Modal */}
      <EventModal
        isOpen={showEventModal}
        onClose={handleCloseModal}
        event={selectedEvent}
        initialSlot={selectedSlot}
      />
    </div>
  );
}

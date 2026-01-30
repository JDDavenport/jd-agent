import { useMemo, useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useSchoolTasks, useCalendarEvents } from '../hooks/useStudy';
import type { Task, CalendarEvent } from '../types';

// Course colors
const COURSE_COLORS: Record<string, string> = {
  'MBA560': 'bg-blue-500',
  'MBA580': 'bg-purple-500',
  'MBA654': 'bg-green-500',
  'MBA664': 'bg-amber-500',
  'MBA677': 'bg-rose-500',
  'MBA693R': 'bg-cyan-500',
  'default': 'bg-gray-500',
};

function getCourseColor(context: string): string {
  const upper = context?.toUpperCase() || '';
  for (const [key, value] of Object.entries(COURSE_COLORS)) {
    if (key !== 'default' && upper.includes(key)) return value;
  }
  return COURSE_COLORS.default;
}

export function CalendarView() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  const { data: tasks } = useSchoolTasks();
  const { data: events } = useCalendarEvents();

  // Get days for the calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart);
    const calendarEnd = endOfWeek(monthEnd);

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Group tasks and events by date
  const itemsByDate = useMemo(() => {
    const map = new Map<string, { tasks: Task[]; events: CalendarEvent[] }>();

    tasks?.forEach((task) => {
      if (task.dueDate && task.status !== 'done') {
        const dateKey = format(parseISO(task.dueDate), 'yyyy-MM-dd');
        if (!map.has(dateKey)) {
          map.set(dateKey, { tasks: [], events: [] });
        }
        map.get(dateKey)!.tasks.push(task);
      }
    });

    events?.forEach((event) => {
      const dateKey = format(parseISO(event.startTime), 'yyyy-MM-dd');
      if (!map.has(dateKey)) {
        map.set(dateKey, { tasks: [], events: [] });
      }
      map.get(dateKey)!.events.push(event);
    });

    return map;
  }, [tasks, events]);

  const selectedDateItems = useMemo(() => {
    if (!selectedDate) return null;
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return itemsByDate.get(dateKey) || { tasks: [], events: [] };
  }, [selectedDate, itemsByDate]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Calendar</h1>
        <p className="text-gray-600 mt-1">View your upcoming deadlines and events</p>
      </div>

      <div className="flex gap-6">
        {/* Calendar */}
        <div className="flex-1 bg-white rounded-xl border border-gray-200 p-4">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentMonth(new Date())}
                className="px-3 py-1 text-sm hover:bg-gray-100 rounded-lg"
              >
                Today
              </button>
              <button
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronRightIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, i) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayItems = itemsByDate.get(dateKey);
              const hasItems = dayItems && (dayItems.tasks.length > 0 || dayItems.events.length > 0);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isSelected = selectedDate && isSameDay(day, selectedDate);

              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(day)}
                  className={clsx(
                    'min-h-[80px] p-2 rounded-lg text-left transition-colors',
                    !isCurrentMonth && 'opacity-40',
                    isSelected
                      ? 'bg-blue-100 ring-2 ring-blue-500'
                      : 'hover:bg-gray-100',
                    isToday(day) && !isSelected && 'bg-blue-50'
                  )}
                >
                  <span
                    className={clsx(
                      'inline-flex w-7 h-7 items-center justify-center rounded-full text-sm',
                      isToday(day) && 'bg-blue-600 text-white font-bold'
                    )}
                  >
                    {format(day, 'd')}
                  </span>

                  {/* Event dots */}
                  {hasItems && (
                    <div className="mt-1 space-y-0.5">
                      {dayItems.tasks.slice(0, 3).map((task, j) => (
                        <div
                          key={`task-${j}`}
                          className={clsx(
                            'h-1.5 rounded-full',
                            getCourseColor(task.context)
                          )}
                        />
                      ))}
                      {dayItems.tasks.length > 3 && (
                        <div className="text-xs text-gray-400">
                          +{dayItems.tasks.length - 3} more
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected day details */}
        <div className="w-80 flex-shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-6">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <h3 className="font-semibold text-gray-900">
                {selectedDate ? format(selectedDate, 'EEEE, MMMM d') : 'Select a date'}
              </h3>
            </div>

            {selectedDate && selectedDateItems ? (
              <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                {/* Events */}
                {selectedDateItems.events.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Events
                    </h4>
                    <div className="space-y-2">
                      {selectedDateItems.events.map((event) => (
                        <EventCard key={event.id} event={event} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Tasks */}
                {selectedDateItems.tasks.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Due Tasks ({selectedDateItems.tasks.length})
                    </h4>
                    <div className="space-y-2">
                      {selectedDateItems.tasks.map((task) => (
                        <TaskCard key={task.id} task={task} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {selectedDateItems.tasks.length === 0 && selectedDateItems.events.length === 0 && (
                  <p className="text-center text-gray-500 py-8">
                    No items for this day
                  </p>
                )}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                Click a date to see details
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EventCard({ event }: { event: CalendarEvent }) {
  return (
    <div className="p-3 rounded-lg bg-purple-50 border border-purple-100">
      <p className="font-medium text-purple-900">{event.title}</p>
      <div className="flex items-center gap-2 mt-1 text-sm text-purple-700">
        <ClockIcon className="w-4 h-4" />
        {format(parseISO(event.startTime), 'h:mm a')} - {format(parseISO(event.endTime), 'h:mm a')}
      </div>
      {event.location && (
        <p className="text-sm text-purple-600 mt-1">📍 {event.location}</p>
      )}
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  return (
    <div className={clsx(
      'p-3 rounded-lg border',
      task.priority >= 3
        ? 'bg-red-50 border-red-100'
        : 'bg-white border-gray-200'
    )}>
      <div className="flex items-start gap-2">
        {task.priority >= 3 && (
          <ExclamationTriangleIcon className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 line-clamp-2">{task.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={clsx(
              'text-xs px-2 py-0.5 rounded-full text-white',
              getCourseColor(task.context)
            )}>
              {task.context?.split('-')[0] || 'Task'}
            </span>
            {task.timeEstimateMinutes && (
              <span className="text-xs text-gray-500">
                ~{task.timeEstimateMinutes}m
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

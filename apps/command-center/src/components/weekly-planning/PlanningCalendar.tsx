/**
 * Planning Calendar
 *
 * Weekly calendar view (Friday through next Sunday = 10 days)
 * Features:
 * - Two columns per day: Events (left) + Tasks (right)
 * - Droppable time slots for scheduling tasks
 * - Week navigation to view following weeks
 * - Synchronized scrolling
 * - Click to complete tasks
 */

import { useMemo, useRef } from 'react';
import { format, addDays, isToday, getHours, getMinutes, parseISO, differenceInMinutes } from 'date-fns';
import { useDroppable } from '@dnd-kit/core';

// Helper to extract UTC date from ISO string (avoids timezone conversion issues)
function getUTCDateKey(isoString: string): string {
  // ISO format: 2026-01-24T00:00:00.000Z - extract just the date part
  return isoString.slice(0, 10);
}
import type { CalendarEvent } from '../../types/calendar';
import type { Task } from '../../types/task';

interface PlanningCalendarProps {
  startDate: Date;
  endDate: Date;
  events: CalendarEvent[];
  scheduledTasks: Task[];
  onWeekChange?: (direction: 'prev' | 'next') => void;
  weekOffset?: number;
  onCompleteTask?: (taskId: string) => void;
}

// Constants
const HOUR_HEIGHT = 48; // pixels per hour
const START_HOUR = 6;   // 6 AM
const END_HOUR = 22;    // 10 PM
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const DAY_WIDTH = 140;  // pixels per day column

// Event type colors
const EVENT_COLORS: Record<string, string> = {
  meeting: 'bg-purple-600',
  class: 'bg-blue-600',
  deadline: 'bg-red-600',
  personal: 'bg-green-600',
  blocked_time: 'bg-yellow-600',
  default: 'bg-indigo-600',
};

// Task priority colors
const TASK_COLORS: Record<number, string> = {
  4: 'bg-red-500',
  3: 'bg-orange-500',
  2: 'bg-yellow-500',
  1: 'bg-blue-500',
  0: 'bg-slate-500',
};

interface DroppableSlotProps {
  date: Date;
  hour: number;
}

function DroppableSlot({ date, hour }: DroppableSlotProps) {
  const slotId = `slot-${format(date, 'yyyy-MM-dd')}-${hour}`;

  const { isOver, setNodeRef } = useDroppable({
    id: slotId,
    data: { type: 'timeSlot', date, hour },
  });

  return (
    <div
      ref={setNodeRef}
      className={`absolute left-0 right-0 border-b border-slate-700/50 transition-all
        ${isOver ? 'bg-blue-500/30 ring-1 ring-blue-400' : 'hover:bg-slate-700/30'}`}
      style={{ top: (hour - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
    />
  );
}

interface EventBlockProps {
  event: CalendarEvent;
}

function EventBlock({ event }: EventBlockProps) {
  const start = parseISO(event.startTime);
  const end = parseISO(event.endTime);
  const startHour = getHours(start);
  const startMinute = getMinutes(start);
  const durationMinutes = differenceInMinutes(end, start);

  const top = (startHour - START_HOUR) * HOUR_HEIGHT + (startMinute / 60) * HOUR_HEIGHT;
  const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT, 24);

  if (startHour < START_HOUR || startHour >= END_HOUR) return null;

  const colorClass = EVENT_COLORS[event.eventType] || EVENT_COLORS.default;

  return (
    <div
      className={`absolute left-0.5 right-0.5 rounded-sm px-1 py-0.5 text-[10px] overflow-hidden
        ${colorClass} text-white shadow-sm`}
      style={{ top, height, minHeight: 24 }}
      title={`${event.title}${event.location ? ` @ ${event.location}` : ''}`}
    >
      <div className="font-medium truncate leading-tight">{event.title}</div>
      {height > 32 && (
        <div className="text-white/80 text-[9px]">{format(start, 'h:mm a')}</div>
      )}
    </div>
  );
}

interface TaskBlockProps {
  task: Task;
  onComplete?: (taskId: string) => void;
}

function TaskBlock({ task, onComplete }: TaskBlockProps) {
  if (!task.scheduledStart) return null;

  const start = parseISO(task.scheduledStart);
  const startHour = getHours(start);
  const startMinute = getMinutes(start);
  const durationMinutes = task.timeEstimateMinutes || 60;

  const top = (startHour - START_HOUR) * HOUR_HEIGHT + (startMinute / 60) * HOUR_HEIGHT;
  const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT, 24);

  if (startHour < START_HOUR || startHour >= END_HOUR) return null;

  const colorClass = TASK_COLORS[task.priority] || TASK_COLORS[0];
  const isCompleted = !!task.completedAt;

  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onComplete && !isCompleted) {
      onComplete(task.id);
    }
  };

  return (
    <div
      className={`absolute left-0.5 right-0.5 rounded-sm px-1 py-0.5 text-[10px] overflow-hidden
        ${colorClass} text-white shadow-sm border-l-2 border-white/30 cursor-pointer
        ${isCompleted ? 'opacity-50' : 'hover:brightness-110'}`}
      style={{ top, height, minHeight: 24 }}
      title={`${task.title}${isCompleted ? ' (completed)' : ' - Click to complete'}`}
      onClick={handleComplete}
    >
      <div className="flex items-start gap-1">
        {/* Checkbox */}
        <div className={`flex-shrink-0 w-3 h-3 mt-0.5 rounded-sm border ${
          isCompleted
            ? 'bg-green-500 border-green-400'
            : 'border-white/50 hover:border-white'
        } flex items-center justify-center`}>
          {isCompleted && (
            <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </div>
        {/* Title */}
        <div className={`font-medium truncate leading-tight flex-1 ${isCompleted ? 'line-through' : ''}`}>
          {task.title}
        </div>
      </div>
      {height > 32 && task.timeEstimateMinutes && (
        <div className="text-white/80 text-[9px] ml-4">{task.timeEstimateMinutes}m</div>
      )}
    </div>
  );
}

function CurrentTimeIndicator() {
  const now = new Date();
  const hour = getHours(now);
  const minute = getMinutes(now);

  if (hour < START_HOUR || hour >= END_HOUR) return null;

  const top = (hour - START_HOUR) * HOUR_HEIGHT + (minute / 60) * HOUR_HEIGHT;

  return (
    <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top }}>
      <div className="flex items-center">
        <div className="w-2 h-2 rounded-full bg-red-500 shadow-lg" />
        <div className="flex-1 h-0.5 bg-red-500 shadow-lg" />
      </div>
    </div>
  );
}

function PlanningCalendar({
  startDate,
  endDate,
  events,
  scheduledTasks,
  onWeekChange,
  weekOffset = 0,
  onCompleteTask,
}: PlanningCalendarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Generate days array
  const days = useMemo(() => {
    const result: Date[] = [];
    let current = new Date(startDate);
    while (current <= endDate) {
      result.push(new Date(current));
      current = addDays(current, 1);
    }
    return result;
  }, [startDate, endDate]);

  // Group events by day (using UTC date to avoid timezone issues)
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      if (event.allDay) return;
      // Use UTC date from the ISO string to match the intended calendar day
      const dateKey = getUTCDateKey(event.startTime);
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(event);
    });
    return map;
  }, [events]);

  // Group tasks by day
  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    scheduledTasks.forEach((task) => {
      if (!task.scheduledStart) return;
      const taskDate = parseISO(task.scheduledStart);
      const dateKey = format(taskDate, 'yyyy-MM-dd');
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(task);
    });
    return map;
  }, [scheduledTasks]);

  // Scroll to current time on mount
  useMemo(() => {
    setTimeout(() => {
      if (scrollRef.current) {
        const currentHour = new Date().getHours();
        if (currentHour >= START_HOUR && currentHour < END_HOUR) {
          const scrollTop = Math.max(0, (currentHour - START_HOUR - 2) * HOUR_HEIGHT);
          scrollRef.current.scrollTop = scrollTop;
        }
      }
    }, 100);
  }, []);

  const calendarWidth = days.length * DAY_WIDTH + 56; // 56px for time column

  return (
    <div className="h-full flex flex-col bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
      {/* Navigation Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <button
          onClick={() => onWeekChange?.('prev')}
          disabled={weekOffset <= 0}
          className="p-1.5 rounded hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-sm font-medium">
          {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
          {weekOffset > 0 && <span className="text-slate-400 ml-2">(+{weekOffset} week{weekOffset > 1 ? 's' : ''})</span>}
        </div>
        <button
          onClick={() => onWeekChange?.('next')}
          className="p-1.5 rounded hover:bg-slate-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Scrollable Calendar Area */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div style={{ width: calendarWidth, minWidth: '100%' }}>
          {/* Day Headers - sticky */}
          <div className="sticky top-0 z-10 flex bg-slate-800 border-b border-slate-600">
            {/* Time column header */}
            <div className="w-14 flex-shrink-0 border-r border-slate-700" />

            {/* Day headers */}
            {days.map((day) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayEvents = eventsByDay.get(dateKey) || [];
              const dayTasks = tasksByDay.get(dateKey) || [];

              return (
                <div
                  key={day.toISOString()}
                  className={`border-r border-slate-700 last:border-r-0 ${isToday(day) ? 'bg-blue-900/30' : ''}`}
                  style={{ width: DAY_WIDTH }}
                >
                  {/* Date */}
                  <div className="text-center py-2 border-b border-slate-700/50">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wide">
                      {format(day, 'EEE')}
                    </div>
                    <div className={`text-lg font-bold ${isToday(day) ? 'text-blue-400' : 'text-white'}`}>
                      {format(day, 'd')}
                    </div>
                  </div>
                  {/* Column labels */}
                  <div className="flex text-[9px] text-slate-500 uppercase tracking-wider">
                    <div className="flex-1 text-center py-1 border-r border-slate-700/50">
                      Events ({dayEvents.length})
                    </div>
                    <div className="flex-1 text-center py-1">
                      Tasks ({dayTasks.length})
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time Grid */}
          <div className="flex">
            {/* Time labels */}
            <div className="w-14 flex-shrink-0 bg-slate-900 border-r border-slate-700">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="text-[10px] text-slate-500 text-right pr-2 relative"
                  style={{ height: HOUR_HEIGHT }}
                >
                  <span className="absolute right-2 -top-2">
                    {format(new Date().setHours(hour, 0), 'ha')}
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map((day) => {
              const dateKey = format(day, 'yyyy-MM-dd');
              const dayEvents = eventsByDay.get(dateKey) || [];
              const dayTasks = tasksByDay.get(dateKey) || [];

              return (
                <div
                  key={day.toISOString()}
                  className={`flex border-r border-slate-700 last:border-r-0 ${isToday(day) ? 'bg-blue-900/10' : ''}`}
                  style={{ width: DAY_WIDTH }}
                >
                  {/* Events column */}
                  <div
                    className="flex-1 relative border-r border-slate-700/30"
                    style={{ height: HOURS.length * HOUR_HEIGHT }}
                  >
                    {/* Hour lines */}
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="absolute left-0 right-0 border-b border-slate-800"
                        style={{ top: (hour - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                      />
                    ))}
                    {/* Events */}
                    {dayEvents.map((event) => (
                      <EventBlock key={event.id} event={event} />
                    ))}
                    {isToday(day) && <CurrentTimeIndicator />}
                  </div>

                  {/* Tasks column - droppable */}
                  <div
                    className="flex-1 relative"
                    style={{ height: HOURS.length * HOUR_HEIGHT }}
                  >
                    {/* Droppable slots */}
                    {HOURS.map((hour) => (
                      <DroppableSlot key={hour} date={day} hour={hour} />
                    ))}
                    {/* Tasks */}
                    {dayTasks.map((task) => (
                      <TaskBlock key={task.id} task={task} onComplete={onCompleteTask} />
                    ))}
                    {isToday(day) && <CurrentTimeIndicator />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 bg-slate-800 border-t border-slate-700 text-[10px] text-slate-400">
        <span>Events:</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-purple-600" /> Meeting</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-600" /> Class</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-600" /> Personal</span>
        <span className="ml-4">Tasks:</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500" /> P4</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-orange-500" /> P3</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-yellow-500" /> P2</span>
      </div>
    </div>
  );
}

export default PlanningCalendar;

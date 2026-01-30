/**
 * Weekly Planning Page
 *
 * A drag-and-drop interface for weekly planning sessions:
 * - Left panel: Weekly backlog (tasks tagged #weekly-backlog)
 * - Right panel: Calendar (Sunday through Saturday) showing events and scheduled tasks
 *
 * Features:
 * - Drag tasks from backlog to calendar to schedule them
 * - Drag within backlog to reorder priority
 * - Drag scheduled tasks to reschedule them
 * - Week navigation to plan future weeks
 * - View Google Calendar events alongside scheduled tasks
 * - Double-click tasks to view details
 * - Overlapping tasks displayed side-by-side
 */

import { useState, useMemo, useCallback } from 'react';
import { addDays, format, getDay, startOfDay } from 'date-fns';
import {
  DndContext,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import WeeklyBacklogPanel from '../components/weekly-planning/WeeklyBacklogPanel';
import PlanningCalendar from '../components/weekly-planning/PlanningCalendar';
import { useWeeklyBacklog, useScheduleTask, useReorderTasks, useScheduledTasks, useUnscheduleTask } from '../hooks/useWeeklyPlanning';
import { useCalendarEvents, useCreateEvent, useUpdateEvent } from '../hooks/useCalendar';
import { useCompleteTask } from '../hooks/useTasks';
import LoadingSpinner from '../components/common/LoadingSpinner';
import type { Task } from '../types/task';

/**
 * Calculate planning date range:
 * - Start: Most recent Sunday (including today if Sunday)
 * - End: Following Saturday (6 days from Sunday = 7 day week)
 * - weekOffset: Add 7 days per offset to view future weeks
 */
function getPlanningDateRange(weekOffset: number = 0): { start: Date; end: Date } {
  const today = startOfDay(new Date());
  const dayOfWeek = getDay(today); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  // Calculate days BACK to most recent Sunday
  // Sunday = 0, so daysBack = dayOfWeek
  const daysBackToSunday = dayOfWeek;

  // Start from most recent Sunday + week offset
  const sunday = addDays(today, -daysBackToSunday + weekOffset * 7);

  // End = Saturday (6 days from Sunday = Sun-Mon-Tue-Wed-Thu-Fri-Sat)
  const end = addDays(sunday, 6);

  return { start: sunday, end };
}

function WeeklyPlanning() {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  const planningRange = useMemo(() => getPlanningDateRange(weekOffset), [weekOffset]);

  // Configure drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Data hooks
  const {
    data: backlogTasks = [],
    isLoading: loadingBacklog,
  } = useWeeklyBacklog();

  const {
    data: calendarEvents = [],
    isLoading: loadingEvents,
  } = useCalendarEvents(
    format(planningRange.start, 'yyyy-MM-dd'),
    format(planningRange.end, 'yyyy-MM-dd')
  );

  const {
    data: scheduledTasks = [],
    isLoading: loadingScheduled,
  } = useScheduledTasks(
    format(planningRange.start, 'yyyy-MM-dd'),
    format(planningRange.end, 'yyyy-MM-dd')
  );

  // Mutations
  const scheduleMutation = useScheduleTask();
  const reorderMutation = useReorderTasks();
  const completeMutation = useCompleteTask();
  const unscheduleMutation = useUnscheduleTask();
  const createEventMutation = useCreateEvent();
  const updateEventMutation = useUpdateEvent();

  // Week navigation handler
  const handleWeekChange = useCallback((direction: 'prev' | 'next') => {
    setWeekOffset((prev) => {
      if (direction === 'prev' && prev <= 0) return 0;
      return direction === 'next' ? prev + 1 : prev - 1;
    });
  }, []);

  // Complete task handler
  const handleCompleteTask = useCallback((taskId: string) => {
    completeMutation.mutate(taskId);
  }, [completeMutation]);

  // Unschedule task handler - moves task back to backlog
  const handleUnscheduleTask = useCallback((taskId: string) => {
    unscheduleMutation.mutate(taskId);
  }, [unscheduleMutation]);

  // Create calendar event handler - syncs to Google Calendar
  const handleCreateEvent = useCallback((title: string, startTime: string, endTime: string) => {
    createEventMutation.mutate({
      title,
      startTime,
      endTime,
      eventType: 'personal',
      syncToGoogle: true,
    });
  }, [createEventMutation]);

  // Reschedule calendar event handler - syncs to Google Calendar
  const handleRescheduleEvent = useCallback((eventId: string, startTime: string, endTime: string) => {
    updateEventMutation.mutate({
      id: eventId,
      data: { startTime, endTime },
    });
  }, [updateEventMutation]);

  // Drag handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const activeId = active.id.toString();

    // Check if it's a scheduled task being dragged (prefixed with "scheduled-")
    if (activeId.startsWith('scheduled-')) {
      const taskId = activeId.replace('scheduled-', '');
      const task = scheduledTasks.find((t) => t.id === taskId);
      if (task) {
        setActiveTask(task);
      }
    } else {
      // Backlog task
      const task = backlogTasks.find((t) => t.id === activeId);
      if (task) {
        setActiveTask(task);
      }
    }
  };

  /**
   * Handle drag end events.
   * Calendar drops are handled directly by PlanningCalendar via useDndMonitor.
   * This handler only deals with backlog reordering.
   */
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id.toString();
    const overId = over.id.toString();
    const isScheduledTask = activeId.startsWith('scheduled-');

    // Calendar drops (day- or slot- prefixes) are handled by PlanningCalendar
    // Only handle backlog reordering here
    if (!isScheduledTask && !overId.startsWith('day-') && !overId.startsWith('slot-') && overId !== activeId) {
      const oldIndex = backlogTasks.findIndex((t) => t.id === activeId);
      const newIndex = backlogTasks.findIndex((t) => t.id === overId);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newTasks = [...backlogTasks];
        const [movedTask] = newTasks.splice(oldIndex, 1);
        newTasks.splice(newIndex, 0, movedTask);
        reorderMutation.mutate(newTasks.map((t) => t.id));
      }
    }
  };

  const isLoading = loadingBacklog || loadingEvents || loadingScheduled;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 mb-4">
        <h1 className="text-2xl font-bold text-white">
          Weekly Planning
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Drag tasks from backlog to calendar to schedule them
        </p>
      </header>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={rectIntersection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 flex gap-4 min-h-0">
            {/* Left Panel: Weekly Backlog */}
            <div className="w-72 flex-shrink-0">
              <SortableContext
                items={backlogTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <WeeklyBacklogPanel
                  tasks={backlogTasks}
                  isLoading={loadingBacklog}
                />
              </SortableContext>
            </div>

            {/* Right Panel: Calendar */}
            <div className="flex-1 min-w-0">
              <PlanningCalendar
                startDate={planningRange.start}
                endDate={planningRange.end}
                events={calendarEvents}
                scheduledTasks={scheduledTasks}
                backlogTasks={backlogTasks}
                onWeekChange={handleWeekChange}
                weekOffset={weekOffset}
                onCompleteTask={handleCompleteTask}
                onUnscheduleTask={handleUnscheduleTask}
                onScheduleTask={(taskId, startTime, endTime) => {
                  scheduleMutation.mutate({ taskId, startTime, endTime });
                }}
                onCreateEvent={handleCreateEvent}
                onRescheduleEvent={handleRescheduleEvent}
              />
            </div>
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeTask ? (
              <div className="bg-slate-800 border-2 border-blue-500 rounded-lg p-3 shadow-2xl shadow-blue-500/20 w-64">
                <div className="font-medium text-sm text-white truncate">{activeTask.title}</div>
                {activeTask.timeEstimateMinutes && (
                  <div className="text-xs text-slate-400 mt-1">
                    {activeTask.timeEstimateMinutes}m
                  </div>
                )}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

export default WeeklyPlanning;

/**
 * Planning Calendar - Google Calendar Style
 *
 * Features:
 * - Click and drag on EVENTS column to create new calendar events
 * - Drag tasks from backlog to TASKS column to schedule them
 * - Drag scheduled tasks to reschedule (up/down, between days)
 * - Hover preview shows exactly where item will land
 * - Right-click for options (unschedule, edit)
 * - 15-minute slot granularity
 */

import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { format, addDays, isToday, getHours, getMinutes, parseISO, differenceInMinutes } from 'date-fns';
import { useDroppable, useDraggable, useDndMonitor } from '@dnd-kit/core';
import TaskDetailModal from './TaskDetailModal';

import type { CalendarEvent } from '../../types/calendar';
import type { Task } from '../../types/task';

// ============================================
// Types
// ============================================

interface DragPosition {
  dateKey: string;
  hour: number;
  minute: number;
}

interface PlanningCalendarProps {
  startDate: Date;
  endDate: Date;
  events: CalendarEvent[];
  scheduledTasks: Task[];
  backlogTasks?: Task[];
  onWeekChange?: (direction: 'prev' | 'next') => void;
  weekOffset?: number;
  onCompleteTask?: (taskId: string) => void;
  onUnscheduleTask?: (taskId: string) => void;
  onScheduleTask?: (taskId: string, startTime: string, endTime: string) => void;
  onCreateEvent?: (title: string, startTime: string, endTime: string) => void;
  onRescheduleEvent?: (eventId: string, startTime: string, endTime: string) => void;
  onDragPositionChange?: (position: DragPosition | null) => void;
}

interface DragState {
  isDragging: boolean;
  startSlot: { date: Date; hour: number; minute: number } | null;
  currentSlot: { date: Date; hour: number; minute: number } | null;
}

interface HoverPreview {
  dateKey: string;
  hour: number;
  minute: number;
  duration: number;
  title: string;
}

interface EventPopupState {
  isOpen: boolean;
  date: Date;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  x: number;
  y: number;
  title: string;
}

// ============================================
// Constants
// ============================================

const HOUR_HEIGHT = 48;
const SLOT_HEIGHT = HOUR_HEIGHT / 4; // 12px per 15-minute slot
const START_HOUR = 6;
const END_HOUR = 22;
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const DAY_WIDTH = 140;
const DEFAULT_DURATION = 15;

const EVENT_COLORS: Record<string, string> = {
  meeting: 'bg-purple-500',
  class: 'bg-blue-500',
  deadline: 'bg-red-500',
  personal: 'bg-green-500',
  blocked_time: 'bg-yellow-500',
  default: 'bg-indigo-500',
};

const TASK_COLORS: Record<number, string> = {
  4: 'bg-red-500',
  3: 'bg-orange-500',
  2: 'bg-yellow-500',
  1: 'bg-blue-500',
  0: 'bg-slate-500',
};

// ============================================
// Helper Functions
// ============================================

function getLocalDateKey(isoString: string): string {
  const date = parseISO(isoString);
  return format(date, 'yyyy-MM-dd');
}

function formatTime(hour: number, minute: number): string {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return format(date, 'h:mm a');
}

function getSlotFromY(y: number, containerTop: number): { hour: number; minute: number } {
  const relativeY = y - containerTop;
  const totalMinutes = Math.floor(relativeY / SLOT_HEIGHT) * 15;
  const hour = START_HOUR + Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return { hour: Math.max(START_HOUR, Math.min(END_HOUR - 1, hour)), minute };
}

// ============================================
// Event Block Component
// ============================================

interface EventBlockProps {
  event: CalendarEvent;
}

function EventBlock({ event }: EventBlockProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `event-${event.id}`,
    data: { type: 'calendarEvent', event },
  });

  const start = parseISO(event.startTime);
  const end = parseISO(event.endTime);
  const startHour = getHours(start);
  const startMinute = getMinutes(start);
  const durationMinutes = differenceInMinutes(end, start);

  const top = (startHour - START_HOUR) * HOUR_HEIGHT + (startMinute / 60) * HOUR_HEIGHT;
  const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT, 20);

  if (startHour < START_HOUR || startHour >= END_HOUR) return null;

  const colorClass = EVENT_COLORS[event.eventType || 'default'] || EVENT_COLORS.default;

  return (
    <div
      ref={setNodeRef}
      data-testid={`calendar-event-${event.id}`}
      data-event="true"
      className={`absolute left-0.5 right-0.5 rounded px-1.5 py-0.5 text-[10px] overflow-hidden
        ${colorClass} text-white shadow-sm cursor-grab hover:brightness-110 transition-all
        ${isDragging ? 'opacity-50 cursor-grabbing' : ''}`}
      style={{
        top,
        height,
        minHeight: 20,
        zIndex: isDragging ? 100 : 5,
      }}
      {...attributes}
      {...listeners}
      onMouseDown={(e) => e.stopPropagation()}
      title={`${event.title}${event.location ? ` @ ${event.location}` : ''}\n${format(start, 'h:mm a')} - ${format(end, 'h:mm a')}`}
    >
      <div className="font-medium truncate leading-tight">{event.title}</div>
      {height > 28 && (
        <div className="text-white/80 text-[9px]">{format(start, 'h:mm a')}</div>
      )}
    </div>
  );
}

// ============================================
// Task Block Component (Draggable)
// ============================================

interface TaskBlockProps {
  task: Task;
  onComplete?: (taskId: string) => void;
  onUnschedule?: (taskId: string) => void;
  onDoubleClick?: (task: Task) => void;
  columnIndex: number;
  totalColumns: number;
}

function TaskBlock({ task, onComplete, onUnschedule, onDoubleClick, columnIndex, totalColumns }: TaskBlockProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `scheduled-${task.id}`,
    data: { type: 'scheduledTask', task },
  });

  // Close menu when clicking outside
  useEffect(() => {
    if (!showMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

  if (!task.scheduledStart) return null;

  const start = parseISO(task.scheduledStart);
  const startHour = getHours(start);
  const startMinute = getMinutes(start);
  const durationMinutes = task.timeEstimateMinutes || DEFAULT_DURATION;

  const top = (startHour - START_HOUR) * HOUR_HEIGHT + (startMinute / 60) * HOUR_HEIGHT;
  const height = Math.max((durationMinutes / 60) * HOUR_HEIGHT, 20);

  if (startHour < START_HOUR || startHour >= END_HOUR) return null;

  const colorClass = TASK_COLORS[task.priority] || TASK_COLORS[0];
  const isCompleted = !!task.completedAt;

  const width = totalColumns > 1 ? `calc(${100 / totalColumns}% - 2px)` : 'calc(100% - 4px)';
  const left = totalColumns > 1 ? `calc(${(columnIndex / totalColumns) * 100}% + 2px)` : '2px';

  const style: React.CSSProperties = {
    top,
    height,
    minHeight: 20,
    width,
    left,
    zIndex: isDragging ? 100 : 10,
    opacity: isDragging ? 0.5 : 1,
    // CRITICAL: Disable pointer events while dragging so the task doesn't block
    // collision detection with the underlying DroppableDayColumn
    pointerEvents: isDragging ? 'none' : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      data-testid={`scheduled-task-${task.id}`}
      data-task-title={task.title}
      className={`absolute rounded px-1.5 py-0.5 text-[10px] select-none
        ${colorClass} text-white shadow-sm border-l-2 border-white/30
        ${isCompleted ? 'opacity-50' : ''}
        ${isDragging ? 'cursor-grabbing' : 'cursor-grab hover:brightness-110'}
        transition-opacity`}
      style={style}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setShowMenu(true);
      }}
      onDoubleClick={() => onDoubleClick?.(task)}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start gap-1">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isCompleted) onComplete?.(task.id);
          }}
          // Removed onPointerDown stopPropagation - it was blocking drag initiation
          // on narrow tasks where checkbox fills most of the width.
          // dnd-kit has an 8px distance threshold, so clicks without movement
          // will still trigger the onClick handler properly.
          className={`flex-shrink-0 w-3 h-3 mt-0.5 rounded-sm border transition-colors
            ${isCompleted ? 'bg-green-400 border-green-300' : 'border-white/50 hover:bg-white/20'}`}
        >
          {isCompleted && (
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </button>
        <div className={`font-medium truncate leading-tight flex-1 ${isCompleted ? 'line-through' : ''}`}>
          {task.title}
        </div>
      </div>
      {height > 32 && (
        <div className="text-white/80 text-[9px] ml-4">{durationMinutes}m</div>
      )}

      {/* Context Menu */}
      {showMenu && (
        <div
          ref={menuRef}
          className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-[200] min-w-[150px] py-1"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setShowMenu(false);
              onUnschedule?.(task.id);
            }}
            className="w-full px-3 py-2 text-left text-xs hover:bg-slate-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
            Back to Backlog
          </button>
          <button
            onClick={() => {
              setShowMenu(false);
              onDoubleClick?.(task);
            }}
            className="w-full px-3 py-2 text-left text-xs hover:bg-slate-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit Details
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================
// Hover Preview Component
// ============================================

interface HoverPreviewBlockProps {
  preview: HoverPreview;
}

function HoverPreviewBlock({ preview }: HoverPreviewBlockProps) {
  const top = (preview.hour - START_HOUR) * HOUR_HEIGHT + (preview.minute / 60) * HOUR_HEIGHT;
  const height = Math.max((preview.duration / 60) * HOUR_HEIGHT, SLOT_HEIGHT);

  return (
    <div
      className="absolute left-0.5 right-0.5 bg-emerald-500/80 border-2 border-emerald-300 rounded-md shadow-lg pointer-events-none"
      style={{ top, height, zIndex: 50 }}
    >
      <div className="text-[11px] text-white px-1.5 py-0.5 font-medium truncate">
        {preview.title}
      </div>
      {height > 20 && (
        <div className="text-[9px] text-emerald-100 px-1.5">
          {formatTime(preview.hour, preview.minute)}
        </div>
      )}
    </div>
  );
}

// ============================================
// Current Time Indicator
// ============================================

function CurrentTimeIndicator() {
  const now = new Date();
  const hour = getHours(now);
  const minute = getMinutes(now);

  if (hour < START_HOUR || hour >= END_HOUR) return null;

  const top = (hour - START_HOUR) * HOUR_HEIGHT + (minute / 60) * HOUR_HEIGHT;

  return (
    <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top }}>
      <div className="flex items-center">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-lg -ml-1" />
        <div className="flex-1 h-0.5 bg-red-500" />
      </div>
    </div>
  );
}

// ============================================
// Event Creation Popup
// ============================================

interface EventPopupProps {
  state: EventPopupState;
  backlogTasks: Task[];
  onClose: () => void;
  onCreateEvent: (title: string) => void;
  onScheduleTask: (taskId: string) => void;
  onTitleChange: (title: string) => void;
}

function EventPopup({ state, backlogTasks, onClose, onCreateEvent, onScheduleTask, onTitleChange }: EventPopupProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'create' | 'schedule'>('create');

  useEffect(() => {
    if (state.isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [state.isOpen]);

  if (!state.isOpen) return null;

  const timeRange = `${formatTime(state.startHour, state.startMinute)} - ${formatTime(state.endHour, state.endMinute)}`;
  const dateStr = format(state.date, 'EEEE, MMMM d');

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl w-[320px] overflow-hidden"
        style={{
          left: Math.min(state.x, window.innerWidth - 340),
          top: Math.min(state.y, window.innerHeight - 400),
        }}
      >
        <div className="px-4 py-3 bg-slate-700 border-b border-slate-600">
          <div className="text-sm font-medium text-white">{dateStr}</div>
          <div className="text-xs text-slate-400">{timeRange}</div>
        </div>

        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 px-4 py-2 text-xs font-medium transition-colors
              ${activeTab === 'create' ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-700/50' : 'text-slate-400 hover:text-white'}`}
          >
            New Event
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex-1 px-4 py-2 text-xs font-medium transition-colors
              ${activeTab === 'schedule' ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-700/50' : 'text-slate-400 hover:text-white'}`}
          >
            Schedule Task ({backlogTasks.length})
          </button>
        </div>

        {activeTab === 'create' ? (
          <div className="p-4">
            <input
              ref={inputRef}
              type="text"
              value={state.title}
              onChange={(e) => onTitleChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && state.title.trim()) {
                  onCreateEvent(state.title.trim());
                } else if (e.key === 'Escape') {
                  onClose();
                }
              }}
              placeholder="Add title"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => state.title.trim() && onCreateEvent(state.title.trim())}
                disabled={!state.title.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Create Event
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-700 text-slate-300 text-sm rounded hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
            </div>
            <p className="text-[10px] text-slate-500 mt-2">
              Event will sync to Google Calendar
            </p>
          </div>
        ) : (
          <div className="max-h-[250px] overflow-y-auto">
            {backlogTasks.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400">
                No tasks in backlog
              </div>
            ) : (
              backlogTasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => onScheduleTask(task.id)}
                  className="w-full px-4 py-3 text-left hover:bg-slate-700 border-b border-slate-700/50 last:border-b-0 transition-colors"
                >
                  <div className="text-sm text-white truncate">{task.title}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {task.timeEstimateMinutes || DEFAULT_DURATION}m
                    {task.context && ` · ${task.context}`}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ============================================
// Droppable Day Column
// ============================================

interface DroppableDayColumnProps {
  date: Date;
  dateKey: string;
  children: React.ReactNode;
  hoverPreview: HoverPreview | null;
}

function DroppableDayColumn({ date, dateKey, children, hoverPreview }: DroppableDayColumnProps) {
  const { isOver, setNodeRef, active } = useDroppable({
    id: `day-${dateKey}`,
    data: { type: 'dayColumn', date, dateKey },
  });

  const showPreview = hoverPreview && hoverPreview.dateKey === dateKey;

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 relative transition-colors ${isOver ? 'bg-blue-500/10' : ''} ${active ? 'border border-dashed border-slate-600/50' : ''}`}
      style={{ height: HOURS.length * HOUR_HEIGHT }}
    >
      {children}
      {showPreview && <HoverPreviewBlock preview={hoverPreview} />}
    </div>
  );
}

// ============================================
// Overlap Calculation
// ============================================

interface TaskWithPosition {
  task: Task;
  columnIndex: number;
  totalColumns: number;
}

function calculateOverlappingTasks(tasks: Task[]): TaskWithPosition[] {
  if (tasks.length === 0) return [];

  const sortedTasks = [...tasks].sort((a, b) => {
    const aStart = a.scheduledStart ? parseISO(a.scheduledStart).getTime() : 0;
    const bStart = b.scheduledStart ? parseISO(b.scheduledStart).getTime() : 0;
    return aStart - bStart;
  });

  const result: TaskWithPosition[] = [];
  const groups: Task[][] = [];

  for (const task of sortedTasks) {
    if (!task.scheduledStart) continue;

    const taskStart = parseISO(task.scheduledStart);
    const taskDuration = task.timeEstimateMinutes || DEFAULT_DURATION;
    const taskEnd = new Date(taskStart.getTime() + taskDuration * 60 * 1000);

    let addedToGroup = false;
    for (const group of groups) {
      const overlapsGroup = group.some((groupTask) => {
        if (!groupTask.scheduledStart) return false;
        const groupStart = parseISO(groupTask.scheduledStart);
        const groupDuration = groupTask.timeEstimateMinutes || DEFAULT_DURATION;
        const groupEnd = new Date(groupStart.getTime() + groupDuration * 60 * 1000);
        return taskStart < groupEnd && taskEnd > groupStart;
      });

      if (overlapsGroup) {
        group.push(task);
        addedToGroup = true;
        break;
      }
    }

    if (!addedToGroup) {
      groups.push([task]);
    }
  }

  for (const group of groups) {
    const totalColumns = group.length;
    group.forEach((task, index) => {
      result.push({ task, columnIndex: index, totalColumns });
    });
  }

  return result;
}

// ============================================
// Main Calendar Component
// ============================================

function PlanningCalendar({
  startDate,
  endDate,
  events,
  scheduledTasks,
  backlogTasks = [],
  onWeekChange,
  weekOffset = 0,
  onCompleteTask,
  onUnscheduleTask,
  onScheduleTask,
  onCreateEvent,
  onRescheduleEvent,
  onDragPositionChange,
}: PlanningCalendarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const calendarGridRef = useRef<HTMLDivElement>(null);
  const stickyHeaderRef = useRef<HTMLDivElement>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Track pointer position for time indicator tooltip
  const [dragPointerPosition, setDragPointerPosition] = useState<{ x: number; y: number } | null>(null);

  // Drag state for creating new events (on EVENTS column)
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startSlot: null,
    currentSlot: null,
  });
  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState;

  // Hover preview for task drops
  const [hoverPreview, setHoverPreview] = useState<HoverPreview | null>(null);

  // Popup state
  const [popup, setPopup] = useState<EventPopupState>({
    isOpen: false,
    date: new Date(),
    startHour: 9,
    startMinute: 0,
    endHour: 9,
    endMinute: 30,
    x: 0,
    y: 0,
    title: '',
  });

  // Generate days array (needed early for hover preview calculation)
  const days = useMemo(() => {
    const result: Date[] = [];
    let current = new Date(startDate);
    while (current <= endDate) {
      result.push(new Date(current));
      current = addDays(current, 1);
    }
    return result;
  }, [startDate, endDate]);

  /**
   * Single source of truth for converting pointer position to calendar time slot.
   * Uses measured DOM values instead of hardcoded constants.
   * Returns null if pointer is outside valid drop area.
   */
  const getTimeFromPointer = useCallback((clientX: number, clientY: number, allowEventsColumn = false): {
    dateKey: string;
    dayIndex: number;
    hour: number;
    minute: number;
  } | null => {
    if (!scrollRef.current || !stickyHeaderRef.current) return null;

    const scrollContainer = scrollRef.current;
    const stickyHeader = stickyHeaderRef.current;

    // Get container bounds and scroll position
    const scrollRect = scrollContainer.getBoundingClientRect();
    const scrollTop = scrollContainer.scrollTop;

    // Measure the sticky header dynamically instead of using hardcoded value
    const stickyHeaderHeight = stickyHeader.offsetHeight;
    const TIME_LABEL_WIDTH = 56;

    // Check if pointer is within the scroll container bounds
    const contentTop = scrollRect.top + stickyHeaderHeight;
    if (clientX < scrollRect.left || clientX > scrollRect.right ||
        clientY < contentTop || clientY > scrollRect.bottom) {
      return null;
    }

    // Calculate which day column (accounting for time label width)
    const relativeX = clientX - scrollRect.left - TIME_LABEL_WIDTH;
    const dayIndex = Math.floor(relativeX / DAY_WIDTH);

    // Validate day index
    if (dayIndex < 0 || dayIndex >= days.length || relativeX < 0) {
      return null;
    }

    // Check if in TASKS column (right half of day) vs EVENTS column (left half)
    const positionInDay = relativeX % DAY_WIDTH;
    const isInTasksColumn = positionInDay >= DAY_WIDTH / 2;

    // For tasks: only allow drops in Tasks column
    // For events: allow drops in either column (when allowEventsColumn is true)
    if (!isInTasksColumn && !allowEventsColumn) {
      return null; // In Events column - don't allow task drops here
    }

    // Calculate date for this column
    const targetDate = days[dayIndex];
    const dateKey = format(targetDate, 'yyyy-MM-dd');

    // Calculate Y position relative to content (accounting for scroll)
    // This is the key fix: measure from content top, then add scroll offset
    const pointerOffsetFromContentTop = clientY - contentTop;
    const contentY = scrollTop + pointerOffsetFromContentTop;

    // Convert content Y to time (15-minute slots, SLOT_HEIGHT = 12px)
    const totalMinutes = Math.floor(contentY / SLOT_HEIGHT) * 15;
    const rawHour = START_HOUR + Math.floor(totalMinutes / 60);
    const rawMinute = totalMinutes % 60;

    // Clamp to valid hours (6 AM to 9:45 PM for 10 PM end)
    const hour = Math.max(START_HOUR, Math.min(END_HOUR - 1, rawHour));
    const minute = hour === rawHour ? Math.max(0, Math.min(45, rawMinute)) : (rawHour < START_HOUR ? 0 : 45);

    return { dateKey, dayIndex, hour, minute };
  }, [days]);

  // Track the actual pointer position during drag
  const pointerPositionRef = useRef({ x: 0, y: 0 });

  // Update pointer position on mouse move
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      pointerPositionRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Monitor dnd-kit drag events for hover preview and handle drops
  useDndMonitor({
    onDragMove(event) {
      const { active } = event;
      if (!active) {
        setHoverPreview(null);
        setDragPointerPosition(null);
        onDragPositionChange?.(null);
        return;
      }

      // Get current pointer position
      const currentX = pointerPositionRef.current.x;
      const currentY = pointerPositionRef.current.y;

      // Update pointer position for time indicator tooltip
      setDragPointerPosition({ x: currentX, y: currentY });

      // Determine if dragging an event (allow events column) or task (tasks column only)
      const activeData = active.data.current;
      const isCalendarEvent = activeData?.type === 'calendarEvent';

      // Use single source of truth for coordinate calculation
      const position = getTimeFromPointer(currentX, currentY, isCalendarEvent);

      if (!position) {
        setHoverPreview(null);
        onDragPositionChange?.(null);
        return;
      }

      const { dateKey, hour, minute } = position;

      // Get duration and title from active item
      let duration = DEFAULT_DURATION;
      let title = 'Task';

      if (isCalendarEvent && activeData.event) {
        // Calculate duration from event times
        const evt = activeData.event;
        duration = differenceInMinutes(parseISO(evt.endTime), parseISO(evt.startTime));
        title = evt.title;
      } else if (activeData?.type === 'scheduledTask' && activeData.task) {
        duration = activeData.task.timeEstimateMinutes || DEFAULT_DURATION;
        title = activeData.task.title;
      } else if (activeData?.type === 'backlogTask' && activeData.task) {
        duration = activeData.task.timeEstimateMinutes || DEFAULT_DURATION;
        title = activeData.task.title;
      }

      // Update hover preview
      setHoverPreview({
        dateKey,
        hour,
        minute,
        duration,
        title,
      });

      // Notify parent of drag position (for backward compatibility)
      onDragPositionChange?.({ dateKey, hour, minute });
    },

    onDragEnd(event) {
      const { active, over } = event;

      // Get current pointer position
      const currentX = pointerPositionRef.current.x;
      const currentY = pointerPositionRef.current.y;

      // Determine if this is a calendar event drag
      const activeData = active?.data.current;
      const isCalendarEvent = activeData?.type === 'calendarEvent';

      // Get position at drop time - allow events column for calendar events
      const dropPosition = getTimeFromPointer(currentX, currentY, isCalendarEvent);

      // Clear preview state
      setHoverPreview(null);
      setDragPointerPosition(null);
      onDragPositionChange?.(null);

      // If no valid drop position or no active item, skip
      if (!dropPosition || !active) return;

      const { dateKey, hour, minute } = dropPosition;
      const activeId = active.id.toString();

      // Handle calendar event reschedule
      // Events use pointer position directly, no need for droppable check
      if (isCalendarEvent && activeId.startsWith('event-')) {
        const eventId = activeId.replace('event-', '');
        const calEvent = events.find(e => e.id === eventId);
        if (!calEvent || !onRescheduleEvent) return;

        // Calculate duration from original event
        const originalStart = parseISO(calEvent.startTime);
        const originalEnd = parseISO(calEvent.endTime);
        const durationMs = originalEnd.getTime() - originalStart.getTime();

        // Create new times
        const [year, month, day] = dateKey.split('-').map(Number);
        const newStartTime = new Date(year, month - 1, day, hour, minute, 0, 0);
        const newEndTime = new Date(newStartTime.getTime() + durationMs);

        // Reschedule the event
        onRescheduleEvent(eventId, newStartTime.toISOString(), newEndTime.toISOString());
        return;
      }

      // Handle task scheduling - requires drop on a day column
      if (!onScheduleTask) return;
      if (!over || !over.id.toString().startsWith('day-')) return;

      const isScheduledTask = activeId.startsWith('scheduled-');

      // Get the task being dragged
      let taskId: string | undefined;
      let taskDuration = DEFAULT_DURATION;

      if (isScheduledTask) {
        taskId = activeId.replace('scheduled-', '');
        const task = scheduledTasks.find((t) => t.id === taskId);
        taskDuration = task?.timeEstimateMinutes || DEFAULT_DURATION;
      } else {
        taskId = activeId;
        const task = backlogTasks.find((t) => t.id === taskId);
        taskDuration = task?.timeEstimateMinutes || DEFAULT_DURATION;
      }

      if (!taskId) return;

      // Create the start and end times
      const [year, month, day] = dateKey.split('-').map(Number);
      const startTime = new Date(year, month - 1, day, hour, minute, 0, 0);
      const endTime = new Date(startTime.getTime() + taskDuration * 60 * 1000);

      // Schedule the task using the exact position shown in preview
      onScheduleTask(taskId, startTime.toISOString(), endTime.toISOString());
    },

    onDragCancel() {
      setHoverPreview(null);
      setDragPointerPosition(null);
      onDragPositionChange?.(null);
    },
  });

  // Group events by day
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((event) => {
      if (event.allDay) return;
      const dateKey = getLocalDateKey(event.startTime);
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(event);
    });
    return map;
  }, [events]);

  // Group tasks by day with overlap calculation
  const tasksByDayWithPositions = useMemo(() => {
    const map = new Map<string, TaskWithPosition[]>();
    const tasksByDay = new Map<string, Task[]>();

    scheduledTasks.forEach((task) => {
      if (!task.scheduledStart) return;
      const taskDate = parseISO(task.scheduledStart);
      const dateKey = format(taskDate, 'yyyy-MM-dd');
      if (!tasksByDay.has(dateKey)) tasksByDay.set(dateKey, []);
      tasksByDay.get(dateKey)!.push(task);
    });

    tasksByDay.forEach((tasks, dateKey) => {
      map.set(dateKey, calculateOverlappingTasks(tasks));
    });

    return map;
  }, [scheduledTasks]);

  // Scroll to current time on mount
  useEffect(() => {
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

  // Handle mouse down on EVENTS column (start drag to create event)
  const handleEventsMouseDown = useCallback((e: React.MouseEvent, day: Date) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-event]')) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const slot = getSlotFromY(e.clientY, rect.top);

    setDragState({
      isDragging: true,
      startSlot: { date: day, ...slot },
      currentSlot: { date: day, ...slot },
    });
  }, []);

  const handleEventsMouseMove = useCallback((e: React.MouseEvent) => {
    const currentDrag = dragStateRef.current;
    if (!currentDrag.isDragging || !currentDrag.startSlot) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const slot = getSlotFromY(e.clientY, rect.top);

    setDragState(prev => ({
      ...prev,
      currentSlot: { date: prev.startSlot!.date, ...slot },
    }));
  }, []);

  const handleEventsMouseUp = useCallback((e: React.MouseEvent) => {
    const currentDrag = dragStateRef.current;
    if (!currentDrag.isDragging || !currentDrag.startSlot || !currentDrag.currentSlot) {
      setDragState({ isDragging: false, startSlot: null, currentSlot: null });
      return;
    }

    const { startSlot, currentSlot } = currentDrag;

    let startHour = startSlot.hour;
    let startMinute = startSlot.minute;
    let endHour = currentSlot.hour;
    let endMinute = currentSlot.minute + 15;

    if (endMinute >= 60) {
      endHour += 1;
      endMinute = 0;
    }

    if (startHour > endHour || (startHour === endHour && startMinute >= endMinute)) {
      [startHour, startMinute, endHour, endMinute] = [endHour, endMinute - 15 < 0 ? 45 : endMinute - 15, startHour, startMinute + 15];
      if (endMinute - 15 < 0) endHour -= 1;
    }

    if (startHour === endHour && startMinute === endMinute) {
      endMinute += 15;
      if (endMinute >= 60) {
        endHour += 1;
        endMinute = 0;
      }
    }

    setPopup({
      isOpen: true,
      date: startSlot.date,
      startHour,
      startMinute,
      endHour,
      endMinute,
      x: e.clientX,
      y: e.clientY,
      title: '',
    });

    setDragState({ isDragging: false, startSlot: null, currentSlot: null });
  }, []);

  const handleCreateEvent = useCallback((title: string) => {
    if (!onCreateEvent) return;

    const startTime = new Date(popup.date);
    startTime.setHours(popup.startHour, popup.startMinute, 0, 0);

    const endTime = new Date(popup.date);
    endTime.setHours(popup.endHour, popup.endMinute, 0, 0);

    onCreateEvent(title, startTime.toISOString(), endTime.toISOString());
    setPopup(prev => ({ ...prev, isOpen: false, title: '' }));
  }, [onCreateEvent, popup]);

  const handleScheduleTaskFromPopup = useCallback((taskId: string) => {
    if (!onScheduleTask) return;

    const startTime = new Date(popup.date);
    startTime.setHours(popup.startHour, popup.startMinute, 0, 0);

    const task = backlogTasks.find(t => t.id === taskId);
    const duration = task?.timeEstimateMinutes || DEFAULT_DURATION;

    const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

    onScheduleTask(taskId, startTime.toISOString(), endTime.toISOString());
    setPopup(prev => ({ ...prev, isOpen: false, title: '' }));
  }, [onScheduleTask, popup, backlogTasks]);

  const handleTaskDoubleClick = (task: Task) => {
    setSelectedTask(task);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailModalOpen(false);
    setSelectedTask(null);
  };

  // Calculate drag preview for event creation
  const getDragPreviewStyle = useCallback(() => {
    if (!dragState.isDragging || !dragState.startSlot || !dragState.currentSlot) return null;

    const { startSlot, currentSlot } = dragState;
    let startMinutes = startSlot.hour * 60 + startSlot.minute;
    let endMinutes = currentSlot.hour * 60 + currentSlot.minute + 15;

    if (startMinutes > endMinutes) {
      [startMinutes, endMinutes] = [endMinutes - 15, startMinutes + 15];
    }

    const top = ((startMinutes / 60) - START_HOUR) * HOUR_HEIGHT;
    const height = Math.max(((endMinutes - startMinutes) / 60) * HOUR_HEIGHT, SLOT_HEIGHT);

    return { top, height, startMinutes };
  }, [dragState]);

  const dragPreview = getDragPreviewStyle();
  const calendarWidth = days.length * DAY_WIDTH + 56;

  return (
    <>
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
            {/* Day Headers */}
            <div ref={stickyHeaderRef} className="sticky top-0 z-10 flex bg-slate-800 border-b border-slate-600">
              <div className="w-14 flex-shrink-0 border-r border-slate-700" />
              {days.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayEvents = eventsByDay.get(dateKey) || [];
                const dayTaskPositions = tasksByDayWithPositions.get(dateKey) || [];

                return (
                  <div
                    key={day.toISOString()}
                    className={`border-r border-slate-700 last:border-r-0 ${isToday(day) ? 'bg-blue-900/30' : ''}`}
                    style={{ width: DAY_WIDTH }}
                  >
                    <div className="text-center py-2 border-b border-slate-700/50">
                      <div className="text-[10px] text-slate-400 uppercase tracking-wide">
                        {format(day, 'EEE')}
                      </div>
                      <div className={`text-lg font-bold ${isToday(day) ? 'text-blue-400' : 'text-white'}`}>
                        {format(day, 'd')}
                      </div>
                    </div>
                    <div className="flex text-[9px] text-slate-500 uppercase tracking-wider">
                      <div className="flex-1 text-center py-1 border-r border-slate-700/50">
                        Events ({dayEvents.length})
                      </div>
                      <div className="flex-1 text-center py-1">
                        Tasks ({dayTaskPositions.length})
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Time Grid */}
            <div ref={calendarGridRef} className="flex">
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
                const dayTaskPositions = tasksByDayWithPositions.get(dateKey) || [];
                const isDragDay = dragState.startSlot?.date.toDateString() === day.toDateString();

                return (
                  <div
                    key={day.toISOString()}
                    className={`flex border-r border-slate-700 last:border-r-0 ${isToday(day) ? 'bg-blue-900/10' : ''}`}
                    style={{ width: DAY_WIDTH }}
                  >
                    {/* Events column - click to create events */}
                    <div
                      className="flex-1 relative border-r border-slate-700/30 select-none cursor-crosshair"
                      style={{ height: HOURS.length * HOUR_HEIGHT }}
                      onMouseDown={(e) => handleEventsMouseDown(e, day)}
                      onMouseMove={handleEventsMouseMove}
                      onMouseUp={handleEventsMouseUp}
                      onMouseLeave={() => {
                        if (dragStateRef.current.isDragging) {
                          setDragState({ isDragging: false, startSlot: null, currentSlot: null });
                        }
                      }}
                    >
                      {/* Hour grid */}
                      {HOURS.map((hour) => (
                        <div
                          key={hour}
                          className="absolute left-0 right-0 border-b border-slate-800"
                          style={{ top: (hour - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                        />
                      ))}

                      {/* Drag preview for event creation */}
                      {isDragDay && dragPreview && (
                        <div
                          className="absolute left-1 right-1 bg-indigo-500/50 border-2 border-indigo-400 rounded pointer-events-none z-20"
                          style={{ top: dragPreview.top, height: dragPreview.height }}
                        >
                          <div className="text-[10px] text-white px-1 py-0.5 font-medium">
                            {formatTime(
                              Math.floor(dragPreview.startMinutes / 60),
                              dragPreview.startMinutes % 60
                            )}
                          </div>
                        </div>
                      )}

                      {/* Calendar events */}
                      {dayEvents.map((event) => (
                        <EventBlock key={event.id} event={event} />
                      ))}
                      {isToday(day) && <CurrentTimeIndicator />}
                    </div>

                    {/* Tasks column - drop zone for tasks */}
                    <DroppableDayColumn
                      date={day}
                      dateKey={dateKey}
                      hoverPreview={hoverPreview}
                    >
                      {/* Hour grid */}
                      {HOURS.map((hour) => (
                        <div
                          key={hour}
                          className="absolute left-0 right-0 border-b border-slate-800"
                          style={{ top: (hour - START_HOUR) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                        />
                      ))}

                      {/* Scheduled tasks */}
                      {dayTaskPositions.map(({ task, columnIndex, totalColumns }) => (
                        <TaskBlock
                          key={task.id}
                          task={task}
                          onComplete={onCompleteTask}
                          onUnschedule={onUnscheduleTask}
                          onDoubleClick={handleTaskDoubleClick}
                          columnIndex={columnIndex}
                          totalColumns={totalColumns}
                        />
                      ))}

                      {isToday(day) && <CurrentTimeIndicator />}
                    </DroppableDayColumn>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-4 py-2 bg-slate-800 border-t border-slate-700 text-[10px] text-slate-400">
          <span>Events:</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-purple-500" /> Meeting</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500" /> Class</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500" /> Personal</span>
          <span className="ml-4">Tasks:</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500" /> P4</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-orange-500" /> P3</span>
          <span className="ml-auto text-slate-500">Drag on Events to create · Drag tasks to schedule</span>
        </div>
      </div>

      {/* Time Indicator Tooltip - shows exact time during drag */}
      {dragPointerPosition && hoverPreview && (
        <div
          className="fixed bg-slate-900 text-white px-2 py-1 rounded text-xs font-medium shadow-lg border border-slate-600 pointer-events-none z-[1000]"
          style={{
            left: dragPointerPosition.x + 16,
            top: dragPointerPosition.y + 16,
          }}
        >
          {formatTime(hoverPreview.hour, hoverPreview.minute)}
        </div>
      )}

      {/* Event Creation Popup */}
      <EventPopup
        state={popup}
        backlogTasks={backlogTasks}
        onClose={() => setPopup(prev => ({ ...prev, isOpen: false }))}
        onCreateEvent={handleCreateEvent}
        onScheduleTask={handleScheduleTaskFromPopup}
        onTitleChange={(title) => setPopup(prev => ({ ...prev, title }))}
      />

      {/* Task Detail Modal */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetail}
      />
    </>
  );
}

export default PlanningCalendar;
export type { DragPosition };

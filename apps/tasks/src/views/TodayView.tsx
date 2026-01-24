import { useMemo, useEffect, useState } from 'react';
import { isPast, isToday, parseISO } from 'date-fns';
import { ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import {
  DndContext,
  closestCenter,
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
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TaskCard } from '../components/TaskCard';
import { InlineAddTask } from '../components/InlineAddTask';
import { useTodayTasks, useCompleteTask, useReorderTasks } from '../hooks/useTasks';
import type { Task } from '../api';

interface TodayViewProps {
  onSelectTask?: (task: Task) => void;
  selectedTaskId?: string | null;
  onTaskListUpdate?: (tasks: Task[]) => void;
}

interface SortableTaskCardProps {
  task: Task;
  onComplete: (id: string) => void;
  onSelect?: (task: Task) => void;
  isSelected?: boolean;
}

function SortableTaskCard({ task, onComplete, onSelect, isSelected }: SortableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard
        task={task}
        onComplete={onComplete}
        onSelect={onSelect}
        isSelected={isSelected}
      />
    </div>
  );
}

export function TodayView({ onSelectTask, selectedTaskId, onTaskListUpdate }: TodayViewProps) {
  const { data: tasks, isLoading } = useTodayTasks();
  const completeTask = useCompleteTask();
  const reorderMutation = useReorderTasks();
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const { overdue, scheduled, anytime, completed } = useMemo(() => {
    if (!tasks) return { overdue: [], scheduled: [], anytime: [], completed: [] };

    const overdue: Task[] = [];
    const scheduled: Task[] = [];
    const anytime: Task[] = [];
    const completed: Task[] = [];

    tasks.forEach((task) => {
      if (task.status === 'done') {
        completed.push(task);
      } else if (task.dueDate) {
        const dueDate = parseISO(task.dueDate);
        if (isPast(dueDate) && !isToday(dueDate)) {
          overdue.push(task);
        } else if (task.scheduledStart) {
          scheduled.push(task);
        } else {
          anytime.push(task);
        }
      } else {
        anytime.push(task);
      }
    });

    // Sort scheduled by time
    scheduled.sort((a, b) => {
      if (!a.scheduledStart || !b.scheduledStart) return 0;
      return new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime();
    });

    // Sort overdue by priority
    overdue.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Sort anytime by sortOrder, then by priority as fallback
    anytime.sort((a, b) => {
      const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return (b.priority || 0) - (a.priority || 0);
    });

    return { overdue, scheduled, anytime, completed };
  }, [tasks]);

  const visibleTasks = useMemo(
    () => [...overdue, ...scheduled, ...anytime, ...completed],
    [overdue, scheduled, anytime, completed]
  );

  useEffect(() => {
    onTaskListUpdate?.(visibleTasks);
  }, [onTaskListUpdate, visibleTasks]);

  const handleComplete = (id: string) => {
    completeTask.mutate(id);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = anytime.find((t) => t.id === active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over || active.id === over.id) return;

    const oldIndex = anytime.findIndex((t) => t.id === active.id);
    const newIndex = anytime.findIndex((t) => t.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = [...anytime];
      const [movedTask] = newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, movedTask);
      reorderMutation.mutate(newOrder.map((t) => t.id));
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const totalTasks = (tasks?.length || 0) - completed.length;
  const completedCount = completed.length;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress bar */}
      {totalTasks + completedCount > 0 && (
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{
                  width: `${(completedCount / (totalTasks + completedCount)) * 100}%`,
                }}
              />
            </div>
            <span className="text-sm text-gray-500">
              {completedCount}/{totalTasks + completedCount} done
            </span>
          </div>
        </div>
      )}

      {/* Overdue Section */}
      {overdue.length > 0 && (
        <section className="border-b border-gray-100">
          <div className="px-6 py-3 bg-red-50 flex items-center gap-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
            <h2 className="text-sm font-semibold text-red-700">
              Overdue ({overdue.length})
            </h2>
          </div>
          <div>
            {overdue.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onComplete={handleComplete}
                onSelect={onSelectTask}
                isSelected={selectedTaskId === task.id}
              />
            ))}
          </div>
        </section>
      )}

      {/* Scheduled Section */}
      {scheduled.length > 0 && (
        <section className="border-b border-gray-100">
          <div className="px-6 py-3 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">
              Scheduled ({scheduled.length})
            </h2>
          </div>
          <div>
            {scheduled.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onComplete={handleComplete}
                onSelect={onSelectTask}
                isSelected={selectedTaskId === task.id}
              />
            ))}
          </div>
        </section>
      )}

      {/* Anytime Section - Drag and Drop enabled */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <section className="border-b border-gray-100">
          {anytime.length > 0 && (
            <>
              <div className="px-6 py-3 bg-gray-50">
                <h2 className="text-sm font-semibold text-gray-700">
                  Anytime Today ({anytime.length})
                </h2>
              </div>
              <SortableContext
                items={anytime.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div>
                  {anytime.map((task) => (
                    <SortableTaskCard
                      key={task.id}
                      task={task}
                      onComplete={handleComplete}
                      onSelect={onSelectTask}
                      isSelected={selectedTaskId === task.id}
                    />
                  ))}
                </div>
              </SortableContext>
            </>
          )}
          <InlineAddTask
            status="today"
            placeholder="Add a task for today..."
          />
        </section>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeTask ? (
            <div className="bg-white border border-blue-500 rounded-lg shadow-lg p-3">
              <div className="font-medium text-sm text-gray-900">{activeTask.title}</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Completed Section */}
      {completed.length > 0 && (
        <section>
          <div className="px-6 py-3 bg-gray-50 flex items-center gap-2">
            <CheckCircleIcon className="w-5 h-5 text-green-500" />
            <h2 className="text-sm font-semibold text-gray-500">
              Completed ({completed.length})
            </h2>
          </div>
          <div>
            {completed.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onComplete={handleComplete}
                onSelect={onSelectTask}
                isSelected={selectedTaskId === task.id}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {totalTasks === 0 && completedCount === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircleIcon className="w-8 h-8 text-green-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">All caught up!</h3>
          <p className="text-gray-500">No tasks for today. Enjoy your free time!</p>
        </div>
      )}
    </div>
  );
}

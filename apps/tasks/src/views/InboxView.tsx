import { useMemo, useEffect, useState } from 'react';
import { InboxIcon, SparklesIcon } from '@heroicons/react/24/outline';
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
import { useTasks, useCompleteTask, useReorderTasks } from '../hooks/useTasks';
import type { Task } from '../api';

interface InboxViewProps {
  onSelectTask?: (task: Task) => void;
  selectedTaskId?: string | null;
  onTaskListUpdate?: (tasks: Task[]) => void;
}

interface SortableTaskCardProps {
  task: Task;
  index: number;
  onComplete: (id: string) => void;
  onSelect?: (task: Task) => void;
  isSelected?: boolean;
}

function SortableTaskCard({ task, index, onComplete, onSelect, isSelected }: SortableTaskCardProps) {
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
        index={index}
        onComplete={onComplete}
        onSelect={onSelect}
        isSelected={isSelected}
      />
    </div>
  );
}

export function InboxView({ onSelectTask, selectedTaskId, onTaskListUpdate }: InboxViewProps) {
  const { data: allTasks, isLoading } = useTasks();
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

  // Inbox = tasks without projects, due dates, or scheduled dates (unprocessed tasks)
  const tasks = useMemo(() => {
    if (!allTasks) return [];
    const inboxTasks = allTasks.filter(
      (task) =>
        task.status !== 'done' &&
        task.status !== 'archived' &&
        !task.projectId &&
        !task.dueDate &&
        !task.scheduledStart
    );
    // Sort by sortOrder, then by creation date as fallback
    return inboxTasks.sort((a, b) => {
      const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [allTasks]);

  useEffect(() => {
    onTaskListUpdate?.(tasks);
  }, [onTaskListUpdate, tasks]);

  const handleComplete = (id: string) => {
    completeTask.mutate(id);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over || active.id === over.id) return;

    const oldIndex = tasks.findIndex((t) => t.id === active.id);
    const newIndex = tasks.findIndex((t) => t.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = [...tasks];
      const [movedTask] = newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, movedTask);
      reorderMutation.mutate(newOrder.map((t) => t.id));
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <SparklesIcon className="w-8 h-8 text-blue-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">Inbox Zero!</h3>
          <p className="text-gray-500 max-w-sm">
            All tasks have been processed. Great job staying on top of things!
          </p>
        </div>
        <div className="border-t border-gray-100">
          <InlineAddTask
            status="inbox"
            placeholder="Add to inbox..."
          />
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div data-testid="inbox-view" className="max-w-3xl mx-auto">
        {/* Info banner */}
        <div data-testid="inbox-banner" className="px-6 py-4 bg-blue-50 border-b border-blue-100">
          <div className="flex items-start gap-3">
            <InboxIcon className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p data-testid="inbox-count" className="text-sm text-blue-800">
                <strong>{tasks.length} items</strong> waiting to be processed.
              </p>
              <p className="text-xs text-blue-600 mt-1">
                For each task, ask: "What's the next action?" Then schedule, delegate, or do it.
              </p>
            </div>
          </div>
        </div>

        {/* Task list */}
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <div data-testid="inbox-task-list">
            {tasks.map((task, index) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                index={index}
                onComplete={handleComplete}
                onSelect={onSelectTask}
                isSelected={selectedTaskId === task.id}
              />
            ))}
            <InlineAddTask
              status="inbox"
              placeholder="Add to inbox..."
            />
          </div>
        </SortableContext>

        {/* GTD tip */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-500 text-center">
            <strong>GTD Tip:</strong> Process items top-to-bottom. Don't skip around!
          </p>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeTask ? (
            <div className="bg-white border border-blue-500 rounded-lg shadow-lg p-3">
              <div className="font-medium text-sm text-gray-900">{activeTask.title}</div>
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}

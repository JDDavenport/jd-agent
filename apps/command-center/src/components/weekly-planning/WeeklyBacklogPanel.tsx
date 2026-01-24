/**
 * Weekly Backlog Panel
 *
 * Left panel showing tasks tagged with #weekly-backlog
 * Tasks can be:
 * - Reordered via drag-and-drop
 * - Dragged to calendar to schedule
 * - Added directly via quick-add form
 */

import { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCompleteTask, useCreateTask } from '../../hooks/useTasks';
import type { Task } from '../../types/task';

interface WeeklyBacklogPanelProps {
  tasks: Task[];
  isLoading: boolean;
}

interface DraggableTaskProps {
  task: Task;
}

// Priority colors
const PRIORITY_COLORS: Record<number, string> = {
  4: 'border-l-red-500',
  3: 'border-l-orange-500',
  2: 'border-l-yellow-500',
  1: 'border-l-blue-500',
  0: 'border-l-slate-500',
};

const PRIORITY_LABELS: Record<number, string> = {
  4: 'P4',
  3: 'P3',
  2: 'P2',
  1: 'P1',
  0: '',
};

function DraggableTask({ task }: DraggableTaskProps) {
  const completeMutation = useCompleteTask();

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

  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    completeMutation.mutate(task.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-slate-800 border border-slate-700 rounded-lg p-3 cursor-grab active:cursor-grabbing
        ${PRIORITY_COLORS[task.priority] || PRIORITY_COLORS[0]} border-l-4
        ${isDragging ? 'shadow-lg shadow-blue-500/20 ring-2 ring-blue-500' : 'hover:bg-slate-750 hover:border-slate-600'}`}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start gap-2">
        {/* Drag Handle */}
        <div className="flex-shrink-0 mt-1 text-slate-500">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </div>

        {/* Checkbox */}
        <button
          onClick={handleComplete}
          className="flex-shrink-0 w-4 h-4 mt-0.5 rounded-full border-2 border-slate-500 hover:border-blue-400 transition-colors"
          aria-label="Complete task"
        />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-white truncate">{task.title}</div>

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400">
            {task.priority > 0 && (
              <span className={`font-bold ${task.priority >= 3 ? 'text-red-400' : 'text-slate-400'}`}>
                {PRIORITY_LABELS[task.priority]}
              </span>
            )}
            {task.timeEstimateMinutes && (
              <span className="flex items-center gap-0.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {task.timeEstimateMinutes}m
              </span>
            )}
            {task.project && (
              <span className="bg-slate-700 px-1.5 py-0.5 rounded truncate max-w-[80px]">
                {task.project.name}
              </span>
            )}
            {task.context && (
              <span className="text-blue-400">@{task.context}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function WeeklyBacklogPanel({ tasks, isLoading }: WeeklyBacklogPanelProps) {
  const [isRapidAdding, setIsRapidAdding] = useState(false);
  const [rapidTaskTitle, setRapidTaskTitle] = useState('');
  const rapidInputRef = useRef<HTMLInputElement>(null);
  const createTaskMutation = useCreateTask();

  // Focus the input when rapid adding starts
  useEffect(() => {
    if (isRapidAdding && rapidInputRef.current) {
      rapidInputRef.current.focus();
    }
  }, [isRapidAdding]);

  const handleRapidAdd = async () => {
    if (!rapidTaskTitle.trim()) return;

    try {
      await createTaskMutation.mutateAsync({
        title: rapidTaskTitle.trim(),
        source: 'manual',
        context: 'planning',
        taskLabels: ['weekly-backlog'],
      });
      // Clear input but keep adding mode open for next task
      setRapidTaskTitle('');
      // Re-focus the input for next task
      setTimeout(() => rapidInputRef.current?.focus(), 0);
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const handleRapidKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRapidAdd();
    } else if (e.key === 'Escape') {
      setIsRapidAdding(false);
      setRapidTaskTitle('');
    }
  };

  const handleRapidBlur = () => {
    // Small delay to allow clicking elsewhere without immediately closing
    setTimeout(() => {
      if (!rapidTaskTitle.trim()) {
        setIsRapidAdding(false);
      }
    }, 150);
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 rounded-lg border border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700">
        <div>
          <h2 className="font-semibold text-white">Weekly Backlog</h2>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
          </p>
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="text-center text-slate-500 py-8">Loading...</div>
        ) : tasks.length === 0 && !isRapidAdding ? (
          <div className="text-center text-slate-500 py-8">
            <svg className="w-12 h-12 mx-auto mb-3 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm">No tasks in backlog</p>
            <p className="text-xs mt-1 text-slate-600">
              Click + below to add tasks
            </p>
          </div>
        ) : (
          <>
            {tasks.map((task) => <DraggableTask key={task.id} task={task} />)}
          </>
        )}

        {/* Rapid Add Input - shows below tasks */}
        {isRapidAdding && (
          <div className="mt-2">
            <input
              ref={rapidInputRef}
              type="text"
              value={rapidTaskTitle}
              onChange={(e) => setRapidTaskTitle(e.target.value)}
              onKeyDown={handleRapidKeyDown}
              onBlur={handleRapidBlur}
              placeholder="Type task and press Enter..."
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              disabled={createTaskMutation.isPending}
            />
            <p className="text-[10px] text-slate-500 mt-1 px-1">
              Press Enter to add, Esc to cancel
            </p>
          </div>
        )}

        {/* Add Button - always visible at bottom of list */}
        {!isRapidAdding && (
          <button
            onClick={() => setIsRapidAdding(true)}
            className="w-full mt-2 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border-2 border-dashed border-slate-700 text-slate-500 hover:border-blue-500 hover:text-blue-400 hover:bg-slate-800/50 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-xs font-medium">Add task</span>
          </button>
        )}
      </div>

      {/* Footer hint */}
      <div className="p-2 border-t border-slate-700 text-[10px] text-slate-500 text-center">
        Drag tasks to calendar to schedule
      </div>
    </div>
  );
}

export default WeeklyBacklogPanel;

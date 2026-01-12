import { useState } from 'react';
import { CheckCircleIcon, PlusIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import { clsx } from 'clsx';
import { useSubtasks, useCreateSubtask, useCompleteTask } from '../hooks/useTasks';
import type { CreateTaskInput } from '../api';

interface SubtaskListProps {
  parentTaskId: string;
  onComplete: (id: string) => void;
}

export function SubtaskList({ parentTaskId, onComplete }: SubtaskListProps) {
  const { data: subtasks, isLoading } = useSubtasks(parentTaskId);
  const createSubtask = useCreateSubtask();
  const completeTask = useCompleteTask();
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;

    const input: CreateTaskInput = {
      title: newSubtaskTitle.trim(),
      context: 'Work', // Will be overridden by parent's context on backend
      source: 'manual',
    };

    await createSubtask.mutateAsync({
      parentTaskId,
      input,
    });

    setNewSubtaskTitle('');
    setIsAddingSubtask(false);
  };

  const handleComplete = (subtaskId: string) => {
    completeTask.mutate(subtaskId);
    onComplete(subtaskId);
  };

  if (isLoading) {
    return (
      <div className="pl-12 pr-4 pb-3">
        <div className="animate-pulse flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-200 rounded-full" />
          <div className="h-4 bg-gray-200 rounded w-24" />
        </div>
      </div>
    );
  }

  return (
    <div className="pl-12 pr-4 pb-3 bg-gray-50/50">
      {/* Subtask items */}
      <div className="space-y-1">
        {subtasks?.map((subtask) => {
          const isCompleted = subtask.status === 'done';
          return (
            <div
              key={subtask.id}
              className={clsx(
                'flex items-center gap-2 py-1.5 px-2 rounded transition-colors',
                isCompleted ? 'opacity-50' : 'hover:bg-gray-100'
              )}
            >
              <button
                onClick={() => handleComplete(subtask.id)}
                className={clsx(
                  'flex-shrink-0 transition-colors',
                  isCompleted ? 'text-green-500' : 'text-gray-300 hover:text-gray-400'
                )}
              >
                {isCompleted ? (
                  <CheckCircleSolid className="w-4 h-4" />
                ) : (
                  <CheckCircleIcon className="w-4 h-4" />
                )}
              </button>
              <span
                className={clsx(
                  'text-sm',
                  isCompleted && 'line-through text-gray-400'
                )}
              >
                {subtask.title}
              </span>
            </div>
          );
        })}
      </div>

      {/* Add subtask input */}
      {isAddingSubtask ? (
        <form onSubmit={handleAddSubtask} className="mt-2">
          <div className="flex items-center gap-2">
            <PlusIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              placeholder="Add subtask..."
              className="flex-1 text-sm py-1 px-2 border border-gray-200 rounded focus:outline-none focus:border-blue-400"
              autoFocus
              onBlur={() => {
                if (!newSubtaskTitle.trim()) {
                  setIsAddingSubtask(false);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setNewSubtaskTitle('');
                  setIsAddingSubtask(false);
                }
              }}
            />
            <button
              type="submit"
              disabled={!newSubtaskTitle.trim() || createSubtask.isPending}
              className="text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setIsAddingSubtask(true)}
          className="mt-2 flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 py-1 px-2"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          Add subtask
        </button>
      )}
    </div>
  );
}

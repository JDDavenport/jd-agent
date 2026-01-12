import { useState } from 'react';
import {
  XMarkIcon,
  CalendarIcon,
  ClockIcon,
  FlagIcon,
  FolderIcon,
  ArrowPathIcon,
  TagIcon,
  ChatBubbleLeftIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { format, parseISO } from 'date-fns';
import { clsx } from 'clsx';
import type { Task } from '../api';
import { rruleToText } from '../utils/parseNaturalLanguage';
import { useUpdateTask } from '../hooks/useTasks';

interface TaskDetailPanelProps {
  task: Task | null;
  onClose: () => void;
}

const priorityLabels: Record<number, { label: string; color: string }> = {
  4: { label: 'Priority 1 (Urgent)', color: 'text-red-500' },
  3: { label: 'Priority 2 (High)', color: 'text-orange-500' },
  2: { label: 'Priority 3 (Medium)', color: 'text-yellow-500' },
  1: { label: 'Priority 4 (Low)', color: 'text-blue-500' },
  0: { label: 'No priority', color: 'text-gray-400' },
};

export function TaskDetailPanel({ task, onClose }: TaskDetailPanelProps) {
  const [description, setDescription] = useState(task?.description || '');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const updateTask = useUpdateTask();

  if (!task) return null;

  const priority = priorityLabels[task.priority] || priorityLabels[0];

  const handleSaveDescription = () => {
    if (description !== task.description) {
      updateTask.mutate({
        id: task.id,
        input: { description },
      });
    }
    setIsEditingDescription(false);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 truncate">{task.title}</h2>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Status */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 w-24">Status</span>
          <span className={clsx(
            'px-2 py-1 rounded text-sm font-medium',
            task.status === 'done' ? 'bg-green-100 text-green-700' :
            task.status === 'today' ? 'bg-blue-100 text-blue-700' :
            task.status === 'inbox' ? 'bg-gray-100 text-gray-700' :
            'bg-gray-100 text-gray-700'
          )}>
            {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
          </span>
        </div>

        {/* Due Date */}
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-5 h-5 text-gray-400" />
          <span className="text-sm text-gray-500 w-20">Due Date</span>
          <span className={clsx(
            'text-sm',
            task.dueDate ? 'text-gray-900' : 'text-gray-400 italic'
          )}>
            {task.dueDate
              ? format(parseISO(task.dueDate), 'EEEE, MMMM d, yyyy')
              : 'No due date'
            }
          </span>
        </div>

        {/* Scheduled Date/Time */}
        <div className="flex items-center gap-3">
          <ClockIcon className="w-5 h-5 text-gray-400" />
          <span className="text-sm text-gray-500 w-20">Scheduled</span>
          <span className={clsx(
            'text-sm',
            task.scheduledStart ? 'text-gray-900' : 'text-gray-400 italic'
          )}>
            {task.scheduledStart
              ? format(parseISO(task.scheduledStart), 'EEEE, MMMM d @ h:mm a')
              : 'Not scheduled'
            }
          </span>
        </div>

        {/* Recurrence */}
        {task.recurrenceRule && (
          <div className="flex items-center gap-3">
            <ArrowPathIcon className="w-5 h-5 text-purple-500" />
            <span className="text-sm text-gray-500 w-20">Repeats</span>
            <span className="text-sm text-purple-600">
              {rruleToText(task.recurrenceRule)}
            </span>
          </div>
        )}

        {/* Priority */}
        <div className="flex items-center gap-3">
          <FlagIcon className={clsx('w-5 h-5', priority.color)} />
          <span className="text-sm text-gray-500 w-20">Priority</span>
          <span className={clsx('text-sm', priority.color)}>
            {priority.label}
          </span>
        </div>

        {/* Project */}
        <div className="flex items-center gap-3">
          <FolderIcon className="w-5 h-5 text-gray-400" />
          <span className="text-sm text-gray-500 w-20">Project</span>
          <span className={clsx(
            'text-sm',
            task.projectId ? 'text-gray-900' : 'text-gray-400 italic'
          )}>
            {task.projectId ? 'In project' : 'No project'}
          </span>
        </div>

        {/* Context */}
        <div className="flex items-center gap-3">
          <TagIcon className="w-5 h-5 text-gray-400" />
          <span className="text-sm text-gray-500 w-20">Context</span>
          <span className="text-sm text-gray-900">
            {task.context || 'Personal'}
          </span>
        </div>

        {/* Time Estimate */}
        {task.timeEstimateMinutes && (
          <div className="flex items-center gap-3">
            <ClockIcon className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-500 w-20">Estimate</span>
            <span className="text-sm text-gray-900">
              {task.timeEstimateMinutes >= 60
                ? `${Math.floor(task.timeEstimateMinutes / 60)}h ${task.timeEstimateMinutes % 60}m`
                : `${task.timeEstimateMinutes}m`}
            </span>
          </div>
        )}

        {/* Description */}
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2 mb-2">
            <DocumentTextIcon className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Description</span>
          </div>
          {isEditingDescription ? (
            <div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
                placeholder="Add a description..."
                autoFocus
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleSaveDescription}
                  className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                >
                  Save
                </button>
                <button
                  onClick={() => {
                    setDescription(task.description || '');
                    setIsEditingDescription(false);
                  }}
                  className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setIsEditingDescription(true)}
              className={clsx(
                'p-2 rounded-lg text-sm cursor-pointer hover:bg-gray-50',
                task.description ? 'text-gray-700' : 'text-gray-400 italic'
              )}
            >
              {task.description || 'Click to add description...'}
            </div>
          )}
        </div>

        {/* Comments section placeholder */}
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2 mb-2">
            <ChatBubbleLeftIcon className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Comments</span>
          </div>
          <div className="text-sm text-gray-400 italic p-2">
            No comments yet
          </div>
        </div>

        {/* Created/Updated timestamps */}
        <div className="border-t border-gray-100 pt-4 text-xs text-gray-400 space-y-1">
          <p>Created: {format(parseISO(task.createdAt), 'MMM d, yyyy h:mm a')}</p>
          <p>Updated: {format(parseISO(task.updatedAt), 'MMM d, yyyy h:mm a')}</p>
          {task.completedAt && (
            <p>Completed: {format(parseISO(task.completedAt), 'MMM d, yyyy h:mm a')}</p>
          )}
        </div>
      </div>
    </div>
  );
}

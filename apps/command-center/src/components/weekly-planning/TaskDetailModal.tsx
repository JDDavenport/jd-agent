/**
 * Task Detail Modal
 *
 * Shows full task details when double-clicking a task in the calendar.
 * Displays all task metadata including description, dates, project, and more.
 */

import { useEffect, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import type { Task } from '../../types/task';

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
}

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  4: { label: 'Urgent (P4)', color: 'text-red-400 bg-red-500/20' },
  3: { label: 'High (P3)', color: 'text-orange-400 bg-orange-500/20' },
  2: { label: 'Medium (P2)', color: 'text-yellow-400 bg-yellow-500/20' },
  1: { label: 'Low (P1)', color: 'text-blue-400 bg-blue-500/20' },
  0: { label: 'None', color: 'text-slate-400 bg-slate-500/20' },
};

const STATUS_LABELS: Record<string, string> = {
  inbox: 'Inbox',
  today: 'Today',
  upcoming: 'Upcoming',
  waiting: 'Waiting',
  someday: 'Someday',
  done: 'Done',
  archived: 'Archived',
};

export function TaskDetailModal({ task, isOpen, onClose }: TaskDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !task) return null;

  const priority = PRIORITY_LABELS[task.priority] || PRIORITY_LABELS[0];
  const isCompleted = !!task.completedAt;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-detail-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-slate-700">
          <div className="flex-1 min-w-0 pr-4">
            <h2
              id="task-detail-title"
              className={`text-lg font-semibold text-white ${isCompleted ? 'line-through opacity-60' : ''}`}
            >
              {task.title}
            </h2>
            {task.project && (
              <div className="mt-1 text-sm text-slate-400">
                Project: <span className="text-blue-400">{task.project.name}</span>
              </div>
            )}
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close task details"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4">
          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            <span className={`px-2 py-1 rounded text-xs font-medium ${priority.color}`}>
              {priority.label}
            </span>
            <span className="px-2 py-1 rounded text-xs font-medium text-slate-300 bg-slate-700">
              {STATUS_LABELS[task.status] || task.status}
            </span>
            {isCompleted && (
              <span className="px-2 py-1 rounded text-xs font-medium text-green-400 bg-green-500/20">
                Completed
              </span>
            )}
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Description
              </h3>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">
                {task.description}
              </p>
            </div>
          )}

          {/* Schedule info */}
          {task.scheduledStart && (
            <div className="bg-slate-800 rounded-lg p-3">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Scheduled
              </h3>
              <div className="text-sm text-white">
                {format(parseISO(task.scheduledStart), 'EEEE, MMMM d, yyyy')}
              </div>
              <div className="text-sm text-slate-300">
                {format(parseISO(task.scheduledStart), 'h:mm a')}
                {task.scheduledEnd && (
                  <> - {format(parseISO(task.scheduledEnd), 'h:mm a')}</>
                )}
              </div>
            </div>
          )}

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3">
            {task.dueDate && (
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="text-xs text-slate-400 mb-1">Due Date</div>
                <div className="text-sm text-white">
                  {format(parseISO(task.dueDate), 'MMM d, yyyy')}
                  {task.dueDateIsHard && (
                    <span className="ml-1 text-red-400 text-xs">(hard)</span>
                  )}
                </div>
              </div>
            )}

            {task.timeEstimateMinutes && (
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="text-xs text-slate-400 mb-1">Time Estimate</div>
                <div className="text-sm text-white">
                  {task.timeEstimateMinutes >= 60
                    ? `${Math.floor(task.timeEstimateMinutes / 60)}h ${task.timeEstimateMinutes % 60}m`
                    : `${task.timeEstimateMinutes}m`}
                </div>
              </div>
            )}

            {task.context && (
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="text-xs text-slate-400 mb-1">Context</div>
                <div className="text-sm text-blue-400">@{task.context}</div>
              </div>
            )}

            {task.energyLevel && (
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="text-xs text-slate-400 mb-1">Energy Level</div>
                <div className="text-sm text-white capitalize">{task.energyLevel}</div>
              </div>
            )}

            {task.source && (
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="text-xs text-slate-400 mb-1">Source</div>
                <div className="text-sm text-white capitalize">{task.source}</div>
              </div>
            )}

            {task.waitingFor && (
              <div className="bg-slate-800 rounded-lg p-3">
                <div className="text-xs text-slate-400 mb-1">Waiting For</div>
                <div className="text-sm text-white">{task.waitingFor}</div>
              </div>
            )}
          </div>

          {/* Labels */}
          {task.taskLabels && task.taskLabels.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Labels
              </h3>
              <div className="flex flex-wrap gap-2">
                {task.taskLabels.map((label) => (
                  <span
                    key={label}
                    className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300"
                  >
                    #{label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="text-xs text-slate-500 pt-2 border-t border-slate-800 space-y-1">
            <div>Created: {format(parseISO(task.createdAt), 'MMM d, yyyy h:mm a')}</div>
            <div>Updated: {format(parseISO(task.updatedAt), 'MMM d, yyyy h:mm a')}</div>
            {task.completedAt && (
              <div>Completed: {format(parseISO(task.completedAt), 'MMM d, yyyy h:mm a')}</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-700 bg-slate-800/50">
          <p className="text-xs text-slate-500 text-center">
            Press <kbd className="px-1 py-0.5 bg-slate-700 border border-slate-600 rounded text-xs">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
}

export default TaskDetailModal;

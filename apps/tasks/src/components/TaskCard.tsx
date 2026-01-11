import { useState } from 'react';
import {
  CheckCircleIcon,
  ClockIcon,
  CalendarIcon,
  FlagIcon,
  EllipsisHorizontalIcon,
} from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid';
import { format, isToday, isTomorrow, isPast, isThisWeek } from 'date-fns';
import { clsx } from 'clsx';
import type { Task } from '../api';

interface TaskCardProps {
  task: Task;
  index?: number;
  onComplete: (id: string) => void;
  onSelect?: (task: Task) => void;
  onSchedule?: (task: Task) => void;
  showProject?: boolean;
}

const priorityConfig = {
  4: { color: 'text-red-500', bg: 'bg-red-500', label: 'P1' },
  3: { color: 'text-orange-500', bg: 'bg-orange-500', label: 'P2' },
  2: { color: 'text-yellow-500', bg: 'bg-yellow-500', label: 'P3' },
  1: { color: 'text-blue-400', bg: 'bg-blue-400', label: 'P4' },
  0: { color: 'text-gray-300', bg: 'bg-gray-300', label: '' },
};

const contextColors: Record<string, { bg: string; text: string }> = {
  Work: { bg: 'bg-blue-100', text: 'text-blue-700' },
  Personal: { bg: 'bg-green-100', text: 'text-green-700' },
  MBA: { bg: 'bg-purple-100', text: 'text-purple-700' },
  Health: { bg: 'bg-red-100', text: 'text-red-700' },
  School: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
  default: { bg: 'bg-gray-100', text: 'text-gray-700' },
};

export function TaskCard({
  task,
  index,
  onComplete,
  onSelect,
  onSchedule,
  showProject = true,
}: TaskCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isCompleted = task.status === 'done';
  const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate)) && !isCompleted;
  const priority = priorityConfig[task.priority as keyof typeof priorityConfig] || priorityConfig[0];
  const contextStyle = contextColors[task.context] || contextColors.default;

  const formatDueDate = (date: string) => {
    const d = new Date(date);
    if (isToday(d)) return 'Today';
    if (isTomorrow(d)) return 'Tomorrow';
    if (isThisWeek(d)) return format(d, 'EEEE');
    return format(d, 'MMM d');
  };

  const getDueDateColor = () => {
    if (!task.dueDate) return 'text-gray-400';
    const d = new Date(task.dueDate);
    if (isOverdue) return 'text-red-500';
    if (isToday(d)) return 'text-green-600';
    if (isTomorrow(d)) return 'text-orange-500';
    return 'text-gray-500';
  };

  return (
    <div
      data-testid={index !== undefined ? `task-card-${index}` : `task-card-${task.id}`}
      className={clsx(
        'group flex items-start gap-3 px-4 py-3 border-b border-gray-100 transition-all',
        isCompleted ? 'opacity-50' : 'hover:bg-gray-50',
        isOverdue && !isCompleted && 'bg-red-50/50'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Priority Flag + Checkbox */}
      <div className="flex items-center gap-1 pt-0.5">
        <button
          data-testid={index !== undefined ? `task-complete-${index}` : `task-complete-${task.id}`}
          onClick={() => onComplete(task.id)}
          className={clsx(
            'flex-shrink-0 transition-colors rounded-full',
            isCompleted
              ? 'text-green-500'
              : task.priority > 0
                ? priority.color
                : 'text-gray-300 hover:text-gray-400'
          )}
        >
          {isCompleted ? (
            <CheckCircleSolid className="w-5 h-5" />
          ) : (
            <CheckCircleIcon className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0" onClick={() => onSelect?.(task)}>
        <div className="flex items-start gap-2">
          <h3
            className={clsx(
              'text-sm font-medium cursor-pointer',
              isCompleted && 'line-through text-gray-400'
            )}
          >
            {task.title}
          </h3>
        </div>

        {/* Description */}
        {task.description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{task.description}</p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {/* Due Date */}
          {task.dueDate && (
            <span
              className={clsx(
                'flex items-center gap-1 text-xs',
                getDueDateColor()
              )}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              {formatDueDate(task.dueDate)}
              {isOverdue && <span className="font-medium">(Overdue)</span>}
            </span>
          )}

          {/* Time estimate */}
          {task.timeEstimateMinutes && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <ClockIcon className="w-3.5 h-3.5" />
              {task.timeEstimateMinutes >= 60
                ? `${Math.floor(task.timeEstimateMinutes / 60)}h ${task.timeEstimateMinutes % 60}m`
                : `${task.timeEstimateMinutes}m`}
            </span>
          )}

          {/* Context badge */}
          {showProject && task.context && (
            <span
              className={clsx(
                'px-2 py-0.5 rounded-full text-xs font-medium',
                contextStyle.bg,
                contextStyle.text
              )}
            >
              {task.context}
            </span>
          )}

          {/* @contexts (GTD) */}
          {task.taskContexts && task.taskContexts.length > 0 && (
            <div className="flex gap-1">
              {task.taskContexts.map((ctx) => (
                <span
                  key={ctx}
                  className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded"
                >
                  {ctx}
                </span>
              ))}
            </div>
          )}

          {/* Labels */}
          {task.taskLabels && task.taskLabels.length > 0 && (
            <div className="flex gap-1">
              {task.taskLabels.slice(0, 2).map((label) => (
                <span
                  key={label}
                  className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded"
                >
                  #{label}
                </span>
              ))}
              {task.taskLabels.length > 2 && (
                <span className="text-xs text-gray-400">+{task.taskLabels.length - 2}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Priority indicator (right side) */}
      {task.priority > 0 && (
        <div className="flex-shrink-0 pt-0.5">
          <FlagIcon className={clsx('w-4 h-4', priority.color)} />
        </div>
      )}

      {/* Actions (on hover) */}
      {isHovered && !isCompleted && (
        <div className="flex-shrink-0 flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSchedule?.(task);
            }}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
            title="Schedule"
          >
            <CalendarIcon className="w-4 h-4" />
          </button>
          <button
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
            title="More actions"
          >
            <EllipsisHorizontalIcon className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

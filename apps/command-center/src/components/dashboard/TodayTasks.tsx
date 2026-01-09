/**
 * TodayTasks - Enhanced (Phase 2)
 *
 * Displays today's tasks grouped by priority with:
 * - Overdue section (red)
 * - High/Medium/Low priority sections (collapsible)
 * - Project tags
 * - Time estimates
 * - Quick completion toggle
 */

import { useState } from 'react';
import { useGroupedTodayTasks } from '../../hooks/useDashboardEnhanced';
import { useCompleteTask } from '../../hooks/useTasks';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';
import { CollapsibleSection, PriorityBadge, SourceBadge, ProgressBar } from './shared';
import type { TaskWithProject } from '../../types/dashboard';

interface TaskItemProps {
  task: TaskWithProject;
  onComplete: (id: string) => void;
  isPending: boolean;
}

function TaskItem({ task, onComplete, isPending }: TaskItemProps) {
  const isCompleted = task.status === 'done';

  return (
    <div
      className={`flex items-start space-x-3 p-3 rounded-lg transition-colors group ${
        isCompleted
          ? 'bg-dark-border/30 opacity-60'
          : 'bg-dark-bg hover:bg-dark-card-hover'
      }`}
    >
      <input
        type="checkbox"
        checked={isCompleted}
        onChange={() => !isCompleted && onComplete(task.id)}
        className="mt-1 w-5 h-5 rounded border-2 border-dark-border checked:border-accent checked:bg-accent focus:ring-2 focus:ring-accent-glow transition-all cursor-pointer"
        disabled={isPending || isCompleted}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3
            className={`font-medium transition-colors ${
              isCompleted
                ? 'line-through text-text-muted'
                : 'text-text group-hover:text-accent'
            }`}
          >
            {task.title}
          </h3>
          {task.project && (
            <span className="text-xs px-1.5 py-0.5 bg-accent/20 text-accent rounded">
              {task.project.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-text-muted">
          <SourceBadge source={task.source} />
          {task.context && <span>@{task.context}</span>}
          {task.timeEstimateMinutes && (
            <span className="flex items-center gap-1">
              <span>~{task.timeEstimateMinutes}m</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function TodayTasks() {
  const { data: grouped, isLoading, error } = useGroupedTodayTasks();
  const completeTask = useCompleteTask();
  const [showCompleted, setShowCompleted] = useState(false);

  const handleComplete = async (taskId: string) => {
    await completeTask.mutateAsync(taskId);
  };

  if (isLoading) {
    return (
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Today's Tasks</h2>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Today's Tasks</h2>
        <p className="text-error">Failed to load tasks: {error.message}</p>
      </div>
    );
  }

  const totalActive = grouped?.stats.total || 0;
  const totalCompleted = grouped?.stats.completed || 0;
  const completionRate = totalActive + totalCompleted > 0
    ? Math.round((totalCompleted / (totalActive + totalCompleted)) * 100)
    : 0;

  const hasOverdue = (grouped?.overdue.length || 0) > 0;
  const hasHigh = (grouped?.high.length || 0) > 0;
  const hasMedium = (grouped?.medium.length || 0) > 0;
  const hasLow = (grouped?.low.length || 0) > 0;
  const hasNoPriority = (grouped?.noPriority.length || 0) > 0;
  const hasAnyTasks = totalActive > 0 || totalCompleted > 0;

  // Format time estimate
  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Today's Tasks</h2>
          {grouped?.stats.totalMinutes ? (
            <p className="text-xs text-text-muted mt-0.5">
              {formatTime(grouped.stats.totalMinutes)} estimated
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-muted">
            {totalCompleted}/{totalActive + totalCompleted}
          </span>
          <span className="badge badge-neutral">{completionRate}%</span>
        </div>
      </div>

      {/* Progress Bar */}
      {hasAnyTasks && (
        <div className="mb-4">
          <ProgressBar
            value={completionRate}
            color={
              completionRate >= 80
                ? 'bg-success'
                : completionRate >= 50
                ? 'bg-warning'
                : 'bg-accent'
            }
            size="sm"
          />
        </div>
      )}

      {/* Task Groups */}
      {!hasAnyTasks ? (
        <EmptyState
          icon="📋"
          title="No tasks for today"
          description="Add some tasks or check your inbox"
        />
      ) : totalActive === 0 && totalCompleted > 0 ? (
        <EmptyState
          icon="✅"
          title="All done for today!"
          description={`You've completed ${totalCompleted} task${totalCompleted !== 1 ? 's' : ''}. Great job!`}
        />
      ) : (
        <div className="space-y-4">
          {/* Overdue Section */}
          {hasOverdue && (
            <CollapsibleSection
              title="Overdue"
              count={grouped!.overdue.length}
              headerColor="text-error"
              icon={<span className="text-error">!</span>}
            >
              {grouped!.overdue.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onComplete={handleComplete}
                  isPending={completeTask.isPending}
                />
              ))}
            </CollapsibleSection>
          )}

          {/* High Priority */}
          {hasHigh && (
            <CollapsibleSection
              title="High Priority"
              count={grouped!.high.length}
              headerColor="text-error"
            >
              {grouped!.high.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onComplete={handleComplete}
                  isPending={completeTask.isPending}
                />
              ))}
            </CollapsibleSection>
          )}

          {/* Medium Priority */}
          {hasMedium && (
            <CollapsibleSection
              title="Medium Priority"
              count={grouped!.medium.length}
              headerColor="text-warning"
            >
              {grouped!.medium.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onComplete={handleComplete}
                  isPending={completeTask.isPending}
                />
              ))}
            </CollapsibleSection>
          )}

          {/* Low Priority */}
          {hasLow && (
            <CollapsibleSection
              title="Low Priority"
              count={grouped!.low.length}
              defaultOpen={!hasHigh && !hasMedium}
            >
              {grouped!.low.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onComplete={handleComplete}
                  isPending={completeTask.isPending}
                />
              ))}
            </CollapsibleSection>
          )}

          {/* No Priority */}
          {hasNoPriority && (
            <CollapsibleSection
              title="No Priority"
              count={grouped!.noPriority.length}
              defaultOpen={!hasHigh && !hasMedium && !hasLow}
            >
              {grouped!.noPriority.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onComplete={handleComplete}
                  isPending={completeTask.isPending}
                />
              ))}
            </CollapsibleSection>
          )}

          {/* Completed (toggle) */}
          {totalCompleted > 0 && (
            <div className="pt-2 border-t border-dark-border">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="text-sm text-text-muted hover:text-text transition-colors"
              >
                {showCompleted ? 'Hide' : 'Show'} {totalCompleted} completed
              </button>
              {showCompleted && (
                <div className="mt-2 space-y-1 opacity-60">
                  {grouped!.completed.map((task) => (
                    <TaskItem
                      key={task.id}
                      task={task}
                      onComplete={handleComplete}
                      isPending={completeTask.isPending}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TodayTasks;

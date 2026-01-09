/**
 * DeadlineWidget - Enhanced (Phase 2)
 *
 * Displays upcoming deadlines grouped by urgency with:
 * - Overdue section (red)
 * - Today section (amber)
 * - This Week / Next Week / Later sections
 * - Source badges
 * - Project tags
 * - Days until indicator
 */

import { useGroupedDeadlines } from '../../hooks/useDashboardEnhanced';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';
import { CollapsibleSection, SourceBadge, PriorityBadge } from './shared';
import type { DeadlineTask } from '../../types/dashboard';
import { format, parseISO } from 'date-fns';

interface DeadlineItemProps {
  task: DeadlineTask;
}

function DeadlineItem({ task }: DeadlineItemProps) {
  const getUrgencyColor = (daysUntil: number) => {
    if (daysUntil < 0) return 'text-error';
    if (daysUntil === 0) return 'text-warning';
    if (daysUntil <= 3) return 'text-accent';
    return 'text-text-muted';
  };

  const formatDaysUntil = (days: number) => {
    if (days < 0) return `${Math.abs(days)}d overdue`;
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `${days}d`;
  };

  return (
    <div className="flex items-start justify-between p-3 bg-dark-bg rounded-lg hover:bg-dark-card-hover transition-colors group">
      <div className="flex-1 min-w-0 mr-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-medium text-text group-hover:text-accent transition-colors truncate">
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
          <PriorityBadge priority={task.priority} />
        </div>
      </div>

      <div className="flex flex-col items-end shrink-0">
        <div className={`text-sm font-semibold ${getUrgencyColor(task.daysUntil)}`}>
          {formatDaysUntil(task.daysUntil)}
        </div>
        <div className="text-xs text-text-muted mt-1">
          {format(parseISO(task.dueDate), 'MMM d')}
        </div>
      </div>
    </div>
  );
}

function DeadlineWidget() {
  const { data: grouped, isLoading, error } = useGroupedDeadlines();

  if (isLoading) {
    return (
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Upcoming Deadlines</h2>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Upcoming Deadlines</h2>
        <p className="text-error">Failed to load deadlines: {error.message}</p>
      </div>
    );
  }

  const hasOverdue = (grouped?.overdue.length || 0) > 0;
  const hasToday = (grouped?.today.length || 0) > 0;
  const hasThisWeek = (grouped?.thisWeek.length || 0) > 0;
  const hasNextWeek = (grouped?.nextWeek.length || 0) > 0;
  const hasLater = (grouped?.later.length || 0) > 0;
  const totalDeadlines = grouped?.stats.total || 0;

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Upcoming Deadlines</h2>
          {(grouped?.stats.urgent || 0) > 0 && (
            <p className="text-xs text-warning mt-0.5">
              {grouped!.stats.urgent} due within 3 days
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(grouped?.stats.overdue || 0) > 0 && (
            <span className="badge badge-error text-xs">
              {grouped!.stats.overdue} overdue
            </span>
          )}
          <span className="badge badge-neutral">{totalDeadlines}</span>
        </div>
      </div>

      {/* Deadline Groups */}
      {totalDeadlines === 0 ? (
        <EmptyState
          icon="🎯"
          title="No upcoming deadlines"
          description="You're all caught up for the next 2 weeks!"
        />
      ) : (
        <div className="space-y-4">
          {/* Overdue */}
          {hasOverdue && (
            <CollapsibleSection
              title="Overdue"
              count={grouped!.overdue.length}
              headerColor="text-error"
              icon={<span className="text-error">!</span>}
            >
              {grouped!.overdue.map((task) => (
                <DeadlineItem key={task.id} task={task} />
              ))}
            </CollapsibleSection>
          )}

          {/* Today */}
          {hasToday && (
            <CollapsibleSection
              title="Due Today"
              count={grouped!.today.length}
              headerColor="text-warning"
            >
              {grouped!.today.map((task) => (
                <DeadlineItem key={task.id} task={task} />
              ))}
            </CollapsibleSection>
          )}

          {/* This Week */}
          {hasThisWeek && (
            <CollapsibleSection
              title="This Week"
              count={grouped!.thisWeek.length}
              headerColor="text-accent"
            >
              {grouped!.thisWeek.map((task) => (
                <DeadlineItem key={task.id} task={task} />
              ))}
            </CollapsibleSection>
          )}

          {/* Next Week */}
          {hasNextWeek && (
            <CollapsibleSection
              title="Next Week"
              count={grouped!.nextWeek.length}
              defaultOpen={!hasOverdue && !hasToday && !hasThisWeek}
            >
              {grouped!.nextWeek.map((task) => (
                <DeadlineItem key={task.id} task={task} />
              ))}
            </CollapsibleSection>
          )}

          {/* Later */}
          {hasLater && (
            <CollapsibleSection
              title="Later"
              count={grouped!.later.length}
              defaultOpen={!hasOverdue && !hasToday && !hasThisWeek && !hasNextWeek}
            >
              {grouped!.later.map((task) => (
                <DeadlineItem key={task.id} task={task} />
              ))}
            </CollapsibleSection>
          )}
        </div>
      )}
    </div>
  );
}

export default DeadlineWidget;

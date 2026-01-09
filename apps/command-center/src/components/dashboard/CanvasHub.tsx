/**
 * CanvasHub - Phase 3
 *
 * Displays Canvas LMS data including:
 * - Today's class schedule
 * - Upcoming assignments (next 7 days)
 * - Missing submissions alert
 * - Next class countdown
 */

import { useCanvasHub } from '../../hooks/useDashboardEnhanced';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';
import { format, parseISO } from 'date-fns';
import type { CanvasAssignment, CanvasClass } from '../../types/dashboard';

function ClassItem({ classItem }: { classItem: CanvasClass }) {
  return (
    <div className="flex items-center justify-between p-2 bg-dark-bg rounded-lg">
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-text text-sm truncate">{classItem.name}</h4>
        {classItem.location && (
          <p className="text-xs text-text-muted truncate">{classItem.location}</p>
        )}
      </div>
      <span className="text-xs text-accent ml-2 shrink-0">
        {format(parseISO(classItem.time), 'h:mm a')}
      </span>
    </div>
  );
}

function AssignmentItem({ assignment }: { assignment: CanvasAssignment }) {
  const getUrgencyColor = (daysUntil: number, isOverdue: boolean) => {
    if (isOverdue) return 'text-error';
    if (daysUntil === 0) return 'text-warning';
    if (daysUntil <= 2) return 'text-accent';
    return 'text-text-muted';
  };

  const formatDaysUntil = (days: number, isOverdue: boolean) => {
    if (isOverdue) return `${Math.abs(days)}d overdue`;
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `${days}d`;
  };

  return (
    <div className="flex items-start justify-between p-2 bg-dark-bg rounded-lg group hover:bg-dark-card-hover transition-colors">
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-text text-sm truncate group-hover:text-accent transition-colors">
          {assignment.title}
        </h4>
        <p className="text-xs text-text-muted truncate">{assignment.courseName}</p>
      </div>
      <div className="flex flex-col items-end shrink-0 ml-2">
        <span className={`text-xs font-semibold ${getUrgencyColor(assignment.daysUntil, assignment.isOverdue)}`}>
          {formatDaysUntil(assignment.daysUntil, assignment.isOverdue)}
        </span>
        <span className="text-[10px] text-text-muted">
          {format(parseISO(assignment.dueDate), 'MMM d')}
        </span>
      </div>
    </div>
  );
}

function CanvasHub() {
  const { data, isLoading, error } = useCanvasHub();

  if (isLoading) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Canvas</h2>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Canvas</h2>
        <p className="text-error text-sm">Failed to load Canvas data</p>
      </div>
    );
  }

  const hasClasses = (data?.todaysClasses.length || 0) > 0;
  const hasAssignments = (data?.upcomingAssignments.length || 0) > 0;
  const hasMissing = (data?.missingSubmissions || 0) > 0;

  // Format next class countdown
  const formatCountdown = (minutes: number) => {
    if (minutes < 0) return 'In progress';
    if (minutes < 60) return `in ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `in ${hours}h ${mins}m` : `in ${hours}h`;
  };

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎓</span>
          <h2 className="text-lg font-semibold">Canvas</h2>
        </div>
        {hasMissing && (
          <span className="badge badge-error text-xs">
            {data!.missingSubmissions} missing
          </span>
        )}
      </div>

      {/* Next Class Alert */}
      {data?.nextClass && (
        <div className="mb-4 p-3 bg-accent/10 border border-accent/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-accent font-medium">Next Class</p>
              <p className="text-sm text-text font-semibold">{data.nextClass.name}</p>
              {data.nextClass.location && (
                <p className="text-xs text-text-muted">{data.nextClass.location}</p>
              )}
            </div>
            <span className="text-accent font-bold">
              {formatCountdown(data.nextClass.startsIn)}
            </span>
          </div>
        </div>
      )}

      {/* Today's Classes */}
      <div className="mb-4">
        <h3 className="text-sm font-medium text-text-muted mb-2">Today's Classes</h3>
        {hasClasses ? (
          <div className="space-y-2">
            {data!.todaysClasses.map((classItem) => (
              <ClassItem key={classItem.id} classItem={classItem} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-text-muted">No classes today</p>
        )}
      </div>

      {/* Upcoming Assignments */}
      <div>
        <h3 className="text-sm font-medium text-text-muted mb-2">Upcoming Assignments</h3>
        {hasAssignments ? (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {data!.upcomingAssignments.slice(0, 5).map((assignment) => (
              <AssignmentItem key={assignment.id} assignment={assignment} />
            ))}
            {data!.upcomingAssignments.length > 5 && (
              <p className="text-xs text-text-muted text-center pt-1">
                +{data!.upcomingAssignments.length - 5} more
              </p>
            )}
          </div>
        ) : (
          <EmptyState
            icon="📝"
            title="No upcoming assignments"
            description="You're all caught up!"
          />
        )}
      </div>
    </div>
  );
}

export default CanvasHub;

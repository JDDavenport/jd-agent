/**
 * WeekCalendar - Enhanced (Phase 2)
 *
 * Displays weekly calendar with:
 * - Density heatmap (background color by event count)
 * - Workload indicators (light/moderate/heavy)
 * - Click day to expand events
 * - Time allocation breakdown
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWeekOverview } from '../../hooks/useDashboardEnhanced';
import LoadingSpinner from '../common/LoadingSpinner';
import { WorkloadIndicator, ProgressBar } from './shared';
import { format, parseISO, isSameDay } from 'date-fns';
import type { WeekDay, WeekDayEvent } from '../../types/dashboard';

interface DayCardProps {
  day: WeekDay;
  isToday: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

function DayCard({ day, isToday, isExpanded, onToggle }: DayCardProps) {
  // Density-based background color
  const getDensityBackground = (density: number) => {
    if (density === 0) return 'bg-dark-bg';
    if (density <= 2) return 'bg-accent/5';
    if (density <= 4) return 'bg-accent/10';
    if (density <= 6) return 'bg-accent/15';
    return 'bg-accent/20';
  };

  const getEventTypeColor = (eventType: string | null) => {
    switch (eventType?.toLowerCase()) {
      case 'meeting':
        return 'border-purple-400';
      case 'class':
        return 'border-blue-400';
      case 'personal':
        return 'border-green-400';
      case 'focus':
        return 'border-yellow-400';
      default:
        return 'border-accent';
    }
  };

  return (
    <div
      onClick={onToggle}
      className={`p-3 rounded-lg border cursor-pointer transition-all ${
        isToday
          ? 'border-accent ring-1 ring-accent/30'
          : 'border-dark-border hover:border-dark-border/80'
      } ${getDensityBackground(day.density)}`}
    >
      {/* Day Header */}
      <div className="text-center mb-2">
        <div className="text-xs text-text-muted uppercase">{day.dayName}</div>
        <div
          className={`text-lg font-semibold ${
            isToday ? 'text-accent' : 'text-text'
          }`}
        >
          {format(parseISO(day.date), 'd')}
        </div>
      </div>

      {/* Workload Indicator */}
      <div className="flex justify-center mb-2">
        <WorkloadIndicator level={day.workloadLevel} />
      </div>

      {/* Event Summary or Expanded View */}
      {isExpanded ? (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {day.events.length === 0 ? (
            <div className="text-xs text-text-muted text-center py-2">
              No events
            </div>
          ) : (
            day.events.map((event) => (
              <EventItem key={event.id} event={event} typeColor={getEventTypeColor(event.eventType)} />
            ))
          )}
        </div>
      ) : (
        <div className="space-y-1">
          {day.events.slice(0, 2).map((event) => (
            <div
              key={event.id}
              className={`text-xs p-1.5 bg-dark-card rounded border-l-2 ${getEventTypeColor(event.eventType)} truncate`}
              title={event.title}
            >
              <div className="font-medium text-text truncate">{event.title}</div>
              <div className="text-text-muted">
                {format(parseISO(event.startTime), 'h:mm a')}
              </div>
            </div>
          ))}
          {day.events.length > 2 && (
            <div className="text-xs text-text-muted text-center">
              +{day.events.length - 2} more
            </div>
          )}
          {day.taskCount > 0 && (
            <div className="text-xs text-accent/70 text-center mt-1">
              {day.taskCount} task{day.taskCount !== 1 ? 's' : ''} due
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface EventItemProps {
  event: WeekDayEvent;
  typeColor: string;
}

function EventItem({ event, typeColor }: EventItemProps) {
  return (
    <div
      className={`text-xs p-1.5 bg-dark-card rounded border-l-2 ${typeColor}`}
      title={event.title}
    >
      <div className="font-medium text-text truncate">{event.title}</div>
      <div className="text-text-muted flex items-center gap-1">
        <span>{format(parseISO(event.startTime), 'h:mm a')}</span>
        {event.endTime && (
          <>
            <span>-</span>
            <span>{format(parseISO(event.endTime), 'h:mm a')}</span>
          </>
        )}
      </div>
    </div>
  );
}

function WeekCalendar() {
  const { data: overview, isLoading, error } = useWeekOverview();
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const today = new Date();

  if (isLoading) {
    return (
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">This Week</h2>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">This Week</h2>
        <p className="text-error">Failed to load calendar: {error.message}</p>
      </div>
    );
  }

  const handleToggleDay = (date: string) => {
    setExpandedDay(expandedDay === date ? null : date);
  };

  // Calculate time allocation percentages
  const totalAllocation =
    (overview?.timeAllocation.meetings || 0) +
    (overview?.timeAllocation.classes || 0) +
    (overview?.timeAllocation.focus || 0) +
    (overview?.timeAllocation.personal || 0);

  const getAllocationPercent = (value: number) =>
    totalAllocation > 0 ? Math.round((value / totalAllocation) * 100) : 0;

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">This Week</h2>
          <p className="text-xs text-text-muted mt-0.5">
            {overview?.totalEvents || 0} events, {overview?.totalTasks || 0} tasks
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <span className="w-2 h-2 rounded-full bg-success" /> Light
            </span>
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <span className="w-2 h-2 rounded-full bg-warning" /> Moderate
            </span>
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <span className="w-2 h-2 rounded-full bg-error" /> Heavy
            </span>
          </div>
          <Link
            to="/calendar"
            className="text-xs text-accent hover:text-accent-light transition-colors flex items-center gap-1"
          >
            View Full Calendar
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Week Grid */}
      <div className="grid grid-cols-7 gap-2 mb-4">
        {overview?.days.map((day) => (
          <DayCard
            key={day.date}
            day={day}
            isToday={isSameDay(parseISO(day.date), today)}
            isExpanded={expandedDay === day.date}
            onToggle={() => handleToggleDay(day.date)}
          />
        ))}
      </div>

      {/* Time Allocation Breakdown */}
      {totalAllocation > 0 && (
        <div className="pt-4 border-t border-dark-border">
          <h3 className="text-sm font-medium text-text-muted mb-3">
            Time Allocation
          </h3>
          <div className="grid grid-cols-4 gap-3">
            <TimeAllocationBar
              label="Meetings"
              value={overview?.timeAllocation.meetings || 0}
              percent={getAllocationPercent(overview?.timeAllocation.meetings || 0)}
              color="bg-purple-400"
            />
            <TimeAllocationBar
              label="Classes"
              value={overview?.timeAllocation.classes || 0}
              percent={getAllocationPercent(overview?.timeAllocation.classes || 0)}
              color="bg-blue-400"
            />
            <TimeAllocationBar
              label="Focus"
              value={overview?.timeAllocation.focus || 0}
              percent={getAllocationPercent(overview?.timeAllocation.focus || 0)}
              color="bg-yellow-400"
            />
            <TimeAllocationBar
              label="Personal"
              value={overview?.timeAllocation.personal || 0}
              percent={getAllocationPercent(overview?.timeAllocation.personal || 0)}
              color="bg-green-400"
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface TimeAllocationBarProps {
  label: string;
  value: number;
  percent: number;
  color: string;
}

function TimeAllocationBar({ label, value, percent, color }: TimeAllocationBarProps) {
  const formatMinutes = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-text-muted">{label}</span>
        <span className="text-text">{formatMinutes(value)}</span>
      </div>
      <ProgressBar value={percent} color={color} size="sm" />
    </div>
  );
}

export default WeekCalendar;

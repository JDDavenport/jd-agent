/**
 * Homework Hub Widget
 *
 * Canvas Complete Phase 4: Dashboard widget showing homework status
 * - Due today with urgency indicators
 * - Due this week
 * - Readings due
 * - Progress tracking
 */

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  useHomeworkHub,
  type HomeworkItem,
  type ReadingItem,
  getUrgencyColors,
  getStatusInfo,
  formatTimeEstimate,
  formatHoursUntilDue,
  getProgressColor,
} from '../../hooks/useHomeworkHub';

interface HomeworkHubWidgetProps {
  onOpenAssignment?: (item: HomeworkItem) => void;
  onOpenReading?: (item: ReadingItem) => void;
  compact?: boolean;
}

export function HomeworkHubWidget({
  onOpenAssignment,
  onOpenReading,
  compact = false,
}: HomeworkHubWidgetProps) {
  const { data, isLoading, error } = useHomeworkHub();
  const [expandedSection, setExpandedSection] = useState<string | null>('dueToday');

  if (isLoading) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">📚</span>
          <h3 className="text-lg font-semibold text-white">Homework Hub</h3>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">📚</span>
          <h3 className="text-lg font-semibold text-white">Homework Hub</h3>
        </div>
        <div className="text-red-400 text-sm">Failed to load homework data</div>
      </div>
    );
  }

  if (!data) return null;

  const { dueToday, dueThisWeek, upcoming, readingsDue, summary } = data;
  const hasHomework = dueToday.length > 0 || dueThisWeek.length > 0 || upcoming.length > 0;

  // Compact mode for smaller widgets
  if (compact) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📚</span>
            <h3 className="text-lg font-semibold text-white">Homework</h3>
          </div>
          {summary.criticalCount > 0 && (
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-medium rounded-full">
              {summary.criticalCount} urgent
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-2xl font-bold text-white">{summary.dueTodayCount}</div>
            <div className="text-xs text-slate-400">Due Today</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{summary.dueThisWeekCount}</div>
            <div className="text-xs text-slate-400">This Week</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{summary.unreadReadingsCount}</div>
            <div className="text-xs text-slate-400">Readings</div>
          </div>
        </div>

        {summary.totalEstimatedMinutesToday > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-700 text-center">
            <span className="text-slate-400 text-sm">
              ~{formatTimeEstimate(summary.totalEstimatedMinutesToday)} of work today
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-xl">📚</span>
          <h3 className="text-lg font-semibold text-white">Homework Hub</h3>
        </div>
        <div className="flex items-center gap-2">
          {summary.criticalCount > 0 && (
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-medium rounded-full animate-pulse">
              {summary.criticalCount} urgent
            </span>
          )}
          <span className="text-sm text-slate-400">
            {formatTimeEstimate(summary.totalEstimatedMinutesWeek)} this week
          </span>
        </div>
      </div>

      {!hasHomework && readingsDue.length === 0 ? (
        <div className="p-8 text-center">
          <div className="text-4xl mb-2">🎉</div>
          <div className="text-white font-medium">All caught up!</div>
          <div className="text-slate-400 text-sm">No homework due</div>
        </div>
      ) : (
        <div className="divide-y divide-slate-700/50">
          {/* Due Today Section */}
          {dueToday.length > 0 && (
            <Section
              title="Due Today"
              icon="⚠️"
              count={dueToday.length}
              expanded={expandedSection === 'dueToday'}
              onToggle={() => setExpandedSection(expandedSection === 'dueToday' ? null : 'dueToday')}
              urgent
            >
              {dueToday.map((item) => (
                <HomeworkItemCard
                  key={item.id}
                  item={item}
                  onClick={() => onOpenAssignment?.(item)}
                />
              ))}
            </Section>
          )}

          {/* Due This Week Section */}
          {dueThisWeek.length > 0 && (
            <Section
              title="Due This Week"
              icon="📅"
              count={dueThisWeek.length}
              expanded={expandedSection === 'dueThisWeek'}
              onToggle={() => setExpandedSection(expandedSection === 'dueThisWeek' ? null : 'dueThisWeek')}
            >
              {dueThisWeek.map((item) => (
                <HomeworkItemCard
                  key={item.id}
                  item={item}
                  onClick={() => onOpenAssignment?.(item)}
                />
              ))}
            </Section>
          )}

          {/* Readings Due Section */}
          {readingsDue.length > 0 && (
            <Section
              title="Readings Due"
              icon="📖"
              count={readingsDue.length}
              expanded={expandedSection === 'readings'}
              onToggle={() => setExpandedSection(expandedSection === 'readings' ? null : 'readings')}
            >
              {readingsDue.map((item) => (
                <ReadingItemCard
                  key={item.id}
                  item={item}
                  onClick={() => onOpenReading?.(item)}
                />
              ))}
            </Section>
          )}

          {/* Upcoming Section */}
          {upcoming.length > 0 && (
            <Section
              title="Upcoming"
              icon="🔮"
              count={upcoming.length}
              expanded={expandedSection === 'upcoming'}
              onToggle={() => setExpandedSection(expandedSection === 'upcoming' ? null : 'upcoming')}
            >
              {upcoming.map((item) => (
                <HomeworkItemCard
                  key={item.id}
                  item={item}
                  onClick={() => onOpenAssignment?.(item)}
                  showDate
                />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

// Section Component
interface SectionProps {
  title: string;
  icon: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  urgent?: boolean;
  children: React.ReactNode;
}

function Section({ title, icon, count, expanded, onToggle, urgent, children }: SectionProps) {
  return (
    <div>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between p-3 hover:bg-slate-700/30 transition-colors ${
          urgent ? 'bg-red-500/10' : ''
        }`}
      >
        <div className="flex items-center gap-2">
          <span>{icon}</span>
          <span className={`font-medium ${urgent ? 'text-red-400' : 'text-white'}`}>
            {title}
          </span>
          <span className={`px-1.5 py-0.5 rounded text-xs ${
            urgent ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-400'
          }`}>
            {count}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

// Homework Item Card
interface HomeworkItemCardProps {
  item: HomeworkItem;
  onClick?: () => void;
  showDate?: boolean;
}

function HomeworkItemCard({ item, onClick, showDate }: HomeworkItemCardProps) {
  const urgencyColors = getUrgencyColors(item.urgencyLevel);
  const statusInfo = getStatusInfo(item.status);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-all hover:scale-[1.01] ${urgencyColors.bg} ${urgencyColors.border}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs ${statusInfo.color}`}>{statusInfo.icon}</span>
            <h4 className="font-medium text-white truncate">{item.title}</h4>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
            <span>{item.courseName}</span>
            {item.pointsPossible && (
              <>
                <span>•</span>
                <span>{item.pointsPossible} pts</span>
              </>
            )}
            {showDate && item.dueAt && (
              <>
                <span>•</span>
                <span>{format(parseISO(item.dueAt), 'MMM d')}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {item.hoursUntilDue !== null && (
            <span className={`text-xs font-medium ${urgencyColors.text}`}>
              {formatHoursUntilDue(item.hoursUntilDue)}
            </span>
          )}
          {item.estimatedMinutes && (
            <span className="text-xs text-slate-500">
              {formatTimeEstimate(item.estimatedMinutes)}
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {item.subtaskCount > 0 && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-400">
              {item.subtasksCompleted}/{item.subtaskCount} tasks
            </span>
            <span className="text-slate-400">{item.progressPercent}%</span>
          </div>
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${getProgressColor(item.progressPercent)}`}
              style={{ width: `${item.progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Badges */}
      <div className="flex items-center gap-1 mt-2">
        {item.hasRubric && (
          <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded">
            Rubric
          </span>
        )}
        {item.hasInstructions && (
          <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded">
            Instructions
          </span>
        )}
      </div>
    </button>
  );
}

// Reading Item Card
interface ReadingItemCardProps {
  item: ReadingItem;
  onClick?: () => void;
}

function ReadingItemCard({ item, onClick }: ReadingItemCardProps) {
  const getFileIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf': return '📄';
      case 'pptx': case 'ppt': return '📊';
      case 'docx': case 'doc': return '📝';
      default: return '📎';
    }
  };

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg bg-slate-700/30 border border-slate-600/50 hover:bg-slate-700/50 transition-colors"
    >
      <div className="flex items-start gap-3">
        <span className="text-xl">{getFileIcon(item.fileType)}</span>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-white truncate">
            {item.displayName || item.fileName}
          </h4>
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
            <span>{item.courseName}</span>
            {item.relatedAssignmentTitle && (
              <>
                <span>•</span>
                <span>For: {item.relatedAssignmentTitle}</span>
              </>
            )}
          </div>
          {/* Progress */}
          {item.readStatus === 'in_progress' && (
            <div className="mt-2">
              <div className="h-1 bg-slate-600 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{ width: `${item.readProgress}%` }}
                />
              </div>
              <span className="text-xs text-slate-500 mt-0.5">{item.readProgress}% read</span>
            </div>
          )}
        </div>
        <span
          className={`px-2 py-0.5 text-xs rounded ${
            item.readStatus === 'unread'
              ? 'bg-yellow-500/20 text-yellow-400'
              : 'bg-blue-500/20 text-blue-400'
          }`}
        >
          {item.readStatus === 'unread' ? 'Unread' : 'Reading'}
        </span>
      </div>
    </button>
  );
}

export default HomeworkHubWidget;

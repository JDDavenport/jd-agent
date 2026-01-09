import { useState, useMemo } from 'react';
import {
  format,
  parseISO,
  isToday,
  isYesterday,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
} from 'date-fns';
import {
  CheckCircleIcon,
  FunnelIcon,
  CalendarIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

interface ArchivedTask {
  id: string;
  title: string;
  description?: string;
  completedAt: string;
  project?: string;
  context: string;
  priority?: number;
  timeSpentMinutes?: number;
}

type DateFilter = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'all';

interface ArchiveViewProps {
  tasks?: ArchivedTask[];
  isLoading?: boolean;
  onTaskClick?: (task: ArchivedTask) => void;
}

export function ArchiveView({ tasks = [], isLoading, onTaskClick }: ArchiveViewProps) {
  const [dateFilter, setDateFilter] = useState<DateFilter>('this_week');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Get unique projects
  const projects = useMemo(() => {
    const projectSet = new Set(tasks.filter((t) => t.project).map((t) => t.project!));
    return Array.from(projectSet).sort();
  }, [tasks]);

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let result = [...tasks];
    const now = new Date();

    // Date filter
    if (dateFilter !== 'all') {
      result = result.filter((task) => {
        const completedDate = parseISO(task.completedAt);
        switch (dateFilter) {
          case 'today':
            return isToday(completedDate);
          case 'yesterday':
            return isYesterday(completedDate);
          case 'this_week':
            return isWithinInterval(completedDate, {
              start: startOfWeek(now, { weekStartsOn: 1 }),
              end: endOfWeek(now, { weekStartsOn: 1 }),
            });
          case 'this_month':
            return isWithinInterval(completedDate, {
              start: startOfMonth(now),
              end: endOfMonth(now),
            });
          default:
            return true;
        }
      });
    }

    // Project filter
    if (projectFilter !== 'all') {
      result = result.filter((task) => task.project === projectFilter);
    }

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (task) =>
          task.title.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query) ||
          task.project?.toLowerCase().includes(query)
      );
    }

    // Sort by completion date (newest first)
    result.sort(
      (a, b) =>
        new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
    );

    return result;
  }, [tasks, dateFilter, projectFilter, searchQuery]);

  // Group by day
  const groupedTasks = useMemo(() => {
    const groups: { [key: string]: ArchivedTask[] } = {};

    filteredTasks.forEach((task) => {
      const date = parseISO(task.completedAt);
      let label: string;

      if (isToday(date)) {
        label = 'Today';
      } else if (isYesterday(date)) {
        label = 'Yesterday';
      } else {
        label = format(date, 'EEEE, MMMM d');
      }

      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(task);
    });

    return groups;
  }, [filteredTasks]);

  const dateFilterOptions: { value: DateFilter; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'this_week', label: 'This Week' },
    { value: 'this_month', label: 'This Month' },
    { value: 'all', label: 'All Time' },
  ];

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Completed Tasks</h1>

        {/* Search */}
        <div className="relative mb-4">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search completed tasks..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-gray-400" />
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
            >
              {dateFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <FunnelIcon className="w-4 h-4 text-gray-400" />
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 focus:outline-none"
            >
              <option value="all">All Projects</option>
              {projects.map((project) => (
                <option key={project} value={project}>
                  {project}
                </option>
              ))}
            </select>
          </div>

          <div className="text-sm text-gray-500">
            {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'} completed
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="px-6 py-4">
        {Object.keys(groupedTasks).length === 0 ? (
          <div className="text-center py-12">
            <CheckCircleIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No completed tasks</h3>
            <p className="text-gray-500">
              {searchQuery
                ? 'No tasks match your search'
                : 'Complete some tasks to see them here'}
            </p>
          </div>
        ) : (
          Object.entries(groupedTasks).map(([dateLabel, dayTasks]) => (
            <div key={dateLabel} className="mb-6">
              <div className="flex items-center gap-2 mb-3 sticky top-32 bg-white py-2">
                <h2 className="text-sm font-semibold text-gray-700">{dateLabel}</h2>
                <span className="text-xs text-gray-400">({dayTasks.length})</span>
              </div>
              <div className="space-y-2">
                {dayTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => onTaskClick?.(task)}
                    className="w-full flex items-start gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-left transition-colors"
                  >
                    <CheckCircleIcon className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 line-through decoration-gray-400">
                        {task.title}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        {task.project && (
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                            {task.project}
                          </span>
                        )}
                        <span>{task.context}</span>
                        <span>•</span>
                        <span>{format(parseISO(task.completedAt), 'h:mm a')}</span>
                        {task.timeSpentMinutes && (
                          <>
                            <span>•</span>
                            <span>{task.timeSpentMinutes}m spent</span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import {
  TagIcon,
  AtSymbolIcon,
  AdjustmentsHorizontalIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { TaskCard } from '../components/TaskCard';
import { useTasks, useCompleteTask } from '../hooks/useTasks';
import type { Task } from '../api';

type FilterType = 'labels' | 'contexts';

export function FiltersView() {
  const { data: tasks, isLoading } = useTasks();
  const completeTask = useCompleteTask();
  const [activeFilter, setActiveFilter] = useState<FilterType>('labels');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const { labels, contexts } = useMemo((): { labels: Map<string, Task[]>; contexts: Map<string, Task[]> } => {
    if (!tasks) return { labels: new Map<string, Task[]>(), contexts: new Map<string, Task[]>() };

    const labelMap = new Map<string, Task[]>();
    const contextMap = new Map<string, Task[]>();

    tasks
      .filter((t) => t.status !== 'done')
      .forEach((task) => {
        task.taskLabels?.forEach((label) => {
          if (!labelMap.has(label)) {
            labelMap.set(label, []);
          }
          labelMap.get(label)!.push(task);
        });

        task.taskContexts?.forEach((context) => {
          if (!contextMap.has(context)) {
            contextMap.set(context, []);
          }
          contextMap.get(context)!.push(task);
        });
      });

    return { labels: labelMap, contexts: contextMap };
  }, [tasks]);

  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const handleComplete = (id: string) => {
    completeTask.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const activeMap = activeFilter === 'labels' ? labels : contexts;
  const sortedEntries = Array.from(activeMap.entries()).sort(
    (a, b) => b[1].length - a[1].length
  );

  return (
    <div className="max-w-3xl mx-auto">
      {/* Filter Type Tabs */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveFilter('labels')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeFilter === 'labels'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <TagIcon className="w-4 h-4" />
            Labels ({labels.size})
          </button>
          <button
            onClick={() => setActiveFilter('contexts')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeFilter === 'contexts'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <AtSymbolIcon className="w-4 h-4" />
            Contexts ({contexts.size})
          </button>
        </div>
      </div>

      {/* Grouped Tasks */}
      {sortedEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            {activeFilter === 'labels' ? (
              <TagIcon className="w-8 h-8 text-gray-400" />
            ) : (
              <AtSymbolIcon className="w-8 h-8 text-gray-400" />
            )}
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            No {activeFilter === 'labels' ? 'labels' : 'contexts'} yet
          </h3>
          <p className="text-gray-500 max-w-sm">
            {activeFilter === 'labels'
              ? 'Add #labels to tasks to organize them by category.'
              : 'Add @contexts to tasks to group them by situation (e.g., @home, @work).'}
          </p>
        </div>
      ) : (
        <div>
          {sortedEntries.map(([name, groupTasks]) => {
            const isExpanded = expandedGroups.has(name);
            return (
              <section key={name} className="border-b border-gray-100">
                <button
                  onClick={() => toggleGroup(name)}
                  className="w-full px-6 py-3 bg-gray-50 flex items-center gap-2 hover:bg-gray-100"
                >
                  {isExpanded ? (
                    <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRightIcon className="w-4 h-4 text-gray-500" />
                  )}
                  <span
                    className={`text-sm font-medium ${
                      activeFilter === 'labels' ? 'text-purple-600' : 'text-blue-600'
                    }`}
                  >
                    {activeFilter === 'labels' ? '#' : '@'}
                    {name}
                  </span>
                  <span className="text-xs text-gray-400">({groupTasks.length})</span>
                </button>
                {isExpanded && (
                  <div>
                    {groupTasks.map((task) => (
                      <TaskCard key={task.id} task={task} onComplete={handleComplete} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* Info footer */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
        <div className="flex items-start gap-3">
          <AdjustmentsHorizontalIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <p className="text-xs text-gray-500">
            <strong>GTD Tip:</strong>{' '}
            {activeFilter === 'contexts'
              ? 'Use @contexts to batch similar tasks together. When you\'re @home, work through all @home tasks.'
              : 'Use #labels for cross-project categorization like #waiting or #urgent.'}
          </p>
        </div>
      </div>
    </div>
  );
}

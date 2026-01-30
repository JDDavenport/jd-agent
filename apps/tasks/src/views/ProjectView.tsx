import { useMemo, useState, useEffect } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FolderIcon,
  EllipsisHorizontalIcon,
} from '@heroicons/react/24/outline';
import { TaskCard } from '../components/TaskCard';
import { InlineAddTask } from '../components/InlineAddTask';
import { useTasks, useCompleteTask, useProjects } from '../hooks/useTasks';
import type { Task } from '../api';

interface ProjectViewProps {
  projectId: string;
  onSelectProject?: (projectId: string) => void;
  onSelectTask?: (task: Task) => void;
  selectedTaskId?: string | null;
  onTaskListUpdate?: (tasks: Task[]) => void;
}

interface SectionGroup {
  id: string | null;
  name: string;
  tasks: Task[];
  isCollapsed: boolean;
}

export function ProjectView({
  projectId,
  onSelectProject,
  onSelectTask,
  selectedTaskId,
  onTaskListUpdate,
}: ProjectViewProps) {
  const { data: allTasks, isLoading: tasksLoading } = useTasks();
  const { data: projects } = useProjects();
  const completeTask = useCompleteTask();
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const project = projects?.find((p) => p.id === projectId);

  // Get child projects for this parent project
  const childProjects = projects?.filter((p) => p.parentProjectId === projectId) || [];

  const { sections, completedTasks } = useMemo(() => {
    if (!allTasks) return { sections: [], completedTasks: [] };

    const projectTasks = allTasks.filter((t) => t.projectId === projectId);
    const completed = projectTasks.filter((t) => t.status === 'done');
    const active = projectTasks.filter((t) => t.status !== 'done');

    // Group by section
    const sectionMap = new Map<string | null, Task[]>();
    sectionMap.set(null, []); // "No section" group

    active.forEach((task) => {
      const sectionId = task.sectionId || null;
      if (!sectionMap.has(sectionId)) {
        sectionMap.set(sectionId, []);
      }
      sectionMap.get(sectionId)!.push(task);
    });

    // Convert to array and sort by priority within each section
    const sectionGroups: SectionGroup[] = Array.from(sectionMap.entries()).map(
      ([sectionId, tasks]) => ({
        id: sectionId,
        name: sectionId ? `Section ${sectionId.slice(0, 8)}` : 'No Section',
        tasks: tasks.sort((a, b) => (b.priority || 0) - (a.priority || 0)),
        isCollapsed: sectionId ? collapsedSections.has(sectionId) : false,
      })
    );

    return { sections: sectionGroups, completedTasks: completed };
  }, [allTasks, projectId, collapsedSections]);

  const visibleTasks = useMemo(() => {
    const sectionTasks = sections.flatMap((section) => section.tasks);
    const completedSlice = completedTasks.slice(0, 5);
    return [...sectionTasks, ...completedSlice];
  }, [sections, completedTasks]);

  useEffect(() => {
    onTaskListUpdate?.(visibleTasks);
  }, [onTaskListUpdate, visibleTasks]);

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const handleComplete = (id: string) => {
    completeTask.mutate(id);
  };

  if (tasksLoading) {
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

  const totalActive = sections.reduce((acc, s) => acc + s.tasks.length, 0);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Project Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: project?.color || '#6366f1' }}
          />
          <h1 className="text-xl font-semibold text-gray-900">
            {project?.name || 'Project'}
          </h1>
          <span className="text-sm text-gray-500">
            {totalActive} {totalActive === 1 ? 'task' : 'tasks'}
          </span>
          <button className="ml-auto p-1 hover:bg-gray-100 rounded">
            <EllipsisHorizontalIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        {project?.description && (
          <p className="mt-2 text-sm text-gray-500">{project.description}</p>
        )}
      </div>

      {/* Child Projects */}
      {childProjects.length > 0 && (
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Sub-Projects ({childProjects.length})
          </h2>
          <div className="grid gap-2">
            {childProjects.map((child) => (
              <button
                key={child.id}
                onClick={() => onSelectProject?.(child.id)}
                className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors text-left"
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: child.color || '#6366f1' }}
                />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-900 truncate block">{child.name}</span>
                  {child.description && (
                    <span className="text-sm text-gray-500 truncate block">{child.description}</span>
                  )}
                </div>
                <ChevronRightIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sections */}
      {sections.map((section) => (
        <section key={section.id || 'none'} className="border-b border-gray-100">
          {section.id && (
            <div className="px-6 py-3 bg-gray-50 flex items-center gap-2">
              <button
                onClick={() => toggleSection(section.id!)}
                className="p-0.5 hover:bg-gray-200 rounded"
              >
                {section.isCollapsed ? (
                  <ChevronRightIcon className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronDownIcon className="w-4 h-4 text-gray-500" />
                )}
              </button>
              <h2 className="text-sm font-semibold text-gray-700">
                {section.name}
              </h2>
              <span className="text-xs text-gray-400">({section.tasks.length})</span>
            </div>
          )}
          {!section.isCollapsed && (
            <>
              {section.tasks.length > 0 && (
                <div>
                  {section.tasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onComplete={handleComplete}
                      onSelect={onSelectTask}
                      isSelected={selectedTaskId === task.id}
                    />
                  ))}
                </div>
              )}
              <InlineAddTask
                projectId={projectId}
                context={project?.name || 'Personal'}
                placeholder={`Add task to ${project?.name || 'project'}...`}
              />
            </>
          )}
          {section.tasks.length === 0 && !section.id && section.isCollapsed && (
            <div className="px-6 py-4 text-sm text-gray-400">
              No tasks yet. Add one to get started.
            </div>
          )}
        </section>
      ))}

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <section>
          <div className="px-6 py-3 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-500">
              Completed ({completedTasks.length})
            </h2>
          </div>
          <div>
            {completedTasks.slice(0, 5).map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onComplete={handleComplete}
                onSelect={onSelectTask}
                isSelected={selectedTaskId === task.id}
              />
            ))}
            {completedTasks.length > 5 && (
              <div className="px-6 py-3 text-center text-sm text-gray-500">
                +{completedTasks.length - 5} more completed
              </div>
            )}
          </div>
        </section>
      )}

      {/* Empty state */}
      {totalActive === 0 && completedTasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <FolderIcon className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No tasks yet</h3>
          <p className="text-gray-500">Add tasks to this project to get started.</p>
        </div>
      )}
    </div>
  );
}

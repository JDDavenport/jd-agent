import { useState } from 'react';
import {
  InboxIcon,
  SunIcon,
  CalendarDaysIcon,
  TagIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';
import { clsx } from 'clsx';

export type ViewType = 'inbox' | 'today' | 'upcoming' | 'project' | 'filter' | 'label';

interface NavItem {
  id: string;
  name: string;
  icon: typeof InboxIcon;
  count?: number;
  color?: string;
  type: ViewType;
}

interface Project {
  id: string;
  name: string;
  color: string;
  taskCount: number;
  parentProjectId?: string | null;
}

interface SidebarProps {
  selectedView: string;
  onSelectView: (viewId: string, type: ViewType) => void;
  inboxCount: number;
  todayCount: number;
  projects?: Project[];
  onAddProject?: () => void;
  onAddTaskToProject?: (projectId: string, projectName: string) => void;
}

export function Sidebar({
  selectedView,
  onSelectView,
  inboxCount,
  todayCount,
  projects = [],
  onAddProject,
  onAddTaskToProject,
}: SidebarProps) {
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set());

  // Group projects: parent projects and their children
  const parentProjects = projects.filter(p => !p.parentProjectId);
  const childrenByParent = projects.reduce((acc, p) => {
    if (p.parentProjectId) {
      if (!acc[p.parentProjectId]) acc[p.parentProjectId] = [];
      acc[p.parentProjectId].push(p);
    }
    return acc;
  }, {} as Record<string, Project[]>);

  const toggleParentExpanded = (parentId: string) => {
    setCollapsedParents(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  };

  // Parents are expanded by default (not in collapsed set)

  const mainNav: NavItem[] = [
    { id: 'inbox', name: 'Inbox', icon: InboxIcon, count: inboxCount, type: 'inbox' },
    { id: 'today', name: 'Today', icon: SunIcon, count: todayCount, type: 'today' },
    { id: 'upcoming', name: 'Upcoming', icon: CalendarDaysIcon, type: 'upcoming' },
  ];

  const filters: NavItem[] = [
    { id: 'filter-priority', name: 'High Priority', icon: TagIcon, color: '#ef4444', type: 'filter' },
    { id: 'filter-overdue', name: 'Overdue', icon: TagIcon, color: '#f97316', type: 'filter' },
    { id: 'filter-no-date', name: 'No Due Date', icon: TagIcon, color: '#6b7280', type: 'filter' },
  ];

  return (
    <aside data-testid="tasks-sidebar" className="w-64 bg-gray-50 border-r border-gray-200 h-screen flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-gray-200">
        <h1 data-testid="tasks-sidebar-logo" className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Squares2X2Icon className="w-6 h-6 text-blue-500" />
          JD Tasks
        </h1>
      </div>

      {/* Main Navigation */}
      <nav data-testid="tasks-sidebar-nav" className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {mainNav.map((item) => (
            <button
              key={item.id}
              data-testid={`tasks-nav-${item.id}`}
              onClick={() => onSelectView(item.id, item.type)}
              className={clsx(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                selectedView === item.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="flex-1 text-left">{item.name}</span>
              {item.count !== undefined && item.count > 0 && (
                <span
                  className={clsx(
                    'px-2 py-0.5 rounded-full text-xs',
                    selectedView === item.id
                      ? 'bg-blue-200 text-blue-800'
                      : 'bg-gray-200 text-gray-600'
                  )}
                >
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Projects Section */}
        <div data-testid="tasks-projects-section" className="mt-6">
          <button
            data-testid="tasks-projects-toggle"
            onClick={() => setProjectsExpanded(!projectsExpanded)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700"
          >
            {projectsExpanded ? (
              <ChevronDownIcon className="w-4 h-4" />
            ) : (
              <ChevronRightIcon className="w-4 h-4" />
            )}
            Projects
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddProject?.();
              }}
              className="ml-auto p-1 hover:bg-gray-200 rounded"
            >
              <PlusIcon className="w-4 h-4" />
            </button>
          </button>

          {projectsExpanded && (
            <div className="mt-1 space-y-0.5">
              {projects.length === 0 ? (
                <p className="px-3 py-2 text-sm text-gray-400">No projects yet</p>
              ) : (
                parentProjects.map((parent) => {
                  const children = childrenByParent[parent.id] || [];
                  const hasChildren = children.length > 0;
                  const isExpanded = !collapsedParents.has(parent.id);

                  return (
                    <div key={parent.id}>
                      {/* Parent Project */}
                      <div className="group/project relative flex items-center">
                        <button
                          onClick={() => {
                            if (hasChildren) {
                              toggleParentExpanded(parent.id);
                            } else {
                              onSelectView(parent.id, 'project');
                            }
                          }}
                          className={clsx(
                            'w-full flex items-center gap-2 px-3 py-2 pr-10 rounded-lg text-sm font-medium transition-colors',
                            selectedView === parent.id
                              ? 'bg-blue-100 text-blue-700'
                              : 'text-gray-700 hover:bg-gray-100'
                          )}
                        >
                          {hasChildren ? (
                            isExpanded ? (
                              <ChevronDownIcon className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronRightIcon className="w-4 h-4 text-gray-400" />
                            )
                          ) : (
                            <span className="w-4" />
                          )}
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: parent.color }}
                          />
                          <span className="flex-1 text-left truncate">{parent.name}</span>
                          {hasChildren && (
                            <span className="text-xs text-gray-400">{children.length}</span>
                          )}
                        </button>
                        {/* Add task button for parent */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddTaskToProject?.(parent.id, parent.name);
                          }}
                          className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-gray-300 opacity-0 group-hover/project:opacity-100 transition-opacity z-10 bg-gray-100"
                          title={`Add task to ${parent.name}`}
                        >
                          <PlusIcon className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>

                      {/* Child Projects (indented) */}
                      {hasChildren && isExpanded && (
                        <div className="ml-4 border-l border-gray-200 pl-2 space-y-0.5">
                          {children.map((child) => (
                            <div key={child.id} className="group/child relative flex items-center">
                              <button
                                onClick={() => onSelectView(child.id, 'project')}
                                className={clsx(
                                  'w-full flex items-center gap-3 px-3 py-1.5 pr-10 rounded-lg text-sm transition-colors',
                                  selectedView === child.id
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'text-gray-600 hover:bg-gray-100'
                                )}
                              >
                                <span
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: child.color }}
                                />
                                <span className="flex-1 text-left truncate">{child.name}</span>
                                {child.taskCount > 0 && (
                                  <span className="text-xs text-gray-400 group-hover/child:hidden">{child.taskCount}</span>
                                )}
                              </button>
                              {/* Add task button for child */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAddTaskToProject?.(child.id, child.name);
                                }}
                                className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 rounded hover:bg-gray-300 opacity-0 group-hover/child:opacity-100 transition-opacity z-10 bg-gray-100"
                                title={`Add task to ${child.name}`}
                              >
                                <PlusIcon className="w-4 h-4 text-gray-600" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Filters Section */}
        <div data-testid="tasks-filters-section" className="mt-6">
          <button
            data-testid="tasks-filters-toggle"
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700"
          >
            {filtersExpanded ? (
              <ChevronDownIcon className="w-4 h-4" />
            ) : (
              <ChevronRightIcon className="w-4 h-4" />
            )}
            Filters & Labels
          </button>

          {filtersExpanded && (
            <div className="mt-1 space-y-1">
              {filters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => onSelectView(filter.id, filter.type)}
                  className={clsx(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                    selectedView === filter.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: filter.color }}
                  />
                  <span className="flex-1 text-left">{filter.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Keyboard Shortcuts Hint */}
      <div className="p-4 border-t border-gray-200 text-xs text-gray-400">
        <p>
          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded">Q</kbd> Quick add
        </p>
        <p className="mt-1">
          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded">/</kbd> Search
        </p>
      </div>
    </aside>
  );
}

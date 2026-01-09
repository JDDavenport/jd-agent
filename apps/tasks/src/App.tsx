import { useState, useEffect, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PlusIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Sidebar, ViewType } from './components/Sidebar';
import { InboxView } from './views/InboxView';
import { TodayView } from './views/TodayView';
import { UpcomingView } from './views/UpcomingView';
import { ProjectView } from './views/ProjectView';
import { FiltersView } from './views/FiltersView';
import { QuickAddTask } from './components/QuickAddTask';
import { SearchModal } from './components/SearchModal';
import { useTodayTasks, useInboxTasks, useProjects } from './hooks/useTasks';

const queryClient = new QueryClient();

function TasksApp() {
  const [selectedView, setSelectedView] = useState('today');
  const [viewType, setViewType] = useState<ViewType>('today');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [quickAddProjectId, setQuickAddProjectId] = useState<string | undefined>();
  const [quickAddProjectName, setQuickAddProjectName] = useState<string | undefined>();

  const todayQuery = useTodayTasks();
  const inboxQuery = useInboxTasks();
  const projectsQuery = useProjects();

  const handleSelectView = useCallback((viewId: string, type: ViewType) => {
    setSelectedView(viewId);
    setViewType(type);
  }, []);

  const handleAddTaskToProject = useCallback((projectId: string, projectName: string) => {
    setQuickAddProjectId(projectId);
    setQuickAddProjectName(projectName);
    setIsQuickAddOpen(true);
  }, []);

  const handleQuickAddClose = useCallback(() => {
    setIsQuickAddOpen(false);
    setQuickAddProjectId(undefined);
    setQuickAddProjectName(undefined);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

      // Quick add: Q or N
      if ((e.key === 'q' || e.key === 'n') && !e.metaKey && !e.ctrlKey && !e.altKey && !isInput) {
        e.preventDefault();
        setIsQuickAddOpen(true);
        return;
      }

      // Search: / or Cmd+K
      if ((e.key === '/' && !isInput) || (e.key === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        setIsSearchOpen(true);
        return;
      }

      // Navigation: G then I/T/U
      if (e.key === 'g' && !e.metaKey && !e.ctrlKey && !isInput) {
        const handleNextKey = (nextE: KeyboardEvent) => {
          if (nextE.key === 'i') handleSelectView('inbox', 'inbox');
          if (nextE.key === 't') handleSelectView('today', 'today');
          if (nextE.key === 'u') handleSelectView('upcoming', 'upcoming');
          window.removeEventListener('keydown', handleNextKey);
        };
        window.addEventListener('keydown', handleNextKey, { once: true });
        setTimeout(() => window.removeEventListener('keydown', handleNextKey), 1000);
      }

      // Escape to close modals
      if (e.key === 'Escape') {
        setIsQuickAddOpen(false);
        setIsSearchOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSelectView]);

  const getViewTitle = () => {
    switch (selectedView) {
      case 'inbox':
        return 'Inbox';
      case 'today':
        return 'Today';
      case 'upcoming':
        return 'Upcoming';
      default:
        if (viewType === 'project') {
          const project = projectsQuery.data?.find((p) => p.id === selectedView);
          return project?.name || 'Project';
        }
        return 'Tasks';
    }
  };

  const renderMainContent = () => {
    switch (viewType) {
      case 'inbox':
        return <InboxView />;
      case 'today':
        return <TodayView />;
      case 'upcoming':
        return <UpcomingView />;
      case 'project':
        return <ProjectView projectId={selectedView} />;
      case 'filter':
      case 'label':
        return <FiltersView />;
      default:
        return <TodayView />;
    }
  };

  const projects = (projectsQuery.data || []).map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color || '#808080',
    taskCount: 0, // TODO: Get actual count
    parentProjectId: p.parentProjectId,
  }));

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <Sidebar
        selectedView={selectedView}
        onSelectView={handleSelectView}
        inboxCount={inboxQuery.data?.length || 0}
        todayCount={todayQuery.data?.length || 0}
        projects={projects}
        onAddTaskToProject={handleAddTaskToProject}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{getViewTitle()}</h1>
            {viewType === 'today' && (
              <p className="text-sm text-gray-500">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <MagnifyingGlassIcon className="w-5 h-5" />
              <span className="text-sm hidden sm:inline">Search</span>
              <kbd className="hidden sm:inline px-1.5 py-0.5 text-xs bg-gray-100 rounded">⌘K</kbd>
            </button>
            <button
              onClick={() => setIsQuickAddOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Add Task</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">{renderMainContent()}</div>
      </main>

      {/* Modals */}
      <QuickAddTask
        isOpen={isQuickAddOpen}
        onClose={handleQuickAddClose}
        defaultProjectId={quickAddProjectId}
        defaultProjectName={quickAddProjectName}
      />
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TasksApp />
    </QueryClientProvider>
  );
}

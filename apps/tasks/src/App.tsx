import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { TaskDetailPanel } from './components/TaskDetailPanel';
import { useTodayTasks, useTasks, useProjects, useCompleteTask, useDeleteTask } from './hooks/useTasks';
import type { Task } from './api';

const queryClient = new QueryClient();

function TasksApp() {
  const [selectedView, setSelectedView] = useState('today');
  const [viewType, setViewType] = useState<ViewType>('today');
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [quickAddProjectId, setQuickAddProjectId] = useState<string | undefined>();
  const [quickAddProjectName, setQuickAddProjectName] = useState<string | undefined>();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [currentTasks, setCurrentTasks] = useState<Task[]>([]);
  const [subtaskParent, setSubtaskParent] = useState<{ id: string; title: string } | null>(null);

  const todayQuery = useTodayTasks();
  const allTasksQuery = useTasks();
  const projectsQuery = useProjects();
  const completeTask = useCompleteTask();
  const deleteTask = useDeleteTask();

  // Calculate inbox count (tasks without projects, due dates, or scheduled dates)
  const inboxCount = (allTasksQuery.data || []).filter(
    (task) =>
      task.status !== 'done' &&
      task.status !== 'archived' &&
      !task.projectId &&
      !task.dueDate &&
      !task.scheduledStart
  ).length;

  const handleSelectView = useCallback((viewId: string, type: ViewType) => {
    setSelectedView(viewId);
    setViewType(type);
    setSelectedTaskId(null);
    setDetailTask(null);
    setCurrentTasks([]);
  }, []);

  const handleAddTaskToProject = useCallback((projectId: string, projectName: string) => {
    setQuickAddProjectId(projectId);
    setQuickAddProjectName(projectName);
    setSubtaskParent(null);
    setIsQuickAddOpen(true);
  }, []);

  const handleQuickAddClose = useCallback(() => {
    setIsQuickAddOpen(false);
    setQuickAddProjectId(undefined);
    setQuickAddProjectName(undefined);
    setSubtaskParent(null);
  }, []);

  const handleTaskListUpdate = useCallback(
    (tasks: Task[]) => {
      setCurrentTasks(tasks);
      if (selectedTaskId && !tasks.some((task) => task.id === selectedTaskId)) {
        setSelectedTaskId(null);
      }
    },
    [selectedTaskId]
  );

  const selectedTask = useMemo(
    () => currentTasks.find((task) => task.id === selectedTaskId) || null,
    [currentTasks, selectedTaskId]
  );

  const scrollToTask = (taskId: string) => {
    const element = document.querySelector(`[data-task-id="${taskId}"]`);
    if (element) {
      element.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Quick add: Q or N
      if ((e.key === 'q' || e.key === 'n') && !e.metaKey && !e.ctrlKey && !e.altKey && !isInput) {
        e.preventDefault();
        setSubtaskParent(null);
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

      if (isInput) return;

      // Arrow navigation
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (currentTasks.length === 0) return;
        e.preventDefault();
        const currentIndex = selectedTaskId
          ? currentTasks.findIndex((task) => task.id === selectedTaskId)
          : -1;
        const nextIndex =
          e.key === 'ArrowDown'
            ? Math.min(currentIndex + 1, currentTasks.length - 1)
            : Math.max(currentIndex - 1, 0);
        const nextTask = currentTasks[nextIndex];
        if (nextTask) {
          setSelectedTaskId(nextTask.id);
          scrollToTask(nextTask.id);
        }
        return;
      }

      // Complete task: Cmd/Ctrl+Enter
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (selectedTask && selectedTask.status !== 'done') {
          e.preventDefault();
          completeTask.mutate(selectedTask.id);
        }
        return;
      }

      // Open task: Enter
      if (e.key === 'Enter' && selectedTask) {
        e.preventDefault();
        setDetailTask(selectedTask);
        return;
      }

      // Edit task: E
      if (e.key === 'e' && selectedTask) {
        e.preventDefault();
        setDetailTask(selectedTask);
        return;
      }

      // Delete task: D
      if (e.key === 'd' && selectedTask) {
        e.preventDefault();
        if (window.confirm(`Delete "${selectedTask.title}"?`)) {
          deleteTask.mutate(selectedTask.id);
          setSelectedTaskId(null);
        }
        return;
      }

      // Make subtask: Tab
      if (e.key === 'Tab' && selectedTask && !selectedTask.parentTaskId) {
        e.preventDefault();
        setSubtaskParent({ id: selectedTask.id, title: selectedTask.title });
        setIsQuickAddOpen(true);
        return;
      }

      // Escape to close modals and panels
      if (e.key === 'Escape') {
        setIsQuickAddOpen(false);
        setIsSearchOpen(false);
        setDetailTask(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSelectView, completeTask, currentTasks, deleteTask, selectedTask, selectedTaskId]);

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

  const handleSelectTask = useCallback((task: Task) => {
    setSelectedTaskId(task.id);
    setDetailTask(task);
  }, []);

  const renderMainContent = () => {
    switch (viewType) {
      case 'inbox':
        return (
          <InboxView
            onSelectTask={handleSelectTask}
            selectedTaskId={selectedTaskId}
            onTaskListUpdate={handleTaskListUpdate}
          />
        );
      case 'today':
        return (
          <TodayView
            onSelectTask={handleSelectTask}
            selectedTaskId={selectedTaskId}
            onTaskListUpdate={handleTaskListUpdate}
          />
        );
      case 'upcoming':
        return (
          <UpcomingView
            onSelectTask={handleSelectTask}
            selectedTaskId={selectedTaskId}
            onTaskListUpdate={handleTaskListUpdate}
          />
        );
      case 'project':
        return (
          <ProjectView
            projectId={selectedView}
            onSelectProject={(id) => handleSelectView(id, 'project')}
            onSelectTask={handleSelectTask}
            selectedTaskId={selectedTaskId}
            onTaskListUpdate={handleTaskListUpdate}
          />
        );
      case 'filter':
      case 'label':
        return (
          <FiltersView
            filterId={selectedView}
            onSelectTask={handleSelectTask}
            selectedTaskId={selectedTaskId}
            onTaskListUpdate={handleTaskListUpdate}
          />
        );
      default:
        return (
          <TodayView
            onSelectTask={handleSelectTask}
            selectedTaskId={selectedTaskId}
            onTaskListUpdate={handleTaskListUpdate}
          />
        );
    }
  };

  const projectTaskCounts = useMemo(() => {
    const counts = new Map<string, number>();
    (allTasksQuery.data || []).forEach((task) => {
      if (!task.projectId) return;
      if (task.status === 'done' || task.status === 'archived') return;
      counts.set(task.projectId, (counts.get(task.projectId) || 0) + 1);
    });
    return counts;
  }, [allTasksQuery.data]);

  const projects = (projectsQuery.data || []).map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color || '#808080',
    taskCount: projectTaskCounts.get(p.id) || 0,
    parentProjectId: p.parentProjectId,
  }));

  return (
    <div data-testid="tasks-app" className="flex h-screen bg-white">
      {/* Sidebar */}
      <Sidebar
        selectedView={selectedView}
        onSelectView={handleSelectView}
        inboxCount={inboxCount}
        todayCount={todayQuery.data?.length || 0}
        projects={projects}
        onAddTaskToProject={handleAddTaskToProject}
      />

      {/* Main Content */}
      <main data-testid="tasks-main" className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header data-testid="tasks-header" className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h1 data-testid="tasks-view-title" className="text-2xl font-bold text-gray-900">{getViewTitle()}</h1>
            {viewType === 'today' && (
              <p data-testid="tasks-date" className="text-sm text-gray-500">
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
              data-testid="tasks-search-button"
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <MagnifyingGlassIcon className="w-5 h-5" />
              <span className="text-sm hidden sm:inline">Search</span>
              <kbd className="hidden sm:inline px-1.5 py-0.5 text-xs bg-gray-100 rounded">⌘K</kbd>
            </button>
            <button
              data-testid="tasks-add-button"
              onClick={() => setIsQuickAddOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Add Task</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <div data-testid="tasks-content" className="flex-1 overflow-y-auto">{renderMainContent()}</div>
      </main>

      {/* Modals */}
      <QuickAddTask
        isOpen={isQuickAddOpen}
        onClose={handleQuickAddClose}
        defaultProjectId={quickAddProjectId}
        defaultProjectName={quickAddProjectName}
        parentTaskId={subtaskParent?.id}
        parentTaskTitle={subtaskParent?.title}
      />
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Task Detail Panel */}
      {detailTask && (
        <TaskDetailPanel
          task={detailTask}
          onClose={() => setDetailTask(null)}
        />
      )}
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

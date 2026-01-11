import { useState, useEffect, useCallback, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { PlusIcon, DocumentIcon, CheckCircleIcon, FlagIcon, FunnelIcon } from '@heroicons/react/24/outline';
import { api } from '../api';
import type { VaultPage, Task, Goal } from '../api';

type EntityType = 'page' | 'task' | 'goal';
type TaskFilter = 'all' | 'today' | 'inbox' | 'upcoming' | 'p1' | 'p2';

interface Entity {
  id: string;
  title: string;
  icon?: string;
  type: EntityType;
  meta?: {
    status?: string;
    priority?: number;
    dueDate?: string;
  };
}

interface PageLinkMenuProps {
  editor: Editor;
  onCreatePage?: (title: string) => Promise<VaultPage>;
  onTaskClick?: (taskId: string) => void;
  onGoalClick?: (goalId: string) => void;
}

export function PageLinkMenu({ editor, onCreatePage, onTaskClick, onGoalClick }: PageLinkMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [entities, setEntities] = useState<Entity[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<EntityType>('page');
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');
  const menuRef = useRef<HTMLDivElement>(null);
  const bracketPosRef = useRef<number | null>(null);

  // Convert pages to entities
  const pagesToEntities = useCallback((pages: VaultPage[]): Entity[] => {
    return pages.map(page => ({
      id: page.id,
      title: page.title,
      icon: page.icon || '📄',
      type: 'page' as EntityType,
    }));
  }, []);

  // Convert tasks to entities
  const tasksToEntities = useCallback((tasks: Task[]): Entity[] => {
    return tasks.map(task => ({
      id: task.id,
      title: task.title,
      icon: task.priority === 1 ? '🔴' : task.priority === 2 ? '🟠' : '✓',
      type: 'task' as EntityType,
      meta: {
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
      },
    }));
  }, []);

  // Convert goals to entities
  const goalsToEntities = useCallback((goals: Goal[]): Entity[] => {
    return goals.map(goal => ({
      id: goal.id,
      title: goal.title,
      icon: '🎯',
      type: 'goal' as EntityType,
    }));
  }, []);

  // Filter tasks client-side based on taskFilter
  const filterTasks = useCallback((tasks: Task[], filter: TaskFilter): Task[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    switch (filter) {
      case 'today':
        return tasks.filter(t => {
          if (!t.dueDate) return false;
          const due = new Date(t.dueDate);
          due.setHours(0, 0, 0, 0);
          return due.getTime() === today.getTime();
        });
      case 'inbox':
        return tasks.filter(t => t.status === 'inbox');
      case 'upcoming':
        return tasks.filter(t => {
          if (!t.dueDate) return false;
          const due = new Date(t.dueDate);
          return due >= tomorrow && due <= nextWeek;
        });
      case 'p1':
        return tasks.filter(t => t.priority === 1);
      case 'p2':
        return tasks.filter(t => t.priority === 2);
      default:
        return tasks;
    }
  }, []);

  // Search for entities based on active tab
  const searchEntities = useCallback(async (searchQuery: string, type: EntityType, filter?: TaskFilter) => {
    setIsLoading(true);
    try {
      let results: Entity[] = [];

      if (type === 'page') {
        if (searchQuery.length === 0) {
          const allPages = await api.listVaultPages();
          results = pagesToEntities(allPages.slice(0, 10));
        } else {
          const pages = await api.quickFindVaultPages(searchQuery, 10);
          results = pagesToEntities(pages);
        }
      } else if (type === 'task') {
        let tasks = await api.quickSearchTasks(searchQuery, 50); // Fetch more for filtering
        if (filter && filter !== 'all') {
          tasks = filterTasks(tasks, filter);
        }
        results = tasksToEntities(tasks.slice(0, 10));
      } else if (type === 'goal') {
        const goals = await api.searchGoals(searchQuery, 10);
        results = goalsToEntities(goals);
      }

      setEntities(results);
    } catch (error) {
      console.error('Failed to search entities:', error);
      setEntities([]);
    } finally {
      setIsLoading(false);
    }
  }, [pagesToEntities, tasksToEntities, goalsToEntities, filterTasks]);

  // Handle tab change
  const handleTabChange = useCallback((tab: EntityType) => {
    setActiveTab(tab);
    setSelectedIndex(0);
    searchEntities(query, tab, tab === 'task' ? taskFilter : undefined);
  }, [query, searchEntities, taskFilter]);

  // Handle task filter change
  const handleTaskFilterChange = useCallback((filter: TaskFilter) => {
    setTaskFilter(filter);
    setSelectedIndex(0);
    searchEntities(query, 'task', filter);
  }, [query, searchEntities]);

  // Handle editor updates to detect [[
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      const { state } = editor;
      const { selection } = state;
      const { $from } = selection;

      // Get text from start of current node to cursor
      const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);

      // Look for [[ pattern
      const bracketMatch = textBefore.match(/\[\[([^\]]*)?$/);

      if (bracketMatch) {
        // [[ found
        const bracketIndex = textBefore.lastIndexOf('[[');
        bracketPosRef.current = $from.start() + bracketIndex;

        if (!isOpen) {
          // Open menu
          const coords = editor.view.coordsAtPos(selection.from);
          setPosition({ top: coords.top, left: coords.left });
          setIsOpen(true);
        }

        // Update query
        const searchQuery = bracketMatch[1] || '';
        setQuery(searchQuery);
        setSelectedIndex(0);
        searchEntities(searchQuery, activeTab, activeTab === 'task' ? taskFilter : undefined);
      } else if (isOpen) {
        // No [[ found, close menu
        setIsOpen(false);
        bracketPosRef.current = null;
      }
    };

    editor.on('update', handleUpdate);
    editor.on('selectionUpdate', handleUpdate);

    return () => {
      editor.off('update', handleUpdate);
      editor.off('selectionUpdate', handleUpdate);
    };
  }, [editor, isOpen, searchEntities, activeTab, taskFilter]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const canCreate = activeTab === 'page' && query.length > 0;
      const itemCount = entities.length + (canCreate ? 1 : 0);

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex((prev) => (itemCount > 0 ? (prev + 1) % itemCount : 0));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex((prev) => (itemCount > 0 ? (prev - 1 + itemCount) % itemCount : 0));
          break;
        case 'Tab':
          event.preventDefault();
          // Cycle through tabs
          const tabs: EntityType[] = ['page', 'task', 'goal'];
          const currentIndex = tabs.indexOf(activeTab);
          const nextIndex = event.shiftKey
            ? (currentIndex - 1 + tabs.length) % tabs.length
            : (currentIndex + 1) % tabs.length;
          handleTabChange(tabs[nextIndex]);
          break;
        case 'Enter':
          event.preventDefault();
          if (selectedIndex < entities.length) {
            selectEntity(entities[selectedIndex]);
          } else if (canCreate) {
            handleCreatePage();
          }
          break;
        case 'Escape':
          event.preventDefault();
          setIsOpen(false);
          bracketPosRef.current = null;
          editor.commands.focus();
          break;
        case ']':
          // If typing ]] to close, just close the menu
          if (query.length === 0) {
            event.preventDefault();
            setIsOpen(false);
            bracketPosRef.current = null;
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, entities, query, editor, activeTab, handleTabChange]);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        bracketPosRef.current = null;
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const selectEntity = useCallback(
    (entity: Entity) => {
      // Delete the [[ and query text
      if (bracketPosRef.current !== null) {
        const { state } = editor;
        const { selection } = state;
        const from = bracketPosRef.current;
        const to = selection.from;
        editor.chain().focus().deleteRange({ from, to }).run();
      }

      // Insert the appropriate link based on entity type
      if (entity.type === 'page') {
        editor.chain().focus().setPageLink({ pageId: entity.id, title: entity.title }).run();
      } else if (entity.type === 'task') {
        editor.chain().focus().setTaskLink({ taskId: entity.id, title: entity.title }).run();
        onTaskClick?.(entity.id);
      } else if (entity.type === 'goal') {
        editor.chain().focus().setGoalLink({ goalId: entity.id, title: entity.title }).run();
        onGoalClick?.(entity.id);
      }

      setIsOpen(false);
      bracketPosRef.current = null;
    },
    [editor, onTaskClick, onGoalClick]
  );

  const handleCreatePage = useCallback(async () => {
    if (!onCreatePage || query.length === 0) return;

    try {
      const newPage = await onCreatePage(query);

      // Delete the [[ and query text
      if (bracketPosRef.current !== null) {
        const { state } = editor;
        const { selection } = state;
        const from = bracketPosRef.current;
        const to = selection.from;
        editor.chain().focus().deleteRange({ from, to }).run();
      }

      // Insert the page link
      editor.chain().focus().setPageLink({ pageId: newPage.id, title: newPage.title }).run();

      setIsOpen(false);
      bracketPosRef.current = null;
    } catch (error) {
      console.error('Failed to create page:', error);
    }
  }, [editor, onCreatePage, query]);

  if (!isOpen || !position) return null;

  const canCreate = activeTab === 'page' && query.length > 0;

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-80 bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-hidden flex flex-col"
      style={{
        top: position.top + 24,
        left: position.left,
      }}
    >
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          className={`flex-1 px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'page'
              ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
          onClick={() => handleTabChange('page')}
        >
          <DocumentIcon className="w-3.5 h-3.5" />
          Pages
        </button>
        <button
          className={`flex-1 px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'task'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
          onClick={() => handleTabChange('task')}
        >
          <CheckCircleIcon className="w-3.5 h-3.5" />
          Tasks
        </button>
        <button
          className={`flex-1 px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'goal'
              ? 'text-green-600 border-b-2 border-green-600 bg-green-50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
          onClick={() => handleTabChange('goal')}
        >
          <FlagIcon className="w-3.5 h-3.5" />
          Goals
        </button>
      </div>

      {/* Task Filter Bar */}
      {activeTab === 'task' && (
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-100 bg-gray-50">
          <FunnelIcon className="w-3.5 h-3.5 text-gray-400 mr-1" />
          {(['all', 'today', 'inbox', 'upcoming', 'p1', 'p2'] as TaskFilter[]).map((filter) => (
            <button
              key={filter}
              onClick={() => handleTaskFilterChange(filter)}
              className={`px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                taskFilter === filter
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {filter === 'all' ? 'All' :
               filter === 'today' ? 'Today' :
               filter === 'inbox' ? 'Inbox' :
               filter === 'upcoming' ? 'Upcoming' :
               filter === 'p1' ? 'P1' : 'P2'}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      <div className="overflow-y-auto flex-1 py-1">
        {isLoading ? (
          <div className="px-4 py-3 text-sm text-gray-500">Searching...</div>
        ) : entities.length === 0 && query.length === 0 ? (
          <div className="px-4 py-3 text-sm text-gray-500">
            {activeTab === 'page' && 'No pages yet'}
            {activeTab === 'task' && 'No tasks found'}
            {activeTab === 'goal' && 'No goals found'}
          </div>
        ) : entities.length === 0 ? (
          <div className="px-4 py-3 text-sm text-gray-500">
            No {activeTab}s matching "{query}"
          </div>
        ) : (
          <>
            {entities.map((entity, index) => (
              <button
                key={entity.id}
                className={`w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-100 transition-colors ${
                  index === selectedIndex ? 'bg-gray-100' : ''
                }`}
                onClick={() => selectEntity(entity)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className="text-lg flex-shrink-0">{entity.icon}</span>
                <span className="text-sm text-gray-900 truncate">{entity.title}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ml-auto flex-shrink-0 ${
                  entity.type === 'page' ? 'bg-purple-100 text-purple-600' :
                  entity.type === 'task' ? 'bg-blue-100 text-blue-600' :
                  'bg-green-100 text-green-600'
                }`}>
                  {entity.type}
                </span>
              </button>
            ))}

            {canCreate && (
              <>
                <div className="border-t border-gray-100 my-1" />
                <button
                  className={`w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-100 transition-colors ${
                    selectedIndex === entities.length ? 'bg-gray-100' : ''
                  }`}
                  onClick={handleCreatePage}
                  onMouseEnter={() => setSelectedIndex(entities.length)}
                >
                  <PlusIcon className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-700">
                    Create "<span className="font-medium">{query}</span>"
                  </span>
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
        <kbd className="px-1 py-0.5 bg-gray-200 rounded text-gray-500">Tab</kbd> to switch types
      </div>
    </div>
  );
}

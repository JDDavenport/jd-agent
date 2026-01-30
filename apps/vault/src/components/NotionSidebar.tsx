/**
 * NotionSidebar - Redesigned Vault sidebar with Classes, Journal, and Notion-like feel
 *
 * Key sections:
 * 1. Quick Actions (Search, New Page)
 * 2. MBA Classes (from vault page tree - looks for "MBA BYU" or similar)
 * 3. Quick Access (Journal, Favorites, Recordings)
 * 4. PARA Folders (collapsible)
 * 5. All Pages (hierarchical tree)
 */

import { useState, useCallback } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  DocumentTextIcon,
  SunIcon,
  MoonIcon,
  ChatBubbleLeftRightIcon,
  StarIcon,
  CalendarIcon,
  MicrophoneIcon,
  AcademicCapIcon,
  BookOpenIcon,
  DocumentIcon,
} from '@heroicons/react/24/outline';
import { clsx } from 'clsx';
import type { VaultPageTreeNode, VaultPage, PARAType } from '../lib/types';
import { useTheme } from '../hooks/useTheme';
import { useMbaClasses } from '../hooks/useMbaClasses';

// PARA folder configuration
const PARA_CONFIG: { type: PARAType; icon: string; label: string }[] = [
  { type: 'projects', icon: '📁', label: 'Projects' },
  { type: 'areas', icon: '🏠', label: 'Areas' },
  { type: 'resources', icon: '📚', label: 'Resources' },
  { type: 'archive', icon: '📦', label: 'Archive' },
];

interface NotionSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  selectedPageId: string | null;
  onSelectPage: (pageId: string) => void;
  onCreatePage: (parentId?: string) => void;
  onOpenSearch: () => void;
  onOpenChat?: () => void;
  onNavigateTo?: (view: 'journal' | 'favorites' | 'recordings' | 'classes') => void;
  pageTree: VaultPageTreeNode[];
  favorites: VaultPage[];
  isLoading?: boolean;
  activeView?: string;
}

export function NotionSidebar({
  isCollapsed,
  onToggleCollapse,
  selectedPageId,
  onSelectPage,
  onCreatePage,
  onOpenSearch,
  onOpenChat,
  onNavigateTo,
  pageTree,
  favorites,
  isLoading = false,
  activeView,
}: NotionSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['classes', 'quickAccess'])
  );
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [expandedMbaSemesters, setExpandedMbaSemesters] = useState<Set<string>>(new Set());
  const [expandedMbaClasses, setExpandedMbaClasses] = useState<Set<string>>(new Set());
  const { isDark, toggleTheme } = useTheme();

  // Use the MBA classes API which includes recordings and notes data
  const { data: mbaData, isLoading: isLoadingMba } = useMbaClasses();

  const toggleMbaSemester = useCallback((semesterId: string) => {
    setExpandedMbaSemesters((prev) => {
      const next = new Set(prev);
      if (next.has(semesterId)) {
        next.delete(semesterId);
      } else {
        next.add(semesterId);
      }
      return next;
    });
  }, []);

  const toggleMbaClass = useCallback((classId: string) => {
    setExpandedMbaClasses((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) {
        next.delete(classId);
      } else {
        next.add(classId);
      }
      return next;
    });
  }, []);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  const togglePage = useCallback((pageId: string) => {
    setExpandedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  }, []);

  // Collapsed state - just show expand button
  if (isCollapsed) {
    return (
      <aside className="w-0 relative">
        <button
          onClick={onToggleCollapse}
          className="absolute top-4 left-2 p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors z-10"
          title="Expand sidebar"
        >
          <ChevronDoubleRightIcon className="w-4 h-4 text-gray-500" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-64 bg-[#fbfbfa] dark:bg-[#191919] border-r border-gray-200 dark:border-gray-800 h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="flex items-center gap-2">
          <span className="text-lg">📚</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">JD Vault</span>
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Collapse sidebar"
        >
          <ChevronDoubleLeftIcon className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Search + New Page */}
      <div className="px-3 py-2 space-y-1.5">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          <MagnifyingGlassIcon className="w-4 h-4" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="text-xs text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">
            ⌘K
          </kbd>
        </button>
        <button
          onClick={() => onCreatePage?.()}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          <span>New Page</span>
          <kbd className="ml-auto text-xs text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">
            ⌘N
          </kbd>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {/* MBA Classes Section - uses API with recordings/notes data */}
        {mbaData?.root && (
          <div className="mb-3">
            <button
              onClick={() => toggleSection('classes')}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300"
            >
              {expandedSections.has('classes') ? (
                <ChevronDownIcon className="w-3 h-3" />
              ) : (
                <ChevronRightIcon className="w-3 h-3" />
              )}
              <AcademicCapIcon className="w-4 h-4 text-purple-500" />
              MBA Classes
              {mbaData.stats && (
                <span className="ml-auto text-[10px] text-purple-400">
                  {mbaData.stats.sessionsWithRecordings}/{mbaData.stats.totalSessions} with audio
                </span>
              )}
            </button>

            {expandedSections.has('classes') && (
              <div className="mt-1 space-y-0.5">
                {mbaData.semesters.map((semester) => (
                  <div key={semester.id}>
                    {/* Semester header */}
                    <button
                      onClick={() => toggleMbaSemester(semester.id)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                    >
                      {expandedMbaSemesters.has(semester.id) ? (
                        <ChevronDownIcon className="w-3 h-3 text-gray-400" />
                      ) : (
                        <ChevronRightIcon className="w-3 h-3 text-gray-400" />
                      )}
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {semester.icon || '📅'} {semester.title}
                      </span>
                      <span className="ml-auto text-xs text-gray-400">
                        {semester.classes.length} classes
                      </span>
                    </button>

                    {/* Classes in semester */}
                    {expandedMbaSemesters.has(semester.id) && (
                      <div className="ml-3 space-y-0.5">
                        {semester.classes.map((cls) => {
                          const totalRecordings = cls.sessions.reduce((sum, s) => sum + s.recordings.length, 0);
                          const totalNotes = cls.sessions.reduce((sum, s) => sum + s.remarkableNotes.length, 0);

                          return (
                            <div key={cls.id}>
                              {/* Class header */}
                              <button
                                onClick={() => toggleMbaClass(cls.id)}
                                className={clsx(
                                  'w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-left transition-colors',
                                  selectedPageId === cls.id
                                    ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                                )}
                              >
                                {expandedMbaClasses.has(cls.id) ? (
                                  <ChevronDownIcon className="w-3 h-3 text-gray-400" />
                                ) : (
                                  <ChevronRightIcon className="w-3 h-3 text-gray-400" />
                                )}
                                <BookOpenIcon className="w-4 h-4 text-purple-500 flex-shrink-0" />
                                <span className="flex-1 text-sm truncate">{cls.title}</span>
                                <div className="flex items-center gap-1.5">
                                  {totalNotes > 0 && (
                                    <span className="flex items-center gap-0.5 text-[10px] text-amber-500" title="Remarkable notes">
                                      <DocumentIcon className="w-3 h-3" />
                                      {totalNotes}
                                    </span>
                                  )}
                                  {totalRecordings > 0 && (
                                    <span className="flex items-center gap-0.5 text-[10px] text-blue-500" title="Plaud recordings">
                                      <MicrophoneIcon className="w-3 h-3" />
                                      {totalRecordings}
                                    </span>
                                  )}
                                </div>
                              </button>

                              {/* Sessions (dates) under class */}
                              {expandedMbaClasses.has(cls.id) && cls.sessions.length > 0 && (
                                <div className="ml-6 space-y-0.5 mt-0.5">
                                  {cls.sessions.map((session) => (
                                    <button
                                      key={session.id}
                                      onClick={() => onSelectPage(session.id)}
                                      className={clsx(
                                        'w-full flex items-center gap-2 px-2 py-1 rounded text-left transition-colors text-xs',
                                        selectedPageId === session.id
                                          ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 text-gray-600 dark:text-gray-400'
                                      )}
                                    >
                                      <CalendarIcon className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                      <span className="flex-1 truncate">{session.date}</span>
                                      <div className="flex items-center gap-1">
                                        {session.remarkableNotes.length > 0 && (
                                          <DocumentIcon className="w-3 h-3 text-amber-500" title="Has notes" />
                                        )}
                                        {session.recordings.length > 0 && (
                                          <MicrophoneIcon className="w-3 h-3 text-blue-500" title="Has recording" />
                                        )}
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}

                {/* View all link - navigates to MBA root page */}
                <button
                  onClick={() => mbaData.root && onSelectPage(mbaData.root.id)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-md transition-colors"
                >
                  <AcademicCapIcon className="w-3.5 h-3.5" />
                  View all MBA notes
                </button>
              </div>
            )}
          </div>
        )}

        {/* Loading state for MBA classes */}
        {isLoadingMba && (
          <div className="mb-3 px-3 py-2 text-xs text-gray-400">
            Loading MBA classes...
          </div>
        )}

        {/* Quick Access */}
        <div className="mb-3">
          <button
            onClick={() => toggleSection('quickAccess')}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300"
          >
            {expandedSections.has('quickAccess') ? (
              <ChevronDownIcon className="w-3 h-3" />
            ) : (
              <ChevronRightIcon className="w-3 h-3" />
            )}
            Quick Access
          </button>

          {expandedSections.has('quickAccess') && (
            <div className="mt-1 space-y-0.5">
              <button
                onClick={() => onNavigateTo?.('journal')}
                className={clsx(
                  'w-full flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors',
                  activeView === 'journal'
                    ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                )}
              >
                <CalendarIcon className="w-4 h-4 text-amber-500" />
                <span className="text-sm">Journal</span>
              </button>

              <button
                onClick={() => onNavigateTo?.('favorites')}
                className={clsx(
                  'w-full flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors',
                  activeView === 'favorites'
                    ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                )}
              >
                <StarIcon className="w-4 h-4 text-yellow-500" />
                <span className="text-sm">Favorites</span>
                {favorites.length > 0 && (
                  <span className="ml-auto text-xs text-gray-400">{favorites.length}</span>
                )}
              </button>

              <button
                onClick={() => onNavigateTo?.('recordings')}
                className={clsx(
                  'w-full flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors',
                  activeView === 'recordings'
                    ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                )}
              >
                <MicrophoneIcon className="w-4 h-4 text-red-500" />
                <span className="text-sm">Recordings</span>
              </button>
            </div>
          )}
        </div>

        {/* PARA Folders */}
        <div className="mb-3">
          <button
            onClick={() => toggleSection('para')}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300"
          >
            {expandedSections.has('para') ? (
              <ChevronDownIcon className="w-3 h-3" />
            ) : (
              <ChevronRightIcon className="w-3 h-3" />
            )}
            Workspace
          </button>

          {expandedSections.has('para') && (
            <div className="mt-1 space-y-0.5">
              {PARA_CONFIG.map((para) => (
                <button
                  key={para.type}
                  onClick={() => onSelectPage?.(para.type)}
                  className={clsx(
                    'w-full flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors',
                    activeView === `para-${para.type}`
                      ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                  )}
                >
                  <span className="text-base">{para.icon}</span>
                  <span className="text-sm">{para.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pages Tree */}
        <div className="mb-3">
          <button
            onClick={() => toggleSection('pages')}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300"
          >
            {expandedSections.has('pages') ? (
              <ChevronDownIcon className="w-3 h-3" />
            ) : (
              <ChevronRightIcon className="w-3 h-3" />
            )}
            All Pages
            {pageTree.length > 0 && (
              <span className="ml-auto text-xs font-normal text-gray-400 dark:text-gray-500">
                {pageTree.length}
              </span>
            )}
          </button>

          {expandedSections.has('pages') && (
            <div className="mt-1">
              {isLoading ? (
                <div className="px-4 py-2 text-xs text-gray-400">Loading...</div>
              ) : pageTree.length === 0 ? (
                <div className="px-4 py-4 text-center">
                  <DocumentTextIcon className="w-6 h-6 mx-auto text-gray-300 dark:text-gray-600 mb-1" />
                  <p className="text-xs text-gray-400 dark:text-gray-500">No pages yet</p>
                  <button
                    onClick={() => onCreatePage?.()}
                    className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Create first page
                  </button>
                </div>
              ) : (
                pageTree.map((node) => (
                  <PageTreeItem
                    key={node.id}
                    node={node}
                    depth={0}
                    isExpanded={expandedPages.has(node.id)}
                    onToggle={() => togglePage(node.id)}
                    isSelected={selectedPageId === node.id}
                    onSelect={() => onSelectPage(node.id)}
                    expandedPages={expandedPages}
                    onTogglePage={togglePage}
                    selectedPageId={selectedPageId}
                    onSelectPage={onSelectPage}
                    onCreatePage={onCreatePage}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer: Ask AI + Theme Toggle */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
        {onOpenChat && (
          <button
            onClick={onOpenChat}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
          >
            <ChatBubbleLeftRightIcon className="w-4 h-4" />
            <span>Ask AI</span>
          </button>
        )}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          {isDark ? (
            <>
              <SunIcon className="w-4 h-4" />
              <span>Light mode</span>
            </>
          ) : (
            <>
              <MoonIcon className="w-4 h-4" />
              <span>Dark mode</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

// Page tree item component
interface PageTreeItemProps {
  node: VaultPageTreeNode;
  depth: number;
  isExpanded: boolean;
  onToggle: () => void;
  isSelected: boolean;
  onSelect: () => void;
  expandedPages: Set<string>;
  onTogglePage: (id: string) => void;
  selectedPageId: string | null;
  onSelectPage: (id: string) => void;
  onCreatePage?: (parentId?: string) => void;
}

function PageTreeItem({
  node,
  depth,
  isExpanded,
  onToggle,
  isSelected,
  onSelect,
  expandedPages,
  onTogglePage,
  selectedPageId,
  onSelectPage,
  onCreatePage,
}: PageTreeItemProps) {
  const hasChildren = node.children && node.children.length > 0;
  const paddingLeft = 8 + depth * 12;

  return (
    <div>
      <div
        className={clsx(
          'flex items-center gap-1 py-1 pr-2 rounded-md group cursor-pointer transition-colors',
          isSelected
            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
            : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
        )}
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={onSelect}
      >
        {/* Expand/collapse button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={clsx(
            'p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0',
            !hasChildren && 'invisible'
          )}
        >
          {isExpanded ? (
            <ChevronDownIcon className="w-3 h-3 text-gray-400" />
          ) : (
            <ChevronRightIcon className="w-3 h-3 text-gray-400" />
          )}
        </button>

        {/* Icon */}
        <span className="flex-shrink-0 text-sm">{node.icon || '📄'}</span>

        {/* Title */}
        <span className="flex-1 text-sm truncate">{node.title}</span>

        {/* Add child button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCreatePage?.(node.id);
          }}
          className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
          title="Add nested page"
        >
          <PlusIcon className="w-3 h-3 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <PageTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              isExpanded={expandedPages.has(child.id)}
              onToggle={() => onTogglePage(child.id)}
              isSelected={selectedPageId === child.id}
              onSelect={() => onSelectPage(child.id)}
              expandedPages={expandedPages}
              onTogglePage={onTogglePage}
              selectedPageId={selectedPageId}
              onSelectPage={onSelectPage}
              onCreatePage={onCreatePage}
            />
          ))}
        </div>
      )}
    </div>
  );
}

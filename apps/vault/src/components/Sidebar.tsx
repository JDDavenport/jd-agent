import { useState } from 'react';
import {
  InboxIcon,
  ArchiveBoxIcon,
  UsersIcon,
  CalendarIcon,
  MicrophoneIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon,
  StarIcon,
  TagIcon,
  Squares2X2Icon,
  FlagIcon,
  BookOpenIcon,
  HomeIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import { clsx } from 'clsx';
import { PageTree } from './PageTreeItem';
import { ThemeToggle } from './ThemeToggle';
import type { VaultTreeNode } from '../api';

export type ViewType =
  | 'search'
  | 'inbox'
  | 'favorites'
  | 'journal'
  | 'goals'
  | 'archive'
  | 'projects'
  | 'areas'
  | 'resources'
  | 'people'
  | 'recordings'
  | 'tags'
  | 'folder'
  | 'page';

interface NavItem {
  id: string;
  name: string;
  icon: typeof InboxIcon;
  count?: number;
  type: ViewType;
}

interface SidebarProps {
  selectedView: string;
  onSelectView: (viewId: string, type: ViewType) => void;
  inboxCount?: number;
  favoritesCount?: number;
  onNewEntry?: (parentId?: string) => void;
  tree?: VaultTreeNode[];
  isLoadingTree?: boolean;
}

export function Sidebar({
  selectedView,
  onSelectView,
  inboxCount = 0,
  favoritesCount = 0,
  onNewEntry,
  tree = [],
  isLoadingTree = false,
}: SidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['pages'])
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const mainNav: NavItem[] = [
    { id: 'search', name: 'Search', icon: MagnifyingGlassIcon, type: 'search' },
    { id: 'inbox', name: 'Inbox', icon: InboxIcon, count: inboxCount, type: 'inbox' },
    { id: 'favorites', name: 'Favorites', icon: StarIcon, count: favoritesCount, type: 'favorites' },
    { id: 'journal', name: 'Journal', icon: CalendarIcon, type: 'journal' },
    { id: 'goals', name: 'Goals', icon: FlagIcon, type: 'goals' },
    { id: 'archive', name: 'Archive', icon: ArchiveBoxIcon, type: 'archive' },
  ];

  const browseNav: NavItem[] = [
    { id: 'people', name: 'People', icon: UsersIcon, type: 'people' },
    { id: 'recordings', name: 'Recordings', icon: MicrophoneIcon, type: 'recordings' },
    { id: 'tags', name: 'Tags', icon: TagIcon, type: 'tags' },
  ];

  const externalApps = [
    {
      name: 'Books',
      url: 'http://localhost:5183',
      icon: BookOpenIcon,
    },
    {
      name: 'Command Center',
      url: 'http://localhost:5173',
      icon: HomeIcon,
    },
  ];

  const handlePageSelect = (id: string) => {
    onSelectView(id, 'page');
  };

  const handleAddChild = (parentId: string) => {
    onNewEntry?.(parentId);
  };

  return (
    <aside className="w-64 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 h-screen flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Squares2X2Icon className="w-6 h-6 text-purple-500 dark:text-purple-400" />
          JD Vault
        </h1>
      </div>

      {/* New Entry Button */}
      <div className="p-3">
        <button
          onClick={() => onNewEntry?.()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-500 dark:bg-purple-600 text-white rounded-lg hover:bg-purple-600 dark:hover:bg-purple-700 transition-colors text-sm font-medium"
        >
          <PlusIcon className="w-4 h-4" />
          New Page
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        {/* Main Navigation */}
        <div className="space-y-1">
          {mainNav.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id, item.type)}
              className={clsx(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                selectedView === item.id
                  ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="flex-1 text-left">{item.name}</span>
              {item.count !== undefined && item.count > 0 && (
                <span
                  className={clsx(
                    'px-2 py-0.5 rounded-full text-xs',
                    selectedView === item.id
                      ? 'bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  )}
                >
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Pages Section */}
        <div className="mt-6">
          <button
            onClick={() => toggleSection('pages')}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300"
          >
            {expandedSections.has('pages') ? (
              <ChevronDownIcon className="w-4 h-4" />
            ) : (
              <ChevronRightIcon className="w-4 h-4" />
            )}
            <DocumentTextIcon className="w-4 h-4" />
            Pages
          </button>
          {expandedSections.has('pages') && (
            <div className="mt-1">
              {isLoadingTree ? (
                <div className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">Loading...</div>
              ) : (
                <PageTree
                  nodes={tree}
                  selectedId={selectedView}
                  onSelect={handlePageSelect}
                  onAddChild={handleAddChild}
                  onAddRoot={() => onNewEntry?.()}
                  emptyMessage="No pages yet"
                />
              )}
            </div>
          )}
        </div>

        {/* Browse */}
        <div className="mt-6">
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Browse
          </div>
          <div className="mt-1 space-y-1">
            {browseNav.map((item) => (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id, item.type)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  selectedView === item.id
                    ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="flex-1 text-left">{item.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Apps */}
        <div className="mt-6">
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Apps
          </div>
          <div className="mt-1 space-y-1">
            {externalApps.map((app) => (
              <a
                key={app.name}
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <app.icon className="w-5 h-5" />
                <span className="flex-1 text-left">{app.name}</span>
                <ArrowTopRightOnSquareIcon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              </a>
            ))}
          </div>
        </div>
      </nav>

      {/* Footer with Theme Toggle and Shortcuts */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">Theme</span>
          <ThemeToggle variant="dropdown" />
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500">
          <p>
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">⌘K</kbd> Search
          </p>
          <p className="mt-1">
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">N</kbd> New page
          </p>
        </div>
      </div>
    </aside>
  );
}

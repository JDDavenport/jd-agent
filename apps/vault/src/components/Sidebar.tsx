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
} from '@heroicons/react/24/outline';
import { clsx } from 'clsx';
import { PageTree } from './PageTreeItem';
import type { VaultTreeNode } from '../api';

export type ViewType =
  | 'search'
  | 'inbox'
  | 'favorites'
  | 'journal'
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
    { id: 'archive', name: 'Archive', icon: ArchiveBoxIcon, type: 'archive' },
  ];

  const browseNav: NavItem[] = [
    { id: 'people', name: 'People', icon: UsersIcon, type: 'people' },
    { id: 'recordings', name: 'Recordings', icon: MicrophoneIcon, type: 'recordings' },
    { id: 'tags', name: 'Tags', icon: TagIcon, type: 'tags' },
  ];

  const handlePageSelect = (id: string) => {
    onSelectView(id, 'page');
  };

  const handleAddChild = (parentId: string) => {
    onNewEntry?.(parentId);
  };

  return (
    <aside className="w-64 bg-gray-50 border-r border-gray-200 h-screen flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Squares2X2Icon className="w-6 h-6 text-purple-500" />
          JD Vault
        </h1>
      </div>

      {/* New Entry Button */}
      <div className="p-3">
        <button
          onClick={() => onNewEntry?.()}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm font-medium"
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
                  ? 'bg-purple-100 text-purple-700'
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
                      ? 'bg-purple-200 text-purple-800'
                      : 'bg-gray-200 text-gray-600'
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
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700"
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
                <div className="px-3 py-2 text-sm text-gray-400">Loading...</div>
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
          <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
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
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="flex-1 text-left">{item.name}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Keyboard Shortcuts */}
      <div className="p-4 border-t border-gray-200 text-xs text-gray-400">
        <p>
          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded">⌘K</kbd> Search
        </p>
        <p className="mt-1">
          <kbd className="px-1.5 py-0.5 bg-gray-100 rounded">N</kbd> New page
        </p>
      </div>
    </aside>
  );
}

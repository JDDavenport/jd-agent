import { useState, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import {
  MagnifyingGlassIcon,
  ClockIcon,
  DocumentTextIcon,
  FolderIcon,
  CalendarIcon,
  InboxIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import type { VaultEntry } from '../api';

type SearchFilter = 'all' | 'notes' | 'tasks';

const NOTE_CONTENT_TYPES = [
  'note',
  'journal',
  'document',
  'class_notes',
  'meeting_notes',
  'reference',
  'article',
  'lecture',
  'recording_summary',
];

interface SearchViewProps {
  recentEntries?: VaultEntry[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchResults?: VaultEntry[];
  isSearching?: boolean;
  onSelectEntry?: (entry: VaultEntry) => void;
  onQuickAction?: (action: string) => void;
}

const QUICK_ACCESS = [
  { id: 'inbox', name: 'Inbox', icon: InboxIcon, color: 'text-blue-500' },
  { id: 'journal', name: "Today's Journal", icon: CalendarIcon, color: 'text-purple-500' },
  { id: 'favorites', name: 'Favorites', icon: StarIcon, color: 'text-yellow-500' },
  { id: 'projects', name: 'Active Projects', icon: FolderIcon, color: 'text-green-500' },
];

const BROWSE_OPTIONS = [
  { id: 'projects', name: 'Projects', icon: FolderIcon },
  { id: 'areas', name: 'Areas', icon: DocumentTextIcon },
  { id: 'resources', name: 'Resources', icon: DocumentTextIcon },
  { id: 'people', name: 'People', icon: DocumentTextIcon },
  { id: 'journal', name: 'Journal', icon: CalendarIcon },
  { id: 'recordings', name: 'Recordings', icon: DocumentTextIcon },
];

export function SearchView({
  recentEntries = [],
  searchQuery,
  onSearchChange,
  searchResults = [],
  isSearching,
  onSelectEntry,
  onQuickAction,
}: SearchViewProps) {
  const [activeFilter, setActiveFilter] = useState<SearchFilter>('all');
  const showResults = searchQuery.trim().length > 0;

  // Filter search results based on active filter
  const filteredResults = useMemo(() => {
    if (!searchResults || searchResults.length === 0) return [];
    if (activeFilter === 'all') return searchResults;
    if (activeFilter === 'notes') {
      return searchResults.filter((e) =>
        NOTE_CONTENT_TYPES.includes(e.contentType)
      );
    }
    if (activeFilter === 'tasks') {
      return searchResults.filter((e) => e.contentType === 'task_archive');
    }
    return searchResults;
  }, [searchResults, activeFilter]);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Search Bar */}
      <div className="relative mb-8">
        <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search your vault..."
          className="w-full pl-12 pr-16 py-4 text-lg border border-gray-200 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none shadow-sm"
          autoFocus
        />
        <kbd className="absolute right-4 top-1/2 -translate-y-1/2 px-2 py-1 text-xs bg-gray-100 rounded text-gray-500">
          ⌘K
        </kbd>
      </div>

      {showResults ? (
        /* Search Results */
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-gray-500">
              {isSearching
                ? 'Searching...'
                : `Found ${filteredResults.length} results`}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  activeFilter === 'all'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setActiveFilter('notes')}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  activeFilter === 'notes'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Notes
              </button>
              <button
                onClick={() => setActiveFilter('tasks')}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  activeFilter === 'tasks'
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Tasks
              </button>
            </div>
          </div>

          {filteredResults.length === 0 && !isSearching ? (
            <div className="text-center py-12">
              <MagnifyingGlassIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No results found</h3>
              <p className="text-gray-500">
                {activeFilter !== 'all'
                  ? `No ${activeFilter} match your search. Try "All" filter.`
                  : 'Try adjusting your search terms'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredResults.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => onSelectEntry?.(entry)}
                  className="w-full text-left p-4 bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <DocumentTextIcon className="w-5 h-5 text-gray-400 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900">{entry.title}</h3>
                      {entry.content && (
                        <p className="text-sm text-gray-500 line-clamp-2 mt-1">
                          {entry.content.substring(0, 150)}...
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                        <span className="capitalize">
                          {entry.contentType.replace('_', ' ')}
                        </span>
                        <span>•</span>
                        <span>{entry.context}</span>
                        <span>•</span>
                        <span>{format(parseISO(entry.updatedAt), 'MMM d')}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Default Home View */
        <>
          {/* Recent */}
          {recentEntries.length > 0 && (
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <ClockIcon className="w-4 h-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                  Recent
                </h2>
              </div>
              <div className="space-y-2">
                {recentEntries.slice(0, 5).map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => onSelectEntry?.(entry)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors text-left"
                  >
                    <DocumentTextIcon className="w-5 h-5 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-gray-900">{entry.title}</span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {format(parseISO(entry.updatedAt), 'MMM d')}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Quick Access */}
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
              Quick Access
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {QUICK_ACCESS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onQuickAction?.(item.id)}
                  className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors text-left"
                >
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                  <span className="font-medium text-gray-900">{item.name}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Browse By */}
          <section>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
              Browse By
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {BROWSE_OPTIONS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onQuickAction?.(item.id)}
                  className="flex flex-col items-center gap-2 px-4 py-4 bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
                >
                  <item.icon className="w-6 h-6 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">{item.name}</span>
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  MagnifyingGlassIcon,
  DocumentIcon,
  PlusIcon,
  StarIcon,
} from '@heroicons/react/24/outline';
import { useVaultPageQuickFind } from '../hooks/useVaultPages';
import { useVaultSearch } from '../hooks/useVault';
import type { VaultEntry, VaultPage } from '@jd-agent/types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPage: (pageId: string) => void;
  onSelectLegacyEntry: (entry: VaultEntry) => void;
  onCreatePage: () => void;
}

interface CommandItem {
  id: string;
  type: 'page' | 'legacy' | 'action';
  title: string;
  subtitle?: string;
  icon?: string;
  isFavorite?: boolean;
  action?: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  onSelectPage,
  onSelectLegacyEntry,
  onCreatePage,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Search vault pages (Notion-style)
  const { data: pageSearchResults = [], isLoading: isLoadingPages } = useVaultPageQuickFind(query);

  // Search vault entries (Legacy) - searches title AND content
  const { data: entrySearchResults = [], isLoading: isLoadingEntries } = useVaultSearch({
    query,
    limit: 10
  });

  const isLoading = isLoadingPages || isLoadingEntries;

  // Build command items
  const items = useMemo(() => {
    const results: CommandItem[] = [];

    // If no query, show actions first
    if (!query) {
      results.push({
        id: 'new-page',
        type: 'action',
        title: 'New page',
        subtitle: 'Create a blank page',
        action: () => {
          onCreatePage();
          onClose();
        },
      });
    }

    // Add page search results
    pageSearchResults.forEach((page: VaultPage) => {
      results.push({
        id: page.id,
        type: 'page',
        title: page.title || 'Untitled',
        icon: page.icon || undefined,
        isFavorite: page.isFavorite,
      });
    });

    // Add legacy entry search results (from API - searches title + content)
    if (query && entrySearchResults.length > 0) {
      entrySearchResults.forEach((entry) => {
        // Check if content contains the query (for subtitle hint)
        const contentMatch = entry.content?.toLowerCase().includes(query.toLowerCase());
        const subtitle = contentMatch
          ? `${entry.contentType} • Match in content`
          : entry.contentType;

        results.push({
          id: `legacy-${entry.id}`,
          type: 'legacy',
          title: entry.title,
          subtitle,
        });
      });
    }

    return results;
  }, [query, pageSearchResults, entrySearchResults, onCreatePage, onClose]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Reset selected index when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [items.length]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && items.length > 0) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, items.length]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (items[selectedIndex]) {
            handleSelect(items[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [items, selectedIndex, onClose]
  );

  const handleSelect = useCallback(
    (item: CommandItem) => {
      switch (item.type) {
        case 'page':
          onSelectPage(item.id);
          onClose();
          break;
        case 'legacy':
          const entryId = item.id.replace('legacy-', '');
          const entry = entrySearchResults.find((e) => e.id === entryId);
          if (entry) {
            onSelectLegacyEntry(entry);
            onClose();
          }
          break;
        case 'action':
          item.action?.();
          break;
      }
    },
    [onSelectPage, onSelectLegacyEntry, onClose, entrySearchResults]
  );

  if (!isOpen) return null;

  return (
    <div data-testid="command-palette" className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div data-testid="command-palette-backdrop" className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Palette */}
      <div data-testid="command-palette-panel" className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
          <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <input
            ref={inputRef}
            data-testid="command-palette-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages or type a command..."
            className="flex-1 bg-transparent border-none outline-none text-gray-900 placeholder-gray-400"
          />
          <kbd className="hidden sm:block px-2 py-1 text-xs text-gray-400 bg-gray-100 rounded">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} data-testid="command-palette-results" className="max-h-80 overflow-y-auto py-2">
          {items.length === 0 && query && !isLoading && (
            <div className="px-4 py-8 text-center text-gray-500">
              <p>No results found for "{query}"</p>
              <button
                onClick={() => {
                  onCreatePage();
                  onClose();
                }}
                className="mt-2 text-sm text-blue-600 hover:underline"
              >
                Create new page "{query}"
              </button>
            </div>
          )}

          {items.length === 0 && !query && (
            <div className="px-4 py-4 text-sm text-gray-500">
              Start typing to search pages...
            </div>
          )}

          {items.map((item, index) => (
            <button
              key={item.id}
              onClick={() => handleSelect(item)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                index === selectedIndex ? 'bg-gray-100' : 'hover:bg-gray-50'
              }`}
            >
              {/* Icon */}
              <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
                {item.type === 'action' && <PlusIcon className="w-4 h-4 text-gray-600" />}
                {item.type === 'page' && (
                  <span className="text-lg">{item.icon || '📄'}</span>
                )}
                {item.type === 'legacy' && (
                  <DocumentIcon className="w-4 h-4 text-gray-500" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {item.title}
                  </span>
                  {item.isFavorite && (
                    <StarIcon className="w-3 h-3 text-yellow-400 flex-shrink-0" />
                  )}
                </div>
                {item.subtitle && (
                  <div className="text-xs text-gray-500 truncate">{item.subtitle}</div>
                )}
              </div>

              {/* Type badge */}
              <div className="flex-shrink-0">
                {item.type === 'legacy' && (
                  <span className="px-2 py-0.5 text-xs text-gray-500 bg-gray-100 rounded">
                    Legacy
                  </span>
                )}
                {item.type === 'action' && (
                  <kbd className="px-2 py-0.5 text-xs text-gray-400 bg-gray-100 rounded">
                    Enter
                  </kbd>
                )}
              </div>
            </button>
          ))}

          {isLoading && (
            <div className="px-4 py-2 text-sm text-gray-500">Searching...</div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span>
                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">↑</kbd>
                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded ml-1">↓</kbd>
                <span className="ml-1">to navigate</span>
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">↵</kbd>
                <span className="ml-1">to select</span>
              </span>
            </div>
            <span>
              <kbd className="px-1.5 py-0.5 bg-gray-200 rounded">⌘K</kbd>
              <span className="ml-1">to open</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

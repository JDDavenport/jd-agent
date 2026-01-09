'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, FileText, ArrowRight, X } from 'lucide-react';
import clsx from 'clsx';

interface SearchResult {
  title: string;
  href: string;
  excerpt: string;
  category: string;
}

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

export function SearchModal({ open, onClose }: SearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  // Search function
  const search = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setResults(data.results || []);
      setSelectedIndex(0);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    }
    setLoading(false);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      search(query);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, search]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            router.push(results[selectedIndex].href);
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, results, selectedIndex, router, onClose]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [open]);

  if (!open) return null;

  // Group results by category
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.category]) {
      acc[result.category] = [];
    }
    acc[result.category].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  let flatIndex = -1;

  return (
    <div className="fixed inset-0 z-50 animate-fade-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative flex items-start justify-center pt-[15vh] px-4">
        <div className="w-full max-w-xl bg-background rounded-xl shadow-2xl border border-border overflow-hidden animate-slide-up">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documentation..."
              className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-base"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="p-1 text-muted-foreground hover:text-foreground rounded"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <kbd className="kbd">esc</kbd>
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center text-muted-foreground">
                Searching...
              </div>
            ) : query.length < 2 ? (
              <div className="px-4 py-8 text-center text-muted-foreground">
                Type at least 2 characters to search
              </div>
            ) : results.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground">
                No results found for "{query}"
              </div>
            ) : (
              <div className="py-2">
                {Object.entries(groupedResults).map(([category, categoryResults]) => (
                  <div key={category}>
                    <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {category}
                    </div>
                    {categoryResults.map((result) => {
                      flatIndex++;
                      const isSelected = flatIndex === selectedIndex;
                      const currentIndex = flatIndex;

                      return (
                        <button
                          key={result.href}
                          onClick={() => {
                            router.push(result.href);
                            onClose();
                          }}
                          onMouseEnter={() => setSelectedIndex(currentIndex)}
                          className={clsx(
                            'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors',
                            isSelected ? 'bg-muted' : 'hover:bg-muted/50'
                          )}
                        >
                          <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-foreground">
                              {result.title}
                            </div>
                            <div className="text-sm text-muted-foreground truncate">
                              {result.excerpt}
                            </div>
                          </div>
                          {isSelected && (
                            <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <kbd className="kbd">↑</kbd>
              <kbd className="kbd">↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="kbd">↵</kbd>
              open
            </span>
            <span className="flex items-center gap-1">
              <kbd className="kbd">esc</kbd>
              close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

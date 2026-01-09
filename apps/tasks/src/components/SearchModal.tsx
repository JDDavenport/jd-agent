import { useState, useEffect, useRef } from 'react';
import { Dialog } from '@headlessui/react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useTasks } from '../hooks/useTasks';
import { TaskCard } from './TaskCard';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: allTasks } = useTasks();

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Filter tasks based on query
  const results = query.trim()
    ? (allTasks || []).filter((task) => {
        const searchLower = query.toLowerCase();
        return (
          task.title.toLowerCase().includes(searchLower) ||
          task.description?.toLowerCase().includes(searchLower) ||
          task.context.toLowerCase().includes(searchLower) ||
          task.taskLabels?.some((l) => l.toLowerCase().includes(searchLower)) ||
          task.taskContexts?.some((c) => c.toLowerCase().includes(searchLower))
        );
      })
    : [];

  const handleComplete = (id: string) => {
    // TODO: Implement complete
    console.log('Complete:', id);
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-start justify-center pt-[15vh] px-4">
        <Dialog.Panel className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks..."
              className="flex-1 text-lg outline-none placeholder-gray-400"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <XMarkIcon className="w-5 h-5 text-gray-400" />
              </button>
            )}
            <kbd className="px-2 py-1 text-xs bg-gray-100 rounded text-gray-500">esc</kbd>
          </div>

          {/* Results */}
          <div className="max-h-[50vh] overflow-y-auto">
            {!query ? (
              <div className="px-4 py-8 text-center text-gray-500">
                <p className="text-sm">Start typing to search tasks</p>
                <div className="mt-4 text-xs text-gray-400 space-y-1">
                  <p><strong>Tip:</strong> Search by title, description, context, or labels</p>
                  <p>Use <code className="bg-gray-100 px-1 rounded">@context</code> to filter by GTD context</p>
                  <p>Use <code className="bg-gray-100 px-1 rounded">#label</code> to filter by label</p>
                </div>
              </div>
            ) : results.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                <p>No tasks found for "{query}"</p>
              </div>
            ) : (
              <div>
                <div className="px-4 py-2 text-xs text-gray-500 bg-gray-50">
                  {results.length} {results.length === 1 ? 'result' : 'results'}
                </div>
                {results.slice(0, 10).map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={handleComplete}
                    onSelect={() => {
                      // TODO: Open task detail
                      onClose();
                    }}
                  />
                ))}
                {results.length > 10 && (
                  <div className="px-4 py-3 text-center text-sm text-gray-500 bg-gray-50">
                    +{results.length - 10} more results
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center gap-4">
              <span><kbd className="px-1.5 py-0.5 bg-white border rounded">↑↓</kbd> Navigate</span>
              <span><kbd className="px-1.5 py-0.5 bg-white border rounded">↵</kbd> Open</span>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              Close
            </button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}

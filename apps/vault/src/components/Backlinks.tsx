import { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon, LinkIcon } from '@heroicons/react/24/outline';
import { useVaultPageBacklinks } from '../hooks/useVaultPages';

interface BacklinksProps {
  pageId: string;
  onNavigate: (pageId: string) => void;
}

export function Backlinks({ pageId, onNavigate }: BacklinksProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { data: backlinks = [], isLoading } = useVaultPageBacklinks(pageId);

  // Don't render if no backlinks and not loading
  if (!isLoading && backlinks.length === 0) {
    return null;
  }

  return (
    <div className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-700">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        {isExpanded ? (
          <ChevronDownIcon className="w-4 h-4" />
        ) : (
          <ChevronRightIcon className="w-4 h-4" />
        )}
        <LinkIcon className="w-4 h-4" />
        <span>Backlinks</span>
        <span className="text-gray-400 dark:text-gray-500">({backlinks.length})</span>
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-1">
          {isLoading ? (
            <div className="text-sm text-gray-400 dark:text-gray-500">Loading...</div>
          ) : (
            backlinks.map((link) => (
              <button
                key={link.id}
                onClick={() => onNavigate(link.id)}
                className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors text-left"
              >
                <span className="flex-shrink-0">{link.icon || '📄'}</span>
                <span className="truncate">{link.title}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

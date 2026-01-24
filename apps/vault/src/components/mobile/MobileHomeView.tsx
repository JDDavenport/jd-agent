import { useState, useCallback } from 'react';
import { ChevronRightIcon, StarIcon, PlusIcon } from '@heroicons/react/24/outline';
import type { VaultPageTreeNode, VaultPage } from '../../lib/types';

interface MobileHomeViewProps {
  pageTree: VaultPageTreeNode[];
  favorites: VaultPage[];
  onSelectPage: (pageId: string) => void;
  onCreatePage: (parentId?: string) => void;
}

export function MobileHomeView({
  pageTree,
  favorites,
  onSelectPage,
  onCreatePage,
}: MobileHomeViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const renderPageItem = (node: VaultPageTreeNode, depth = 0, _isLast = false) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);

    return (
      <div key={node.id} className="relative">
        {/* Vertical tree line for nested items */}
        {depth > 0 && (
          <div
            className="absolute left-0 top-0 bottom-0 border-l-2 border-gray-200"
            style={{ left: `${12 + (depth - 1) * 24}px` }}
          />
        )}

        <button
          onClick={() => onSelectPage(node.id)}
          className="w-full flex items-center gap-2 py-3 text-left hover:bg-blue-50 active:bg-blue-100 touch-manipulation transition-colors border-b border-gray-100 relative"
          style={{ paddingLeft: `${16 + depth * 24}px`, paddingRight: '16px' }}
        >
          {/* Horizontal tree connector line */}
          {depth > 0 && (
            <div
              className="absolute border-t-2 border-gray-200"
              style={{
                left: `${12 + (depth - 1) * 24}px`,
                width: '12px',
                top: '50%',
              }}
            />
          )}

          {/* Expand/Collapse chevron for hierarchy */}
          {hasChildren ? (
            <button
              onClick={(e) => toggleExpanded(node.id, e)}
              className="p-1.5 -ml-1 rounded-lg bg-gray-100 hover:bg-gray-200 active:bg-gray-300 touch-manipulation flex-shrink-0"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              <ChevronRightIcon
                className={`w-4 h-4 text-gray-600 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
              />
            </button>
          ) : (
            <div className="w-7 flex-shrink-0" />
          )}

          {/* Page icon */}
          <span className="text-xl flex-shrink-0">{node.icon || '📄'}</span>

          {/* Page/Note title with explicit label */}
          <div className="flex-1 min-w-0">
            <span className="text-xs text-gray-400 block">Note</span>
            <span className="font-medium text-gray-900 truncate block">{node.title}</span>
          </div>

          {/* Favorite indicator */}
          {node.isFavorite && (
            <StarIcon className="w-4 h-4 text-yellow-500 flex-shrink-0" />
          )}

          {/* Child count badge */}
          {hasChildren && (
            <span className="px-2 py-0.5 text-xs font-medium text-blue-600 bg-blue-100 rounded-full flex-shrink-0">
              {node.children.length}
            </span>
          )}
        </button>

        {/* Nested children with visible indentation and tree lines */}
        {hasChildren && isExpanded && (
          <div className="relative">
            {node.children.map((child, index) =>
              renderPageItem(child, depth + 1, index === node.children.length - 1)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain bg-white">
      {/* Favorites Section */}
      {favorites.length > 0 && (
        <div className="mb-4">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <StarIcon className="w-4 h-4 text-yellow-500" />
              Favorites
            </h2>
          </div>
          {favorites.map((page) => (
            <button
              key={page.id}
              onClick={() => onSelectPage(page.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-100 touch-manipulation transition-colors border-b border-gray-100"
            >
              <span className="text-xl">{page.icon || '📄'}</span>
              <span className="flex-1 font-medium text-gray-900 truncate">{page.title}</span>
              <StarIcon className="w-4 h-4 text-yellow-500 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* All Pages Section - Hierarchical List */}
      <div>
        <div className="px-4 py-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-blue-900">
              All Notes (Hierarchical)
            </h2>
            <p className="text-xs text-blue-600">Tap chevron to expand nested notes</p>
          </div>
          <button
            onClick={() => onCreatePage()}
            className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg active:bg-blue-700 touch-manipulation"
            aria-label="Create new note"
          >
            <PlusIcon className="w-4 h-4" />
            <span className="text-sm font-medium">New Note</span>
          </button>
        </div>

        {pageTree.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="text-4xl mb-3">📝</div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No notes yet</h3>
            <p className="text-sm text-gray-500 mb-4">
              Create your first note to get started
            </p>
            <button
              onClick={() => onCreatePage()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium active:bg-blue-700 touch-manipulation"
            >
              <PlusIcon className="w-5 h-5" />
              Create Note
            </button>
          </div>
        ) : (
          <div>
            {pageTree.map((node) => renderPageItem(node))}
          </div>
        )}
      </div>

      {/* Bottom padding for navigation */}
      <div className="h-4" />
    </div>
  );
}

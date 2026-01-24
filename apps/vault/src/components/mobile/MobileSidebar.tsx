import { useEffect, useRef, useState, useCallback } from 'react';
import { XMarkIcon, ChevronRightIcon, PlusIcon, StarIcon } from '@heroicons/react/24/outline';
import type { VaultPageTreeNode, VaultPage } from '../../lib/types';

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  pageTree: VaultPageTreeNode[];
  favorites: VaultPage[];
  selectedPageId: string | null;
  onSelectPage: (pageId: string) => void;
  onCreatePage: (parentId?: string) => void;
}

export function MobileSidebar({
  isOpen,
  onClose,
  pageTree,
  favorites,
  selectedPageId,
  onSelectPage,
  onCreatePage,
}: MobileSidebarProps) {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const toggleExpanded = useCallback((id: string) => {
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

  const renderPageItem = (node: VaultPageTreeNode, depth = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);
    const isSelected = node.id === selectedPageId;

    return (
      <div key={node.id}>
        <button
          onClick={() => onSelectPage(node.id)}
          className={`
            w-full flex items-center gap-2 px-3 py-3 text-left
            ${isSelected ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'}
            touch-manipulation transition-colors
          `}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(node.id);
              }}
              className="p-1 -ml-1 rounded hover:bg-gray-200 touch-manipulation"
            >
              <ChevronRightIcon
                className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              />
            </button>
          )}
          {!hasChildren && <div className="w-6" />}

          <span className="text-lg">{node.icon || '📄'}</span>
          <span className="flex-1 truncate font-medium">{node.title}</span>

          {node.isFavorite && <StarIcon className="w-4 h-4 text-yellow-500 flex-shrink-0" />}
        </button>

        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => renderPageItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`
          fixed inset-0 bg-black/50 z-40 transition-opacity duration-300
          ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar Panel */}
      <div
        ref={sidebarRef}
        className={`
          fixed top-0 left-0 bottom-0 w-[85%] max-w-[320px] bg-white z-50
          transform transition-transform duration-300 ease-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          flex flex-col safe-area-inset-left
        `}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">JD Vault</h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 touch-manipulation"
            aria-label="Close menu"
          >
            <XMarkIcon className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* Favorites Section */}
          {favorites.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Favorites
              </div>
              {favorites.map((page) => (
                <button
                  key={page.id}
                  onClick={() => onSelectPage(page.id)}
                  className={`
                    w-full flex items-center gap-2 px-4 py-3 text-left
                    ${page.id === selectedPageId ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50 active:bg-gray-100'}
                    touch-manipulation transition-colors
                  `}
                >
                  <span className="text-lg">{page.icon || '📄'}</span>
                  <span className="flex-1 truncate font-medium">{page.title}</span>
                  <StarIcon className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* All Pages Section */}
          <div className="py-2">
            <div className="px-4 py-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Pages
              </span>
              <button
                onClick={() => onCreatePage()}
                className="p-1 rounded hover:bg-gray-200 active:bg-gray-300 touch-manipulation"
                aria-label="Create new page"
              >
                <PlusIcon className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            {pageTree.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                <p className="mb-3">No pages yet</p>
                <button
                  onClick={() => onCreatePage()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg active:bg-gray-700 touch-manipulation"
                >
                  <PlusIcon className="w-5 h-5" />
                  Create your first page
                </button>
              </div>
            ) : (
              pageTree.map((node) => renderPageItem(node))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={() => onCreatePage()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium active:bg-blue-700 touch-manipulation"
          >
            <PlusIcon className="w-5 h-5" />
            New Page
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * MobileHomeView - Redesigned mobile home with Classes prominently featured
 *
 * Sections:
 * 1. Quick Actions (New, Search, AI, Journal)
 * 2. MBA Classes (current semester)
 * 3. Recent Pages
 * 4. Favorites
 * 5. All Notes (hierarchical)
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  ChevronRightIcon,
  StarIcon,
  PlusIcon,
  ArchiveBoxIcon,
  TrashIcon,
  AcademicCapIcon,
  BookOpenIcon,
  MicrophoneIcon,
  DocumentIcon,
} from '@heroicons/react/24/outline';
import type { VaultPageTreeNode, VaultPage } from '../../lib/types';
import { useMbaClasses } from '../../hooks/useMbaClasses';

declare const __BUILD_DATE__: string;

interface MobileHomeViewProps {
  pageTree: VaultPageTreeNode[];
  favorites: VaultPage[];
  recentPages?: VaultPage[];
  onQuickAction?: (action: 'journal' | 'archive' | 'classes') => void;
  onOpenSearch?: () => void;
  onOpenChat?: () => void;
  onRefresh?: () => Promise<void> | void;
  onFavoritePage?: (pageId: string) => void;
  onArchivePage?: (pageId: string) => void;
  onDeletePage?: (pageId: string) => void;
  onSelectPage: (pageId: string) => void;
  onCreatePage: (parentId?: string) => void;
}

export function MobileHomeView({
  pageTree,
  favorites,
  recentPages = [],
  onQuickAction,
  onOpenSearch,
  onOpenChat,
  onRefresh,
  onFavoritePage,
  onArchivePage,
  onDeletePage,
  onSelectPage,
  onCreatePage,
}: MobileHomeViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startYRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Use MBA classes API which includes recordings data
  const { data: mbaData } = useMbaClasses();

  // Get current semester's classes (most recent semester)
  const currentSemesterClasses = mbaData?.semesters[0]?.classes || [];

  const ACTION_WIDTH = 180;

  const SwipeableRow = ({
    children,
    onClick,
    onFavorite,
    onArchive,
    onDelete,
    isFavorite,
  }: {
    children: React.ReactNode;
    onClick: () => void;
    onFavorite?: () => void;
    onArchive?: () => void;
    onDelete?: () => void;
    isFavorite?: boolean;
  }) => {
    const [translateX, setTranslateX] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const startXRef = useRef<number | null>(null);
    const localStartYRef = useRef<number | null>(null);
    const draggingRef = useRef(false);

    const closeRow = () => {
      setIsOpen(false);
      setTranslateX(0);
    };

    const handleTouchStart = (e: React.TouchEvent) => {
      startXRef.current = e.touches[0].clientX;
      localStartYRef.current = e.touches[0].clientY;
      draggingRef.current = false;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
      if (startXRef.current === null || localStartYRef.current === null) return;
      const dx = e.touches[0].clientX - startXRef.current;
      const dy = e.touches[0].clientY - localStartYRef.current;

      if (!draggingRef.current) {
        if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) {
          return;
        }
        draggingRef.current = true;
      }

      e.preventDefault();
      const nextTranslate = Math.min(0, Math.max(-ACTION_WIDTH, dx));
      setTranslateX(nextTranslate);
    };

    const handleTouchEnd = () => {
      if (!draggingRef.current) return;
      const shouldOpen = translateX < -ACTION_WIDTH / 2;
      setIsOpen(shouldOpen);
      setTranslateX(shouldOpen ? -ACTION_WIDTH : 0);
      draggingRef.current = false;
      startXRef.current = null;
      localStartYRef.current = null;
    };

    const handleClick = () => {
      if (isOpen) {
        closeRow();
        return;
      }
      onClick();
    };

    const handleAction = (action?: () => void) => {
      if (!action) return;
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
      action();
      closeRow();
    };

    return (
      <div className="relative overflow-hidden">
        <div className="absolute inset-y-0 right-0 flex items-center">
          <button
            onClick={() => handleAction(onFavorite)}
            className={`w-14 h-full flex items-center justify-center ${isFavorite ? 'bg-yellow-500' : 'bg-yellow-400'} text-white`}
            aria-label={isFavorite ? 'Unfavorite' : 'Favorite'}
          >
            <StarIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleAction(onArchive)}
            className="w-14 h-full flex items-center justify-center bg-blue-600 text-white"
            aria-label="Archive"
          >
            <ArchiveBoxIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleAction(onDelete)}
            className="w-14 h-full flex items-center justify-center bg-red-600 text-white"
            aria-label="Delete"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
        <div
          className="relative bg-white transition-transform"
          style={{ transform: `translateX(${translateX}px)` }}
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {children}
        </div>
      </div>
    );
  };

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

  const renderPageItem = (node: VaultPageTreeNode, depth = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedIds.has(node.id);

    return (
      <div key={node.id} className="relative">
        {depth > 0 && (
          <div
            className="absolute left-0 top-0 bottom-0 border-l-2 border-gray-200"
            style={{ left: `${12 + (depth - 1) * 24}px` }}
          />
        )}

        <SwipeableRow
          onClick={() => onSelectPage(node.id)}
          onFavorite={() => onFavoritePage?.(node.id)}
          onArchive={() => onArchivePage?.(node.id)}
          onDelete={() => onDeletePage?.(node.id)}
          isFavorite={node.isFavorite}
        >
          <div
            className="w-full flex items-center gap-2 py-3 text-left hover:bg-blue-50 active:bg-blue-100 touch-manipulation transition-colors border-b border-gray-100 relative"
            style={{ paddingLeft: `${16 + depth * 24}px`, paddingRight: '16px' }}
          >
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

            {hasChildren ? (
              <button
                onClick={(e) => toggleExpanded(node.id, e)}
                className="p-1.5 -ml-1 rounded-lg bg-gray-100 hover:bg-gray-200 active:bg-gray-300 touch-manipulation flex-shrink-0"
              >
                <ChevronRightIcon
                  className={`w-4 h-4 text-gray-600 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                />
              </button>
            ) : (
              <div className="w-7 flex-shrink-0" />
            )}

            <span className="text-xl flex-shrink-0">{node.icon || '📄'}</span>

            <div className="flex-1 min-w-0">
              <span className="font-medium text-gray-900 truncate block">{node.title}</span>
            </div>

            {node.isFavorite && (
              <StarIcon className="w-4 h-4 text-yellow-500 flex-shrink-0" />
            )}

            {hasChildren && (
              <span className="px-2 py-0.5 text-xs font-medium text-blue-600 bg-blue-100 rounded-full flex-shrink-0">
                {node.children.length}
              </span>
            )}
          </div>
        </SwipeableRow>

        {hasChildren && isExpanded && (
          <div className="relative">
            {node.children.map((child) => renderPageItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const sortedRecents = useMemo((): VaultPage[] => {
    if (!recentPages?.length) return [];
    return [...recentPages]
      .filter((page) => page.updatedAt)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 6);
  }, [recentPages]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const container = scrollRef.current;
      if (!container || container.scrollTop > 0 || isRefreshing) return;
      startYRef.current = e.touches[0].clientY;
    },
    [isRefreshing]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (startYRef.current === null || isRefreshing) return;
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta <= 0) return;
      setPullDistance(Math.min(delta, 120));
      e.preventDefault();
    },
    [isRefreshing]
  );

  const handleTouchEnd = useCallback(async () => {
    if (startYRef.current === null) return;
    const shouldRefresh = pullDistance > 60;
    startYRef.current = null;

    if (shouldRefresh && onRefresh) {
      try {
        setIsRefreshing(true);
        if ('vibrate' in navigator) {
          navigator.vibrate(10);
        }
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    }
    setPullDistance(0);
  }, [onRefresh, pullDistance]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto overscroll-contain bg-white"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      <div
        className="flex items-center justify-center text-xs text-gray-500 transition-all"
        style={{ height: pullDistance }}
      >
        {pullDistance > 10 && (
          <span>
            {isRefreshing ? 'Refreshing...' : pullDistance > 60 ? 'Release to refresh' : 'Pull to refresh'}
          </span>
        )}
      </div>

      {/* Quick Actions */}
      <div className="px-4 pt-2 pb-3">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Quick Actions</div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => onCreatePage()}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium active:bg-blue-700 touch-manipulation flex-shrink-0"
          >
            <PlusIcon className="w-4 h-4" />
            New Note
          </button>
          <button
            onClick={onOpenSearch}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium active:bg-gray-200 touch-manipulation flex-shrink-0"
          >
            Search
          </button>
          <button
            onClick={onOpenChat}
            className="px-3 py-2 bg-purple-100 text-purple-700 rounded-xl text-sm font-medium active:bg-purple-200 touch-manipulation flex-shrink-0"
          >
            Ask AI
          </button>
          <button
            onClick={() => onQuickAction?.('journal')}
            className="px-3 py-2 bg-amber-100 text-amber-700 rounded-xl text-sm font-medium active:bg-amber-200 touch-manipulation flex-shrink-0"
          >
            Journal
          </button>
        </div>
      </div>

      {/* MBA Classes Section - uses API with recordings/notes data */}
      {currentSemesterClasses.length > 0 && (
        <div className="mb-4">
          <div className="px-4 py-3 bg-purple-50 border-y border-purple-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AcademicCapIcon className="w-5 h-5 text-purple-600" />
              <h2 className="text-sm font-semibold text-purple-900">MBA Classes</h2>
            </div>
            <span className="text-xs text-purple-600 font-medium">
              {mbaData?.semesters[0]?.title || 'Current Semester'}
            </span>
          </div>
          <div className="divide-y divide-gray-100">
            {currentSemesterClasses.map((cls) => {
              const totalRecordings = cls.sessions.reduce((sum, s) => sum + s.recordings.length, 0);
              const totalNotes = cls.sessions.reduce((sum, s) => sum + s.remarkableNotes.length, 0);

              return (
                <button
                  key={cls.id}
                  onClick={() => onSelectPage(cls.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-purple-50 active:bg-purple-100 touch-manipulation transition-colors"
                >
                  <div className="p-2 bg-purple-100 rounded-lg flex-shrink-0">
                    <BookOpenIcon className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900">{cls.title}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">{cls.sessions.length} sessions</span>
                      {totalNotes > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-amber-600">
                          <DocumentIcon className="w-3 h-3" />
                          {totalNotes}
                        </span>
                      )}
                      {totalRecordings > 0 && (
                        <span className="flex items-center gap-0.5 text-xs text-blue-600">
                          <MicrophoneIcon className="w-3 h-3" />
                          {totalRecordings}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRightIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Pages */}
      {sortedRecents.length > 0 && (
        <div className="mb-4">
          <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Recent</div>
          {sortedRecents.map((page) => (
            <SwipeableRow
              key={page.id}
              onClick={() => onSelectPage(page.id)}
              onFavorite={() => onFavoritePage?.(page.id)}
              onArchive={() => onArchivePage?.(page.id)}
              onDelete={() => onDeletePage?.(page.id)}
              isFavorite={page.isFavorite}
            >
              <div className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-100 touch-manipulation transition-colors border-b border-gray-100">
                <span className="text-xl">{page.icon || '📄'}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{page.title || 'Untitled'}</div>
                  <div className="text-xs text-gray-500">
                    Edited {formatDistanceToNow(new Date(page.updatedAt), { addSuffix: true })}
                  </div>
                </div>
              </div>
            </SwipeableRow>
          ))}
        </div>
      )}

      {/* Favorites Section */}
      {favorites.length > 0 && (
        <div className="mb-4">
          <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-100">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <StarIcon className="w-4 h-4 text-yellow-500" />
              Favorites
            </h2>
          </div>
          {favorites.map((page) => (
            <SwipeableRow
              key={page.id}
              onClick={() => onSelectPage(page.id)}
              onFavorite={() => onFavoritePage?.(page.id)}
              onArchive={() => onArchivePage?.(page.id)}
              onDelete={() => onDeletePage?.(page.id)}
              isFavorite={page.isFavorite}
            >
              <div className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-100 touch-manipulation transition-colors border-b border-gray-100">
                <span className="text-xl">{page.icon || '📄'}</span>
                <span className="flex-1 font-medium text-gray-900 truncate">{page.title}</span>
                <StarIcon className="w-4 h-4 text-yellow-500 flex-shrink-0" />
              </div>
            </SwipeableRow>
          ))}
        </div>
      )}

      {/* All Pages Section */}
      <div>
        <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-blue-900">All Notes</h2>
          <button
            onClick={() => onCreatePage()}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg active:bg-blue-700 touch-manipulation text-sm font-medium"
          >
            <PlusIcon className="w-4 h-4" />
            New
          </button>
        </div>

        {pageTree.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="text-4xl mb-3">📝</div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No notes yet</h3>
            <p className="text-sm text-gray-500 mb-4">Create your first note to get started</p>
            <button
              onClick={() => onCreatePage()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-medium active:bg-blue-700 touch-manipulation"
            >
              <PlusIcon className="w-5 h-5" />
              Create Note
            </button>
          </div>
        ) : (
          <div>{pageTree.map((node) => renderPageItem(node))}</div>
        )}
      </div>

      {/* Bottom padding */}
      <div className="px-4 py-3 text-[10px] text-gray-400">
        Build {new Date(__BUILD_DATE__).toLocaleString()}
      </div>
      <div className="h-4" />
    </div>
  );
}

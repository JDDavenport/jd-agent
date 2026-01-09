import { useState, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { clsx } from 'clsx';
import type { VaultPageTreeNode, VaultPage, VaultTreeNode } from '@jd-agent/types';

interface NotionSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  selectedPageId: string | null;
  selectedEntryId?: string | null;
  onSelectPage: (pageId: string) => void;
  onSelectLegacyEntry?: (entryId: string) => void;
  onCreatePage: (parentId?: string) => void;
  onCreateEntry?: (parentId?: string) => void;
  onMoveEntry?: (id: string, newParentId: string | null) => void;
  onOpenSearch: () => void;
  pageTree: VaultPageTreeNode[];
  legacyTree?: VaultTreeNode[];
  favorites: VaultPage[];
  isLoading?: boolean;
}

export function NotionSidebar({
  isCollapsed,
  onToggleCollapse,
  selectedEntryId,
  onSelectLegacyEntry,
  onCreateEntry,
  onMoveEntry,
  onOpenSearch,
  pageTree,
  legacyTree = [],
  isLoading = false,
}: NotionSidebarProps) {
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const toggleExpand = useCallback((pageId: string) => {
    setExpandedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id as string | null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (!over || active.id === over.id) return;

    // Find the target node to determine new parent
    const findNode = (nodes: VaultTreeNode[], id: string): VaultTreeNode | null => {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children) {
          const found = findNode(node.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    const activeNode = findNode(legacyTree, active.id as string);
    const overNode = findNode(legacyTree, over.id as string);

    if (activeNode && overNode && onMoveEntry) {
      // Move the active node to be a child of the over node
      onMoveEntry(active.id as string, over.id as string);
    }
  };

  // Get active node for drag overlay
  const findActiveNode = (nodes: VaultTreeNode[], id: string): VaultTreeNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findActiveNode(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const activeNode = activeId ? findActiveNode(legacyTree, activeId) : null;

  if (isCollapsed) {
    return (
      <aside className="w-0 relative">
        <button
          onClick={onToggleCollapse}
          className="absolute top-4 left-2 p-1.5 rounded hover:bg-gray-200 transition-colors z-10"
          title="Expand sidebar"
        >
          <ChevronDoubleRightIcon className="w-4 h-4 text-gray-500" />
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-64 bg-[#f7f7f5] border-r border-gray-200 h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/60">
        <div className="flex items-center gap-2">
          <span className="text-lg">📚</span>
          <span className="font-semibold text-gray-900">Vault</span>
        </div>
        <button
          onClick={onToggleCollapse}
          className="p-1 rounded hover:bg-gray-200 transition-colors"
          title="Collapse sidebar"
        >
          <ChevronDoubleLeftIcon className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <button
          onClick={onOpenSearch}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-500 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
        >
          <MagnifyingGlassIcon className="w-4 h-4" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">⌘K</kbd>
        </button>
      </div>

      {/* Tree content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">Loading...</div>
        ) : legacyTree.length === 0 && pageTree.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <DocumentTextIcon className="w-8 h-8 mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">No entries yet</p>
            <button
              onClick={() => onCreateEntry?.()}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700"
            >
              Create your first entry
            </button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="py-2">
              {/* Legacy Vault Tree */}
              {legacyTree.map((node) => (
                <SortableTreeItem
                  key={node.id}
                  node={node}
                  depth={0}
                  isExpanded={expandedPages.has(node.id)}
                  onToggle={() => toggleExpand(node.id)}
                  isSelected={selectedEntryId === node.id}
                  onSelect={() => onSelectLegacyEntry?.(node.id)}
                  onAddChild={() => onCreateEntry?.(node.id)}
                  expandedPages={expandedPages}
                  onToggleExpand={toggleExpand}
                  selectedEntryId={selectedEntryId}
                  onSelectEntry={onSelectLegacyEntry}
                  onCreateEntry={onCreateEntry}
                  isOver={overId === node.id}
                />
              ))}
            </div>
            <DragOverlay>
              {activeNode ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-md shadow-lg border border-gray-200">
                  <span className="text-sm">{getIcon(activeNode)}</span>
                  <span className="text-sm font-medium text-gray-900">{activeNode.title}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* New Entry Button */}
      <div className="p-3 border-t border-gray-200">
        <button
          onClick={() => onCreateEntry?.()}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          <span>New Entry</span>
        </button>
      </div>
    </aside>
  );
}

// Get icon based on context
function getIcon(node: VaultTreeNode) {
  const hasChildren = node.children && node.children.length > 0;
  const context = node.context?.toLowerCase() || '';
  const title = node.title?.toLowerCase() || '';

  if (hasChildren || context === 'reference' || context === 'archive' || context === 'school' || context === 'professional' || context === 'personal') {
    if (context === 'archive' || title.includes('archive')) return '📦';
    if (context === 'school' || context === 'mba' || title === 'mba') return '🎓';
    if (context === 'professional') return '💼';
    if (context === 'personal') return '👤';
    if (context === 'reference') return '📚';
    if (title === 'inbox') return '📥';
    if (title.includes('family')) return '👨‍👩‍👧‍👦';
    if (title.includes('site') || title.includes('credential')) return '🔐';
    if (title.includes('health') || title.includes('fitness')) return '💪';
    if (title.includes('goal') || title.includes('plan')) return '🎯';
    if (title.includes('people')) return '👥';
    if (title.includes('career')) return '📈';
    if (title.includes('resume')) return '📄';
    if (title.includes('job')) return '💼';
    if (title.includes('travel')) return '✈️';
    if (title.includes('journal')) return '📔';
    if (title.includes('document')) return '📄';
    return '📁';
  }

  return '📝';
}

// ============================================
// Sortable Tree Item Component
// ============================================

interface SortableTreeItemProps {
  node: VaultTreeNode;
  depth: number;
  isExpanded: boolean;
  onToggle: () => void;
  isSelected: boolean;
  onSelect: () => void;
  onAddChild: () => void;
  expandedPages: Set<string>;
  onToggleExpand: (id: string) => void;
  selectedEntryId?: string | null;
  onSelectEntry?: (id: string) => void;
  onCreateEntry?: (parentId: string) => void;
  isOver?: boolean;
}

function SortableTreeItem({
  node,
  depth,
  isExpanded,
  onToggle,
  isSelected,
  onSelect,
  onAddChild,
  expandedPages,
  onToggleExpand,
  selectedEntryId,
  onSelectEntry,
  onCreateEntry,
  isOver,
}: SortableTreeItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const hasChildren = node.children && node.children.length > 0;
  const paddingLeft = 12 + depth * 16;

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={clsx(
          'flex items-center gap-1 py-1 pr-2 rounded-md mx-2 group cursor-pointer transition-colors',
          isSelected
            ? 'bg-blue-50 text-blue-700'
            : isOver
            ? 'bg-blue-100 border-2 border-blue-400 border-dashed'
            : 'hover:bg-gray-100 text-gray-700'
        )}
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={onSelect}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="p-0.5 rounded hover:bg-gray-200 transition-colors flex-shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
          </svg>
        </button>

        {/* Expand/collapse button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={clsx(
            'p-0.5 rounded hover:bg-gray-200 transition-colors flex-shrink-0',
            !hasChildren && 'invisible'
          )}
        >
          {isExpanded ? (
            <ChevronDownIcon className="w-3.5 h-3.5 text-gray-400" />
          ) : (
            <ChevronRightIcon className="w-3.5 h-3.5 text-gray-400" />
          )}
        </button>

        {/* Icon */}
        <span className="flex-shrink-0 text-sm">{getIcon(node)}</span>

        {/* Title */}
        <span className={clsx(
          'flex-1 text-sm truncate',
          isSelected ? 'font-medium' : ''
        )}>
          {node.title}
        </span>

        {/* Child count */}
        {hasChildren && (
          <span className="text-xs text-gray-400 mr-1">
            {node.children.length}
          </span>
        )}

        {/* Add child button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddChild();
          }}
          className="p-0.5 rounded hover:bg-gray-200 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
          title="Add nested entry"
        >
          <PlusIcon className="w-3.5 h-3.5 text-gray-500" />
        </button>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <SortableTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              isExpanded={expandedPages.has(child.id)}
              onToggle={() => onToggleExpand(child.id)}
              isSelected={selectedEntryId === child.id}
              onSelect={() => onSelectEntry?.(child.id)}
              onAddChild={() => onCreateEntry?.(child.id)}
              expandedPages={expandedPages}
              onToggleExpand={onToggleExpand}
              selectedEntryId={selectedEntryId}
              onSelectEntry={onSelectEntry}
              onCreateEntry={onCreateEntry}
            />
          ))}
        </div>
      )}
    </div>
  );
}

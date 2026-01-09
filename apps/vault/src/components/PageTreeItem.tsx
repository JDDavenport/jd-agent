import { useState } from 'react';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  FolderIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import { clsx } from 'clsx';
import type { VaultTreeNode } from '@jd-agent/types';

interface PageTreeItemProps {
  node: VaultTreeNode;
  depth?: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddChild?: (parentId: string) => void;
}

export function PageTreeItem({
  node,
  depth = 0,
  selectedId,
  onSelect,
  onAddChild,
}: PageTreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 1);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;

  return (
    <div>
      <div
        className={clsx(
          'group flex items-center gap-1 pr-2 rounded-lg text-sm transition-colors cursor-pointer',
          isSelected
            ? 'bg-purple-100 text-purple-700'
            : 'text-gray-700 hover:bg-gray-100'
        )}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        {/* Expand/Collapse toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className={clsx(
            'p-0.5 rounded hover:bg-gray-200',
            !hasChildren && 'invisible'
          )}
        >
          {isExpanded ? (
            <ChevronDownIcon className="w-3.5 h-3.5 text-gray-400" />
          ) : (
            <ChevronRightIcon className="w-3.5 h-3.5 text-gray-400" />
          )}
        </button>

        {/* Page button */}
        <button
          onClick={() => onSelect(node.id)}
          className="flex items-center gap-2 py-1.5 flex-1 min-w-0"
        >
          {hasChildren ? (
            <FolderIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
          ) : (
            <DocumentTextIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )}
          <span className="truncate text-left">{node.title}</span>
        </button>

        {/* Add child button */}
        {onAddChild && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddChild(node.id);
            }}
            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-200 transition-opacity"
            title="Add nested page"
          >
            <PlusIcon className="w-3.5 h-3.5 text-gray-400" />
          </button>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <PageTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface PageTreeProps {
  nodes: VaultTreeNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddChild?: (parentId: string) => void;
  onAddRoot?: () => void;
  emptyMessage?: string;
}

export function PageTree({
  nodes,
  selectedId,
  onSelect,
  onAddChild,
  onAddRoot,
  emptyMessage = 'No pages yet',
}: PageTreeProps) {
  if (nodes.length === 0) {
    return (
      <div className="px-3 py-4 text-center">
        <p className="text-sm text-gray-500 mb-2">{emptyMessage}</p>
        {onAddRoot && (
          <button
            onClick={onAddRoot}
            className="text-sm text-purple-600 hover:text-purple-700 font-medium"
          >
            Create your first page
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {nodes.map((node) => (
        <PageTreeItem
          key={node.id}
          node={node}
          selectedId={selectedId}
          onSelect={onSelect}
          onAddChild={onAddChild}
        />
      ))}
    </div>
  );
}

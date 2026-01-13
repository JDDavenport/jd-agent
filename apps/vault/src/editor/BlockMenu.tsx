import { useState, useCallback, useEffect, useRef } from 'react';
import { Editor } from '@tiptap/react';
import {
  TrashIcon,
  DocumentDuplicateIcon,
  ArrowsUpDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

interface BlockMenuProps {
  editor: Editor;
}

interface MenuPosition {
  top: number;
  left: number;
  pos: number;
}

const BLOCK_TYPES = [
  { name: 'Text', type: 'paragraph', icon: '¶' },
  { name: 'Heading 1', type: 'heading', attrs: { level: 1 }, icon: 'H1' },
  { name: 'Heading 2', type: 'heading', attrs: { level: 2 }, icon: 'H2' },
  { name: 'Heading 3', type: 'heading', attrs: { level: 3 }, icon: 'H3' },
  { name: 'Bullet List', type: 'bulletList', icon: '•' },
  { name: 'Numbered List', type: 'orderedList', icon: '1.' },
  { name: 'Quote', type: 'blockquote', icon: '"' },
  { name: 'Code', type: 'codeBlock', icon: '</>' },
];

export function BlockMenu({ editor }: BlockMenuProps) {
  const [handlePosition, setHandlePosition] = useState<MenuPosition | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [turnIntoOpen, setTurnIntoOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const hoveredBlockRef = useRef<Element | null>(null);

  // Find the closest block element from a target element
  const findBlockElement = useCallback((target: Element | null): Element | null => {
    if (!target) return null;

    const editorElement = editor.view.dom;

    // Check if we're inside the editor
    if (!editorElement.contains(target)) return null;

    // Walk up from target to find a direct child of ProseMirror
    let current: Element | null = target;
    while (current && current !== editorElement) {
      if (current.parentElement === editorElement) {
        // This is a top-level block
        return current;
      }
      current = current.parentElement;
    }

    return null;
  }, [editor]);

  // Get document position from DOM element
  const getPosFromElement = useCallback((element: Element): number | null => {
    const editorElement = editor.view.dom;
    const children = Array.from(editorElement.children);
    const index = children.indexOf(element);

    if (index === -1) return null;

    // Calculate position by walking through the document
    const doc = editor.state.doc;

    // For first node, pos is 0
    if (index === 0) return 0;

    // Walk through doc to find position
    let foundPos = 0;
    let nodeIndex = 0;
    doc.forEach((_node, offset) => {
      if (nodeIndex === index) {
        foundPos = offset;
      }
      nodeIndex++;
    });

    return foundPos;
  }, [editor]);

  // Handle mouse over blocks
  useEffect(() => {
    const editorElement = editor.view.dom;

    const handleMouseOver = (e: MouseEvent) => {
      if (menuOpen) return;

      const target = e.target as Element;
      const blockElement = findBlockElement(target);

      if (blockElement && blockElement !== hoveredBlockRef.current) {
        hoveredBlockRef.current = blockElement;
        const rect = blockElement.getBoundingClientRect();
        const pos = getPosFromElement(blockElement);

        if (pos !== null) {
          setHandlePosition({
            top: rect.top,
            left: rect.left - 56,
            pos,
          });
        }
      }
    };

    const handleMouseLeave = (e: MouseEvent) => {
      if (menuOpen) return;

      const relatedTarget = e.relatedTarget as Element;

      // Don't hide if moving to the handle or menu
      if (handleRef.current?.contains(relatedTarget) || menuRef.current?.contains(relatedTarget)) {
        return;
      }

      // Don't hide if still inside the editor or moving between blocks
      if (editorElement.contains(relatedTarget)) {
        return;
      }

      hoveredBlockRef.current = null;
      setHandlePosition(null);
    };

    editorElement.addEventListener('mouseover', handleMouseOver);
    editorElement.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      editorElement.removeEventListener('mouseover', handleMouseOver);
      editorElement.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [editor, menuOpen, findBlockElement, getPosFromElement]);

  // Handle leaving the handle area
  const handleHandleMouseLeave = useCallback((e: React.MouseEvent) => {
    if (menuOpen) return;

    const relatedTarget = e.relatedTarget as Element;
    const editorElement = editor.view.dom;

    // Don't hide if moving to menu or back to editor
    if (menuRef.current?.contains(relatedTarget) || editorElement.contains(relatedTarget)) {
      return;
    }

    hoveredBlockRef.current = null;
    setHandlePosition(null);
  }, [editor, menuOpen]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          handleRef.current && !handleRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setTurnIntoOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuOpen]);

  // Action handlers
  const handleDelete = useCallback(() => {
    if (handlePosition === null) return;

    const { pos } = handlePosition;
    const $pos = editor.state.doc.resolve(pos);
    const node = $pos.nodeAfter;

    if (node) {
      editor.chain()
        .focus()
        .deleteRange({ from: pos, to: pos + node.nodeSize })
        .run();
    }

    setMenuOpen(false);
    setHandlePosition(null);
    hoveredBlockRef.current = null;
  }, [editor, handlePosition]);

  const handleDuplicate = useCallback(() => {
    if (handlePosition === null) return;

    const { pos } = handlePosition;
    const $pos = editor.state.doc.resolve(pos);
    const node = $pos.nodeAfter;

    if (node) {
      editor.chain()
        .focus()
        .insertContentAt(pos + node.nodeSize, node.toJSON())
        .run();
    }

    setMenuOpen(false);
  }, [editor, handlePosition]);

  const handleTurnInto = useCallback((type: string, attrs?: Record<string, unknown>) => {
    if (handlePosition === null) return;

    const { pos } = handlePosition;

    // Select the block first
    editor.chain().focus().setTextSelection(pos + 1).run();

    // Convert based on type
    switch (type) {
      case 'paragraph':
        editor.chain().focus().setParagraph().run();
        break;
      case 'heading':
        editor.chain().focus().setHeading(attrs as { level: 1 | 2 | 3 }).run();
        break;
      case 'bulletList':
        editor.chain().focus().toggleBulletList().run();
        break;
      case 'orderedList':
        editor.chain().focus().toggleOrderedList().run();
        break;
      case 'blockquote':
        editor.chain().focus().toggleBlockquote().run();
        break;
      case 'codeBlock':
        editor.chain().focus().toggleCodeBlock().run();
        break;
    }

    setMenuOpen(false);
    setTurnIntoOpen(false);
  }, [editor, handlePosition]);

  const handleMoveUp = useCallback(() => {
    if (handlePosition === null) return;

    const { pos } = handlePosition;
    if (pos === 0) {
      setMenuOpen(false);
      return;
    }

    const $pos = editor.state.doc.resolve(pos);
    const node = $pos.nodeAfter;
    const $prevPos = editor.state.doc.resolve(pos - 1);
    const prevNode = $prevPos.nodeBefore;

    if (node && prevNode) {
      const newPos = pos - prevNode.nodeSize;
      editor.chain()
        .focus()
        .deleteRange({ from: pos, to: pos + node.nodeSize })
        .insertContentAt(newPos, node.toJSON())
        .run();
    }

    setMenuOpen(false);
  }, [editor, handlePosition]);

  const handleMoveDown = useCallback(() => {
    if (handlePosition === null) return;

    const { pos } = handlePosition;
    const $pos = editor.state.doc.resolve(pos);
    const node = $pos.nodeAfter;

    if (node) {
      const afterPos = pos + node.nodeSize;
      if (afterPos >= editor.state.doc.content.size) {
        setMenuOpen(false);
        return;
      }

      const $afterPos = editor.state.doc.resolve(afterPos);
      const nextNode = $afterPos.nodeAfter;

      if (nextNode) {
        const newPos = afterPos + nextNode.nodeSize;
        editor.chain()
          .focus()
          .deleteRange({ from: pos, to: pos + node.nodeSize })
          .insertContentAt(newPos - node.nodeSize, node.toJSON())
          .run();
      }
    }

    setMenuOpen(false);
  }, [editor, handlePosition]);

  const handleAddBlock = useCallback(() => {
    if (handlePosition === null) return;

    const { pos } = handlePosition;
    const $pos = editor.state.doc.resolve(pos);
    const node = $pos.nodeAfter;

    if (node) {
      const insertPos = pos + node.nodeSize;
      editor.chain()
        .focus()
        .insertContentAt(insertPos, { type: 'paragraph' })
        .setTextSelection(insertPos + 1)
        .run();
    }

    setHandlePosition(null);
    hoveredBlockRef.current = null;
  }, [editor, handlePosition]);

  if (!handlePosition) return null;

  return (
    <>
      {/* Drag Handle */}
      <div
        ref={handleRef}
        className="fixed z-50 flex items-center gap-0.5"
        style={{
          top: handlePosition.top,
          left: handlePosition.left,
        }}
        onMouseLeave={handleHandleMouseLeave}
      >
        {/* Add button */}
        <button
          onClick={handleAddBlock}
          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-200 rounded transition-colors"
          title="Add block below"
        >
          <span className="text-lg font-light">+</span>
        </button>

        {/* Drag handle / Menu trigger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:text-gray-200 rounded cursor-grab transition-colors"
          title="Click for options"
        >
          <span className="text-sm">⠿</span>
        </button>
      </div>

      {/* Block Actions Menu */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="fixed z-[100] bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[200px]"
          style={{
            top: handlePosition.top,
            left: handlePosition.left + 56,
          }}
        >
          {/* Delete */}
          <button
            onClick={handleDelete}
            className="w-full px-3 py-1.5 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <TrashIcon className="w-4 h-4" />
            <span>Delete</span>
          </button>

          {/* Duplicate */}
          <button
            onClick={handleDuplicate}
            className="w-full px-3 py-1.5 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <DocumentDuplicateIcon className="w-4 h-4" />
            <span>Duplicate</span>
          </button>

          <div className="border-t border-gray-200 dark:border-gray-700 my-1" />

          {/* Turn into */}
          <div className="relative">
            <button
              onClick={() => setTurnIntoOpen(!turnIntoOpen)}
              className="w-full px-3 py-1.5 flex items-center justify-between text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 flex items-center justify-center text-xs">↻</span>
                <span>Turn into</span>
              </span>
              <ChevronRightIcon className="w-4 h-4" />
            </button>

            {/* Turn into submenu */}
            {turnIntoOpen && (
              <div className="absolute left-full top-0 ml-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[160px]">
                {BLOCK_TYPES.map((blockType) => (
                  <button
                    key={blockType.type + (blockType.attrs?.level || '')}
                    onClick={() => handleTurnInto(blockType.type, blockType.attrs)}
                    className="w-full px-3 py-1.5 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <span className="w-5 h-5 flex items-center justify-center text-xs font-mono bg-gray-100 dark:bg-gray-700 rounded">
                      {blockType.icon}
                    </span>
                    <span>{blockType.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 my-1" />

          {/* Move up */}
          <button
            onClick={handleMoveUp}
            className="w-full px-3 py-1.5 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowsUpDownIcon className="w-4 h-4" />
            <span>Move up</span>
          </button>

          {/* Move down */}
          <button
            onClick={handleMoveDown}
            className="w-full px-3 py-1.5 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowsUpDownIcon className="w-4 h-4 rotate-180" />
            <span>Move down</span>
          </button>
        </div>
      )}
    </>
  );
}

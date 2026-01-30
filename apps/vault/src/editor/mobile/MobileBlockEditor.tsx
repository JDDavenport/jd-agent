import { useEditor, EditorContent } from '@tiptap/react';
import type { JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FloatingToolbar } from './FloatingToolbar';
import { MobileSlashMenu } from './MobileSlashMenu';
import { BlockContextMenu, useLongPress } from './BlockContextMenu';
import { Callout } from '../extensions/Callout';
import { Toggle, ToggleSummary, ToggleContent } from '../extensions/Toggle';
import { FileAttachment } from '../extensions/FileAttachment';
import { Bookmark } from '../extensions/Bookmark';
import { PageLink } from '../extensions/PageLink';
import { TaskLink } from '../extensions/TaskLink';
import { GoalLink } from '../extensions/GoalLink';
import type { VaultBlock, VaultPage } from '../../api';
import '../editor.css';

// Create lowlight instance with common languages
const lowlight = createLowlight(common);

interface MobileBlockEditorProps {
  pageId: string;
  initialContent?: VaultBlock[];
  onContentChange?: (content: { html: string; json: JSONContent }) => void;
  onSave?: () => void;
  onCreatePage?: (title: string) => Promise<VaultPage>;
  onPageClick?: (pageId: string) => void;
  onTaskClick?: (taskId: string) => void;
  onGoalClick?: (goalId: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  autoFocus?: boolean;
}

export function MobileBlockEditor({
  pageId: _pageId,
  initialContent,
  onContentChange,
  onSave,
  onCreatePage: _onCreatePage,
  onPageClick,
  onTaskClick,
  onGoalClick,
  placeholder = "Tap to start writing...",
  readOnly = false,
  autoFocus = false,
}: MobileBlockEditorProps) {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Mobile UI state
  const [isSlashMenuOpen, setIsSlashMenuOpen] = useState(false);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Detect keyboard visibility using visual viewport
  useEffect(() => {
    const visualViewport = window.visualViewport;
    if (!visualViewport) return;

    const handleResize = () => {
      // Compare visual viewport height to window height
      // Keyboard is visible when visual viewport is significantly smaller
      const keyboardVisible = visualViewport.height < window.innerHeight * 0.75;
      setIsKeyboardVisible(keyboardVisible);
    };

    visualViewport.addEventListener('resize', handleResize);
    visualViewport.addEventListener('scroll', handleResize);

    return () => {
      visualViewport.removeEventListener('resize', handleResize);
      visualViewport.removeEventListener('scroll', handleResize);
    };
  }, []);

  // Convert blocks to TipTap JSON format
  const blocksToTipTapContent = useCallback((blocks: VaultBlock[] | undefined) => {
    if (!blocks || blocks.length === 0) {
      return undefined;
    }

    const content: any[] = [];

    for (const block of blocks) {
      const node = blockToTipTapNode(block);
      if (node) {
        content.push(node);
      }
    }

    return content.length > 0 ? { type: 'doc', content } : undefined;
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: false, // We use CodeBlockLowlight instead
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') {
            return `Heading ${node.attrs.level}`;
          }
          return placeholder;
        },
        showOnlyWhenEditable: true,
        showOnlyCurrent: true,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Highlight.configure({
        multicolor: true,
      }),
      Link.configure({
        openOnClick: true, // Open links on tap for mobile
        HTMLAttributes: {
          class: 'text-blue-600 underline cursor-pointer',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'max-w-full h-auto rounded-lg',
        },
      }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: 'rounded-md bg-gray-900 text-gray-100 p-4 font-mono text-sm overflow-x-auto',
        },
      }),
      // Custom extensions
      Callout,
      Toggle,
      ToggleSummary,
      ToggleContent,
      FileAttachment,
      Bookmark,
      PageLink.configure({
        onPageClick,
      }),
      TaskLink.configure({
        onTaskClick,
      }),
      GoalLink.configure({
        onGoalClick,
      }),
    ],
    content: blocksToTipTapContent(initialContent),
    editable: !readOnly,
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: {
        class: 'prose prose-sm focus:outline-none max-w-none min-h-[200px] p-4',
      },
      // Handle touch events for mobile
      handleDOMEvents: {
        touchstart: () => {
          // Close context menu on any touch that's not on the menu
          return false;
        },
      },
    },
    onUpdate: ({ editor }) => {
      if (onContentChange) {
        // Debounce the content change
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
          const html = editor.getHTML();
          const json = editor.getJSON();
          onContentChange({ html, json });
        }, 500);
      }
    },
    onFocus: () => {
      // Assume keyboard will become visible when editor is focused
      setIsKeyboardVisible(true);
    },
    onBlur: () => {
      // Small delay to allow for toolbar interactions
      setTimeout(() => {
        if (!document.activeElement?.closest('.floating-toolbar')) {
          setIsKeyboardVisible(false);
        }
      }, 100);
    },
  });

  // Handle long press for block context menu
  const handleLongPress = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!editor) return;

    // Get touch/click position
    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Get the position in the editor to select the block
    const editorView = editor.view;
    const pos = editorView.posAtCoords({ left: clientX, top: clientY });

    if (pos) {
      // Select the entire block at this position
      const $pos = editorView.state.doc.resolve(pos.pos);
      const start = $pos.start($pos.depth);
      const end = $pos.end($pos.depth);

      // Set selection to the block
      editor.chain().setTextSelection({ from: start, to: end }).run();

      // Show context menu
      setContextMenuPosition({ x: clientX, y: clientY });
      setIsContextMenuOpen(true);

      // Trigger haptic feedback if available
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }
  }, [editor]);

  const longPressProps = useLongPress(handleLongPress, 500);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Handle save shortcut (external keyboards)
  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        onSave?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editor, onSave]);

  if (!editor) {
    return (
      <div className="animate-pulse p-4">
        <div className="h-6 bg-gray-200 rounded w-3/4 mb-4" />
        <div className="h-4 bg-gray-200 rounded w-full mb-2" />
        <div className="h-4 bg-gray-200 rounded w-5/6" />
      </div>
    );
  }

  return (
    <div
      ref={editorContainerRef}
      className="mobile-block-editor flex flex-col h-full bg-white"
    >
      {/* Editor Area Label */}
      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Editor</span>
        <span className="text-xs text-gray-400">Tap to edit</span>
      </div>

      {/* Editor Content with Long Press Support */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain bg-white"
        style={{
          paddingBottom: isKeyboardVisible ? '60px' : '0',
        }}
        {...longPressProps}
      >
        <div className="min-h-[300px] border-2 border-dashed border-gray-200 rounded-lg m-3 focus-within:border-blue-400 focus-within:border-solid transition-colors">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Mobile Slash Menu (Full Screen) */}
      <MobileSlashMenu
        editor={editor}
        isOpen={isSlashMenuOpen}
        onClose={() => setIsSlashMenuOpen(false)}
      />

      {/* Block Context Menu (Long Press) */}
      <BlockContextMenu
        editor={editor}
        isOpen={isContextMenuOpen}
        position={contextMenuPosition}
        onClose={() => setIsContextMenuOpen(false)}
      />

      {/* Floating Toolbar (Bottom) */}
      <FloatingToolbar
        editor={editor}
        onOpenSlashMenu={() => setIsSlashMenuOpen(true)}
        isKeyboardVisible={isKeyboardVisible}
      />
    </div>
  );
}

// Helper to convert a single block to TipTap node format
function blockToTipTapNode(block: VaultBlock): any {
  const content = block.content as Record<string, any>;

  switch (block.type) {
    case 'text':
      return {
        type: 'paragraph',
        content: content.text ? [{ type: 'text', text: content.text }] : [],
      };

    case 'heading_1':
      return {
        type: 'heading',
        attrs: { level: 1 },
        content: content.text ? [{ type: 'text', text: content.text }] : [],
      };

    case 'heading_2':
      return {
        type: 'heading',
        attrs: { level: 2 },
        content: content.text ? [{ type: 'text', text: content.text }] : [],
      };

    case 'heading_3':
      return {
        type: 'heading',
        attrs: { level: 3 },
        content: content.text ? [{ type: 'text', text: content.text }] : [],
      };

    case 'bulleted_list':
      return {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: content.text ? [{ type: 'text', text: content.text }] : [],
              },
            ],
          },
        ],
      };

    case 'numbered_list':
      return {
        type: 'orderedList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: content.text ? [{ type: 'text', text: content.text }] : [],
              },
            ],
          },
        ],
      };

    case 'todo':
      return {
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: content.checked || false },
            content: [
              {
                type: 'paragraph',
                content: content.text ? [{ type: 'text', text: content.text }] : [],
              },
            ],
          },
        ],
      };

    case 'quote':
      return {
        type: 'blockquote',
        content: [
          {
            type: 'paragraph',
            content: content.text ? [{ type: 'text', text: content.text }] : [],
          },
        ],
      };

    case 'code':
      return {
        type: 'codeBlock',
        attrs: { language: content.language || null },
        content: content.code ? [{ type: 'text', text: content.code }] : [],
      };

    case 'divider':
      return {
        type: 'horizontalRule',
      };

    case 'image':
      return {
        type: 'image',
        attrs: {
          src: content.url,
          alt: content.caption || '',
        },
      };

    case 'callout':
      return {
        type: 'callout',
        attrs: {
          emoji: content.emoji || '💡',
          type: content.color || 'info',
        },
        content: [
          {
            type: 'paragraph',
            content: content.text ? [{ type: 'text', text: content.text }] : [],
          },
        ],
      };

    case 'toggle':
      return {
        type: 'toggle',
        attrs: { open: true },
        content: [
          {
            type: 'toggleSummary',
            content: content.text ? [{ type: 'text', text: content.text }] : [],
          },
          {
            type: 'toggleContent',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Toggle content...' }],
              },
            ],
          },
        ],
      };

    case 'file':
      return {
        type: 'fileAttachment',
        attrs: {
          url: content.url,
          filename: content.filename || 'Untitled',
          size: content.size,
          mimeType: content.mimeType,
        },
      };

    case 'bookmark':
      return {
        type: 'bookmark',
        attrs: {
          url: content.url,
          title: content.title,
          description: content.description,
          favicon: content.favicon,
          image: content.image,
        },
      };

    case 'page_link':
      return {
        type: 'paragraph',
        content: [
          {
            type: 'pageLink',
            attrs: {
              pageId: content.pageId,
              title: content.title || 'Untitled',
            },
          },
        ],
      };

    case 'task_link':
      return {
        type: 'paragraph',
        content: [
          {
            type: 'taskLink',
            attrs: {
              taskId: content.taskId,
              title: content.title || 'Untitled Task',
            },
          },
        ],
      };

    case 'goal_link':
      return {
        type: 'paragraph',
        content: [
          {
            type: 'goalLink',
            attrs: {
              goalId: content.goalId,
              title: content.title || 'Untitled Goal',
            },
          },
        ],
      };

    default:
      // Default to paragraph for unknown types
      return {
        type: 'paragraph',
        content: content.text ? [{ type: 'text', text: content.text }] : [],
      };
  }
}

export type { MobileBlockEditorProps };

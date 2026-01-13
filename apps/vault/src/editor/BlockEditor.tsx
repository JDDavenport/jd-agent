import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import { useCallback, useEffect, useRef } from 'react';
import { SlashMenu } from './SlashMenu';
import { PageLinkMenu } from './PageLinkMenu';
import { BlockMenu } from './BlockMenu';
import { Callout } from './extensions/Callout';
import { Toggle, ToggleSummary, ToggleContent } from './extensions/Toggle';
import { FileAttachment } from './extensions/FileAttachment';
import { Bookmark } from './extensions/Bookmark';
import { PageLink } from './extensions/PageLink';
import { TaskLink } from './extensions/TaskLink';
import { GoalLink } from './extensions/GoalLink';
import type { VaultBlock, VaultPage } from '../api';
import './editor.css';

// Create lowlight instance with common languages
const lowlight = createLowlight(common);

interface BlockEditorProps {
  pageId: string;
  initialContent?: VaultBlock[];
  onContentChange?: (content: string) => void;
  onSave?: () => void;
  onCreatePage?: (title: string) => Promise<VaultPage>;
  onPageClick?: (pageId: string) => void;
  onTaskClick?: (taskId: string) => void;
  onGoalClick?: (goalId: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  autoFocus?: boolean;
}

export function BlockEditor({
  pageId: _pageId,
  initialContent,
  onContentChange,
  onSave,
  onCreatePage,
  onPageClick,
  onTaskClick,
  onGoalClick,
  placeholder = "Type '/' for commands, '[[' for page links...",
  readOnly = false,
  autoFocus = false,
}: BlockEditorProps) {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline cursor-pointer hover:text-blue-800',
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
      // Custom extensions for missing block types
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
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none max-w-none',
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
          onContentChange(html);
        }, 500);
      }
    },
  });

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + S to save
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        onSave?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editor, onSave]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  if (!editor) {
    return (
      <div className="animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
      </div>
    );
  }

  return (
    <div className="block-editor">
      <SlashMenu editor={editor} onCreatePage={onCreatePage} />
      <PageLinkMenu
        editor={editor}
        onCreatePage={onCreatePage}
        onTaskClick={onTaskClick}
        onGoalClick={onGoalClick}
      />
      <BlockMenu editor={editor} />
      <EditorContent editor={editor} />
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

export type { BlockEditorProps };

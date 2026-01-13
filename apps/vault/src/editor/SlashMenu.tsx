import { useState, useEffect, useCallback, useRef } from 'react';
import { Editor } from '@tiptap/react';
import {
  Bars3BottomLeftIcon,
  ListBulletIcon,
  HashtagIcon,
  CheckCircleIcon,
  CodeBracketIcon,
  ChatBubbleLeftIcon,
  PhotoIcon,
  MinusIcon,
  LightBulbIcon,
  ChevronRightIcon,
  PaperClipIcon,
  LinkIcon,
  DocumentPlusIcon,
} from '@heroicons/react/24/outline';
import { FileUploadModal } from '../components/FileUploadModal';
import type { VaultPage } from '../api';

type PendingAction = 'file' | 'image' | 'page' | null;

interface SlashMenuItem {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  command: (editor: Editor) => void;
  keywords?: string[];
  asyncAction?: PendingAction; // If set, triggers modal instead of immediate command
}

const SLASH_MENU_ITEMS: SlashMenuItem[] = [
  {
    title: 'Text',
    description: 'Just start writing with plain text.',
    icon: Bars3BottomLeftIcon,
    command: (editor) => editor.chain().focus().setParagraph().run(),
    keywords: ['text', 'paragraph', 'plain'],
  },
  {
    title: 'Heading 1',
    description: 'Big section heading.',
    icon: HashtagIcon,
    command: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    keywords: ['h1', 'heading', 'title', 'big'],
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading.',
    icon: HashtagIcon,
    command: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    keywords: ['h2', 'heading', 'subtitle'],
  },
  {
    title: 'Heading 3',
    description: 'Small section heading.',
    icon: HashtagIcon,
    command: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    keywords: ['h3', 'heading', 'small'],
  },
  {
    title: 'Bulleted List',
    description: 'Create a simple bulleted list.',
    icon: ListBulletIcon,
    command: (editor) => editor.chain().focus().toggleBulletList().run(),
    keywords: ['bullet', 'list', 'unordered', 'ul'],
  },
  {
    title: 'Numbered List',
    description: 'Create a list with numbering.',
    icon: ListBulletIcon,
    command: (editor) => editor.chain().focus().toggleOrderedList().run(),
    keywords: ['number', 'list', 'ordered', 'ol'],
  },
  {
    title: 'To-do List',
    description: 'Track tasks with a to-do list.',
    icon: CheckCircleIcon,
    command: (editor) => editor.chain().focus().toggleTaskList().run(),
    keywords: ['todo', 'task', 'checkbox', 'check'],
  },
  {
    title: 'Quote',
    description: 'Capture a quote.',
    icon: ChatBubbleLeftIcon,
    command: (editor) => editor.chain().focus().toggleBlockquote().run(),
    keywords: ['quote', 'blockquote', 'cite'],
  },
  {
    title: 'Divider',
    description: 'Visually divide blocks.',
    icon: MinusIcon,
    command: (editor) => editor.chain().focus().setHorizontalRule().run(),
    keywords: ['divider', 'hr', 'line', 'separator'],
  },
  {
    title: 'Code Block',
    description: 'Capture a code snippet.',
    icon: CodeBracketIcon,
    command: (editor) => editor.chain().focus().toggleCodeBlock().run(),
    keywords: ['code', 'snippet', 'pre', 'programming'],
  },
  {
    title: 'Image',
    description: 'Upload or embed an image.',
    icon: PhotoIcon,
    command: () => {}, // Handled via asyncAction
    asyncAction: 'image',
    keywords: ['image', 'picture', 'photo', 'img'],
  },
  {
    title: 'Callout',
    description: 'Highlight important information.',
    icon: LightBulbIcon,
    command: (editor) => {
      editor.chain().focus().setCallout({ emoji: '💡', type: 'info' }).run();
    },
    keywords: ['callout', 'highlight', 'info', 'note', 'warning', 'tip'],
  },
  {
    title: 'Toggle',
    description: 'Collapsible content block.',
    icon: ChevronRightIcon,
    command: (editor) => {
      editor.chain().focus().setToggle().run();
    },
    keywords: ['toggle', 'collapse', 'expand', 'details', 'accordion'],
  },
  {
    title: 'File',
    description: 'Attach a file.',
    icon: PaperClipIcon,
    command: () => {}, // Handled via asyncAction
    asyncAction: 'file',
    keywords: ['file', 'attachment', 'document', 'pdf', 'upload'],
  },
  {
    title: 'Bookmark',
    description: 'Save a link with preview.',
    icon: LinkIcon,
    command: (editor) => {
      const url = window.prompt('Enter URL to bookmark:');
      if (url) {
        // For now, just use the URL as the title
        // In the future, we could fetch metadata from the URL
        let title = url;
        try {
          title = new URL(url).hostname;
        } catch {
          // Use URL as title if parsing fails
        }
        editor.chain().focus().setBookmark({ url, title }).run();
      }
    },
    keywords: ['bookmark', 'link', 'embed', 'url', 'website'],
  },
  {
    title: 'Page',
    description: 'Create a nested sub-page.',
    icon: DocumentPlusIcon,
    command: () => {}, // Handled via asyncAction
    asyncAction: 'page',
    keywords: ['page', 'subpage', 'nested', 'child', 'new'],
  },
];

interface SlashMenuProps {
  editor: Editor;
  onCreatePage?: (title: string) => Promise<VaultPage>;
}

export function SlashMenu({ editor, onCreatePage }: SlashMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const slashPosRef = useRef<number | null>(null);
  const isCreatingPageRef = useRef(false);

  // Filter items based on query
  const filteredItems = query
    ? SLASH_MENU_ITEMS.filter((item) => {
        const searchQuery = query.toLowerCase();
        return (
          item.title.toLowerCase().includes(searchQuery) ||
          item.keywords?.some((k) => k.includes(searchQuery))
        );
      })
    : SLASH_MENU_ITEMS;

  // Handle editor updates to detect slash
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      const { state } = editor;
      const { selection } = state;
      const { $from } = selection;

      // Get text from start of current node to cursor
      const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);

      // Look for slash at the start of line or after space
      const slashMatch = textBefore.match(/(?:^|\s)\/([^\s]*)$/);

      if (slashMatch) {
        // Slash found
        const slashIndex = textBefore.lastIndexOf('/');
        slashPosRef.current = $from.start() + slashIndex;

        if (!isOpen) {
          // Open menu
          const coords = editor.view.coordsAtPos(selection.from);
          setPosition({ top: coords.top, left: coords.left });
          setIsOpen(true);
        }

        // Update query
        const searchQuery = slashMatch[1] || '';
        setQuery(searchQuery);
        setSelectedIndex(0);
      } else if (isOpen) {
        // No slash found, close menu
        setIsOpen(false);
        slashPosRef.current = null;
      }
    };

    editor.on('update', handleUpdate);
    editor.on('selectionUpdate', handleUpdate);

    return () => {
      editor.off('update', handleUpdate);
      editor.off('selectionUpdate', handleUpdate);
    };
  }, [editor, isOpen]);

  // Define selectItem before the keyboard handler useEffect that uses it
  const selectItem = useCallback(
    (item: SlashMenuItem) => {
      console.log('[SlashMenu] selectItem called:', item.title, { asyncAction: item.asyncAction });

      // Delete the slash and any query text
      if (slashPosRef.current !== null) {
        const { state } = editor;
        const { selection } = state;
        const from = slashPosRef.current;
        const to = selection.from;
        console.log('[SlashMenu] Deleting slash text from', from, 'to', to);
        editor.chain().focus().deleteRange({ from, to }).run();
      }

      // Check if this is an async action that needs a modal
      if (item.asyncAction) {
        console.log('[SlashMenu] Setting pendingAction to:', item.asyncAction);
        setPendingAction(item.asyncAction);
        setIsOpen(false);
        slashPosRef.current = null;
        return;
      }

      // Execute the command
      console.log('[SlashMenu] Executing command');
      item.command(editor);
      setIsOpen(false);
      slashPosRef.current = null;
    },
    [editor]
  );

  // Handle keyboard navigation - use capture phase to intercept before ProseMirror
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          event.stopPropagation();
          setSelectedIndex((prev) =>
            filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          event.stopPropagation();
          setSelectedIndex((prev) =>
            filteredItems.length > 0
              ? (prev - 1 + filteredItems.length) % filteredItems.length
              : 0
          );
          break;
        case 'Enter':
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          if (filteredItems[selectedIndex]) {
            selectItem(filteredItems[selectedIndex]);
          }
          break;
        case 'Escape':
          event.preventDefault();
          event.stopPropagation();
          setIsOpen(false);
          slashPosRef.current = null;
          editor.commands.focus();
          break;
      }
    };

    // Use capture phase to intercept events before ProseMirror handles them
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, selectedIndex, filteredItems, editor, selectItem]);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        slashPosRef.current = null;
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Handle file selection from modal
  const handleFileSelect = useCallback(
    (file: { url: string; filename: string; size?: number; mimeType?: string }) => {
      if (pendingAction === 'file') {
        editor.chain().focus().setFileAttachment({
          url: file.url,
          filename: file.filename,
          size: file.size,
          mimeType: file.mimeType,
        }).run();
      } else if (pendingAction === 'image') {
        editor.chain().focus().setImage({ src: file.url, alt: file.filename }).run();
      }
      setPendingAction(null);
    },
    [editor, pendingAction]
  );

  const handleModalClose = useCallback(() => {
    setPendingAction(null);
    editor.commands.focus();
  }, [editor]);

  // Handle page creation - Notion-style: create immediately without prompt
  useEffect(() => {
    if (pendingAction !== 'page') {
      return;
    }

    // Prevent duplicate calls (React Strict Mode can trigger effects twice)
    if (isCreatingPageRef.current) {
      console.log('[SlashMenu] Page creation already in progress, skipping');
      return;
    }

    if (!onCreatePage) {
      console.error('[SlashMenu] onCreatePage prop is not provided - cannot create page');
      setPendingAction(null);
      return;
    }

    const createPage = async () => {
      isCreatingPageRef.current = true;
      try {
        console.log('[SlashMenu] Creating page...');
        // Create page with "Untitled" name immediately (Notion-style)
        const newPage = await onCreatePage('Untitled');
        console.log('[SlashMenu] Page created:', newPage);
        // Insert a link to the new page
        editor.chain().focus().setPageLink({
          pageId: newPage.id,
          title: newPage.title,
        }).run();
        console.log('[SlashMenu] Page link inserted');
      } catch (error) {
        console.error('[SlashMenu] Failed to create page:', error);
        // Also log the error details
        if (error instanceof Error) {
          console.error('[SlashMenu] Error details:', error.message, error.stack);
        }
      } finally {
        isCreatingPageRef.current = false;
        setPendingAction(null);
        editor.commands.focus();
      }
    };

    createPage();
  }, [pendingAction, onCreatePage, editor]);

  return (
    <>
      {/* File/Image upload modal */}
      <FileUploadModal
        isOpen={pendingAction === 'file' || pendingAction === 'image'}
        onClose={handleModalClose}
        onFileSelect={handleFileSelect}
      />

      {/* Slash command menu */}
      {isOpen && position && (
        <div
          ref={menuRef}
          className="fixed z-50 w-72 bg-white rounded-lg shadow-lg border border-gray-200 py-1 max-h-80 overflow-y-auto"
          style={{
            top: position.top + 24,
            left: position.left,
          }}
        >
          {filteredItems.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500">No results found</div>
          ) : (
            filteredItems.map((item, index) => (
              <button
                key={item.title}
                className={`w-full px-4 py-2 flex items-start gap-3 hover:bg-gray-100 transition-colors ${
                  index === selectedIndex ? 'bg-gray-100' : ''
                }`}
                onClick={() => selectItem(item)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="flex-shrink-0 w-10 h-10 rounded bg-gray-100 flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium text-gray-900">{item.title}</div>
                  <div className="text-xs text-gray-500">{item.description}</div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </>
  );
}

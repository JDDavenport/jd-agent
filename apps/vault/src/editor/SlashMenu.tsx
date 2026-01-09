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
} from '@heroicons/react/24/outline';

interface SlashMenuItem {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  command: (editor: Editor) => void;
  keywords?: string[];
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
    command: (editor) => {
      const url = window.prompt('Enter image URL:');
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    },
    keywords: ['image', 'picture', 'photo', 'img'],
  },
];

interface SlashMenuProps {
  editor: Editor;
}

export function SlashMenu({ editor }: SlashMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const slashPosRef = useRef<number | null>(null);

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

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex((prev) =>
            filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex((prev) =>
            filteredItems.length > 0
              ? (prev - 1 + filteredItems.length) % filteredItems.length
              : 0
          );
          break;
        case 'Enter':
          event.preventDefault();
          if (filteredItems[selectedIndex]) {
            selectItem(filteredItems[selectedIndex]);
          }
          break;
        case 'Escape':
          event.preventDefault();
          setIsOpen(false);
          slashPosRef.current = null;
          editor.commands.focus();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredItems, editor]);

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

  const selectItem = useCallback(
    (item: SlashMenuItem) => {
      // Delete the slash and any query text
      if (slashPosRef.current !== null) {
        const { state } = editor;
        const { selection } = state;
        const from = slashPosRef.current;
        const to = selection.from;
        editor.chain().focus().deleteRange({ from, to }).run();
      }

      // Execute the command
      item.command(editor);
      setIsOpen(false);
      slashPosRef.current = null;
    },
    [editor]
  );

  if (!isOpen || !position) return null;

  return (
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
  );
}

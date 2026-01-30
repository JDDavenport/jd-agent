import { memo, useState, useCallback, useMemo } from 'react';
import { Editor } from '@tiptap/react';
import { XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface MobileSlashMenuProps {
  editor: Editor | null;
  isOpen: boolean;
  onClose: () => void;
}

interface BlockOption {
  id: string;
  label: string;
  description: string;
  icon: string;
  category: 'basic' | 'media' | 'advanced';
  action: (editor: Editor) => void;
}

const blockOptions: BlockOption[] = [
  // Basic blocks
  {
    id: 'text',
    label: 'Text',
    description: 'Plain text paragraph',
    icon: '📝',
    category: 'basic',
    action: (editor) => editor.chain().focus().setParagraph().run(),
  },
  {
    id: 'h1',
    label: 'Heading 1',
    description: 'Large section heading',
    icon: 'H1',
    category: 'basic',
    action: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    id: 'h2',
    label: 'Heading 2',
    description: 'Medium section heading',
    icon: 'H2',
    category: 'basic',
    action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    id: 'h3',
    label: 'Heading 3',
    description: 'Small section heading',
    icon: 'H3',
    category: 'basic',
    action: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    id: 'bullet',
    label: 'Bulleted List',
    description: 'Create a simple list',
    icon: '•',
    category: 'basic',
    action: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    id: 'numbered',
    label: 'Numbered List',
    description: 'Create a numbered list',
    icon: '1.',
    category: 'basic',
    action: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    id: 'todo',
    label: 'To-do List',
    description: 'Track tasks with checkboxes',
    icon: '☑️',
    category: 'basic',
    action: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    id: 'quote',
    label: 'Quote',
    description: 'Capture a quote',
    icon: '"',
    category: 'basic',
    action: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    id: 'divider',
    label: 'Divider',
    description: 'Visual separator',
    icon: '—',
    category: 'basic',
    action: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },

  // Media blocks
  {
    id: 'code',
    label: 'Code Block',
    description: 'Capture code snippet',
    icon: '</>',
    category: 'media',
    action: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: 'image',
    label: 'Image',
    description: 'Upload or embed image',
    icon: '🖼️',
    category: 'media',
    action: (editor) => {
      const url = window.prompt('Enter image URL:');
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
    },
  },

  // Advanced blocks
  {
    id: 'callout',
    label: 'Callout',
    description: 'Highlight important info',
    icon: '💡',
    category: 'advanced',
    action: (editor) => {
      editor.chain().focus().insertContent({
        type: 'callout',
        attrs: { emoji: '💡', type: 'info' },
        content: [{ type: 'paragraph' }],
      }).run();
    },
  },
  {
    id: 'toggle',
    label: 'Toggle',
    description: 'Collapsible content',
    icon: '▶️',
    category: 'advanced',
    action: (editor) => {
      editor.chain().focus().insertContent({
        type: 'toggle',
        attrs: { open: true },
        content: [
          { type: 'toggleSummary', content: [{ type: 'text', text: 'Toggle title' }] },
          { type: 'toggleContent', content: [{ type: 'paragraph' }] },
        ],
      }).run();
    },
  },
];

const categories = [
  { id: 'basic', label: 'Basic Blocks' },
  { id: 'media', label: 'Media' },
  { id: 'advanced', label: 'Advanced' },
] as const;

export const MobileSlashMenu = memo(function MobileSlashMenu({
  editor,
  isOpen,
  onClose,
}: MobileSlashMenuProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) {
      return blockOptions;
    }
    const query = searchQuery.toLowerCase();
    return blockOptions.filter(
      (option) =>
        option.label.toLowerCase().includes(query) ||
        option.description.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const handleSelect = useCallback(
    (option: BlockOption) => {
      if (editor) {
        option.action(editor);
        onClose();
        setSearchQuery('');
      }
    },
    [editor, onClose]
  );

  const handleClose = useCallback(() => {
    setSearchQuery('');
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col safe-area-inset">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
        <button
          onClick={handleClose}
          className="p-2 -ml-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 touch-manipulation"
          aria-label="Close"
        >
          <XMarkIcon className="w-6 h-6 text-gray-500" />
        </button>
        <h2 className="text-lg font-semibold text-gray-900">Add Block</h2>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search blocks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-100 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>
      </div>

      {/* Block List */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {searchQuery ? (
          // Flat list when searching
          <div className="p-2">
            {filteredOptions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No blocks found</div>
            ) : (
              filteredOptions.map((option) => (
                <BlockOptionButton key={option.id} option={option} onSelect={handleSelect} />
              ))
            )}
          </div>
        ) : (
          // Categorized list
          categories.map((category) => {
            const categoryOptions = blockOptions.filter((o) => o.category === category.id);
            if (categoryOptions.length === 0) return null;

            return (
              <div key={category.id} className="py-2">
                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {category.label}
                </div>
                <div className="px-2">
                  {categoryOptions.map((option) => (
                    <BlockOptionButton key={option.id} option={option} onSelect={handleSelect} />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

interface BlockOptionButtonProps {
  option: BlockOption;
  onSelect: (option: BlockOption) => void;
}

const BlockOptionButton = memo(function BlockOptionButton({
  option,
  onSelect,
}: BlockOptionButtonProps) {
  return (
    <button
      onClick={() => onSelect(option)}
      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 active:bg-gray-100 touch-manipulation transition-colors text-left"
    >
      <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg text-lg flex-shrink-0">
        {option.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900">{option.label}</div>
        <div className="text-sm text-gray-500 truncate">{option.description}</div>
      </div>
    </button>
  );
});

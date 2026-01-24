import { memo, useCallback, useState } from 'react';
import { Editor } from '@tiptap/react';
import {
  BoldIcon,
  ItalicIcon,
  StrikethroughIcon,
  CodeBracketIcon,
  LinkIcon,
  ListBulletIcon,
  QueueListIcon,
  CheckCircleIcon,
  ChevronUpIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';

interface FloatingToolbarProps {
  editor: Editor | null;
  onOpenSlashMenu: () => void;
  isKeyboardVisible: boolean;
}

interface ToolbarButton {
  icon: typeof BoldIcon;
  label: string;
  action: (editor: Editor) => void;
  isActive?: (editor: Editor) => boolean;
}

const formatButtons: ToolbarButton[] = [
  {
    icon: BoldIcon,
    label: 'Bold',
    action: (editor) => editor.chain().focus().toggleBold().run(),
    isActive: (editor) => editor.isActive('bold'),
  },
  {
    icon: ItalicIcon,
    label: 'Italic',
    action: (editor) => editor.chain().focus().toggleItalic().run(),
    isActive: (editor) => editor.isActive('italic'),
  },
  {
    icon: StrikethroughIcon,
    label: 'Strikethrough',
    action: (editor) => editor.chain().focus().toggleStrike().run(),
    isActive: (editor) => editor.isActive('strike'),
  },
  {
    icon: CodeBracketIcon,
    label: 'Code',
    action: (editor) => editor.chain().focus().toggleCode().run(),
    isActive: (editor) => editor.isActive('code'),
  },
  {
    icon: LinkIcon,
    label: 'Link',
    action: (editor) => {
      const url = window.prompt('Enter URL:');
      if (url) {
        editor.chain().focus().setLink({ href: url }).run();
      }
    },
    isActive: (editor) => editor.isActive('link'),
  },
];

const blockButtons: ToolbarButton[] = [
  {
    icon: ListBulletIcon,
    label: 'Bullet List',
    action: (editor) => editor.chain().focus().toggleBulletList().run(),
    isActive: (editor) => editor.isActive('bulletList'),
  },
  {
    icon: QueueListIcon,
    label: 'Numbered List',
    action: (editor) => editor.chain().focus().toggleOrderedList().run(),
    isActive: (editor) => editor.isActive('orderedList'),
  },
  {
    icon: CheckCircleIcon,
    label: 'Task List',
    action: (editor) => editor.chain().focus().toggleTaskList().run(),
    isActive: (editor) => editor.isActive('taskList'),
  },
];

export const FloatingToolbar = memo(function FloatingToolbar({
  editor,
  onOpenSlashMenu,
  isKeyboardVisible,
}: FloatingToolbarProps) {
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  // Always show a minimal toolbar, expand when keyboard visible
  if (!editor) {
    return null;
  }

  // Show minimal prompt when keyboard not visible
  if (!isKeyboardVisible && !showMoreOptions) {
    return (
      <div
        className="fixed left-0 right-0 bg-gray-100 border-t border-gray-200 z-40"
        style={{ bottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-center px-4 py-3">
          <span className="text-sm text-gray-500">Tap editor to start formatting</span>
        </div>
      </div>
    );
  }

  const handleButtonClick = useCallback(
    (action: (editor: Editor) => void) => {
      if (editor) {
        action(editor);
      }
    },
    [editor]
  );

  return (
    <div
      className={`
        fixed left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-40
        transition-transform duration-200 ease-out
        ${isKeyboardVisible ? 'translate-y-0' : 'translate-y-full'}
      `}
      style={{ bottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {/* Main Toolbar Row */}
      <div className="flex items-center justify-between px-2 py-1">
        {/* Add Block Button */}
        <button
          onClick={onOpenSlashMenu}
          className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-600 text-white active:bg-blue-700 touch-manipulation"
          aria-label="Add block"
        >
          <PlusIcon className="w-5 h-5" />
        </button>

        {/* Format Buttons */}
        <div className="flex items-center gap-1 flex-1 justify-center overflow-x-auto">
          {formatButtons.map((button) => {
            const Icon = button.icon;
            const isActive = button.isActive?.(editor) ?? false;

            return (
              <button
                key={button.label}
                onClick={() => handleButtonClick(button.action)}
                className={`
                  flex items-center justify-center w-10 h-10 rounded-lg
                  touch-manipulation transition-colors
                  ${isActive ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100 active:bg-gray-200'}
                `}
                aria-label={button.label}
                aria-pressed={isActive}
              >
                <Icon className="w-5 h-5" />
              </button>
            );
          })}
        </div>

        {/* Expand/Collapse Button */}
        <button
          onClick={() => setShowMoreOptions(!showMoreOptions)}
          className={`
            flex items-center justify-center w-10 h-10 rounded-lg
            text-gray-600 hover:bg-gray-100 active:bg-gray-200 touch-manipulation
            transition-transform
          `}
          aria-label={showMoreOptions ? 'Show less' : 'Show more'}
          aria-expanded={showMoreOptions}
        >
          <ChevronUpIcon className={`w-5 h-5 transition-transform ${showMoreOptions ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Expanded Options */}
      {showMoreOptions && (
        <div className="px-2 py-2 border-t border-gray-100">
          <div className="flex items-center gap-1">
            {/* Block Type Buttons */}
            {blockButtons.map((button) => {
              const Icon = button.icon;
              const isActive = button.isActive?.(editor) ?? false;

              return (
                <button
                  key={button.label}
                  onClick={() => handleButtonClick(button.action)}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg
                    touch-manipulation transition-colors text-sm font-medium
                    ${isActive ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100 active:bg-gray-200'}
                  `}
                  aria-label={button.label}
                  aria-pressed={isActive}
                >
                  <Icon className="w-5 h-5" />
                  <span>{button.label}</span>
                </button>
              );
            })}
          </div>

          {/* Heading Options */}
          <div className="flex items-center gap-1 mt-2">
            {[1, 2, 3].map((level) => {
              const isActive = editor.isActive('heading', { level });

              return (
                <button
                  key={`h${level}`}
                  onClick={() =>
                    editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run()
                  }
                  className={`
                    flex items-center justify-center px-3 py-2 rounded-lg
                    touch-manipulation transition-colors text-sm font-medium
                    ${isActive ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100 active:bg-gray-200'}
                  `}
                  aria-label={`Heading ${level}`}
                  aria-pressed={isActive}
                >
                  H{level}
                </button>
              );
            })}

            <button
              onClick={() => editor.chain().focus().setParagraph().run()}
              className={`
                flex items-center justify-center px-3 py-2 rounded-lg
                touch-manipulation transition-colors text-sm font-medium
                ${editor.isActive('paragraph') && !editor.isActive('heading') ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100 active:bg-gray-200'}
              `}
              aria-label="Paragraph"
            >
              Text
            </button>

            <button
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className={`
                flex items-center justify-center px-3 py-2 rounded-lg
                touch-manipulation transition-colors text-sm font-medium
                ${editor.isActive('blockquote') ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100 active:bg-gray-200'}
              `}
              aria-label="Quote"
            >
              Quote
            </button>

            <button
              onClick={() => editor.chain().focus().toggleCodeBlock().run()}
              className={`
                flex items-center justify-center px-3 py-2 rounded-lg
                touch-manipulation transition-colors text-sm font-medium
                ${editor.isActive('codeBlock') ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100 active:bg-gray-200'}
              `}
              aria-label="Code Block"
            >
              Code
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

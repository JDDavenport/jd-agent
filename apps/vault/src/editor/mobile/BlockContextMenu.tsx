import { memo, useCallback, useEffect, useRef } from 'react';
import { Editor } from '@tiptap/react';
import {
  TrashIcon,
  DocumentDuplicateIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ClipboardDocumentIcon,
  ScissorsIcon,
  ArrowsUpDownIcon,
} from '@heroicons/react/24/outline';

interface BlockContextMenuProps {
  editor: Editor | null;
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
}

interface ContextAction {
  id: string;
  label: string;
  icon: typeof TrashIcon;
  action: (editor: Editor) => void;
  destructive?: boolean;
}

const contextActions: ContextAction[] = [
  {
    id: 'duplicate',
    label: 'Duplicate',
    icon: DocumentDuplicateIcon,
    action: (editor) => {
      const { from, to } = editor.state.selection;
      const content = editor.state.doc.slice(from, to);
      editor.chain().focus().insertContentAt(to, content.toJSON()).run();
    },
  },
  {
    id: 'copy',
    label: 'Copy',
    icon: ClipboardDocumentIcon,
    action: (editor) => {
      const { from, to } = editor.state.selection;
      const text = editor.state.doc.textBetween(from, to, '\n');
      navigator.clipboard.writeText(text);
    },
  },
  {
    id: 'cut',
    label: 'Cut',
    icon: ScissorsIcon,
    action: (editor) => {
      const { from, to } = editor.state.selection;
      const text = editor.state.doc.textBetween(from, to, '\n');
      navigator.clipboard.writeText(text);
      editor.chain().focus().deleteSelection().run();
    },
  },
  {
    id: 'moveUp',
    label: 'Move Up',
    icon: ArrowUpIcon,
    action: (editor) => {
      // Move the current block up
      const { $from } = editor.state.selection;
      const blockStart = $from.start($from.depth);
      if (blockStart > 1) {
        editor.chain().focus().lift('listItem').run();
      }
    },
  },
  {
    id: 'moveDown',
    label: 'Move Down',
    icon: ArrowDownIcon,
    action: (editor) => {
      // Move the current block down
      editor.chain().focus().sinkListItem('listItem').run();
    },
  },
  {
    id: 'turnInto',
    label: 'Turn into...',
    icon: ArrowsUpDownIcon,
    action: () => {
      // This will open the slash menu for block type conversion
      // Handled separately
    },
  },
  {
    id: 'delete',
    label: 'Delete',
    icon: TrashIcon,
    destructive: true,
    action: (editor) => {
      editor.chain().focus().deleteSelection().run();
    },
  },
];

export const BlockContextMenu = memo(function BlockContextMenu({
  editor,
  isOpen,
  position,
  onClose,
}: BlockContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleAction = useCallback(
    (action: ContextAction) => {
      if (editor) {
        action.action(editor);
        onClose();
      }
    },
    [editor, onClose]
  );

  if (!isOpen || !editor) return null;

  // Calculate position to keep menu in viewport
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    top: Math.min(position.y, window.innerHeight - 400),
    left: Math.min(Math.max(position.x - 100, 16), window.innerWidth - 216),
    zIndex: 50,
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Menu */}
      <div
        ref={menuRef}
        style={menuStyle}
        className="w-52 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50"
        role="menu"
        aria-label="Block actions"
      >
        <div className="py-1">
          {contextActions.map((action, index) => {
            const Icon = action.icon;

            // Add separator before delete
            if (action.destructive && index > 0) {
              return (
                <div key={action.id}>
                  <div className="h-px bg-gray-200 my-1" />
                  <button
                    onClick={() => handleAction(action)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 active:bg-red-100 touch-manipulation transition-colors"
                    role="menuitem"
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{action.label}</span>
                  </button>
                </div>
              );
            }

            return (
              <button
                key={action.id}
                onClick={() => handleAction(action)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3
                  hover:bg-gray-50 active:bg-gray-100 touch-manipulation transition-colors
                  ${action.destructive ? 'text-red-600' : 'text-gray-700'}
                `}
                role="menuitem"
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
});

// Hook for handling long press
export function useLongPress(
  onLongPress: (e: React.TouchEvent | React.MouseEvent) => void,
  delay = 500
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetRef = useRef<EventTarget | null>(null);

  const start = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      targetRef.current = e.target;
      timeoutRef.current = setTimeout(() => {
        onLongPress(e);
      }, delay);
    },
    [onLongPress, delay]
  );

  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return {
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchMove: clear,
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
  };
}

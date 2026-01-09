import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function JournalEditor({ value, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder:
          'How was your day? What are you grateful for? What did you learn? What could have gone better?',
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4',
      },
    },
  });

  // Sync external value changes
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  const wordCount = editor?.getText().trim().split(/\s+/).filter(Boolean).length || 0;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Journal Entry</h2>
        <p className="text-sm text-gray-500 mt-1">
          Reflect on your day, thoughts, and learnings
        </p>
      </div>

      {/* Editor toolbar */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 px-4 py-2 flex items-center gap-2">
          <button
            onClick={() => editor?.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded hover:bg-gray-100 ${
              editor?.isActive('bold') ? 'bg-gray-200' : ''
            }`}
            title="Bold"
          >
            <strong className="text-sm">B</strong>
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded hover:bg-gray-100 ${
              editor?.isActive('italic') ? 'bg-gray-200' : ''
            }`}
            title="Italic"
          >
            <em className="text-sm">I</em>
          </button>
          <div className="w-px h-4 bg-gray-200 mx-1" />
          <button
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-1.5 rounded hover:bg-gray-100 text-sm ${
              editor?.isActive('heading', { level: 2 }) ? 'bg-gray-200' : ''
            }`}
            title="Heading"
          >
            H
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded hover:bg-gray-100 text-sm ${
              editor?.isActive('bulletList') ? 'bg-gray-200' : ''
            }`}
            title="Bullet List"
          >
            •
          </button>
          <button
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            className={`p-1.5 rounded hover:bg-gray-100 text-sm ${
              editor?.isActive('blockquote') ? 'bg-gray-200' : ''
            }`}
            title="Quote"
          >
            "
          </button>
        </div>

        {/* Editor content */}
        <EditorContent editor={editor} />

        {/* Footer */}
        <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between text-xs text-gray-400">
          <span>{wordCount} words</span>
          <span>Auto-saving every 30 seconds</span>
        </div>
      </div>

      {/* Prompts */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        {[
          'What went well today?',
          'What could have gone better?',
          'What am I grateful for?',
          'What did I learn?',
        ].map((prompt) => (
          <button
            key={prompt}
            onClick={() => {
              editor?.chain().focus().insertContent(`\n\n**${prompt}**\n`).run();
            }}
            className="p-3 text-left text-sm text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

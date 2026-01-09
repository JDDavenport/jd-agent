import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useVaultEntry, useCreateVaultEntry, useUpdateVaultEntry, useVaultContexts } from '../hooks/useVault';
import MarkdownIt from 'markdown-it';
import MdEditor from 'react-markdown-editor-lite';
import 'react-markdown-editor-lite/lib/index.css';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';

const mdParser = new MarkdownIt();

function NoteEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNewNote = !id || id === 'new';

  const { data: entry, isLoading: loadingEntry } = useVaultEntry(id || '');
  const { data: contexts } = useVaultContexts();
  const createEntry = useCreateVaultEntry();
  const updateEntry = useUpdateVaultEntry();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [context, setContext] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [contentType, setContentType] = useState<'note' | 'lecture' | 'meeting' | 'article' | 'reference'>('note');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Load entry data when editing
  useEffect(() => {
    if (entry && !isNewNote) {
      setTitle(entry.title);
      setContent(entry.content);
      setContext(entry.context || '');
      setTags(entry.tags || []);
      setContentType(entry.contentType as any);
    }
  }, [entry, isNewNote]);

  const handleEditorChange = ({ text }: { text: string }) => {
    setContent(text);
  };

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      alert('Please provide a title and content');
      return;
    }

    setIsSaving(true);
    try {
      if (isNewNote) {
        const newEntry = await createEntry.mutateAsync({
          title: title.trim(),
          content: content.trim(),
          contentType,
          context: context.trim() || undefined,
          tags: tags.length > 0 ? tags : undefined,
          source: 'manual',
        });
        setLastSaved(new Date());
        // Navigate to the newly created entry
        navigate(`/vault/${newEntry.id}`, { replace: true });
      } else {
        await updateEntry.mutateAsync({
          id: id!,
          data: {
            title: title.trim(),
            content: content.trim(),
            contentType,
            context: context.trim() || undefined,
            tags: tags.length > 0 ? tags : undefined,
          },
        });
        setLastSaved(new Date());
      }
    } catch (error) {
      alert(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (loadingEntry && !isNewNote) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            to="/vault"
            className="text-text-muted hover:text-text transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">
              {isNewNote ? 'New Note' : 'Edit Note'}
            </h1>
            {lastSaved && (
              <p className="text-sm text-text-muted">
                Last saved {lastSaved.toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="secondary"
            onClick={() => navigate('/vault')}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !title.trim() || !content.trim()}>
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="card space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-text mb-2">
            Title <span className="text-error">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter note title..."
            className="input w-full text-lg"
          />
        </div>

        {/* Metadata Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Content Type */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Type
            </label>
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value as any)}
              className="input w-full"
            >
              <option value="note">📝 Note</option>
              <option value="lecture">🎓 Lecture</option>
              <option value="meeting">👥 Meeting</option>
              <option value="article">📰 Article</option>
              <option value="reference">📚 Reference</option>
            </select>
          </div>

          {/* Context */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Context
            </label>
            <input
              type="text"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="e.g., CS 501, Personal, Work..."
              list="contexts"
              className="input w-full"
            />
            {contexts && contexts.length > 0 && (
              <datalist id="contexts">
                {contexts.map((ctx) => (
                  <option key={ctx} value={ctx} />
                ))}
              </datalist>
            )}
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-text mb-2">
            Tags
          </label>
          <div className="flex space-x-2 mb-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add tags..."
              className="input flex-1"
            />
            <Button variant="secondary" onClick={handleAddTag} disabled={!tagInput.trim()}>
              Add
            </Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="badge badge-neutral inline-flex items-center space-x-1"
                >
                  <span>#{tag}</span>
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-error ml-1"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Markdown Editor */}
        <div>
          <label className="block text-sm font-medium text-text mb-2">
            Content <span className="text-error">*</span>
          </label>
          <div className="border border-dark-border rounded-lg overflow-hidden">
            <MdEditor
              value={content}
              renderHTML={(text) => mdParser.render(text)}
              onChange={handleEditorChange}
              style={{ height: '500px' }}
              config={{
                view: {
                  menu: true,
                  md: true,
                  html: true,
                },
                canView: {
                  menu: true,
                  md: true,
                  html: true,
                  both: true,
                  fullScreen: true,
                  hideMenu: true,
                },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default NoteEditor;

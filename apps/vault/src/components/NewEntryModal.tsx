import { useState, useRef, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { PlusIcon, XMarkIcon, FolderIcon } from '@heroicons/react/24/outline';
import { useCreateVaultEntry, useVaultBreadcrumb } from '../hooks/useVault';
import type { VaultContentType } from '@jd-agent/types';

interface NewEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentId?: string | null;
}

const CONTEXTS = ['Personal', 'Work', 'MBA', 'Health'];
const CONTENT_TYPES: VaultContentType[] = ['note', 'lecture', 'journal', 'meeting_notes', 'document', 'snippet'];

export function NewEntryModal({ isOpen, onClose, parentId }: NewEntryModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [context, setContext] = useState('Personal');
  const [contentType, setContentType] = useState<VaultContentType>('note');
  const [tags, setTags] = useState('');
  const titleRef = useRef<HTMLInputElement>(null);
  const createEntry = useCreateVaultEntry();
  const { data: breadcrumb } = useVaultBreadcrumb(parentId ?? null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => titleRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    await createEntry.mutateAsync({
      title: title.trim(),
      content: content.trim(),
      context,
      contentType,
      source: 'manual',
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      parentId: parentId ?? undefined,
    });

    setTitle('');
    setContent('');
    setTags('');
    onClose();
  };

  const parentTitle = breadcrumb && breadcrumb.length > 0
    ? breadcrumb[breadcrumb.length - 1].title
    : null;

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-start justify-center pt-10 px-4 overflow-y-auto">
        <Dialog.Panel className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8">
          <form onSubmit={handleSubmit}>
            <div className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                  <PlusIcon className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <Dialog.Title className="text-lg font-semibold">
                    {parentTitle ? 'New Nested Page' : 'New Page'}
                  </Dialog.Title>
                  {parentTitle && (
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <FolderIcon className="w-4 h-4" />
                      Inside: {parentTitle}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="ml-auto p-1 hover:bg-gray-100 rounded"
                >
                  <XMarkIcon className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Title
                  </label>
                  <input
                    ref={titleRef}
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Entry title"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Context
                    </label>
                    <select
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {CONTEXTS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Type
                    </label>
                    <select
                      value={contentType}
                      onChange={(e) => setContentType(e.target.value as VaultContentType)}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {CONTENT_TYPES.map((t) => (
                        <option key={t} value={t}>{t.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Content
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write your content here... (Markdown supported)"
                    rows={10}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="e.g., lecture, neural-networks, important"
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-2 rounded-b-xl">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim() || createEntry.isPending}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50"
              >
                {createEntry.isPending ? 'Creating...' : 'Create Page'}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}

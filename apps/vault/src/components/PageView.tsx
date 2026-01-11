import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  StarIcon,
  EllipsisHorizontalIcon,
  TagIcon,
  CalendarIcon,
  LinkIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  DocumentTextIcon,
  PlusIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import type { VaultEntry } from '../api';

interface PageViewProps {
  entry: VaultEntry;
  children?: VaultEntry[];
  backlinks?: VaultEntry[];
  onUpdate?: (id: string, data: Partial<VaultEntry>) => void;
  onToggleFavorite?: (id: string) => void;
  onLinkClick?: (pageTitle: string) => void;
  onSelectEntry?: (entry: VaultEntry) => void;
  onCreateChild?: (parentId: string) => void;
}

export function PageView({
  entry,
  children = [],
  backlinks = [],
  onUpdate,
  onToggleFavorite,
  onLinkClick,
  onSelectEntry,
  onCreateChild,
}: PageViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(entry.title);
  const [editedContent, setEditedContent] = useState(entry.content || '');

  const isFavorite = entry.tags?.includes('favorite') ?? false;

  const handleSave = () => {
    onUpdate?.(entry.id, {
      title: editedTitle,
      content: editedContent,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedTitle(entry.title);
    setEditedContent(entry.content || '');
    setIsEditing(false);
  };

  // Process wiki-style links [[Page Name]] to markdown links
  const processedContent = useMemo(() => {
    if (!entry.content) return '';
    return entry.content.replace(/\[\[(.*?)\]\]/g, '**[[$1]]**');
  }, [entry.content]);

  // Custom link component to handle wiki links
  const WikiLink = ({ children: linkChildren }: { children?: React.ReactNode }) => {
    const text = String(linkChildren ?? '');
    const match = text.match(/^\[\[(.*?)\]\]$/);
    if (match) {
      return (
        <button
          onClick={() => onLinkClick?.(match[1])}
          className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
        >
          {match[1]}
        </button>
      );
    }
    return <strong>{linkChildren}</strong>;
  };

  // Get icon for entry type
  const getEntryIcon = (e: VaultEntry) => {
    const context = e.context?.toLowerCase() || '';
    const title = e.title?.toLowerCase() || '';

    if (context === 'archive' || title.includes('archive')) return '📦';
    if (context === 'school' || context === 'mba') return '🎓';
    if (context === 'professional') return '💼';
    if (context === 'personal') return '👤';
    if (context === 'reference') return '📚';
    if (title.includes('inbox')) return '📥';
    return '📝';
  };

  return (
    <div className="max-w-3xl mx-auto pb-20">
      {/* Header */}
      <div className="px-8 py-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md capitalize">
            {entry.contentType.replace('_', ' ')}
          </span>
          <span className="text-xs text-gray-400">•</span>
          <span className="text-xs text-gray-500">{entry.context}</span>
          <div className="flex-1" />
          <button
            onClick={() => onToggleFavorite?.(entry.id)}
            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
          >
            {isFavorite ? (
              <StarSolidIcon className="w-5 h-5 text-yellow-500" />
            ) : (
              <StarIcon className="w-5 h-5 text-gray-400" />
            )}
          </button>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
            >
              <PencilIcon className="w-5 h-5 text-gray-400" />
            </button>
          ) : (
            <>
              <button
                onClick={handleSave}
                className="p-1.5 hover:bg-green-100 rounded-md text-green-600 transition-colors"
              >
                <CheckIcon className="w-5 h-5" />
              </button>
              <button
                onClick={handleCancel}
                className="p-1.5 hover:bg-red-100 rounded-md text-red-600 transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </>
          )}
          <button className="p-1.5 hover:bg-gray-100 rounded-md transition-colors">
            <EllipsisHorizontalIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Title */}
        {isEditing ? (
          <input
            type="text"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            className="w-full text-3xl font-bold text-gray-900 border-b-2 border-gray-200 focus:border-blue-500 focus:outline-none pb-2"
            autoFocus
          />
        ) : (
          <h1 className="text-3xl font-bold text-gray-900">{entry.title}</h1>
        )}

        {/* Metadata */}
        <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
          <div className="flex items-center gap-1">
            <CalendarIcon className="w-4 h-4" />
            {format(new Date(entry.createdAt), 'MMMM d, yyyy')}
          </div>
          {entry.tags && entry.tags.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <TagIcon className="w-4 h-4" />
              {entry.tags.map((tag) => (
                <span key={tag} className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full text-xs">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="border-b border-gray-100 mx-8" />

      {/* Content */}
      <div className="px-8 py-6">
        {isEditing ? (
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="w-full min-h-[300px] p-4 border border-gray-200 rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none font-mono text-sm"
            placeholder="Write your content in Markdown..."
          />
        ) : entry.content ? (
          <div className="prose prose-gray max-w-none prose-headings:font-semibold prose-a:text-blue-600">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                strong: WikiLink,
              }}
            >
              {processedContent}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="text-gray-400 italic py-8 text-center">
            No content yet. Click the edit button to add content.
          </div>
        )}
      </div>

      {/* Nested Pages Section (Notion-style) */}
      {(children.length > 0 || onCreateChild) && (
        <div className="px-8 py-6 border-t border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <DocumentTextIcon className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">
                {children.length > 0 ? `${children.length} nested pages` : 'Pages'}
              </span>
            </div>
            {onCreateChild && (
              <button
                onClick={() => onCreateChild(entry.id)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                <span>Add page</span>
              </button>
            )}
          </div>

          {children.length > 0 ? (
            <div className="space-y-1">
              {children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => onSelectEntry?.(child)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-left transition-colors group"
                >
                  <span className="text-lg">{getEntryIcon(child)}</span>
                  <span className="flex-1 text-sm font-medium text-gray-900 truncate">
                    {child.title}
                  </span>
                  <ChevronRightIcon className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <DocumentTextIcon className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No nested pages</p>
              {onCreateChild && (
                <button
                  onClick={() => onCreateChild(entry.id)}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                >
                  Create a page inside this one
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Backlinks */}
      {backlinks.length > 0 && (
        <div className="px-8 py-6 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <LinkIcon className="w-5 h-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">
              {backlinks.length} backlinks
            </span>
          </div>
          <div className="space-y-1">
            {backlinks.map((link) => (
              <button
                key={link.id}
                onClick={() => onSelectEntry?.(link)}
                className="w-full flex items-center gap-3 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 rounded-lg text-left transition-colors"
              >
                <span className="text-lg">{getEntryIcon(link)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{link.title}</div>
                  <div className="text-xs text-gray-500 capitalize">
                    {link.contentType.replace('_', ' ')} • {link.context}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

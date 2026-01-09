import { DocumentTextIcon, AcademicCapIcon, BookOpenIcon, ClipboardDocumentIcon, DocumentIcon, CodeBracketIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { clsx } from 'clsx';
import type { VaultEntry, VaultContentType } from '@jd-agent/types';

interface VaultCardProps {
  entry: VaultEntry;
  onSelect?: (entry: VaultEntry) => void;
}

const typeIcons: Partial<Record<VaultContentType, typeof DocumentTextIcon>> = {
  note: DocumentTextIcon,
  lecture: AcademicCapIcon,
  journal: BookOpenIcon,
  meeting_notes: ClipboardDocumentIcon,
  document: DocumentIcon,
  snippet: CodeBracketIcon,
};

const contextColors: Record<string, string> = {
  MBA: 'bg-purple-100 text-purple-700 border-purple-200',
  Personal: 'bg-green-100 text-green-700 border-green-200',
  Work: 'bg-blue-100 text-blue-700 border-blue-200',
  Health: 'bg-red-100 text-red-700 border-red-200',
  default: 'bg-gray-100 text-gray-700 border-gray-200',
};

export function VaultCard({ entry, onSelect }: VaultCardProps) {
  const Icon = typeIcons[entry.contentType] || DocumentTextIcon;
  const colorClass = contextColors[entry.context] || contextColors.default;

  const preview = entry.content?.substring(0, 150) || '';

  return (
    <div
      onClick={() => onSelect?.(entry)}
      className={clsx(
        'p-4 bg-white rounded-lg border cursor-pointer transition-all',
        'hover:shadow-md hover:border-purple-200'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={clsx('p-2 rounded-lg', colorClass)}>
          <Icon className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium truncate">{entry.title}</h3>
            <span
              className={clsx(
                'text-xs px-2 py-0.5 rounded-full font-medium border',
                colorClass
              )}
            >
              {entry.context}
            </span>
          </div>

          {preview && (
            <p className="text-sm text-gray-500 line-clamp-2 mb-2">
              {preview}...
            </p>
          )}

          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="capitalize">{entry.contentType.replace('_', ' ')}</span>
            <span>{format(new Date(entry.createdAt), 'MMM d, yyyy')}</span>
            {entry.tags && entry.tags.length > 0 && (
              <span>{entry.tags.slice(0, 3).join(', ')}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

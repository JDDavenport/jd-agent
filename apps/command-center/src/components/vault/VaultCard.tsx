import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import type { VaultEntry } from '../../types/vault';

interface VaultCardProps {
  entry: VaultEntry;
}

const contentTypeIcons: Record<string, string> = {
  note: '📝',
  recording_summary: '🎙️',
  lecture: '🎓',
  meeting: '👥',
  article: '📰',
  reference: '📚',
};

function VaultCard({ entry }: VaultCardProps) {
  const icon = contentTypeIcons[entry.contentType] || '📄';

  // Get first 150 characters for preview
  const preview = entry.content.length > 150
    ? entry.content.substring(0, 150) + '...'
    : entry.content;

  return (
    <Link
      to={`/vault/${entry.id}`}
      className="card block hover:shadow-lg hover:shadow-accent-glow/20 transition-all animate-fade-in"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">{icon}</span>
          <div>
            <h3 className="font-semibold text-text line-clamp-1">{entry.title}</h3>
            <p className="text-xs text-text-muted">
              {format(new Date(entry.createdAt), 'MMM d, yyyy')}
            </p>
          </div>
        </div>
        <span className="badge badge-neutral text-xs shrink-0">
          {entry.contentType}
        </span>
      </div>

      {entry.context && (
        <div className="mb-2">
          <span className="text-xs text-accent">📁 {entry.context}</span>
        </div>
      )}

      <p className="text-sm text-text-muted line-clamp-3 mb-3">
        {preview}
      </p>

      {entry.tags && entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {entry.tags.slice(0, 4).map((tag, index) => (
            <span key={index} className="badge badge-neutral text-xs">
              #{tag}
            </span>
          ))}
          {entry.tags.length > 4 && (
            <span className="text-xs text-text-muted">
              +{entry.tags.length - 4} more
            </span>
          )}
        </div>
      )}
    </Link>
  );
}

export default VaultCard;

import { TagIcon } from '@heroicons/react/24/outline';
import type { VaultEntry } from '../api';

interface TagsViewProps {
  entries?: VaultEntry[];
  onTagSelect?: (tag: string) => void;
}

export function TagsView({ entries = [], onTagSelect }: TagsViewProps) {
  // Get all unique tags from entries
  const tagCounts = entries.reduce((acc, entry) => {
    if (entry.tags) {
      entry.tags.forEach((tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
      });
    }
    return acc;
  }, {} as Record<string, number>);

  const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <TagIcon className="w-6 h-6 text-purple-500" />
        <h1 className="text-2xl font-bold text-gray-900">Tags</h1>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        {sortedTags.length} tags across {entries.length} entries
      </p>

      {sortedTags.length === 0 ? (
        <div className="text-center py-12">
          <TagIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No tags yet</h3>
          <p className="text-gray-500">Tags will appear here when you add them to entries</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {sortedTags.map(([tag, count]) => (
            <button
              key={tag}
              onClick={() => onTagSelect?.(tag)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors"
            >
              <span className="text-gray-900">{tag}</span>
              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
                {count}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

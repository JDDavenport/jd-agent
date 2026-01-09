import { VaultCard } from './VaultCard';
import type { VaultEntry } from '@jd-agent/types';

interface VaultListProps {
  entries: VaultEntry[];
  isLoading?: boolean;
  emptyMessage?: string;
  onSelect?: (entry: VaultEntry) => void;
}

export function VaultList({
  entries,
  isLoading,
  emptyMessage = 'No entries found',
  onSelect,
}: VaultListProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-32 bg-gray-100 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {entries.map((entry) => (
        <VaultCard key={entry.id} entry={entry} onSelect={onSelect} />
      ))}
    </div>
  );
}

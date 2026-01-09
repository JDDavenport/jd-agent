import VaultCard from './VaultCard';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';
import Button from '../common/Button';
import { Link } from 'react-router-dom';
import type { VaultEntry } from '../../types/vault';

interface VaultListProps {
  entries: VaultEntry[];
  isLoading?: boolean;
  error?: Error | null;
}

function VaultList({ entries, isLoading, error }: VaultListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <p className="text-error">Failed to load vault entries: {error.message}</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon="📭"
        title="No entries found"
        description="Create your first note or adjust your filters"
        action={
          <Link to="/vault/new">
            <Button>Create Note</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {entries.map((entry) => (
        <VaultCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
}

export default VaultList;

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useVaultEntries, useVaultContexts, useVaultTags } from '../hooks/useVault';
import VaultList from '../components/vault/VaultList';
import SearchBar from '../components/vault/SearchBar';
import TagFilter from '../components/vault/TagFilter';
import Button from '../components/common/Button';
import type { VaultFilters } from '../types/vault';

function VaultExplorer() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContext, setSelectedContext] = useState<string | undefined>();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<string | undefined>();

  const filters: VaultFilters = {
    context: selectedContext,
    tags: selectedTags.length > 0 ? selectedTags : undefined,
    contentType: selectedType as any,
  };

  const { data: entries, isLoading, error } = useVaultEntries(filters);
  const { data: contexts } = useVaultContexts();
  const { data: tags } = useVaultTags();

  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSelectedContext(undefined);
    setSelectedTags([]);
    setSelectedType(undefined);
    setSearchQuery('');
  };

  const hasActiveFilters = selectedContext || selectedTags.length > 0 || selectedType || searchQuery;

  const contentTypes = [
    { value: 'note', label: 'Notes', icon: '📝' },
    { value: 'lecture', label: 'Lectures', icon: '🎓' },
    { value: 'meeting', label: 'Meetings', icon: '👥' },
    { value: 'article', label: 'Articles', icon: '📰' },
    { value: 'reference', label: 'References', icon: '📚' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Vault</h1>
          <p className="text-text-muted mt-1">
            {entries ? `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}` : 'Loading...'}
          </p>
        </div>
        <Link to="/vault/new">
          <Button>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Note
          </Button>
        </Link>
      </div>

      {/* Search */}
      <SearchBar onSearch={setSearchQuery} placeholder="Search vault entries..." />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Filters */}
        <aside className="space-y-6">
          {/* Content Type Filter */}
          <div className="card">
            <h3 className="text-sm font-semibold text-text mb-3">Type</h3>
            <div className="space-y-2">
              <button
                onClick={() => setSelectedType(undefined)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  !selectedType
                    ? 'bg-accent text-white'
                    : 'hover:bg-dark-card-hover'
                }`}
              >
                All Types
              </button>
              {contentTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setSelectedType(type.value)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2 ${
                    selectedType === type.value
                      ? 'bg-accent text-white'
                      : 'hover:bg-dark-card-hover'
                  }`}
                >
                  <span>{type.icon}</span>
                  <span>{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Context Filter */}
          {contexts && contexts.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-text mb-3">Context</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedContext(undefined)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    !selectedContext
                      ? 'bg-accent text-white'
                      : 'hover:bg-dark-card-hover'
                  }`}
                >
                  All Contexts
                </button>
                {contexts.slice(0, 10).map((context) => (
                  <button
                    key={context}
                    onClick={() => setSelectedContext(context)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedContext === context
                        ? 'bg-accent text-white'
                        : 'hover:bg-dark-card-hover'
                    }`}
                  >
                    📁 {context}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tag Filter */}
          {tags && tags.length > 0 && (
            <div className="card">
              <TagFilter
                tags={tags.slice(0, 20)}
                selectedTags={selectedTags}
                onToggleTag={handleToggleTag}
              />
            </div>
          )}

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button variant="secondary" onClick={clearFilters} className="w-full">
              Clear Filters
            </Button>
          )}
        </aside>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <VaultList entries={entries || []} isLoading={isLoading} error={error} />
        </div>
      </div>
    </div>
  );
}

export default VaultExplorer;

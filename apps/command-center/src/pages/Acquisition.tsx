/**
 * Acquisition Page - Boomer Business Finder
 *
 * Main page for managing acquisition leads and CRM pipeline.
 */

import { useState } from 'react';
import {
  useLeads,
  useAcquisitionStats,
  useToggleFavorite,
  useToggleHot,
} from '../hooks/useAcquisition';
import {
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_COLORS,
  type PipelineStage,
  type LeadFilters,
} from '../types/acquisition';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import EmptyState from '../components/common/EmptyState';
import LeadList from '../components/acquisition/LeadList';
import LeadDetail from '../components/acquisition/LeadDetail';
import PipelineBoard from '../components/acquisition/PipelineBoard';

export default function Acquisition() {
  const [filters, setFilters] = useState<LeadFilters>({
    limit: 50,
    sortBy: 'created',
    sortDir: 'desc',
  });
  const [selectedLeadId, setSelectedLeadId] = useState<string | undefined>();
  const [viewMode, setViewMode] = useState<'list' | 'pipeline'>('list');

  const { data: leads, isLoading: leadsLoading } = useLeads(filters);
  const { data: stats, isLoading: statsLoading } = useAcquisitionStats();

  const toggleFavorite = useToggleFavorite();
  const toggleHot = useToggleHot();

  const selectedLead = leads?.find((l) => l.id === selectedLeadId);

  // Stage filter buttons (active pipeline stages only)
  const activeStages: PipelineStage[] = ['new', 'researching', 'qualified', 'outreach', 'conversation', 'negotiating'];

  const handleStageFilter = (stage: PipelineStage | null) => {
    setFilters((prev) => ({
      ...prev,
      stages: stage ? [stage] : undefined,
    }));
  };

  const handleSearch = (search: string) => {
    setFilters((prev) => ({ ...prev, search: search || undefined }));
  };

  const handleFavoriteToggle = (id: string) => {
    toggleFavorite.mutate(id);
  };

  const handleHotToggle = (id: string) => {
    toggleHot.mutate(id);
  };

  if (leadsLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-accent to-accent-light bg-clip-text text-transparent">
            Acquisition
          </h1>
          <p className="text-text-muted mt-1">Find and track potential business acquisitions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'list' ? 'primary' : 'secondary'}
            onClick={() => setViewMode('list')}
          >
            List
          </Button>
          <Button
            variant={viewMode === 'pipeline' ? 'primary' : 'secondary'}
            onClick={() => setViewMode('pipeline')}
          >
            Pipeline
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <StatCard label="Total Leads" value={stats.total} />
          <StatCard label="Qualified" value={stats.byStage.qualified} color="purple" />
          <StatCard label="In Outreach" value={stats.byStage.outreach} color="yellow" />
          <StatCard label="Hot" value={stats.hot} color="red" icon="🔥" />
          <StatCard label="Follow-ups" value={stats.needsFollowUp} color="orange" />
          <StatCard label="Avg Score" value={stats.avgScore} color="blue" suffix="/100" />
        </div>
      )}

      {/* Search & Filters */}
      <Card>
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search businesses..."
              className="w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          {/* Quick Filters */}
          <div className="flex gap-2">
            <button
              onClick={() => setFilters((prev) => ({ ...prev, isFavorite: !prev.isFavorite ? true : undefined }))}
              className={`px-3 py-2 rounded-lg transition-all ${
                filters.isFavorite ? 'bg-yellow-500/20 text-yellow-400' : 'bg-dark-bg text-text-muted hover:bg-dark-card-hover'
              }`}
            >
              ⭐ Favorites
            </button>
            <button
              onClick={() => setFilters((prev) => ({ ...prev, isHot: !prev.isHot ? true : undefined }))}
              className={`px-3 py-2 rounded-lg transition-all ${
                filters.isHot ? 'bg-red-500/20 text-red-400' : 'bg-dark-bg text-text-muted hover:bg-dark-card-hover'
              }`}
            >
              🔥 Hot
            </button>
            <button
              onClick={() => setFilters((prev) => ({ ...prev, hasFollowUp: !prev.hasFollowUp ? true : undefined }))}
              className={`px-3 py-2 rounded-lg transition-all ${
                filters.hasFollowUp ? 'bg-orange-500/20 text-orange-400' : 'bg-dark-bg text-text-muted hover:bg-dark-card-hover'
              }`}
            >
              📅 Follow-up Due
            </button>
          </div>
        </div>

        {/* Stage Filter Tabs */}
        <div className="flex gap-2 flex-wrap mt-4 pt-4 border-t border-dark-border">
          <button
            onClick={() => handleStageFilter(null)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
              !filters.stages ? 'bg-accent text-white' : 'bg-dark-bg text-text-muted hover:bg-dark-card-hover'
            }`}
          >
            All ({stats?.total || 0})
          </button>
          {activeStages.map((stage) => (
            <button
              key={stage}
              onClick={() => handleStageFilter(stage)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                filters.stages?.[0] === stage
                  ? PIPELINE_STAGE_COLORS[stage]
                  : 'bg-dark-bg text-text-muted hover:bg-dark-card-hover'
              }`}
            >
              {PIPELINE_STAGE_LABELS[stage]} ({stats?.byStage[stage] || 0})
            </button>
          ))}
        </div>
      </Card>

      {/* Main Content */}
      {viewMode === 'pipeline' ? (
        /* Pipeline View - Full width kanban board with slide-out detail */
        <div className="space-y-4">
          {!leads || leads.length === 0 ? (
            <EmptyState
              icon="🏢"
              title="No leads found"
              description="Run the Utah scraper to import businesses"
            />
          ) : (
            <>
              <PipelineBoard
                leads={leads}
                selectedLeadId={selectedLeadId}
                onSelectLead={setSelectedLeadId}
              />
              {/* Slide-out detail panel */}
              {selectedLead && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 bg-black/50 z-40"
                    onClick={() => setSelectedLeadId(undefined)}
                  />
                  {/* Panel */}
                  <div className="fixed inset-y-0 right-0 w-96 bg-dark-card shadow-xl border-l border-dark-border overflow-y-auto z-50 animate-slide-in">
                    <div className="sticky top-0 bg-dark-card p-4 border-b border-dark-border flex justify-between items-center">
                      <h3 className="font-semibold">{selectedLead.businessName}</h3>
                      <button
                        onClick={() => setSelectedLeadId(undefined)}
                        className="p-1 hover:bg-dark-card-hover rounded"
                      >
                        ✕
                      </button>
                    </div>
                    <LeadDetail
                      leadId={selectedLead.id}
                      onClose={() => setSelectedLeadId(undefined)}
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      ) : (
        /* List View - Two column layout */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lead List */}
          <div className="lg:col-span-2">
            {!leads || leads.length === 0 ? (
              <EmptyState
                icon="🏢"
                title="No leads found"
                description={filters.search ? 'Try adjusting your search or filters' : 'Run the Utah scraper to import businesses'}
              />
            ) : (
              <LeadList
                leads={leads}
                selectedLeadId={selectedLeadId}
                onSelectLead={setSelectedLeadId}
                onToggleFavorite={handleFavoriteToggle}
                onToggleHot={handleHotToggle}
              />
            )}
          </div>

          {/* Lead Detail Panel */}
          <div>
            {selectedLead ? (
              <LeadDetail
                leadId={selectedLead.id}
                onClose={() => setSelectedLeadId(undefined)}
              />
            ) : (
              <Card className="text-center py-8">
                <p className="text-text-muted">Select a lead to see details</p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Stat Card Component
function StatCard({
  label,
  value,
  color,
  icon,
  suffix,
}: {
  label: string;
  value: number;
  color?: string;
  icon?: string;
  suffix?: string;
}) {
  const colorClasses: Record<string, string> = {
    purple: 'text-purple-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400',
    orange: 'text-orange-400',
    blue: 'text-blue-400',
    green: 'text-green-400',
  };

  return (
    <Card className="text-center">
      <div className={`text-2xl font-bold ${color ? colorClasses[color] : 'text-white'}`}>
        {icon && <span className="mr-1">{icon}</span>}
        {value}
        {suffix && <span className="text-sm text-text-muted">{suffix}</span>}
      </div>
      <div className="text-sm text-text-muted mt-1">{label}</div>
    </Card>
  );
}

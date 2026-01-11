import { useState } from 'react';
import {
  useCanvasStatus,
  useCanvasItems,
  useClassMappings,
  useAuditHistory,
  useUnscheduledItems,
  useTriggerAudit,
  useSendNudge,
} from '../hooks/useCanvasIntegrity';
import LoadingSpinner from '../components/common/LoadingSpinner';
import Button from '../components/common/Button';

function CanvasIntegrity() {
  const [activeTab, setActiveTab] = useState<'overview' | 'items' | 'courses' | 'audits'>('overview');
  const [syncFilter, setSyncFilter] = useState<string>('all');

  const { data: status, isLoading: loadingStatus, isError: statusError, error: statusErrorMsg } = useCanvasStatus();
  const { data: items, isLoading: loadingItems } = useCanvasItems(
    syncFilter !== 'all' ? { syncStatus: syncFilter } : undefined
  );
  const { data: mappings, isLoading: loadingMappings } = useClassMappings();
  const { data: audits, isLoading: loadingAudits } = useAuditHistory(5);
  const { data: unscheduled } = useUnscheduledItems();

  const triggerAudit = useTriggerAudit();
  const sendNudge = useSendNudge();

  const handleTriggerAudit = async (type: 'full' | 'incremental' | 'quick') => {
    try {
      await triggerAudit.mutateAsync(type);
      alert(`${type} audit started successfully`);
    } catch (error) {
      alert(`Failed to start audit: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSendNudge = async () => {
    try {
      const result = await sendNudge.mutateAsync();
      alert(result.message || 'Nudge sent successfully');
    } catch (error) {
      alert(`Failed to send nudge: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (loadingStatus) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Show error state if status query failed
  if (statusError) {
    return (
      <div className="p-4 bg-red-500/20 border border-red-500 rounded-lg">
        <h2 className="text-red-400 font-bold">Unable to load Canvas status</h2>
        <p className="text-red-300">{statusErrorMsg?.message || 'Please check your connection and try again'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Canvas Integration</h1>
          <p className="text-text-muted mt-1">
            Sync and verify Canvas LMS assignments
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="secondary"
            onClick={() => handleTriggerAudit('quick')}
            disabled={triggerAudit.isPending}
          >
            Quick Check
          </Button>
          <Button
            variant="primary"
            onClick={() => handleTriggerAudit('full')}
            disabled={triggerAudit.isPending}
          >
            {triggerAudit.isPending ? 'Running...' : 'Full Audit'}
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatusCard
          title="Total Items"
          value={status?.totalItems || 0}
          icon="📚"
          color="blue"
        />
        <StatusCard
          title="Synced"
          value={status?.syncedItems || 0}
          icon="✅"
          color="green"
        />
        <StatusCard
          title="Pending"
          value={status?.pendingItems || 0}
          icon="⏳"
          color="amber"
        />
        <StatusCard
          title="Mismatch"
          value={status?.mismatchItems || 0}
          icon="⚠️"
          color="orange"
        />
        <StatusCard
          title="Upcoming"
          value={status?.upcomingAssignments || 0}
          icon="📅"
          color="purple"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-dark-border">
        <nav className="flex space-x-4">
          {(['overview', 'items', 'courses', 'audits'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-muted hover:text-text'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Audits */}
          <div className="card">
            <h2 className="text-lg font-semibold mb-4">Recent Audits</h2>
            {loadingAudits ? (
              <LoadingSpinner />
            ) : audits && audits.length > 0 ? (
              <div className="space-y-3">
                {audits.map((audit) => (
                  <div
                    key={audit.id}
                    className="flex items-center justify-between p-3 bg-dark-bg rounded-lg"
                  >
                    <div>
                      <span className="font-medium capitalize">{audit.auditType} Audit</span>
                      <p className="text-sm text-text-muted">
                        {new Date(audit.startedAt).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        audit.status === 'completed'
                          ? 'bg-green-500/20 text-green-400'
                          : audit.status === 'running'
                          ? 'bg-amber-500/20 text-amber-400'
                          : audit.status === 'failed'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-blue-500/20 text-blue-400'
                      }`}
                    >
                      {audit.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-muted text-center py-4">No audits yet</p>
            )}
          </div>

          {/* Unscheduled Items */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Needs Scheduling</h2>
              {unscheduled && unscheduled.length > 0 && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSendNudge}
                  disabled={sendNudge.isPending}
                >
                  Send Nudge
                </Button>
              )}
            </div>
            {unscheduled && unscheduled.length > 0 ? (
              <div className="space-y-3">
                {unscheduled.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-dark-bg rounded-lg"
                  >
                    <p className="font-medium text-sm">{item.title}</p>
                    <p className="text-xs text-text-muted">{item.courseName}</p>
                    {item.dueAt && (
                      <p className="text-xs text-amber-400 mt-1">
                        Due: {new Date(item.dueAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ))}
                {unscheduled.length > 5 && (
                  <p className="text-sm text-text-muted text-center">
                    +{unscheduled.length - 5} more items
                  </p>
                )}
              </div>
            ) : (
              <p className="text-text-muted text-center py-4">All items scheduled!</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'items' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-text-muted">Filter:</span>
            {['all', 'synced', 'pending', 'mismatch', 'orphaned'].map((filter) => (
              <button
                key={filter}
                onClick={() => setSyncFilter(filter)}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  syncFilter === filter
                    ? 'bg-accent text-white'
                    : 'bg-dark-card hover:bg-dark-card-hover text-text-muted'
                }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>

          {/* Items List */}
          {loadingItems ? (
            <LoadingSpinner />
          ) : items && items.length > 0 ? (
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead className="bg-dark-bg">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">Title</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">Course</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">Due</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-dark-card-hover">
                      <td className="px-4 py-3 text-sm">{item.title}</td>
                      <td className="px-4 py-3 text-sm text-text-muted">{item.courseName}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400 capitalize">
                          {item.canvasType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-text-muted">
                        {item.dueAt ? new Date(item.dueAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            item.syncStatus === 'synced'
                              ? 'bg-green-500/20 text-green-400'
                              : item.syncStatus === 'pending'
                              ? 'bg-amber-500/20 text-amber-400'
                              : item.syncStatus === 'mismatch'
                              ? 'bg-orange-500/20 text-orange-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {item.syncStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-text-muted text-center py-8">No items found</p>
          )}
        </div>
      )}

      {activeTab === 'courses' && (
        <div>
          {loadingMappings ? (
            <LoadingSpinner />
          ) : mappings && mappings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mappings.map((mapping) => (
                <div
                  key={mapping.id}
                  className={`card border-l-4 ${
                    mapping.isActive ? 'border-l-green-500' : 'border-l-gray-500'
                  }`}
                >
                  <h3 className="font-semibold">{mapping.canvasCourseName}</h3>
                  {mapping.canvasCourseCode && (
                    <p className="text-sm text-text-muted">{mapping.canvasCourseCode}</p>
                  )}
                  {mapping.professorName && (
                    <p className="text-sm text-text-muted mt-2">
                      Prof. {mapping.professorName}
                    </p>
                  )}
                  {mapping.semester && (
                    <span className="inline-block mt-2 px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400">
                      {mapping.semester}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-text-muted text-center py-8">No course mappings found</p>
          )}
        </div>
      )}

      {activeTab === 'audits' && (
        <div>
          {loadingAudits ? (
            <LoadingSpinner />
          ) : audits && audits.length > 0 ? (
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead className="bg-dark-bg">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">Started</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">Items</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">Created</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-text-muted">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border">
                  {audits.map((audit) => (
                    <tr key={audit.id} className="hover:bg-dark-card-hover">
                      <td className="px-4 py-3 text-sm capitalize">{audit.auditType}</td>
                      <td className="px-4 py-3 text-sm text-text-muted">
                        {new Date(audit.startedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            audit.status === 'completed'
                              ? 'bg-green-500/20 text-green-400'
                              : audit.status === 'running'
                              ? 'bg-amber-500/20 text-amber-400'
                              : audit.status === 'failed'
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-blue-500/20 text-blue-400'
                          }`}
                        >
                          {audit.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{audit.itemsChecked}</td>
                      <td className="px-4 py-3 text-sm text-green-400">{audit.itemsCreated}</td>
                      <td className="px-4 py-3 text-sm text-blue-400">{audit.itemsUpdated}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-text-muted text-center py-8">No audit history</p>
          )}
        </div>
      )}
    </div>
  );
}

// Status Card Component
function StatusCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: string;
  color: 'blue' | 'green' | 'amber' | 'orange' | 'purple';
}) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-400',
    green: 'bg-green-500/10 text-green-400',
    amber: 'bg-amber-500/10 text-amber-400',
    orange: 'bg-orange-500/10 text-orange-400',
    purple: 'bg-purple-500/10 text-purple-400',
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-text-muted">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <span className="text-xl">{icon}</span>
        </div>
      </div>
    </div>
  );
}

export default CanvasIntegrity;

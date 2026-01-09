import { useSystemInfo, useHealthMetrics, useIntegrityChecks, useActivityLogs, useTriggerCeremony, useRunIntegrityCheck } from '../hooks/useSystemHealth';
import StatusCard from '../components/health/StatusCard';
import IntegrityLog from '../components/health/IntegrityLog';
import ActivityLog from '../components/health/ActivityLog';
import MetricChart from '../components/health/MetricChart';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';

function SystemHealth() {
  const { data: systemInfo, isLoading: loadingInfo } = useSystemInfo();
  const { data: metrics, isLoading: loadingMetrics } = useHealthMetrics();
  const { data: integrityChecks, isLoading: loadingIntegrity } = useIntegrityChecks(10);
  const { data: activityLogs, isLoading: loadingLogs } = useActivityLogs(20);

  const triggerCeremony = useTriggerCeremony();
  const runIntegrityCheck = useRunIntegrityCheck();

  const handleTriggerCeremony = async (type: string) => {
    try {
      const result = await triggerCeremony.mutateAsync(type);
      alert(result.message || `${type} ceremony triggered successfully`);
    } catch (error) {
      alert(`Failed to trigger ceremony: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleRunIntegrityCheck = async () => {
    try {
      const result = await runIntegrityCheck.mutateAsync();
      alert(`Integrity check completed: ${result.results.length} checks run`);
    } catch (error) {
      alert(`Failed to run integrity check: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (loadingInfo || loadingMetrics) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Health</h1>
          <p className="text-text-muted mt-1">
            Version {systemInfo?.version} • Uptime: {systemInfo?.uptime ? Math.floor(systemInfo.uptime / 3600) : 0}h
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Button
            variant="secondary"
            onClick={handleRunIntegrityCheck}
            disabled={runIntegrityCheck.isPending}
          >
            {runIntegrityCheck.isPending ? 'Running...' : 'Run Integrity Check'}
          </Button>
        </div>
      </div>

      {/* Services Status */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Services</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {systemInfo?.services?.map((service) => (
            <StatusCard key={service.name} service={service} />
          ))}
        </div>
      </div>

      {/* Integrations Status */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Integrations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {systemInfo?.integrations?.map((integration) => (
            <StatusCard key={integration.name} integration={integration} />
          ))}
        </div>
      </div>

      {/* Ceremony Triggers */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Manual Ceremonies</h2>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() => handleTriggerCeremony('morning')}
            disabled={triggerCeremony.isPending}
          >
            🌅 Morning Briefing
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleTriggerCeremony('evening')}
            disabled={triggerCeremony.isPending}
          >
            🌙 Evening Review
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleTriggerCeremony('weekly')}
            disabled={triggerCeremony.isPending}
          >
            📅 Weekly Planning
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleTriggerCeremony('monthly')}
            disabled={triggerCeremony.isPending}
          >
            📊 Monthly Review
          </Button>
        </div>
      </div>

      {/* Metrics and Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {metrics && <MetricChart metrics={metrics} />}
          <IntegrityLog checks={integrityChecks || []} isLoading={loadingIntegrity} />
        </div>

        {/* Right Column */}
        <div>
          <ActivityLog logs={activityLogs || []} isLoading={loadingLogs} />
        </div>
      </div>
    </div>
  );
}

export default SystemHealth;

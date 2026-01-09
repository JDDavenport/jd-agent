/**
 * WorkloadIndicator
 *
 * Displays workload level with color coding.
 */

interface WorkloadIndicatorProps {
  level: 'light' | 'moderate' | 'heavy';
  showLabel?: boolean;
}

const WORKLOAD_CONFIG = {
  light: { label: 'Light', color: 'bg-success', textColor: 'text-success' },
  moderate: { label: 'Moderate', color: 'bg-warning', textColor: 'text-warning' },
  heavy: { label: 'Heavy', color: 'bg-error', textColor: 'text-error' },
};

export function WorkloadIndicator({ level, showLabel = false }: WorkloadIndicatorProps) {
  const config = WORKLOAD_CONFIG[level];

  return (
    <div className="flex items-center gap-1">
      <div className={`w-2 h-2 rounded-full ${config.color}`} />
      {showLabel && (
        <span className={`text-xs ${config.textColor}`}>{config.label}</span>
      )}
    </div>
  );
}

export default WorkloadIndicator;

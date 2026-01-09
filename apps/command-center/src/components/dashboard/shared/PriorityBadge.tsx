/**
 * PriorityBadge
 *
 * Displays task priority level with color coding.
 */

interface PriorityBadgeProps {
  priority: number;
  size?: 'sm' | 'md';
}

const PRIORITY_CONFIG: Record<number, { label: string; color: string; bgColor: string }> = {
  4: { label: 'Urgent', color: 'text-error', bgColor: 'bg-error/20' },
  3: { label: 'High', color: 'text-error', bgColor: 'bg-error/20' },
  2: { label: 'Medium', color: 'text-warning', bgColor: 'bg-warning/20' },
  1: { label: 'Low', color: 'text-text-muted', bgColor: 'bg-dark-border' },
  0: { label: '', color: 'text-text-muted', bgColor: 'bg-dark-border' },
};

export function PriorityBadge({ priority, size = 'sm' }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG[0];

  if (priority === 0) return null;

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-0.5',
  };

  return (
    <span
      className={`inline-flex items-center rounded font-medium ${config.color} ${config.bgColor} ${sizeClasses[size]}`}
    >
      {config.label}
    </span>
  );
}

export default PriorityBadge;

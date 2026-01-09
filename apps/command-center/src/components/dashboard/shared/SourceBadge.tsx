/**
 * SourceBadge
 *
 * Displays task source with icon and color.
 */

interface SourceBadgeProps {
  source: string;
  size?: 'sm' | 'md';
}

const SOURCE_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  canvas: { icon: '📚', label: 'Canvas', color: 'text-blue-400' },
  email: { icon: '📧', label: 'Email', color: 'text-yellow-400' },
  meeting: { icon: '👥', label: 'Meeting', color: 'text-purple-400' },
  recording: { icon: '🎙️', label: 'Recording', color: 'text-pink-400' },
  calendar: { icon: '📅', label: 'Calendar', color: 'text-green-400' },
  chat: { icon: '💬', label: 'Chat', color: 'text-accent' },
  manual: { icon: '✏️', label: 'Manual', color: 'text-text-muted' },
  remarkable: { icon: '📝', label: 'reMarkable', color: 'text-orange-400' },
};

export function SourceBadge({ source, size = 'sm' }: SourceBadgeProps) {
  const config = SOURCE_CONFIG[source.toLowerCase()] || {
    icon: '📋',
    label: source,
    color: 'text-text-muted',
  };

  const sizeClasses = {
    sm: 'text-[10px]',
    md: 'text-xs',
  };

  return (
    <span
      className={`inline-flex items-center gap-0.5 ${config.color} ${sizeClasses[size]}`}
      title={config.label}
    >
      <span>{config.icon}</span>
      {size === 'md' && <span>{config.label}</span>}
    </span>
  );
}

export default SourceBadge;

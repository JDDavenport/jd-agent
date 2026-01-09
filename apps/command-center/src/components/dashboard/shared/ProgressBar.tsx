/**
 * ProgressBar
 *
 * A simple progress bar component for showing completion percentages.
 */

interface ProgressBarProps {
  value: number; // 0-100
  color?: string; // Tailwind color class
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
  animated?: boolean;
}

export function ProgressBar({
  value,
  color = 'bg-accent',
  size = 'sm',
  showLabel = false,
  label,
  animated = true,
}: ProgressBarProps) {
  const normalizedValue = Math.min(100, Math.max(0, value));

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  return (
    <div className="w-full">
      {(showLabel || label) && (
        <div className="flex justify-between text-xs text-text-muted mb-1">
          <span>{label}</span>
          <span>{normalizedValue}%</span>
        </div>
      )}
      <div
        className={`w-full ${sizeClasses[size]} bg-dark-border rounded-full overflow-hidden`}
      >
        <div
          className={`${sizeClasses[size]} ${color} rounded-full ${
            animated ? 'transition-all duration-500 ease-out' : ''
          }`}
          style={{ width: `${normalizedValue}%` }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;

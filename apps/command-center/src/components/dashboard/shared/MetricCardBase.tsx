/**
 * MetricCardBase
 *
 * Base component for clickable metric cards in the dashboard.
 * Provides consistent styling, hover effects, and navigation.
 */

import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../../common/LoadingSpinner';

interface MetricCardBaseProps {
  title: string;
  value: number | string;
  icon: string;
  color: string;
  onClick?: () => void;
  href?: string;
  externalHref?: string;
  children?: React.ReactNode;
  isLoading?: boolean;
  error?: Error | null;
  tooltip?: string;
}

export function MetricCardBase({
  title,
  value,
  icon,
  color,
  onClick,
  href,
  externalHref,
  children,
  isLoading,
  error,
  tooltip,
}: MetricCardBaseProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (externalHref) {
      // Navigate to external app (different port)
      window.location.href = externalHref;
    } else if (href) {
      navigate(href);
    }
  };

  const isClickable = onClick || href || externalHref;

  if (isLoading) {
    return (
      <div
        className="card min-h-[120px] sm:min-h-[140px] flex items-center justify-center"
        role="listitem"
        aria-label={`${title} loading`}
      >
        <LoadingSpinner size="sm" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="card min-h-[120px] sm:min-h-[140px]"
        role="listitem"
        aria-label={`${title} error`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-text-muted mb-1">{title}</p>
            <p className="text-sm text-error">Error loading data</p>
          </div>
          <div className="text-2xl sm:text-3xl opacity-50">{icon}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`card min-h-[120px] sm:min-h-[140px] relative transition-all duration-200 ${
        isClickable
          ? 'group cursor-pointer hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10 active:scale-[0.98]'
          : ''
      }`}
      onClick={isClickable ? handleClick : undefined}
      title={tooltip}
      role="listitem"
      aria-label={`${title}: ${value}${isClickable ? '. Click to view details.' : ''}`}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
              }
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm text-text-muted mb-1">{title}</p>
          <p className={`text-2xl sm:text-3xl font-bold ${color} truncate`}>{value}</p>
        </div>
        <div className="text-2xl sm:text-3xl flex-shrink-0 ml-2" aria-hidden="true">{icon}</div>
      </div>
      {children && <div className="mt-2 sm:mt-3">{children}</div>}
      {isClickable && (
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block">
          <span className="text-xs text-text-muted">Click to view</span>
        </div>
      )}
    </div>
  );
}

export default MetricCardBase;

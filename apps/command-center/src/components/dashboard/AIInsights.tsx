/**
 * AIInsights - Phase 3
 *
 * Displays AI-generated insights including:
 * - Pattern alerts
 * - Workload warnings
 * - Actionable suggestions
 * - Dismissible cards
 */

import { useAIInsights, useDismissInsight } from '../../hooks/useDashboardEnhanced';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';
import { formatDistanceToNow, parseISO } from 'date-fns';
import type { AIInsight } from '../../types/dashboard';

const SEVERITY_CONFIG = {
  critical: {
    bg: 'bg-error/10',
    border: 'border-error/30',
    icon: '🚨',
    badge: 'badge-error',
  },
  warning: {
    bg: 'bg-warning/10',
    border: 'border-warning/30',
    icon: '⚠️',
    badge: 'badge-warning',
  },
  info: {
    bg: 'bg-accent/10',
    border: 'border-accent/30',
    icon: '💡',
    badge: 'badge-accent',
  },
};

const TYPE_ICONS = {
  pattern: '📊',
  warning: '⚠️',
  suggestion: '💡',
  alert: '🔔',
};

interface InsightCardProps {
  insight: AIInsight;
  onDismiss: (id: string) => void;
  isDismissing: boolean;
}

function InsightCard({ insight, onDismiss, isDismissing }: InsightCardProps) {
  const config = SEVERITY_CONFIG[insight.severity];
  const typeIcon = TYPE_ICONS[insight.type];

  return (
    <div className={`p-3 rounded-lg border ${config.bg} ${config.border} transition-opacity ${
      isDismissing ? 'opacity-50' : ''
    }`}>
      <div className="flex items-start gap-3">
        <span className="text-lg shrink-0">{typeIcon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-text text-sm">{insight.title}</h4>
            <span className={`badge ${config.badge} text-[10px]`}>
              {insight.category}
            </span>
          </div>
          <p className="text-xs text-text-muted mb-2">{insight.description}</p>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-muted">
              {formatDistanceToNow(parseISO(insight.createdAt), { addSuffix: true })}
            </span>
            <div className="flex items-center gap-2">
              {insight.actionable && insight.actionLabel && insight.actionTarget && (
                <a
                  href={insight.actionTarget}
                  className="text-xs text-accent hover:text-accent-glow transition-colors"
                >
                  {insight.actionLabel}
                </a>
              )}
              <button
                onClick={() => onDismiss(insight.id)}
                disabled={isDismissing}
                className="text-xs text-text-muted hover:text-text transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AIInsights() {
  const { data, isLoading, error } = useAIInsights();
  const dismissMutation = useDismissInsight();

  if (isLoading) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">AI Insights</h2>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">AI Insights</h2>
        <p className="text-error text-sm">Failed to load insights</p>
      </div>
    );
  }

  const hasInsights = (data?.insights.length || 0) > 0;
  const hasCritical = (data?.criticalCount || 0) > 0;
  const hasWarning = (data?.warningCount || 0) > 0;

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <h2 className="text-lg font-semibold">AI Insights</h2>
        </div>
        <div className="flex items-center gap-2">
          {hasCritical && (
            <span className="badge badge-error text-xs">
              {data!.criticalCount} critical
            </span>
          )}
          {hasWarning && (
            <span className="badge badge-warning text-xs">
              {data!.warningCount} warning
            </span>
          )}
          {!hasCritical && !hasWarning && hasInsights && (
            <span className="badge badge-neutral text-xs">
              {data!.totalCount} insight{data!.totalCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Insights List */}
      {hasInsights ? (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {data!.insights.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onDismiss={(id) => dismissMutation.mutate(id)}
              isDismissing={dismissMutation.isPending}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="✨"
          title="No insights right now"
          description="We'll notify you when we detect patterns or opportunities"
        />
      )}
    </div>
  );
}

export default AIInsights;

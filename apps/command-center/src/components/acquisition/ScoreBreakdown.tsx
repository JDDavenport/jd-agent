/**
 * ScoreBreakdown Component
 *
 * Visual breakdown of AI acquisition score factors with progress bars.
 */

import { type ScoreFactors, SCORE_FACTOR_INFO } from '../../types/acquisition';

interface ScoreBreakdownProps {
  totalScore: number;
  factors: ScoreFactors | Record<string, number> | null;
  automationPotential?: 'high' | 'medium' | 'low' | null;
  summary?: string | null;
  compact?: boolean;
}

export default function ScoreBreakdown({
  totalScore,
  factors,
  automationPotential,
  summary,
  compact = false,
}: ScoreBreakdownProps) {
  if (!factors) {
    return (
      <div className="text-center text-text-muted py-4">
        <p>No score breakdown available</p>
        <p className="text-sm">Run AI scoring to generate breakdown</p>
      </div>
    );
  }

  const scoreColor =
    totalScore >= 70
      ? 'text-green-400'
      : totalScore >= 50
        ? 'text-yellow-400'
        : totalScore >= 30
          ? 'text-orange-400'
          : 'text-red-400';

  const automationColor =
    automationPotential === 'high'
      ? 'bg-green-500/20 text-green-400'
      : automationPotential === 'medium'
        ? 'bg-yellow-500/20 text-yellow-400'
        : 'bg-gray-500/20 text-gray-400';

  // Order factors by their max points (importance)
  const orderedFactors = Object.keys(SCORE_FACTOR_INFO) as (keyof ScoreFactors)[];

  if (compact) {
    return (
      <div className="space-y-2">
        {/* Score Circle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`text-3xl font-bold ${scoreColor}`}
              title="Total acquisition score out of 100"
            >
              {totalScore}
            </div>
            <div className="text-sm text-text-muted">/100</div>
          </div>
          {automationPotential && (
            <span className={`px-2 py-1 rounded text-xs font-medium ${automationColor}`}>
              {automationPotential.toUpperCase()} automation
            </span>
          )}
        </div>

        {/* Mini factor bars */}
        <div className="grid grid-cols-2 gap-1">
          {orderedFactors.map((key) => {
            const info = SCORE_FACTOR_INFO[key];
            const value = (factors as Record<string, number>)[key] || 0;
            const percentage = (value / info.maxPoints) * 100;

            return (
              <div key={key} className="flex items-center gap-1" title={info.description}>
                <span className="text-xs text-text-muted w-16 truncate">{info.label}</span>
                <div className="flex-1 h-1.5 bg-dark-bg rounded overflow-hidden">
                  <div
                    className={`h-full ${percentage >= 70 ? 'bg-green-500' : percentage >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className="text-xs text-text-muted w-8 text-right">
                  {value}/{info.maxPoints}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with total score */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold">AI Acquisition Score</h4>
          <p className="text-sm text-text-muted">Based on 7 weighted factors</p>
        </div>
        <div className="text-right">
          <div className={`text-4xl font-bold ${scoreColor}`}>{totalScore}</div>
          <div className="text-sm text-text-muted">/100 points</div>
        </div>
      </div>

      {/* Automation Potential Badge */}
      {automationPotential && (
        <div className={`inline-flex items-center px-3 py-1.5 rounded-lg ${automationColor}`}>
          <span className="font-medium">
            {automationPotential.toUpperCase()} Automation Potential
          </span>
        </div>
      )}

      {/* Factor Breakdown */}
      <div className="space-y-3">
        {orderedFactors.map((key) => {
          const info = SCORE_FACTOR_INFO[key];
          const value = (factors as Record<string, number>)[key] || 0;
          const percentage = (value / info.maxPoints) * 100;

          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <span className="text-sm font-medium">{info.label}</span>
                  <p className="text-xs text-text-muted">{info.description}</p>
                </div>
                <span className="text-sm font-medium">
                  {value}/{info.maxPoints}
                </span>
              </div>
              <div className="h-2 bg-dark-bg rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    percentage >= 70
                      ? 'bg-green-500'
                      : percentage >= 40
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Summary */}
      {summary && (
        <div className="mt-4 p-3 bg-dark-bg rounded-lg">
          <h5 className="text-sm font-medium mb-1">AI Analysis</h5>
          <p className="text-sm text-text-muted">{summary}</p>
        </div>
      )}
    </div>
  );
}

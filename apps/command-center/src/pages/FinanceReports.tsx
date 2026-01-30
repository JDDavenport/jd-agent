import { useState } from 'react';
import {
  useSpendingTrends,
  useTopMerchants,
  useCategoryTrends,
  useBudgetAccuracy,
  useIncomeExpenses,
  useFinanceStatus,
} from '../hooks/useFinance';
import LineChart from '../components/common/LineChart';
import LoadingSpinner from '../components/common/LoadingSpinner';

const formatCurrency = (cents: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);

type TimeRange = '30' | '60' | '90' | '180';
type TrendPeriod = 'daily' | 'weekly' | 'monthly';

function FinanceReports() {
  const [timeRange, setTimeRange] = useState<TimeRange>('90');
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>('daily');

  const { data: status, isLoading: statusLoading } = useFinanceStatus();
  const { data: trends, isLoading: trendsLoading } = useSpendingTrends(
    trendPeriod,
    parseInt(timeRange)
  );
  const { data: merchants, isLoading: merchantsLoading } = useTopMerchants(10, parseInt(timeRange));
  const { data: categoryTrends, isLoading: categoriesLoading } = useCategoryTrends(6);
  const { data: budgetAccuracy, isLoading: accuracyLoading } = useBudgetAccuracy(6);
  const { data: incomeExpenses, isLoading: incomeLoading } = useIncomeExpenses(12);

  if (statusLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!status?.ready) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-text-primary mb-4">Finance Reports</h1>
        <div className="bg-surface-raised border border-border-default rounded-lg p-8 text-center">
          <div className="text-4xl mb-4">📊</div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">Connect Your Accounts</h2>
          <p className="text-text-muted mb-4">
            Link a bank account to view spending analytics and reports.
          </p>
          <a
            href="/finance"
            className="inline-block bg-accent-primary text-white px-4 py-2 rounded-lg hover:bg-accent-primary/90 transition-colors"
          >
            Go to Budget
          </a>
        </div>
      </div>
    );
  }

  // Prepare chart data
  const spendingChartData =
    trends?.data.map((point, index) => ({
      x: index,
      y: point.spentCents,
    })) || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Finance Reports</h1>
          <p className="text-text-muted">Spending analytics and budget insights</p>
        </div>
        <div className="flex gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="px-3 py-2 bg-surface-raised border border-border-default rounded-lg text-text-primary text-sm"
          >
            <option value="30">Last 30 days</option>
            <option value="60">Last 60 days</option>
            <option value="90">Last 90 days</option>
            <option value="180">Last 180 days</option>
          </select>
          <a
            href="/finance/settings"
            className="px-3 py-2 bg-surface-raised border border-border-default rounded-lg text-text-primary text-sm hover:bg-surface-default transition-colors"
          >
            Settings
          </a>
        </div>
      </div>

      {/* Summary Cards */}
      {trends && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-surface-raised border border-border-default rounded-lg p-4">
            <div className="text-text-muted text-sm mb-1">Total Spent</div>
            <div className="text-2xl font-bold text-text-primary">
              {formatCurrency(trends.summary.totalSpentCents)}
            </div>
          </div>
          <div className="bg-surface-raised border border-border-default rounded-lg p-4">
            <div className="text-text-muted text-sm mb-1">Total Income</div>
            <div className="text-2xl font-bold text-green-500">
              {formatCurrency(trends.summary.totalIncomeCents)}
            </div>
          </div>
          <div className="bg-surface-raised border border-border-default rounded-lg p-4">
            <div className="text-text-muted text-sm mb-1">Avg Daily Spend</div>
            <div className="text-2xl font-bold text-text-primary">
              {formatCurrency(trends.summary.averageSpentCents)}
            </div>
          </div>
          <div className="bg-surface-raised border border-border-default rounded-lg p-4">
            <div className="text-text-muted text-sm mb-1">Highest Spend Day</div>
            <div className="text-2xl font-bold text-red-500">
              {trends.summary.highestSpendDay
                ? formatCurrency(trends.summary.highestSpendDay.amountCents)
                : '-'}
            </div>
            {trends.summary.highestSpendDay && (
              <div className="text-text-muted text-xs">{trends.summary.highestSpendDay.date}</div>
            )}
          </div>
        </div>
      )}

      {/* Spending Trends Chart */}
      <div className="bg-surface-raised border border-border-default rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Spending Trends</h2>
          <div className="flex gap-1 bg-surface-default rounded-lg p-1">
            {(['daily', 'weekly', 'monthly'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setTrendPeriod(period)}
                className={`px-3 py-1 rounded text-sm capitalize transition-colors ${
                  trendPeriod === period
                    ? 'bg-accent-primary text-white'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
        {trendsLoading ? (
          <div className="h-48 flex items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <LineChart
            data={spendingChartData}
            height={200}
            stroke="#EF4444"
            fill="rgba(239, 68, 68, 0.1)"
            valueFormatter={formatCurrency}
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Merchants */}
        <div className="bg-surface-raised border border-border-default rounded-lg p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Top Merchants</h2>
          {merchantsLoading ? (
            <div className="h-48 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="space-y-3">
              {merchants?.slice(0, 10).map((merchant, index) => (
                <div key={merchant.merchantName} className="flex items-center gap-3">
                  <div className="w-6 text-text-muted text-sm font-medium">{index + 1}.</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-text-primary font-medium truncate">
                      {merchant.merchantName}
                    </div>
                    <div className="text-text-muted text-xs">
                      {merchant.transactionCount} transactions
                      {merchant.category && ` · ${merchant.category}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-text-primary font-medium">
                      {formatCurrency(merchant.totalSpentCents)}
                    </div>
                    <div className="text-text-muted text-xs">{merchant.percentOfTotal}%</div>
                  </div>
                </div>
              ))}
              {!merchants?.length && (
                <div className="text-center text-text-muted py-8">No merchant data available</div>
              )}
            </div>
          )}
        </div>

        {/* Budget Accuracy */}
        <div className="bg-surface-raised border border-border-default rounded-lg p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Budget Accuracy</h2>
          {accuracyLoading ? (
            <div className="h-48 flex items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="space-y-3">
              {budgetAccuracy?.slice(0, 8).map((item) => {
                const accuracyColor =
                  item.overallAccuracy >= 80
                    ? 'text-green-500'
                    : item.overallAccuracy >= 60
                      ? 'text-yellow-500'
                      : 'text-red-500';
                const barColor =
                  item.overallAccuracy >= 80
                    ? 'bg-green-500'
                    : item.overallAccuracy >= 60
                      ? 'bg-yellow-500'
                      : 'bg-red-500';

                return (
                  <div key={item.category}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-text-primary text-sm font-medium truncate">
                        {item.category}
                      </span>
                      <span className={`text-sm font-bold ${accuracyColor}`}>
                        {item.overallAccuracy}%
                      </span>
                    </div>
                    <div className="h-2 bg-surface-default rounded-full overflow-hidden">
                      <div
                        className={`h-full ${barColor} transition-all duration-300`}
                        style={{ width: `${item.overallAccuracy}%` }}
                      />
                    </div>
                    <div className="text-text-muted text-xs mt-1">
                      Avg variance: {item.averageVariancePercent > 0 ? '+' : ''}
                      {item.averageVariancePercent}%
                    </div>
                  </div>
                );
              })}
              {!budgetAccuracy?.length && (
                <div className="text-center text-text-muted py-8">No budget data available</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Income vs Expenses */}
      <div className="bg-surface-raised border border-border-default rounded-lg p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Income vs Expenses</h2>
        {incomeLoading ? (
          <div className="h-48 flex items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {incomeExpenses && incomeExpenses.length > 0 && (
                <>
                  <div className="text-center">
                    <div className="text-text-muted text-sm mb-1">Total Income (12mo)</div>
                    <div className="text-xl font-bold text-green-500">
                      {formatCurrency(
                        incomeExpenses.reduce((sum, m) => sum + m.incomeCents, 0)
                      )}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-text-muted text-sm mb-1">Total Expenses (12mo)</div>
                    <div className="text-xl font-bold text-red-500">
                      {formatCurrency(
                        incomeExpenses.reduce((sum, m) => sum + m.expensesCents, 0)
                      )}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-text-muted text-sm mb-1">Net Savings (12mo)</div>
                    <div
                      className={`text-xl font-bold ${
                        incomeExpenses.reduce((sum, m) => sum + m.savingsCents, 0) >= 0
                          ? 'text-green-500'
                          : 'text-red-500'
                      }`}
                    >
                      {formatCurrency(
                        incomeExpenses.reduce((sum, m) => sum + m.savingsCents, 0)
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default">
                    <th className="text-left py-2 text-text-muted font-medium">Month</th>
                    <th className="text-right py-2 text-text-muted font-medium">Income</th>
                    <th className="text-right py-2 text-text-muted font-medium">Expenses</th>
                    <th className="text-right py-2 text-text-muted font-medium">Savings</th>
                    <th className="text-right py-2 text-text-muted font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {incomeExpenses?.map((month) => (
                    <tr key={month.period} className="border-b border-border-subtle">
                      <td className="py-2 text-text-primary">{month.period}</td>
                      <td className="py-2 text-right text-green-500">
                        {formatCurrency(month.incomeCents)}
                      </td>
                      <td className="py-2 text-right text-red-500">
                        {formatCurrency(month.expensesCents)}
                      </td>
                      <td
                        className={`py-2 text-right font-medium ${
                          month.savingsCents >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}
                      >
                        {formatCurrency(month.savingsCents)}
                      </td>
                      <td
                        className={`py-2 text-right ${
                          month.savingsRate >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}
                      >
                        {month.savingsRate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!incomeExpenses?.length && (
                <div className="text-center text-text-muted py-8">No income/expense data available</div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Category Trends */}
      <div className="bg-surface-raised border border-border-default rounded-lg p-6">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Category Trends (6 Months)</h2>
        {categoriesLoading ? (
          <div className="h-48 flex items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default">
                  <th className="text-left py-2 text-text-muted font-medium">Category</th>
                  <th className="text-center py-2 text-text-muted font-medium">Trend</th>
                  <th className="text-right py-2 text-text-muted font-medium">Avg/Month</th>
                  {categoryTrends?.[0]?.periods.map((p) => (
                    <th key={p.period} className="text-right py-2 text-text-muted font-medium">
                      {p.period.slice(5)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categoryTrends?.slice(0, 10).map((cat) => (
                  <tr key={cat.category} className="border-b border-border-subtle">
                    <td className="py-2 text-text-primary font-medium">{cat.category}</td>
                    <td className="py-2 text-center">
                      {cat.trend === 'increasing' && (
                        <span className="text-red-500">↑</span>
                      )}
                      {cat.trend === 'decreasing' && (
                        <span className="text-green-500">↓</span>
                      )}
                      {cat.trend === 'stable' && (
                        <span className="text-text-muted">→</span>
                      )}
                    </td>
                    <td className="py-2 text-right text-text-muted">
                      {formatCurrency(cat.averageSpentCents)}
                    </td>
                    {cat.periods.map((p) => (
                      <td key={p.period} className="py-2 text-right text-text-primary">
                        {formatCurrency(p.spentCents)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!categoryTrends?.length && (
              <div className="text-center text-text-muted py-8">No category data available</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default FinanceReports;

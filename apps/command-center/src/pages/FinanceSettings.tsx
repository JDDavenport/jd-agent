import { useState } from 'react';
import {
  useBudgetPreferences,
  useUpdateBudgetPreferences,
  useReportHistory,
  useAlertHistory,
} from '../hooks/useFinance';
import LoadingSpinner from '../components/common/LoadingSpinner';

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function FinanceSettings() {
  const [activeTab, setActiveTab] = useState<'preferences' | 'reports' | 'alerts'>('preferences');
  const [historyType, setHistoryType] = useState<'daily' | 'weekly' | undefined>(undefined);

  const { data: preferences, isLoading: prefsLoading } = useBudgetPreferences();
  const updatePrefs = useUpdateBudgetPreferences();
  const { data: reportHistory, isLoading: historyLoading } = useReportHistory(50, historyType);
  const { data: alertHistory, isLoading: alertsLoading } = useAlertHistory(50);

  const handleToggle = async (field: string, value: boolean) => {
    await updatePrefs.mutateAsync({ [field]: value });
  };

  const handleNumberChange = async (field: string, value: number) => {
    await updatePrefs.mutateAsync({ [field]: value });
  };

  const handleTimeChange = async (field: string, value: string) => {
    if (/^\d{2}:\d{2}$/.test(value)) {
      await updatePrefs.mutateAsync({ [field]: value });
    }
  };

  if (prefsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Budget Settings</h1>
          <p className="text-text-muted">Manage report preferences and view history</p>
        </div>
        <a href="/finance" className="btn btn-sm">
          Back to Budget
        </a>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-default rounded-lg p-1 w-fit">
        {(['preferences', 'reports', 'alerts'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded text-sm capitalize transition-colors ${
              activeTab === tab
                ? 'bg-accent-primary text-white'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            {tab === 'reports' ? 'Report History' : tab === 'alerts' ? 'Alert History' : tab}
          </button>
        ))}
      </div>

      {/* Preferences Tab */}
      {activeTab === 'preferences' && preferences && (
        <div className="space-y-6">
          {/* Daily Reports */}
          <div className="bg-surface-raised border border-border-default rounded-lg p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Daily Report Settings</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-text-primary font-medium">Email Report</div>
                  <div className="text-text-muted text-sm">Receive detailed daily report via email</div>
                </div>
                <button
                  onClick={() => handleToggle('dailyEmailEnabled', !preferences.dailyEmailEnabled)}
                  disabled={updatePrefs.isPending}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    preferences.dailyEmailEnabled ? 'bg-accent-primary' : 'bg-surface-default'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      preferences.dailyEmailEnabled ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-text-primary font-medium">SMS Summary</div>
                  <div className="text-text-muted text-sm">Receive quick daily summary via SMS</div>
                </div>
                <button
                  onClick={() => handleToggle('dailySmsEnabled', !preferences.dailySmsEnabled)}
                  disabled={updatePrefs.isPending}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    preferences.dailySmsEnabled ? 'bg-accent-primary' : 'bg-surface-default'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      preferences.dailySmsEnabled ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-text-primary font-medium">Delivery Time</div>
                  <div className="text-text-muted text-sm">When to send daily reports</div>
                </div>
                <input
                  type="time"
                  value={preferences.dailyTime}
                  onChange={(e) => handleTimeChange('dailyTime', e.target.value)}
                  disabled={updatePrefs.isPending}
                  className="px-3 py-1 bg-surface-default border border-border-default rounded text-text-primary"
                />
              </div>
            </div>
          </div>

          {/* Weekly Reports */}
          <div className="bg-surface-raised border border-border-default rounded-lg p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Weekly Report Settings</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-text-primary font-medium">Email Report</div>
                  <div className="text-text-muted text-sm">Receive detailed weekly report via email</div>
                </div>
                <button
                  onClick={() => handleToggle('weeklyEmailEnabled', !preferences.weeklyEmailEnabled)}
                  disabled={updatePrefs.isPending}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    preferences.weeklyEmailEnabled ? 'bg-accent-primary' : 'bg-surface-default'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      preferences.weeklyEmailEnabled ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-text-primary font-medium">SMS Summary</div>
                  <div className="text-text-muted text-sm">Receive quick weekly summary via SMS</div>
                </div>
                <button
                  onClick={() => handleToggle('weeklySmsEnabled', !preferences.weeklySmsEnabled)}
                  disabled={updatePrefs.isPending}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    preferences.weeklySmsEnabled ? 'bg-accent-primary' : 'bg-surface-default'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      preferences.weeklySmsEnabled ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-text-primary font-medium">Day of Week</div>
                  <div className="text-text-muted text-sm">Which day to send weekly reports</div>
                </div>
                <select
                  value={preferences.weeklyDay}
                  onChange={(e) => handleNumberChange('weeklyDay', parseInt(e.target.value))}
                  disabled={updatePrefs.isPending}
                  className="px-3 py-1 bg-surface-default border border-border-default rounded text-text-primary"
                >
                  {DAYS_OF_WEEK.map((day, i) => (
                    <option key={day} value={i}>
                      {day}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-text-primary font-medium">Delivery Time</div>
                  <div className="text-text-muted text-sm">When to send weekly reports</div>
                </div>
                <input
                  type="time"
                  value={preferences.weeklyTime}
                  onChange={(e) => handleTimeChange('weeklyTime', e.target.value)}
                  disabled={updatePrefs.isPending}
                  className="px-3 py-1 bg-surface-default border border-border-default rounded text-text-primary"
                />
              </div>
            </div>
          </div>

          {/* Alert Settings */}
          <div className="bg-surface-raised border border-border-default rounded-lg p-6">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Smart Alert Settings</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-text-primary font-medium">Enable Alerts</div>
                  <div className="text-text-muted text-sm">
                    Receive proactive alerts for spending patterns
                  </div>
                </div>
                <button
                  onClick={() => handleToggle('alertsEnabled', !preferences.alertsEnabled)}
                  disabled={updatePrefs.isPending}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    preferences.alertsEnabled ? 'bg-accent-primary' : 'bg-surface-default'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      preferences.alertsEnabled ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-text-primary font-medium">Large Transaction Threshold</div>
                  <div className="text-text-muted text-sm">
                    Alert when a single transaction exceeds this amount
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-text-muted">$</span>
                  <input
                    type="number"
                    value={preferences.largeTransactionThresholdCents / 100}
                    onChange={(e) =>
                      handleNumberChange(
                        'largeTransactionThresholdCents',
                        Math.round(parseFloat(e.target.value) * 100)
                      )
                    }
                    disabled={updatePrefs.isPending}
                    min={10}
                    step={10}
                    className="w-24 px-3 py-1 bg-surface-default border border-border-default rounded text-text-primary"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-text-primary font-medium">Unusual Spending Multiplier</div>
                  <div className="text-text-muted text-sm">
                    Alert when daily spending exceeds this multiple of your average
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={preferences.unusualSpendingMultiplier}
                    onChange={(e) =>
                      handleNumberChange('unusualSpendingMultiplier', parseFloat(e.target.value))
                    }
                    disabled={updatePrefs.isPending}
                    min={1.5}
                    max={5}
                    step={0.5}
                    className="w-20 px-3 py-1 bg-surface-default border border-border-default rounded text-text-primary"
                  />
                  <span className="text-text-muted">x average</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report History Tab */}
      {activeTab === 'reports' && (
        <div className="bg-surface-raised border border-border-default rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text-primary">Report History</h2>
            <select
              value={historyType || ''}
              onChange={(e) => setHistoryType(e.target.value ? (e.target.value as 'daily' | 'weekly') : undefined)}
              className="px-3 py-1 bg-surface-default border border-border-default rounded text-text-primary text-sm"
            >
              <option value="">All Reports</option>
              <option value="daily">Daily Only</option>
              <option value="weekly">Weekly Only</option>
            </select>
          </div>
          {historyLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="space-y-2">
              {reportHistory?.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-3 bg-surface-default rounded-lg"
                >
                  <div>
                    <div className="text-text-primary font-medium">
                      {report.reportType === 'daily' ? 'Daily Report' : 'Weekly Report'}
                    </div>
                    <div className="text-text-muted text-sm">{report.reportDate}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex gap-2 text-xs">
                      {report.emailSentAt && (
                        <span className="px-2 py-1 bg-green-500/20 text-green-500 rounded">
                          Email sent
                        </span>
                      )}
                      {report.smsSentAt && (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-500 rounded">
                          SMS sent
                        </span>
                      )}
                      {!report.emailSentAt && !report.smsSentAt && (
                        <span className="px-2 py-1 bg-surface-raised text-text-muted rounded">
                          Preview only
                        </span>
                      )}
                    </div>
                    <a
                      href={`/api/finance/reports/${report.reportType}/${report.reportDate}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-primary text-sm hover:underline"
                    >
                      Export
                    </a>
                  </div>
                </div>
              ))}
              {!reportHistory?.length && (
                <div className="text-center text-text-muted py-8">No reports generated yet</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Alert History Tab */}
      {activeTab === 'alerts' && (
        <div className="bg-surface-raised border border-border-default rounded-lg p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-4">Alert History</h2>
          {alertsLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="space-y-2">
              {alertHistory?.map((alert) => {
                const severityColors: Record<string, string> = {
                  warning: 'border-yellow-500/50 bg-yellow-500/10',
                  success: 'border-green-500/50 bg-green-500/10',
                  info: 'border-blue-500/50 bg-blue-500/10',
                };
                return (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-lg border ${severityColors[alert.severity] || 'border-border-default'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-text-primary font-medium">{alert.title}</div>
                        <div className="text-text-muted text-sm mt-1">{alert.description}</div>
                      </div>
                      <div className="text-text-muted text-xs">
                        {new Date(alert.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                );
              })}
              {!alertHistory?.length && (
                <div className="text-center text-text-muted py-8">No alerts yet</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FinanceSettings;

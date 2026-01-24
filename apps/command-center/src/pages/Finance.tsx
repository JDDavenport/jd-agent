import { useMemo, useRef, useState } from 'react';
import {
  useBudgets,
  useCreateBudget,
  useDeleteBudget,
  useFinanceOverview,
  useFinanceStatus,
  useRecentTransactions,
  useSpendingByCategory,
  useSyncAllAccounts,
  useUpdateBudget,
  useUploadTransactions,
} from '../hooks/useFinance';
import { createLinkToken, exchangePublicToken } from '../api/finance';
import { loadPlaid } from '../lib/plaid';
import LoadingSpinner from '../components/common/LoadingSpinner';

const DEFAULT_ALERT_THRESHOLD = 80;

const formatCurrency = (cents: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);

const getMonthlyEquivalent = (amountCents: number, periodType?: string | null): number => {
  switch (periodType) {
    case 'weekly':
      return amountCents * 4;
    case 'yearly':
      return Math.round(amountCents / 12);
    case 'monthly':
    default:
      return amountCents;
  }
};

function Finance() {
  const { data: status, isLoading: statusLoading } = useFinanceStatus();
  const { data: overview } = useFinanceOverview();
  const { data: budgets, isLoading: budgetsLoading } = useBudgets();
  const { data: recentTransactions } = useRecentTransactions(8);
  const { data: topCategories } = useSpendingByCategory();
  const syncAllMutation = useSyncAllAccounts();
  const createBudgetMutation = useCreateBudget();
  const updateBudgetMutation = useUpdateBudget();
  const deleteBudgetMutation = useDeleteBudget();
  const uploadMutation = useUploadTransactions();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const [formState, setFormState] = useState({
    name: '',
    groupName: '',
    category: '',
    amount: '',
    periodType: 'monthly' as 'weekly' | 'monthly' | 'yearly',
    alertThreshold: DEFAULT_ALERT_THRESHOLD.toString(),
    alertsEnabled: true,
    rolloverEnabled: false,
    rolloverAmount: '',
  });

  const [editAmounts, setEditAmounts] = useState<Record<string, string>>({});
  const [moveMoney, setMoveMoney] = useState({ fromId: '', toId: '', amount: '' });

  const budgetTotals = useMemo(() => {
    if (!budgets) {
      return {
        totalRemaining: 0,
        totalBudgeted: 0,
        totalActivity: 0,
        totalMonthlyBudgeted: 0,
      };
    }

    return budgets.reduce(
      (totals, item) => ({
        totalRemaining: totals.totalRemaining + item.remainingCents,
        totalBudgeted: totals.totalBudgeted + item.budget.amountCents,
        totalActivity: totals.totalActivity + item.spentCents,
        totalMonthlyBudgeted:
          totals.totalMonthlyBudgeted + getMonthlyEquivalent(item.budget.amountCents, item.budget.periodType),
      }),
      { totalRemaining: 0, totalBudgeted: 0, totalActivity: 0, totalMonthlyBudgeted: 0 }
    );
  }, [budgets]);

  const toBeBudgetedCents = useMemo(() => {
    const income = overview?.monthlyIncomeCents || 0;
    return income - budgetTotals.totalMonthlyBudgeted;
  }, [overview?.monthlyIncomeCents, budgetTotals.totalMonthlyBudgeted]);

  const groupedBudgets = useMemo(() => {
    if (!budgets) return [];
    const groups = new Map<string, typeof budgets>();

    for (const item of budgets) {
      const groupName = item.budget.groupName?.trim() || 'Uncategorized';
      if (!groups.has(groupName)) {
        groups.set(groupName, []);
      }
      groups.get(groupName)?.push(item);
    }

    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [budgets]);

  const handleConnectPlaid = async () => {
    setConnectError(null);
    try {
      const tokenResponse = linkToken ? { linkToken } : await createLinkToken();
      const currentToken = tokenResponse.linkToken;
      setLinkToken(currentToken);

      const plaid = await loadPlaid();
      if (!plaid) {
        throw new Error('Failed to load Plaid SDK');
      }
      const handler = plaid.create({
        token: currentToken,
        onSuccess: async (publicToken) => {
          await exchangePublicToken(publicToken);
          await syncAllMutation.mutateAsync();
        },
        onExit: (error) => {
          if (error) {
            setConnectError('Plaid connection was cancelled or failed.');
          }
        },
      });

      handler.open();
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Failed to connect Plaid');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus('Uploading...');
    try {
      const result = await uploadMutation.mutateAsync({ file, accountName: 'Bank Import' });
      setUploadStatus(`Imported ${result.imported} transactions`);
      setTimeout(() => setUploadStatus(null), 3000);
    } catch (err) {
      setUploadStatus(`Error: ${err instanceof Error ? err.message : 'Upload failed'}`);
      setTimeout(() => setUploadStatus(null), 5000);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleBudgetSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const amount = Number.parseFloat(formState.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    const alertThreshold = Number.parseInt(formState.alertThreshold, 10);
    const rolloverAmount = formState.rolloverAmount ? Number.parseFloat(formState.rolloverAmount) : undefined;

    await createBudgetMutation.mutateAsync({
      name: formState.name.trim(),
      groupName: formState.groupName.trim() || undefined,
      category: formState.category.trim(),
      amount,
      periodType: formState.periodType,
      alertThreshold: Number.isFinite(alertThreshold) ? alertThreshold : DEFAULT_ALERT_THRESHOLD,
      alertsEnabled: formState.alertsEnabled,
      rolloverEnabled: formState.rolloverEnabled,
      rolloverAmount,
    });

    setFormState({
      name: '',
      groupName: '',
      category: '',
      amount: '',
      periodType: 'monthly',
      alertThreshold: DEFAULT_ALERT_THRESHOLD.toString(),
      alertsEnabled: true,
      rolloverEnabled: false,
      rolloverAmount: '',
    });
  };

  const handleMoveMoney = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!budgets) return;

    const amount = Number.parseFloat(moveMoney.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (!moveMoney.fromId || !moveMoney.toId || moveMoney.fromId === moveMoney.toId) return;

    const fromBudget = budgets.find((item) => item.budget.id === moveMoney.fromId);
    const toBudget = budgets.find((item) => item.budget.id === moveMoney.toId);
    if (!fromBudget || !toBudget) return;

    const fromAmount = fromBudget.budget.amountCents - Math.round(amount * 100);
    if (fromAmount < 0) return;

    await updateBudgetMutation.mutateAsync({
      id: fromBudget.budget.id,
      data: { amount: fromAmount / 100 },
    });
    await updateBudgetMutation.mutateAsync({
      id: toBudget.budget.id,
      data: { amount: (toBudget.budget.amountCents + Math.round(amount * 100)) / 100 },
    });

    setMoveMoney({ fromId: '', toId: '', amount: '' });
  };

  if (statusLoading || budgetsLoading) {
    return (
      <div className="p-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Budget</h1>
          <p className="text-text-muted text-sm">Give every dollar a job. Zero-based, envelope-style budgeting.</p>
        </div>
        <button
          onClick={() => syncAllMutation.mutate()}
          disabled={syncAllMutation.isPending}
          className="btn btn-sm btn-accent"
        >
          {syncAllMutation.isPending ? 'Syncing...' : 'Sync now'}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card xl:col-span-2 space-y-6">
          <div className="rounded-lg border border-dark-border p-4 bg-dark-card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">To Be Budgeted</h2>
                <p className="text-xs text-text-muted">Income minus assigned dollars this month.</p>
              </div>
              <div className={`text-xl font-semibold ${toBeBudgetedCents >= 0 ? 'text-success' : 'text-error'}`}>
                {formatCurrency(toBeBudgetedCents)}
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-text-muted">
              <div>
                <p className="uppercase tracking-wide">Income</p>
                <p className="text-sm text-text">{formatCurrency(overview?.monthlyIncomeCents || 0)}</p>
              </div>
              <div>
                <p className="uppercase tracking-wide">Budgeted</p>
                <p className="text-sm text-text">{formatCurrency(budgetTotals.totalMonthlyBudgeted)}</p>
              </div>
              <div>
                <p className="uppercase tracking-wide">Activity</p>
                <p className="text-sm text-text">{formatCurrency(budgetTotals.totalActivity)}</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {groupedBudgets.length > 0 ? (
              groupedBudgets.map(([groupName, items]) => (
                <div key={groupName} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-text">{groupName}</h3>
                    <span className="text-xs text-text-muted">{items.length} categories</span>
                  </div>

                  {items.map((item) => {
                    const percent = Math.min(item.percentUsed, 100);
                    const color =
                      percent < 70 ? 'bg-success' : percent < 90 ? 'bg-warning' : 'bg-error';

                    const editValue =
                      editAmounts[item.budget.id] ?? (item.budget.amountCents / 100).toFixed(2);

                    return (
                      <div key={item.budget.id} className="p-4 rounded-lg bg-dark-bg space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-text">{item.budget.name}</p>
                            <p className="text-xs text-text-muted">
                              {item.budget.category} • {item.budget.periodType} • {item.periodStart} → {item.periodEnd}
                            </p>
                          </div>
                          <div className="text-xs text-text-muted text-right">
                            {item.percentUsed}% used
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-xs">
                          <div>
                            <p className="uppercase tracking-wide text-text-muted">Budgeted</p>
                            <div className="flex items-center gap-2">
                              <input
                                className="input w-24 text-sm"
                                type="number"
                                min="0"
                                step="0.01"
                                value={editValue}
                                onChange={(event) =>
                                  setEditAmounts((prev) => ({
                                    ...prev,
                                    [item.budget.id]: event.target.value,
                                  }))
                                }
                              />
                              <button
                                className="btn btn-xs"
                                type="button"
                                onClick={() =>
                                  updateBudgetMutation.mutate({
                                    id: item.budget.id,
                                    data: {
                                      amount: Number.isFinite(Number.parseFloat(editValue))
                                        ? Number.parseFloat(editValue)
                                        : 0,
                                    },
                                  })
                                }
                              >
                                Assign
                              </button>
                            </div>
                          </div>
                          <div>
                            <p className="uppercase tracking-wide text-text-muted">Activity</p>
                            <p className="text-sm text-text">{formatCurrency(item.spentCents)}</p>
                          </div>
                          <div>
                            <p className="uppercase tracking-wide text-text-muted">Available</p>
                            <p className={`text-sm ${item.remainingCents >= 0 ? 'text-success' : 'text-error'}`}>
                              {formatCurrency(item.remainingCents)}
                            </p>
                          </div>
                        </div>

                        <div>
                          <div className="h-2 rounded-full bg-dark-border overflow-hidden">
                            <div className={`h-2 ${color}`} style={{ width: `${percent}%` }} />
                          </div>
                          <div className="flex items-center justify-between text-xs text-text-muted mt-2">
                            <span>Target {formatCurrency(item.limitCents)}</span>
                            <span>
                              {item.remainingCents >= 0
                                ? `${formatCurrency(item.remainingCents)} left`
                                : `${formatCurrency(Math.abs(item.remainingCents))} over`}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                          <label className="flex items-center gap-2 text-text-muted">
                            <input
                              type="checkbox"
                              checked={item.budget.alertsEnabled ?? true}
                              onChange={(event) =>
                                updateBudgetMutation.mutate({
                                  id: item.budget.id,
                                  data: { alertsEnabled: event.target.checked },
                                })
                              }
                            />
                            Alerts
                          </label>
                          <button
                            onClick={() => deleteBudgetMutation.mutate(item.budget.id)}
                            className="text-error hover:text-error/80"
                          >
                            Deactivate
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            ) : (
              <p className="text-sm text-text-muted">No budgets yet. Create one below.</p>
            )}
          </div>
        </div>

        <div className="card space-y-4">
          <h2 className="text-lg font-semibold">Bank Connection</h2>
          {status?.plaidConfigured ? (
            <>
              <p className="text-xs text-text-muted">
                Connect Chase or any supported bank via Plaid.
              </p>
              {!status.encryptionConfigured && (
                <p className="text-xs text-warning">
                  Encryption key missing. Set ENCRYPTION_KEY before connecting.
                </p>
              )}
              <button
                onClick={handleConnectPlaid}
                className="btn btn-sm btn-accent"
                disabled={!status.encryptionConfigured}
              >
                Connect Bank
              </button>
              {connectError && <p className="text-xs text-error">{connectError}</p>}
            </>
          ) : (
            <>
              <p className="text-xs text-text-muted">
                Plaid not configured. Upload a CSV to import transactions.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn btn-sm btn-accent"
              >
                Upload CSV
              </button>
              {uploadStatus && (
                <p className={`text-xs ${uploadStatus.startsWith('Error') ? 'text-error' : 'text-success'}`}>
                  {uploadStatus}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card xl:col-span-2">
          <h2 className="text-lg font-semibold mb-1">Assign Dollars</h2>
          <p className="text-xs text-text-muted mb-4">
            Create a category and assign a monthly target. Keep “To Be Budgeted” at $0.
          </p>
          <form onSubmit={handleMoveMoney} className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <select
              className="input"
              value={moveMoney.fromId}
              onChange={(event) => setMoveMoney((prev) => ({ ...prev, fromId: event.target.value }))}
            >
              <option value="">Move from</option>
              {budgets?.map((item) => (
                <option key={item.budget.id} value={item.budget.id}>
                  {item.budget.name}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={moveMoney.toId}
              onChange={(event) => setMoveMoney((prev) => ({ ...prev, toId: event.target.value }))}
            >
              <option value="">Move to</option>
              {budgets?.map((item) => (
                <option key={item.budget.id} value={item.budget.id}>
                  {item.budget.name}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <input
                className="input w-full"
                type="number"
                min="0"
                step="0.01"
                value={moveMoney.amount}
                onChange={(event) => setMoveMoney((prev) => ({ ...prev, amount: event.target.value }))}
                placeholder="0.00"
              />
              <button type="submit" className="btn btn-sm">
                Move
              </button>
            </div>
          </form>
          <form onSubmit={handleBudgetSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-text-muted">Category name</label>
              <input
                className="input mt-1 w-full"
                value={formState.name}
                onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Dining Out"
                required
              />
            </div>
            <div>
              <label className="text-xs text-text-muted">Group (optional)</label>
              <input
                className="input mt-1 w-full"
                value={formState.groupName}
                onChange={(event) => setFormState((prev) => ({ ...prev, groupName: event.target.value }))}
                placeholder="Everyday Expenses"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted">Spending category</label>
              <input
                className="input mt-1 w-full"
                value={formState.category}
                onChange={(event) => setFormState((prev) => ({ ...prev, category: event.target.value }))}
                placeholder="Food & Dining"
                required
              />
            </div>
            <div>
              <label className="text-xs text-text-muted">Monthly target (USD)</label>
              <input
                className="input mt-1 w-full"
                type="number"
                min="0"
                step="0.01"
                value={formState.amount}
                onChange={(event) => setFormState((prev) => ({ ...prev, amount: event.target.value }))}
                placeholder="500"
                required
              />
            </div>
            <div>
              <label className="text-xs text-text-muted">Period</label>
              <select
                className="input mt-1 w-full"
                value={formState.periodType}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    periodType: event.target.value as 'weekly' | 'monthly' | 'yearly',
                  }))
                }
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted">Alert threshold (%)</label>
              <input
                className="input mt-1 w-full"
                type="number"
                min="0"
                max="100"
                value={formState.alertThreshold}
                onChange={(event) => setFormState((prev) => ({ ...prev, alertThreshold: event.target.value }))}
              />
            </div>
            <div className="flex items-center gap-3 pt-6">
              <label className="flex items-center gap-2 text-sm text-text-muted">
                <input
                  type="checkbox"
                  checked={formState.alertsEnabled}
                  onChange={(event) => setFormState((prev) => ({ ...prev, alertsEnabled: event.target.checked }))}
                />
                Alerts enabled
              </label>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-text-muted">
                <input
                  type="checkbox"
                  checked={formState.rolloverEnabled}
                  onChange={(event) => setFormState((prev) => ({ ...prev, rolloverEnabled: event.target.checked }))}
                />
                Rollover
              </label>
            </div>
            <div>
              <label className="text-xs text-text-muted">Rollover amount (USD)</label>
              <input
                className="input mt-1 w-full"
                type="number"
                min="0"
                step="0.01"
                value={formState.rolloverAmount}
                onChange={(event) => setFormState((prev) => ({ ...prev, rolloverAmount: event.target.value }))}
                placeholder="0"
                disabled={!formState.rolloverEnabled}
              />
            </div>
            <div className="md:col-span-2">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={createBudgetMutation.isPending}
                  className="btn btn-accent"
                >
                  {createBudgetMutation.isPending ? 'Creating...' : 'Assign dollars'}
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={toBeBudgetedCents <= 0}
                  onClick={() =>
                    setFormState((prev) => ({
                      ...prev,
                      amount: (toBeBudgetedCents / 100).toFixed(2),
                    }))
                  }
                >
                  Assign remaining ({formatCurrency(toBeBudgetedCents)})
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="card space-y-4">
          <h2 className="text-lg font-semibold">Insights</h2>
          <div>
            <p className="text-xs text-text-muted mb-2">Top categories this month</p>
            <div className="space-y-2">
              {topCategories?.slice(0, 5).map((cat) => (
                <div key={cat.category} className="flex items-center justify-between text-sm">
                  <span className="text-text">{cat.category}</span>
                  <span className="text-text-muted">{formatCurrency(cat.amountCents)}</span>
                </div>
              ))}
              {!topCategories?.length && (
                <p className="text-xs text-text-muted">No transactions yet.</p>
              )}
            </div>
          </div>
          <div>
            <p className="text-xs text-text-muted mb-2">Recent transactions</p>
            <div className="space-y-2">
              {recentTransactions?.map((txn) => (
                <div key={txn.id} className="flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <p className="text-text truncate">{txn.merchantName || txn.name}</p>
                    <p className="text-xs text-text-muted">{txn.category}</p>
                  </div>
                  <span className={txn.amountCents > 0 ? 'text-error' : 'text-success'}>
                    {txn.amountCents > 0 ? '-' : '+'}
                    {formatCurrency(Math.abs(txn.amountCents))}
                  </span>
                </div>
              ))}
              {!recentTransactions?.length && (
                <p className="text-xs text-text-muted">No recent transactions.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Finance;

/**
 * FinanceWidget - Phase 1
 *
 * Dashboard widget displaying financial overview:
 * - Total balance across accounts
 * - Monthly spending vs income
 * - Net cash flow indicator
 * - Recent transactions
 * - "Connect Account" CTA when no accounts
 * - Manual CSV upload when Plaid not available
 */

import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useFinanceWidget, useFinanceStatus, useUploadTransactions } from '../../hooks/useFinance';
import LoadingSpinner from '../common/LoadingSpinner';
import { ProgressBar } from './shared';

/**
 * Format cents to currency string
 */
function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function FinanceWidget() {
  const { data: status, isLoading: statusLoading } = useFinanceStatus();
  const { data, isLoading, error, refetch } = useFinanceWidget();
  const uploadMutation = useUploadTransactions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadStatus('Uploading...');
    try {
      const result = await uploadMutation.mutateAsync({ file, accountName: 'Bank Import' });
      setUploadStatus(`Imported ${result.imported} transactions`);
      refetch();
      setTimeout(() => setUploadStatus(null), 3000);
    } catch (err) {
      setUploadStatus(`Error: ${err instanceof Error ? err.message : 'Upload failed'}`);
      setTimeout(() => setUploadStatus(null), 5000);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Loading state
  if (isLoading || statusLoading) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Finance</h2>
        <LoadingSpinner />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Finance</h2>
        <p className="text-error text-sm">Failed to load financial data</p>
      </div>
    );
  }

  // Hidden file input for CSV upload
  const FileInput = () => (
    <input
      ref={fileInputRef}
      type="file"
      accept=".csv"
      onChange={handleFileSelect}
      className="hidden"
    />
  );

  // Not configured state - Plaid not set up, show upload option
  if (!status?.plaidConfigured) {
    return (
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">💰</span>
          <h2 className="text-lg font-semibold">Finance</h2>
        </div>
        <div className="text-center py-6">
          <p className="text-3xl mb-2">📊</p>
          <p className="text-text-muted text-sm mb-4">Import your bank transactions</p>
          <FileInput />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="btn btn-sm btn-accent"
          >
            {uploadMutation.isPending ? 'Uploading...' : 'Upload CSV'}
          </button>
          {uploadStatus && (
            <p className={`text-xs mt-2 ${uploadStatus.startsWith('Error') ? 'text-error' : 'text-success'}`}>
              {uploadStatus}
            </p>
          )}
          <p className="text-text-muted text-xs mt-3">
            Supports Chase, Bank of America, and other CSV exports
          </p>
        </div>
      </div>
    );
  }

  // No accounts connected - show both connect and upload options
  if (!data || data.overview.accountCount === 0) {
    return (
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">💰</span>
          <h2 className="text-lg font-semibold">Finance</h2>
        </div>
        <div className="text-center py-6">
          <p className="text-3xl mb-2">📊</p>
          <p className="text-text-muted text-sm mb-4">Import your bank transactions</p>
          <FileInput />
          <div className="flex flex-col gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
              className="btn btn-sm btn-accent"
            >
              {uploadMutation.isPending ? 'Uploading...' : 'Upload CSV'}
            </button>
          </div>
          {uploadStatus && (
            <p className={`text-xs mt-2 ${uploadStatus.startsWith('Error') ? 'text-error' : 'text-success'}`}>
              {uploadStatus}
            </p>
          )}
          <p className="text-text-muted text-xs mt-3">
            Export from your bank and upload here
          </p>
        </div>
      </div>
    );
  }

  const { overview, topCategories, recentTransactions } = data;
  const isPositiveCashFlow = overview.netCashFlowCents > 0;

  // Calculate budget percentage (spending vs income)
  const budgetPercentage =
    overview.monthlyIncomeCents > 0
      ? Math.round((overview.monthlySpendingCents / overview.monthlyIncomeCents) * 100)
      : 0;

  // Get budget status color
  const getBudgetColor = (percent: number) => {
    if (percent <= 70) return 'bg-success';
    if (percent <= 90) return 'bg-warning';
    return 'bg-error';
  };

  return (
    <div className="card">
      {/* Hidden file input */}
      <FileInput />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">💰</span>
          <h2 className="text-lg font-semibold">Finance</h2>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/finance"
            className="text-xs text-text-muted hover:text-text transition-colors"
          >
            View budget →
          </Link>
          {overview.pendingTransactions > 0 && (
            <span className="badge badge-warning text-xs">
              {overview.pendingTransactions} pending
            </span>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending}
            className="p-1.5 rounded text-text-muted hover:text-text hover:bg-dark-bg transition-colors"
            title="Upload CSV"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Upload status message */}
      {uploadStatus && (
        <div className={`text-xs mb-3 p-2 rounded ${uploadStatus.startsWith('Error') ? 'bg-error/10 text-error' : 'bg-success/10 text-success'}`}>
          {uploadStatus}
        </div>
      )}

      {/* Budget Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-text-muted">Monthly Spending</span>
          <span className="text-xl font-bold text-text">
            {formatCurrency(overview.monthlySpendingCents)}
          </span>
        </div>
        {overview.monthlyIncomeCents > 0 && (
          <>
            <ProgressBar value={budgetPercentage} color={getBudgetColor(budgetPercentage)} size="md" />
            <p className="text-xs text-text-muted mt-1">
              {budgetPercentage}% of {formatCurrency(overview.monthlyIncomeCents)} income
            </p>
          </>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* Income */}
        <div className="p-3 bg-dark-bg rounded-lg">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-sm">📈</span>
            <span className="text-xs text-text-muted">Income</span>
          </div>
          <p className="text-lg font-semibold text-success">
            {formatCurrency(overview.monthlyIncomeCents)}
          </p>
        </div>

        {/* Net Cash Flow */}
        <div className="p-3 bg-dark-bg rounded-lg">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-sm">{isPositiveCashFlow ? '💚' : '💔'}</span>
            <span className="text-xs text-text-muted">Net Flow</span>
          </div>
          <p className={`text-lg font-semibold ${isPositiveCashFlow ? 'text-success' : 'text-error'}`}>
            {isPositiveCashFlow ? '+' : ''}
            {formatCurrency(overview.netCashFlowCents)}
          </p>
        </div>
      </div>

      {/* Top Categories */}
      {topCategories && topCategories.length > 0 && (
        <div className="mb-4 pt-4 border-t border-dark-border">
          <h3 className="text-xs text-text-muted uppercase tracking-wider mb-2">Top Categories</h3>
          <div className="space-y-2">
            {topCategories.map((cat) => (
              <div key={cat.category} className="flex items-center justify-between">
                <span className="text-sm text-text truncate flex-1">{cat.category}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text">
                    {formatCurrency(cat.amountCents)}
                  </span>
                  <span className="text-xs text-text-muted w-8 text-right">{cat.percentOfTotal}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      {recentTransactions && recentTransactions.length > 0 && (
        <div className="pt-4 border-t border-dark-border">
          <h3 className="text-xs text-text-muted uppercase tracking-wider mb-2">
            Recent Transactions
          </h3>
          <div className="space-y-2">
            {recentTransactions.map((txn) => (
              <div key={txn.id} className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text truncate">
                    {txn.merchantName || txn.name}
                  </p>
                  <p className="text-xs text-text-muted">{txn.category}</p>
                </div>
                <span
                  className={`text-sm font-medium ${
                    txn.amountCents > 0 ? 'text-error' : 'text-success'
                  }`}
                >
                  {txn.amountCents > 0 ? '-' : '+'}
                  {formatCurrency(Math.abs(txn.amountCents))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Account Info */}
      <div className="mt-4 pt-4 border-t border-dark-border">
        <p className="text-xs text-text-muted text-center">
          {overview.accountCount} account{overview.accountCount !== 1 ? 's' : ''} connected
        </p>
      </div>
    </div>
  );
}

export default FinanceWidget;

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import {
  useCryptoAlerts,
  useCryptoCoins,
  useCryptoHealth,
  useRefreshCrypto,
  useSubmitBugReport,
  useBugReportStatus,
  useBugReportTest,
} from '../hooks/useCrypto';
import { useWatchlist } from '../hooks/useWatchlist';
import type { CryptoFilters, CryptoCoin, PrivacyLevel } from '../types/crypto';

const privacyLabels: Record<PrivacyLevel, string> = {
  none: 'None',
  optional: 'Optional',
  default: 'Default',
  mandatory: 'Mandatory',
};

const privacyClasses: Record<PrivacyLevel, string> = {
  none: 'text-text-muted bg-dark-bg',
  optional: 'text-purple-300 bg-purple-500/10',
  default: 'text-purple-200 bg-purple-500/20',
  mandatory: 'text-purple-100 bg-purple-500/30',
};

export default function Crypto() {
  const [search, setSearch] = useState('');
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel | 'all'>('all');
  const [privacyFocus, setPrivacyFocus] = useState(false);
  const [algorithm, setAlgorithm] = useState('all');
  const [minMarketCap, setMinMarketCap] = useState('');
  const [maxMarketCap, setMaxMarketCap] = useState('');
  const [minAgeYears, setMinAgeYears] = useState('');
  const [maxAgeYears, setMaxAgeYears] = useState('');
  const [sortBy, setSortBy] = useState<CryptoFilters['sortBy']>('marketCap');
  const [sortDir, setSortDir] = useState<CryptoFilters['sortDir']>('desc');

  const filters = useMemo<CryptoFilters>(
    () => ({
      search: search || undefined,
      privacyLevel: privacyLevel === 'all' ? undefined : privacyLevel,
      privacyFocus: privacyFocus || undefined,
      algorithm: algorithm === 'all' ? undefined : algorithm,
      minMarketCap: minMarketCap ? Number(minMarketCap) : undefined,
      maxMarketCap: maxMarketCap ? Number(maxMarketCap) : undefined,
      minAgeYears: minAgeYears ? Number(minAgeYears) : undefined,
      maxAgeYears: maxAgeYears ? Number(maxAgeYears) : undefined,
      sortBy: sortBy || undefined,
      sortDir: sortDir || undefined,
      limit: 100,
    }),
    [
      search,
      privacyLevel,
      privacyFocus,
      algorithm,
      minMarketCap,
      maxMarketCap,
      minAgeYears,
      maxAgeYears,
      sortBy,
      sortDir,
    ]
  );

  const { data: coins, isLoading, isFetching } = useCryptoCoins(filters);
  const refresh = useRefreshCrypto();
  const { data: alerts } = useCryptoAlerts();
  const { data: health } = useCryptoHealth();
  const bugReport = useSubmitBugReport();
  const bugStatus = useBugReportStatus();
  const bugTest = useBugReportTest();
  const watchlist = useWatchlist();

  const [bugTitle, setBugTitle] = useState('');
  const [bugDescription, setBugDescription] = useState('');
  const [bugSteps, setBugSteps] = useState('');
  const [bugExpected, setBugExpected] = useState('');
  const [bugActual, setBugActual] = useState('');
  const [bugEmail, setBugEmail] = useState('');
  const [bugStatus, setBugStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const algorithmOptions = useMemo(() => {
    if (!coins) return [];
    const unique = new Set(coins.map((coin) => coin.algorithm).filter(Boolean) as string[]);
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [coins]);

  const lastUpdated = useMemo(() => {
    if (!coins || coins.length === 0) return null;
    const timestamps = coins
      .map((coin) => (coin.lastMarketDataAt ? new Date(coin.lastMarketDataAt) : null))
      .filter((value): value is Date => value !== null);
    if (timestamps.length === 0) return null;
    const latest = new Date(Math.max(...timestamps.map((t) => t.getTime())));
    return latest.toLocaleTimeString();
  }, [coins]);

  const resetFilters = () => {
    setSearch('');
    setPrivacyLevel('all');
    setPrivacyFocus(false);
    setAlgorithm('all');
    setMinMarketCap('');
    setMaxMarketCap('');
    setMinAgeYears('');
    setMaxAgeYears('');
    setSortBy('marketCap');
    setSortDir('desc');
  };

  const handleBugSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBugStatus('idle');

    try {
      await bugReport.mutateAsync({
        title: bugTitle,
        description: bugDescription,
        steps: bugSteps || undefined,
        expected: bugExpected || undefined,
        actual: bugActual || undefined,
        reporterEmail: bugEmail || undefined,
        pageUrl: window.location.href,
        userAgent: navigator.userAgent,
      });

      setBugTitle('');
      setBugDescription('');
      setBugSteps('');
      setBugExpected('');
      setBugActual('');
      setBugEmail('');
      setBugStatus('success');
    } catch {
      setBugStatus('error');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-yellow-300 bg-clip-text text-transparent">
            PoW Coins
          </h1>
          <p className="text-text-muted mt-1">Cypherpunk-aligned proof-of-work markets only</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/plan">
            <Button variant="secondary">PRD Plan</Button>
          </Link>
          <div className="text-xs text-text-muted">
            {lastUpdated ? `Last update ${lastUpdated}` : 'Fetching market data...'}
          </div>
          <Button variant="secondary" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
            {refresh.isPending ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
          <div className="lg:col-span-2">
            <label className="text-xs text-text-muted">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="BTC, Monero, etc."
              className="mt-1 w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label className="text-xs text-text-muted">Privacy</label>
            <select
              value={privacyLevel}
              onChange={(e) => setPrivacyLevel(e.target.value as PrivacyLevel | 'all')}
              className="mt-1 w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="all">All</option>
              <option value="none">None</option>
              <option value="optional">Optional</option>
              <option value="default">Default</option>
              <option value="mandatory">Mandatory</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-text-muted">Algorithm</label>
            <select
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="all">All</option>
              {algorithmOptions.map((algo) => (
                <option key={algo} value={algo}>
                  {algo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-text-muted">Min Market Cap</label>
            <input
              type="number"
              value={minMarketCap}
              onChange={(e) => setMinMarketCap(e.target.value)}
              placeholder="500000000"
              className="mt-1 w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label className="text-xs text-text-muted">Max Market Cap</label>
            <input
              type="number"
              value={maxMarketCap}
              onChange={(e) => setMaxMarketCap(e.target.value)}
              placeholder="25000000000"
              className="mt-1 w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="text-xs text-text-muted">Min Age (years)</label>
            <input
              type="number"
              value={minAgeYears}
              onChange={(e) => setMinAgeYears(e.target.value)}
              placeholder="2"
              className="mt-1 w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted">Max Age (years)</label>
            <input
              type="number"
              value={maxAgeYears}
              onChange={(e) => setMaxAgeYears(e.target.value)}
              placeholder="15"
              className="mt-1 w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-dark-border pt-4">
          <div className="flex items-center gap-2">
            <label className="text-xs text-text-muted">Sort</label>
            <select
              value={sortBy || 'marketCap'}
              onChange={(e) => setSortBy(e.target.value as CryptoFilters['sortBy'])}
              className="px-3 py-2 bg-dark-bg border border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="marketCap">Market Cap</option>
              <option value="price">Price</option>
              <option value="change24h">24h Change</option>
              <option value="change7d">7d Change</option>
              <option value="volume">Volume</option>
              <option value="circulatingSupply">Circulating Supply</option>
              <option value="ath">All-time High</option>
              <option value="cypherpunk">Cypherpunk Score</option>
              <option value="hashrate">Hashrate</option>
              <option value="name">Name</option>
            </select>
            <select
              value={sortDir || 'desc'}
              onChange={(e) => setSortDir(e.target.value as CryptoFilters['sortDir'])}
              className="px-3 py-2 bg-dark-bg border border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>

          <button
            onClick={() => setPrivacyFocus((prev) => !prev)}
            className={`px-3 py-2 rounded-lg text-sm transition-all ${
              privacyFocus
                ? 'bg-purple-500/20 text-purple-200'
                : 'bg-dark-bg text-text-muted hover:bg-dark-card-hover'
            }`}
          >
            Privacy-focused only
          </button>

          <Button variant="secondary" onClick={resetFilters}>
            Reset Filters
          </Button>

          {isFetching && <span className="text-xs text-text-muted">Updating…</span>}
        </div>
      </Card>

      {(alerts && alerts.length > 0) || (health && health.stale > 0) ? (
        <Card>
          <h3 className="text-lg font-semibold mb-3">Network Health</h3>
          {health && health.stale > 0 && (
            <p className="text-sm text-orange-300">
              {health.stale} network feeds are stale. {health.staleCoins.map((coin) => coin.symbol).join(', ')}
            </p>
          )}
          {alerts && alerts.length > 0 && (
            <div className="mt-3 space-y-2">
              {alerts.map((alert) => (
                <div
                  key={`${alert.coinId}-${alert.type}`}
                  className={`px-3 py-2 rounded-lg text-sm ${
                    alert.severity === 'critical'
                      ? 'bg-red-500/20 text-red-200'
                      : 'bg-yellow-500/20 text-yellow-200'
                  }`}
                >
                  {alert.symbol}: {alert.message}
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      {!coins || coins.length === 0 ? (
        <EmptyState
          icon="⛏️"
          title="No PoW coins found"
          description="Adjust your filters or try refreshing market data."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-dark-bg border-b border-dark-border text-text-muted">
                <tr>
                  <th className="text-left px-4 py-3">Coin</th>
                  <th className="text-right px-4 py-3">Price</th>
                  <th className="text-right px-4 py-3">24h</th>
                  <th className="text-right px-4 py-3">7d</th>
                  <th className="text-right px-4 py-3">Market Cap</th>
                  <th className="text-right px-4 py-3">Volume</th>
                  <th className="text-right px-4 py-3">Supply</th>
                  <th className="text-right px-4 py-3">ATH</th>
                  <th className="text-left px-4 py-3">Algorithm</th>
                  <th className="text-left px-4 py-3">Privacy</th>
                  <th className="text-right px-4 py-3">Cypherpunk</th>
                  <th className="text-left px-4 py-3">Badge</th>
                  <th className="text-left px-4 py-3">Watch</th>
                </tr>
              </thead>
              <tbody>
                {coins.map((coin) => (
                  <CoinRow key={coin.id} coin={coin} watchlist={watchlist} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <h3 className="text-lg font-semibold mb-3">Watchlist</h3>
        {watchlist.entries.length === 0 ? (
          <p className="text-sm text-text-muted">No coins yet. Use the table to add some.</p>
        ) : (
          <div className="space-y-3">
            {watchlist.entries.map((entry) => {
              const coin = coins?.find((item) => item.id === entry.coinId);
              if (!coin) return null;
              const price = coin.priceUsd || 0;
              const coinsHeld = price > 0 ? entry.investedUsd / price : 0;
              return (
                <div
                  key={entry.coinId}
                  className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between p-3 rounded-lg bg-dark-bg border border-dark-border"
                >
                  <div>
                    <div className="font-semibold text-text">
                      {coin.symbol} <span className="text-text-muted">· {coin.name}</span>
                    </div>
                    <div className="text-xs text-text-muted">
                      Price {formatCurrency(price)} · Coins {coinsHeld.toFixed(6)}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="0"
                      value={entry.investedUsd}
                      onChange={(e) =>
                        watchlist.updateInvestment(entry.coinId, Number(e.target.value || 0))
                      }
                      className="px-3 py-2 w-36 bg-dark-bg border border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                    <Button variant="secondary" onClick={() => watchlist.remove(entry.coinId)}>
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card>
        <h3 className="text-lg font-semibold mb-2">Report a bug</h3>
        <p className="text-sm text-text-muted mb-4">
          Send a quick report straight to your GoDaddy inbox.
        </p>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs text-text-muted">
            SMTP status:{' '}
            {bugStatus.data?.configured ? (
              <span className="text-green-400">Configured</span>
            ) : (
              <span className="text-red-400">Not configured</span>
            )}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => bugTest.mutate()}
            disabled={bugTest.isPending || !bugStatus.data?.configured}
          >
            {bugTest.isPending ? 'Testing...' : 'Send test email'}
          </Button>
          {bugTest.isSuccess && <span className="text-xs text-green-400">Sent</span>}
          {bugTest.isError && <span className="text-xs text-red-400">Failed</span>}
        </div>
        <form onSubmit={handleBugSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-text-muted">Title</label>
            <input
              type="text"
              value={bugTitle}
              onChange={(e) => setBugTitle(e.target.value)}
              placeholder="Short summary"
              className="mt-1 w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </div>
          <div>
            <label className="text-xs text-text-muted">Description</label>
            <textarea
              value={bugDescription}
              onChange={(e) => setBugDescription(e.target.value)}
              placeholder="What happened?"
              rows={4}
              className="mt-1 w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-text-muted">Steps to reproduce</label>
              <textarea
                value={bugSteps}
                onChange={(e) => setBugSteps(e.target.value)}
                placeholder="1. ... 2. ..."
                rows={3}
                className="mt-1 w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted">Your email (optional)</label>
              <input
                type="email"
                value={bugEmail}
                onChange={(e) => setBugEmail(e.target.value)}
                placeholder="you@jddavenport46.com"
                className="mt-1 w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <label className="text-xs text-text-muted mt-3 block">Expected vs actual</label>
              <textarea
                value={bugExpected}
                onChange={(e) => setBugExpected(e.target.value)}
                placeholder="Expected..."
                rows={2}
                className="mt-1 w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <textarea
                value={bugActual}
                onChange={(e) => setBugActual(e.target.value)}
                placeholder="Actual..."
                rows={2}
                className="mt-2 w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary" disabled={bugReport.isPending}>
              {bugReport.isPending ? 'Sending...' : 'Send bug report'}
            </Button>
            {bugStatus === 'success' && (
              <span className="text-sm text-green-400">Sent! Check your inbox.</span>
            )}
            {bugStatus === 'error' && (
              <span className="text-sm text-red-400">
                Failed to send. Check SMTP configuration.
              </span>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}

function CoinRow({
  coin,
  watchlist,
}: {
  coin: CryptoCoin;
  watchlist: ReturnType<typeof useWatchlist>;
}) {
  const watching = watchlist.isWatching(coin.id);

  return (
    <tr className="border-b border-dark-border last:border-none hover:bg-dark-card-hover">
      <td className="px-4 py-3">
        <Link to={`/coins/${coin.id}`} className="font-semibold text-text hover:text-accent">
          {coin.symbol}
        </Link>
        <div className="text-xs text-text-muted">{coin.name}</div>
      </td>
      <td className="px-4 py-3 text-right font-medium text-text">
        {formatCurrency(coin.priceUsd)}
      </td>
      <td className={`px-4 py-3 text-right ${changeClass(coin.priceChange24h)}`}>
        {formatPercent(coin.priceChange24h)}
      </td>
      <td className={`px-4 py-3 text-right ${changeClass(coin.priceChange7d)}`}>
        {formatPercent(coin.priceChange7d)}
      </td>
      <td className="px-4 py-3 text-right text-text">{formatCompact(coin.marketCap)}</td>
      <td className="px-4 py-3 text-right text-text">{formatCompact(coin.volume24h)}</td>
      <td className="px-4 py-3 text-right text-text">
        {formatSupply(coin.circulatingSupply, coin.maxSupply)}
      </td>
      <td className="px-4 py-3 text-right text-text">
        {coin.athPriceUsd ? formatCurrency(coin.athPriceUsd) : '—'}
      </td>
      <td className="px-4 py-3 text-text">{coin.algorithm || '—'}</td>
      <td className="px-4 py-3">
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${privacyClasses[coin.privacyLevel]}`}
        >
          {privacyLabels[coin.privacyLevel]}
        </span>
      </td>
      <td className="px-4 py-3 text-right text-text">
        {coin.cypherpunkScore ? coin.cypherpunkScore.toFixed(1) : '—'}
      </td>
      <td className="px-4 py-3 text-text">{getBadge(coin.cypherpunkScore)}</td>
      <td className="px-4 py-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => (watching ? watchlist.remove(coin.id) : watchlist.add(coin.id))}
        >
          {watching ? 'Remove' : 'Add'}
        </Button>
      </td>
    </tr>
  );
}

function formatCurrency(value?: number | null) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1 ? 2 : 6,
  }).format(value);
}

function formatCompact(value?: number | null) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(2)}%`;
}

function changeClass(value?: number | null) {
  if (value === null || value === undefined) return 'text-text-muted';
  if (value > 0) return 'text-green-400';
  if (value < 0) return 'text-red-400';
  return 'text-text-muted';
}

function formatSupply(circulating?: number | null, max?: number | null) {
  if (!circulating && !max) return '—';
  const circulatingLabel = circulating ? formatCompact(circulating) : '—';
  const maxLabel = max ? formatCompact(max) : '∞';
  return `${circulatingLabel} / ${maxLabel}`;
}

function getBadge(score?: number | null) {
  if (score === null || score === undefined) return 'Emerging';
  if (score >= 8) return 'Gold';
  if (score >= 6.5) return 'Silver';
  if (score >= 5) return 'Bronze';
  return 'Emerging';
}

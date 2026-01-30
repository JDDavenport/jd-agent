import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import LineChart from '../components/common/LineChart';
import MultiLineChart from '../components/common/MultiLineChart';
import {
  useCryptoCoin,
  useCryptoCoins,
  useCryptoMarketHistory,
  useCryptoNetworkHistory,
  useCryptoPools,
} from '../hooks/useCrypto';
import type { CryptoCoin } from '../types/crypto';

const RANGE_OPTIONS = [
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
  { label: '1y', value: '1y' },
  { label: 'All', value: 'all' },
] as const;

type RangeOption = (typeof RANGE_OPTIONS)[number]['value'];

export default function CryptoDetail() {
  const { id } = useParams<{ id: string }>();
  const [range, setRange] = useState<RangeOption>('90d');
  const [hashrate, setHashrate] = useState('100');
  const [hashrateUnit, setHashrateUnit] = useState('TH/s');
  const [powerWatts, setPowerWatts] = useState('1500');
  const [electricityCost, setElectricityCost] = useState('0.10');

  const { data: coin, isLoading } = useCryptoCoin(id);
  const { data: marketHistory } = useCryptoMarketHistory(id, range);
  const { data: networkHistory } = useCryptoNetworkHistory(id, range);
  const { data: pools } = useCryptoPools(id);

  const { data: algorithmPeers } = useCryptoCoins(
    coin?.algorithm ? { algorithm: coin.algorithm, limit: 20 } : undefined
  );

  const marketPoints = useMemo(
    () =>
      (marketHistory || [])
        .filter((point) => point.priceUsd !== null && point.priceUsd !== undefined)
        .map((point) => ({
          x: new Date(point.timestamp).getTime(),
          y: point.priceUsd as number,
        })),
    [marketHistory]
  );

  const networkPoints = useMemo(
    () =>
      (networkHistory || [])
        .filter((point) => point.hashRate !== null && point.hashRate !== undefined)
        .map((point) => ({
          x: new Date(point.timestamp).getTime(),
          y: point.hashRate as number,
        })),
    [networkHistory]
  );

  const difficultyPoints = useMemo(
    () =>
      (networkHistory || [])
        .filter((point) => point.difficulty !== null && point.difficulty !== undefined)
        .map((point) => ({
          x: new Date(point.timestamp).getTime(),
          y: point.difficulty as number,
        })),
    [networkHistory]
  );

  const profitability = useMemo(() => {
    if (!coin || !coin.networkHashRate || !coin.networkBlockReward || !coin.networkBlockTimeTarget) {
      return null;
    }
    const userHashrate = normalizeHashrate(Number(hashrate), hashrateUnit);
    if (!userHashrate) return null;

    const blocksPerDay = 86400 / coin.networkBlockTimeTarget;
    const coinsPerDay = (userHashrate / coin.networkHashRate) * blocksPerDay * coin.networkBlockReward;
    const revenue = coinsPerDay * (coin.priceUsd || 0);
    const cost = (Number(powerWatts) / 1000) * 24 * Number(electricityCost || 0);
    const profit = revenue - cost;
    const monthlyMultiplier = 30;

    return {
      coinsPerDay,
      revenue,
      cost,
      profit,
      coinsPerMonth: coinsPerDay * monthlyMultiplier,
      revenuePerMonth: revenue * monthlyMultiplier,
      costPerMonth: cost * monthlyMultiplier,
      profitPerMonth: profit * monthlyMultiplier,
    };
  }, [coin, hashrate, hashrateUnit, powerWatts, electricityCost]);

  const peerComparison = useMemo(() => {
    if (!algorithmPeers || !coin) return [];
    return algorithmPeers
      .filter((peer) => peer.id !== coin.id)
      .map((peer) => ({
        coin: peer,
        estimate: estimateProfitability(peer, hashrate, hashrateUnit, powerWatts, electricityCost),
      }))
      .sort((a, b) => (b.estimate?.profit || 0) - (a.estimate?.profit || 0));
  }, [algorithmPeers, coin, hashrate, hashrateUnit, powerWatts, electricityCost]);

  const topPoolShare = useMemo(() => {
    if (!pools || pools.length === 0) return null;
    const top4 = pools.slice(0, 4).reduce((sum, pool) => sum + (pool.hashRatePercentage || 0), 0);
    return top4;
  }, [pools]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (!coin) {
    return (
      <EmptyState
        icon="⛏️"
        title="Coin not found"
        description="This PoW coin is not in the tracker yet."
        action={<Link to="/crypto">Back to PoW Coins</Link>}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Link to="/crypto" className="text-sm text-text-muted hover:text-text">
            ← Back to PoW Coins
          </Link>
          <h1 className="text-3xl font-bold mt-1">
            {coin.name} <span className="text-text-muted">({coin.symbol})</span>
          </h1>
          <p className="text-text-muted">
            {coin.algorithm || 'Unknown algorithm'} · Privacy {coin.privacyLevel}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {coin.websiteUrl && (
            <a
              href={coin.websiteUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-text-muted hover:text-text"
            >
              Website
            </a>
          )}
          {coin.githubUrl && (
            <a
              href={coin.githubUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-text-muted hover:text-text"
            >
              GitHub
            </a>
          )}
          {coin.explorerUrl && (
            <a
              href={coin.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-text-muted hover:text-text"
            >
              Explorer
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ScoreCard label="Cypherpunk" value={coin.cypherpunkScore} accent="text-yellow-300" />
        <ScoreCard label="Privacy" value={coin.privacyScore} accent="text-purple-300" />
        <ScoreCard label="Decentralization" value={coin.decentralizationScore} accent="text-blue-300" />
        <ScoreCard
          label="Censorship"
          value={coin.censorshipResistanceScore}
          accent="text-green-300"
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-text-muted">
            Badge: <span className="text-text">{getBadge(coin.cypherpunkScore)}</span>
          </div>
          <div className="text-sm text-text-muted">
            {coin.networkHashRate ? `Hashrate ${formatHashrate(coin.networkHashRate, coin.networkHashRateUnit)}` : 'Hashrate —'}
            {coin.networkDifficulty ? ` · Difficulty ${formatCompact(coin.networkDifficulty)}` : ''}
            {coin.networkBlockReward ? ` · Reward ${coin.networkBlockReward}` : ''}
            {topPoolShare !== null ? ` · Top 4 pools ${topPoolShare.toFixed(1)}%` : ''}
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold mb-4">Core Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <Metric label="Price" value={formatCurrency(coin.priceUsd)} />
          <Metric label="Market Cap" value={formatCompact(coin.marketCap)} />
          <Metric label="24h Volume" value={formatCompact(coin.volume24h)} />
          <Metric label="ATH" value={coin.athPriceUsd ? formatCurrency(coin.athPriceUsd) : '—'} />
          <Metric label="Age" value={formatAge(coin.genesisDate)} />
          <Metric
            label="Circulating Supply"
            value={coin.circulatingSupply ? formatCompact(coin.circulatingSupply) : '—'}
          />
          <Metric label="Max Supply" value={coin.maxSupply ? formatCompact(coin.maxSupply) : '—'} />
          <Metric
            label="Block Time (target)"
            value={coin.networkBlockTimeTarget ? `${coin.networkBlockTimeTarget.toFixed(1)}s` : '—'}
          />
          <Metric
            label="Block Time (actual)"
            value={coin.networkBlockTimeActual ? `${coin.networkBlockTimeActual.toFixed(1)}s` : '—'}
          />
          <Metric
            label="Block Reward"
            value={coin.networkBlockReward ? coin.networkBlockReward.toString() : '—'}
          />
          <Metric
            label="ATH Date"
            value={coin.athDate ? new Date(coin.athDate).toLocaleDateString() : '—'}
          />
          <Metric
            label="Block Height"
            value={coin.networkBlockHeight ? formatCompact(coin.networkBlockHeight) : '—'}
          />
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold mb-4">Development Activity</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <Metric label="Dev Score" value={coin.devActivityScore ? coin.devActivityScore.toFixed(1) : '—'} />
          <Metric label="Stars" value={coin.githubStars ? formatCompact(coin.githubStars) : '—'} />
          <Metric
            label="Contributors"
            value={coin.githubContributorCount ? formatCompact(coin.githubContributorCount) : '—'}
          />
          <Metric
            label="Last Push"
            value={coin.githubPushedAt ? new Date(coin.githubPushedAt).toLocaleDateString() : '—'}
          />
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold mb-4">Resources</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <Resource label="Official site" url={coin.websiteUrl} />
          <Resource label="GitHub" url={coin.githubUrl} />
          <Resource label="Explorer" url={coin.explorerUrl} />
          <Resource label="Whitepaper" url={coin.whitepaperUrl} />
          <Resource label="Reddit" url={coin.redditUrl} />
          <Resource label="Discord" url={coin.discordUrl} />
          <Resource label="Telegram" url={coin.telegramUrl} />
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-text-muted">
            Price {formatCurrency(coin.priceUsd)} · Market Cap {formatCompact(coin.marketCap)}
          </div>
          <div className="flex items-center gap-2">
            {RANGE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={range === option.value ? 'primary' : 'secondary'}
                onClick={() => setRange(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold mb-4">Price Trend</h3>
          <LineChart
            data={marketPoints}
            valueFormatter={(value) => formatCurrency(value)}
            stroke="#F59E0B"
            fill="rgba(245, 158, 11, 0.15)"
          />
        </Card>
        <Card>
          <h3 className="text-lg font-semibold mb-4">Network Hashrate</h3>
          <LineChart
            data={networkPoints}
            valueFormatter={(value) => formatHashrate(value, coin.networkHashRateUnit)}
            stroke="#22C55E"
            fill="rgba(34, 197, 94, 0.15)"
          />
        </Card>
      </div>

      <Card>
        <h3 className="text-lg font-semibold mb-4">Difficulty Trend</h3>
        <LineChart
          data={difficultyPoints}
          valueFormatter={(value) => formatCompact(value)}
          stroke="#60A5FA"
          fill="rgba(96, 165, 250, 0.15)"
        />
      </Card>

      <Card>
        <h3 className="text-lg font-semibold mb-4">Price vs Hashrate (Normalized)</h3>
        <MultiLineChart
          series={[
            { label: 'Price', color: '#F59E0B', data: marketPoints },
            { label: 'Hashrate', color: '#22C55E', data: networkPoints },
          ]}
        />
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <h3 className="text-lg font-semibold mb-4">Mining Profitability</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-text-muted">Hashrate</label>
              <input
                type="number"
                value={hashrate}
                onChange={(e) => setHashrate(e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted">Unit</label>
              <select
                value={hashrateUnit}
                onChange={(e) => setHashrateUnit(e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              >
                <option value="H/s">H/s</option>
                <option value="KH/s">KH/s</option>
                <option value="MH/s">MH/s</option>
                <option value="GH/s">GH/s</option>
                <option value="TH/s">TH/s</option>
                <option value="PH/s">PH/s</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted">Power (W)</label>
              <input
                type="number"
                value={powerWatts}
                onChange={(e) => setPowerWatts(e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted">Electricity ($/kWh)</label>
              <input
                type="number"
                step="0.01"
                value={electricityCost}
                onChange={(e) => setElectricityCost(e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          {profitability ? (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <Metric label="Coins / day" value={profitability.coinsPerDay.toFixed(6)} />
              <Metric label="Revenue / day" value={formatCurrency(profitability.revenue)} />
              <Metric label="Energy / day" value={formatCurrency(profitability.cost)} />
              <Metric
                label="Profit / day"
                value={formatCurrency(profitability.profit)}
                accent={profitability.profit >= 0 ? 'text-green-400' : 'text-red-400'}
              />
              <Metric label="Coins / month" value={profitability.coinsPerMonth.toFixed(4)} />
              <Metric label="Revenue / month" value={formatCurrency(profitability.revenuePerMonth)} />
              <Metric label="Energy / month" value={formatCurrency(profitability.costPerMonth)} />
              <Metric
                label="Profit / month"
                value={formatCurrency(profitability.profitPerMonth)}
                accent={profitability.profitPerMonth >= 0 ? 'text-green-400' : 'text-red-400'}
              />
            </div>
          ) : (
            <p className="text-sm text-text-muted mt-4">
              Network data missing. Try refreshing market data or check later.
            </p>
          )}
        </Card>

        <Card>
          <h3 className="text-lg font-semibold mb-4">Mining Pools</h3>
          {pools && pools.length > 0 ? (
            <div className="space-y-2 text-sm">
              {pools.slice(0, 8).map((pool) => (
                <div key={pool.id} className="flex items-center justify-between">
                  <span className="text-text">{pool.poolName}</span>
                  <span className="text-text-muted">{(pool.hashRatePercentage || 0).toFixed(2)}%</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted">Pool distribution unavailable.</p>
          )}
        </Card>
      </div>

      {peerComparison.length > 0 && (
        <Card>
          <h3 className="text-lg font-semibold mb-4">
            Algorithm Comparison ({coin.algorithm})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-text-muted border-b border-dark-border">
                <tr>
                  <th className="text-left px-4 py-2">Coin</th>
                  <th className="text-right px-4 py-2">Profit / day</th>
                  <th className="text-right px-4 py-2">Revenue / day</th>
                  <th className="text-right px-4 py-2">Energy / day</th>
                </tr>
              </thead>
              <tbody>
                {peerComparison.map(({ coin: peer, estimate }) => (
                  <tr key={peer.id} className="border-b border-dark-border">
                    <td className="px-4 py-2">{peer.symbol}</td>
                    <td className={`px-4 py-2 text-right ${estimate?.profit && estimate.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {estimate ? formatCurrency(estimate.profit) : '—'}
                    </td>
                    <td className="px-4 py-2 text-right">{estimate ? formatCurrency(estimate.revenue) : '—'}</td>
                    <td className="px-4 py-2 text-right">{estimate ? formatCurrency(estimate.cost) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function ScoreCard({ label, value, accent }: { label: string; value?: number | null; accent?: string }) {
  return (
    <Card className="text-center">
      <div className={`text-2xl font-bold ${accent || 'text-white'}`}>
        {value !== null && value !== undefined ? value.toFixed(1) : '—'}
      </div>
      <div className="text-sm text-text-muted mt-1">{label}</div>
    </Card>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="p-3 rounded-lg bg-dark-bg border border-dark-border">
      <div className={`text-base font-semibold ${accent || 'text-text'}`}>{value}</div>
      <div className="text-xs text-text-muted">{label}</div>
    </div>
  );
}

function Resource({ label, url }: { label: string; url?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-dark-bg border border-dark-border">
      <span className="text-text-muted">{label}</span>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="text-accent hover:text-accent-light">
          Open
        </a>
      ) : (
        <span className="text-text-muted">—</span>
      )}
    </div>
  );
}

function normalizeHashrate(value: number, unit: string) {
  if (!value || Number.isNaN(value)) return 0;
  const multipliers: Record<string, number> = {
    'H/s': 1,
    'KH/s': 1e3,
    'MH/s': 1e6,
    'GH/s': 1e9,
    'TH/s': 1e12,
    'PH/s': 1e15,
  };
  return value * (multipliers[unit] || 1);
}

function estimateProfitability(
  coin: CryptoCoin,
  hashrate: string,
  unit: string,
  powerWatts: string,
  electricityCost: string
) {
  if (!coin.networkHashRate || !coin.networkBlockReward || !coin.networkBlockTimeTarget) {
    return null;
  }
  const userHashrate = normalizeHashrate(Number(hashrate), unit);
  if (!userHashrate) return null;

  const blocksPerDay = 86400 / coin.networkBlockTimeTarget;
  const coinsPerDay = (userHashrate / coin.networkHashRate) * blocksPerDay * coin.networkBlockReward;
  const revenue = coinsPerDay * (coin.priceUsd || 0);
  const cost = (Number(powerWatts) / 1000) * 24 * Number(electricityCost || 0);
  const profit = revenue - cost;

  return { coinsPerDay, revenue, cost, profit };
}

function formatCurrency(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
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

function formatHashrate(value?: number | null, unit?: string | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(
    value
  )} ${unit || 'H/s'}`;
}

function formatAge(date?: string | null) {
  if (!date) return '—';
  const genesis = new Date(date);
  if (Number.isNaN(genesis.getTime())) return '—';
  const years = (Date.now() - genesis.getTime()) / (1000 * 60 * 60 * 24 * 365);
  return `${years.toFixed(1)} yrs`;
}

function getBadge(score?: number | null) {
  if (score === null || score === undefined) return 'Emerging';
  if (score >= 8) return 'Gold';
  if (score >= 6.5) return 'Silver';
  if (score >= 5) return 'Bronze';
  return 'Emerging';
}

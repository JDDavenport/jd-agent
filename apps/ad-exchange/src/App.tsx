import { useEffect, useMemo, useState } from 'react';
import Card from './components/common/Card';
import LoadingSpinner from './components/common/LoadingSpinner';
import EmptyState from './components/common/EmptyState';
import LineChart from './components/common/LineChart';
import Button from './components/common/Button';
import {
  useAdSpaces,
  useAdAllocations,
  useAdExchangeSummary,
  useAdListings,
  useAdPayments,
  useAdPerformance,
  useAdSpacePriceHistory,
  useMarketSnapshot,
  useMarketAnomalies,
  useMarketValuations,
  useMarketOpportunities,
  useAllocationRoi,
  useAdSpaceYield,
  useMarketActivity,
  useLiquidityRecommendations,
  useOwnershipTransfers,
  useUserAds,
  useUserStats,
  useModerationQueue,
} from './hooks/useAdExchange';
import type { AdSpace, AdSpaceFilters } from './types/ad-exchange';
import { buyListing, createListing, exportAdExchangeData, updateModeration } from './api/ad-exchange';

export default function App() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [active, setActive] = useState<'all' | 'true' | 'false'>('all');
  const [selected, setSelected] = useState<AdSpace | null>(null);
  const [tab, setTab] = useState<'details' | 'allocations' | 'market' | 'analytics'>('details');
  const [performanceRange, setPerformanceRange] = useState<30 | 60 | 90>(30);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [adminToken, setAdminToken] = useState('');
  const [moderationStatus, setModerationStatus] = useState('pending');
  const [moderationReason, setModerationReason] = useState<Record<string, string>>({});
  const [moderationError, setModerationError] = useState<string | null>(null);
  const [listingType, setListingType] = useState<'ad_space' | 'allocation'>('ad_space');
  const [listingAssetId, setListingAssetId] = useState('');
  const [askPrice, setAskPrice] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [listingError, setListingError] = useState<string | null>(null);
  const [listingSuccess, setListingSuccess] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);

  const filters = useMemo<AdSpaceFilters>(
    () => ({
      search: search || undefined,
      category: category || undefined,
      active: active === 'all' ? undefined : active === 'true',
      limit: 200,
    }),
    [search, category, active]
  );

  const { data: adSpaces, isLoading } = useAdSpaces(filters);
  const { data: summary } = useAdExchangeSummary();
  const { data: allocations } = useAdAllocations({ adSpaceId: selected?.id });
  const { data: listings } = useAdListings({ status: 'active' });
  const { data: payments } = useAdPayments({ adSpaceId: selected?.id });
  const { data: performance } = useAdPerformance({
    adSpaceId: selected?.id,
    rangeDays: performanceRange,
  });
  const { data: priceHistory } = useAdSpacePriceHistory(selected?.id);
  const { data: snapshot } = useMarketSnapshot();
  const { data: anomalies } = useMarketAnomalies();
  const { data: valuations } = useMarketValuations();
  const { data: opportunities } = useMarketOpportunities();
  const { data: yieldResult } = useAdSpaceYield(selected?.id);
  const primaryAllocationId = allocations?.[0]?.id;
  const { data: allocationRoi } = useAllocationRoi(primaryAllocationId);
  const { data: marketActivity } = useMarketActivity(selected?.id);
  const { data: liquidityRecommendations } = useLiquidityRecommendations();
  const { data: transfers } = useOwnershipTransfers({ adSpaceId: selected?.id });
  const { data: userAds } = useUserAds(walletAddress || undefined);
  const { data: userStats } = useUserStats(walletAddress || undefined);
  const { data: moderationQueue } = useModerationQueue(moderationStatus, adminToken || undefined);

  useEffect(() => {
    const storedToken = localStorage.getItem('adExchangeAdminToken');
    if (storedToken) {
      setAdminToken(storedToken);
    }
  }, []);

  const connectWallet = async () => {
    setWalletError(null);
    setIsConnecting(true);
    try {
      const ethereum = (window as Window & { ethereum?: { request: (args: { method: string }) => Promise<string[]> } }).ethereum;
      if (!ethereum) {
        setWalletError('No wallet detected. Install MetaMask.');
        return;
      }
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      setWalletAddress(accounts?.[0] || null);
    } catch (error) {
      setWalletError(String(error));
    } finally {
      setIsConnecting(false);
    }
  };

  const ownedAssets = useMemo<{ id: string; label: string }[]>(() => {
    if (!walletAddress) return [];
    if (listingType === 'ad_space') {
      return (userAds?.adSpaces || []).map((space) => ({
        id: space.id,
        label: space.name,
      }));
    }
    return (userAds?.allocations || []).map((allocation) => ({
      id: allocation.id,
      label: `${allocation.allocationUnits} units`,
    }));
  }, [listingType, userAds, walletAddress]);

  useEffect(() => {
    setListingAssetId('');
  }, [listingType]);

  const submitListing = async () => {
    setListingError(null);
    setListingSuccess(null);
    if (!walletAddress) {
      setListingError('Connect wallet to list an ad.');
      return;
    }
    if (!listingAssetId) {
      setListingError('Select an asset to list.');
      return;
    }
    const price = Number(askPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setListingError('Enter a valid ask price.');
      return;
    }
    const min = minPrice ? Number(minPrice) : undefined;
    if (min !== undefined && (!Number.isFinite(min) || min <= 0)) {
      setListingError('Enter a valid minimum price.');
      return;
    }
    const payload = {
      listingType,
      sellerAddress: walletAddress,
      askPrice: price,
      minPrice: min,
      adSpaceId: listingType === 'ad_space' ? listingAssetId : undefined,
      allocationId: listingType === 'allocation' ? listingAssetId : undefined,
      expiresAt: expiresAt || undefined,
    };
    await createListing(payload);
    setListingSuccess('Listing created.');
  };

  const handleBuy = async (listingId: string, price: number) => {
    if (!walletAddress) {
      setListingError('Connect wallet to buy.');
      return;
    }
    setBuyingId(listingId);
    setListingError(null);
    try {
      await buyListing(listingId, { buyerAddress: walletAddress, purchasePrice: price });
    } catch (error) {
      setListingError(String(error));
    } finally {
      setBuyingId(null);
    }
  };

  const updateAdminToken = (value: string) => {
    setAdminToken(value);
    localStorage.setItem('adExchangeAdminToken', value);
  };

  const categories = useMemo(() => {
    if (!adSpaces) return [];
    const set = new Set(adSpaces.map((space) => space.category).filter(Boolean) as string[]);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [adSpaces]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg text-text px-6 py-8 space-y-6 animate-fade-in">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-300 to-indigo-300 bg-clip-text text-transparent">
            Gadz.io Ad Exchange
          </h1>
          <p className="text-text-muted mt-1">
            Tokenized ad space marketplace with automated enforcement and analytics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            onClick={async () => {
              const data = await exportAdExchangeData();
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = 'ad-exchange-export.json';
              link.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export Data
          </Button>
          <Button variant="primary" onClick={connectWallet} disabled={isConnecting}>
            {walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : 'Connect Wallet'}
          </Button>
        </div>
      </div>
      {walletError && <div className="text-sm text-error">{walletError}</div>}
      {walletAddress && (
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-text-muted">Connected wallet</div>
              <div className="text-lg font-semibold">{walletAddress}</div>
            </div>
            <div className="text-sm text-text-muted">
              {userStats
                ? `${userStats.ownedSpaces} spaces · ${userStats.ownedAllocations} allocations`
                : 'Loading stats...'}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6 text-sm">
            <div>
              <div className="text-xs text-text-muted mb-2">Owned ad spaces</div>
              {userAds?.adSpaces?.length ? (
                <div className="space-y-2">
                  {userAds.adSpaces.map((space) => (
                    <div key={space.id} className="flex items-center justify-between">
                      <div>{space.name}</div>
                      <div className="text-text-muted">${space.currentReservePrice.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-text-muted">No owned ad spaces.</div>
              )}
            </div>
            <div>
              <div className="text-xs text-text-muted mb-2">Owned allocations</div>
              {userAds?.allocations?.length ? (
                <div className="space-y-2">
                  {userAds.allocations.map((allocation) => (
                    <div key={allocation.id} className="flex items-center justify-between">
                      <div>{allocation.allocationUnits} units</div>
                      <div className="text-text-muted">{allocation.moderationStatus ?? 'pending'}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-text-muted">No owned allocations.</div>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">List your ad</h2>
          <div className="text-xs text-text-muted">Sell owned ad space or allocation</div>
        </div>
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-6 gap-4 text-sm">
          <div className="lg:col-span-2">
            <label className="text-xs text-text-muted">Listing type</label>
            <select
              value={listingType}
              onChange={(e) => setListingType(e.target.value as 'ad_space' | 'allocation')}
              className="mt-1 w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg"
            >
              <option value="ad_space">Ad Space</option>
              <option value="allocation">Allocation</option>
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="text-xs text-text-muted">Asset</label>
            <select
              value={listingAssetId}
              onChange={(e) => setListingAssetId(e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg"
            >
              <option value="">Select</option>
              {ownedAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted">Ask price</label>
            <input
              type="number"
              value={askPrice}
              onChange={(e) => setAskPrice(e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted">Min price</label>
            <input
              type="number"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm"
          />
          <Button variant="secondary" onClick={submitListing}>
            Create Listing
          </Button>
          {listingError && <div className="text-sm text-error">{listingError}</div>}
          {listingSuccess && <div className="text-sm text-success">{listingSuccess}</div>}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="text-xs text-text-muted">Active ad spaces</div>
          <div className="text-2xl font-semibold">{summary?.activeAdSpaces ?? 0}</div>
        </Card>
        <Card>
          <div className="text-xs text-text-muted">Weekly revenue</div>
          <div className="text-2xl font-semibold">${summary?.weeklyRevenue?.toFixed?.(2) ?? '0.00'}</div>
        </Card>
        <Card>
          <div className="text-xs text-text-muted">Average CTR</div>
          <div className="text-2xl font-semibold">
            {summary ? `${(summary.averageCtr * 100).toFixed(2)}%` : '0.00%'}
          </div>
        </Card>
        <Card>
          <div className="text-xs text-text-muted">Payment compliance</div>
          <div className="text-2xl font-semibold">
            {summary ? `${(summary.paymentComplianceRate * 100).toFixed(1)}%` : '0.0%'}
          </div>
        </Card>
      </div>

      <Card>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-xs text-text-muted">Market health</div>
            <div className="text-lg font-semibold">
              {snapshot ? `${snapshot.activeAdSpaces}/${snapshot.totalAdSpaces} active` : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-text-muted">Avg reserve price</div>
            <div className="text-lg font-semibold">
              {snapshot ? `$${snapshot.averageReservePrice.toFixed(2)}` : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-text-muted">Weekly volume</div>
            <div className="text-lg font-semibold">
              {snapshot ? `$${snapshot.weeklyTransactionVolume.toFixed(2)}` : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-text-muted">Anomalies</div>
            <div className="text-lg font-semibold">{anomalies?.length ?? 0}</div>
          </div>
        </div>
        {anomalies && anomalies.length > 0 && (
          <div className="mt-4 space-y-2 text-xs text-text-muted">
            {anomalies.slice(0, 3).map((anomaly) => (
              <div key={`${anomaly.adSpaceId}-${anomaly.message}`}>
                {anomaly.type.toUpperCase()}: {anomaly.message}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <label className="text-xs text-text-muted">Search</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name"
              className="mt-1 w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">All</option>
              {categories.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-text-muted">Status</label>
            <select
              value={active}
              onChange={(e) => setActive(e.target.value as 'all' | 'true' | 'false')}
              className="mt-1 w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="all">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Ad spaces</h2>
            <div className="text-xs text-text-muted">{adSpaces?.length ?? 0} total</div>
          </div>
          {adSpaces && adSpaces.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-text-muted border-b border-dark-border">
                  <tr>
                    <th className="py-2 text-left">Name</th>
                    <th className="py-2 text-left">Category</th>
                    <th className="py-2 text-right">Weekly Impr.</th>
                    <th className="py-2 text-right">Reserve</th>
                    <th className="py-2 text-right">Holding Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {adSpaces.map((space) => (
                    <tr
                      key={space.id}
                      onClick={() => setSelected(space)}
                      className={`border-b border-dark-border/60 cursor-pointer hover:bg-dark-bg/60 ${
                        selected?.id === space.id ? 'bg-dark-bg/70' : ''
                      }`}
                    >
                      <td className="py-2 pr-4">{space.name}</td>
                      <td className="py-2 pr-4">{space.category || '—'}</td>
                      <td className="py-2 text-right">{space.weeklyImpressions.toLocaleString()}</td>
                      <td className="py-2 text-right">${space.currentReservePrice.toFixed(2)}</td>
                      <td className="py-2 text-right">${space.weeklyHoldingFee.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="No ad spaces yet" description="Create a new ad space to start trading." />
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <h2 className="text-lg font-semibold">Active listings</h2>
            <div className="mt-3 space-y-2 text-sm">
              {listings && listings.length > 0 ? (
                listings.slice(0, 6).map((listing) => (
                  <div key={listing.id} className="flex items-center justify-between">
                    <div className="text-text-muted">{listing.listingType}</div>
                    <div className="flex items-center gap-2">
                      <div>${listing.askPrice.toFixed(2)}</div>
                      {walletAddress && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleBuy(listing.id, listing.askPrice)}
                          disabled={buyingId === listing.id}
                        >
                          {buyingId === listing.id ? 'Buying...' : 'Buy'}
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-text-muted text-sm">No active listings</div>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold">Payments</h2>
            <div className="mt-3 space-y-2 text-sm">
              {payments && payments.length > 0 ? (
                payments.slice(0, 6).map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between">
                    <div className="text-text-muted">{payment.paymentType.replace(/_/g, ' ')}</div>
                    <div>${payment.amount.toFixed(2)}</div>
                  </div>
                ))
              ) : (
                <div className="text-text-muted text-sm">No payments recorded</div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {selected && (
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{selected.name}</h2>
            <div className="text-xs text-text-muted">{selected.category || 'Uncategorized'}</div>
          </div>
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-text-muted text-xs">Owner</div>
              <div>{selected.currentOwnerAddress}</div>
            </div>
            <div>
              <div className="text-text-muted text-xs">Creator</div>
              <div>{selected.creatorAddress}</div>
            </div>
            <div>
              <div className="text-text-muted text-xs">Next Payment Due</div>
              <div>{selected.nextPaymentDue ? new Date(selected.nextPaymentDue).toLocaleDateString() : '—'}</div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {(['details', 'allocations', 'market', 'analytics'] as const).map((value) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                className={`px-3 py-1 rounded-full text-xs uppercase tracking-wide ${
                  tab === value ? 'bg-accent text-white' : 'bg-dark-bg text-text-muted'
                }`}
              >
                {value}
              </button>
            ))}
          </div>

          {tab === 'details' && (
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold mb-2">Contract terms</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="text-text-muted">Weekly impressions</div>
                    <div>{selected.weeklyImpressions.toLocaleString()}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-text-muted">Reserve price</div>
                    <div>${selected.currentReservePrice.toFixed(2)}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-text-muted">Creator share (sale)</div>
                    <div>{selected.creatorSaleSharePercent}%</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-text-muted">Creator share (fees)</div>
                    <div>{selected.creatorFeeSharePercent}%</div>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-2">Price history</h3>
                {priceHistory && priceHistory.length > 0 ? (
                  <LineChart
                    data={priceHistory
                      .slice()
                      .reverse()
                      .map((point) => ({
                        x: new Date(point.recordedAt).getTime(),
                        y: point.price,
                      }))}
                    valueFormatter={(value) => `$${value.toFixed(2)}`}
                  />
                ) : (
                  <div className="text-text-muted text-sm">No price history</div>
                )}
              </div>
            </div>
          )}

          {tab === 'allocations' && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold mb-2">Allocations</h3>
              {allocations && allocations.length > 0 ? (
                <div className="space-y-2 text-sm">
                  {allocations.map((allocation) => (
                    <div key={allocation.id} className="flex items-center justify-between">
                      <div>{allocation.allocationUnits} units</div>
                      <div className="text-text-muted">{allocation.currentOwnerAddress}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-text-muted text-sm">No allocations yet</div>
              )}
            </div>
          )}

          {tab === 'market' && (
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-semibold mb-2">Recent payments</h3>
                {payments && payments.length > 0 ? (
                  <div className="space-y-2 text-sm">
                    {payments.slice(0, 6).map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between">
                        <div className="text-text-muted">{payment.paymentType.replace(/_/g, ' ')}</div>
                        <div>${payment.amount.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-text-muted text-sm">No payments recorded</div>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-2">Active listings</h3>
                {listings && listings.length > 0 ? (
                  <div className="space-y-2 text-sm">
                    {listings.slice(0, 6).map((listing) => (
                      <div key={listing.id} className="flex items-center justify-between">
                        <div className="text-text-muted">{listing.listingType}</div>
                        <div>${listing.askPrice.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-text-muted text-sm">No active listings</div>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-2">Ownership transfers</h3>
                {transfers && transfers.length > 0 ? (
                  <div className="space-y-2 text-sm">
                    {transfers.slice(0, 6).map((transfer) => (
                      <div key={transfer.id} className="flex items-center justify-between">
                        <div className="text-text-muted">{transfer.reason.replace(/_/g, ' ')}</div>
                        <div>{transfer.transferPrice ? `$${transfer.transferPrice.toFixed(2)}` : '—'}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-text-muted text-sm">No transfers yet</div>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-2">Market activity</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="text-text-muted">Active listings</div>
                    <div>{marketActivity?.activeListings ?? 0}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-text-muted">Weekly volume</div>
                    <div>${marketActivity?.weeklyVolume?.toFixed?.(2) ?? '0.00'}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-text-muted">Avg ask price</div>
                    <div>${marketActivity?.averageAskPrice?.toFixed?.(2) ?? '0.00'}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'analytics' && (
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold mb-2">Performance trend</h3>
                  <select
                    value={performanceRange}
                    onChange={(e) => setPerformanceRange(Number(e.target.value) as 30 | 60 | 90)}
                    className="text-xs bg-dark-bg border border-dark-border rounded-lg px-2 py-1"
                  >
                    <option value={30}>30d</option>
                    <option value={60}>60d</option>
                    <option value={90}>90d</option>
                  </select>
                </div>
                {performance && performance.length > 0 ? (
                  <LineChart
                    data={performance
                      .slice()
                      .reverse()
                      .map((metric) => ({
                        x: new Date(metric.periodStart).getTime(),
                        y: metric.ctr ?? 0,
                      }))}
                    valueFormatter={(value) => `${(value * 100).toFixed(2)}%`}
                  />
                ) : (
                  <div className="text-text-muted text-sm">No performance data yet</div>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-2">Underpriced opportunities</h3>
                {opportunities && opportunities.length > 0 ? (
                  <div className="space-y-2 text-sm">
                    {opportunities.slice(0, 6).map((opp) => (
                      <div key={opp.adSpaceId} className="flex items-center justify-between">
                        <div className="text-text-muted">{opp.adSpaceId.slice(0, 6)}…</div>
                        <div>{opp.discountPercent}% below estimate</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-text-muted text-sm">No opportunities detected</div>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-2">Yield + ROI</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="text-text-muted">Weekly yield</div>
                    <div>{yieldResult ? `${yieldResult.weeklyYieldPercent.toFixed(2)}%` : '—'}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-text-muted">Allocation ROI</div>
                    <div>{allocationRoi ? `${(allocationRoi.roi * 100).toFixed(2)}%` : '—'}</div>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-2">Valuation</h3>
                <div className="text-sm text-text-muted">
                  {valuations
                    ? valuations
                        .filter((value) => value.adSpaceId === selected.id)
                        .map((value) => `$${value.estimatedPrice.toFixed(2)}`)
                        .join(', ')
                    : '—'}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-2">Liquidity recommendations</h3>
                {liquidityRecommendations && liquidityRecommendations.length > 0 ? (
                  <div className="space-y-2 text-sm">
                    {liquidityRecommendations.slice(0, 4).map((rec) => (
                      <div key={rec.adSpaceId} className="flex items-center justify-between">
                        <div className="text-text-muted">{rec.adSpaceId.slice(0, 6)}…</div>
                        <div>${rec.suggestedBid.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-text-muted text-sm">No recommendations</div>
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Administrator moderation</h2>
            <div className="text-xs text-text-muted">Approve or reject pending creatives</div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="password"
              value={adminToken}
              onChange={(e) => updateAdminToken(e.target.value)}
              placeholder="Admin token"
              className="px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm"
            />
            <select
              value={moderationStatus}
              onChange={(e) => setModerationStatus(e.target.value)}
              className="px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm"
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
        {moderationError && <div className="text-sm text-error mt-2">{moderationError}</div>}
        <div className="mt-4 space-y-3 text-sm">
          {moderationQueue && moderationQueue.length > 0 ? (
            moderationQueue.slice(0, 8).map((allocation) => (
              <div key={allocation.id} className="flex flex-col gap-2 border-b border-dark-border/60 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    {allocation.allocationUnits} units · {allocation.contentCategory || 'Uncategorized'}
                  </div>
                  <div className="text-text-muted">{allocation.moderationStatus ?? 'pending'}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={moderationReason[allocation.id] || ''}
                    onChange={(e) =>
                      setModerationReason((prev) => ({ ...prev, [allocation.id]: e.target.value }))
                    }
                    placeholder="Reason"
                    className="px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm flex-1"
                  />
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      setModerationError(null);
                      try {
                        await updateModeration(
                          allocation.id,
                          { moderationStatus: 'approved', moderationReason: moderationReason[allocation.id] },
                          adminToken
                        );
                      } catch (error) {
                        setModerationError(String(error));
                      }
                    }}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      setModerationError(null);
                      try {
                        await updateModeration(
                          allocation.id,
                          { moderationStatus: 'rejected', moderationReason: moderationReason[allocation.id] },
                          adminToken
                        );
                      } catch (error) {
                        setModerationError(String(error));
                      }
                    }}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-text-muted">No items in this queue.</div>
          )}
        </div>
      </Card>
    </div>
  );
}

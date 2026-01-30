/**
 * Crypto Service - Cypherpunk PoW Coin Tracker
 *
 * Manages PoW coin metadata and market snapshots from CoinGecko.
 */

import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db } from '../db/client';
import {
  cryptoCoins,
  cryptoMarketData,
  cryptoMiningPools,
  cryptoNetworkData,
} from '../db/schema';

const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';
const MININGPOOLSTATS_BASE =
  process.env.MININGPOOLSTATS_BASE_URL || 'https://data.miningpoolstats.stream/data';
const MININGPOOLSTATS_FALLBACK = 'https://miningpoolstats.stream/data';
const MINERSTAT_API_KEY = process.env.MINERSTAT_API_KEY;
const MARKET_REFRESH_MS = 60 * 1000;
const NETWORK_REFRESH_MS = 10 * 60 * 1000;
const DEV_REFRESH_MS = 24 * 60 * 60 * 1000;

export type PrivacyLevel = 'none' | 'optional' | 'default' | 'mandatory';

export interface CryptoFilters {
  search?: string;
  privacyLevel?: PrivacyLevel;
  privacyFocus?: boolean;
  algorithm?: string;
  minMarketCap?: number;
  maxMarketCap?: number;
  minAgeYears?: number;
  maxAgeYears?: number;
  limit?: number;
  offset?: number;
  sortBy?:
    | 'marketCap'
    | 'price'
    | 'change24h'
    | 'change7d'
    | 'volume'
    | 'name'
    | 'circulatingSupply'
    | 'ath'
    | 'cypherpunk'
    | 'hashrate';
  sortDir?: 'asc' | 'desc';
}

interface CoinSeed {
  coingeckoId: string;
  symbol: string;
  name: string;
  algorithm: string;
  privacyLevel: PrivacyLevel;
  miningPoolStatsId?: string;
  genesisDate?: string;
  websiteUrl?: string;
  githubUrl?: string;
  whitepaperUrl?: string;
  explorerUrl?: string;
  redditUrl?: string;
  discordUrl?: string;
  telegramUrl?: string;
}

const DEFAULT_COINS: CoinSeed[] = [
  {
    coingeckoId: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    algorithm: 'SHA-256',
    privacyLevel: 'none',
    miningPoolStatsId: 'bitcoin',
    genesisDate: '2009-01-03',
    websiteUrl: 'https://bitcoin.org',
    githubUrl: 'https://github.com/bitcoin/bitcoin',
    whitepaperUrl: 'https://bitcoin.org/bitcoin.pdf',
    explorerUrl: 'https://mempool.space',
    redditUrl: 'https://www.reddit.com/r/Bitcoin/',
  },
  {
    coingeckoId: 'monero',
    symbol: 'XMR',
    name: 'Monero',
    algorithm: 'RandomX',
    privacyLevel: 'mandatory',
    miningPoolStatsId: 'monero',
    genesisDate: '2014-04-18',
    websiteUrl: 'https://www.getmonero.org',
    githubUrl: 'https://github.com/monero-project/monero',
    explorerUrl: 'https://xmrchain.net',
    redditUrl: 'https://www.reddit.com/r/Monero/',
  },
  {
    coingeckoId: 'litecoin',
    symbol: 'LTC',
    name: 'Litecoin',
    algorithm: 'Scrypt',
    privacyLevel: 'none',
    miningPoolStatsId: 'litecoin',
    genesisDate: '2011-10-13',
    websiteUrl: 'https://litecoin.org',
    githubUrl: 'https://github.com/litecoin-project/litecoin',
    explorerUrl: 'https://blockchair.com/litecoin',
    redditUrl: 'https://www.reddit.com/r/litecoin/',
  },
  {
    coingeckoId: 'bitcoin-cash',
    symbol: 'BCH',
    name: 'Bitcoin Cash',
    algorithm: 'SHA-256',
    privacyLevel: 'none',
    miningPoolStatsId: 'bitcoincash',
    genesisDate: '2017-08-01',
    websiteUrl: 'https://bitcoincash.org',
    githubUrl: 'https://github.com/bitcoin-cash-node/bitcoin-cash-node',
    explorerUrl: 'https://blockchair.com/bitcoin-cash',
    redditUrl: 'https://www.reddit.com/r/btc/',
  },
  {
    coingeckoId: 'dogecoin',
    symbol: 'DOGE',
    name: 'Dogecoin',
    algorithm: 'Scrypt',
    privacyLevel: 'none',
    miningPoolStatsId: 'dogecoin',
    genesisDate: '2013-12-06',
    websiteUrl: 'https://dogecoin.com',
    githubUrl: 'https://github.com/dogecoin/dogecoin',
    explorerUrl: 'https://blockchair.com/dogecoin',
    redditUrl: 'https://www.reddit.com/r/dogecoin/',
  },
  {
    coingeckoId: 'zcash',
    symbol: 'ZEC',
    name: 'Zcash',
    algorithm: 'Equihash',
    privacyLevel: 'optional',
    miningPoolStatsId: 'zcash',
    genesisDate: '2016-10-28',
    websiteUrl: 'https://z.cash',
    githubUrl: 'https://github.com/zcash/zcash',
    whitepaperUrl: 'https://z.cash/technology/',
    explorerUrl: 'https://blockchair.com/zcash',
    redditUrl: 'https://www.reddit.com/r/zec/',
  },
  {
    coingeckoId: 'ethereum-classic',
    symbol: 'ETC',
    name: 'Ethereum Classic',
    algorithm: 'Etchash',
    privacyLevel: 'none',
    miningPoolStatsId: 'ethereumclassic',
    genesisDate: '2016-07-20',
    websiteUrl: 'https://ethereumclassic.org',
    githubUrl: 'https://github.com/ethereumclassic',
    explorerUrl: 'https://blockchair.com/ethereum-classic',
    redditUrl: 'https://www.reddit.com/r/ethereumclassic/',
  },
  {
    coingeckoId: 'ravencoin',
    symbol: 'RVN',
    name: 'Ravencoin',
    algorithm: 'KawPow',
    privacyLevel: 'none',
    miningPoolStatsId: 'ravencoin',
    genesisDate: '2018-01-03',
    websiteUrl: 'https://ravencoin.org',
    githubUrl: 'https://github.com/RavenProject/Ravencoin',
    explorerUrl: 'https://ravencoin.network',
    redditUrl: 'https://www.reddit.com/r/Ravencoin/',
  },
  {
    coingeckoId: 'ergo',
    symbol: 'ERG',
    name: 'Ergo',
    algorithm: 'Autolykos',
    privacyLevel: 'none',
    miningPoolStatsId: 'ergo',
    genesisDate: '2019-07-01',
    websiteUrl: 'https://ergoplatform.org',
    githubUrl: 'https://github.com/ergoplatform/ergo',
    explorerUrl: 'https://explorer.ergoplatform.com',
    redditUrl: 'https://www.reddit.com/r/ergonauts/',
  },
  {
    coingeckoId: 'kadena',
    symbol: 'KDA',
    name: 'Kadena',
    algorithm: 'Blake2s',
    privacyLevel: 'none',
    miningPoolStatsId: 'kadena',
    genesisDate: '2019-12-04',
    websiteUrl: 'https://kadena.io',
    githubUrl: 'https://github.com/kadena-io',
    explorerUrl: 'https://explorer.chainweb.com',
    redditUrl: 'https://www.reddit.com/r/kadena/',
  },
  {
    coingeckoId: 'kaspa',
    symbol: 'KAS',
    name: 'Kaspa',
    algorithm: 'kHeavyHash',
    privacyLevel: 'none',
    miningPoolStatsId: 'kaspa',
    genesisDate: '2021-11-07',
    websiteUrl: 'https://kaspa.org',
    githubUrl: 'https://github.com/kaspanet',
    explorerUrl: 'https://explorer.kaspa.org',
    redditUrl: 'https://www.reddit.com/r/kaspa/',
  },
  {
    coingeckoId: 'nervos-network',
    symbol: 'CKB',
    name: 'Nervos Network',
    algorithm: 'Eaglesong',
    privacyLevel: 'none',
    miningPoolStatsId: 'nervosnetwork',
    genesisDate: '2019-11-16',
    websiteUrl: 'https://www.nervos.org',
    githubUrl: 'https://github.com/nervosnetwork',
    explorerUrl: 'https://explorer.nervos.org',
    redditUrl: 'https://www.reddit.com/r/NervosNetwork/',
  },
  {
    coingeckoId: 'flux',
    symbol: 'FLUX',
    name: 'Flux',
    algorithm: 'ZelHash',
    privacyLevel: 'none',
    miningPoolStatsId: 'flux',
    genesisDate: '2018-01-03',
    websiteUrl: 'https://fluxnetwork.io',
    githubUrl: 'https://github.com/zelcash',
    explorerUrl: 'https://explorer.runonflux.io',
    redditUrl: 'https://www.reddit.com/r/Flux_Official/',
  },
  {
    coingeckoId: 'dash',
    symbol: 'DASH',
    name: 'Dash',
    algorithm: 'X11',
    privacyLevel: 'optional',
    miningPoolStatsId: 'dash',
    genesisDate: '2014-01-19',
    websiteUrl: 'https://www.dash.org',
    githubUrl: 'https://github.com/dashpay/dash',
    explorerUrl: 'https://explorer.dash.org',
    redditUrl: 'https://www.reddit.com/r/dashpay/',
  },
  {
    coingeckoId: 'firo',
    symbol: 'FIRO',
    name: 'Firo',
    algorithm: 'FiroPoW',
    privacyLevel: 'optional',
    miningPoolStatsId: 'firo',
    genesisDate: '2016-09-01',
    websiteUrl: 'https://firo.org',
    githubUrl: 'https://github.com/firoorg/firo',
    explorerUrl: 'https://explorer.firo.org',
    redditUrl: 'https://www.reddit.com/r/firoProject/',
  },
];

class CryptoService {
  async ensureSeeded() {
    if (DEFAULT_COINS.length === 0) return;

    await db
      .insert(cryptoCoins)
      .values(
        DEFAULT_COINS.map((coin, index) => ({
          coingeckoId: coin.coingeckoId,
          symbol: coin.symbol,
          name: coin.name,
          algorithm: coin.algorithm,
          privacyLevel: coin.privacyLevel,
          miningPoolStatsId: coin.miningPoolStatsId,
          genesisDate: coin.genesisDate ? new Date(coin.genesisDate) : undefined,
          websiteUrl: coin.websiteUrl,
          githubUrl: coin.githubUrl,
          whitepaperUrl: coin.whitepaperUrl,
          explorerUrl: coin.explorerUrl,
          redditUrl: coin.redditUrl,
          discordUrl: coin.discordUrl,
          telegramUrl: coin.telegramUrl,
          sortOrder: index + 1,
          updatedAt: new Date(),
        }))
      )
      .onConflictDoUpdate({
        target: cryptoCoins.coingeckoId,
        set: {
          symbol: sql`excluded.symbol`,
          name: sql`excluded.name`,
          algorithm: sql`excluded.algorithm`,
          privacyLevel: sql`excluded.privacy_level`,
          miningPoolStatsId: sql`excluded.mining_poolstats_id`,
          genesisDate: sql`excluded.genesis_date`,
          websiteUrl: sql`excluded.website_url`,
          githubUrl: sql`excluded.github_url`,
          whitepaperUrl: sql`excluded.whitepaper_url`,
          explorerUrl: sql`excluded.explorer_url`,
          redditUrl: sql`excluded.reddit_url`,
          discordUrl: sql`excluded.discord_url`,
          telegramUrl: sql`excluded.telegram_url`,
          sortOrder: sql`excluded.sort_order`,
          updatedAt: new Date(),
        },
      });
  }

  async refreshMarketData(force = false) {
    await this.ensureSeeded();

    if (!force) {
      const stale = await this.isMarketDataStale();
      if (!stale) return;
    }

    const coins = await db
      .select({
        id: cryptoCoins.id,
        coingeckoId: cryptoCoins.coingeckoId,
      })
      .from(cryptoCoins)
      .where(eq(cryptoCoins.isActive, true));

    if (coins.length === 0) return;

    const ids = coins.map((coin) => coin.coingeckoId).join(',');
    const url = `${COINGECKO_API_BASE}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(
      ids
    )}&price_change_percentage=7d`;

    const response = await fetch(url);
    if (!response.ok) {
      const message = await response.text();
      throw new Error(`CoinGecko error (${response.status}): ${message}`);
    }

    const marketData = (await response.json()) as Array<{
      id: string;
      current_price: number;
      market_cap: number;
      total_volume: number;
      price_change_percentage_24h: number | null;
      price_change_percentage_7d_in_currency: number | null;
      circulating_supply: number | null;
      max_supply: number | null;
      ath: number | null;
      ath_date: string | null;
    }>;

    const now = new Date();

    for (const data of marketData) {
      const coin = coins.find((c) => c.coingeckoId === data.id);
      if (!coin) continue;

      const marketCap = toBigIntValue(data.market_cap);
      const volume24h = toBigIntValue(data.total_volume);
      const circulatingSupply = toBigIntValue(data.circulating_supply);
      const maxSupply = toBigIntValue(data.max_supply);

      await db
        .update(cryptoCoins)
        .set({
          priceUsd: data.current_price ?? null,
          marketCap,
          volume24h,
          priceChange24h: data.price_change_percentage_24h ?? null,
          priceChange7d: data.price_change_percentage_7d_in_currency ?? null,
          circulatingSupply,
          maxSupply,
          athPriceUsd: data.ath ?? null,
          athDate: data.ath_date ? new Date(data.ath_date) : null,
          lastMarketDataAt: now,
          updatedAt: now,
        })
        .where(eq(cryptoCoins.id, coin.id));

      await db.insert(cryptoMarketData).values({
        coinId: coin.id,
        priceUsd: data.current_price ?? null,
        marketCap,
        volume24h,
        priceChange24h: data.price_change_percentage_24h ?? null,
        priceChange7d: data.price_change_percentage_7d_in_currency ?? null,
        circulatingSupply,
        maxSupply,
        athPriceUsd: data.ath ?? null,
        athDate: data.ath_date ? new Date(data.ath_date) : null,
        timestamp: now,
      });
    }

    await this.refreshDevData();
    await this.refreshNetworkData();
    await this.refreshScores();
  }

  async refreshNetworkDataNow(force = true) {
    await this.refreshNetworkData(force);
    await this.refreshScores();
  }

  async refreshDevDataNow(force = true) {
    await this.refreshDevData(force);
    await this.refreshScores();
  }

  async getCoins(filters: CryptoFilters = {}) {
    await this.ensureSeeded();
    await this.refreshMarketData();

    const conditions = [eq(cryptoCoins.isActive, true)];

    if (filters.search) {
      conditions.push(
        sql`(${cryptoCoins.name} ILIKE ${`%${filters.search}%`} OR ${cryptoCoins.symbol} ILIKE ${`%${filters.search}%`})`
      );
    }

    if (filters.privacyLevel) {
      conditions.push(eq(cryptoCoins.privacyLevel, filters.privacyLevel));
    }

    if (filters.privacyFocus) {
      conditions.push(inArray(cryptoCoins.privacyLevel, ['optional', 'default', 'mandatory']));
    }

    if (filters.algorithm) {
      conditions.push(eq(cryptoCoins.algorithm, filters.algorithm));
    }

    if (filters.minMarketCap !== undefined) {
      conditions.push(gte(cryptoCoins.marketCap, filters.minMarketCap));
    }

    if (filters.maxMarketCap !== undefined) {
      conditions.push(lte(cryptoCoins.marketCap, filters.maxMarketCap));
    }

    if (filters.minAgeYears !== undefined) {
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - filters.minAgeYears);
      conditions.push(lte(cryptoCoins.genesisDate, cutoff));
    }

    if (filters.maxAgeYears !== undefined) {
      const cutoff = new Date();
      cutoff.setFullYear(cutoff.getFullYear() - filters.maxAgeYears);
      conditions.push(gte(cryptoCoins.genesisDate, cutoff));
    }

    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    const sortBy = filters.sortBy || 'marketCap';
    const sortDir = filters.sortDir || 'desc';

    const orderBy = (() => {
      const direction = sortDir === 'asc' ? asc : desc;
      switch (sortBy) {
        case 'price':
          return direction(cryptoCoins.priceUsd);
        case 'change24h':
          return direction(cryptoCoins.priceChange24h);
        case 'change7d':
          return direction(cryptoCoins.priceChange7d);
        case 'volume':
          return direction(cryptoCoins.volume24h);
        case 'circulatingSupply':
          return direction(cryptoCoins.circulatingSupply);
        case 'ath':
          return direction(cryptoCoins.athPriceUsd);
        case 'cypherpunk':
          return direction(cryptoCoins.cypherpunkScore);
        case 'hashrate':
          return direction(cryptoCoins.networkHashRate);
        case 'name':
          return direction(cryptoCoins.name);
        case 'marketCap':
        default:
          return direction(cryptoCoins.marketCap);
      }
    })();

    return db
      .select()
      .from(cryptoCoins)
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);
  }

  async getCoinById(id: string) {
    await this.ensureSeeded();
    await this.refreshMarketData();

    const [coin] = await db.select().from(cryptoCoins).where(eq(cryptoCoins.id, id)).limit(1);
    return coin || null;
  }

  async getMarketHistory(coinId: string, days: number) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return db
      .select()
      .from(cryptoMarketData)
      .where(and(eq(cryptoMarketData.coinId, coinId), gte(cryptoMarketData.timestamp, cutoff)))
      .orderBy(asc(cryptoMarketData.timestamp));
  }

  async getNetworkHistory(coinId: string, days: number) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return db
      .select()
      .from(cryptoNetworkData)
      .where(and(eq(cryptoNetworkData.coinId, coinId), gte(cryptoNetworkData.timestamp, cutoff)))
      .orderBy(asc(cryptoNetworkData.timestamp));
  }

  async getLatestPools(coinId: string) {
    const [latest] = await db
      .select({ timestamp: cryptoMiningPools.timestamp })
      .from(cryptoMiningPools)
      .where(eq(cryptoMiningPools.coinId, coinId))
      .orderBy(desc(cryptoMiningPools.timestamp))
      .limit(1);

    if (!latest?.timestamp) return [];

    return db
      .select()
      .from(cryptoMiningPools)
      .where(
        and(
          eq(cryptoMiningPools.coinId, coinId),
          eq(cryptoMiningPools.timestamp, latest.timestamp)
        )
      )
      .orderBy(desc(cryptoMiningPools.hashRatePercentage));
  }

  async getAlerts() {
    await this.refreshNetworkData();

    const coins = await db
      .select({
        id: cryptoCoins.id,
        name: cryptoCoins.name,
        symbol: cryptoCoins.symbol,
        networkHashRate: cryptoCoins.networkHashRate,
        networkBlockTimeActual: cryptoCoins.networkBlockTimeActual,
        networkBlockTimeTarget: cryptoCoins.networkBlockTimeTarget,
      })
      .from(cryptoCoins)
      .where(eq(cryptoCoins.isActive, true));

    const alerts = [];

    for (const coin of coins) {
      if (!coin.networkHashRate) continue;

      const history = await this.getNetworkHistory(coin.id, 7);
      if (history.length < 3) continue;

      const avg =
        history.reduce((sum, point) => sum + (point.hashRate || 0), 0) / history.length;
      if (!avg) continue;

      const dropPercent = ((avg - coin.networkHashRate) / avg) * 100;
      if (dropPercent > 20) {
        alerts.push({
          coinId: coin.id,
          symbol: coin.symbol,
          name: coin.name,
          type: 'hashrate_drop',
          severity: dropPercent > 40 ? 'critical' : 'warning',
          message: `Hash rate down ${dropPercent.toFixed(1)}% vs 7d average`,
          value: dropPercent,
        });
      }

      if (
        coin.networkBlockTimeActual &&
        coin.networkBlockTimeTarget &&
        coin.networkBlockTimeActual > coin.networkBlockTimeTarget * 2
      ) {
        alerts.push({
          coinId: coin.id,
          symbol: coin.symbol,
          name: coin.name,
          type: 'block_stall',
          severity: 'warning',
          message: `Block time ${coin.networkBlockTimeActual.toFixed(1)}s vs target ${coin.networkBlockTimeTarget.toFixed(1)}s`,
          value: coin.networkBlockTimeActual,
        });
      }
    }

    return alerts;
  }

  async getHealthSummary() {
    await this.refreshNetworkData();

    const coins = await db
      .select({
        id: cryptoCoins.id,
        name: cryptoCoins.name,
        symbol: cryptoCoins.symbol,
        lastNetworkDataAt: cryptoCoins.lastNetworkDataAt,
      })
      .from(cryptoCoins)
      .where(eq(cryptoCoins.isActive, true));

    const now = Date.now();
    const stale = coins.filter(
      (coin) => !coin.lastNetworkDataAt || now - coin.lastNetworkDataAt.getTime() > NETWORK_REFRESH_MS * 2
    );

    return {
      total: coins.length,
      stale: stale.length,
      staleCoins: stale.map((coin) => ({ id: coin.id, name: coin.name, symbol: coin.symbol })),
    };
  }

  private async isMarketDataStale() {
    const [row] = await db
      .select({
        lastUpdated: sql<Date | null>`max(${cryptoCoins.lastMarketDataAt})`,
      })
      .from(cryptoCoins);

    const lastUpdated = coerceDate(row?.lastUpdated);
    if (!lastUpdated) return true;
    return Date.now() - lastUpdated.getTime() > MARKET_REFRESH_MS;
  }

  private async isNetworkDataStale() {
    const [row] = await db
      .select({
        lastUpdated: sql<Date | null>`max(${cryptoCoins.lastNetworkDataAt})`,
      })
      .from(cryptoCoins);

    const lastUpdated = coerceDate(row?.lastUpdated);
    if (!lastUpdated) return true;
    return Date.now() - lastUpdated.getTime() > NETWORK_REFRESH_MS;
  }

  private async isDevDataStale() {
    const [row] = await db
      .select({
        lastUpdated: sql<Date | null>`max(${cryptoCoins.lastDevDataAt})`,
      })
      .from(cryptoCoins);

    const lastUpdated = coerceDate(row?.lastUpdated);
    if (!lastUpdated) return true;
    return Date.now() - lastUpdated.getTime() > DEV_REFRESH_MS;
  }

  private async refreshNetworkData(force = false) {
    await this.ensureSeeded();

    if (!force) {
      const stale = await this.isNetworkDataStale();
      if (!stale) return;
    }

    const coins = await db
      .select({
        id: cryptoCoins.id,
        symbol: cryptoCoins.symbol,
        miningPoolStatsId: cryptoCoins.miningPoolStatsId,
      })
      .from(cryptoCoins)
      .where(and(eq(cryptoCoins.isActive, true), sql`${cryptoCoins.miningPoolStatsId} is not null`));

    const minerstatSnapshot = await this.fetchMinerstatSnapshot(
      coins.map((coin) => coin.symbol)
    );

    for (const coin of coins) {
      if (!coin.miningPoolStatsId) continue;

      const now = new Date();
      const baseUrl = `${MININGPOOLSTATS_BASE}/${coin.miningPoolStatsId}.js`;
      const historyUrl = `${MININGPOOLSTATS_BASE}/history/${coin.miningPoolStatsId}.js`;

      let mainPayload = await this.fetchJsonPayload(baseUrl);
      let network = mainPayload ? this.parseNetworkData(mainPayload) : null;

      if (!network && minerstatSnapshot) {
        const minerstat = minerstatSnapshot.get(coin.symbol.toUpperCase());
        if (minerstat) {
          network = {
            hashRate: minerstat.network_hashrate,
            hashRateUnit: 'H/s',
            difficulty: minerstat.difficulty,
            blockHeight: null,
            blockTimeActual: null,
            blockTimeTarget: null,
            blockReward: minerstat.reward_block,
          };
        }
      }

      if (!network) {
        continue;
      }

      await db
        .update(cryptoCoins)
        .set({
          networkHashRate: network.hashRate ?? null,
          networkHashRateUnit: network.hashRateUnit ?? null,
          networkDifficulty: network.difficulty ?? null,
          networkBlockHeight: network.blockHeight ?? null,
          networkBlockTimeActual: network.blockTimeActual ?? null,
          networkBlockTimeTarget: network.blockTimeTarget ?? null,
          networkBlockReward: network.blockReward ?? null,
          lastNetworkDataAt: now,
          updatedAt: now,
        })
        .where(eq(cryptoCoins.id, coin.id));

      await db.insert(cryptoNetworkData).values({
        coinId: coin.id,
        hashRate: network.hashRate ?? null,
        hashRateUnit: network.hashRateUnit ?? null,
        difficulty: network.difficulty ?? null,
        blockHeight: network.blockHeight ?? null,
        blockTimeActual: network.blockTimeActual ?? null,
        blockTimeTarget: network.blockTimeTarget ?? null,
        blockReward: network.blockReward ?? null,
        timestamp: now,
      });

      if (mainPayload) {
        const pools = this.parsePools(mainPayload);
        if (pools.length > 0) {
          await db.delete(cryptoMiningPools).where(eq(cryptoMiningPools.coinId, coin.id));
          await db.insert(cryptoMiningPools).values(
            pools.map((pool) => ({
              coinId: coin.id,
              poolName: pool.name,
              hashRatePercentage: pool.share,
              timestamp: now,
            }))
          );
        }

        const historyPayload = await this.fetchJsonPayload(historyUrl);
        if (historyPayload && Array.isArray(historyPayload)) {
          const historyPoints = historyPayload
            .slice(-400)
            .map((point) => this.parseHistoryPoint(point))
            .filter(Boolean) as Array<{ timestamp: Date; hashRate: number }>;

          if (historyPoints.length > 0) {
            await db.insert(cryptoNetworkData).values(
              historyPoints.map((point) => ({
                coinId: coin.id,
                hashRate: point.hashRate,
                hashRateUnit: network.hashRateUnit ?? null,
                timestamp: point.timestamp,
              }))
            );
          }
        }
      }
    }
  }

  private async refreshDevData(force = false) {
    await this.ensureSeeded();

    if (!force) {
      const stale = await this.isDevDataStale();
      if (!stale) return;
    }

    const coins = await db
      .select({
        id: cryptoCoins.id,
        githubUrl: cryptoCoins.githubUrl,
      })
      .from(cryptoCoins)
      .where(and(eq(cryptoCoins.isActive, true), sql`${cryptoCoins.githubUrl} is not null`));

    for (const coin of coins) {
      if (!coin.githubUrl) continue;

      const repoPath = this.extractGithubRepoPath(coin.githubUrl);
      if (!repoPath) continue;

      const response = await fetch(`https://api.github.com/repos/${repoPath}`, {
        headers: {
          'User-Agent': 'JD-Agent-Crypto-Tracker',
          Accept: 'application/vnd.github+json',
        },
      });

      if (!response.ok) continue;

      const data = await response.json();
      const devScore = this.calculateDevActivityScore(data.pushed_at, data.stargazers_count);
      const contributorCount = await this.fetchContributorCount(repoPath);

      await db
        .update(cryptoCoins)
        .set({
          githubStars: data.stargazers_count ?? null,
          githubForks: data.forks_count ?? null,
          githubOpenIssues: data.open_issues_count ?? null,
          githubContributorCount: contributorCount,
          githubPushedAt: data.pushed_at ? new Date(data.pushed_at) : null,
          githubUpdatedAt: data.updated_at ? new Date(data.updated_at) : null,
          devActivityScore: devScore,
          lastDevDataAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(cryptoCoins.id, coin.id));
    }
  }

  private async refreshScores() {
    const coins = await db
      .select({
        id: cryptoCoins.id,
        privacyLevel: cryptoCoins.privacyLevel,
        genesisDate: cryptoCoins.genesisDate,
        devActivityScore: cryptoCoins.devActivityScore,
      })
      .from(cryptoCoins)
      .where(eq(cryptoCoins.isActive, true));

    for (const coin of coins) {
      const pools = await this.getLatestPools(coin.id);
      const decentralization = this.calculateDecentralizationScore(pools);
      const privacy = this.calculatePrivacyScore(coin.privacyLevel);
      const maturity = this.calculateMaturityScore(coin.genesisDate);
      const censorshipResistance = this.calculateCensorshipScore(privacy, decentralization, maturity);
      const devActivity = coin.devActivityScore ?? 5;

      const cypherpunk = this.calculateCompositeScore({
        privacy,
        decentralization,
        censorshipResistance,
        devActivity,
      });

      await db
        .update(cryptoCoins)
        .set({
          privacyScore: privacy,
          decentralizationScore: decentralization,
          censorshipResistanceScore: censorshipResistance,
          maturityScore: maturity,
          cypherpunkScore: cypherpunk,
          updatedAt: new Date(),
        })
        .where(eq(cryptoCoins.id, coin.id));
    }
  }

  private async fetchJsonPayload(url: string) {
    try {
      const response = await this.fetchWithHeaders(url);
      if (!response.ok) {
        if (url.startsWith(MININGPOOLSTATS_BASE)) {
          const fallbackUrl = url.replace(MININGPOOLSTATS_BASE, MININGPOOLSTATS_FALLBACK);
          const fallbackResponse = await this.fetchWithHeaders(fallbackUrl);
          if (!fallbackResponse.ok) return null;
          const fallbackText = await fallbackResponse.text();
          return this.extractJsonPayload(fallbackText);
        }
        return null;
      }
      const text = await response.text();
      return this.extractJsonPayload(text);
    } catch (error) {
      console.warn('[Crypto] Failed to fetch MiningPoolStats payload', error);
      return null;
    }
  }

  private async fetchWithHeaders(url: string) {
    return fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (JD Agent Crypto Tracker)',
        Accept: '*/*',
      },
    });
  }

  private async fetchMinerstatSnapshot(symbols: string[]) {
    if (!MINERSTAT_API_KEY || symbols.length === 0) return null;

    try {
      const list = symbols.map((symbol) => symbol.toUpperCase()).join(',');
      const response = await fetch(`https://api.minerstat.com/v2/coins?list=${list}`, {
        headers: {
          'X-API-Key': MINERSTAT_API_KEY,
          Accept: 'application/json',
        },
      });

      if (!response.ok) return null;

      const data = (await response.json()) as Array<{
        coin: string;
        network_hashrate: number;
        difficulty: number;
        reward_block: number;
      }>;

      const map = new Map<string, { network_hashrate: number; difficulty: number; reward_block: number }>();
      data.forEach((entry) => {
        map.set(entry.coin.toUpperCase(), {
          network_hashrate: entry.network_hashrate,
          difficulty: entry.difficulty,
          reward_block: entry.reward_block,
        });
      });

      return map;
    } catch {
      return null;
    }
  }

  private extractJsonPayload(text: string) {
    const startObject = text.indexOf('{');
    const startArray = text.indexOf('[');
    const start =
      startObject === -1 ? startArray : startArray === -1 ? startObject : Math.min(startObject, startArray);

    if (start === -1) return null;

    const endObject = text.lastIndexOf('}');
    const endArray = text.lastIndexOf(']');
    const end = Math.max(endObject, endArray);

    if (end === -1) return null;

    const payload = text.slice(start, end + 1);
    try {
      return JSON.parse(payload);
    } catch (error) {
      console.warn('[Crypto] Failed to parse MiningPoolStats payload');
      return null;
    }
  }

  private parseNetworkData(payload: Record<string, any>) {
    const hashRate = payload.hashrate ?? payload.network_hashrate ?? payload.nethash ?? null;
    const hashRateUnit = payload.hashrate_unit ?? payload.hashrateUnit ?? payload.nethash_unit ?? null;
    const difficulty = payload.difficulty ?? payload.network_difficulty ?? null;
    const blockHeight = payload.blocks ?? payload.block_height ?? payload.blockHeight ?? null;
    const blockReward = payload.reward ?? payload.block_reward ?? payload.blockReward ?? null;
    const blockTimeTarget =
      payload.block_time ?? payload.block_time_target ?? payload.blockTime ?? payload.blockTimeTarget ?? null;
    const blockTimeActual = payload.block_time_actual ?? payload.blockTimeActual ?? null;

    return {
      hashRate: hashRate ? Number(hashRate) : null,
      hashRateUnit,
      difficulty: difficulty ? Number(difficulty) : null,
      blockHeight: blockHeight ? Number(blockHeight) : null,
      blockReward: blockReward ? Number(blockReward) : null,
      blockTimeTarget: blockTimeTarget ? Number(blockTimeTarget) : null,
      blockTimeActual: blockTimeActual ? Number(blockTimeActual) : null,
    };
  }

  private parsePools(payload: Record<string, any>) {
    const pools = payload.pools || payload.top_pools || payload.pooldata || [];
    if (!Array.isArray(pools)) return [];

    return pools
      .map((pool: any) => ({
        name: pool.name || pool.pool || pool.pool_name || 'Unknown',
        share: Number(pool.share ?? pool.percent ?? pool.hashrate_percent ?? pool.percentage ?? 0),
      }))
      .filter((pool: { share: number }) => !Number.isNaN(pool.share))
      .sort((a: { share: number }, b: { share: number }) => b.share - a.share)
      .slice(0, 10);
  }

  private parseHistoryPoint(point: any) {
    if (!Array.isArray(point)) return null;
    const [timestamp, value] = point;
    if (!timestamp || value === undefined || value === null) return null;

    const ts = Number(timestamp);
    const time = ts > 10_000_000_000 ? ts : ts * 1000;

    return {
      timestamp: new Date(time),
      hashRate: Number(value),
    };
  }

  private extractGithubRepoPath(url: string) {
    try {
      const parsed = new URL(url);
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length < 2) return null;
      return `${parts[0]}/${parts[1]}`;
    } catch {
      return null;
    }
  }

  private calculatePrivacyScore(level?: PrivacyLevel | null) {
    switch (level) {
      case 'mandatory':
        return 9;
      case 'default':
        return 7;
      case 'optional':
        return 4;
      case 'none':
      default:
        return 1;
    }
  }

  private calculateMaturityScore(genesisDate?: Date | null) {
    const parsed = coerceDate(genesisDate);
    if (!parsed) return 5;
    const years = (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24 * 365);
    if (years >= 12) return 10;
    if (years >= 8) return 8;
    if (years >= 5) return 7;
    if (years >= 3) return 5;
    return 3;
  }

  private calculateDecentralizationScore(pools: Array<{ hashRatePercentage: number | null }>) {
    if (!pools || pools.length === 0) return 5;
    const sorted = pools
      .map((pool) => pool.hashRatePercentage || 0)
      .filter((share) => share > 0)
      .sort((a, b) => b - a);
    if (sorted.length === 0) return 5;

    const top4 = sorted.slice(0, 4).reduce((sum, share) => sum + share, 0);
    const score = 10 - Math.min(Math.max((top4 - 20) / 8, 0), 10);
    return Math.max(1, Math.min(10, Number(score.toFixed(1))));
  }

  private calculateCensorshipScore(privacy: number, decentralization: number, maturity: number) {
    const score = privacy * 0.35 + decentralization * 0.45 + maturity * 0.2;
    return Number(score.toFixed(1));
  }

  private calculateCompositeScore(values: {
    privacy: number;
    decentralization: number;
    censorshipResistance: number;
    devActivity: number;
  }) {
    const score =
      values.privacy * 0.3 +
      values.decentralization * 0.3 +
      values.censorshipResistance * 0.2 +
      values.devActivity * 0.2;
    return Number(score.toFixed(1));
  }

  private calculateDevActivityScore(pushedAt?: string, stars?: number) {
    if (!pushedAt) return 5;
    const daysSincePush = (Date.now() - new Date(pushedAt).getTime()) / (1000 * 60 * 60 * 24);
    let score = daysSincePush < 30 ? 9 : daysSincePush < 90 ? 7 : daysSincePush < 180 ? 6 : 4;
    if (stars && stars > 5000) score += 1;
    if (stars && stars > 20000) score += 1;
    return Math.min(10, score);
  }

  private async fetchContributorCount(repoPath: string) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${repoPath}/contributors?per_page=1&anon=1`,
        {
          headers: {
            'User-Agent': 'JD-Agent-Crypto-Tracker',
            Accept: 'application/vnd.github+json',
          },
        }
      );

      if (!response.ok) return null;

      const linkHeader = response.headers.get('link');
      if (linkHeader) {
        const match = linkHeader.match(/&page=(\d+)>; rel="last"/);
        if (match) {
          return Number(match[1]);
        }
      }

      const data = await response.json();
      return Array.isArray(data) ? data.length : null;
    } catch {
      return null;
    }
  }
}

function toBigIntValue(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return Math.round(value);
}

function coerceDate(value?: Date | string | number | null) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export const cryptoService = new CryptoService();

export type PrivacyLevel = 'none' | 'optional' | 'default' | 'mandatory';

export interface CryptoCoin {
  id: string;
  coingeckoId: string;
  symbol: string;
  name: string;
  algorithm?: string | null;
  genesisDate?: string | null;
  privacyLevel: PrivacyLevel;
  miningPoolStatsId?: string | null;
  websiteUrl?: string | null;
  githubUrl?: string | null;
  whitepaperUrl?: string | null;
  explorerUrl?: string | null;
  redditUrl?: string | null;
  discordUrl?: string | null;
  telegramUrl?: string | null;

  priceUsd?: number | null;
  marketCap?: number | null;
  volume24h?: number | null;
  priceChange24h?: number | null;
  priceChange7d?: number | null;
  circulatingSupply?: number | null;
  maxSupply?: number | null;
  athPriceUsd?: number | null;
  athDate?: string | null;
  lastMarketDataAt?: string | null;

  networkHashRate?: number | null;
  networkHashRateUnit?: string | null;
  networkDifficulty?: number | null;
  networkBlockHeight?: number | null;
  networkBlockTimeActual?: number | null;
  networkBlockTimeTarget?: number | null;
  networkBlockReward?: number | null;
  lastNetworkDataAt?: string | null;

  privacyScore?: number | null;
  decentralizationScore?: number | null;
  censorshipResistanceScore?: number | null;
  devActivityScore?: number | null;
  maturityScore?: number | null;
  cypherpunkScore?: number | null;

  githubStars?: number | null;
  githubForks?: number | null;
  githubOpenIssues?: number | null;
  githubContributorCount?: number | null;
  githubPushedAt?: string | null;
  githubUpdatedAt?: string | null;
}

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

export interface CryptoMarketPoint {
  timestamp: string;
  priceUsd?: number | null;
  marketCap?: number | null;
  volume24h?: number | null;
}

export interface CryptoNetworkPoint {
  timestamp: string;
  hashRate?: number | null;
  hashRateUnit?: string | null;
  difficulty?: number | null;
  blockReward?: number | null;
  blockTimeActual?: number | null;
  blockTimeTarget?: number | null;
}

export interface CryptoPool {
  id: string;
  poolName: string;
  hashRatePercentage?: number | null;
  timestamp: string;
}

export interface CryptoAlert {
  coinId: string;
  symbol: string;
  name: string;
  type: string;
  severity: 'warning' | 'critical';
  message: string;
  value: number;
}

export interface CryptoHealthSummary {
  total: number;
  stale: number;
  staleCoins: Array<{ id: string; name: string; symbol: string }>;
}

export interface CryptoMarketListing {
  market: string;
  base: string;
  target: string;
  last?: number;
  volume?: number;
  tradeUrl?: string;
}

import { useQuery } from '@tanstack/react-query';
import {
  getAdSpaces,
  getAllocations,
  getListings,
  getPayments,
  getSummary,
  getPerformance,
  getAdSpacePriceHistory,
  getMarketSnapshot,
  getMarketAnomalies,
  getMarketValuations,
  getMarketOpportunities,
  getAllocationRoi,
  getAdSpaceYield,
  getMarketActivity,
  getLiquidityRecommendations,
  getTransfers,
  getUserAds,
  getUserStats,
  getModerationQueue,
} from '../api/ad-exchange';
import type {
  AdExchangeSummary,
  AdPayment,
  AdSpace,
  AdSpacePricePoint,
  AdSpaceFilters,
  AdvertiserAllocation,
  MarketListing,
  PerformanceMetric,
  RoiResult,
  YieldResult,
  MarketActivitySummary,
  MarketSnapshot,
  MarketAnomaly,
  MarketValuation,
  MarketOpportunity,
  LiquidityRecommendation,
  OwnershipTransfer,
} from '../types/ad-exchange';

export const adExchangeKeys = {
  all: ['ad-exchange'] as const,
  spaces: (filters?: AdSpaceFilters) => [...adExchangeKeys.all, 'spaces', filters] as const,
  allocations: (params?: Record<string, unknown>) => [...adExchangeKeys.all, 'allocations', params] as const,
  listings: (params?: Record<string, unknown>) => [...adExchangeKeys.all, 'listings', params] as const,
  payments: (params?: Record<string, unknown>) => [...adExchangeKeys.all, 'payments', params] as const,
  summary: () => [...adExchangeKeys.all, 'summary'] as const,
  performance: (params?: Record<string, unknown>) => [...adExchangeKeys.all, 'performance', params] as const,
  priceHistory: (id?: string) => [...adExchangeKeys.all, 'price-history', id] as const,
  snapshot: () => [...adExchangeKeys.all, 'snapshot'] as const,
  anomalies: () => [...adExchangeKeys.all, 'anomalies'] as const,
  valuations: () => [...adExchangeKeys.all, 'valuations'] as const,
  opportunities: (discount?: number) => [...adExchangeKeys.all, 'opportunities', discount] as const,
  roi: (allocationId?: string) => [...adExchangeKeys.all, 'roi', allocationId] as const,
  yield: (adSpaceId?: string) => [...adExchangeKeys.all, 'yield', adSpaceId] as const,
  marketActivity: (adSpaceId?: string) => [...adExchangeKeys.all, 'market-activity', adSpaceId] as const,
  liquidity: (max?: number) => [...adExchangeKeys.all, 'liquidity', max] as const,
  transfers: (params?: Record<string, unknown>) => [...adExchangeKeys.all, 'transfers', params] as const,
  userAds: (address?: string) => [...adExchangeKeys.all, 'user-ads', address] as const,
  userStats: (address?: string) => [...adExchangeKeys.all, 'user-stats', address] as const,
  moderation: (status?: string) => [...adExchangeKeys.all, 'moderation', status] as const,
};

export function useAdSpaces(filters?: AdSpaceFilters) {
  return useQuery<AdSpace[]>({
    queryKey: adExchangeKeys.spaces(filters),
    queryFn: () => getAdSpaces(filters),
    staleTime: 60 * 1000,
  });
}

export function useAdAllocations(params?: {
  adSpaceId?: string;
  owner?: string;
  active?: boolean;
  limit?: number;
  offset?: number;
}) {
  return useQuery<AdvertiserAllocation[]>({
    queryKey: adExchangeKeys.allocations(params),
    queryFn: () => getAllocations(params),
    staleTime: 60 * 1000,
  });
}

export function useAdListings(params?: { status?: string; type?: string }) {
  return useQuery<MarketListing[]>({
    queryKey: adExchangeKeys.listings(params),
    queryFn: () => getListings(params),
    staleTime: 60 * 1000,
  });
}

export function useAdPayments(params?: {
  status?: string;
  type?: string;
  adSpaceId?: string;
  allocationId?: string;
}) {
  return useQuery<AdPayment[]>({
    queryKey: adExchangeKeys.payments(params),
    queryFn: () => getPayments(params),
    staleTime: 60 * 1000,
  });
}

export function useAdExchangeSummary() {
  return useQuery<AdExchangeSummary>({
    queryKey: adExchangeKeys.summary(),
    queryFn: getSummary,
    staleTime: 60 * 1000,
  });
}

export function useAdPerformance(params?: { adSpaceId?: string; allocationId?: string; rangeDays?: number }) {
  return useQuery<PerformanceMetric[]>({
    queryKey: adExchangeKeys.performance(params),
    queryFn: () => getPerformance(params),
    staleTime: 60 * 1000,
  });
}

export function useAdSpacePriceHistory(id?: string) {
  return useQuery<AdSpacePricePoint[]>({
    queryKey: adExchangeKeys.priceHistory(id),
    queryFn: () => getAdSpacePriceHistory(id!),
    enabled: !!id,
    staleTime: 60 * 1000,
  });
}

export function useMarketSnapshot() {
  return useQuery<MarketSnapshot>({
    queryKey: adExchangeKeys.snapshot(),
    queryFn: getMarketSnapshot,
    staleTime: 60 * 1000,
  });
}

export function useMarketAnomalies() {
  return useQuery<MarketAnomaly[]>({
    queryKey: adExchangeKeys.anomalies(),
    queryFn: getMarketAnomalies,
    staleTime: 60 * 1000,
  });
}

export function useMarketValuations() {
  return useQuery<MarketValuation[]>({
    queryKey: adExchangeKeys.valuations(),
    queryFn: getMarketValuations,
    staleTime: 60 * 1000,
  });
}

export function useMarketOpportunities(discount?: number) {
  return useQuery<MarketOpportunity[]>({
    queryKey: adExchangeKeys.opportunities(discount),
    queryFn: () => getMarketOpportunities(discount),
    staleTime: 60 * 1000,
  });
}

export function useAllocationRoi(allocationId?: string) {
  return useQuery<RoiResult>({
    queryKey: adExchangeKeys.roi(allocationId),
    queryFn: () => getAllocationRoi(allocationId!),
    enabled: !!allocationId,
    staleTime: 60 * 1000,
  });
}

export function useAdSpaceYield(adSpaceId?: string) {
  return useQuery<YieldResult>({
    queryKey: adExchangeKeys.yield(adSpaceId),
    queryFn: () => getAdSpaceYield(adSpaceId!),
    enabled: !!adSpaceId,
    staleTime: 60 * 1000,
  });
}

export function useMarketActivity(adSpaceId?: string) {
  return useQuery<MarketActivitySummary>({
    queryKey: adExchangeKeys.marketActivity(adSpaceId),
    queryFn: () => getMarketActivity(adSpaceId),
    staleTime: 60 * 1000,
  });
}

export function useLiquidityRecommendations(max?: number) {
  return useQuery<LiquidityRecommendation[]>({
    queryKey: adExchangeKeys.liquidity(max),
    queryFn: () => getLiquidityRecommendations(max),
    staleTime: 60 * 1000,
  });
}

export function useOwnershipTransfers(params?: { adSpaceId?: string; allocationId?: string }) {
  return useQuery<OwnershipTransfer[]>({
    queryKey: adExchangeKeys.transfers(params),
    queryFn: () => getTransfers(params),
    staleTime: 60 * 1000,
  });
}

export function useUserAds(address?: string) {
  return useQuery<{ adSpaces: AdSpace[]; allocations: AdvertiserAllocation[] }>({
    queryKey: adExchangeKeys.userAds(address),
    queryFn: () => getUserAds(address!),
    enabled: !!address,
    staleTime: 60 * 1000,
  });
}

export function useUserStats(address?: string) {
  return useQuery<{ ownedSpaces: number; ownedAllocations: number; totalPaid: number }>({
    queryKey: adExchangeKeys.userStats(address),
    queryFn: () => getUserStats(address!),
    enabled: !!address,
    staleTime: 60 * 1000,
  });
}

export function useModerationQueue(status = 'pending', adminToken?: string) {
  return useQuery<AdvertiserAllocation[]>({
    queryKey: [...adExchangeKeys.moderation(status), adminToken] as const,
    queryFn: () => getModerationQueue(status, adminToken),
    staleTime: 60 * 1000,
  });
}

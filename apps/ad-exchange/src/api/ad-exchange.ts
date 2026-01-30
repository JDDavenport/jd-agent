import apiClient from './client';
import type {
  AdExchangeSummary,
  AdPayment,
  AdSpace,
  AdSpacePricePoint,
  AdSpaceFilters,
  AdvertiserAllocation,
  MarketListing,
  MarketActivitySummary,
  MarketSnapshot,
  MarketAnomaly,
  MarketValuation,
  MarketOpportunity,
  LiquidityRecommendation,
  PerformanceMetric,
  RoiResult,
  YieldResult,
  OwnershipTransfer,
} from '../types/ad-exchange';

export async function getAdSpaces(filters?: AdSpaceFilters): Promise<AdSpace[]> {
  return apiClient.get('/ad-exchange/ad-spaces', { params: filters });
}

export async function getAdSpace(id: string): Promise<{ adSpace: AdSpace; allocations: AdvertiserAllocation[] }> {
  return apiClient.get(`/ad-exchange/ad-spaces/${id}`);
}

export async function createAdSpace(payload: Partial<AdSpace>): Promise<AdSpace> {
  return apiClient.post('/ad-exchange/ad-spaces', payload);
}

export async function updateAdSpace(id: string, payload: Partial<AdSpace>): Promise<AdSpace> {
  return apiClient.patch(`/ad-exchange/ad-spaces/${id}`, payload);
}

export async function getAdSpacePriceHistory(id: string): Promise<AdSpacePricePoint[]> {
  return apiClient.get(`/ad-exchange/ad-spaces/${id}/price-history`);
}

export async function getAllocations(params?: {
  adSpaceId?: string;
  owner?: string;
  active?: boolean;
  moderationStatus?: string;
  limit?: number;
  offset?: number;
}): Promise<AdvertiserAllocation[]> {
  return apiClient.get('/ad-exchange/allocations', { params });
}

export async function createAllocation(adSpaceId: string, payload: Partial<AdvertiserAllocation>) {
  return apiClient.post(`/ad-exchange/ad-spaces/${adSpaceId}/allocations`, payload);
}

export async function getListings(params?: {
  status?: string;
  type?: string;
}): Promise<MarketListing[]> {
  return apiClient.get('/ad-exchange/listings', { params });
}

export async function createListing(payload: Partial<MarketListing>) {
  return apiClient.post('/ad-exchange/listings', payload);
}

export async function buyListing(listingId: string, payload: { buyerAddress: string; purchasePrice: number }) {
  return apiClient.post(`/ad-exchange/listings/${listingId}/buy`, payload);
}

export async function getPayments(params?: {
  status?: string;
  type?: string;
  adSpaceId?: string;
  allocationId?: string;
}): Promise<AdPayment[]> {
  return apiClient.get('/ad-exchange/payments', { params });
}

export async function getUserAds(address: string): Promise<{ adSpaces: AdSpace[]; allocations: AdvertiserAllocation[] }> {
  return apiClient.get(`/ad-exchange/user/${address}/ads`);
}

export async function getUserStats(address: string): Promise<{ ownedSpaces: number; ownedAllocations: number; totalPaid: number }> {
  return apiClient.get(`/ad-exchange/user/${address}/stats`);
}

export async function getModerationQueue(
  status = 'pending',
  adminToken?: string
): Promise<AdvertiserAllocation[]> {
  return apiClient.get('/ad-exchange/admin/allocations', {
    params: { status },
    headers: adminToken ? { 'x-admin-token': adminToken } : undefined,
  });
}

export async function updateModeration(
  id: string,
  payload: { moderationStatus: string; moderationReason?: string },
  adminToken?: string
): Promise<AdvertiserAllocation> {
  return apiClient.patch(`/ad-exchange/admin/allocations/${id}`, payload, {
    headers: adminToken ? { 'x-admin-token': adminToken } : undefined,
  });
}

export async function createPayment(payload: Partial<AdPayment>) {
  return apiClient.post('/ad-exchange/payments', payload);
}

export async function getTransfers(params?: { adSpaceId?: string; allocationId?: string }): Promise<OwnershipTransfer[]> {
  return apiClient.get('/ad-exchange/transfers', { params });
}

export async function getSummary(): Promise<AdExchangeSummary> {
  return apiClient.get('/ad-exchange/metrics/summary');
}

export async function getPerformance(params?: {
  adSpaceId?: string;
  allocationId?: string;
  rangeDays?: number;
}): Promise<PerformanceMetric[]> {
  return apiClient.get('/ad-exchange/performance', { params });
}

export async function getAllocationRoi(id: string): Promise<RoiResult> {
  return apiClient.get(`/ad-exchange/metrics/roi/allocation/${id}`);
}

export async function getAdSpaceYield(id: string): Promise<YieldResult> {
  return apiClient.get(`/ad-exchange/metrics/yield/ad-space/${id}`);
}

export async function getMarketActivity(adSpaceId?: string): Promise<MarketActivitySummary> {
  return apiClient.get('/ad-exchange/metrics/market-activity', {
    params: adSpaceId ? { adSpaceId } : undefined,
  });
}

export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  return apiClient.get('/ad-exchange/intelligence/snapshot');
}

export async function getMarketAnomalies(): Promise<MarketAnomaly[]> {
  return apiClient.get('/ad-exchange/intelligence/anomalies');
}

export async function getMarketValuations(): Promise<MarketValuation[]> {
  return apiClient.get('/ad-exchange/intelligence/valuations');
}

export async function getMarketOpportunities(discount?: number): Promise<MarketOpportunity[]> {
  return apiClient.get('/ad-exchange/intelligence/opportunities', {
    params: discount ? { discount } : undefined,
  });
}

export async function getLiquidityRecommendations(max?: number): Promise<LiquidityRecommendation[]> {
  return apiClient.get('/ad-exchange/liquidity/recommendations', {
    params: max ? { max } : undefined,
  });
}

export async function exportAdExchangeData() {
  return apiClient.get('/ad-exchange/export');
}

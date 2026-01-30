export interface AdSpace {
  id: string;
  creatorAddress: string;
  currentOwnerAddress: string;
  previousOwnerAddress?: string;
  weeklyImpressions: number;
  currentReservePrice: number;
  ownershipTransferPrice?: number;
  weeklyHoldingFee: number;
  creatorSaleSharePercent: number;
  creatorFeeSharePercent: number;
  customContractTerms?: Record<string, unknown>;
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  isActive: boolean;
  isAdultAllowed?: boolean;
  createdAt: string;
  ownershipAcquiredAt?: string;
  lastPaymentAt?: string;
  nextPaymentDue?: string;
}

export interface AdvertiserAllocation {
  id: string;
  adSpaceId: string;
  currentOwnerAddress: string;
  previousOwnerAddress?: string;
  allocationUnits: number;
  impressionsPerWeek: number;
  acquisitionPrice?: number;
  weeklyFee: number;
  creativeAssetUrls?: string[];
  clickThroughUrl?: string;
  contentCategory?: string;
  isAdult?: boolean;
  moderationStatus?: string;
  moderationReason?: string;
  flaggedAt?: string;
  isActive: boolean;
  createdAt: string;
  allocationAcquiredAt?: string;
  lastPaymentAt?: string;
  nextPaymentDue?: string;
}

export interface MarketListing {
  id: string;
  listingType: 'ad_space' | 'allocation';
  adSpaceId?: string;
  allocationId?: string;
  sellerAddress: string;
  askPrice: number;
  minPrice?: number;
  status: 'active' | 'sold' | 'cancelled' | 'expired';
  listedAt: string;
  expiresAt?: string;
  soldAt?: string;
}

export interface AdPayment {
  id: string;
  paymentType: 'ad_space_ownership' | 'ad_space_weekly_fee' | 'allocation_acquisition' | 'allocation_weekly_fee';
  adSpaceId?: string;
  allocationId?: string;
  payerAddress: string;
  amount: number;
  transactionHash?: string;
  revenueDistribution?: Record<string, number>;
  status: 'pending' | 'completed' | 'failed' | 'reverted';
  dueDate: string;
  paidAt?: string;
  createdAt: string;
}

export interface OwnershipTransfer {
  id: string;
  transferType: 'ad_space' | 'allocation';
  adSpaceId?: string;
  allocationId?: string;
  fromAddress: string;
  toAddress: string;
  transferPrice?: number;
  reason: 'sale' | 'non_payment_reversion' | 'initial_creation';
  transactionHash?: string;
  createdAt: string;
}

export interface PerformanceMetric {
  id: string;
  adSpaceId?: string;
  allocationId?: string;
  periodStart: string;
  periodEnd: string;
  impressionsDelivered: number;
  clicks: number;
  ctr?: number;
  revenueGenerated?: number;
  createdAt: string;
}

export interface AdExchangeSummary {
  totalAdSpaces: number;
  activeAdSpaces: number;
  totalAllocations: number;
  activeListings: number;
  weeklyRevenue: number;
  averageCtr: number;
  paymentComplianceRate: number;
}

export interface RoiResult {
  revenue: number;
  cost: number;
  roi: number;
}

export interface YieldResult {
  weeklyRevenue: number;
  reservePrice: number;
  weeklyYieldPercent: number;
}

export interface MarketActivitySummary {
  activeListings: number;
  recentTransfers: number;
  weeklyVolume: number;
  averageAskPrice: number;
}

export interface MarketSnapshot {
  totalAdSpaces: number;
  activeAdSpaces: number;
  activeAllocations: number;
  averageReservePrice: number;
  weeklyTransactionVolume: number;
  topCategories: { category: string; count: number }[];
}

export interface MarketAnomaly {
  type: 'pricing' | 'performance';
  adSpaceId: string;
  message: string;
}

export interface MarketValuation {
  adSpaceId: string;
  estimatedPrice: number;
}

export interface MarketOpportunity {
  adSpaceId: string;
  currentReservePrice: number;
  estimatedPrice: number;
  discountPercent: number;
}

export interface LiquidityRecommendation {
  adSpaceId: string;
  suggestedBid: number;
  discountPercent: number;
}

export interface AdSpacePricePoint {
  id: string;
  adSpaceId: string;
  priceType: string;
  price: number;
  recordedAt: string;
  metadata?: Record<string, unknown>;
}

export interface AdSpaceFilters {
  search?: string;
  category?: string;
  active?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Ad Exchange Liquidity Service
 *
 * Generates liquidity recommendations for market making.
 */

import { adExchangeMarketIntelligenceService } from './ad-exchange-market-intelligence-service';

export interface LiquidityRecommendation {
  adSpaceId: string;
  suggestedBid: number;
  discountPercent: number;
}

class AdExchangeLiquidityService {
  async getRecommendations(max = 5): Promise<LiquidityRecommendation[]> {
    const opportunities = await adExchangeMarketIntelligenceService.findUnderpricedSpaces();
    return opportunities.slice(0, max).map((opp) => ({
      adSpaceId: opp.adSpaceId,
      suggestedBid: Number((opp.currentReservePrice * 1.05).toFixed(2)),
      discountPercent: opp.discountPercent,
    }));
  }
}

export const adExchangeLiquidityService = new AdExchangeLiquidityService();

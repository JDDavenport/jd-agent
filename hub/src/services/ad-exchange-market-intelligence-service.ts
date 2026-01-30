/**
 * Ad Exchange Market Intelligence Service
 *
 * Provides market snapshots, anomaly detection, and valuations.
 */

import { and, desc, eq, gt, sql, isNotNull } from 'drizzle-orm';
import { db } from '../db/client';
import { adSpaces, advertiserAllocations, performanceMetrics, adPayments } from '../db/schema';

export interface MarketSnapshot {
  totalAdSpaces: number;
  activeAdSpaces: number;
  activeAllocations: number;
  averageReservePrice: number;
  weeklyTransactionVolume: number;
  topCategories: { category: string; count: number }[];
}

export interface Anomaly {
  type: 'pricing' | 'performance';
  adSpaceId: string;
  message: string;
}

export interface Valuation {
  adSpaceId: string;
  estimatedPrice: number;
}

export interface UnderpricedOpportunity {
  adSpaceId: string;
  currentReservePrice: number;
  estimatedPrice: number;
  discountPercent: number;
}

class AdExchangeMarketIntelligenceService {
  async getSnapshot(): Promise<MarketSnapshot> {
    const [totals] = await db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where ${adSpaces.isActive} = true)`,
        avgReserve: sql<number>`coalesce(avg(${adSpaces.currentReservePrice}), 0)`,
      })
      .from(adSpaces);

    const [allocations] = await db
      .select({
        active: sql<number>`count(*) filter (where ${advertiserAllocations.isActive} = true)`,
      })
      .from(advertiserAllocations);

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [volumeRow] = await db
      .select({
        volume: sql<number>`coalesce(sum(${adPayments.amount}), 0)`,
      })
      .from(adPayments)
      .where(and(eq(adPayments.status, 'completed'), gt(adPayments.paidAt, oneWeekAgo)));

    const topCategories = await db
      .select({
        category: adSpaces.category,
        count: sql<number>`count(*)`,
      })
      .from(adSpaces)
      .where(isNotNull(adSpaces.category))
      .groupBy(adSpaces.category)
      .orderBy(desc(sql<number>`count(*)`))
      .limit(6);

    return {
      totalAdSpaces: Number(totals?.total || 0),
      activeAdSpaces: Number(totals?.active || 0),
      activeAllocations: Number(allocations?.active || 0),
      averageReservePrice: Number(totals?.avgReserve || 0),
      weeklyTransactionVolume: Number(volumeRow?.volume || 0),
      topCategories: topCategories
        .filter((row) => row.category)
        .map((row) => ({ category: row.category as string, count: Number(row.count || 0) })),
    };
  }

  async detectAnomalies(): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    const [priceStats] = await db
      .select({
        avg: sql<number>`coalesce(avg(${adSpaces.currentReservePrice}), 0)`,
        stddev: sql<number>`coalesce(stddev_pop(${adSpaces.currentReservePrice}), 0)`,
      })
      .from(adSpaces);

    const highPriceThreshold = Number(priceStats?.avg || 0) + 3 * Number(priceStats?.stddev || 0);
    if (highPriceThreshold > 0) {
      const overpriced = await db
        .select({ id: adSpaces.id, price: adSpaces.currentReservePrice })
        .from(adSpaces)
        .where(gt(adSpaces.currentReservePrice, highPriceThreshold));

      for (const space of overpriced) {
        anomalies.push({
          type: 'pricing',
          adSpaceId: space.id,
          message: `Reserve price unusually high: ${space.price}`,
        });
      }
    }

    const highCtr = await db
      .select({
        adSpaceId: performanceMetrics.adSpaceId,
        ctr: performanceMetrics.ctr,
      })
      .from(performanceMetrics)
      .where(and(isNotNull(performanceMetrics.adSpaceId), gt(performanceMetrics.ctr, 0.25)));

    for (const metric of highCtr) {
      if (!metric.adSpaceId) continue;
      anomalies.push({
        type: 'performance',
        adSpaceId: metric.adSpaceId,
        message: `CTR unusually high: ${metric.ctr}`,
      });
    }

    return anomalies;
  }

  async estimateValuations(): Promise<Valuation[]> {
    const spaces = await db.select().from(adSpaces);
    const valuations: Valuation[] = [];

    for (const space of spaces) {
      const [latestMetric] = await db
        .select({
          ctr: performanceMetrics.ctr,
          revenue: performanceMetrics.revenueGenerated,
        })
        .from(performanceMetrics)
        .where(eq(performanceMetrics.adSpaceId, space.id))
        .orderBy(desc(performanceMetrics.periodEnd))
        .limit(1);

      const ctr = Number(latestMetric?.ctr || 0.01);
      const weeklyRevenue = Number(latestMetric?.revenue || 0);
      const estimated = weeklyRevenue > 0
        ? weeklyRevenue * 12
        : Number(space.weeklyImpressions) * ctr * 0.01;

      valuations.push({
        adSpaceId: space.id,
        estimatedPrice: Number(estimated.toFixed(2)),
      });
    }

    return valuations;
  }

  async findUnderpricedSpaces(discountThreshold = 0.25): Promise<UnderpricedOpportunity[]> {
    const valuations = await this.estimateValuations();
    if (valuations.length === 0) return [];

    const spaces = await db.select().from(adSpaces);
    const valuationMap = new Map(valuations.map((v) => [v.adSpaceId, v.estimatedPrice]));

    return spaces
      .map((space) => {
        const estimated = valuationMap.get(space.id);
        if (!estimated) return null;
        const current = Number(space.currentReservePrice);
        if (estimated <= 0) return null;
        const discount = 1 - current / estimated;
        if (discount < discountThreshold) return null;
        return {
          adSpaceId: space.id,
          currentReservePrice: current,
          estimatedPrice: estimated,
          discountPercent: Number((discount * 100).toFixed(2)),
        };
      })
      .filter((value): value is UnderpricedOpportunity => value !== null);
  }
}

export const adExchangeMarketIntelligenceService = new AdExchangeMarketIntelligenceService();

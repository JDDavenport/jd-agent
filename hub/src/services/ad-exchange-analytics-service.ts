/**
 * Ad Exchange Analytics & Insights Service
 */

import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '../db/client';
import {
  adSpaces,
  advertiserAllocations,
  performanceMetrics,
  adPayments,
  marketListings,
  ownershipTransfers,
} from '../db/schema';

export interface AdExchangeSummaryMetrics {
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

class AdExchangeAnalyticsService {
  async getSummary(): Promise<AdExchangeSummaryMetrics> {
    const [spaces] = await db
      .select({
        total: sql<number>`count(*)`,
        active: sql<number>`count(*) filter (where ${adSpaces.isActive} = true)`,
      })
      .from(adSpaces);

    const [allocations] = await db
      .select({
        total: sql<number>`count(*)`,
      })
      .from(advertiserAllocations);

    const [listings] = await db
      .select({
        active: sql<number>`count(*) filter (where ${marketListings.status} = 'active')`,
      })
      .from(marketListings);

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [payments] = await db
      .select({
        revenue: sql<number>`coalesce(sum(${adPayments.amount}), 0)`,
      })
      .from(adPayments)
      .where(and(eq(adPayments.status, 'completed'), gte(adPayments.paidAt, weekAgo)));

    const [ctrRow] = await db
      .select({
        avgCtr: sql<number>`coalesce(avg(${performanceMetrics.ctr}), 0)`,
      })
      .from(performanceMetrics);

    const [paymentCounts] = await db
      .select({
        total: sql<number>`count(*)`,
        completed: sql<number>`count(*) filter (where ${adPayments.status} = 'completed')`,
      })
      .from(adPayments);

    const totalPayments = Number(paymentCounts?.total || 0);
    const compliance = totalPayments > 0 ? Number(paymentCounts?.completed || 0) / totalPayments : 1;

    return {
      totalAdSpaces: Number(spaces?.total || 0),
      activeAdSpaces: Number(spaces?.active || 0),
      totalAllocations: Number(allocations?.total || 0),
      activeListings: Number(listings?.active || 0),
      weeklyRevenue: Number(payments?.revenue || 0),
      averageCtr: Number(ctrRow?.avgCtr || 0),
      paymentComplianceRate: Number(compliance.toFixed(4)),
    };
  }

  async getAdSpacePerformance(adSpaceId: string, rangeDays?: number) {
    const cutoff = rangeDays ? new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000) : undefined;
    const metrics = await db
      .select()
      .from(performanceMetrics)
      .where(
        cutoff
          ? and(eq(performanceMetrics.adSpaceId, adSpaceId), gte(performanceMetrics.periodEnd, cutoff))
          : eq(performanceMetrics.adSpaceId, adSpaceId)
      )
      .orderBy(desc(performanceMetrics.periodEnd));

    return metrics;
  }

  async getAllocationPerformance(allocationId: string, rangeDays?: number) {
    const cutoff = rangeDays ? new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000) : undefined;
    const metrics = await db
      .select()
      .from(performanceMetrics)
      .where(
        cutoff
          ? and(eq(performanceMetrics.allocationId, allocationId), gte(performanceMetrics.periodEnd, cutoff))
          : eq(performanceMetrics.allocationId, allocationId)
      )
      .orderBy(desc(performanceMetrics.periodEnd));

    return metrics;
  }

  async getAllocationRoi(allocationId: string): Promise<RoiResult> {
    const [revenueRow] = await db
      .select({
        revenue: sql<number>`coalesce(sum(${performanceMetrics.revenueGenerated}), 0)`,
      })
      .from(performanceMetrics)
      .where(eq(performanceMetrics.allocationId, allocationId));

    const [costRow] = await db
      .select({
        cost: sql<number>`coalesce(sum(${adPayments.amount}), 0)`,
      })
      .from(adPayments)
      .where(eq(adPayments.allocationId, allocationId));

    const revenue = Number(revenueRow?.revenue || 0);
    const cost = Number(costRow?.cost || 0);
    const roi = cost > 0 ? (revenue - cost) / cost : 0;

    return { revenue, cost, roi };
  }

  async getAdSpaceYield(adSpaceId: string): Promise<YieldResult> {
    const [space] = await db.select().from(adSpaces).where(eq(adSpaces.id, adSpaceId)).limit(1);
    if (!space) {
      return { weeklyRevenue: 0, reservePrice: 0, weeklyYieldPercent: 0 };
    }

    const [revenueRow] = await db
      .select({
        revenue: sql<number>`coalesce(sum(${performanceMetrics.revenueGenerated}), 0)`,
      })
      .from(performanceMetrics)
      .where(eq(performanceMetrics.adSpaceId, adSpaceId));

    const weeklyRevenue = Number(revenueRow?.revenue || 0);
    const reservePrice = Number(space.currentReservePrice || 0);
    const weeklyYieldPercent = reservePrice > 0 ? (weeklyRevenue / reservePrice) * 100 : 0;

    return { weeklyRevenue, reservePrice, weeklyYieldPercent };
  }

  async getMarketActivity(adSpaceId?: string): Promise<MarketActivitySummary> {
    const listingWhere = adSpaceId ? eq(marketListings.adSpaceId, adSpaceId) : undefined;
    const [listings] = await db
      .select({
        active: sql<number>`count(*) filter (where ${marketListings.status} = 'active')`,
        avgAsk: sql<number>`coalesce(avg(${marketListings.askPrice}), 0)`,
      })
      .from(marketListings)
      .where(listingWhere);

    const transfersWhere = adSpaceId ? eq(ownershipTransfers.adSpaceId, adSpaceId) : undefined;
    const [transfers] = await db
      .select({ count: sql<number>`count(*)` })
      .from(ownershipTransfers)
      .where(transfersWhere);

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const volumeWhere = adSpaceId ? eq(adPayments.adSpaceId, adSpaceId) : undefined;
    const [volume] = await db
      .select({ sum: sql<number>`coalesce(sum(${adPayments.amount}), 0)` })
      .from(adPayments)
      .where(volumeWhere ? and(volumeWhere, gte(adPayments.paidAt, weekAgo)) : gte(adPayments.paidAt, weekAgo));

    return {
      activeListings: Number(listings?.active || 0),
      recentTransfers: Number(transfers?.count || 0),
      weeklyVolume: Number(volume?.sum || 0),
      averageAskPrice: Number(listings?.avgAsk || 0),
    };
  }
}

export const adExchangeAnalyticsService = new AdExchangeAnalyticsService();

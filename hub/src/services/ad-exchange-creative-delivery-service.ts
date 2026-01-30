/**
 * Ad Exchange Creative & Delivery Service
 */

import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { adSpaces, advertiserAllocations, performanceMetrics } from '../db/schema';

export interface CreativeValidationResult {
  valid: boolean;
  reasons: string[];
}

class AdExchangeCreativeDeliveryService {
  validateCreativeAssets(urls?: string[], clickThroughUrl?: string): CreativeValidationResult {
    const reasons: string[] = [];

    if (!urls || urls.length === 0) {
      reasons.push('At least one creative asset URL is required.');
    } else {
      for (const url of urls) {
        if (!/^https?:\/\//i.test(url)) {
          reasons.push(`Invalid asset URL: ${url}`);
        }
      }
    }

    if (clickThroughUrl && !/^https?:\/\//i.test(clickThroughUrl)) {
      reasons.push('Click-through URL must be http or https.');
    }

    return { valid: reasons.length === 0, reasons };
  }

  private getWeekRange(date: Date) {
    const start = new Date(date);
    start.setUTCHours(0, 0, 0, 0);
    const day = start.getUTCDay();
    const diffToMonday = (day + 6) % 7;
    start.setUTCDate(start.getUTCDate() - diffToMonday);

    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    end.setUTCHours(0, 0, 0, 0);

    return { start, end };
  }

  async recordImpression(adSpaceId: string, allocationId?: string) {
    return this.upsertMetric(adSpaceId, allocationId, { impressions: 1, clicks: 0 });
  }

  async recordClick(adSpaceId: string, allocationId?: string) {
    return this.upsertMetric(adSpaceId, allocationId, { impressions: 0, clicks: 1 });
  }

  private async upsertMetric(
    adSpaceId: string,
    allocationId: string | undefined,
    delta: { impressions: number; clicks: number }
  ) {
    const now = new Date();
    const { start, end } = this.getWeekRange(now);

    const [existing] = await db
      .select()
      .from(performanceMetrics)
      .where(
        and(
          eq(performanceMetrics.adSpaceId, adSpaceId),
          allocationId ? eq(performanceMetrics.allocationId, allocationId) : sql`allocation_id is null`,
          gte(performanceMetrics.periodStart, start),
          lte(performanceMetrics.periodEnd, end)
        )
      )
      .limit(1);

    if (!existing) {
      const [created] = await db
        .insert(performanceMetrics)
        .values({
          adSpaceId,
          allocationId,
          periodStart: start,
          periodEnd: end,
          impressionsDelivered: delta.impressions,
          clicks: delta.clicks,
          ctr: delta.impressions > 0 ? delta.clicks / delta.impressions : null,
        })
        .returning();

      return created;
    }

    const impressions = Number(existing.impressionsDelivered || 0) + delta.impressions;
    const clicks = Number(existing.clicks || 0) + delta.clicks;
    const ctr = impressions > 0 ? clicks / impressions : null;

    const [updated] = await db
      .update(performanceMetrics)
      .set({
        impressionsDelivered: impressions,
        clicks,
        ctr,
      })
      .where(eq(performanceMetrics.id, existing.id))
      .returning();

    return updated;
  }

  async computeAllocationImpressions(adSpaceId: string, allocationUnits: number) {
    const [space] = await db.select().from(adSpaces).where(eq(adSpaces.id, adSpaceId)).limit(1);
    if (!space) throw new Error('Ad space not found');

    return Math.floor((Number(space.weeklyImpressions) * allocationUnits) / 8);
  }

  async rotateCreative(allocationId: string) {
    const [allocation] = await db
      .select()
      .from(advertiserAllocations)
      .where(eq(advertiserAllocations.id, allocationId))
      .limit(1);

    if (!allocation || !allocation.creativeAssetUrls || allocation.creativeAssetUrls.length === 0) {
      return null;
    }

    const index = Math.floor(Math.random() * allocation.creativeAssetUrls.length);
    return allocation.creativeAssetUrls[index];
  }

  async detectClickFraud(adSpaceId: string, threshold = 0.35) {
    const { start, end } = this.getWeekRange(new Date());
    const [metric] = await db
      .select()
      .from(performanceMetrics)
      .where(
        and(
          eq(performanceMetrics.adSpaceId, adSpaceId),
          gte(performanceMetrics.periodStart, start),
          lte(performanceMetrics.periodEnd, end)
        )
      )
      .limit(1);

    if (!metric) return { flagged: false, ctr: 0 };
    const ctr = Number(metric.ctr || 0);
    return { flagged: ctr > threshold, ctr };
  }

  selectABVariant(variants: string[]) {
    if (variants.length === 0) return null;
    const index = Math.floor(Math.random() * variants.length);
    return variants[index];
  }
}

export const adExchangeCreativeDeliveryService = new AdExchangeCreativeDeliveryService();

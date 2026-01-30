/**
 * JD Agent - Productivity Service
 *
 * Manages Screen Time data synced from iOS devices.
 * Provides analytics and insights on phone usage patterns.
 *
 * Features:
 * - Ingest Screen Time reports from iOS
 * - Daily/weekly/monthly analytics
 * - Category and app usage breakdowns
 * - Trend analysis and insights
 */

import { db } from '../db/client';
import { screenTimeReports } from '../db/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';
import { getLLMProviderChain } from '../lib/providers';

// ============================================
// Types
// ============================================

export interface AppUsage {
  name: string;
  bundleId?: string;
  minutes: number;
  category: string;
}

export interface ScreenTimeReportInput {
  date: string;            // YYYY-MM-DD
  deviceId: string;
  totalMinutes: number;
  pickupCount?: number;
  notificationCount?: number;
  categoryBreakdown?: Record<string, number>;
  topApps?: AppUsage[];
  hourlyBreakdown?: Array<{ hour: number; minutes: number }>;
  sourceVersion?: string;
}

export interface ScreenTimeReport {
  id: string;
  date: string;
  deviceId: string;
  totalMinutes: number;
  pickupCount: number;
  notificationCount: number;
  categoryBreakdown: Record<string, number>;
  topApps: AppUsage[];
  syncedAt: string;
}

export interface ProductivityStats {
  today: ScreenTimeReport | null;
  weeklyAverage: number;
  monthlyAverage: number;
  topApps: Array<{ name: string; totalMinutes: number; category: string }>;
  trends: Array<{ date: string; minutes: number }>;
  categoryTotals: Record<string, number>;
  insights: string[];
}

export interface DailyComparison {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

// ============================================
// Productivity Service
// ============================================

export class ProductivityService {
  /**
   * Sync a Screen Time report from iOS
   * Upserts based on date + deviceId
   */
  async syncReport(input: ScreenTimeReportInput): Promise<ScreenTimeReport> {
    console.log(`[Productivity] Syncing report for ${input.date} from ${input.deviceId}`);

    const reportDate = new Date(input.date);
    const now = new Date();

    // Check if report already exists
    const existing = await db
      .select()
      .from(screenTimeReports)
      .where(
        and(
          eq(screenTimeReports.reportDate, input.date),
          eq(screenTimeReports.deviceId, input.deviceId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing
      const [updated] = await db
        .update(screenTimeReports)
        .set({
          totalScreenTimeMinutes: input.totalMinutes,
          pickupCount: input.pickupCount || 0,
          notificationCount: input.notificationCount || 0,
          categoryBreakdown: input.categoryBreakdown || {},
          topApps: input.topApps || [],
          hourlyBreakdown: input.hourlyBreakdown || [],
          sourceVersion: input.sourceVersion,
          syncedAt: now,
          updatedAt: now,
        })
        .where(eq(screenTimeReports.id, existing[0].id))
        .returning();

      return this.mapToReport(updated);
    }

    // Insert new
    const [inserted] = await db
      .insert(screenTimeReports)
      .values({
        reportDate: input.date,
        deviceId: input.deviceId,
        totalScreenTimeMinutes: input.totalMinutes,
        pickupCount: input.pickupCount || 0,
        notificationCount: input.notificationCount || 0,
        categoryBreakdown: input.categoryBreakdown || {},
        topApps: input.topApps || [],
        hourlyBreakdown: input.hourlyBreakdown || [],
        sourceVersion: input.sourceVersion,
        syncedAt: now,
      })
      .returning();

    console.log(`[Productivity] Created new report: ${inserted.id}`);
    return this.mapToReport(inserted);
  }

  /**
   * Get today's Screen Time report
   */
  async getToday(deviceId?: string): Promise<ScreenTimeReport | null> {
    const today = new Date().toISOString().split('T')[0];

    let query = db
      .select()
      .from(screenTimeReports)
      .where(eq(screenTimeReports.reportDate, today));

    if (deviceId) {
      query = db
        .select()
        .from(screenTimeReports)
        .where(
          and(
            eq(screenTimeReports.reportDate, today),
            eq(screenTimeReports.deviceId, deviceId)
          )
        );
    }

    const results = await query.limit(1);
    return results.length > 0 ? this.mapToReport(results[0]) : null;
  }

  /**
   * Get productivity stats with trends and insights
   */
  async getStats(deviceId?: string, days: number = 30): Promise<ProductivityStats> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let query = db
      .select()
      .from(screenTimeReports)
      .where(gte(screenTimeReports.reportDate, startDate.toISOString().split('T')[0]))
      .orderBy(desc(screenTimeReports.reportDate));

    if (deviceId) {
      query = db
        .select()
        .from(screenTimeReports)
        .where(
          and(
            gte(screenTimeReports.reportDate, startDate.toISOString().split('T')[0]),
            eq(screenTimeReports.deviceId, deviceId)
          )
        )
        .orderBy(desc(screenTimeReports.reportDate));
    }

    const reports = await query.limit(days);

    // Calculate averages
    const totalMinutes = reports.reduce((sum, r) => sum + (r.totalScreenTimeMinutes || 0), 0);
    const weeklyReports = reports.slice(0, 7);
    const weeklyTotal = weeklyReports.reduce((sum, r) => sum + (r.totalScreenTimeMinutes || 0), 0);

    // Aggregate top apps across all reports
    const appTotals: Record<string, { minutes: number; category: string }> = {};
    const categoryTotals: Record<string, number> = {};

    for (const report of reports) {
      const apps = (report.topApps as AppUsage[]) || [];
      for (const app of apps) {
        if (!appTotals[app.name]) {
          appTotals[app.name] = { minutes: 0, category: app.category };
        }
        appTotals[app.name].minutes += app.minutes;
      }

      const categories = (report.categoryBreakdown as Record<string, number>) || {};
      for (const [cat, mins] of Object.entries(categories)) {
        categoryTotals[cat] = (categoryTotals[cat] || 0) + mins;
      }
    }

    const topApps = Object.entries(appTotals)
      .map(([name, data]) => ({ name, totalMinutes: data.minutes, category: data.category }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes)
      .slice(0, 10);

    // Build trends
    const trends = reports.map(r => ({
      date: r.reportDate as unknown as string,
      minutes: r.totalScreenTimeMinutes || 0,
    })).reverse();

    // Get today's report
    const todayReport = await this.getToday(deviceId);

    // Generate insights
    const insights = await this.generateInsights(reports, topApps, categoryTotals);

    return {
      today: todayReport,
      weeklyAverage: weeklyReports.length > 0 ? Math.round(weeklyTotal / weeklyReports.length) : 0,
      monthlyAverage: reports.length > 0 ? Math.round(totalMinutes / reports.length) : 0,
      topApps,
      trends,
      categoryTotals,
      insights,
    };
  }

  /**
   * Get daily comparison (today vs yesterday or previous period)
   */
  async getDailyComparison(deviceId?: string): Promise<DailyComparison> {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const [todayReport, yesterdayReport] = await Promise.all([
      this.getReportByDate(today, deviceId),
      this.getReportByDate(yesterdayStr, deviceId),
    ]);

    const current = todayReport?.totalMinutes || 0;
    const previous = yesterdayReport?.totalMinutes || 0;
    const change = current - previous;
    const changePercent = previous > 0 ? Math.round((change / previous) * 100) : 0;

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (change > 10) trend = 'up';
    else if (change < -10) trend = 'down';

    return { current, previous, change, changePercent, trend };
  }

  /**
   * Get historical reports for a date range
   */
  async getHistory(
    startDate: string,
    endDate: string,
    deviceId?: string
  ): Promise<ScreenTimeReport[]> {
    let query = db
      .select()
      .from(screenTimeReports)
      .where(
        and(
          gte(screenTimeReports.reportDate, startDate),
          lte(screenTimeReports.reportDate, endDate)
        )
      )
      .orderBy(desc(screenTimeReports.reportDate));

    if (deviceId) {
      query = db
        .select()
        .from(screenTimeReports)
        .where(
          and(
            gte(screenTimeReports.reportDate, startDate),
            lte(screenTimeReports.reportDate, endDate),
            eq(screenTimeReports.deviceId, deviceId)
          )
        )
        .orderBy(desc(screenTimeReports.reportDate));
    }

    const reports = await query.limit(100);
    return reports.map(r => this.mapToReport(r));
  }

  // ============================================
  // Private Methods
  // ============================================

  private async getReportByDate(date: string, deviceId?: string): Promise<ScreenTimeReport | null> {
    let query = db
      .select()
      .from(screenTimeReports)
      .where(eq(screenTimeReports.reportDate, date));

    if (deviceId) {
      query = db
        .select()
        .from(screenTimeReports)
        .where(
          and(
            eq(screenTimeReports.reportDate, date),
            eq(screenTimeReports.deviceId, deviceId)
          )
        );
    }

    const results = await query.limit(1);
    return results.length > 0 ? this.mapToReport(results[0]) : null;
  }

  private mapToReport(row: typeof screenTimeReports.$inferSelect): ScreenTimeReport {
    return {
      id: row.id,
      date: row.reportDate as unknown as string,
      deviceId: row.deviceId,
      totalMinutes: row.totalScreenTimeMinutes || 0,
      pickupCount: row.pickupCount || 0,
      notificationCount: row.notificationCount || 0,
      categoryBreakdown: (row.categoryBreakdown as Record<string, number>) || {},
      topApps: (row.topApps as AppUsage[]) || [],
      syncedAt: row.syncedAt.toISOString(),
    };
  }

  private async generateInsights(
    reports: (typeof screenTimeReports.$inferSelect)[],
    topApps: Array<{ name: string; totalMinutes: number; category: string }>,
    categoryTotals: Record<string, number>
  ): Promise<string[]> {
    if (reports.length === 0) return [];

    const insights: string[] = [];

    // Calculate basic insights
    const avgMinutes = reports.reduce((sum, r) => sum + (r.totalScreenTimeMinutes || 0), 0) / reports.length;
    const avgHours = Math.round(avgMinutes / 60 * 10) / 10;

    insights.push(`Average daily screen time: ${avgHours} hours`);

    // Top category
    const sortedCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1]);
    if (sortedCategories.length > 0) {
      const [topCat, topMins] = sortedCategories[0];
      insights.push(`Most used category: ${topCat} (${Math.round(topMins / 60)} hours total)`);
    }

    // Top app
    if (topApps.length > 0) {
      insights.push(`Most used app: ${topApps[0].name} (${Math.round(topApps[0].totalMinutes / 60)} hours total)`);
    }

    // Pickup count trend
    const avgPickups = reports.reduce((sum, r) => sum + (r.pickupCount || 0), 0) / reports.length;
    if (avgPickups > 0) {
      insights.push(`Average daily pickups: ${Math.round(avgPickups)}`);
    }

    // Try to generate AI insight
    try {
      const aiInsight = await this.generateAIInsight(reports, topApps, categoryTotals);
      if (aiInsight) {
        insights.push(aiInsight);
      }
    } catch (error) {
      console.error('[Productivity] AI insight generation failed:', error);
    }

    return insights;
  }

  private async generateAIInsight(
    reports: (typeof screenTimeReports.$inferSelect)[],
    topApps: Array<{ name: string; totalMinutes: number; category: string }>,
    categoryTotals: Record<string, number>
  ): Promise<string | null> {
    try {
      const llm = getLLMProviderChain();

      const recentTrend = reports.slice(0, 7).map(r => ({
        date: r.reportDate,
        minutes: r.totalScreenTimeMinutes,
        pickups: r.pickupCount,
      }));

      const prompt = `Analyze this phone usage data and provide ONE brief, actionable insight (1 sentence max):

Recent 7 days: ${JSON.stringify(recentTrend)}
Top apps: ${topApps.slice(0, 3).map(a => `${a.name} (${a.minutes}min, ${a.category})`).join(', ')}
Category totals: ${JSON.stringify(categoryTotals)}

Focus on patterns, improvements, or areas of concern. Be specific and actionable.`;

      const response = await llm.chat({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a productivity coach. Give brief, actionable insights.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 100,
      });

      return response.content || null;
    } catch (error) {
      return null;
    }
  }
}

// ============================================
// Singleton instance
// ============================================

export const productivityService = new ProductivityService();

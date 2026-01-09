/**
 * JD Agent - Time Tracking Service
 * 
 * Phase 3: Screen time and productivity tracking
 * 
 * Features:
 * - Import Screen Time data (iOS/Mac)
 * - Categorize apps as productive/waste/neutral
 * - Track time waste trends
 * - Alert on excessive waste
 */

import { db } from '../db/client';
import { timeTracking, tasks } from '../db/schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';

// ============================================
// Types
// ============================================

export interface ScreenTimeEntry {
  appName: string;
  bundleId?: string;
  categoryName?: string;
  totalMinutes: number;
  date: Date;
}

export interface AppCategory {
  bundleId: string;
  appName: string;
  category: 'productive' | 'neutral' | 'waste';
}

export interface DailyTimeReport {
  date: string;
  totalScreenTimeMinutes: number;
  productiveMinutes: number;
  wasteMinutes: number;
  neutralMinutes: number;
  appBreakdown: Record<string, number>;
  categoryBreakdown: {
    productive: number;
    waste: number;
    neutral: number;
  };
  tasksPlanned: number;
  tasksCompleted: number;
}

export interface WeeklyTimeTrend {
  weekStart: Date;
  weekEnd: Date;
  averageDailyWaste: number;
  totalWaste: number;
  trend: 'improving' | 'stable' | 'worsening';
  comparisonToPreviousWeek: number; // percentage change
  worstApps: Array<{ name: string; minutes: number }>;
}

// ============================================
// Default App Categories
// ============================================

const DEFAULT_WASTE_APPS = [
  'com.riotgames.teamfighttactics',
  'TFT',
  'com.google.ios.youtube',
  'YouTube',
  'com.reddit.Reddit',
  'Reddit',
  'com.twitter.twitter',
  'X',
  'com.atebits.Tweetie2',
  'com.burbn.instagram',
  'Instagram',
  'com.facebook.Facebook',
  'Facebook',
  'TikTok',
  'com.zhiliaoapp.musically',
  'Netflix',
  'com.netflix.Netflix',
  'Twitch',
  'tv.twitch',
];

const DEFAULT_PRODUCTIVE_APPS = [
  'com.apple.Notes',
  'Notes',
  'com.notion.id',
  'Notion',
  'Obsidian',
  'com.apple.iWork.Pages',
  'Pages',
  'com.apple.iWork.Numbers',
  'Numbers',
  'com.microsoft.Word',
  'Word',
  'com.microsoft.Excel',
  'Excel',
  'com.microsoft.VSCode',
  'Visual Studio Code',
  'com.apple.dt.Xcode',
  'Xcode',
  'Cursor',
  'Terminal',
  'com.apple.Terminal',
  'iTerm',
  'com.googlecode.iterm2',
  'Slack',
  'com.tinyspeck.slackmacgap',
  'Zoom',
  'us.zoom.xos',
  'Canvas',
  'com.instructure.icanvas',
  'Linear',
  'com.linear',
];

// ============================================
// Time Tracking Service
// ============================================

class TimeTrackingService {
  private appCategories: Map<string, 'productive' | 'neutral' | 'waste'> = new Map();

  constructor() {
    this.initializeDefaultCategories();
  }

  private initializeDefaultCategories() {
    for (const app of DEFAULT_WASTE_APPS) {
      this.appCategories.set(app.toLowerCase(), 'waste');
    }
    for (const app of DEFAULT_PRODUCTIVE_APPS) {
      this.appCategories.set(app.toLowerCase(), 'productive');
    }
  }

  /**
   * Set category for an app
   */
  setAppCategory(appName: string, category: 'productive' | 'neutral' | 'waste'): void {
    this.appCategories.set(appName.toLowerCase(), category);
  }

  /**
   * Get category for an app
   */
  getAppCategory(appName: string): 'productive' | 'neutral' | 'waste' {
    return this.appCategories.get(appName.toLowerCase()) || 'neutral';
  }

  /**
   * Import screen time data
   */
  async importScreenTimeData(entries: ScreenTimeEntry[]): Promise<{
    imported: number;
    dailyReports: DailyTimeReport[];
  }> {
    // Group by date
    const byDate = new Map<string, ScreenTimeEntry[]>();
    
    for (const entry of entries) {
      const dateKey = entry.date.toISOString().split('T')[0];
      const existing = byDate.get(dateKey) || [];
      existing.push(entry);
      byDate.set(dateKey, existing);
    }

    const dailyReports: DailyTimeReport[] = [];

    for (const [dateKey, dayEntries] of byDate) {
      const report = await this.processDayEntries(dateKey, dayEntries);
      dailyReports.push(report);

      // Store in database - check if entry exists first
      const existing = await db
        .select()
        .from(timeTracking)
        .where(eq(timeTracking.date, dateKey))
        .limit(1);

      if (existing.length > 0) {
        // Merge with existing data
        const existingBreakdown = (existing[0].appBreakdown as Record<string, number>) || {};
        const mergedBreakdown = { ...existingBreakdown };
        for (const [app, minutes] of Object.entries(report.appBreakdown)) {
          mergedBreakdown[app] = (mergedBreakdown[app] || 0) + minutes;
        }

        await db
          .update(timeTracking)
          .set({
            totalScreenTimeMinutes: (existing[0].totalScreenTimeMinutes || 0) + report.totalScreenTimeMinutes,
            productiveMinutes: (existing[0].productiveMinutes || 0) + report.productiveMinutes,
            wasteMinutes: (existing[0].wasteMinutes || 0) + report.wasteMinutes,
            appBreakdown: mergedBreakdown,
            categoryBreakdown: {
              productive: (existing[0].productiveMinutes || 0) + report.productiveMinutes,
              waste: (existing[0].wasteMinutes || 0) + report.wasteMinutes,
              neutral: (existing[0].totalScreenTimeMinutes || 0) + report.totalScreenTimeMinutes - 
                ((existing[0].productiveMinutes || 0) + report.productiveMinutes) - 
                ((existing[0].wasteMinutes || 0) + report.wasteMinutes),
            },
          })
          .where(eq(timeTracking.id, existing[0].id));
      } else {
        await db.insert(timeTracking).values({
          id: crypto.randomUUID(),
          date: dateKey,
          totalScreenTimeMinutes: report.totalScreenTimeMinutes,
          productiveMinutes: report.productiveMinutes,
          wasteMinutes: report.wasteMinutes,
          appBreakdown: report.appBreakdown,
          categoryBreakdown: report.categoryBreakdown,
          tasksPlanned: report.tasksPlanned,
          tasksCompleted: report.tasksCompleted,
          createdAt: new Date(),
        });
      }
    }

    return {
      imported: entries.length,
      dailyReports,
    };
  }

  /**
   * Process entries for a single day
   */
  private async processDayEntries(
    dateKey: string,
    entries: ScreenTimeEntry[]
  ): Promise<DailyTimeReport> {
    const appBreakdown: Record<string, number> = {};
    let productive = 0;
    let waste = 0;
    let neutral = 0;

    for (const entry of entries) {
      appBreakdown[entry.appName] = (appBreakdown[entry.appName] || 0) + entry.totalMinutes;
      
      const category = this.getAppCategory(entry.appName);
      switch (category) {
        case 'productive':
          productive += entry.totalMinutes;
          break;
        case 'waste':
          waste += entry.totalMinutes;
          break;
        default:
          neutral += entry.totalMinutes;
      }
    }

    // Get task stats for the day
    const dayStart = new Date(dateKey);
    const dayEnd = new Date(dateKey);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const tasksForDay = await db
      .select()
      .from(tasks)
      .where(
        and(
          gte(tasks.dueDate, dayStart),
          lte(tasks.dueDate, dayEnd)
        )
      );

    const tasksPlanned = tasksForDay.length;
    const tasksCompleted = tasksForDay.filter(t => t.status === 'done').length;

    return {
      date: dateKey,
      totalScreenTimeMinutes: productive + waste + neutral,
      productiveMinutes: productive,
      wasteMinutes: waste,
      neutralMinutes: neutral,
      appBreakdown,
      categoryBreakdown: { productive, waste, neutral },
      tasksPlanned,
      tasksCompleted,
    };
  }

  /**
   * Get daily report for a specific date
   */
  async getDailyReport(date: Date): Promise<DailyTimeReport | null> {
    const dateKey = date.toISOString().split('T')[0];
    
    const [result] = await db
      .select()
      .from(timeTracking)
      .where(eq(timeTracking.date, dateKey))
      .limit(1);

    if (!result) return null;

    return {
      date: result.date,
      totalScreenTimeMinutes: result.totalScreenTimeMinutes || 0,
      productiveMinutes: result.productiveMinutes || 0,
      wasteMinutes: result.wasteMinutes || 0,
      neutralMinutes: (result.totalScreenTimeMinutes || 0) - 
        (result.productiveMinutes || 0) - (result.wasteMinutes || 0),
      appBreakdown: (result.appBreakdown as Record<string, number>) || {},
      categoryBreakdown: (result.categoryBreakdown as {
        productive: number;
        waste: number;
        neutral: number;
      }) || { productive: 0, waste: 0, neutral: 0 },
      tasksPlanned: result.tasksPlanned || 0,
      tasksCompleted: result.tasksCompleted || 0,
    };
  }

  /**
   * Get weekly time trend
   */
  async getWeeklyTrend(weekStart?: Date): Promise<WeeklyTimeTrend> {
    const start = weekStart || new Date();
    start.setDate(start.getDate() - start.getDay()); // Start of week (Sunday)
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const previousStart = new Date(start);
    previousStart.setDate(previousStart.getDate() - 7);

    // Get this week's data
    const thisWeek = await db
      .select()
      .from(timeTracking)
      .where(
        and(
          gte(timeTracking.date, start.toISOString().split('T')[0]),
          lte(timeTracking.date, end.toISOString().split('T')[0])
        )
      );

    // Get previous week's data
    const prevWeek = await db
      .select()
      .from(timeTracking)
      .where(
        and(
          gte(timeTracking.date, previousStart.toISOString().split('T')[0]),
          lte(timeTracking.date, start.toISOString().split('T')[0])
        )
      );

    // Calculate totals
    const thisWeekWaste = thisWeek.reduce((sum, d) => sum + (d.wasteMinutes || 0), 0);
    const prevWeekWaste = prevWeek.reduce((sum, d) => sum + (d.wasteMinutes || 0), 0);

    const daysWithData = thisWeek.length || 1;
    const averageDailyWaste = thisWeekWaste / daysWithData;

    // Calculate trend
    let trend: 'improving' | 'stable' | 'worsening' = 'stable';
    let comparison = 0;

    if (prevWeekWaste > 0) {
      comparison = ((thisWeekWaste - prevWeekWaste) / prevWeekWaste) * 100;
      if (comparison < -10) trend = 'improving';
      else if (comparison > 10) trend = 'worsening';
    }

    // Find worst apps
    const appTotals = new Map<string, number>();
    for (const day of thisWeek) {
      const breakdown = day.appBreakdown as Record<string, number>;
      if (breakdown) {
        for (const [app, minutes] of Object.entries(breakdown)) {
          if (this.getAppCategory(app) === 'waste') {
            appTotals.set(app, (appTotals.get(app) || 0) + minutes);
          }
        }
      }
    }

    const worstApps = Array.from(appTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, minutes]) => ({ name, minutes }));

    return {
      weekStart: start,
      weekEnd: end,
      averageDailyWaste,
      totalWaste: thisWeekWaste,
      trend,
      comparisonToPreviousWeek: Math.round(comparison),
      worstApps,
    };
  }

  /**
   * Check if waste threshold exceeded and alert
   */
  async checkWasteThreshold(dailyThresholdMinutes: number = 120): Promise<boolean> {
    const today = new Date().toISOString().split('T')[0];
    
    const [todayData] = await db
      .select()
      .from(timeTracking)
      .where(eq(timeTracking.date, today))
      .limit(1);

    if (!todayData) return false;

    if ((todayData.wasteMinutes || 0) > dailyThresholdMinutes) {
      const { notificationService } = await import('./notification-service');
      
      await notificationService.send(
        `⚠️ *Time Waste Alert*\n\n` +
        `You've spent ${Math.round((todayData.wasteMinutes || 0) / 60)} hours on distracting apps today.\n` +
        `That's more than the ${Math.round(dailyThresholdMinutes / 60)} hour limit.\n\n` +
        `Time to refocus. 💪`,
        { priority: 'high' }
      );

      return true;
    }

    return false;
  }

  /**
   * Generate time usage summary for notifications
   */
  async generateDailySummary(date?: Date): Promise<string> {
    const targetDate = date || new Date();
    const report = await this.getDailyReport(targetDate);

    if (!report) {
      return 'No time tracking data available for today.';
    }

    const productiveHours = Math.round(report.productiveMinutes / 60 * 10) / 10;
    const wasteHours = Math.round(report.wasteMinutes / 60 * 10) / 10;
    const totalHours = Math.round(report.totalScreenTimeMinutes / 60 * 10) / 10;

    let summary = `📱 *Screen Time Summary*\n\n`;
    summary += `Total: ${totalHours}h\n`;
    summary += `✅ Productive: ${productiveHours}h\n`;
    summary += `❌ Waste: ${wasteHours}h\n\n`;

    if (report.tasksPlanned > 0) {
      const rate = Math.round((report.tasksCompleted / report.tasksPlanned) * 100);
      summary += `📋 Tasks: ${report.tasksCompleted}/${report.tasksPlanned} (${rate}%)\n`;
    }

    // Top waste apps
    const wasteApps = Object.entries(report.appBreakdown)
      .filter(([app]) => this.getAppCategory(app) === 'waste')
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (wasteApps.length > 0) {
      summary += `\n*Top time sinks:*\n`;
      for (const [app, minutes] of wasteApps) {
        summary += `• ${app}: ${Math.round(minutes / 60 * 10) / 10}h\n`;
      }
    }

    return summary;
  }

  /**
   * Manual entry for screen time (when API not available)
   */
  async logManualEntry(
    date: Date,
    appName: string,
    minutes: number
  ): Promise<void> {
    const entries: ScreenTimeEntry[] = [{
      appName,
      totalMinutes: minutes,
      date,
    }];

    await this.importScreenTimeData(entries);
  }

  // ============================================
  // Backward Compatibility Methods
  // ============================================

  /**
   * Log a full day's time data (backward compatibility)
   */
  async logDay(data: {
    date: string;
    totalScreenTime?: number;
    productive?: number;
    waste?: number;
    breakdown?: Record<string, number>;
  }): Promise<{ isNew: boolean }> {
    const existing = await db
      .select()
      .from(timeTracking)
      .where(eq(timeTracking.date, data.date))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(timeTracking)
        .set({
          totalScreenTimeMinutes: data.totalScreenTime || existing[0].totalScreenTimeMinutes,
          productiveMinutes: data.productive || existing[0].productiveMinutes,
          wasteMinutes: data.waste || existing[0].wasteMinutes,
          appBreakdown: data.breakdown || existing[0].appBreakdown,
        })
        .where(eq(timeTracking.date, data.date));
      return { isNew: false };
    }

    await db.insert(timeTracking).values({
      id: crypto.randomUUID(),
      date: data.date,
      totalScreenTimeMinutes: data.totalScreenTime || 0,
      productiveMinutes: data.productive || 0,
      wasteMinutes: data.waste || 0,
      appBreakdown: data.breakdown || {},
      categoryBreakdown: {
        productive: data.productive || 0,
        waste: data.waste || 0,
        neutral: (data.totalScreenTime || 0) - (data.productive || 0) - (data.waste || 0),
      },
      createdAt: new Date(),
    });

    return { isNew: true };
  }

  /**
   * Get a single day's data (backward compatibility)
   */
  async getDay(date: string): Promise<{
    date: string;
    totalScreenTime: number;
    productive: number;
    waste: number;
    breakdown: Record<string, number>;
  } | null> {
    const [entry] = await db
      .select()
      .from(timeTracking)
      .where(eq(timeTracking.date, date))
      .limit(1);

    if (!entry) return null;

    return {
      date: entry.date,
      totalScreenTime: entry.totalScreenTimeMinutes || 0,
      productive: entry.productiveMinutes || 0,
      waste: entry.wasteMinutes || 0,
      breakdown: (entry.appBreakdown as Record<string, number>) || {},
    };
  }

  /**
   * Get stats for a number of days (backward compatibility)
   */
  async getStats(days: number): Promise<{
    totalDays: number;
    avgScreenTime: number;
    avgProductive: number;
    avgWaste: number;
    trend: 'improving' | 'stable' | 'worsening';
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const data = await db
      .select()
      .from(timeTracking)
      .where(gte(timeTracking.date, startDate.toISOString().split('T')[0]));

    if (data.length === 0) {
      return {
        totalDays: 0,
        avgScreenTime: 0,
        avgProductive: 0,
        avgWaste: 0,
        trend: 'stable',
      };
    }

    const totalScreenTime = data.reduce((sum, d) => sum + (d.totalScreenTimeMinutes || 0), 0);
    const totalProductive = data.reduce((sum, d) => sum + (d.productiveMinutes || 0), 0);
    const totalWaste = data.reduce((sum, d) => sum + (d.wasteMinutes || 0), 0);

    const weeklyTrend = await this.getWeeklyTrend();

    return {
      totalDays: data.length,
      avgScreenTime: Math.round(totalScreenTime / data.length),
      avgProductive: Math.round(totalProductive / data.length),
      avgWaste: Math.round(totalWaste / data.length),
      trend: weeklyTrend.trend,
    };
  }

  /**
   * Get weekly summary (backward compatibility)
   */
  async getWeeklySummary(): Promise<WeeklyTimeTrend> {
    return this.getWeeklyTrend();
  }

  /**
   * Get entries for a date range (backward compatibility)
   */
  async getRange(startDate: string, endDate: string): Promise<Array<{
    date: string;
    totalScreenTime: number;
    productive: number;
    waste: number;
  }>> {
    const data = await db
      .select()
      .from(timeTracking)
      .where(
        and(
          gte(timeTracking.date, startDate),
          lte(timeTracking.date, endDate)
        )
      )
      .orderBy(timeTracking.date);

    return data.map(d => ({
      date: d.date,
      totalScreenTime: d.totalScreenTimeMinutes || 0,
      productive: d.productiveMinutes || 0,
      waste: d.wasteMinutes || 0,
    }));
  }
}

// ============================================
// Singleton instance
// ============================================

export const timeTrackingService = new TimeTrackingService();

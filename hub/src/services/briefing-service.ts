/**
 * JD Agent - Briefing Service
 *
 * Generates on-demand personalized briefings for the Command Center iOS app.
 * Composes data from multiple services and uses AI to generate a natural summary.
 *
 * Features:
 * - Aggregates tasks, calendar, Canvas, recordings, and habits
 * - Generates AI-powered personalized summary
 * - Monitors integration health status
 * - Optimized for mobile consumption
 */

import { taskService } from './task-service';
import { calendarService } from './calendar-service';
import { habitService } from './habit-service';
import { goalsService } from './goals-service';
import { dashboardService } from './dashboard-service';
import { plaudIntegration } from '../integrations/plaud';
import { remarkableIntegration } from '../integrations/remarkable';
import { canvasIntegration } from '../integrations/canvas';
import { db } from '../db/client';
import { recordings, canvasItems, tasks } from '../db/schema';
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import { getLLMProviderChain } from '../lib/providers';

// ============================================
// Types
// ============================================

export interface BriefingItem {
  id: string;
  title: string;
  subtitle?: string;
  priority?: 'high' | 'medium' | 'low';
  type: 'task' | 'event' | 'assignment' | 'recording' | 'reminder';
  dueAt?: string;
  metadata?: Record<string, unknown>;
}

export interface BriefingSection {
  type: 'tasks' | 'calendar' | 'canvas' | 'recordings' | 'habits' | 'goals';
  title: string;
  items: BriefingItem[];
  stats: Record<string, number>;
}

export interface IntegrationStatus {
  status: 'healthy' | 'degraded' | 'down' | 'not_configured';
  lastSync: string | null;
  pendingItems: number;
  errorMessage?: string;
}

export interface IntegrationStatusSummary {
  overall: 'healthy' | 'degraded' | 'down';
  plaud: IntegrationStatus;
  remarkable: IntegrationStatus;
  canvas: IntegrationStatus;
  googleCalendar: IntegrationStatus;
}

export interface BriefingResponse {
  generatedAt: string;
  greeting: string;
  summary: string;
  sections: BriefingSection[];
  integrations: IntegrationStatusSummary;
  signOff: string;
}

export interface BriefingData {
  tasks: {
    today: number;
    overdue: number;
    highPriority: Array<{ id: string; title: string; dueDate?: string }>;
  };
  calendar: {
    todaysEvents: Array<{ id: string; title: string; startTime: string; eventType?: string }>;
    importantCalls: Array<{ id: string; title: string; startTime: string }>;
  };
  canvas: {
    dueTodayCount: number;
    dueThisWeek: Array<{ id: string; title: string; courseName: string; dueDate: string }>;
  };
  recordings: {
    newCount: number;
    pendingReview: Array<{ id: string; title: string; recordedAt: string }>;
  };
  habits: {
    completedToday: number;
    totalDueToday: number;
  };
  goals: {
    activeCount: number;
    needsAttention: number;
  };
}

// ============================================
// Briefing Service
// ============================================

export class BriefingService {
  private greetings = {
    morning: [
      "Good morning, JD!",
      "Rise and shine!",
      "Morning! Here's your update.",
      "Good morning! Let's crush it today.",
    ],
    afternoon: [
      "Good afternoon, JD!",
      "Afternoon check-in time!",
      "Here's your afternoon update.",
    ],
    evening: [
      "Good evening, JD!",
      "Evening update for you.",
      "Winding down - here's where things stand.",
    ],
  };

  private signOffs = [
    "You've got this!",
    "Make it happen!",
    "Let's do this!",
    "Go get 'em!",
    "Onwards!",
  ];

  /**
   * Generate a full on-demand briefing
   */
  async generate(): Promise<BriefingResponse> {
    console.log('[Briefing] Generating on-demand briefing...');
    const startTime = Date.now();

    // Gather data in parallel
    const [data, integrations] = await Promise.all([
      this.gatherBriefingData(),
      this.getIntegrationStatus(),
    ]);

    // Generate AI summary
    const summary = await this.generateAISummary(data, integrations);

    // Build sections
    const sections = this.buildSections(data);

    // Get appropriate greeting
    const hour = new Date().getHours();
    let greetingSet = this.greetings.morning;
    if (hour >= 12 && hour < 17) {
      greetingSet = this.greetings.afternoon;
    } else if (hour >= 17) {
      greetingSet = this.greetings.evening;
    }

    const response: BriefingResponse = {
      generatedAt: new Date().toISOString(),
      greeting: greetingSet[Math.floor(Math.random() * greetingSet.length)],
      summary,
      sections,
      integrations,
      signOff: this.signOffs[Math.floor(Math.random() * this.signOffs.length)],
    };

    console.log(`[Briefing] Generated in ${Date.now() - startTime}ms`);
    return response;
  }

  /**
   * Generate a quick preview for widgets
   */
  async getPreview(): Promise<{
    tasksToday: number;
    eventsToday: number;
    canvasDue: number;
    newRecordings: number;
    integrationsHealthy: boolean;
  }> {
    const [taskCounts, events, canvasCount, recordingCount, integrations] = await Promise.all([
      taskService.getCounts(),
      calendarService.getToday(),
      this.getCanvasDueTodayCount(),
      this.getNewRecordingsCount(),
      this.getIntegrationStatus(),
    ]);

    return {
      tasksToday: taskCounts.today || 0,
      eventsToday: events.length,
      canvasDue: canvasCount,
      newRecordings: recordingCount,
      integrationsHealthy: integrations.overall === 'healthy',
    };
  }

  /**
   * Get integration status only
   */
  async getIntegrationStatus(): Promise<IntegrationStatusSummary> {
    const [plaudStatus, remarkableStatus, canvasStatus, calendarStatus] = await Promise.allSettled([
      this.getPlaudStatus(),
      this.getRemarkableStatus(),
      this.getCanvasStatus(),
      this.getCalendarStatus(),
    ]);

    const plaud = plaudStatus.status === 'fulfilled' ? plaudStatus.value : this.errorStatus('Plaud check failed');
    const remarkable = remarkableStatus.status === 'fulfilled' ? remarkableStatus.value : this.errorStatus('Remarkable check failed');
    const canvas = canvasStatus.status === 'fulfilled' ? canvasStatus.value : this.errorStatus('Canvas check failed');
    const googleCalendar = calendarStatus.status === 'fulfilled' ? calendarStatus.value : this.errorStatus('Calendar check failed');

    // Calculate overall status
    const statuses = [plaud, remarkable, canvas, googleCalendar];
    const healthyCount = statuses.filter(s => s.status === 'healthy').length;
    const downCount = statuses.filter(s => s.status === 'down').length;
    const configuredCount = statuses.filter(s => s.status !== 'not_configured').length;

    let overall: 'healthy' | 'degraded' | 'down' = 'healthy';
    if (configuredCount === 0) {
      overall = 'degraded';
    } else if (downCount > 0) {
      overall = downCount === configuredCount ? 'down' : 'degraded';
    } else if (healthyCount < configuredCount) {
      overall = 'degraded';
    }

    return { overall, plaud, remarkable, canvas, googleCalendar };
  }

  // ============================================
  // Private: Data Gathering
  // ============================================

  private async gatherBriefingData(): Promise<BriefingData> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const [
      todaysTasks,
      overdueTasks,
      todaysEvents,
      taskCounts,
      todaysHabits,
      activeGoals,
      goalsNeedingAttention,
      canvasAssignments,
      recentRecordings,
    ] = await Promise.allSettled([
      taskService.list({ status: 'today' }),
      taskService.list({ status: 'overdue' }),
      calendarService.getToday(),
      taskService.getCounts(),
      habitService.getTodaysHabits(),
      goalsService.list({ status: 'active' }),
      goalsService.getNeedingAttention(50),
      this.getCanvasAssignmentsDueThisWeek(),
      this.getRecentRecordings(),
    ]);

    // Extract results with fallbacks
    const tasks = {
      today: (todaysTasks.status === 'fulfilled' ? todaysTasks.value.length : 0) +
             (taskCounts.status === 'fulfilled' ? taskCounts.value.today || 0 : 0),
      overdue: overdueTasks.status === 'fulfilled' ? overdueTasks.value.length : 0,
      highPriority: todaysTasks.status === 'fulfilled'
        ? todaysTasks.value
            .filter(t => t.priority && t.priority >= 3)
            .slice(0, 5)
            .map(t => ({ id: t.id, title: t.title, dueDate: t.dueDate?.toISOString() }))
        : [],
    };

    const events = todaysEvents.status === 'fulfilled' ? todaysEvents.value : [];
    const importantCalls = events
      .filter(e => {
        const title = e.title?.toLowerCase() || '';
        return title.includes('call') || title.includes('meeting') || title.includes('phone');
      })
      .map(e => ({ id: e.id, title: e.title, startTime: e.startTime.toISOString() }));

    const calendar = {
      todaysEvents: events.map(e => ({
        id: e.id,
        title: e.title,
        startTime: e.startTime.toISOString(),
        eventType: e.eventType || undefined,
      })),
      importantCalls,
    };

    const canvasData = canvasAssignments.status === 'fulfilled' ? canvasAssignments.value : [];
    const canvas = {
      dueTodayCount: canvasData.filter(a => {
        const dueDate = new Date(a.dueDate);
        return dueDate.toDateString() === now.toDateString();
      }).length,
      dueThisWeek: canvasData.slice(0, 5),
    };

    const recordingData = recentRecordings.status === 'fulfilled' ? recentRecordings.value : [];
    const recordingsInfo = {
      newCount: recordingData.length,
      pendingReview: recordingData.slice(0, 3),
    };

    const habitData = todaysHabits.status === 'fulfilled' ? todaysHabits.value : [];
    const habits = {
      completedToday: habitData.filter(h => h.completedToday).length,
      totalDueToday: habitData.filter(h => h.isDueToday).length,
    };

    const goalsData = activeGoals.status === 'fulfilled' ? activeGoals.value : [];
    const attentionData = goalsNeedingAttention.status === 'fulfilled' ? goalsNeedingAttention.value : [];
    const goalsInfo = {
      activeCount: goalsData.length,
      needsAttention: attentionData.length,
    };

    return {
      tasks,
      calendar,
      canvas,
      recordings: recordingsInfo,
      habits,
      goals: goalsInfo,
    };
  }

  private async getCanvasAssignmentsDueThisWeek(): Promise<Array<{
    id: string;
    title: string;
    courseName: string;
    dueDate: string;
  }>> {
    try {
      const now = new Date();
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const items = await db
        .select({
          id: canvasItems.id,
          title: canvasItems.title,
          courseName: canvasItems.courseName,
          dueAt: canvasItems.dueAt,
        })
        .from(canvasItems)
        .where(
          and(
            eq(canvasItems.itemType, 'assignment'),
            gte(canvasItems.dueAt, now),
          )
        )
        .orderBy(canvasItems.dueAt)
        .limit(10);

      return items
        .filter(i => i.dueAt && i.dueAt <= weekEnd)
        .map(i => ({
          id: i.id,
          title: i.title,
          courseName: i.courseName || 'Unknown Course',
          dueDate: i.dueAt!.toISOString(),
        }));
    } catch (error) {
      console.error('[Briefing] Failed to get Canvas assignments:', error);
      return [];
    }
  }

  private async getRecentRecordings(): Promise<Array<{
    id: string;
    title: string;
    recordedAt: string;
  }>> {
    try {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const recentRecs = await db
        .select({
          id: recordings.id,
          title: recordings.originalFilename,
          recordedAt: recordings.recordedAt,
        })
        .from(recordings)
        .where(gte(recordings.createdAt, oneDayAgo))
        .orderBy(desc(recordings.createdAt))
        .limit(5);

      return recentRecs.map(r => ({
        id: r.id,
        title: r.title || 'Untitled Recording',
        recordedAt: r.recordedAt?.toISOString() || new Date().toISOString(),
      }));
    } catch (error) {
      console.error('[Briefing] Failed to get recent recordings:', error);
      return [];
    }
  }

  private async getCanvasDueTodayCount(): Promise<number> {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);

      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(canvasItems)
        .where(
          and(
            eq(canvasItems.itemType, 'assignment'),
            gte(canvasItems.dueAt, todayStart),
          )
        );

      return Number(result[0]?.count || 0);
    } catch (error) {
      console.error('[Briefing] Failed to get Canvas due today count:', error);
      return 0;
    }
  }

  private async getNewRecordingsCount(): Promise<number> {
    try {
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(recordings)
        .where(gte(recordings.createdAt, oneDayAgo));

      return Number(result[0]?.count || 0);
    } catch (error) {
      console.error('[Briefing] Failed to get new recordings count:', error);
      return 0;
    }
  }

  // ============================================
  // Private: Integration Status
  // ============================================

  private async getPlaudStatus(): Promise<IntegrationStatus> {
    try {
      const status = plaudIntegration.getStatus();
      if (!status.configured) {
        return { status: 'not_configured', lastSync: null, pendingItems: 0 };
      }

      const pendingCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(recordings)
        .where(eq(recordings.status, 'pending'));

      return {
        status: status.watching ? 'healthy' : 'degraded',
        lastSync: null, // Could track last sync time
        pendingItems: Number(pendingCount[0]?.count || 0),
      };
    } catch (error) {
      return this.errorStatus(String(error));
    }
  }

  private async getRemarkableStatus(): Promise<IntegrationStatus> {
    try {
      const status = await remarkableIntegration.getStatus();
      if (!status.configured) {
        return { status: 'not_configured', lastSync: null, pendingItems: 0 };
      }

      return {
        status: status.watching ? 'healthy' : 'degraded',
        lastSync: status.lastSync?.toISOString() || null,
        pendingItems: status.pendingCount,
      };
    } catch (error) {
      return this.errorStatus(String(error));
    }
  }

  private async getCanvasStatus(): Promise<IntegrationStatus> {
    try {
      const configured = !!process.env.CANVAS_TOKEN && !!process.env.CANVAS_BASE_URL;
      if (!configured) {
        return { status: 'not_configured', lastSync: null, pendingItems: 0 };
      }

      // Get count of unsynced items
      const pendingCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(canvasItems)
        .where(eq(canvasItems.syncStatus, 'pending'));

      return {
        status: 'healthy',
        lastSync: null,
        pendingItems: Number(pendingCount[0]?.count || 0),
      };
    } catch (error) {
      return this.errorStatus(String(error));
    }
  }

  private async getCalendarStatus(): Promise<IntegrationStatus> {
    try {
      const configured = !!process.env.GOOGLE_CALENDAR_ID;
      if (!configured) {
        return { status: 'not_configured', lastSync: null, pendingItems: 0 };
      }

      return {
        status: 'healthy',
        lastSync: null,
        pendingItems: 0,
      };
    } catch (error) {
      return this.errorStatus(String(error));
    }
  }

  private errorStatus(errorMessage: string): IntegrationStatus {
    return {
      status: 'down',
      lastSync: null,
      pendingItems: 0,
      errorMessage,
    };
  }

  // ============================================
  // Private: AI Summary Generation
  // ============================================

  private async generateAISummary(data: BriefingData, integrations: IntegrationStatusSummary): Promise<string> {
    try {
      const llm = getLLMProviderChain();

      const prompt = `Generate a brief, friendly personal assistant summary (2-3 sentences max) for JD based on this data:

Tasks: ${data.tasks.today} today, ${data.tasks.overdue} overdue
${data.tasks.highPriority.length > 0 ? `High priority: ${data.tasks.highPriority.map(t => t.title).join(', ')}` : ''}

Calendar: ${data.calendar.todaysEvents.length} events today
${data.calendar.importantCalls.length > 0 ? `Important calls: ${data.calendar.importantCalls.map(c => c.title).join(', ')}` : ''}

Canvas: ${data.canvas.dueTodayCount} assignments due today, ${data.canvas.dueThisWeek.length} this week
${data.canvas.dueThisWeek.length > 0 ? `Upcoming: ${data.canvas.dueThisWeek.slice(0, 2).map(a => a.title).join(', ')}` : ''}

Recordings: ${data.recordings.newCount} new recordings to review

Habits: ${data.habits.completedToday}/${data.habits.totalDueToday} completed

Integrations: ${integrations.overall}

Be conversational and helpful. Mention specific important items. If there are urgent items, highlight them. Keep it natural and brief.`;

      const response = await llm.chat({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are JD\'s personal assistant. Be friendly, brief, and actionable.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 200,
      });

      return response.content || this.generateFallbackSummary(data);
    } catch (error) {
      console.error('[Briefing] AI summary failed, using fallback:', error);
      return this.generateFallbackSummary(data);
    }
  }

  private generateFallbackSummary(data: BriefingData): string {
    const parts: string[] = [];

    if (data.tasks.overdue > 0) {
      parts.push(`You have ${data.tasks.overdue} overdue task${data.tasks.overdue > 1 ? 's' : ''} to address.`);
    }

    if (data.tasks.today > 0) {
      parts.push(`${data.tasks.today} task${data.tasks.today > 1 ? 's' : ''} scheduled for today.`);
    }

    if (data.canvas.dueTodayCount > 0) {
      parts.push(`${data.canvas.dueTodayCount} Canvas assignment${data.canvas.dueTodayCount > 1 ? 's' : ''} due today.`);
    }

    if (data.calendar.importantCalls.length > 0) {
      parts.push(`Don't forget: ${data.calendar.importantCalls[0].title}.`);
    }

    if (data.recordings.newCount > 0) {
      parts.push(`${data.recordings.newCount} new recording${data.recordings.newCount > 1 ? 's' : ''} to review.`);
    }

    if (parts.length === 0) {
      return "Looking good! No urgent items right now. Great time to tackle something from your backlog.";
    }

    return parts.join(' ');
  }

  // ============================================
  // Private: Section Building
  // ============================================

  private buildSections(data: BriefingData): BriefingSection[] {
    const sections: BriefingSection[] = [];

    // Tasks section
    if (data.tasks.today > 0 || data.tasks.overdue > 0 || data.tasks.highPriority.length > 0) {
      sections.push({
        type: 'tasks',
        title: 'Tasks',
        items: data.tasks.highPriority.map(t => ({
          id: t.id,
          title: t.title,
          priority: 'high' as const,
          type: 'task' as const,
          dueAt: t.dueDate,
        })),
        stats: {
          today: data.tasks.today,
          overdue: data.tasks.overdue,
          highPriority: data.tasks.highPriority.length,
        },
      });
    }

    // Calendar section
    if (data.calendar.todaysEvents.length > 0) {
      sections.push({
        type: 'calendar',
        title: 'Calendar',
        items: data.calendar.todaysEvents.slice(0, 5).map(e => ({
          id: e.id,
          title: e.title,
          type: 'event' as const,
          dueAt: e.startTime,
          metadata: { eventType: e.eventType },
        })),
        stats: {
          eventsToday: data.calendar.todaysEvents.length,
          importantCalls: data.calendar.importantCalls.length,
        },
      });
    }

    // Canvas section
    if (data.canvas.dueThisWeek.length > 0) {
      sections.push({
        type: 'canvas',
        title: 'Canvas',
        items: data.canvas.dueThisWeek.map(a => ({
          id: a.id,
          title: a.title,
          subtitle: a.courseName,
          type: 'assignment' as const,
          dueAt: a.dueDate,
        })),
        stats: {
          dueToday: data.canvas.dueTodayCount,
          dueThisWeek: data.canvas.dueThisWeek.length,
        },
      });
    }

    // Recordings section
    if (data.recordings.newCount > 0) {
      sections.push({
        type: 'recordings',
        title: 'Recordings',
        items: data.recordings.pendingReview.map(r => ({
          id: r.id,
          title: r.title,
          type: 'recording' as const,
          dueAt: r.recordedAt,
        })),
        stats: {
          newRecordings: data.recordings.newCount,
        },
      });
    }

    // Habits section
    if (data.habits.totalDueToday > 0) {
      sections.push({
        type: 'habits',
        title: 'Habits',
        items: [],
        stats: {
          completed: data.habits.completedToday,
          total: data.habits.totalDueToday,
          completionRate: data.habits.totalDueToday > 0
            ? Math.round((data.habits.completedToday / data.habits.totalDueToday) * 100)
            : 0,
        },
      });
    }

    return sections;
  }
}

// ============================================
// Singleton instance
// ============================================

export const briefingService = new BriefingService();

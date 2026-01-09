/**
 * JD Agent - Ceremony Service
 * 
 * Implements the morning and evening ceremonies:
 * - Morning (6 AM): Daily briefing, weather, priorities
 * - Evening (9 PM): Day review, wins, tomorrow prep
 * - Weekly (Sunday 4 PM): Week in review, planning
 */

import { taskService } from './task-service';
import { calendarService } from './calendar-service';
import { vaultService } from './vault-service';
import { notificationService } from './notification-service';
import { habitService } from './habit-service';
import { goalsService } from './goals-service';
import { progressService } from './progress-service';
import { reflectionsService } from './reflections-service';
import { LIFE_AREAS } from '../constants/life-areas';
import { db } from '../db/client';
import { ceremonies, systemLogs } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

// ============================================
// Types
// ============================================

export type CeremonyType = 'morning' | 'evening' | 'weekly';

export interface CeremonyResult {
  type: CeremonyType;
  timestamp: Date;
  content: CeremonyContent;
  notificationSent: boolean;
  notificationError?: string;
}

export interface CeremonyContent {
  greeting: string;
  sections: CeremonySection[];
  signOff: string;
}

export interface CeremonySection {
  heading: string;
  content: string;
  items?: string[];
}

// ============================================
// Ceremony Service
// ============================================

export class CeremonyService {
  private greetings = {
    morning: [
      "Rise and shine, champ! 🌅",
      "Good morning! Let's make today count! 🌟",
      "Wakey wakey! Time to dominate! 💪",
      "Morning, champion! Ready to crush it? 🏆",
      "New day, new opportunities! Let's go! 🚀",
    ],
    evening: [
      "Great work today, champ! 🌙",
      "Time to wind down and reflect! ✨",
      "Another day in the books! 📚",
      "Well done on making it through! 🎉",
      "Time to rest up for tomorrow! 😴",
    ],
    weekly: [
      "Weekly review time! Let's see how we did! 📊",
      "Time to look back and plan ahead! 🗓️",
      "Week in review - you've been busy! 💼",
    ],
  };

  private signOffs = {
    morning: [
      "Go get 'em!",
      "Make it happen!",
      "You've got this!",
      "Let's do this!",
      "Onwards and upwards!",
    ],
    evening: [
      "Rest well, champion!",
      "See you tomorrow!",
      "Sweet dreams!",
      "Recharge those batteries!",
      "Tomorrow's another opportunity!",
    ],
    weekly: [
      "Here's to another great week!",
      "Ready for the week ahead!",
      "Let's make next week even better!",
    ],
  };

  /**
   * Get a random item from an array
   */
  private random<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * Format a date for display
   */
  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }

  /**
   * Format a time for display
   */
  private formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  /**
   * Run the morning ceremony
   */
  async runMorningCeremony(): Promise<CeremonyResult> {
    console.log('[Ceremony] Running morning ceremony...');
    const now = new Date();

    // Gather data
    const [todaysTasks, todaysEvents, taskCounts, todaysHabits, goalsNeedingAttention, upcomingMilestones] = await Promise.all([
      taskService.list({ status: 'today' }),
      calendarService.getToday(),
      taskService.getCounts(),
      habitService.getTodaysHabits(),
      goalsService.getNeedingAttention(50),
      progressService.getUpcomingMilestonesForDashboard(7),
    ]);

    // Build sections
    const sections: CeremonySection[] = [];

    // Today's date header
    sections.push({
      heading: '📅 Today',
      content: this.formatDate(now),
    });

    // Today's Habits (new!)
    const dueHabits = todaysHabits.filter(h => h.isDueToday && !h.completedToday);
    if (dueHabits.length > 0) {
      sections.push({
        heading: '🔄 Habits',
        content: `${dueHabits.length} habit${dueHabits.length > 1 ? 's' : ''} to complete:`,
        items: dueHabits.slice(0, 5).map(h => {
          const streakIcon = h.currentStreak >= 7 ? '🔥' : h.currentStreak >= 3 ? '⚡' : '';
          const timeIcon = h.timeOfDay === 'morning' ? '🌅' : h.timeOfDay === 'evening' ? '🌙' : '';
          return `• ${streakIcon}${timeIcon} ${h.title}${h.currentStreak > 0 ? ` (${h.currentStreak}d streak)` : ''}`;
        }),
      });
    }

    // Calendar for today
    if (todaysEvents.length > 0) {
      sections.push({
        heading: '🗓️ Calendar',
        content: `${todaysEvents.length} event${todaysEvents.length > 1 ? 's' : ''} scheduled:`,
        items: todaysEvents.slice(0, 5).map(e =>
          `• ${this.formatTime(e.startTime)} - ${e.title}`
        ),
      });
    } else {
      sections.push({
        heading: '🗓️ Calendar',
        content: 'Clear calendar today - great time for deep work!',
      });
    }

    // Tasks for today
    if (todaysTasks.length > 0) {
      const highPriority = todaysTasks.filter(t => t.priority && t.priority >= 3);
      sections.push({
        heading: '✅ Tasks',
        content: `${todaysTasks.length} task${todaysTasks.length > 1 ? 's' : ''} to tackle:`,
        items: todaysTasks.slice(0, 5).map(t =>
          `• ${t.priority && t.priority >= 3 ? '⭐ ' : ''}${t.title}`
        ),
      });

      if (highPriority.length > 0) {
        sections.push({
          heading: '🎯 Top Priority',
          content: highPriority[0].title,
        });
      }
    } else {
      sections.push({
        heading: '✅ Tasks',
        content: 'No tasks scheduled for today. Time to pull from inbox!',
      });
    }

    // Inbox count
    if (taskCounts.inbox > 0) {
      sections.push({
        heading: '📥 Inbox',
        content: `${taskCounts.inbox} item${taskCounts.inbox > 1 ? 's' : ''} waiting for processing`,
      });
    }

    // Waiting count
    if (taskCounts.waiting > 0) {
      sections.push({
        heading: '⏳ Waiting On',
        content: `${taskCounts.waiting} item${taskCounts.waiting > 1 ? 's' : ''} pending from others`,
      });
    }

    // Goals needing attention (new!)
    if (goalsNeedingAttention.length > 0) {
      sections.push({
        heading: '🎯 Goals Check-in',
        content: `${goalsNeedingAttention.length} goal${goalsNeedingAttention.length > 1 ? 's' : ''} need attention:`,
        items: goalsNeedingAttention.slice(0, 3).map(g => {
          const healthIcon = g.healthScore < 30 ? '🔴' : g.healthScore < 50 ? '🟡' : '🟢';
          const areaInfo = g.lifeArea ? LIFE_AREAS[g.lifeArea as keyof typeof LIFE_AREAS] : null;
          const areaIcon = areaInfo?.icon || '';
          return `${healthIcon}${areaIcon} ${g.title} (${g.healthScore}% health)`;
        }),
      });
    }

    // Upcoming milestones (new!)
    if (upcomingMilestones.length > 0) {
      sections.push({
        heading: '🏁 Upcoming Milestones',
        content: `${upcomingMilestones.length} milestone${upcomingMilestones.length > 1 ? 's' : ''} this week:`,
        items: upcomingMilestones.slice(0, 3).map(m => {
          const daysText = m.daysUntil === 0 ? 'today!' : m.daysUntil === 1 ? 'tomorrow' : `in ${m.daysUntil} days`;
          return `• ${m.title} (${m.goalTitle}) - ${daysText}`;
        }),
      });
    }

    const content: CeremonyContent = {
      greeting: this.random(this.greetings.morning),
      sections,
      signOff: this.random(this.signOffs.morning),
    };

    return this.sendCeremony('morning', content);
  }

  /**
   * Run the evening ceremony
   */
  async runEveningCeremony(): Promise<CeremonyResult> {
    console.log('[Ceremony] Running evening ceremony...');
    const now = new Date();

    // Gather data
    const [completedToday, tomorrowsTasks, tomorrowsEvents, todaysHabits, recentWins, topStreaks] = await Promise.all([
      taskService.getCompletedToday(),
      taskService.list({ status: 'upcoming' }),
      calendarService.getUpcoming(1),
      habitService.getTodaysHabits(),
      reflectionsService.getWins(3),
      progressService.getTopStreaks(3),
    ]);

    // Build sections
    const sections: CeremonySection[] = [];

    // Habit summary for today (new!)
    const dueHabits = todaysHabits.filter(h => h.isDueToday);
    const completedHabits = dueHabits.filter(h => h.completedToday);
    const missedHabits = dueHabits.filter(h => !h.completedToday);

    if (dueHabits.length > 0) {
      if (completedHabits.length === dueHabits.length) {
        sections.push({
          heading: '🔥 Habits',
          content: `Perfect! All ${completedHabits.length} habit${completedHabits.length > 1 ? 's' : ''} completed!`,
          items: completedHabits.map(h =>
            `✓ ${h.title}${h.currentStreak > 0 ? ` (${h.currentStreak}d streak!)` : ''}`
          ),
        });
      } else if (completedHabits.length > 0) {
        sections.push({
          heading: '🔄 Habits',
          content: `${completedHabits.length}/${dueHabits.length} habits completed`,
          items: [
            ...completedHabits.map(h => `✓ ${h.title}`),
            ...missedHabits.map(h => `✗ ${h.title}${h.streakStatus === 'at_risk' ? ' ⚠️ streak at risk!' : ''}`),
          ],
        });
      } else {
        sections.push({
          heading: '🔄 Habits',
          content: `${missedHabits.length} habit${missedHabits.length > 1 ? 's' : ''} missed today`,
          items: missedHabits.map(h =>
            `✗ ${h.title}${h.streakStatus === 'at_risk' ? ' ⚠️ streak at risk!' : ''}`
          ),
        });
      }
    }

    // Today's accomplishments
    if (completedToday.length > 0) {
      sections.push({
        heading: '🏆 Today\'s Wins',
        content: `Crushed ${completedToday.length} task${completedToday.length > 1 ? 's' : ''}!`,
        items: completedToday.slice(0, 5).map(t => `✓ ${t.title}`),
      });
    } else {
      sections.push({
        heading: '📝 Today',
        content: 'No tasks completed today. That\'s okay - rest is productive too!',
      });
    }

    // Tomorrow preview
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    sections.push({
      heading: '📅 Tomorrow',
      content: this.formatDate(tomorrow),
    });

    // Tomorrow's events
    const tomorrowEvents = tomorrowsEvents.filter(e => {
      const eventDate = new Date(e.startTime);
      return eventDate.toDateString() === tomorrow.toDateString();
    });

    if (tomorrowEvents.length > 0) {
      sections.push({
        heading: '🗓️ Tomorrow\'s Calendar',
        content: `${tomorrowEvents.length} event${tomorrowEvents.length > 1 ? 's' : ''} scheduled:`,
        items: tomorrowEvents.slice(0, 3).map(e =>
          `• ${this.formatTime(e.startTime)} - ${e.title}`
        ),
      });
    }

    // Tomorrow's tasks preview
    if (tomorrowsTasks.length > 0) {
      const dueNextDays = tomorrowsTasks.filter(t => {
        if (!t.dueDate) return false;
        const dueDate = new Date(t.dueDate);
        const daysDiff = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff <= 2;
      });

      if (dueNextDays.length > 0) {
        sections.push({
          heading: '⚡ Coming Up',
          content: `${dueNextDays.length} task${dueNextDays.length > 1 ? 's' : ''} due soon:`,
          items: dueNextDays.slice(0, 3).map(t => `• ${t.title}`),
        });
      }
    }

    // Top habit streaks celebration (new!)
    const greatStreaks = topStreaks.filter(s => s.currentStreak >= 7);
    if (greatStreaks.length > 0) {
      sections.push({
        heading: '🔥 Streak Champions',
        content: 'Keep these going!',
        items: greatStreaks.map(s => {
          const areaInfo = s.lifeArea ? LIFE_AREAS[s.lifeArea as keyof typeof LIFE_AREAS] : null;
          const areaIcon = areaInfo?.icon || '';
          return `${areaIcon} ${s.habitTitle} - ${s.currentStreak} days! 🎉`;
        }),
      });
    }

    // Recent goal wins (new!)
    if (recentWins.length > 0) {
      sections.push({
        heading: '🏆 Recent Goal Wins',
        content: 'Celebrate your progress:',
        items: recentWins.map(w => `✨ ${w.goalTitle}: ${w.content.slice(0, 50)}${w.content.length > 50 ? '...' : ''}`),
      });
    }

    // Reflection prompt (enhanced)
    sections.push({
      heading: '💭 Evening Reflection',
      content: 'Consider logging a reflection for your goals:\n• What progress did you make today?\n• Any obstacles to address?\n• What wins should you celebrate?',
    });

    const content: CeremonyContent = {
      greeting: this.random(this.greetings.evening),
      sections,
      signOff: this.random(this.signOffs.evening),
    };

    return this.sendCeremony('evening', content);
  }

  /**
   * Run the weekly review ceremony
   */
  async runWeeklyCeremony(): Promise<CeremonyResult> {
    console.log('[Ceremony] Running weekly ceremony...');
    const now = new Date();

    // Calculate week boundaries
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - 7);

    // Gather data
    const [completedThisWeek, vaultStats, taskCounts, habitStats, activeGoals, weeklyReport, areaProgress] = await Promise.all([
      taskService.getCompletedSince(weekStart),
      vaultService.getStats(),
      taskService.getCounts(),
      habitService.getOverallStats(),
      goalsService.list({ status: 'active' }),
      progressService.getWeeklyReport(),
      progressService.getProgressByArea(),
    ]);

    // Build sections
    const sections: CeremonySection[] = [];

    // Week summary with habits
    sections.push({
      heading: '📊 Week in Numbers',
      content: [
        `✅ ${completedThisWeek.length} tasks completed`,
        `🔄 ${habitStats.activeHabits} active habits`,
        `📥 ${taskCounts.inbox} items in inbox`,
        `📚 ${vaultStats.totalEntries} vault entries`,
      ].join('\n'),
    });

    // Habit performance (new!)
    if (habitStats.activeHabits > 0) {
      const avgStreak = habitStats.averageStreak;
      let habitMessage = '';
      if (avgStreak >= 7) {
        habitMessage = `🔥 Amazing! Average streak: ${avgStreak} days`;
      } else if (avgStreak >= 3) {
        habitMessage = `⚡ Good momentum! Average streak: ${avgStreak} days`;
      } else {
        habitMessage = `Building momentum... Average streak: ${avgStreak} days`;
      }
      sections.push({
        heading: '🔄 Habit Streaks',
        content: habitMessage,
      });
    }

    // Life area progress (enhanced!)
    const activeAreas = areaProgress.filter(a => a.activeGoals > 0 || a.activeHabits > 0);
    if (activeAreas.length > 0) {
      sections.push({
        heading: '🌟 Life Areas',
        content: 'Progress across your life:',
        items: activeAreas.slice(0, 6).map(a => {
          const goalText = a.activeGoals > 0 ? `${a.activeGoals} goals` : '';
          const habitText = a.activeHabits > 0 ? `${a.activeHabits} habits (${a.avgHabitCompletionRate}%)` : '';
          const details = [goalText, habitText].filter(Boolean).join(', ');
          return `${a.icon} ${a.name}: ${details}`;
        }),
      });
    }

    // Goals progress (enhanced!)
    if (activeGoals.length > 0) {
      const goalsWithProgress = activeGoals
        .filter(g => g.progressPercentage !== null && g.progressPercentage !== undefined)
        .map(g => {
          const progress = g.progressPercentage || 0;
          const statusIcon = progress >= 75 ? '🟢' : progress >= 50 ? '🟡' : '🔴';
          const areaInfo = g.lifeArea ? LIFE_AREAS[g.lifeArea as keyof typeof LIFE_AREAS] : null;
          const areaIcon = areaInfo?.icon || '';
          return `${statusIcon}${areaIcon} ${g.title}: ${progress}%`;
        });

      if (goalsWithProgress.length > 0) {
        sections.push({
          heading: '🎯 Goals Progress',
          content: 'How your goals are tracking:',
          items: goalsWithProgress.slice(0, 5),
        });
      }
    }

    // Weekly highlights from report (new!)
    if (weeklyReport.highlights.length > 0) {
      sections.push({
        heading: '✨ Weekly Highlights',
        content: weeklyReport.highlights.join('\n'),
      });
    }

    // Areas for improvement (new!)
    if (weeklyReport.improvements.length > 0) {
      sections.push({
        heading: '📈 Focus Areas',
        content: weeklyReport.improvements.slice(0, 3).join('\n'),
      });
    }

    // Top accomplishments
    if (completedThisWeek.length > 0) {
      sections.push({
        heading: '🏆 This Week\'s Wins',
        content: 'Tasks you crushed:',
        items: completedThisWeek.slice(0, 5).map(t => `✓ ${t.title}`),
      });
    }

    // Areas needing attention
    const attentionItems: string[] = [];
    if (taskCounts.inbox > 5) {
      attentionItems.push(`📥 Inbox has ${taskCounts.inbox} items - time to process!`);
    }
    if (taskCounts.waiting > 3) {
      attentionItems.push(`⏳ ${taskCounts.waiting} items waiting on others - follow up?`);
    }
    // Check for goals that need attention
    const atRiskGoals = activeGoals.filter(g => {
      if (!g.targetValue || !g.targetDate) return false;
      const progress = ((g.currentValue || 0) / g.targetValue) * 100;
      const daysLeft = Math.ceil((new Date(g.targetDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return progress < 50 && daysLeft < 30;
    });
    if (atRiskGoals.length > 0) {
      attentionItems.push(`🎯 ${atRiskGoals.length} goal${atRiskGoals.length > 1 ? 's' : ''} behind schedule`);
    }

    if (attentionItems.length > 0) {
      sections.push({
        heading: '⚠️ Needs Attention',
        content: attentionItems.join('\n'),
      });
    }

    // Weekly planning prompt
    sections.push({
      heading: '📋 Plan Ahead',
      content: 'What are your top 3 priorities for next week?',
    });

    const content: CeremonyContent = {
      greeting: this.random(this.greetings.weekly),
      sections,
      signOff: this.random(this.signOffs.weekly),
    };

    return this.sendCeremony('weekly', content);
  }

  /**
   * Send a ceremony notification and log it
   */
  private async sendCeremony(
    type: CeremonyType,
    content: CeremonyContent
  ): Promise<CeremonyResult> {
    const timestamp = new Date();

    // Format the message
    const formattedSections = content.sections.map(s => ({
      heading: s.heading,
      content: s.items ? `${s.content}\n${s.items.join('\n')}` : s.content,
    }));

    // Send notification
    const notifyResult = await notificationService.sendCeremony(
      content.greeting,
      [...formattedSections, { heading: '', content: `\n_${content.signOff}_` }]
    );

    // Log the ceremony
    try {
      await db.insert(ceremonies).values({
        ceremonyType: type,
        content: JSON.stringify(content),
        sentAt: timestamp,
        deliveryStatus: notifyResult.success ? 'delivered' : 'failed',
        deliveryChannel: notifyResult.channel,
      });
    } catch (error) {
      console.error('[Ceremony] Failed to log ceremony:', error);
    }

    // Also log to system logs
    try {
      await db.insert(systemLogs).values({
        logType: notifyResult.success ? 'info' : 'warning',
        component: 'ceremony',
        message: `${type} ceremony ${notifyResult.success ? 'sent' : 'failed'}`,
        details: {
          type,
          channel: notifyResult.channel,
          error: notifyResult.error,
        },
      });
    } catch (error) {
      console.error('[Ceremony] Failed to write system log:', error);
    }

    return {
      type,
      timestamp,
      content,
      notificationSent: notifyResult.success,
      notificationError: notifyResult.error,
    };
  }

  /**
   * Get the last ceremony of a given type
   */
  async getLastCeremony(type: CeremonyType): Promise<{
    sentAt: Date;
    content: CeremonyContent;
    deliveryStatus: string;
  } | null> {
    const [result] = await db
      .select()
      .from(ceremonies)
      .where(eq(ceremonies.ceremonyType, type))
      .orderBy(desc(ceremonies.sentAt))
      .limit(1);

    if (!result) return null;

    return {
      sentAt: result.sentAt,
      content: result.content as unknown as CeremonyContent,
      deliveryStatus: result.deliveryStatus || 'unknown',
    };
  }

  /**
   * Get ceremony history
   */
  async getHistory(limit = 10): Promise<Array<{
    type: CeremonyType;
    sentAt: Date;
    deliveryStatus: string;
  }>> {
    const results = await db
      .select({
        type: ceremonies.ceremonyType,
        sentAt: ceremonies.sentAt,
        deliveryStatus: ceremonies.deliveryStatus,
      })
      .from(ceremonies)
      .orderBy(desc(ceremonies.sentAt))
      .limit(limit);

    return results.map(r => ({
      type: r.type as CeremonyType,
      sentAt: r.sentAt,
      deliveryStatus: r.deliveryStatus || 'unknown',
    }));
  }

  /**
   * Generate a preview of a ceremony (without sending)
   */
  async preview(type: CeremonyType): Promise<CeremonyContent> {
    switch (type) {
      case 'morning': {
        const result = await this.buildMorningContent();
        return result;
      }
      case 'evening': {
        const result = await this.buildEveningContent();
        return result;
      }
      case 'weekly': {
        const result = await this.buildWeeklyContent();
        return result;
      }
      default:
        throw new Error(`Unknown ceremony type: ${type}`);
    }
  }

  private async buildMorningContent(): Promise<CeremonyContent> {
    // Simplified version for preview
    const [todaysTasks, todaysEvents] = await Promise.all([
      taskService.list({ status: 'today' }),
      calendarService.getToday(),
    ]);

    return {
      greeting: this.random(this.greetings.morning),
      sections: [
        {
          heading: '📅 Today',
          content: this.formatDate(new Date()),
        },
        {
          heading: '🗓️ Calendar',
          content: `${todaysEvents.length} event(s) scheduled`,
        },
        {
          heading: '✅ Tasks',
          content: `${todaysTasks.length} task(s) to complete`,
        },
      ],
      signOff: this.random(this.signOffs.morning),
    };
  }

  private async buildEveningContent(): Promise<CeremonyContent> {
    const completedToday = await taskService.getCompletedToday();

    return {
      greeting: this.random(this.greetings.evening),
      sections: [
        {
          heading: '🏆 Today\'s Wins',
          content: `${completedToday.length} task(s) completed`,
        },
        {
          heading: '💭 Reflect',
          content: 'What was your biggest win today?',
        },
      ],
      signOff: this.random(this.signOffs.evening),
    };
  }

  private async buildWeeklyContent(): Promise<CeremonyContent> {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const completedThisWeek = await taskService.getCompletedSince(weekStart);

    return {
      greeting: this.random(this.greetings.weekly),
      sections: [
        {
          heading: '📊 Week Summary',
          content: `${completedThisWeek.length} tasks completed this week`,
        },
        {
          heading: '📋 Plan Ahead',
          content: 'What are your priorities for next week?',
        },
      ],
      signOff: this.random(this.signOffs.weekly),
    };
  }
}

// ============================================
// Singleton instance
// ============================================

export const ceremonyService = new CeremonyService();

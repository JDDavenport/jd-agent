/**
 * JD Agent - Accountability Coaching Service
 * 
 * Phase 3: Provides accountability coaching
 * 
 * Features:
 * - Tracks missed tasks and asks for reasons
 * - Detects patterns in avoidance behavior
 * - Escalates coaching based on persistence
 * - Tracks goals at multiple levels
 */

import { db } from '../db/client';
import { tasks, timeTracking, integrityChecks } from '../db/schema';
import { eq, and, not, lte, gte, desc, sql, count } from 'drizzle-orm';
import { notificationService } from './notification-service';
import Anthropic from '@anthropic-ai/sdk';

// ============================================
// Types
// ============================================

export interface MissedTaskRecord {
  taskId: string;
  taskTitle: string;
  dueDate: Date;
  reason?: string;
  recordedAt: Date;
}

export interface CoachingEscalation {
  level: 1 | 2 | 3; // 1=neutral, 2=direct, 3=intervention
  taskId: string;
  taskTitle: string;
  missCount: number;
  pattern?: string;
}

export interface Goal {
  id: string;
  title: string;
  level: 'semester' | 'monthly' | 'weekly';
  targetDate: Date;
  progress: number; // 0-100
  status: 'on_track' | 'at_risk' | 'behind' | 'completed';
  milestones: Array<{
    title: string;
    completed: boolean;
    dueDate?: Date;
  }>;
}

export interface ProductivityPattern {
  type: string;
  description: string;
  frequency: number;
  lastOccurrence: Date;
  suggestion: string;
}

export interface WeeklyCoachingReport {
  tasksCompleted: number;
  tasksMissed: number;
  completionRate: number;
  timeWasted: number; // minutes
  patterns: ProductivityPattern[];
  coachingMessage: string;
  escalationLevel: 1 | 2 | 3;
}

// ============================================
// Schema for missed task tracking (in-memory for now)
// ============================================

const missedTaskRecords: Map<string, MissedTaskRecord[]> = new Map();
const taskMissReasons: Map<string, string[]> = new Map();

// ============================================
// Coaching Service
// ============================================

class CoachingService {
  private anthropic: Anthropic | null = null;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.anthropic = new Anthropic({ apiKey });
    }
  }

  // ============================================
  // Missed Task Tracking
  // ============================================

  /**
   * Record a missed task
   */
  async recordMissedTask(
    taskId: string,
    taskTitle: string,
    dueDate: Date,
    reason?: string
  ): Promise<void> {
    const record: MissedTaskRecord = {
      taskId,
      taskTitle,
      dueDate,
      reason,
      recordedAt: new Date(),
    };

    const existing = missedTaskRecords.get(taskId) || [];
    existing.push(record);
    missedTaskRecords.set(taskId, existing);

    if (reason) {
      const reasons = taskMissReasons.get(taskId) || [];
      reasons.push(reason);
      taskMissReasons.set(taskId, reasons);
    }

    // Check if escalation needed
    await this.checkEscalation(taskId, taskTitle, existing.length);
  }

  /**
   * Get miss count for a task
   */
  getMissCount(taskId: string): number {
    return (missedTaskRecords.get(taskId) || []).length;
  }

  /**
   * Check if coaching escalation is needed
   */
  private async checkEscalation(
    taskId: string,
    taskTitle: string,
    missCount: number
  ): Promise<void> {
    let level: 1 | 2 | 3 = 1;
    
    if (missCount >= 5) {
      level = 3; // Intervention
    } else if (missCount >= 3) {
      level = 2; // Direct callout
    }

    if (level > 1) {
      await this.sendCoachingMessage(taskId, taskTitle, missCount, level);
    }
  }

  /**
   * Send coaching message based on escalation level
   */
  private async sendCoachingMessage(
    taskId: string,
    taskTitle: string,
    missCount: number,
    level: 1 | 2 | 3
  ): Promise<void> {
    let message: string;

    switch (level) {
      case 1:
        message = `📋 *Task Check-in*\n\n` +
          `"${taskTitle}" wasn't completed as planned.\n\n` +
          `What happened? Reply with a quick reason.`;
        break;
      
      case 2:
        message = `⚠️ *Pattern Detected*\n\n` +
          `"${taskTitle}" has been missed ${missCount} times now.\n\n` +
          `This is becoming a pattern. What's blocking you? ` +
          `Let's figure out what's really going on.`;
        break;
      
      case 3:
        message = `🚨 *Coaching Intervention*\n\n` +
          `"${taskTitle}" - ${missCount} misses.\n\n` +
          `We need to talk about this. This task keeps getting avoided. Options:\n` +
          `1. Break it into smaller pieces\n` +
          `2. Delegate or get help\n` +
          `3. Accept it's not happening and remove it\n\n` +
          `Which will it be?`;
        break;
    }

    await notificationService.send(message, { 
      priority: level >= 2 ? 'high' : 'normal' 
    });
  }

  // ============================================
  // Pattern Detection
  // ============================================

  /**
   * Analyze patterns in missed tasks
   */
  async analyzePatterns(): Promise<ProductivityPattern[]> {
    const patterns: ProductivityPattern[] = [];

    // Get all missed task records
    const allMissed: MissedTaskRecord[] = [];
    missedTaskRecords.forEach(records => allMissed.push(...records));

    if (allMissed.length < 5) {
      return patterns; // Not enough data
    }

    // Pattern 1: Time of day
    const morningMisses = allMissed.filter(m => m.dueDate.getHours() < 12).length;
    const afternoonMisses = allMissed.filter(m => {
      const h = m.dueDate.getHours();
      return h >= 12 && h < 17;
    }).length;
    const eveningMisses = allMissed.filter(m => m.dueDate.getHours() >= 17).length;

    const total = allMissed.length;
    if (morningMisses / total > 0.5) {
      patterns.push({
        type: 'time_of_day',
        description: 'Morning tasks are frequently missed',
        frequency: morningMisses,
        lastOccurrence: allMissed[allMissed.length - 1].recordedAt,
        suggestion: 'Consider scheduling important tasks for afternoon when you may have more energy',
      });
    }

    // Pattern 2: Specific contexts
    const contextCounts = new Map<string, number>();
    for (const record of allMissed) {
      // Extract context from task title if possible
      const contextMatch = record.taskTitle.match(/- ([^-]+)$/);
      if (contextMatch) {
        const context = contextMatch[1].trim();
        contextCounts.set(context, (contextCounts.get(context) || 0) + 1);
      }
    }

    for (const [context, count] of contextCounts) {
      if (count >= 3) {
        patterns.push({
          type: 'context_avoidance',
          description: `Tasks for "${context}" are frequently avoided`,
          frequency: count,
          lastOccurrence: new Date(),
          suggestion: `Consider what's making "${context}" tasks difficult. Is there a blocker?`,
        });
      }
    }

    // Pattern 3: Recurring excuses
    const allReasons: string[] = [];
    taskMissReasons.forEach(reasons => allReasons.push(...reasons));

    if (allReasons.length >= 3) {
      const reasonCounts = new Map<string, number>();
      for (const reason of allReasons) {
        const lowerReason = reason.toLowerCase();
        // Group similar reasons
        if (lowerReason.includes('time') || lowerReason.includes('busy')) {
          reasonCounts.set('no_time', (reasonCounts.get('no_time') || 0) + 1);
        } else if (lowerReason.includes('forgot') || lowerReason.includes('remember')) {
          reasonCounts.set('forgot', (reasonCounts.get('forgot') || 0) + 1);
        } else if (lowerReason.includes('hard') || lowerReason.includes('difficult')) {
          reasonCounts.set('too_hard', (reasonCounts.get('too_hard') || 0) + 1);
        }
      }

      for (const [reason, count] of reasonCounts) {
        if (count >= 2) {
          let description: string;
          let suggestion: string;

          switch (reason) {
            case 'no_time':
              description = 'Frequently citing lack of time';
              suggestion = 'Review time-blocking. Are you overcommitted?';
              break;
            case 'forgot':
              description = 'Frequently forgetting tasks';
              suggestion = 'Enable more reminder notifications or review tasks in morning ceremony';
              break;
            case 'too_hard':
              description = 'Tasks perceived as too difficult';
              suggestion = 'Break down large tasks into smaller, more manageable pieces';
              break;
            default:
              description = `Recurring reason: ${reason}`;
              suggestion = 'Examine what this pattern reveals';
          }

          patterns.push({
            type: 'excuse_pattern',
            description,
            frequency: count,
            lastOccurrence: new Date(),
            suggestion,
          });
        }
      }
    }

    return patterns;
  }

  // ============================================
  // Goal Tracking
  // ============================================

  // In-memory goal storage (would be in DB in production)
  private goals: Map<string, Goal> = new Map();

  /**
   * Create or update a goal
   */
  async setGoal(goal: Goal): Promise<void> {
    this.goals.set(goal.id, goal);
  }

  /**
   * Get all goals
   */
  getGoals(level?: 'semester' | 'monthly' | 'weekly'): Goal[] {
    const allGoals = Array.from(this.goals.values());
    if (level) {
      return allGoals.filter(g => g.level === level);
    }
    return allGoals;
  }

  /**
   * Update goal progress
   */
  async updateGoalProgress(goalId: string, progress: number): Promise<void> {
    const goal = this.goals.get(goalId);
    if (!goal) return;

    goal.progress = Math.min(100, Math.max(0, progress));
    
    // Update status based on progress and time remaining
    const now = new Date();
    const timeRemaining = goal.targetDate.getTime() - now.getTime();
    const totalTime = goal.targetDate.getTime() - (goal as any).createdAt?.getTime() || timeRemaining * 2;
    const timeUsedPercent = ((totalTime - timeRemaining) / totalTime) * 100;

    if (goal.progress >= 100) {
      goal.status = 'completed';
    } else if (goal.progress >= timeUsedPercent - 10) {
      goal.status = 'on_track';
    } else if (goal.progress >= timeUsedPercent - 25) {
      goal.status = 'at_risk';
    } else {
      goal.status = 'behind';
    }

    this.goals.set(goalId, goal);
  }

  /**
   * Generate goal progress report
   */
  async generateGoalReport(): Promise<string> {
    const goals = this.getGoals();
    
    if (goals.length === 0) {
      return 'No goals set. Consider setting semester, monthly, and weekly goals.';
    }

    let report = '📊 *Goal Progress Report*\n\n';

    for (const level of ['semester', 'monthly', 'weekly'] as const) {
      const levelGoals = goals.filter(g => g.level === level);
      if (levelGoals.length > 0) {
        report += `*${level.charAt(0).toUpperCase() + level.slice(1)} Goals:*\n`;
        for (const goal of levelGoals) {
          const statusEmoji = {
            'completed': '✅',
            'on_track': '🟢',
            'at_risk': '🟡',
            'behind': '🔴',
          }[goal.status];
          report += `${statusEmoji} ${goal.title}: ${goal.progress}%\n`;
        }
        report += '\n';
      }
    }

    return report;
  }

  // ============================================
  // Weekly Coaching Report
  // ============================================

  /**
   * Generate weekly coaching report
   */
  async generateWeeklyReport(): Promise<WeeklyCoachingReport> {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get completed tasks this week
    const completedTasks = await db
      .select({ count: count() })
      .from(tasks)
      .where(
        and(
          eq(tasks.status, 'done'),
          gte(tasks.completedAt, weekAgo)
        )
      );

    const tasksCompleted = completedTasks[0]?.count || 0;

    // Calculate missed tasks from records
    const allMissed: MissedTaskRecord[] = [];
    missedTaskRecords.forEach(records => {
      allMissed.push(...records.filter(r => r.recordedAt >= weekAgo));
    });
    const tasksMissed = allMissed.length;

    // Get time wasted (from time tracking table if available)
    const timeData = await db
      .select()
      .from(timeTracking)
      .where(gte(timeTracking.date, weekAgo.toISOString().split('T')[0]))
      .limit(7);

    const timeWasted = timeData.reduce((sum, t) => sum + (t.wasteMinutes || 0), 0);

    // Get patterns
    const patterns = await this.analyzePatterns();

    // Calculate completion rate
    const totalPlanned = tasksCompleted + tasksMissed;
    const completionRate = totalPlanned > 0 
      ? Math.round((tasksCompleted / totalPlanned) * 100) 
      : 100;

    // Determine escalation level
    let escalationLevel: 1 | 2 | 3 = 1;
    if (completionRate < 50 || timeWasted > 600) { // <50% or >10 hours wasted
      escalationLevel = 3;
    } else if (completionRate < 70 || timeWasted > 300) { // <70% or >5 hours wasted
      escalationLevel = 2;
    }

    // Generate coaching message
    const coachingMessage = await this.generateCoachingMessage(
      tasksCompleted,
      tasksMissed,
      timeWasted,
      patterns,
      escalationLevel
    );

    return {
      tasksCompleted,
      tasksMissed,
      completionRate,
      timeWasted,
      patterns,
      coachingMessage,
      escalationLevel,
    };
  }

  /**
   * Generate personalized coaching message
   */
  private async generateCoachingMessage(
    completed: number,
    missed: number,
    wasted: number,
    patterns: ProductivityPattern[],
    level: 1 | 2 | 3
  ): Promise<string> {
    if (!this.anthropic) {
      // Fallback without AI
      return this.generateFallbackCoachingMessage(completed, missed, wasted, patterns, level);
    }

    try {
      const prompt = `You are an accountability coach with the demeanor of a demanding but invested football coach.

Weekly stats:
- Tasks completed: ${completed}
- Tasks missed: ${missed}
- Completion rate: ${Math.round((completed / (completed + missed)) * 100)}%
- Time wasted on distractions: ${Math.round(wasted / 60)} hours

Patterns detected:
${patterns.map(p => `- ${p.description}: ${p.suggestion}`).join('\n') || 'None detected'}

Escalation level: ${level} (1=neutral observation, 2=direct callout, 3=intervention)

Generate a brief (2-3 sentence) coaching message appropriate for the escalation level. Be direct but supportive. If level 3, be tough but not mean.`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      });

      const textBlock = response.content.find(b => b.type === 'text');
      return textBlock?.text || this.generateFallbackCoachingMessage(completed, missed, wasted, patterns, level);
    } catch (error) {
      return this.generateFallbackCoachingMessage(completed, missed, wasted, patterns, level);
    }
  }

  /**
   * Fallback coaching message without AI
   */
  private generateFallbackCoachingMessage(
    completed: number,
    missed: number,
    wasted: number,
    patterns: ProductivityPattern[],
    level: 1 | 2 | 3
  ): string {
    const rate = Math.round((completed / (completed + missed || 1)) * 100);

    switch (level) {
      case 1:
        return `Good week overall. ${completed} tasks completed, ${rate}% completion rate. ` +
          `${patterns.length > 0 ? 'Watch the patterns emerging.' : 'Keep it up.'}`;
      
      case 2:
        return `We need to talk about this week. ${rate}% completion and ${Math.round(wasted / 60)} hours wasted. ` +
          `That's not the standard we set. What's going on?`;
      
      case 3:
        return `Stop. ${rate}% completion. ${Math.round(wasted / 60)} hours of your life gone to scrolling. ` +
          `This isn't about the tasks - it's about who you're choosing to be. Time to reset.`;
    }
  }

  /**
   * Send the weekly coaching report
   */
  async sendWeeklyCoachingReport(): Promise<void> {
    const report = await this.generateWeeklyReport();
    
    let message = `🏈 *Weekly Coaching Report*\n\n`;
    message += `📊 *Stats:*\n`;
    message += `✅ Completed: ${report.tasksCompleted}\n`;
    message += `❌ Missed: ${report.tasksMissed}\n`;
    message += `📈 Rate: ${report.completionRate}%\n`;
    message += `⏱️ Time wasted: ${Math.round(report.timeWasted / 60)}h\n\n`;

    if (report.patterns.length > 0) {
      message += `*🔍 Patterns:*\n`;
      for (const pattern of report.patterns) {
        message += `• ${pattern.description}\n`;
      }
      message += '\n';
    }

    message += `*💬 Coach Says:*\n${report.coachingMessage}`;

    // Add goals progress if available
    const goalReport = await this.generateGoalReport();
    if (!goalReport.includes('No goals set')) {
      message += `\n\n${goalReport}`;
    }

    await notificationService.send(message, {
      priority: report.escalationLevel >= 2 ? 'high' : 'normal',
    });
  }
}

// ============================================
// Singleton instance
// ============================================

export const coachingService = new CoachingService();

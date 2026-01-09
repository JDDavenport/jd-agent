import { db } from '../db/client';
import { habits, habitCompletions } from '../db/schema';
import { eq, and, desc, gte, lte, sql, isNull, or } from 'drizzle-orm';

// Types
export type HabitFrequency = 'daily' | 'weekly' | 'specific_days';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'anytime';
export type SkipReason = 'rest_day' | 'sick' | 'travel' | 'other';

export interface Habit {
  id: string;
  title: string;
  description?: string | null;
  goalId?: string | null;
  frequency: HabitFrequency;
  frequencyDays?: number[] | null; // 0=Sun, 1=Mon, etc.
  timesPerWeek?: number | null;
  timeOfDay?: TimeOfDay | null;
  cueHabit?: string | null;
  specificTime?: string | null;
  area?: string | null;
  context?: string | null;
  targetPerDay: number;
  currentStreak: number;
  longestStreak: number;
  totalCompletions: number;
  autoCreateTask: boolean;
  taskTemplate?: string | null;
  isActive: boolean;
  pausedUntil?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface HabitCompletion {
  id: string;
  habitId: string;
  date: string;
  completedCount: number;
  completedAt: Date;
  notes?: string | null;
  skipped: boolean;
  skipReason?: SkipReason | null;
}

export interface CreateHabitInput {
  title: string;
  description?: string;
  goalId?: string;
  frequency?: HabitFrequency;
  frequencyDays?: number[];
  timesPerWeek?: number;
  timeOfDay?: TimeOfDay;
  cueHabit?: string;
  specificTime?: string;
  area?: string;
  context?: string;
  targetPerDay?: number;
  autoCreateTask?: boolean;
  taskTemplate?: string;
}

export interface UpdateHabitInput {
  title?: string;
  description?: string;
  goalId?: string | null;
  frequency?: HabitFrequency;
  frequencyDays?: number[];
  timesPerWeek?: number;
  timeOfDay?: TimeOfDay;
  cueHabit?: string;
  specificTime?: string;
  area?: string;
  context?: string;
  targetPerDay?: number;
  autoCreateTask?: boolean;
  taskTemplate?: string;
  isActive?: boolean;
  pausedUntil?: string | null;
}

export interface HabitWithStatus extends Habit {
  completedToday: boolean;
  completedCountToday: number;
  isDueToday: boolean;
  streakStatus: 'active' | 'at_risk' | 'broken';
}

// Day name mapping for parsing
const DAY_NAMES: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

// ============================================
// NATURAL LANGUAGE PARSING
// ============================================

export interface ParsedHabit {
  title: string;
  frequency: HabitFrequency;
  frequencyDays?: number[];
  timesPerWeek?: number;
  timeOfDay?: TimeOfDay;
  context?: string;
  area?: string;
}

/**
 * Parse natural language habit input like Todoist
 * Examples:
 * - "Upper body every monday and tuesday"
 * - "Meditate daily in the morning"
 * - "Run 3x per week"
 * - "Read @home every evening"
 * - "Study MBA notes every weekday"
 */
export function parseHabitInput(input: string): ParsedHabit {
  let title = input.trim();
  let frequency: HabitFrequency = 'daily';
  let frequencyDays: number[] | undefined;
  let timesPerWeek: number | undefined;
  let timeOfDay: TimeOfDay | undefined;
  let context: string | undefined;
  let area: string | undefined;

  // Extract context (@home, @gym, etc.)
  const contextMatch = title.match(/@(\w+)/);
  if (contextMatch) {
    context = contextMatch[1];
    title = title.replace(/@\w+/, '').trim();
  }

  // Extract area (#health, #work, etc.)
  const areaMatch = title.match(/#(\w+)/i);
  if (areaMatch) {
    area = areaMatch[1].charAt(0).toUpperCase() + areaMatch[1].slice(1).toLowerCase();
    title = title.replace(/#\w+/i, '').trim();
  }

  // Extract time of day
  const morningPattern = /\b(in the morning|every morning|mornings?)\b/i;
  const afternoonPattern = /\b(in the afternoon|every afternoon|afternoons?)\b/i;
  const eveningPattern = /\b(in the evening|every evening|evenings?|at night)\b/i;

  if (morningPattern.test(title)) {
    timeOfDay = 'morning';
    title = title.replace(morningPattern, '').trim();
  } else if (afternoonPattern.test(title)) {
    timeOfDay = 'afternoon';
    title = title.replace(afternoonPattern, '').trim();
  } else if (eveningPattern.test(title)) {
    timeOfDay = 'evening';
    title = title.replace(eveningPattern, '').trim();
  }

  // Extract "X times per week" pattern
  const timesPerWeekMatch = title.match(/(\d+)x?\s*(times?\s*)?(per|a|\/)\s*week/i);
  if (timesPerWeekMatch) {
    frequency = 'weekly';
    timesPerWeek = parseInt(timesPerWeekMatch[1]);
    title = title.replace(/(\d+)x?\s*(times?\s*)?(per|a|\/)\s*week/i, '').trim();
  }

  // Extract "every weekday" pattern
  const weekdayPattern = /\b(every\s+)?weekdays?\b/i;
  if (weekdayPattern.test(title)) {
    frequency = 'specific_days';
    frequencyDays = [1, 2, 3, 4, 5]; // Mon-Fri
    title = title.replace(weekdayPattern, '').trim();
  }

  // Extract "every weekend" pattern
  const weekendPattern = /\b(every\s+)?weekends?\b/i;
  if (weekendPattern.test(title)) {
    frequency = 'specific_days';
    frequencyDays = [0, 6]; // Sun, Sat
    title = title.replace(weekendPattern, '').trim();
  }

  // Extract specific days: "every monday and tuesday" or "on mon, wed, fri"
  const specificDaysPattern = /\b(every|on)\s+([a-z,\s]+(?:and\s+[a-z]+)?)\b/i;
  const specificDaysMatch = title.match(specificDaysPattern);
  if (specificDaysMatch && !frequencyDays) {
    const daysStr = specificDaysMatch[2].toLowerCase();
    const dayMatches = daysStr.match(/\b(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:rs(?:day)?)?|fri(?:day)?|sat(?:urday)?)\b/gi);

    if (dayMatches && dayMatches.length > 0) {
      frequencyDays = dayMatches.map(d => DAY_NAMES[d.toLowerCase().slice(0, 3)] ?? DAY_NAMES[d.toLowerCase()]).filter(d => d !== undefined);
      if (frequencyDays.length > 0) {
        frequency = 'specific_days';
        title = title.replace(specificDaysPattern, '').trim();
      }
    }
  }

  // Extract "daily" or "every day"
  const dailyPattern = /\b(daily|every\s*day)\b/i;
  if (dailyPattern.test(title)) {
    frequency = 'daily';
    title = title.replace(dailyPattern, '').trim();
  }

  // Clean up title - remove extra spaces and trailing punctuation
  title = title.replace(/\s+/g, ' ').replace(/[,\s]+$/, '').trim();

  return {
    title,
    frequency,
    frequencyDays: frequencyDays?.length ? frequencyDays : undefined,
    timesPerWeek,
    timeOfDay,
    context,
    area,
  };
}

// ============================================
// HABIT SERVICE
// ============================================

class HabitService {
  // ---- CRUD Operations ----

  async create(input: CreateHabitInput): Promise<Habit> {
    const [habit] = await db
      .insert(habits)
      .values({
        title: input.title,
        description: input.description,
        goalId: input.goalId,
        frequency: input.frequency || 'daily',
        frequencyDays: input.frequencyDays,
        timesPerWeek: input.timesPerWeek,
        timeOfDay: input.timeOfDay,
        cueHabit: input.cueHabit,
        specificTime: input.specificTime,
        area: input.area,
        context: input.context,
        targetPerDay: input.targetPerDay || 1,
        autoCreateTask: input.autoCreateTask || false,
        taskTemplate: input.taskTemplate,
      })
      .returning();

    return habit as Habit;
  }

  /**
   * Create habit from natural language input
   * Example: "Upper body every monday and tuesday @gym #health"
   */
  async createFromNaturalLanguage(input: string, goalId?: string): Promise<Habit> {
    const parsed = parseHabitInput(input);
    return this.create({
      ...parsed,
      goalId,
    });
  }

  async getById(id: string): Promise<Habit | null> {
    const [habit] = await db.select().from(habits).where(eq(habits.id, id));
    return (habit as Habit) || null;
  }

  async list(filters?: {
    isActive?: boolean;
    goalId?: string;
    area?: string;
  }): Promise<Habit[]> {
    let query = db.select().from(habits);

    const conditions = [];
    if (filters?.isActive !== undefined) {
      conditions.push(eq(habits.isActive, filters.isActive));
    }
    if (filters?.goalId) {
      conditions.push(eq(habits.goalId, filters.goalId));
    }
    if (filters?.area) {
      conditions.push(eq(habits.area, filters.area));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const result = await query.orderBy(desc(habits.createdAt));
    return result as Habit[];
  }

  async update(id: string, input: UpdateHabitInput): Promise<Habit | null> {
    const [updated] = await db
      .update(habits)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(habits.id, id))
      .returning();

    return (updated as Habit) || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(habits).where(eq(habits.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // ---- Completion Tracking ----

  async complete(habitId: string, date?: string, notes?: string): Promise<HabitCompletion> {
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Check if already completed today
    const existing = await this.getCompletionForDate(habitId, targetDate);

    if (existing) {
      // Increment completion count
      const [updated] = await db
        .update(habitCompletions)
        .set({
          completedCount: (existing.completedCount || 1) + 1,
          notes: notes || existing.notes,
        })
        .where(eq(habitCompletions.id, existing.id))
        .returning();

      await this.updateStreaks(habitId);
      return updated as HabitCompletion;
    }

    // Create new completion
    const [completion] = await db
      .insert(habitCompletions)
      .values({
        habitId,
        date: targetDate,
        completedCount: 1,
        notes,
        skipped: false,
      })
      .returning();

    await this.updateStreaks(habitId);
    await this.incrementTotalCompletions(habitId);

    return completion as HabitCompletion;
  }

  async skip(habitId: string, date?: string, reason?: SkipReason): Promise<HabitCompletion> {
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Check if already has a record for today
    const existing = await this.getCompletionForDate(habitId, targetDate);

    if (existing) {
      const [updated] = await db
        .update(habitCompletions)
        .set({
          skipped: true,
          skipReason: reason,
        })
        .where(eq(habitCompletions.id, existing.id))
        .returning();

      return updated as HabitCompletion;
    }

    const [completion] = await db
      .insert(habitCompletions)
      .values({
        habitId,
        date: targetDate,
        completedCount: 0,
        skipped: true,
        skipReason: reason,
      })
      .returning();

    return completion as HabitCompletion;
  }

  async getCompletionForDate(habitId: string, date: string): Promise<HabitCompletion | null> {
    const [completion] = await db
      .select()
      .from(habitCompletions)
      .where(and(eq(habitCompletions.habitId, habitId), eq(habitCompletions.date, date)));

    return (completion as HabitCompletion) || null;
  }

  async getCompletionsForDateRange(
    habitId: string,
    startDate: string,
    endDate: string
  ): Promise<HabitCompletion[]> {
    const result = await db
      .select()
      .from(habitCompletions)
      .where(
        and(
          eq(habitCompletions.habitId, habitId),
          gte(habitCompletions.date, startDate),
          lte(habitCompletions.date, endDate)
        )
      )
      .orderBy(desc(habitCompletions.date));

    return result as HabitCompletion[];
  }

  /**
   * Get completions for a habit (most recent first)
   */
  async getCompletions(habitId: string, limit: number = 30): Promise<HabitCompletion[]> {
    const result = await db
      .select()
      .from(habitCompletions)
      .where(eq(habitCompletions.habitId, habitId))
      .orderBy(desc(habitCompletions.date))
      .limit(limit);

    return result as HabitCompletion[];
  }

  // ---- Streak Logic ----

  /**
   * Update streak for a habit using the 2-Day Rule:
   * - Streak continues if completed yesterday or today
   * - Intentional skips (rest day, sick, travel) don't break streaks
   * - Missing 2+ consecutive scheduled days breaks the streak
   */
  async updateStreaks(habitId: string): Promise<void> {
    const habit = await this.getById(habitId);
    if (!habit) return;

    const today = new Date();
    const streak = await this.calculateCurrentStreak(habit);

    const updates: Partial<typeof habits.$inferInsert> = {
      currentStreak: streak,
      updatedAt: new Date(),
    };

    if (streak > habit.longestStreak) {
      updates.longestStreak = streak;
    }

    await db.update(habits).set(updates).where(eq(habits.id, habitId));
  }

  /**
   * Calculate current streak considering:
   * - 2-day rule (missing one day doesn't break streak)
   * - Only count days when habit was scheduled
   * - Skipped days don't break streak
   */
  async calculateCurrentStreak(habit: Habit): Promise<number> {
    const today = new Date();
    let streak = 0;
    let consecutiveMisses = 0;
    const maxLookback = 365; // Don't look back more than a year

    for (let i = 0; i < maxLookback; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];

      // Check if habit was due on this day
      if (!this.isHabitDueOnDate(habit, checkDate)) {
        continue; // Skip non-scheduled days
      }

      const completion = await this.getCompletionForDate(habit.id, dateStr);

      if (completion && !completion.skipped && completion.completedCount > 0) {
        // Completed - reset consecutive misses, increment streak
        consecutiveMisses = 0;
        streak++;
      } else if (completion?.skipped) {
        // Intentionally skipped - doesn't break streak, doesn't add to it
        consecutiveMisses = 0;
      } else {
        // Missed
        consecutiveMisses++;
        if (consecutiveMisses >= 2) {
          // 2-day rule: streak breaks after 2 consecutive misses
          break;
        }
      }
    }

    return streak;
  }

  /**
   * Check if a habit is scheduled for a specific date
   */
  isHabitDueOnDate(habit: Habit, date: Date): boolean {
    const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, etc.

    switch (habit.frequency) {
      case 'daily':
        return true;

      case 'specific_days':
        return habit.frequencyDays?.includes(dayOfWeek) ?? false;

      case 'weekly':
        // For "X times per week", we consider every day as potentially due
        // The actual tracking happens via completion count
        return true;

      default:
        return true;
    }
  }

  private async incrementTotalCompletions(habitId: string): Promise<void> {
    await db
      .update(habits)
      .set({
        totalCompletions: sql`${habits.totalCompletions} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(habits.id, habitId));
  }

  // ---- Today's Habits ----

  /**
   * Get all habits due today with their completion status
   */
  async getTodaysHabits(): Promise<HabitWithStatus[]> {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Get all active habits
    const activeHabits = await this.list({ isActive: true });

    // Filter to habits due today and get their status
    const habitsWithStatus: HabitWithStatus[] = [];

    for (const habit of activeHabits) {
      // Check if paused
      if (habit.pausedUntil && habit.pausedUntil > todayStr) {
        continue;
      }

      const isDueToday = this.isHabitDueOnDate(habit, today);
      if (!isDueToday && habit.frequency !== 'weekly') {
        continue; // Skip if not due today (except weekly habits which are always shown)
      }

      // Get today's completion
      const todayCompletion = await this.getCompletionForDate(habit.id, todayStr);
      const completedToday = todayCompletion ? !todayCompletion.skipped && todayCompletion.completedCount > 0 : false;
      const completedCountToday = todayCompletion?.completedCount || 0;

      // Determine streak status
      let streakStatus: 'active' | 'at_risk' | 'broken' = 'active';
      if (!completedToday) {
        const yesterdayCompletion = await this.getCompletionForDate(habit.id, yesterdayStr);
        const completedYesterday = yesterdayCompletion ? !yesterdayCompletion.skipped && yesterdayCompletion.completedCount > 0 : false;

        if (!completedYesterday && this.isHabitDueOnDate(habit, yesterday)) {
          streakStatus = 'at_risk'; // Missed yesterday and not done today
        }
      }

      if (habit.currentStreak === 0) {
        streakStatus = 'broken';
      }

      habitsWithStatus.push({
        ...habit,
        completedToday,
        completedCountToday,
        isDueToday,
        streakStatus,
      });
    }

    // Sort: incomplete first, then by time of day
    const timeOrder: Record<string, number> = { morning: 1, afternoon: 2, evening: 3, anytime: 4 };
    habitsWithStatus.sort((a, b) => {
      if (a.completedToday !== b.completedToday) {
        return a.completedToday ? 1 : -1; // Incomplete first
      }
      const aTime = timeOrder[a.timeOfDay || 'anytime'] || 4;
      const bTime = timeOrder[b.timeOfDay || 'anytime'] || 4;
      return aTime - bTime;
    });

    return habitsWithStatus;
  }

  /**
   * Get habits linked to a specific goal
   */
  async getHabitsForGoal(goalId: string): Promise<Habit[]> {
    return this.list({ goalId, isActive: true });
  }

  // ---- Statistics ----

  async getWeeklyStats(habitId: string): Promise<{
    completed: number;
    skipped: number;
    missed: number;
    completionRate: number;
  }> {
    const habit = await this.getById(habitId);
    if (!habit) {
      return { completed: 0, skipped: 0, missed: 0, completionRate: 0 };
    }

    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const completions = await this.getCompletionsForDateRange(
      habitId,
      weekAgo.toISOString().split('T')[0],
      today.toISOString().split('T')[0]
    );

    let completed = 0;
    let skipped = 0;
    let scheduledDays = 0;

    // Count scheduled days in the week
    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(weekAgo);
      checkDate.setDate(checkDate.getDate() + i);
      if (this.isHabitDueOnDate(habit, checkDate)) {
        scheduledDays++;
      }
    }

    for (const completion of completions) {
      if (completion.skipped) {
        skipped++;
      } else if (completion.completedCount > 0) {
        completed++;
      }
    }

    const missed = Math.max(0, scheduledDays - completed - skipped);
    const completionRate = scheduledDays > 0 ? Math.round((completed / scheduledDays) * 100) : 0;

    return { completed, skipped, missed, completionRate };
  }

  async getOverallStats(): Promise<{
    totalHabits: number;
    activeHabits: number;
    completedToday: number;
    dueToday: number;
    averageStreak: number;
  }> {
    const allHabits = await this.list();
    const todaysHabits = await this.getTodaysHabits();

    const activeHabits = allHabits.filter(h => h.isActive);
    const completedToday = todaysHabits.filter(h => h.completedToday).length;
    const dueToday = todaysHabits.filter(h => h.isDueToday).length;

    const totalStreak = activeHabits.reduce((sum, h) => sum + h.currentStreak, 0);
    const averageStreak = activeHabits.length > 0 ? Math.round(totalStreak / activeHabits.length) : 0;

    return {
      totalHabits: allHabits.length,
      activeHabits: activeHabits.length,
      completedToday,
      dueToday,
      averageStreak,
    };
  }
}

export const habitService = new HabitService();

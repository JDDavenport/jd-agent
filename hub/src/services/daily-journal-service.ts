import { db } from '../db/client';
import {
  dailyReviews,
  habits,
  habitCompletions,
  goals,
  tasks,
  calendarEvents,
  vaultPages,
  vaultBlocks,
  classPages,
  projects,
} from '../db/schema';
import { eq, and, desc, gte, lte, sql, like, or, inArray } from 'drizzle-orm';
import { habitService } from './habit-service';
import { goalsService } from './goals-service';
import { LIFE_AREAS, isValidLifeArea, type LifeArea } from '../constants/life-areas';
import { vaultPageService } from './vault-page-service';
import { vaultBlockService } from './vault-block-service';
import type {
  DailyReview,
  HabitReviewData,
  GoalsByDomain,
  GoalReviewData,
  TaskReviewData,
  ClassReviewData,
  TomorrowPreviewData,
  TomorrowEvent,
  TomorrowTask,
  TomorrowHabit,
  GetDailyReviewResponse,
  SaveReviewInput,
  CompleteReviewInput,
  CompleteReviewResponse,
  ReviewHistoryResponse,
  ReviewHistoryItem,
  TaskReflection,
  ClassReflection,
  ReviewMood,
} from '@jd-agent/types';

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00');
}

function addDays(dateStr: string, days: number): string {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

function getStreakStatus(
  currentStreak: number,
  completedToday: boolean
): 'active' | 'at_risk' | 'broken' {
  if (completedToday) return 'active';
  if (currentStreak > 0) return 'at_risk'; // Has streak but not done today
  return 'broken';
}

// ============================================
// DAILY JOURNAL SERVICE
// ============================================

class DailyJournalService {
  // ============================================
  // CORE REVIEW OPERATIONS
  // ============================================

  /**
   * Get or create a daily review for a specific date
   */
  async getOrCreateReview(date: string): Promise<DailyReview> {
    // Try to find existing review
    const existing = await db
      .select()
      .from(dailyReviews)
      .where(eq(dailyReviews.date, date))
      .limit(1);

    if (existing.length > 0) {
      return this.mapReviewFromDb(existing[0]);
    }

    // Create new review
    const [created] = await db
      .insert(dailyReviews)
      .values({
        date,
        currentStep: 1,
        reviewCompleted: false,
        startedAt: new Date(),
        tags: [],
        tasksReviewed: [],
        classesReviewed: [],
      })
      .returning();

    return this.mapReviewFromDb(created);
  }

  /**
   * Get all data needed for the daily review workflow
   */
  async getReviewData(date: string): Promise<GetDailyReviewResponse> {
    const [review, habitData, goalsData, completedTasks, classNotes, tomorrowPreview] =
      await Promise.all([
        this.getOrCreateReview(date),
        this.getHabitsForReview(date),
        this.getGoalsForReview(),
        this.getCompletedTasksForDate(date),
        this.getClassNotesForDate(date),
        this.getTomorrowPreview(date),
      ]);

    return {
      review,
      habits: habitData,
      goals: goalsData,
      completedTasks,
      classNotes,
      tomorrowPreview,
    };
  }

  /**
   * Save review draft (auto-save)
   */
  async saveReviewDraft(input: SaveReviewInput): Promise<DailyReview> {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (input.journalText !== undefined) {
      updateData.journalText = input.journalText;
      updateData.wordCount = input.journalText.trim().split(/\s+/).filter(Boolean).length;
    }
    if (input.mood !== undefined) updateData.mood = input.mood;
    if (input.tags !== undefined) updateData.tags = input.tags;
    if (input.tasksReviewed !== undefined) updateData.tasksReviewed = input.tasksReviewed;
    if (input.classesReviewed !== undefined) updateData.classesReviewed = input.classesReviewed;
    if (input.currentStep !== undefined) updateData.currentStep = input.currentStep;

    const [updated] = await db
      .update(dailyReviews)
      .set(updateData)
      .where(eq(dailyReviews.id, input.id))
      .returning();

    return this.mapReviewFromDb(updated);
  }

  /**
   * Complete a review and save to vault
   */
  async completeReview(input: CompleteReviewInput): Promise<CompleteReviewResponse> {
    // Get the review with all its data
    const [review] = await db
      .select()
      .from(dailyReviews)
      .where(eq(dailyReviews.id, input.id))
      .limit(1);

    if (!review) {
      throw new Error('Review not found');
    }

    // Update review with final data
    const [updated] = await db
      .update(dailyReviews)
      .set({
        journalText: input.journalText,
        wordCount: input.journalText.trim().split(/\s+/).filter(Boolean).length,
        mood: input.mood,
        tags: input.tags,
        reviewCompleted: true,
        reviewDurationSeconds: input.reviewDurationSeconds,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(dailyReviews.id, input.id))
      .returning();

    // Generate vault page
    const vaultPage = await this.generateVaultPage(this.mapReviewFromDb(updated));

    // Update review with vault page ID
    await db
      .update(dailyReviews)
      .set({ vaultPageId: vaultPage.id })
      .where(eq(dailyReviews.id, input.id));

    return {
      review: {
        ...this.mapReviewFromDb(updated),
        vaultPageId: vaultPage.id,
      },
      vaultPageId: vaultPage.id,
      vaultUrl: `/vault/pages/${vaultPage.id}`,
    };
  }

  // ============================================
  // STEP 1: HABITS REVIEW
  // ============================================

  async getHabitsForReview(date: string): Promise<HabitReviewData[]> {
    const targetDate = parseDate(date);
    const dayOfWeek = targetDate.getDay(); // 0=Sun, 1=Mon, etc.

    // Get all active habits
    const allHabits = await db
      .select()
      .from(habits)
      .where(eq(habits.isActive, true))
      .orderBy(habits.timeOfDay, habits.title);

    // Get completions for this date
    const completions = await db
      .select()
      .from(habitCompletions)
      .where(eq(habitCompletions.date, date));

    const completionMap = new Map(completions.map((c) => [c.habitId, c]));

    // Get linked goals
    const goalIds = allHabits.filter((h) => h.goalId).map((h) => h.goalId!);
    const linkedGoals =
      goalIds.length > 0
        ? await db.select().from(goals).where(inArray(goals.id, goalIds))
        : [];
    const goalMap = new Map(linkedGoals.map((g) => [g.id, g]));

    return allHabits.map((habit) => {
      const completion = completionMap.get(habit.id);
      const linkedGoal = habit.goalId ? goalMap.get(habit.goalId) : null;

      // Determine if due today based on frequency
      let isDueToday = false;
      if (habit.frequency === 'daily') {
        isDueToday = true;
      } else if (habit.frequency === 'specific_days' && habit.frequencyDays) {
        isDueToday = habit.frequencyDays.includes(dayOfWeek);
      } else if (habit.frequency === 'weekly') {
        // Weekly habits are always "due" but tracked differently
        isDueToday = true;
      }

      const completedToday = !!completion && !completion.skipped;
      const completedCount = completion?.completedCount || 0;

      return {
        id: habit.id,
        title: habit.title,
        description: habit.description || undefined,
        completedToday,
        completedCount,
        targetPerDay: habit.targetPerDay,
        currentStreak: habit.currentStreak,
        longestStreak: habit.longestStreak,
        isDueToday,
        streakStatus: getStreakStatus(habit.currentStreak, completedToday),
        lifeArea: (habit.lifeArea as LifeArea) || undefined,
        timeOfDay: habit.timeOfDay as 'morning' | 'afternoon' | 'evening' | 'anytime' | undefined,
        goalId: habit.goalId || undefined,
        goalTitle: linkedGoal?.title || undefined,
      };
    });
  }

  /**
   * Toggle habit completion for a specific date
   */
  async toggleHabitCompletion(
    habitId: string,
    date: string
  ): Promise<HabitReviewData> {
    // Check if completion exists
    const [existing] = await db
      .select()
      .from(habitCompletions)
      .where(and(eq(habitCompletions.habitId, habitId), eq(habitCompletions.date, date)))
      .limit(1);

    if (existing && !existing.skipped) {
      // Delete completion (toggle off)
      await db
        .delete(habitCompletions)
        .where(eq(habitCompletions.id, existing.id));

      // Update streak
      await habitService.updateStreaks(habitId);
    } else {
      // Create or update completion (toggle on)
      if (existing) {
        await db
          .update(habitCompletions)
          .set({ skipped: false, completedAt: new Date(), completedCount: 1 })
          .where(eq(habitCompletions.id, existing.id));
      } else {
        await db.insert(habitCompletions).values({
          habitId,
          date,
          completedCount: 1,
          completedAt: new Date(),
          skipped: false,
        });
      }

      // Update streak
      await habitService.updateStreaks(habitId);
    }

    // Return updated habit data
    const habitsData = await this.getHabitsForReview(date);
    return habitsData.find((h) => h.id === habitId)!;
  }

  // ============================================
  // STEP 2: GOALS REVIEW
  // ============================================

  async getGoalsForReview(): Promise<GoalsByDomain[]> {
    // Get active goals with their habits
    const activeGoals = await db
      .select()
      .from(goals)
      .where(eq(goals.status, 'active'))
      .orderBy(goals.priority, goals.title);

    // Get habits linked to goals
    const goalHabits = await db
      .select({
        goalId: habits.goalId,
        habitId: habits.id,
      })
      .from(habits)
      .where(and(eq(habits.isActive, true), sql`${habits.goalId} is not null`));

    const habitsByGoal = new Map<string, string[]>();
    goalHabits.forEach((gh) => {
      if (gh.goalId) {
        const existing = habitsByGoal.get(gh.goalId) || [];
        existing.push(gh.habitId);
        habitsByGoal.set(gh.goalId, existing);
      }
    });

    // Group goals by life area
    const goalsByArea = new Map<LifeArea, GoalReviewData[]>();

    activeGoals.forEach((goal) => {
      const area = (goal.lifeArea as LifeArea) || 'personal';
      const existing = goalsByArea.get(area) || [];

      existing.push({
        id: goal.id,
        title: goal.title,
        description: goal.description || undefined,
        progressPercentage: goal.progressPercentage || 0,
        status: goal.status as 'active' | 'completed' | 'paused' | 'abandoned',
        targetDate: goal.targetDate || undefined,
        motivation: goal.motivation || undefined,
        associatedHabits: habitsByGoal.get(goal.id) || [],
      });

      goalsByArea.set(area, existing);
    });

    // Convert to array format
    const result: GoalsByDomain[] = [];
    const lifeAreas: LifeArea[] = ['spiritual', 'personal', 'fitness', 'family', 'professional', 'school'];

    lifeAreas.forEach((area) => {
      const areaGoals = goalsByArea.get(area);
      if (areaGoals && areaGoals.length > 0) {
        const config = LIFE_AREAS[area];
        result.push({
          domain: area,
          icon: config.icon,
          color: config.color,
          goals: areaGoals,
        });
      }
    });

    return result;
  }

  // ============================================
  // STEP 4: TASKS REVIEW
  // ============================================

  async getCompletedTasksForDate(date: string): Promise<TaskReviewData[]> {
    const startOfDay = new Date(date + 'T00:00:00');
    const endOfDay = new Date(date + 'T23:59:59');

    const result = await db
      .select({
        task: tasks,
        project: projects,
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        and(
          eq(tasks.status, 'done'),
          gte(tasks.completedAt, startOfDay),
          lte(tasks.completedAt, endOfDay)
        )
      )
      .orderBy(desc(tasks.completedAt));

    return result.map(({ task, project }) => ({
      id: task.id,
      title: task.title,
      description: task.description || undefined,
      completedAt: task.completedAt?.toISOString() || new Date().toISOString(),
      projectId: task.projectId || undefined,
      projectName: project?.name || undefined,
      context: task.context || undefined,
      reflectionNote: undefined, // Will be filled from review data
    }));
  }

  // ============================================
  // STEP 5: CLASSES REVIEW
  // ============================================

  async getClassNotesForDate(date: string): Promise<ClassReviewData[]> {
    const startOfDay = new Date(date + 'T00:00:00');
    const endOfDay = new Date(date + 'T23:59:59');

    // Get class pages (notes from recordings) for today
    const result = await db
      .select({
        classPage: classPages,
        vaultPage: vaultPages,
        calendarEvent: calendarEvents,
      })
      .from(classPages)
      .innerJoin(vaultPages, eq(classPages.vaultPageId, vaultPages.id))
      .innerJoin(calendarEvents, eq(classPages.calendarEventId, calendarEvents.id))
      .where(
        and(
          gte(calendarEvents.startTime, startOfDay),
          lte(calendarEvents.startTime, endOfDay),
          eq(calendarEvents.eventType, 'class')
        )
      )
      .orderBy(calendarEvents.startTime);

    return result.map(({ classPage, vaultPage, calendarEvent }) => ({
      id: classPage.id,
      className: calendarEvent.title,
      pageId: vaultPage.id,
      pageTitle: vaultPage.title,
      summaryContent: classPage.summaryContent || undefined,
      keyTakeaways: classPage.keyTakeaways || [],
      reflectionNote: undefined,
    }));
  }

  // ============================================
  // STEP 6: TOMORROW PREVIEW
  // ============================================

  async getTomorrowPreview(date: string): Promise<TomorrowPreviewData> {
    const tomorrow = addDays(date, 1);
    const tomorrowStart = new Date(tomorrow + 'T00:00:00');
    const tomorrowEnd = new Date(tomorrow + 'T23:59:59');
    const tomorrowDayOfWeek = tomorrowStart.getDay();

    // Get tomorrow's events
    const events = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          gte(calendarEvents.startTime, tomorrowStart),
          lte(calendarEvents.startTime, tomorrowEnd)
        )
      )
      .orderBy(calendarEvents.startTime);

    // Get tomorrow's tasks (due tomorrow or scheduled for tomorrow)
    const tomorrowTasks = await db
      .select({
        task: tasks,
        project: projects,
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        and(
          or(
            and(gte(tasks.dueDate, tomorrowStart), lte(tasks.dueDate, tomorrowEnd)),
            and(gte(tasks.scheduledStart, tomorrowStart), lte(tasks.scheduledStart, tomorrowEnd))
          ),
          sql`${tasks.status} != 'done'`,
          sql`${tasks.status} != 'archived'`
        )
      )
      .orderBy(desc(tasks.priority), tasks.dueDate);

    // Get tomorrow's habits
    const activeHabits = await db
      .select()
      .from(habits)
      .where(eq(habits.isActive, true))
      .orderBy(habits.timeOfDay, habits.title);

    const tomorrowHabits = activeHabits.filter((habit) => {
      if (habit.frequency === 'daily') return true;
      if (habit.frequency === 'specific_days' && habit.frequencyDays) {
        return habit.frequencyDays.includes(tomorrowDayOfWeek);
      }
      if (habit.frequency === 'weekly') return true;
      return false;
    });

    return {
      events: events.map(
        (e): TomorrowEvent => ({
          id: e.id,
          title: e.title,
          startTime: e.startTime.toISOString(),
          endTime: e.endTime.toISOString(),
          location: e.location || undefined,
          eventType: e.eventType || undefined,
        })
      ),
      tasks: tomorrowTasks.map(
        ({ task, project }): TomorrowTask => ({
          id: task.id,
          title: task.title,
          dueDate: task.dueDate?.toISOString() || undefined,
          priority: task.priority,
          projectName: project?.name || undefined,
          context: task.context || undefined,
        })
      ),
      habits: tomorrowHabits.map(
        (h): TomorrowHabit => ({
          id: h.id,
          title: h.title,
          timeOfDay: h.timeOfDay as 'morning' | 'afternoon' | 'evening' | 'anytime' | undefined,
          currentStreak: h.currentStreak,
        })
      ),
    };
  }

  // ============================================
  // VAULT INTEGRATION
  // ============================================

  /**
   * Generate a vault page for a completed review
   */
  async generateVaultPage(review: DailyReview): Promise<{ id: string }> {
    const dateFormatted = new Date(review.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Create the vault page
    const page = await vaultPageService.create({
      title: `Daily Review - ${dateFormatted}`,
      icon: '📓',
    });

    // Build markdown content
    const moodEmoji = review.mood
      ? { great: '😄', good: '🙂', okay: '😐', difficult: '😔', terrible: '😢' }[review.mood]
      : '😐';

    let content = `# Daily Review - ${dateFormatted}\n\n`;
    content += `**Mood:** ${moodEmoji} ${review.mood || 'Not set'}\n\n`;

    if (review.tags && review.tags.length > 0) {
      content += `**Tags:** ${review.tags.join(', ')}\n\n`;
    }

    content += `---\n\n`;

    // Habits summary
    if (review.habitsTotalCount && review.habitsTotalCount > 0) {
      const rate = review.habitsCompletedCount
        ? Math.round((review.habitsCompletedCount / review.habitsTotalCount) * 100)
        : 0;
      content += `## Habits (${review.habitsCompletedCount || 0}/${review.habitsTotalCount} - ${rate}%)\n\n`;
    }

    // Journal entry
    if (review.journalText) {
      content += `## Journal Entry\n\n${review.journalText}\n\n`;
    }

    // Tasks completed
    if (review.tasksReviewed && review.tasksReviewed.length > 0) {
      content += `## Tasks Completed (${review.tasksReviewed.length})\n\n`;
      review.tasksReviewed.forEach((task) => {
        content += `- ✅ ${task.taskTitle}`;
        if (task.reflectionNote) {
          content += ` - *${task.reflectionNote}*`;
        }
        content += '\n';
      });
      content += '\n';
    }

    // Classes reviewed
    if (review.classesReviewed && review.classesReviewed.length > 0) {
      content += `## Classes\n\n`;
      review.classesReviewed.forEach((cls) => {
        content += `### ${cls.className}\n`;
        if (cls.reflectionNote) {
          content += `${cls.reflectionNote}\n`;
        }
        content += '\n';
      });
    }

    // Footer
    content += `---\n\n`;
    content += `*Review completed in ${Math.round((review.reviewDurationSeconds || 0) / 60)} minutes*\n`;
    content += `*Word count: ${review.wordCount || 0}*\n`;

    // Create content block
    await vaultBlockService.create(page.id, {
      type: 'text',
      content: { text: content },
      sortOrder: 0,
    });

    return { id: page.id };
  }

  // ============================================
  // HISTORY & SEARCH
  // ============================================

  async getReviewHistory(
    page: number = 1,
    limit: number = 20
  ): Promise<ReviewHistoryResponse> {
    const offset = (page - 1) * limit;

    const [reviews, countResult] = await Promise.all([
      db
        .select()
        .from(dailyReviews)
        .orderBy(desc(dailyReviews.date))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(dailyReviews),
    ]);

    const total = countResult[0]?.count || 0;

    return {
      reviews: reviews.map((r): ReviewHistoryItem => {
        const habitsRate =
          r.habitsTotalCount && r.habitsTotalCount > 0
            ? Math.round(((r.habitsCompletedCount || 0) / r.habitsTotalCount) * 100)
            : undefined;

        return {
          id: r.id,
          date: r.date,
          createdAt: r.createdAt.toISOString(),
          journalPreview: r.journalText?.slice(0, 200) || undefined,
          wordCount: r.wordCount || undefined,
          mood: r.mood as ReviewMood | undefined,
          habitsCompletionRate: habitsRate,
          tasksCompleted: r.tasksCompleted || undefined,
          reviewCompleted: r.reviewCompleted || false,
          vaultUrl: r.vaultPageId ? `/vault/pages/${r.vaultPageId}` : undefined,
        };
      }),
      total,
      hasMore: offset + limit < total,
    };
  }

  async searchReviews(query: string): Promise<ReviewHistoryItem[]> {
    const searchPattern = `%${query}%`;

    const reviews = await db
      .select()
      .from(dailyReviews)
      .where(
        or(like(dailyReviews.journalText, searchPattern), like(dailyReviews.reflection, searchPattern))
      )
      .orderBy(desc(dailyReviews.date))
      .limit(50);

    return reviews.map((r): ReviewHistoryItem => {
      const habitsRate =
        r.habitsTotalCount && r.habitsTotalCount > 0
          ? Math.round(((r.habitsCompletedCount || 0) / r.habitsTotalCount) * 100)
          : undefined;

      return {
        id: r.id,
        date: r.date,
        createdAt: r.createdAt.toISOString(),
        journalPreview: r.journalText?.slice(0, 200) || undefined,
        wordCount: r.wordCount || undefined,
        mood: r.mood as ReviewMood | undefined,
        habitsCompletionRate: habitsRate,
        tasksCompleted: r.tasksCompleted || undefined,
        reviewCompleted: r.reviewCompleted || false,
        vaultUrl: r.vaultPageId ? `/vault/pages/${r.vaultPageId}` : undefined,
      };
    });
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private mapReviewFromDb(row: typeof dailyReviews.$inferSelect): DailyReview {
    return {
      id: row.id,
      date: row.date,
      tasksPlanned: row.tasksPlanned || undefined,
      tasksCompleted: row.tasksCompleted || undefined,
      tasksAdded: row.tasksAdded || undefined,
      inboxStart: row.inboxStart || undefined,
      inboxEnd: row.inboxEnd || undefined,
      reflection: row.reflection || undefined,
      journalText: row.journalText || undefined,
      wordCount: row.wordCount || undefined,
      tasksReviewed: (row.tasksReviewed as TaskReflection[]) || [],
      classesReviewed: (row.classesReviewed as ClassReflection[]) || [],
      habitsCompletedCount: row.habitsCompletedCount || undefined,
      habitsTotalCount: row.habitsTotalCount || undefined,
      goalsReviewedCount: row.goalsReviewedCount || undefined,
      tomorrowEventsCount: row.tomorrowEventsCount || undefined,
      tomorrowTasksCount: row.tomorrowTasksCount || undefined,
      tags: row.tags || [],
      mood: row.mood as ReviewMood | undefined,
      currentStep: row.currentStep || 1,
      reviewCompleted: row.reviewCompleted || false,
      reviewDurationSeconds: row.reviewDurationSeconds || undefined,
      vaultPageId: row.vaultPageId || undefined,
      startedAt: row.startedAt?.toISOString() || undefined,
      completedAt: row.completedAt?.toISOString() || undefined,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt?.toISOString() || undefined,
    };
  }

  /**
   * Update habit and goal metrics for a review
   */
  async updateReviewMetrics(reviewId: string, date: string): Promise<void> {
    const [habitsData, goalsData, tomorrowData] = await Promise.all([
      this.getHabitsForReview(date),
      this.getGoalsForReview(),
      this.getTomorrowPreview(date),
    ]);

    const dueHabits = habitsData.filter((h) => h.isDueToday);
    const completedHabits = dueHabits.filter((h) => h.completedToday);
    const totalGoals = goalsData.reduce((sum, area) => sum + area.goals.length, 0);

    await db
      .update(dailyReviews)
      .set({
        habitsCompletedCount: completedHabits.length,
        habitsTotalCount: dueHabits.length,
        goalsReviewedCount: totalGoals,
        tomorrowEventsCount: tomorrowData.events.length,
        tomorrowTasksCount: tomorrowData.tasks.length,
        updatedAt: new Date(),
      })
      .where(eq(dailyReviews.id, reviewId));
  }
}

export const dailyJournalService = new DailyJournalService();

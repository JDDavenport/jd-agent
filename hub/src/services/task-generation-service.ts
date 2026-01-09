/**
 * Task Generation Service
 *
 * Generates tasks from goals, milestones, and habits.
 * Provides automatic task creation for milestone deadlines,
 * goal check-ins, and habit reminders.
 */

import { eq, and, lte, gte, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { goals, milestones, habits, tasks, goalTasks, habitTasks } from '../db/schema';
import { taskService } from './task-service';
import { LIFE_AREAS, type LifeArea } from '../constants/life-areas';

// ============================================
// TYPES
// ============================================

export type GeneratedTaskSource = 'milestone' | 'goal_checkin' | 'habit_reminder' | 'goal_action';

export interface GeneratedTask {
  id: string;
  title: string;
  source: GeneratedTaskSource;
  sourceId: string;
  sourceName: string;
  lifeArea: LifeArea | null;
  dueDate: string | null;
  priority: number;
}

export interface TaskGenerationResult {
  generated: GeneratedTask[];
  skipped: number;
  errors: string[];
}

// ============================================
// SERVICE
// ============================================

class TaskGenerationService {
  /**
   * Generate tasks for upcoming milestones
   * Creates tasks for milestones that are due within the specified days
   */
  async generateMilestoneTasks(daysAhead: number = 7): Promise<TaskGenerationResult> {
    const result: TaskGenerationResult = {
      generated: [],
      skipped: 0,
      errors: [],
    };

    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + daysAhead);
    const todayStr = today.toISOString().split('T')[0];
    const futureDateStr = futureDate.toISOString().split('T')[0];

    try {
      // Get pending milestones with upcoming target dates
      const upcomingMilestones = await db
        .select({
          id: milestones.id,
          title: milestones.title,
          targetDate: milestones.targetDate,
          goalId: milestones.goalId,
          goalTitle: goals.title,
          goalLifeArea: goals.lifeArea,
        })
        .from(milestones)
        .innerJoin(goals, eq(milestones.goalId, goals.id))
        .where(
          and(
            eq(milestones.status, 'pending'),
            gte(milestones.targetDate, todayStr),
            lte(milestones.targetDate, futureDateStr)
          )
        );

      for (const milestone of upcomingMilestones) {
        // Check if task already exists for this milestone
        const existingTask = await db
          .select({ id: goalTasks.taskId })
          .from(goalTasks)
          .where(
            and(
              eq(goalTasks.milestoneId, milestone.id),
              eq(goalTasks.linkType, 'milestone')
            )
          )
          .limit(1);

        if (existingTask.length > 0) {
          result.skipped++;
          continue;
        }

        // Create the task
        const areaInfo = milestone.goalLifeArea
          ? LIFE_AREAS[milestone.goalLifeArea as LifeArea]
          : null;
        const areaPrefix = areaInfo ? `${areaInfo.icon} ` : '';

        const taskTitle = `${areaPrefix}[Milestone] ${milestone.title}`;
        const taskDescription = `Milestone for goal: ${milestone.goalTitle}\n\nComplete this milestone to progress toward your goal.`;

        const task = await taskService.create({
          title: taskTitle,
          description: taskDescription,
          dueDate: milestone.targetDate ? new Date(milestone.targetDate) : undefined,
          priority: 3,
          source: 'agent',
          context: 'goals',
        });

        // Link task to goal and milestone
        await db.insert(goalTasks).values({
          goalId: milestone.goalId,
          taskId: task.id,
          milestoneId: milestone.id,
          linkType: 'milestone',
        });

        result.generated.push({
          id: task.id,
          title: task.title,
          source: 'milestone',
          sourceId: milestone.id,
          sourceName: milestone.title,
          lifeArea: milestone.goalLifeArea as LifeArea | null,
          dueDate: milestone.targetDate,
          priority: 3,
        });
      }
    } catch (error) {
      result.errors.push(`Error generating milestone tasks: ${error}`);
    }

    return result;
  }

  /**
   * Generate goal check-in tasks
   * Creates reminder tasks for goals that haven't been updated recently
   */
  async generateGoalCheckinTasks(inactiveDays: number = 7): Promise<TaskGenerationResult> {
    const result: TaskGenerationResult = {
      generated: [],
      skipped: 0,
      errors: [],
    };

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - inactiveDays);

    try {
      // Get active goals that haven't been updated recently
      const staleGoals = await db
        .select()
        .from(goals)
        .where(
          and(
            eq(goals.status, 'active'),
            lte(goals.updatedAt, cutoffDate)
          )
        );

      for (const goal of staleGoals) {
        // Check if a check-in task already exists (created in last 3 days)
        const recentCheckDate = new Date();
        recentCheckDate.setDate(recentCheckDate.getDate() - 3);

        const existingTask = await db
          .select({ id: goalTasks.taskId })
          .from(goalTasks)
          .innerJoin(tasks, eq(goalTasks.taskId, tasks.id))
          .where(
            and(
              eq(goalTasks.goalId, goal.id),
              eq(goalTasks.linkType, 'checkin'),
              gte(tasks.createdAt, recentCheckDate)
            )
          )
          .limit(1);

        if (existingTask.length > 0) {
          result.skipped++;
          continue;
        }

        // Create the check-in task
        const areaInfo = goal.lifeArea
          ? LIFE_AREAS[goal.lifeArea as LifeArea]
          : null;
        const areaPrefix = areaInfo ? `${areaInfo.icon} ` : '';

        const daysSinceUpdate = Math.floor(
          (Date.now() - goal.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
        );

        const taskTitle = `${areaPrefix}[Check-in] ${goal.title}`;
        const taskDescription = `It's been ${daysSinceUpdate} days since you updated this goal.\n\nCurrent progress: ${goal.progressPercentage || 0}%\n\nTake a moment to:\n• Update your progress\n• Add a reflection\n• Review your milestones`;

        const task = await taskService.create({
          title: taskTitle,
          description: taskDescription,
          priority: 2,
          source: 'agent',
          context: 'goals',
        });

        // Link task to goal
        await db.insert(goalTasks).values({
          goalId: goal.id,
          taskId: task.id,
          linkType: 'checkin',
        });

        result.generated.push({
          id: task.id,
          title: task.title,
          source: 'goal_checkin',
          sourceId: goal.id,
          sourceName: goal.title,
          lifeArea: goal.lifeArea as LifeArea | null,
          dueDate: null,
          priority: 2,
        });
      }
    } catch (error) {
      result.errors.push(`Error generating check-in tasks: ${error}`);
    }

    return result;
  }

  /**
   * Generate a task for a specific goal action
   */
  async generateGoalActionTask(
    goalId: string,
    actionTitle: string,
    actionDescription?: string,
    dueDate?: string
  ): Promise<GeneratedTask | null> {
    try {
      const [goal] = await db
        .select()
        .from(goals)
        .where(eq(goals.id, goalId))
        .limit(1);

      if (!goal) {
        return null;
      }

      const areaInfo = goal.lifeArea
        ? LIFE_AREAS[goal.lifeArea as LifeArea]
        : null;
      const areaPrefix = areaInfo ? `${areaInfo.icon} ` : '';

      const taskTitle = `${areaPrefix}${actionTitle}`;
      const taskDesc = actionDescription || `Action for goal: ${goal.title}`;

      const task = await taskService.create({
        title: taskTitle,
        description: taskDesc,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        priority: 2,
        source: 'agent',
        context: 'goals',
      });

      // Link task to goal
      await db.insert(goalTasks).values({
        goalId: goal.id,
        taskId: task.id,
        linkType: 'action',
      });

      return {
        id: task.id,
        title: task.title,
        source: 'goal_action',
        sourceId: goal.id,
        sourceName: goal.title,
        lifeArea: goal.lifeArea as LifeArea | null,
        dueDate: dueDate || null,
        priority: 2,
      };
    } catch (error) {
      console.error('Error generating goal action task:', error);
      return null;
    }
  }

  /**
   * Generate habit reminder tasks for habits that are at risk
   */
  async generateHabitReminderTasks(): Promise<TaskGenerationResult> {
    const result: TaskGenerationResult = {
      generated: [],
      skipped: 0,
      errors: [],
    };

    try {
      // Get active habits with good streaks that haven't been completed today
      const atRiskHabits = await db
        .select()
        .from(habits)
        .where(
          and(
            eq(habits.isActive, true),
            gte(habits.currentStreak, 3) // Only for habits with meaningful streaks
          )
        );

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      for (const habit of atRiskHabits) {
        // Check if task already exists for today
        const existingTask = await db
          .select({ id: habitTasks.taskId })
          .from(habitTasks)
          .innerJoin(tasks, eq(habitTasks.taskId, tasks.id))
          .where(
            and(
              eq(habitTasks.habitId, habit.id),
              eq(tasks.dueDate, today)
            )
          )
          .limit(1);

        if (existingTask.length > 0) {
          result.skipped++;
          continue;
        }

        // Create the habit reminder task
        const areaInfo = habit.lifeArea
          ? LIFE_AREAS[habit.lifeArea as LifeArea]
          : null;
        const areaPrefix = areaInfo ? `${areaInfo.icon} ` : '';

        const taskTitle = `${areaPrefix}[Habit] ${habit.title}`;
        const taskDescription = `Don't break your ${habit.currentStreak}-day streak!\n\nKeep the momentum going with your ${habit.title} habit.`;

        const task = await taskService.create({
          title: taskTitle,
          description: taskDescription,
          dueDate: today,
          priority: 3,
          source: 'agent',
          context: 'habits',
        });

        // Link task to habit
        await db.insert(habitTasks).values({
          habitId: habit.id,
          taskId: task.id,
          scheduledDate: todayStr,
        });

        result.generated.push({
          id: task.id,
          title: task.title,
          source: 'habit_reminder',
          sourceId: habit.id,
          sourceName: habit.title,
          lifeArea: habit.lifeArea as LifeArea | null,
          dueDate: todayStr,
          priority: 3,
        });
      }
    } catch (error) {
      result.errors.push(`Error generating habit reminder tasks: ${error}`);
    }

    return result;
  }

  /**
   * Run all task generators
   */
  async generateAll(): Promise<{
    milestones: TaskGenerationResult;
    checkins: TaskGenerationResult;
    habits: TaskGenerationResult;
    totalGenerated: number;
  }> {
    const [milestonesResult, checkinsResult, habitsResult] = await Promise.all([
      this.generateMilestoneTasks(),
      this.generateGoalCheckinTasks(),
      this.generateHabitReminderTasks(),
    ]);

    return {
      milestones: milestonesResult,
      checkins: checkinsResult,
      habits: habitsResult,
      totalGenerated:
        milestonesResult.generated.length +
        checkinsResult.generated.length +
        habitsResult.generated.length,
    };
  }

  /**
   * Get tasks linked to a goal
   */
  async getTasksForGoal(goalId: string): Promise<Array<{
    taskId: string;
    taskTitle: string;
    taskStatus: string;
    linkType: string;
    milestoneId: string | null;
    milestoneTitle: string | null;
  }>> {
    const result = await db
      .select({
        taskId: goalTasks.taskId,
        taskTitle: tasks.title,
        taskStatus: tasks.status,
        linkType: goalTasks.linkType,
        milestoneId: goalTasks.milestoneId,
        milestoneTitle: milestones.title,
      })
      .from(goalTasks)
      .innerJoin(tasks, eq(goalTasks.taskId, tasks.id))
      .leftJoin(milestones, eq(goalTasks.milestoneId, milestones.id))
      .where(eq(goalTasks.goalId, goalId));

    return result.map((r) => ({
      taskId: r.taskId,
      taskTitle: r.taskTitle,
      taskStatus: r.taskStatus || 'inbox',
      linkType: r.linkType || 'action',
      milestoneId: r.milestoneId,
      milestoneTitle: r.milestoneTitle,
    }));
  }

  /**
   * Get tasks linked to a habit
   */
  async getTasksForHabit(habitId: string): Promise<Array<{
    taskId: string;
    taskTitle: string;
    taskStatus: string;
    dueDate: string | null;
  }>> {
    const result = await db
      .select({
        taskId: habitTasks.taskId,
        taskTitle: tasks.title,
        taskStatus: tasks.status,
        dueDate: tasks.dueDate,
      })
      .from(habitTasks)
      .innerJoin(tasks, eq(habitTasks.taskId, tasks.id))
      .where(eq(habitTasks.habitId, habitId));

    return result.map((r) => ({
      taskId: r.taskId,
      taskTitle: r.taskTitle,
      taskStatus: r.taskStatus || 'inbox',
      dueDate: r.dueDate ? r.dueDate.toISOString().split('T')[0] : null,
    }));
  }

  /**
   * Link an existing task to a goal
   */
  async linkTaskToGoal(
    taskId: string,
    goalId: string,
    milestoneId?: string,
    linkType: 'action' | 'milestone' | 'checkin' = 'action'
  ): Promise<boolean> {
    try {
      await db.insert(goalTasks).values({
        goalId,
        taskId,
        milestoneId,
        linkType,
      });
      return true;
    } catch (error) {
      console.error('Error linking task to goal:', error);
      return false;
    }
  }

  /**
   * Link an existing task to a habit
   */
  async linkTaskToHabit(taskId: string, habitId: string, scheduledDate?: string): Promise<boolean> {
    try {
      await db.insert(habitTasks).values({
        habitId,
        taskId,
        scheduledDate: scheduledDate || new Date().toISOString().split('T')[0],
      });
      return true;
    } catch (error) {
      console.error('Error linking task to habit:', error);
      return false;
    }
  }

  /**
   * Unlink a task from a goal
   */
  async unlinkTaskFromGoal(taskId: string, goalId: string): Promise<boolean> {
    try {
      await db
        .delete(goalTasks)
        .where(and(eq(goalTasks.taskId, taskId), eq(goalTasks.goalId, goalId)));
      return true;
    } catch (error) {
      console.error('Error unlinking task from goal:', error);
      return false;
    }
  }

  /**
   * Unlink a task from a habit
   */
  async unlinkTaskFromHabit(taskId: string, habitId: string): Promise<boolean> {
    try {
      await db
        .delete(habitTasks)
        .where(and(eq(habitTasks.taskId, taskId), eq(habitTasks.habitId, habitId)));
      return true;
    } catch (error) {
      console.error('Error unlinking task from habit:', error);
      return false;
    }
  }
}

export const taskGenerationService = new TaskGenerationService();

/**
 * Goal Vault Integration Service
 *
 * Integrates goals and reflections with the vault for documentation
 * and knowledge preservation.
 */

import { eq, and, desc, isNull } from 'drizzle-orm';
import { db } from '../db/client';
import { goals, milestones, goalReflections, vaultEntries } from '../db/schema';
import { vaultService } from './vault-service';
import { goalsService } from './goals-service';
import { reflectionsService } from './reflections-service';
import { milestonesService } from './milestones-service';
import { LIFE_AREAS, type LifeArea } from '../constants/life-areas';

// ============================================
// TYPES
// ============================================

export interface GoalJourneyExport {
  vaultEntryId: string;
  goalId: string;
  title: string;
  sections: string[];
}

export interface ReflectionExport {
  vaultEntryId: string;
  reflectionId: string;
  goalId: string;
}

// ============================================
// SERVICE
// ============================================

class GoalVaultIntegration {
  /**
   * Export a goal's complete journey to the vault
   * Creates a comprehensive document with goal details, milestones, and reflections
   */
  async exportGoalJourney(goalId: string): Promise<GoalJourneyExport | null> {
    // Get goal with all relations
    const goal = await goalsService.getByIdWithRelations(goalId);
    if (!goal) return null;

    // Get all milestones
    const goalMilestones = await milestonesService.listByGoal(goalId);

    // Get all reflections
    const reflections = await reflectionsService.listByGoal(goalId);

    // Build the journey document
    const areaInfo = goal.lifeArea ? LIFE_AREAS[goal.lifeArea as LifeArea] : null;
    const areaName = areaInfo?.name || 'General';
    const areaIcon = areaInfo?.icon || '📌';

    const sections: string[] = [];

    // Header section
    sections.push(`# ${areaIcon} ${goal.title}\n`);
    sections.push(`**Life Area:** ${areaName}`);
    sections.push(`**Status:** ${goal.status || 'active'}`);
    sections.push(`**Progress:** ${goal.progressPercentage || 0}%`);
    if (goal.startDate) sections.push(`**Started:** ${goal.startDate}`);
    if (goal.targetDate) sections.push(`**Target:** ${goal.targetDate}`);
    if (goal.completedAt) sections.push(`**Completed:** ${goal.completedAt.toISOString().split('T')[0]}`);
    sections.push('');

    // Description
    if (goal.description) {
      sections.push('## Description\n');
      sections.push(goal.description);
      sections.push('');
    }

    // Motivation & Vision
    if (goal.motivation || goal.vision) {
      sections.push('## Why This Goal Matters\n');
      if (goal.motivation) {
        sections.push(`**Motivation:** ${goal.motivation}`);
      }
      if (goal.vision) {
        sections.push(`**Vision:** ${goal.vision}`);
      }
      sections.push('');
    }

    // Milestones
    if (goalMilestones.length > 0) {
      sections.push('## Milestones\n');
      for (const milestone of goalMilestones) {
        const statusIcon = milestone.status === 'completed' ? '✅' :
                          milestone.status === 'in_progress' ? '🔄' :
                          milestone.status === 'skipped' ? '⏭️' : '⬜';
        sections.push(`${statusIcon} **${milestone.title}**`);
        if (milestone.description) {
          sections.push(`   ${milestone.description}`);
        }
        if (milestone.targetDate) {
          sections.push(`   Target: ${milestone.targetDate}`);
        }
        if (milestone.completedAt) {
          sections.push(`   Completed: ${milestone.completedAt.toISOString().split('T')[0]}`);
        }
        if (milestone.evidence) {
          sections.push(`   Evidence: ${milestone.evidence}`);
        }
        sections.push('');
      }
    }

    // Reflections
    if (reflections.length > 0) {
      sections.push('## Journey Reflections\n');

      // Group by type
      const byType: Record<string, typeof reflections> = {
        win: [],
        progress: [],
        obstacle: [],
        adjustment: [],
      };

      for (const reflection of reflections) {
        const type = reflection.reflectionType || 'progress';
        if (!byType[type]) byType[type] = [];
        byType[type].push(reflection);
      }

      // Wins first
      if (byType.win.length > 0) {
        sections.push('### 🏆 Wins\n');
        for (const r of byType.win) {
          sections.push(`- **${r.createdAt.toISOString().split('T')[0]}:** ${r.content}`);
        }
        sections.push('');
      }

      // Progress updates
      if (byType.progress.length > 0) {
        sections.push('### 📈 Progress Updates\n');
        for (const r of byType.progress) {
          sections.push(`- **${r.createdAt.toISOString().split('T')[0]}:** ${r.content}`);
        }
        sections.push('');
      }

      // Obstacles
      if (byType.obstacle.length > 0) {
        sections.push('### 🚧 Obstacles Faced\n');
        for (const r of byType.obstacle) {
          sections.push(`- **${r.createdAt.toISOString().split('T')[0]}:** ${r.content}`);
        }
        sections.push('');
      }

      // Adjustments
      if (byType.adjustment.length > 0) {
        sections.push('### 🔄 Adjustments Made\n');
        for (const r of byType.adjustment) {
          sections.push(`- **${r.createdAt.toISOString().split('T')[0]}:** ${r.content}`);
        }
        sections.push('');
      }
    }

    // Health score summary
    sections.push('## Goal Health Summary\n');
    sections.push(`- **Health Score:** ${goal.healthScore}/100`);
    sections.push(`- **Linked Habits:** ${goal.habits.length}`);
    sections.push(`- **Total Milestones:** ${goalMilestones.length}`);
    sections.push(`- **Milestones Completed:** ${goalMilestones.filter(m => m.status === 'completed').length}`);
    sections.push(`- **Total Reflections:** ${reflections.length}`);
    sections.push('');

    // Create the vault entry
    const content = sections.join('\n');
    const tags = ['goal-journey', areaName.toLowerCase()];
    if (goal.status === 'completed') tags.push('completed');

    const vaultEntry = await vaultService.create({
      title: `Goal Journey: ${goal.title}`,
      content,
      contentType: 'note',
      context: 'goals',
      tags,
      source: 'goal-export',
      sourceRef: goalId,
      sourceDate: goal.createdAt,
    });

    // Update goal with vault entry reference
    await db
      .update(goals)
      .set({ vaultEntryId: vaultEntry.id })
      .where(eq(goals.id, goalId));

    return {
      vaultEntryId: vaultEntry.id,
      goalId,
      title: goal.title,
      sections: ['Header', 'Description', 'Motivation', 'Milestones', 'Reflections', 'Summary'],
    };
  }

  /**
   * Export a single reflection to the vault
   */
  async exportReflection(reflectionId: string): Promise<ReflectionExport | null> {
    const reflection = await reflectionsService.getById(reflectionId);
    if (!reflection) return null;

    // Get the goal
    const goal = await goalsService.getById(reflection.goalId);
    if (!goal) return null;

    const areaInfo = goal.lifeArea ? LIFE_AREAS[goal.lifeArea as LifeArea] : null;
    const areaIcon = areaInfo?.icon || '📌';

    const typeLabels: Record<string, string> = {
      progress: 'Progress Update',
      obstacle: 'Obstacle',
      win: 'Win',
      adjustment: 'Adjustment',
    };
    const typeLabel = typeLabels[reflection.reflectionType] || 'Reflection';

    const content = `# ${areaIcon} ${typeLabel}: ${goal.title}

**Date:** ${reflection.createdAt.toISOString().split('T')[0]}
**Goal:** ${goal.title}
**Type:** ${typeLabel}
**Sentiment:** ${reflection.sentiment || 'neutral'}

---

${reflection.content}

---

*Goal Progress: ${goal.progressPercentage || 0}%*
`;

    const vaultEntry = await vaultService.create({
      title: `${typeLabel}: ${goal.title} - ${reflection.createdAt.toISOString().split('T')[0]}`,
      content,
      contentType: 'note',
      context: 'reflections',
      tags: ['reflection', reflection.reflectionType, goal.lifeArea || 'general'].filter(Boolean) as string[],
      source: 'reflection-export',
      sourceRef: reflectionId,
      sourceDate: reflection.createdAt,
    });

    return {
      vaultEntryId: vaultEntry.id,
      reflectionId,
      goalId: reflection.goalId,
    };
  }

  /**
   * Get vault entries related to a goal
   */
  async getVaultEntriesForGoal(goalId: string): Promise<Array<{
    id: string;
    title: string;
    contentType: string;
    createdAt: Date;
  }>> {
    const entries = await db
      .select({
        id: vaultEntries.id,
        title: vaultEntries.title,
        contentType: vaultEntries.contentType,
        createdAt: vaultEntries.createdAt,
      })
      .from(vaultEntries)
      .where(eq(vaultEntries.sourceRef, goalId))
      .orderBy(desc(vaultEntries.createdAt));

    return entries;
  }

  /**
   * Create a quick note linked to a goal
   */
  async createGoalNote(
    goalId: string,
    title: string,
    content: string,
    tags?: string[]
  ): Promise<{ vaultEntryId: string }> {
    const goal = await goalsService.getById(goalId);
    if (!goal) {
      throw new Error('Goal not found');
    }

    const areaInfo = goal.lifeArea ? LIFE_AREAS[goal.lifeArea as LifeArea] : null;

    const vaultEntry = await vaultService.create({
      title,
      content: `**Related Goal:** ${goal.title}\n\n---\n\n${content}`,
      contentType: 'note',
      context: 'goals',
      tags: [...(tags || []), 'goal-note', goal.lifeArea || 'general'].filter(Boolean) as string[],
      source: 'manual',
      sourceRef: goalId,
    });

    return { vaultEntryId: vaultEntry.id };
  }

  /**
   * Export all completed goals to vault (for archival)
   */
  async exportCompletedGoals(): Promise<{
    exported: number;
    skipped: number;
    errors: string[];
  }> {
    const result = {
      exported: 0,
      skipped: 0,
      errors: [] as string[],
    };

    // Get completed goals that haven't been exported
    const completedGoals = await db
      .select()
      .from(goals)
      .where(and(
        eq(goals.status, 'completed'),
        isNull(goals.vaultEntryId)
      ));

    for (const goal of completedGoals) {
      try {
        const exportResult = await this.exportGoalJourney(goal.id);
        if (exportResult) {
          result.exported++;
        } else {
          result.skipped++;
        }
      } catch (error) {
        result.errors.push(`Failed to export goal ${goal.id}: ${error}`);
      }
    }

    return result;
  }

  /**
   * Get goal from vault entry reference
   */
  async getGoalFromVaultEntry(vaultEntryId: string): Promise<{
    goalId: string;
    goalTitle: string;
    goalStatus: string;
  } | null> {
    const [goal] = await db
      .select({
        goalId: goals.id,
        goalTitle: goals.title,
        goalStatus: goals.status,
      })
      .from(goals)
      .where(eq(goals.vaultEntryId, vaultEntryId))
      .limit(1);

    if (!goal) return null;

    return {
      goalId: goal.goalId,
      goalTitle: goal.goalTitle,
      goalStatus: goal.goalStatus || 'active',
    };
  }
}

export const goalVaultIntegration = new GoalVaultIntegration();

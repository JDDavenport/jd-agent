/**
 * JD Agent - Integrity Check Service
 * 
 * Validates system consistency and data integrity:
 * - Orphaned records check
 * - Data consistency validation
 * - External sync verification
 * - System health monitoring
 * 
 * Runs automatically twice daily and on-demand.
 */

import { db } from '../db/client';
import { 
  tasks, 
  projects, 
  vaultEntries, 
  recordings, 
  calendarEvents, 
  ceremonies,
  integrityChecks,
  systemLogs,
} from '../db/schema';
import { eq, isNull, and, sql, desc, lt } from 'drizzle-orm';
import { taskService } from './task-service';
import { vaultService } from './vault-service';
import { calendarService } from './calendar-service';

// ============================================
// Types
// ============================================

export type CheckType = 
  | 'orphaned_tasks'
  | 'orphaned_vault_entries'
  | 'calendar_sync'
  | 'task_status_consistency'
  | 'duplicate_detection'
  | 'stale_data'
  | 'database_health'
  | 'external_sync';

export interface CheckResult {
  type: CheckType;
  passed: boolean;
  message: string;
  details?: {
    checked: number;
    issues: number;
    items?: Array<{ id: string; issue: string }>;
  };
  fixable: boolean;
  fixed?: number;
}

export interface IntegrityReport {
  timestamp: Date;
  duration: number;
  totalChecks: number;
  passed: number;
  failed: number;
  warnings: number;
  checks: CheckResult[];
  overallHealth: 'healthy' | 'warning' | 'critical';
}

// ============================================
// Integrity Service
// ============================================

export class IntegrityService {
  /**
   * Run all integrity checks
   */
  async runAllChecks(autoFix: boolean = false): Promise<IntegrityReport> {
    const startTime = Date.now();
    console.log('[Integrity] Starting integrity checks...');

    const checks: CheckResult[] = [];

    // Run each check
    checks.push(await this.checkOrphanedTasks(autoFix));
    checks.push(await this.checkOrphanedVaultEntries(autoFix));
    checks.push(await this.checkTaskStatusConsistency(autoFix));
    checks.push(await this.checkStaleData(autoFix));
    checks.push(await this.checkDuplicates(autoFix));
    checks.push(await this.checkDatabaseHealth());

    // Calculate summary
    const passed = checks.filter(c => c.passed).length;
    const failed = checks.filter(c => !c.passed && !c.fixable).length;
    const warnings = checks.filter(c => !c.passed && c.fixable).length;

    let overallHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (failed > 0) overallHealth = 'critical';
    else if (warnings > 0) overallHealth = 'warning';

    const report: IntegrityReport = {
      timestamp: new Date(),
      duration: Date.now() - startTime,
      totalChecks: checks.length,
      passed,
      failed,
      warnings,
      checks,
      overallHealth,
    };

    // Log results
    await this.logResults(checks);

    console.log(`[Integrity] Complete: ${passed}/${checks.length} passed, health: ${overallHealth}`);

    return report;
  }

  /**
   * Check for orphaned tasks (referencing non-existent projects)
   */
  async checkOrphanedTasks(autoFix: boolean = false): Promise<CheckResult> {
    const orphaned = await db
      .select({ 
        id: tasks.id, 
        title: tasks.title,
        projectId: tasks.projectId 
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(and(
        sql`${tasks.projectId} IS NOT NULL`,
        isNull(projects.id)
      ));

    const result: CheckResult = {
      type: 'orphaned_tasks',
      passed: orphaned.length === 0,
      message: orphaned.length === 0 
        ? 'No orphaned tasks found'
        : `Found ${orphaned.length} tasks with invalid project references`,
      details: {
        checked: orphaned.length,
        issues: orphaned.length,
        items: orphaned.slice(0, 10).map(t => ({
          id: t.id,
          issue: `Task "${t.title}" references non-existent project ${t.projectId}`,
        })),
      },
      fixable: true,
    };

    if (autoFix && orphaned.length > 0) {
      // Clear invalid project references
      for (const task of orphaned) {
        await db
          .update(tasks)
          .set({ projectId: null })
          .where(eq(tasks.id, task.id));
      }
      result.fixed = orphaned.length;
      result.message += ` (${orphaned.length} fixed by clearing project reference)`;
    }

    return result;
  }

  /**
   * Check for orphaned vault entries (referencing non-existent recordings)
   */
  async checkOrphanedVaultEntries(autoFix: boolean = false): Promise<CheckResult> {
    const orphaned = await db
      .select({ 
        id: vaultEntries.id, 
        title: vaultEntries.title,
        recordingId: vaultEntries.recordingId 
      })
      .from(vaultEntries)
      .leftJoin(recordings, eq(vaultEntries.recordingId, recordings.id))
      .where(and(
        sql`${vaultEntries.recordingId} IS NOT NULL`,
        isNull(recordings.id)
      ));

    const result: CheckResult = {
      type: 'orphaned_vault_entries',
      passed: orphaned.length === 0,
      message: orphaned.length === 0 
        ? 'No orphaned vault entries found'
        : `Found ${orphaned.length} vault entries with invalid recording references`,
      details: {
        checked: orphaned.length,
        issues: orphaned.length,
        items: orphaned.slice(0, 10).map(e => ({
          id: e.id,
          issue: `Entry "${e.title}" references non-existent recording`,
        })),
      },
      fixable: true,
    };

    if (autoFix && orphaned.length > 0) {
      for (const entry of orphaned) {
        await db
          .update(vaultEntries)
          .set({ recordingId: null })
          .where(eq(vaultEntries.id, entry.id));
      }
      result.fixed = orphaned.length;
    }

    return result;
  }

  /**
   * Check task status consistency
   */
  async checkTaskStatusConsistency(autoFix: boolean = false): Promise<CheckResult> {
    // Find tasks marked as done but without completedAt
    const inconsistent = await db
      .select({ id: tasks.id, title: tasks.title })
      .from(tasks)
      .where(and(
        eq(tasks.status, 'done'),
        isNull(tasks.completedAt)
      ));

    const result: CheckResult = {
      type: 'task_status_consistency',
      passed: inconsistent.length === 0,
      message: inconsistent.length === 0 
        ? 'All completed tasks have completion timestamps'
        : `Found ${inconsistent.length} completed tasks without completion timestamp`,
      details: {
        checked: inconsistent.length,
        issues: inconsistent.length,
        items: inconsistent.slice(0, 10).map(t => ({
          id: t.id,
          issue: `Task "${t.title}" is done but has no completedAt`,
        })),
      },
      fixable: true,
    };

    if (autoFix && inconsistent.length > 0) {
      const now = new Date();
      for (const task of inconsistent) {
        await db
          .update(tasks)
          .set({ completedAt: now })
          .where(eq(tasks.id, task.id));
      }
      result.fixed = inconsistent.length;
    }

    return result;
  }

  /**
   * Check for stale data
   */
  async checkStaleData(_autoFix: boolean = false): Promise<CheckResult> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Find tasks in "today" status that are more than 7 days old
    const staleTodayTasks = await db
      .select({ id: tasks.id, title: tasks.title, updatedAt: tasks.updatedAt })
      .from(tasks)
      .where(and(
        eq(tasks.status, 'today'),
        lt(tasks.updatedAt, thirtyDaysAgo)
      ));

    // Find tasks in "waiting" status for too long
    const staleWaitingTasks = await db
      .select({ id: tasks.id, title: tasks.title })
      .from(tasks)
      .where(and(
        eq(tasks.status, 'waiting'),
        lt(tasks.updatedAt, thirtyDaysAgo)
      ));

    const totalStale = staleTodayTasks.length + staleWaitingTasks.length;

    return {
      type: 'stale_data',
      passed: totalStale === 0,
      message: totalStale === 0 
        ? 'No stale data detected'
        : `Found ${totalStale} stale items needing attention`,
      details: {
        checked: totalStale,
        issues: totalStale,
        items: [
          ...staleTodayTasks.slice(0, 5).map(t => ({
            id: t.id,
            issue: `"${t.title}" in Today for 30+ days`,
          })),
          ...staleWaitingTasks.slice(0, 5).map(t => ({
            id: t.id,
            issue: `"${t.title}" in Waiting for 30+ days`,
          })),
        ],
      },
      fixable: false, // Requires manual review
    };
  }

  /**
   * Check for duplicates
   */
  async checkDuplicates(_autoFix: boolean = false): Promise<CheckResult> {
    // Find potential duplicate tasks by title
    const duplicateTasks = await db.execute(sql`
      SELECT title, COUNT(*) as count
      FROM tasks
      WHERE status != 'done' AND status != 'archived'
      GROUP BY title
      HAVING COUNT(*) > 1
      LIMIT 10
    `);

    const duplicates = (duplicateTasks.rows || []) as Array<{ title: string; count: number }>;

    return {
      type: 'duplicate_detection',
      passed: duplicates.length === 0,
      message: duplicates.length === 0 
        ? 'No duplicate tasks detected'
        : `Found ${duplicates.length} potential duplicate task titles`,
      details: {
        checked: duplicates.length,
        issues: duplicates.length,
        items: duplicates.map(d => ({
          id: d.title,
          issue: `"${d.title}" appears ${d.count} times`,
        })),
      },
      fixable: false, // Requires manual review
    };
  }

  /**
   * Check database health
   */
  async checkDatabaseHealth(): Promise<CheckResult> {
    try {
      // Run a simple query to check connectivity
      const result = await db.execute(sql`SELECT 1 as health`);
      
      // Get table counts
      const [taskCount] = await db.select({ count: sql<number>`count(*)` }).from(tasks);
      const [vaultCount] = await db.select({ count: sql<number>`count(*)` }).from(vaultEntries);
      const [eventCount] = await db.select({ count: sql<number>`count(*)` }).from(calendarEvents);

      return {
        type: 'database_health',
        passed: true,
        message: 'Database is healthy and responsive',
        details: {
          checked: 1,
          issues: 0,
          items: [
            { id: 'tasks', issue: `${taskCount.count} tasks` },
            { id: 'vault', issue: `${vaultCount.count} vault entries` },
            { id: 'events', issue: `${eventCount.count} calendar events` },
          ],
        },
        fixable: false,
      };
    } catch (error) {
      return {
        type: 'database_health',
        passed: false,
        message: `Database health check failed: ${error}`,
        fixable: false,
      };
    }
  }

  /**
   * Log check results to database
   */
  private async logResults(checks: CheckResult[]): Promise<void> {
    for (const check of checks) {
      try {
        await db.insert(integrityChecks).values({
          checkType: check.type,
          passed: check.passed,
          details: {
            message: check.message,
            ...check.details,
            fixed: check.fixed,
          },
        });
      } catch (error) {
        console.error(`[Integrity] Failed to log check ${check.type}:`, error);
      }
    }

    // Also log to system logs
    const passed = checks.filter(c => c.passed).length;
    const failed = checks.filter(c => !c.passed).length;

    try {
      await db.insert(systemLogs).values({
        logType: failed > 0 ? 'warning' : 'info',
        component: 'integrity',
        message: `Integrity check complete: ${passed}/${checks.length} passed`,
        details: {
          checks: checks.map(c => ({ type: c.type, passed: c.passed })),
        },
      });
    } catch (error) {
      console.error('[Integrity] Failed to log to system logs:', error);
    }
  }

  /**
   * Get recent check history
   */
  async getHistory(limit: number = 20): Promise<Array<{
    type: string;
    passed: boolean;
    details: unknown;
    createdAt: Date;
  }>> {
    const results = await db
      .select()
      .from(integrityChecks)
      .orderBy(desc(integrityChecks.createdAt))
      .limit(limit);

    return results.map(r => ({
      type: r.checkType,
      passed: r.passed,
      details: r.details,
      createdAt: r.createdAt,
    }));
  }

  /**
   * Get system health summary
   */
  async getHealthSummary(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    lastCheck: Date | null;
    recentIssues: number;
    uptime: string;
  }> {
    // Get most recent checks
    const recentChecks = await db
      .select()
      .from(integrityChecks)
      .orderBy(desc(integrityChecks.createdAt))
      .limit(10);

    const lastCheck = recentChecks[0]?.createdAt || null;
    const recentIssues = recentChecks.filter(c => !c.passed).length;

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (recentIssues >= 5) status = 'critical';
    else if (recentIssues > 0) status = 'warning';

    // Calculate uptime (process uptime)
    const uptimeSeconds = process.uptime();
    const hours = Math.floor(uptimeSeconds / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const uptime = `${hours}h ${minutes}m`;

    return {
      status,
      lastCheck,
      recentIssues,
      uptime,
    };
  }
}

// ============================================
// Singleton instance
// ============================================

export const integrityService = new IntegrityService();

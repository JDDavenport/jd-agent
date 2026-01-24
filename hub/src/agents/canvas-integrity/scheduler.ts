import * as cron from 'node-cron';
import { getCanvasIntegrityAgent } from './index';
import { canvasIntegrityService } from '../../services/canvas-integrity-service';
import { notificationService } from '../../services/notification-service';

// ============================================
// Types
// ============================================

interface ScheduledJob {
  name: string;
  schedule: string;
  task: cron.ScheduledTask;
  lastRun?: Date;
  enabled: boolean;
}

// ============================================
// Default Schedules
// ============================================

// Note: Cron format is: second(optional) minute hour day-of-month month day-of-week

const SCHEDULES = {
  // Full audit: Sunday at 2 AM
  fullAudit: {
    cron: '0 2 * * 0',
    name: 'Full Canvas Audit',
    enabled: true,
  },

  // Incremental audit: Daily at 6 AM
  incrementalAudit: {
    cron: '0 6 * * *',
    name: 'Incremental Canvas Audit',
    enabled: true,
  },

  // Quick check: Every 6 hours (0, 6, 12, 18)
  quickCheck: {
    cron: '0 */6 * * *',
    name: 'Quick Canvas Check',
    enabled: true,
  },

  // Daily schedule nudge: 9 AM
  dailyNudge: {
    cron: '0 9 * * *',
    name: 'Daily Schedule Nudge',
    enabled: true,
  },

  // Evening urgent nudge: 6 PM (for urgent unscheduled)
  eveningUrgentNudge: {
    cron: '0 18 * * *',
    name: 'Evening Urgent Nudge',
    enabled: true,
  },
};

// ============================================
// Scheduler
// ============================================

class CanvasIntegrityScheduler {
  private jobs: Map<string, ScheduledJob> = new Map();
  private isInitialized = false;

  initialize(): void {
    if (this.isInitialized) {
      console.log('[CanvasScheduler] Already initialized');
      return;
    }

    console.log('[CanvasScheduler] Initializing scheduled jobs...');

    // Full Audit - Sunday 2 AM
    if (SCHEDULES.fullAudit.enabled) {
      this.registerJob('fullAudit', SCHEDULES.fullAudit.cron, async () => {
        console.log('[CanvasScheduler] Running full audit...');
        try {
          // Check if an audit is already running to prevent concurrent runs
          const runningAudit = await canvasIntegrityService.getRunningAudit();
          if (runningAudit) {
            console.log('[CanvasScheduler] Skipping full audit - audit already in progress');
            return;
          }
          const agent = getCanvasIntegrityAgent();
          const report = await agent.runFullAudit();
          await this.notifyAuditComplete('full', report);
        } catch (error) {
          console.error('[CanvasScheduler] Full audit failed:', error);
          await this.notifyAuditError('full', error);
        }
      });
    }

    // Incremental Audit - Daily 6 AM
    if (SCHEDULES.incrementalAudit.enabled) {
      this.registerJob('incrementalAudit', SCHEDULES.incrementalAudit.cron, async () => {
        console.log('[CanvasScheduler] Running incremental audit...');
        try {
          // Check if an audit is already running to prevent concurrent runs
          const runningAudit = await canvasIntegrityService.getRunningAudit();
          if (runningAudit) {
            console.log('[CanvasScheduler] Skipping incremental audit - audit already in progress');
            return;
          }
          const agent = getCanvasIntegrityAgent();
          const report = await agent.runIncrementalAudit();

          // Only notify if new items discovered
          if (report.tasksCreated > 0 || report.discrepanciesFound > 0) {
            await this.notifyAuditComplete('incremental', report);
          }
        } catch (error) {
          console.error('[CanvasScheduler] Incremental audit failed:', error);
        }
      });
    }

    // Quick Check - Every 6 hours
    if (SCHEDULES.quickCheck.enabled) {
      this.registerJob('quickCheck', SCHEDULES.quickCheck.cron, async () => {
        console.log('[CanvasScheduler] Running quick check...');
        try {
          // Check if an audit is already running to prevent concurrent runs
          const runningAudit = await canvasIntegrityService.getRunningAudit();
          if (runningAudit) {
            console.log('[CanvasScheduler] Skipping quick check - audit already in progress');
            return;
          }
          const agent = getCanvasIntegrityAgent();
          await agent.runQuickCheck();
          // Silent - no notification unless critical issues
        } catch (error) {
          console.error('[CanvasScheduler] Quick check failed:', error);
        }
      });
    }

    // Daily Nudge - 9 AM
    if (SCHEDULES.dailyNudge.enabled) {
      this.registerJob('dailyNudge', SCHEDULES.dailyNudge.cron, async () => {
        console.log('[CanvasScheduler] Checking for unscheduled tasks...');
        try {
          const agent = getCanvasIntegrityAgent();
          await agent.sendScheduleNudge();
        } catch (error) {
          console.error('[CanvasScheduler] Daily nudge failed:', error);
        }
      });
    }

    // Evening Urgent Nudge - 6 PM
    if (SCHEDULES.eveningUrgentNudge.enabled) {
      this.registerJob('eveningUrgentNudge', SCHEDULES.eveningUrgentNudge.cron, async () => {
        console.log('[CanvasScheduler] Checking for urgent unscheduled tasks...');
        try {
          const unscheduled = await canvasIntegrityService.getUnscheduledItems();
          const urgentItems = unscheduled.filter(
            (item) => item.daysUntilDue !== null && item.daysUntilDue <= 1
          );

          if (urgentItems.length > 0) {
            const agent = getCanvasIntegrityAgent();
            await agent.sendScheduleNudge();
          }
        } catch (error) {
          console.error('[CanvasScheduler] Evening urgent nudge failed:', error);
        }
      });
    }

    this.isInitialized = true;
    console.log(`[CanvasScheduler] Initialized ${this.jobs.size} scheduled jobs`);
  }

  private registerJob(name: string, schedule: string, handler: () => Promise<void>): void {
    const task = cron.schedule(schedule, async () => {
      const job = this.jobs.get(name);
      if (job) {
        job.lastRun = new Date();
      }
      await handler();
    });

    this.jobs.set(name, {
      name,
      schedule,
      task,
      enabled: true,
    });

    console.log(`[CanvasScheduler] Registered job: ${name} (${schedule})`);
  }

  private async notifyAuditComplete(type: string, report: { tasksCreated: number; tasksUpdated: number; discrepanciesFound: number; integrityScore: number }): Promise<void> {
    const message = `📊 **Canvas ${type} Audit Complete**

✅ New tasks created: ${report.tasksCreated}
📝 Tasks updated: ${report.tasksUpdated}
⚠️ Discrepancies found: ${report.discrepanciesFound}
📈 Integrity score: ${report.integrityScore}%`;

    try {
      await notificationService.sendTelegram(message);
    } catch (error) {
      console.error('[CanvasScheduler] Failed to send audit notification:', error);
    }
  }

  private async notifyAuditError(type: string, error: unknown): Promise<void> {
    const message = `❌ **Canvas ${type} Audit Failed**

Error: ${String(error)}

Please check the system logs for details.`;

    try {
      await notificationService.sendTelegram(message);
    } catch (sendError) {
      console.error('[CanvasScheduler] Failed to send error notification:', sendError);
    }
  }

  // ----------------------------------------
  // Job Management
  // ----------------------------------------

  startJob(name: string): boolean {
    const job = this.jobs.get(name);
    if (!job) {
      console.log(`[CanvasScheduler] Job not found: ${name}`);
      return false;
    }

    job.task.start();
    job.enabled = true;
    console.log(`[CanvasScheduler] Started job: ${name}`);
    return true;
  }

  stopJob(name: string): boolean {
    const job = this.jobs.get(name);
    if (!job) {
      console.log(`[CanvasScheduler] Job not found: ${name}`);
      return false;
    }

    job.task.stop();
    job.enabled = false;
    console.log(`[CanvasScheduler] Stopped job: ${name}`);
    return true;
  }

  stopAll(): void {
    for (const [name, job] of this.jobs) {
      job.task.stop();
      job.enabled = false;
      console.log(`[CanvasScheduler] Stopped job: ${name}`);
    }
  }

  getStatus(): Array<{ name: string; schedule: string; enabled: boolean; lastRun?: Date }> {
    return Array.from(this.jobs.values()).map((job) => ({
      name: job.name,
      schedule: job.schedule,
      enabled: job.enabled,
      lastRun: job.lastRun,
    }));
  }

  // ----------------------------------------
  // Manual Triggers
  // ----------------------------------------

  async triggerFullAudit(): Promise<void> {
    console.log('[CanvasScheduler] Manually triggering full audit...');
    const agent = getCanvasIntegrityAgent();
    const report = await agent.runFullAudit();
    await this.notifyAuditComplete('full', report);
  }

  async triggerIncrementalAudit(): Promise<void> {
    console.log('[CanvasScheduler] Manually triggering incremental audit...');
    const agent = getCanvasIntegrityAgent();
    const report = await agent.runIncrementalAudit();
    if (report.tasksCreated > 0 || report.discrepanciesFound > 0) {
      await this.notifyAuditComplete('incremental', report);
    }
  }

  async triggerQuickCheck(): Promise<void> {
    console.log('[CanvasScheduler] Manually triggering quick check...');
    const agent = getCanvasIntegrityAgent();
    await agent.runQuickCheck();
  }

  async triggerNudge(): Promise<void> {
    console.log('[CanvasScheduler] Manually triggering schedule nudge...');
    const agent = getCanvasIntegrityAgent();
    await agent.sendScheduleNudge();
  }
}

// ============================================
// Singleton
// ============================================

let schedulerInstance: CanvasIntegrityScheduler | null = null;

export function getCanvasScheduler(): CanvasIntegrityScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new CanvasIntegrityScheduler();
  }
  return schedulerInstance;
}

export function initializeCanvasScheduler(): void {
  const scheduler = getCanvasScheduler();
  scheduler.initialize();
}

export function stopCanvasScheduler(): void {
  if (schedulerInstance) {
    schedulerInstance.stopAll();
  }
}

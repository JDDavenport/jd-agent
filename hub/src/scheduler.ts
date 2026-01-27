/**
 * JD Agent - Scheduled Jobs
 *
 * Handles scheduled/cron jobs:
 * - Morning ceremony + digest (6 AM)
 * - Evening ceremony + digest (9 PM)
 * - Weekly review (Sunday 4 PM)
 * - Canvas sync (every 6 hours)
 * - Email monitoring (every hour)
 * - Integrity checks (twice daily)
 * - Deadline alerts (every 15 minutes)
 * - Google Calendar sync (every 10 minutes)
 */

import { ceremonyService } from './services/ceremony-service';
import { integrityService } from './services/integrity-service';
import { notificationService } from './services/notification-service';
import { verificationService } from './services/verification-service';
import { coachingService } from './services/coaching-service';
import { timeTrackingService } from './services/time-tracking-service';
import { canvasIntegration } from './integrations/canvas';
import { CanvasIntegrityAgent } from './agents/canvas-integrity';
import { gmailIntegration } from './integrations/gmail';
import { remarkableIntegration } from './integrations/remarkable';
import { remarkableGDriveSync } from './services/remarkable-gdrive-sync';
import { remarkableCloudSync } from './services/remarkable-cloud-sync';
import { plaudIntegration } from './integrations/plaud';
import { plaudApiClient } from './integrations/plaud-api';
import { plaudGDriveSync } from './services/plaud-gdrive-sync';
import { plaudBrowserSync } from './services/plaud-browser-sync';
import { addPlaudSyncJob } from './jobs/queue';
import { calendarService } from './services/calendar-service';
import { getGoogleCalendar } from './integrations/google-calendar';
import { acquisitionService } from './services/acquisition-service';
import { adExchangeEnforcementService } from './services/ad-exchange-enforcement-service';
import { cryptoService } from './services/crypto-service';
import { adExchangeMarketIntelligenceService } from './services/ad-exchange-market-intelligence-service';
import { adExchangeAnalyticsService } from './services/ad-exchange-analytics-service';
import { plaidService } from './services/plaid-service';
import { financeService } from './services/finance-service';
import { budgetReportService } from './services/budget-report-service';
import { budgetAlertService } from './services/budget-alert-service';
import { communicationMonitorService } from './services/communication-monitor-service';
import { outlookScraper } from './integrations/outlook-scraper';
import { imessageIntegration } from './integrations/imessage';
import { phoneCallsIntegration } from './integrations/phone-calls';

// ============================================
// Schedule Configuration
// ============================================

interface ScheduledJob {
  name: string;
  hour: number;
  minute: number;
  dayOfWeek?: number; // 0 = Sunday, 1 = Monday, etc.
  run: () => Promise<void>;
  lastRun?: Date;
}

// Interval-based jobs (run every X minutes)
interface IntervalJob {
  name: string;
  intervalMinutes: number;
  run: () => Promise<void>;
  lastRun?: Date;
}

const jobs: ScheduledJob[] = [
  // Morning digest at 5:55 AM (before ceremony)
  {
    name: 'morning-digest',
    hour: 5,
    minute: 55,
    run: async () => {
      console.log('[Scheduler] Sending morning digest...');
      const result = await notificationService.sendMorningDigest();
      console.log(`[Scheduler] Morning digest ${result.success ? 'sent' : 'failed'}`);
    },
  },
  {
    name: 'morning-ceremony',
    hour: 6,
    minute: 0,
    run: async () => {
      console.log('[Scheduler] Running morning ceremony...');
      const result = await ceremonyService.runMorningCeremony();
      console.log(`[Scheduler] Morning ceremony ${result.notificationSent ? 'sent' : 'failed'}`);
    },
  },
  // Daily budget pulse at 7:00 AM
  {
    name: 'daily-budget-pulse',
    hour: 7,
    minute: 0,
    run: async () => {
      console.log('[Scheduler] Sending daily budget pulse...');
      try {
        const result = await budgetReportService.sendDailyPulse();
        console.log(`[Scheduler] Budget pulse: email=${result.emailSent}, sms=${result.smsSent}`);
      } catch (error) {
        console.error('[Scheduler] Budget pulse failed:', error);
      }
    },
  },
  // Weekly budget report at 9:00 AM on Sunday
  {
    name: 'weekly-budget-report',
    hour: 9,
    minute: 0,
    dayOfWeek: 0, // Sunday
    run: async () => {
      console.log('[Scheduler] Sending weekly budget report...');
      try {
        const result = await budgetReportService.sendWeeklyReport();
        console.log(`[Scheduler] Weekly budget report: email=${result.emailSent}, sms=${result.smsSent}`);
      } catch (error) {
        console.error('[Scheduler] Weekly budget report failed:', error);
      }
    },
  },
  // Evening digest at 8:55 PM (before ceremony)
  {
    name: 'evening-digest',
    hour: 20,
    minute: 55,
    run: async () => {
      console.log('[Scheduler] Sending evening digest...');
      const result = await notificationService.sendEveningDigest();
      console.log(`[Scheduler] Evening digest ${result.success ? 'sent' : 'failed'}`);
    },
  },
  {
    name: 'evening-ceremony',
    hour: 21, // 9 PM
    minute: 0,
    run: async () => {
      console.log('[Scheduler] Running evening ceremony...');
      const result = await ceremonyService.runEveningCeremony();
      console.log(`[Scheduler] Evening ceremony ${result.notificationSent ? 'sent' : 'failed'}`);
    },
  },
  {
    name: 'weekly-review',
    hour: 16, // 4 PM
    minute: 0,
    dayOfWeek: 0, // Sunday
    run: async () => {
      console.log('[Scheduler] Running weekly review...');
      const result = await ceremonyService.runWeeklyCeremony();
      console.log(`[Scheduler] Weekly review ${result.notificationSent ? 'sent' : 'failed'}`);
    },
  },
  {
    name: 'ad-exchange-weekly-enforcement',
    hour: 0,
    minute: 0,
    dayOfWeek: 1, // Monday
    run: async () => {
      console.log('[Scheduler] Running ad exchange weekly enforcement...');
      const summary = await adExchangeEnforcementService.runWeeklyEnforcement();
      console.log(
        `[Scheduler] Ad exchange enforcement: ${summary.overdue} overdue, ${summary.reverted} reverted`
      );
    },
  },
  {
    name: 'ad-exchange-market-snapshot',
    hour: 1,
    minute: 30,
    run: async () => {
      console.log('[Scheduler] Generating ad exchange market snapshot...');
      const snapshot = await adExchangeMarketIntelligenceService.getSnapshot();
      const anomalies = await adExchangeMarketIntelligenceService.detectAnomalies();
      console.log(
        `[Scheduler] Ad exchange snapshot: ${snapshot.totalAdSpaces} spaces, ${snapshot.activeAllocations} allocations`
      );
      if (anomalies.length > 0) {
        console.log(`[Scheduler] Ad exchange anomalies: ${anomalies.length} detected`);
      }
    },
  },
  {
    name: 'ad-exchange-weekly-report',
    hour: 2,
    minute: 0,
    dayOfWeek: 1, // Monday
    run: async () => {
      console.log('[Scheduler] Generating ad exchange weekly report...');
      const summary = await adExchangeAnalyticsService.getSummary();
      console.log(
        `[Scheduler] Ad exchange report: ${summary.activeAdSpaces} active spaces, ${summary.weeklyRevenue} revenue, ${(
          summary.paymentComplianceRate * 100
        ).toFixed(1)}% compliance`
      );
    },
  },
  // Canvas sync at 6 AM (full sync with published course check)
  {
    name: 'canvas-daily-check',
    hour: 6,
    minute: 30,
    run: async () => {
      if (!canvasIntegration.isConfigured()) return;
      console.log('[Scheduler] Running Canvas daily check...');
      const result = await canvasIntegration.dailyCheck();
      
      if (result.newlyPublished.length > 0) {
        console.log(`[Scheduler] 🎉 NEW COURSES PUBLISHED: ${result.newlyPublished.join(', ')}`);
        // Send notification about new courses
        const { notificationService } = await import('./services/notification-service');
        await notificationService.send(
          `📚 *Canvas Update*\n\n${result.newlyPublished.length} course(s) now published:\n` +
          result.newlyPublished.map(c => `• ${c}`).join('\n') +
          `\n\n${result.newAssignments} new assignment(s) synced.`
        );
      }
      
      console.log(`[Scheduler] Canvas daily check: ${result.newAssignments} new assignments, ${result.dueSoon.length} due within 7 days`);
    },
  },
  // Canvas sync at noon (catch any new content)
  {
    name: 'canvas-sync-noon',
    hour: 12,
    minute: 0,
    run: async () => {
      if (!canvasIntegration.isConfigured()) return;
      console.log('[Scheduler] Running Canvas sync...');
      const result = await canvasIntegration.fullSync();
      
      if (result.newlyPublished.length > 0) {
        console.log(`[Scheduler] 🎉 NEW COURSES PUBLISHED: ${result.newlyPublished.join(', ')}`);
        const { notificationService } = await import('./services/notification-service');
        await notificationService.send(
          `📚 *Canvas Update*\n\nNew course(s) published: ${result.newlyPublished.join(', ')}`
        );
      }
      
      console.log(`[Scheduler] Canvas sync: ${result.assignments} assignments, ${result.announcements} announcements`);
    },
  },
  // Canvas sync at 6 PM (catch any late-day updates)
  {
    name: 'canvas-sync-evening',
    hour: 18,
    minute: 0,
    run: async () => {
      if (!canvasIntegration.isConfigured()) return;
      console.log('[Scheduler] Running Canvas sync...');
      const result = await canvasIntegration.fullSync();
      console.log(`[Scheduler] Canvas sync: ${result.assignments} assignments, ${result.announcements} announcements`);
    },
  },
  // Canvas Integrity Agent - Full audit with reading detection (once daily)
  {
    name: 'canvas-integrity-audit',
    hour: 7,
    minute: 0,
    run: async () => {
      if (!canvasIntegration.isConfigured()) return;
      console.log('[Scheduler] Running Canvas integrity audit (full - includes readings)...');
      try {
        const agent = new CanvasIntegrityAgent();
        const result = await agent.runAudit('full'); // Visits MODULES, FILES, PAGES for reading detection
        console.log(
          `[Scheduler] Canvas audit complete: ${result.itemsDiscovered} items discovered, ` +
          `${result.tasksCreated} tasks created, ${result.tasksVerified} tasks verified`
        );

        // Notify if new readings found
        if (result.findings.newItems.length > 0) {
          const readingItems = result.findings.newItems.filter(item =>
            item.includes('Reading') || item.includes('Chapter') || item.includes('Case')
          );

          if (readingItems.length > 0) {
            const { notificationService } = await import('./services/notification-service');
            await notificationService.send(
              `📚 *New Canvas Readings Detected*\n\n` +
              `Found ${readingItems.length} new reading(s):\n` +
              readingItems.slice(0, 5).map(item => `• ${item}`).join('\n') +
              (readingItems.length > 5 ? `\n\n_...and ${readingItems.length - 5} more_` : '')
            );
          }
        }
      } catch (error) {
        console.error('[Scheduler] Canvas integrity audit failed:', error);
      }
    },
  },
  // Integrity checks at 8 AM and 8 PM
  {
    name: 'integrity-check-morning',
    hour: 8,
    minute: 0,
    run: async () => {
      console.log('[Scheduler] Running integrity checks...');
      const result = await integrityService.runAllChecks(true);
      console.log(`[Scheduler] Integrity: ${result.passed} passed, ${result.failed} failed`);
    },
  },
  {
    name: 'integrity-check-evening',
    hour: 20,
    minute: 0,
    run: async () => {
      console.log('[Scheduler] Running integrity checks...');
      const result = await integrityService.runAllChecks(true);
      console.log(`[Scheduler] Integrity: ${result.passed} passed, ${result.failed} failed`);
    },
  },
  // Phase 3: Full verification at 10 AM and 4 PM
  {
    name: 'verification-morning',
    hour: 10,
    minute: 0,
    run: async () => {
      console.log('[Scheduler] Running full verification...');
      const result = await verificationService.runFullVerification({
        notifyOnFailure: true,
        autoCorrect: false,
      });
      console.log(`[Scheduler] Verification: ${result.overallStatus} (${result.summary.passed} passed, ${result.summary.failed} failed)`);
    },
  },
  {
    name: 'verification-afternoon',
    hour: 16,
    minute: 0,
    run: async () => {
      console.log('[Scheduler] Running full verification...');
      const result = await verificationService.runFullVerification({
        notifyOnFailure: true,
        autoCorrect: true, // Try auto-correction in afternoon
      });
      console.log(`[Scheduler] Verification: ${result.overallStatus}`);
    },
  },
  // Weekly coaching report on Sunday at 5 PM
  {
    name: 'weekly-coaching',
    hour: 17,
    minute: 0,
    dayOfWeek: 0, // Sunday
    run: async () => {
      console.log('[Scheduler] Sending weekly coaching report...');
      await coachingService.sendWeeklyCoachingReport();
      console.log('[Scheduler] Weekly coaching report sent');
    },
  },
  // Plaud web sync with Deepgram transcription - 3x daily
  {
    name: 'plaud-web-sync-morning',
    hour: 8,
    minute: 0,
    run: async () => {
      console.log('[Scheduler] Queueing Plaud web sync (morning)...');
      await addPlaudSyncJob({ transcribeNew: true });
      console.log('[Scheduler] Plaud web sync job queued');
    },
  },
  {
    name: 'plaud-web-sync-afternoon',
    hour: 14,
    minute: 0,
    run: async () => {
      console.log('[Scheduler] Queueing Plaud web sync (afternoon)...');
      await addPlaudSyncJob({ transcribeNew: true });
      console.log('[Scheduler] Plaud web sync job queued');
    },
  },
  {
    name: 'plaud-web-sync-evening',
    hour: 20,
    minute: 0,
    run: async () => {
      console.log('[Scheduler] Queueing Plaud web sync (evening)...');
      await addPlaudSyncJob({ transcribeNew: true });
      console.log('[Scheduler] Plaud web sync job queued');
    },
  },
  // Task archival at 2 AM - archive completed tasks older than 1 day
  {
    name: 'task-archival',
    hour: 2,
    minute: 0,
    run: async () => {
      console.log('[Scheduler] Running task archival...');
      try {
        const { TaskArchiveService } = await import('./services/task-archive-service');
        const taskArchiveService = new TaskArchiveService();
        const result = await taskArchiveService.archiveCompletedTasks(1); // 1 day old
        console.log(`[Scheduler] Archived ${result.tasksArchived} tasks to vault`);
        if (result.errors.length > 0) {
          console.warn(`[Scheduler] Task archival errors: ${result.errors.length}`);
        }
      } catch (error) {
        console.error('[Scheduler] Task archival failed:', error);
      }
    },
  },
  // Acquisition follow-up reminders at 8 AM
  {
    name: 'acquisition-follow-up-reminder',
    hour: 8,
    minute: 0,
    run: async () => {
      console.log('[Scheduler] Checking acquisition follow-ups...');
      const followUps = await acquisitionService.getFollowUps();

      if (followUps.length === 0) {
        console.log('[Scheduler] No acquisition follow-ups due today');
        return;
      }

      console.log(`[Scheduler] Found ${followUps.length} acquisition follow-ups due`);

      // Send notification about due follow-ups
      let message = '📋 *Acquisition Follow-ups Due*\n\n';
      message += `You have ${followUps.length} lead${followUps.length > 1 ? 's' : ''} requiring follow-up:\n\n`;

      for (const lead of followUps.slice(0, 5)) {
        const stage = lead.pipelineStage?.replace(/_/g, ' ') || 'unknown';
        const score = lead.acquisitionScore !== null ? ` (Score: ${lead.acquisitionScore})` : '';
        message += `• *${lead.businessName}*${score}\n  Stage: ${stage}\n`;
      }

      if (followUps.length > 5) {
        message += `\n_...and ${followUps.length - 5} more_`;
      }

      message += '\n\n_Check Command Center → Acquisition for details._';

      await notificationService.send(message);
      console.log('[Scheduler] Acquisition follow-up reminder sent');
    },
  },
];

// Interval jobs for more frequent tasks
const intervalJobs: IntervalJob[] = [
  {
    name: 'crypto-market-refresh',
    intervalMinutes: 1,
    run: async () => {
      console.log('[Scheduler] Refreshing crypto market data...');
      await cryptoService.refreshMarketData(false);
      console.log('[Scheduler] Crypto market refresh complete');
    },
  },
  {
    name: 'crypto-network-refresh',
    intervalMinutes: 10,
    run: async () => {
      console.log('[Scheduler] Refreshing crypto network data...');
      await cryptoService.refreshNetworkDataNow(true);
      console.log('[Scheduler] Crypto network refresh complete');
    },
  },
  {
    name: 'google-calendar-sync',
    intervalMinutes: 10, // Every 10 minutes - keep calendar up to date
    run: async () => {
      const googleCalendar = getGoogleCalendar();
      if (!googleCalendar.isConfigured()) return;
      console.log('[Scheduler] Syncing Google Calendar...');
      const result = await calendarService.syncFromGoogle(30); // Sync 30 days ahead
      console.log(`[Scheduler] Calendar: ${result.created} created, ${result.updated} updated`);
    },
  },
  {
    name: 'finance-sync',
    intervalMinutes: 15, // Near real-time transaction updates
    run: async () => {
      if (!plaidService.isConfigured()) return;
      const hasAccounts = await financeService.isConfigured();
      if (!hasAccounts) return;
      console.log('[Scheduler] Syncing finance accounts...');
      const result = await plaidService.syncAllAccounts();
      console.log(
        `[Scheduler] Finance sync: ${result.added} added, ${result.modified} modified, ${result.removed} removed`
      );
    },
  },
  {
    name: 'finance-budget-alerts',
    intervalMinutes: 30,
    run: async () => {
      console.log('[Scheduler] Checking budget alerts...');
      const result = await financeService.checkBudgetAlerts();
      if (result.alertsSent > 0) {
        console.log(`[Scheduler] Budget alerts sent: ${result.alertsSent}`);
      }
    },
  },
  {
    name: 'smart-budget-alerts',
    intervalMinutes: 60, // Every hour
    run: async () => {
      console.log('[Scheduler] Running smart budget alerts...');
      try {
        const result = await budgetAlertService.runAllChecks();
        if (result.totalAlertsSent > 0) {
          console.log(`[Scheduler] Smart alerts sent: ${result.totalAlertsSent}`);
        }
      } catch (error) {
        console.error('[Scheduler] Smart budget alerts failed:', error);
      }
    },
  },
  {
    name: 'deadline-alerts',
    intervalMinutes: 15, // Every 15 minutes
    run: async () => {
      console.log('[Scheduler] Checking deadline alerts...');
      await notificationService.checkAndSendDeadlineAlerts();
    },
  },
  {
    name: 'time-waste-check',
    intervalMinutes: 60, // Every hour
    run: async () => {
      console.log('[Scheduler] Checking time waste threshold...');
      const exceeded = await timeTrackingService.checkWasteThreshold(120); // 2 hour threshold
      if (exceeded) {
        console.log('[Scheduler] Time waste threshold exceeded - alert sent');
      }
    },
  },
  {
    name: 'email-monitor',
    intervalMinutes: 60, // Every hour
    run: async () => {
      if (!gmailIntegration.isReady()) return;
      console.log('[Scheduler] Checking emails...');
      const result = await gmailIntegration.queueEmailsForTriage();
      console.log(`[Scheduler] Emails: ${result.queued} queued for triage`);
    },
  },
  {
    name: 'remarkable-sync',
    intervalMinutes: 30, // Every 30 minutes
    run: async () => {
      if (!remarkableIntegration.isConfigured()) return;
      console.log('[Scheduler] Syncing Remarkable notes...');
      const result = await remarkableIntegration.syncAll();
      console.log(`[Scheduler] Remarkable: ${result.processed} processed, ${result.skipped} skipped`);
    },
  },
  {
    name: 'remarkable-gdrive-sync',
    intervalMinutes: 30, // Every 30 minutes - downloads PDFs from Google Drive
    run: async () => {
      if (!remarkableGDriveSync.isConfigured()) return;
      console.log('[Scheduler] Syncing Remarkable from Google Drive...');
      const result = await remarkableGDriveSync.sync();
      console.log(`[Scheduler] Remarkable GDrive: ${result.downloaded} downloaded, ${result.skipped} skipped`);
      if (result.errors.length > 0) {
        console.error(`[Scheduler] Remarkable GDrive errors: ${result.errors.join(', ')}`);
      }
    },
  },
  {
    name: 'remarkable-cloud-sync',
    intervalMinutes: 30, // Every 30 minutes - monitor Remarkable Cloud for changes
    run: async () => {
      if (!remarkableCloudSync.isConfigured()) return;
      console.log('[Scheduler] Syncing with Remarkable Cloud...');
      const result = await remarkableCloudSync.sync();
      console.log(`[Scheduler] Remarkable Cloud: ${result.documentsFound} documents, ${result.changes.length} changes`);

      // Automatically process changes - download, render PDF, store in vault
      if (result.changes.length > 0) {
        const { VaultService } = await import('./services/vault-service');
        const vaultService = new VaultService();
        const processedDocs: string[] = [];
        const failedDocs: string[] = [];

        for (const change of result.changes) {
          try {
            console.log(`[Scheduler] Processing Remarkable document: ${change.document.name}`);

            // Download, render to PDF, and extract text via OCR
            const { pdfPath, pdfUrl, documentName, ocrText } = await remarkableCloudSync.downloadAndRenderPdf(change.document.id);
            console.log(`[Scheduler] Rendered PDF: ${pdfPath}`);
            console.log(`[Scheduler] PDF URL: ${pdfUrl}`);
            if (ocrText) {
              console.log(`[Scheduler] OCR extracted ${ocrText.length} characters`);
            }

            // Build content with OCR text
            let content = `Handwritten notes from Remarkable tablet.\n\n`;
            content += `Document ID: ${change.document.id}\n`;
            content += `Last modified: ${new Date(change.document.lastModified).toISOString()}\n`;

            if (ocrText) {
              content += `\n---\n\n## Extracted Text (OCR)\n\n${ocrText}`;
            }

            // Create vault entry for the document
            const entry = await vaultService.create({
              title: documentName,
              content,
              contentType: 'class_notes',
              context: 'Remarkable Notes',
              tags: ['remarkable', 'handwritten', change.changeType === 'new' ? 'new' : 'updated', ocrText ? 'ocr' : 'no-ocr'],
              source: 'remarkable',
              sourceRef: change.document.id,
              sourceDate: new Date(change.document.lastModified),
            });

            // Add PDF as attachment
            const fs = await import('fs');
            const stats = fs.statSync(pdfPath);
            const pdfFilename = pdfPath.split('/').pop() || `${documentName}.pdf`;

            await vaultService.addAttachment({
              entryId: entry.id,
              filename: pdfFilename,
              mimeType: 'application/pdf',
              size: stats.size,
              storagePath: pdfUrl, // URL path for serving
              extractedText: ocrText || undefined,
            });

            processedDocs.push(documentName);
            console.log(`[Scheduler] Stored in vault: ${documentName}`);
          } catch (error) {
            console.error(`[Scheduler] Failed to process ${change.document.name}:`, error);
            failedDocs.push(change.document.name);
          }
        }

        // Send notification with results
        const { notificationService } = await import('./services/notification-service');
        let message = '📝 *Remarkable Notes Synced*\n\n';

        if (processedDocs.length > 0) {
          message += `*Processed (${processedDocs.length}):* `;
          message += processedDocs.slice(0, 3).join(', ');
          if (processedDocs.length > 3) message += ` +${processedDocs.length - 3} more`;
          message += '\n';
        }
        if (failedDocs.length > 0) {
          message += `*Failed (${failedDocs.length}):* `;
          message += failedDocs.slice(0, 3).join(', ');
          if (failedDocs.length > 3) message += ` +${failedDocs.length - 3} more`;
          message += '\n';
        }
        message += '\n_Notes have been automatically synced to your vault._';

        await notificationService.send(message);
        remarkableCloudSync.markNotified(result.changes.map(c => c.document.id));
      }
    },
  },
  {
    name: 'plaud-sync',
    intervalMinutes: 15, // Every 15 minutes
    run: async () => {
      // Try browser sync first (most reliable - uses persistent session)
      if (plaudBrowserSync.isConfigured()) {
        console.log('[Scheduler] Syncing Plaud recordings via browser...');
        const browserResult = await plaudBrowserSync.sync();
        console.log(`[Scheduler] Plaud Browser: ${browserResult.synced} synced, ${browserResult.skipped} skipped`);
        if (browserResult.newRecordings.length > 0) {
          console.log(`[Scheduler] New recordings: ${browserResult.newRecordings.join(', ')}`);
        }
        // If browser sync works, skip other methods
        if (browserResult.success) return;
      }

      // Try API sync (if browser sync fails or not configured)
      if (plaudApiClient.isConfigured()) {
        console.log('[Scheduler] Syncing Plaud recordings via API...');
        const apiResult = await plaudApiClient.syncNewRecordings();
        console.log(`[Scheduler] Plaud API: ${apiResult.synced} synced, ${apiResult.skipped} skipped`);
        if (apiResult.newRecordings.length > 0) {
          console.log(`[Scheduler] New recordings: ${apiResult.newRecordings.join(', ')}`);
        }
      }

      // Try Google Drive sync (for Plaud app → Save to Drive exports)
      if (plaudGDriveSync.isConfigured()) {
        console.log('[Scheduler] Syncing Plaud from Google Drive...');
        const gdriveResult = await plaudGDriveSync.sync();
        console.log(`[Scheduler] Plaud GDrive: ${gdriveResult.processed} processed, ${gdriveResult.skipped} skipped`);
        if (gdriveResult.newRecordings.length > 0) {
          console.log(`[Scheduler] New from Drive: ${gdriveResult.newRecordings.join(', ')}`);
        }
      }

      // Also check local folder (for AirDrop/manual drops)
      if (plaudIntegration.isConfigured()) {
        console.log('[Scheduler] Syncing Plaud local folder...');
        const result = await plaudIntegration.syncAll();
        console.log(`[Scheduler] Plaud Local: ${result.uploaded} uploaded, ${result.queued} queued`);
      }
    },
  },
  // ============================================
  // Communication Monitoring Jobs
  // ============================================
  {
    name: 'outlook-monitor',
    intervalMinutes: 10, // Check Outlook every 10 minutes
    run: async () => {
      if (!outlookScraper.isConfigured()) return;
      console.log('[Scheduler] Checking Outlook...');
      const result = await communicationMonitorService.checkOutlook();
      console.log(`[Scheduler] Outlook: ${result.new} new, ${result.urgent} urgent, ${result.notified} notified`);
    },
  },
  {
    name: 'imessage-monitor',
    intervalMinutes: 2, // Check iMessage every 2 minutes
    run: async () => {
      if (!imessageIntegration.isConfigured()) return;
      console.log('[Scheduler] Checking iMessage...');
      const result = await communicationMonitorService.checkIMessage();
      console.log(`[Scheduler] iMessage: ${result.new} new, ${result.urgent} urgent, ${result.notified} notified`);
    },
  },
  {
    name: 'phone-calls-monitor',
    intervalMinutes: 5, // Check for missed calls every 5 minutes
    run: async () => {
      if (!phoneCallsIntegration.isConfigured()) return;
      console.log('[Scheduler] Checking phone calls...');
      const result = await communicationMonitorService.checkPhoneCalls();
      console.log(`[Scheduler] Phone: ${result.new} missed, ${result.urgent} urgent, ${result.notified} notified`);
    },
  },
];

// ============================================
// Scheduler Logic
// ============================================

function shouldRun(job: ScheduledJob, now: Date): boolean {
  // Check hour and minute
  if (now.getHours() !== job.hour || now.getMinutes() !== job.minute) {
    return false;
  }

  // Check day of week if specified
  if (job.dayOfWeek !== undefined && now.getDay() !== job.dayOfWeek) {
    return false;
  }

  // Check if already run this minute
  if (job.lastRun) {
    const lastRunMinute = new Date(job.lastRun);
    lastRunMinute.setSeconds(0, 0);
    
    const nowMinute = new Date(now);
    nowMinute.setSeconds(0, 0);
    
    if (lastRunMinute.getTime() === nowMinute.getTime()) {
      return false;
    }
  }

  return true;
}

function shouldRunInterval(job: IntervalJob, now: Date): boolean {
  if (!job.lastRun) {
    return true;
  }

  const elapsedMs = now.getTime() - job.lastRun.getTime();
  const intervalMs = job.intervalMinutes * 60 * 1000;
  
  return elapsedMs >= intervalMs;
}

async function checkSchedule() {
  const now = new Date();

  // Check time-based jobs
  for (const job of jobs) {
    if (shouldRun(job, now)) {
      try {
        await job.run();
        job.lastRun = now;
      } catch (error) {
        console.error(`[Scheduler] Job ${job.name} failed:`, error);
      }
    }
  }

  // Check interval-based jobs
  for (const job of intervalJobs) {
    if (shouldRunInterval(job, now)) {
      try {
        await job.run();
        job.lastRun = now;
      } catch (error) {
        console.error(`[Scheduler] Interval job ${job.name} failed:`, error);
      }
    }
  }
}

// ============================================
// Startup
// ============================================

console.log(`
╔══════════════════════════════════════════════════════════════╗
║  JD Agent - Scheduler                                        ║
║  Phase 3: Verify & Coach                                     ║
╚══════════════════════════════════════════════════════════════╝
`);

console.log('Time-based jobs:');
for (const job of jobs) {
  const timeStr = `${job.hour.toString().padStart(2, '0')}:${job.minute.toString().padStart(2, '0')}`;
  const dayStr = job.dayOfWeek !== undefined 
    ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][job.dayOfWeek]
    : 'Daily';
  console.log(`  - ${job.name}: ${dayStr} at ${timeStr}`);
}

console.log('\nInterval-based jobs:');
for (const job of intervalJobs) {
  console.log(`  - ${job.name}: every ${job.intervalMinutes} minutes`);
}

console.log('\nIntegration status:');
console.log(`  - Google Calendar: ${getGoogleCalendar().isConfigured() ? '✓ Configured (sync every 10 min)' : '✗ Not configured'}`);
console.log(`  - Canvas: ${canvasIntegration.isConfigured() ? '✓ Configured' : '✗ Not configured'}`);
console.log(`  - Gmail: ${gmailIntegration.isReady() ? '✓ Ready' : '✗ Not configured'}`);
console.log(`  - Remarkable: ${remarkableIntegration.isConfigured() ? '✓ Configured' : '✗ Not configured'}`);
console.log(`  - Remarkable GDrive: ${remarkableGDriveSync.isConfigured() ? '✓ Configured (auto-sync from Google Drive)' : '✗ Not configured'}`);
console.log(`  - Remarkable Cloud: ${remarkableCloudSync.isConfigured() ? '✓ Configured (change detection)' : '✗ Not configured'}`);
console.log(`  - Plaud Browser: ${plaudBrowserSync.isConfigured() ? '✓ Configured (auto-login sync)' : '✗ Not configured'}`);
console.log(`  - Plaud Local: ${plaudIntegration.isConfigured() ? '✓ Configured' : '✗ Not configured'}`);
console.log(`  - Plaud GDrive: ${plaudGDriveSync.isConfigured() ? '✓ Configured (auto-sync from Google Drive)' : '✗ Not configured'}`);
console.log(`  - Plaud API: ${plaudApiClient.isConfigured() ? '✓ Configured (auto-sync)' : '✗ Not configured'}`);
const plaudSessionPath = '/Users/jddavenport/Documents/PlaudSync/.plaud-auth.json';
const plaudSessionExists = require('fs').existsSync(plaudSessionPath);
console.log(`  - Plaud Web: ${plaudSessionExists ? '✓ Session saved (3x daily sync + Deepgram)' : '✗ No session - run plaud-login.ts'}`);

console.log('\n[Scheduler] Starting... checking every minute.');

// Check schedule every minute
setInterval(checkSchedule, 60000);

// Also check immediately on startup
checkSchedule();

// Keep process alive
process.on('SIGINT', () => {
  console.log('\n[Scheduler] Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n[Scheduler] Shutting down...');
  process.exit(0);
});

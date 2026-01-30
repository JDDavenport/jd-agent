/**
 * Budget Reports Routes
 *
 * API endpoints for daily/weekly budget reports.
 */

import { Hono } from 'hono';
import { budgetReportService } from '../../services/budget-report-service';
import { budgetAlertService } from '../../services/budget-alert-service';
import { budgetPreferencesService } from '../../services/budget-preferences-service';
import { financeService } from '../../services/finance-service';
import { AppError } from '../middleware/error-handler';

export const budgetReportsRouter = new Hono();

// ============================================
// Daily Pulse Routes
// ============================================

/**
 * GET /api/finance/reports/daily
 * Preview today's daily pulse without sending
 */
budgetReportsRouter.get('/daily', async (c) => {
  const isConfigured = await financeService.isConfigured();
  if (!isConfigured) {
    throw new AppError(
      400,
      'Finance module not configured. Connect a bank account first.',
      'FINANCE_NOT_CONFIGURED'
    );
  }

  const preview = await budgetReportService.previewDailyPulse();

  return c.json({
    success: true,
    data: preview,
  });
});

/**
 * GET /api/finance/reports/daily/:date
 * Get a previously generated daily report by date (YYYY-MM-DD)
 */
budgetReportsRouter.get('/daily/:date', async (c) => {
  const date = c.req.param('date');

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError(400, 'Invalid date format. Use YYYY-MM-DD.', 'INVALID_DATE');
  }

  const report = await budgetReportService.getReport(date);

  if (!report) {
    throw new AppError(404, `No report found for ${date}`, 'REPORT_NOT_FOUND');
  }

  return c.json({
    success: true,
    data: report,
  });
});

/**
 * POST /api/finance/reports/daily/send
 * Manually trigger today's daily pulse
 */
budgetReportsRouter.post('/daily/send', async (c) => {
  const isConfigured = await financeService.isConfigured();
  if (!isConfigured) {
    throw new AppError(
      400,
      'Finance module not configured. Connect a bank account first.',
      'FINANCE_NOT_CONFIGURED'
    );
  }

  const result = await budgetReportService.sendDailyPulse();

  return c.json({
    success: true,
    data: result,
  });
});

// ============================================
// Weekly Report Routes
// ============================================

/**
 * GET /api/finance/reports/weekly
 * Preview this week's report without sending
 */
budgetReportsRouter.get('/weekly', async (c) => {
  const isConfigured = await financeService.isConfigured();
  if (!isConfigured) {
    throw new AppError(
      400,
      'Finance module not configured. Connect a bank account first.',
      'FINANCE_NOT_CONFIGURED'
    );
  }

  const preview = await budgetReportService.previewWeeklyReport();

  return c.json({
    success: true,
    data: preview,
  });
});

/**
 * GET /api/finance/reports/weekly/:date
 * Get a previously generated weekly report by week-end date (YYYY-MM-DD)
 */
budgetReportsRouter.get('/weekly/:date', async (c) => {
  const date = c.req.param('date');

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError(400, 'Invalid date format. Use YYYY-MM-DD.', 'INVALID_DATE');
  }

  const report = await budgetReportService.getWeeklyReport(date);

  if (!report) {
    throw new AppError(404, `No weekly report found for week ending ${date}`, 'REPORT_NOT_FOUND');
  }

  return c.json({
    success: true,
    data: report,
  });
});

/**
 * POST /api/finance/reports/weekly/send
 * Manually trigger this week's report
 */
budgetReportsRouter.post('/weekly/send', async (c) => {
  const isConfigured = await financeService.isConfigured();
  if (!isConfigured) {
    throw new AppError(
      400,
      'Finance module not configured. Connect a bank account first.',
      'FINANCE_NOT_CONFIGURED'
    );
  }

  const result = await budgetReportService.sendWeeklyReport();

  return c.json({
    success: true,
    data: result,
  });
});

// ============================================
// Report History Routes
// ============================================

/**
 * GET /api/finance/reports/history
 * Get history of sent reports
 */
budgetReportsRouter.get('/history', async (c) => {
  const limitParam = c.req.query('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 7;
  const typeParam = c.req.query('type'); // 'daily' | 'weekly' | undefined (all)

  const history = await budgetReportService.getReportHistory(limit);

  // Filter by type if specified
  const filteredHistory = typeParam
    ? history.filter((r) => r.reportType === typeParam)
    : history;

  return c.json({
    success: true,
    data: filteredHistory,
  });
});

// ============================================
// Smart Alerts Routes
// ============================================

/**
 * GET /api/finance/reports/alerts
 * Get recent smart alerts
 */
budgetReportsRouter.get('/alerts', async (c) => {
  const limitParam = c.req.query('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 10;

  const alerts = await budgetAlertService.getRecentAlerts(limit);

  return c.json({
    success: true,
    data: alerts,
  });
});

/**
 * POST /api/finance/reports/alerts/check
 * Manually trigger all alert checks
 */
budgetReportsRouter.post('/alerts/check', async (c) => {
  const isConfigured = await financeService.isConfigured();
  if (!isConfigured) {
    throw new AppError(
      400,
      'Finance module not configured. Connect a bank account first.',
      'FINANCE_NOT_CONFIGURED'
    );
  }

  const results = await budgetAlertService.runAllChecks();

  return c.json({
    success: true,
    data: results,
  });
});

/**
 * GET /api/finance/reports/alerts/config
 * Get current alert configuration
 */
budgetReportsRouter.get('/alerts/config', async (c) => {
  const config = budgetAlertService.getConfig();

  return c.json({
    success: true,
    data: config,
  });
});

/**
 * PATCH /api/finance/reports/alerts/config
 * Update alert configuration
 */
budgetReportsRouter.patch('/alerts/config', async (c) => {
  const body = await c.req.json();

  // Validate and update config
  const updates: Record<string, any> = {};

  if (typeof body.largeTransactionThresholdCents === 'number') {
    updates.largeTransactionThresholdCents = body.largeTransactionThresholdCents;
  }

  if (typeof body.unusualSpendingMultiplier === 'number') {
    updates.unusualSpendingMultiplier = body.unusualSpendingMultiplier;
  }

  if (typeof body.enabled === 'boolean') {
    updates.enabled = body.enabled;
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError(400, 'No valid configuration fields provided', 'INVALID_CONFIG');
  }

  budgetAlertService.updateConfig(updates);

  return c.json({
    success: true,
    data: budgetAlertService.getConfig(),
  });
});

// ============================================
// Preferences Routes
// ============================================

/**
 * GET /api/finance/reports/preferences
 * Get all budget report preferences
 */
budgetReportsRouter.get('/preferences', async (c) => {
  const preferences = await budgetPreferencesService.getPreferences();

  return c.json({
    success: true,
    data: preferences,
  });
});

/**
 * PATCH /api/finance/reports/preferences
 * Update budget report preferences
 */
budgetReportsRouter.patch('/preferences', async (c) => {
  const body = await c.req.json();

  const updated = await budgetPreferencesService.updatePreferences(body);

  return c.json({
    success: true,
    data: updated,
  });
});

// ============================================
// PDF Export Routes
// ============================================

/**
 * GET /api/finance/reports/daily/:date/pdf
 * Export a daily report as PDF
 */
budgetReportsRouter.get('/daily/:date/pdf', async (c) => {
  const date = c.req.param('date');

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError(400, 'Invalid date format. Use YYYY-MM-DD.', 'INVALID_DATE');
  }

  const report = await budgetReportService.getReport(date);

  if (!report) {
    throw new AppError(404, `No report found for ${date}`, 'REPORT_NOT_FOUND');
  }

  // Generate simple text-based PDF content
  const pdfContent = generatePdfContent('daily', report);

  c.header('Content-Type', 'application/pdf');
  c.header('Content-Disposition', `attachment; filename="daily-report-${date}.pdf"`);

  return c.body(pdfContent);
});

/**
 * GET /api/finance/reports/weekly/:date/pdf
 * Export a weekly report as PDF
 */
budgetReportsRouter.get('/weekly/:date/pdf', async (c) => {
  const date = c.req.param('date');

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError(400, 'Invalid date format. Use YYYY-MM-DD.', 'INVALID_DATE');
  }

  const report = await budgetReportService.getWeeklyReport(date);

  if (!report) {
    throw new AppError(404, `No weekly report found for week ending ${date}`, 'REPORT_NOT_FOUND');
  }

  // Generate simple text-based PDF content
  const pdfContent = generatePdfContent('weekly', report);

  c.header('Content-Type', 'application/pdf');
  c.header('Content-Disposition', `attachment; filename="weekly-report-${date}.pdf"`);

  return c.body(pdfContent);
});

/**
 * Simple PDF generator (returns text for now - can be enhanced with a PDF library)
 * Note: For a real PDF, you'd use a library like pdfkit or puppeteer
 */
function generatePdfContent(type: string, report: any): string {
  // This is a simplified text representation
  // In production, you'd use a proper PDF library
  const lines: string[] = [];

  lines.push(`Budget ${type === 'daily' ? 'Daily' : 'Weekly'} Report`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');

  if (report.data) {
    const data = typeof report.data === 'string' ? JSON.parse(report.data) : report.data;

    if (type === 'daily') {
      lines.push(`Date: ${report.reportDate}`);
      lines.push(`Spent Yesterday: $${((data.yesterdaySpentCents || 0) / 100).toFixed(2)}`);
      lines.push('');
      lines.push('Category Health:');
      if (data.categoryHealth) {
        for (const cat of data.categoryHealth) {
          lines.push(`  ${cat.name}: $${(cat.remainingCents / 100).toFixed(2)} remaining (${cat.status})`);
        }
      }
    } else {
      lines.push(`Week Ending: ${report.reportDate}`);
      lines.push(`Total Spent: $${((data.totalSpentCents || 0) / 100).toFixed(2)}`);
      lines.push(`Total Income: $${((data.totalIncomeCents || 0) / 100).toFixed(2)}`);
    }
  }

  return lines.join('\n');
}

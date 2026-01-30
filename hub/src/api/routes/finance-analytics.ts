/**
 * Finance Analytics Routes
 *
 * API endpoints for spending analytics and insights.
 */

import { Hono } from 'hono';
import { spendingAnalyticsService } from '../../services/spending-analytics-service';
import { financeService } from '../../services/finance-service';
import { AppError } from '../middleware/error-handler';

export const financeAnalyticsRouter = new Hono();

// ============================================
// Spending Trends
// ============================================

/**
 * GET /api/finance/analytics/trends
 * Get spending trends over time
 */
financeAnalyticsRouter.get('/trends', async (c) => {
  const isConfigured = await financeService.isConfigured();
  if (!isConfigured) {
    throw new AppError(
      400,
      'Finance module not configured. Connect a bank account first.',
      'FINANCE_NOT_CONFIGURED'
    );
  }

  const period = (c.req.query('period') as 'daily' | 'weekly' | 'monthly') || 'daily';
  const lookbackDays = parseInt(c.req.query('days') || '90', 10);

  const trends = await spendingAnalyticsService.getSpendingTrends({
    period,
    lookbackDays,
  });

  return c.json({
    success: true,
    data: trends,
  });
});

// ============================================
// Merchant Analysis
// ============================================

/**
 * GET /api/finance/analytics/merchants
 * Get top merchants by spending
 */
financeAnalyticsRouter.get('/merchants', async (c) => {
  const isConfigured = await financeService.isConfigured();
  if (!isConfigured) {
    throw new AppError(
      400,
      'Finance module not configured. Connect a bank account first.',
      'FINANCE_NOT_CONFIGURED'
    );
  }

  const limit = parseInt(c.req.query('limit') || '20', 10);
  const lookbackDays = parseInt(c.req.query('days') || '90', 10);

  const merchants = await spendingAnalyticsService.getTopMerchants({
    limit,
    lookbackDays,
  });

  return c.json({
    success: true,
    data: merchants,
  });
});

// ============================================
// Category Trends
// ============================================

/**
 * GET /api/finance/analytics/categories
 * Get spending trends by category
 */
financeAnalyticsRouter.get('/categories', async (c) => {
  const isConfigured = await financeService.isConfigured();
  if (!isConfigured) {
    throw new AppError(
      400,
      'Finance module not configured. Connect a bank account first.',
      'FINANCE_NOT_CONFIGURED'
    );
  }

  const months = parseInt(c.req.query('months') || '6', 10);

  const categoryTrends = await spendingAnalyticsService.getCategoryTrends({
    months,
  });

  return c.json({
    success: true,
    data: categoryTrends,
  });
});

// ============================================
// Budget Accuracy
// ============================================

/**
 * GET /api/finance/analytics/accuracy
 * Get budget accuracy tracking
 */
financeAnalyticsRouter.get('/accuracy', async (c) => {
  const isConfigured = await financeService.isConfigured();
  if (!isConfigured) {
    throw new AppError(
      400,
      'Finance module not configured. Connect a bank account first.',
      'FINANCE_NOT_CONFIGURED'
    );
  }

  const months = parseInt(c.req.query('months') || '6', 10);

  const accuracy = await spendingAnalyticsService.getBudgetAccuracy({
    months,
  });

  return c.json({
    success: true,
    data: accuracy,
  });
});

// ============================================
// Income vs Expenses
// ============================================

/**
 * GET /api/finance/analytics/income-expenses
 * Get income vs expenses comparison by month
 */
financeAnalyticsRouter.get('/income-expenses', async (c) => {
  const isConfigured = await financeService.isConfigured();
  if (!isConfigured) {
    throw new AppError(
      400,
      'Finance module not configured. Connect a bank account first.',
      'FINANCE_NOT_CONFIGURED'
    );
  }

  const months = parseInt(c.req.query('months') || '12', 10);

  const comparison = await spendingAnalyticsService.getIncomeExpenseComparison({
    months,
  });

  return c.json({
    success: true,
    data: comparison,
  });
});

// ============================================
// Dashboard Summary
// ============================================

/**
 * GET /api/finance/analytics/dashboard
 * Get all analytics data for the dashboard
 */
financeAnalyticsRouter.get('/dashboard', async (c) => {
  const isConfigured = await financeService.isConfigured();
  if (!isConfigured) {
    throw new AppError(
      400,
      'Finance module not configured. Connect a bank account first.',
      'FINANCE_NOT_CONFIGURED'
    );
  }

  const dashboardData = await spendingAnalyticsService.getDashboardData();

  return c.json({
    success: true,
    data: dashboardData,
  });
});

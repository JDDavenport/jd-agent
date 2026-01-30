/**
 * Finance Routes
 *
 * API endpoints for the Budget & Finance module.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { plaidService } from '../../services/plaid-service';
import { financeService } from '../../services/finance-service';
import { ValidationError, NotFoundError, AppError } from '../middleware/error-handler';
import { budgetReportsRouter } from './budget-reports';
import { financeAnalyticsRouter } from './finance-analytics';

export const financeRouter = new Hono();

// Mount sub-routers
financeRouter.route('/reports', budgetReportsRouter);
financeRouter.route('/analytics', financeAnalyticsRouter);

// ============================================
// Configuration Check Routes
// ============================================

/**
 * GET /api/finance/status
 * Check if finance module is configured
 */
financeRouter.get('/status', async (c) => {
  const plaidConfigured = plaidService.isConfigured();
  const fullyConfigured = plaidService.isFullyConfigured();
  const hasAccounts = await financeService.isConfigured();

  return c.json({
    success: true,
    data: {
      plaidConfigured,
      encryptionConfigured: fullyConfigured,
      hasAccounts,
      ready: fullyConfigured && hasAccounts,
    },
  });
});

// ============================================
// Plaid Link Routes
// ============================================

/**
 * POST /api/finance/link-token
 * Create a Plaid Link token for client-side initialization
 */
financeRouter.post('/link-token', async (c) => {
  if (!plaidService.isConfigured()) {
    throw new AppError(
      400,
      'Plaid is not configured. Add PLAID_CLIENT_ID and PLAID_SECRET environment variables.',
      'PLAID_NOT_CONFIGURED'
    );
  }

  if (!plaidService.isFullyConfigured()) {
    throw new AppError(
      400,
      'ENCRYPTION_KEY not configured. Required for secure token storage.',
      'ENCRYPTION_NOT_CONFIGURED'
    );
  }

  const userId = 'user-1'; // Single user system
  const result = await plaidService.createLinkToken(userId);

  return c.json({ success: true, data: result });
});

/**
 * POST /api/finance/exchange-token
 * Exchange public token after successful Plaid Link
 */
const exchangeTokenSchema = z.object({
  publicToken: z.string().min(1, 'Public token is required'),
});

financeRouter.post('/exchange-token', async (c) => {
  const body = await c.req.json();
  const parseResult = exchangeTokenSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const result = await plaidService.exchangePublicToken(parseResult.data.publicToken);

  return c.json({
    success: true,
    data: result,
    message: 'Account connected successfully',
  });
});

// ============================================
// Account Routes
// ============================================

/**
 * GET /api/finance/accounts
 * Get all connected accounts
 */
financeRouter.get('/accounts', async (c) => {
  const accounts = await plaidService.getAccounts();
  return c.json({
    success: true,
    data: accounts,
    count: accounts.length,
  });
});

/**
 * POST /api/finance/accounts/:id/sync
 * Manually trigger sync for an account
 */
financeRouter.post('/accounts/:id/sync', async (c) => {
  const id = c.req.param('id');
  const result = await plaidService.syncAccount(id);
  return c.json({
    success: true,
    data: result,
    message: `Synced: ${result.added} added, ${result.modified} modified, ${result.removed} removed`,
  });
});

/**
 * PATCH /api/finance/accounts/:id
 * Update account settings (display name, hidden)
 */
const updateAccountSchema = z.object({
  displayName: z.string().optional(),
  isHidden: z.boolean().optional(),
});

financeRouter.patch('/accounts/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parseResult = updateAccountSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  if (parseResult.data.displayName !== undefined) {
    await plaidService.updateAccountDisplayName(id, parseResult.data.displayName);
  }
  if (parseResult.data.isHidden !== undefined) {
    await plaidService.setAccountHidden(id, parseResult.data.isHidden);
  }

  return c.json({ success: true, message: 'Account updated' });
});

/**
 * DELETE /api/finance/accounts/:itemId
 * Disconnect a Plaid item (all accounts from one institution)
 */
financeRouter.delete('/accounts/:itemId', async (c) => {
  const itemId = c.req.param('itemId');
  await plaidService.disconnectItem(itemId);
  return c.json({ success: true, message: 'Account disconnected' });
});

// ============================================
// Transaction Routes
// ============================================

/**
 * GET /api/finance/transactions
 * Get transactions with optional filters
 */
const transactionFiltersSchema = z.object({
  accountId: z.string().uuid().optional(),
  category: z.string().optional(),
  startDate: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  endDate: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  minAmount: z
    .string()
    .optional()
    .transform((v) => (v ? Math.round(parseFloat(v) * 100) : undefined)),
  maxAmount: z
    .string()
    .optional()
    .transform((v) => (v ? Math.round(parseFloat(v) * 100) : undefined)),
  pending: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v) : 50)),
  offset: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v) : 0)),
});

financeRouter.get('/transactions', async (c) => {
  const query = c.req.query();
  const filters = transactionFiltersSchema.parse(query);

  const transactions = await financeService.getTransactions({
    accountId: filters.accountId,
    category: filters.category,
    startDate: filters.startDate,
    endDate: filters.endDate,
    minAmountCents: filters.minAmount,
    maxAmountCents: filters.maxAmount,
    pending: filters.pending,
    limit: filters.limit,
    offset: filters.offset,
  });

  return c.json({
    success: true,
    data: transactions,
    count: transactions.length,
  });
});

/**
 * GET /api/finance/transactions/recent
 * Get recent transactions for widget
 */
financeRouter.get('/transactions/recent', async (c) => {
  const limitParam = c.req.query('limit');
  const limit = limitParam ? parseInt(limitParam) : 5;

  const transactions = await financeService.getRecentTransactions(limit);

  return c.json({ success: true, data: transactions });
});

/**
 * GET /api/finance/transactions/:id
 * Get a single transaction
 */
financeRouter.get('/transactions/:id', async (c) => {
  const id = c.req.param('id');
  const transaction = await financeService.getTransaction(id);

  if (!transaction) {
    throw new NotFoundError('Transaction');
  }

  return c.json({ success: true, data: transaction });
});

/**
 * PATCH /api/finance/transactions/:id
 * Update transaction (category override, notes)
 */
const updateTransactionSchema = z.object({
  userCategory: z.string().optional(),
  userNote: z.string().optional(),
  isExcluded: z.boolean().optional(),
});

financeRouter.patch('/transactions/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parseResult = updateTransactionSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const transaction = await financeService.updateTransaction(id, parseResult.data);

  if (!transaction) {
    throw new NotFoundError('Transaction');
  }

  return c.json({ success: true, data: transaction, message: 'Transaction updated' });
});

// ============================================
// Overview/Dashboard Routes
// ============================================

/**
 * GET /api/finance/overview
 * Get financial overview for dashboard
 */
financeRouter.get('/overview', async (c) => {
  const overview = await financeService.getOverview();
  return c.json({ success: true, data: overview });
});

/**
 * GET /api/finance/widget
 * Get all widget data in one call
 */
financeRouter.get('/widget', async (c) => {
  const widgetData = await financeService.getWidgetSummary();
  return c.json({ success: true, data: widgetData });
});

/**
 * GET /api/finance/spending
 * Get spending by category for a date range
 */
financeRouter.get('/spending', async (c) => {
  const startDateParam = c.req.query('startDate');
  const endDateParam = c.req.query('endDate');

  const now = new Date();
  const startDate = startDateParam
    ? new Date(startDateParam)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = endDateParam ? new Date(endDateParam) : now;

  const spending = await financeService.getSpendingByCategory(startDate, endDate);

  return c.json({ success: true, data: spending });
});

// ============================================
// Budget Routes
// ============================================

const budgetSchema = z.object({
  name: z.string().min(1),
  groupName: z.string().optional(),
  groupOrder: z.number().int().optional(),
  budgetOrder: z.number().int().optional(),
  category: z.string().min(1),
  amount: z.number().positive(),
  targetType: z.enum(['monthly', 'weekly', 'yearly']).optional(),
  targetAmount: z.number().optional(),
  targetDate: z.string().optional(),
  month: z.string().optional(),
  periodType: z.enum(['weekly', 'monthly', 'yearly']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  rolloverEnabled: z.boolean().optional(),
  rolloverAmount: z.number().optional(),
  carryoverOverspent: z.boolean().optional(),
  alertThreshold: z.number().min(0).max(100).optional(),
  alertsEnabled: z.boolean().optional(),
});

const budgetUpdateSchema = budgetSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const centsFromAmount = (amount: number) => Math.round(amount * 100);

/**
 * GET /api/finance/budgets
 * List budgets with current status
 */
financeRouter.get('/budgets', async (c) => {
  const includeInactive = c.req.query('includeInactive') === 'true';
  const month = c.req.query('month') || undefined;
  const budgets = await financeService.getBudgetStatuses(includeInactive, month);
  return c.json({ success: true, data: budgets });
});

/**
 * GET /api/finance/budgets/:id
 * Get budget
 */
financeRouter.get('/budgets/:id', async (c) => {
  const id = c.req.param('id');
  const budget = await financeService.getBudget(id);
  if (!budget) {
    throw new NotFoundError('Budget');
  }
  return c.json({ success: true, data: budget });
});

/**
 * POST /api/finance/budgets
 * Create budget
 */
financeRouter.post('/budgets', async (c) => {
  const body = await c.req.json();
  const parseResult = budgetSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const budget = await financeService.createBudget({
    name: parseResult.data.name,
    groupName: parseResult.data.groupName,
    groupOrder: parseResult.data.groupOrder,
    budgetOrder: parseResult.data.budgetOrder,
    category: parseResult.data.category,
    amountCents: centsFromAmount(parseResult.data.amount),
    targetType: parseResult.data.targetType,
    targetAmountCents:
      parseResult.data.targetAmount !== undefined ? centsFromAmount(parseResult.data.targetAmount) : undefined,
    targetDate: parseResult.data.targetDate,
    month: parseResult.data.month,
    periodType: parseResult.data.periodType,
    startDate: parseResult.data.startDate,
    endDate: parseResult.data.endDate,
    rolloverEnabled: parseResult.data.rolloverEnabled,
    rolloverAmountCents: parseResult.data.rolloverAmount
      ? centsFromAmount(parseResult.data.rolloverAmount)
      : undefined,
    carryoverOverspent: parseResult.data.carryoverOverspent,
    alertThreshold: parseResult.data.alertThreshold,
    alertsEnabled: parseResult.data.alertsEnabled,
  });

  return c.json({ success: true, data: budget, message: 'Budget created' });
});

/**
 * PATCH /api/finance/budgets/:id
 * Update budget
 */
financeRouter.patch('/budgets/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const parseResult = budgetUpdateSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const { amount, rolloverAmount, targetAmount, month, ...rest } = parseResult.data;
  const budget = await financeService.updateBudget(id, {
    ...rest,
    amountCents: month ? undefined : amount !== undefined ? centsFromAmount(amount) : undefined,
    rolloverAmountCents: rolloverAmount !== undefined ? centsFromAmount(rolloverAmount) : undefined,
    targetAmountCents: targetAmount !== undefined ? centsFromAmount(targetAmount) : undefined,
  });

  if (month && amount !== undefined) {
    await financeService.setBudgetAllocation(id, month, centsFromAmount(amount));
  }

  if (!budget) {
    throw new NotFoundError('Budget');
  }

  return c.json({ success: true, data: budget, message: 'Budget updated' });
});

/**
 * DELETE /api/finance/budgets/:id
 * Deactivate budget
 */
financeRouter.delete('/budgets/:id', async (c) => {
  const id = c.req.param('id');
  await financeService.deactivateBudget(id);
  return c.json({ success: true, message: 'Budget deactivated' });
});

// ============================================
// Sync Routes
// ============================================

/**
 * POST /api/finance/sync
 * Trigger manual sync of all accounts
 */
financeRouter.post('/sync', async (c) => {
  const result = await plaidService.syncAllAccounts();
  return c.json({
    success: true,
    data: result,
    message: `Synced: ${result.added} added, ${result.modified} modified, ${result.removed} removed`,
  });
});

// ============================================
// Manual Import Routes
// ============================================

/**
 * POST /api/finance/upload
 * Upload CSV file with transactions
 *
 * Supports common bank export formats:
 * - Chase: Transaction Date, Post Date, Description, Category, Type, Amount, Memo
 * - Generic: Date, Description, Amount, Category (optional)
 */
financeRouter.post('/upload', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  const accountName = (formData.get('accountName') as string) || 'Manual Import';

  if (!file) {
    throw new ValidationError('No file provided');
  }

  if (!file.name.endsWith('.csv')) {
    throw new ValidationError('Only CSV files are supported');
  }

  // Read file content
  const content = await file.text();
  const lines = content.split('\n').filter((line) => line.trim());

  if (lines.length < 2) {
    throw new ValidationError('CSV file must have a header row and at least one data row');
  }

  // Parse header to detect format
  const header = lines[0].toLowerCase();
  const headers = header.split(',').map((h) => h.trim().replace(/"/g, ''));

  // Detect column indices
  let dateCol = headers.findIndex((h) =>
    ['date', 'transaction date', 'trans date', 'posting date'].includes(h)
  );
  let descCol = headers.findIndex((h) =>
    ['description', 'desc', 'merchant', 'name', 'payee'].includes(h)
  );
  let amountCol = headers.findIndex((h) => ['amount', 'amt', 'debit', 'credit'].includes(h));
  let categoryCol = headers.findIndex((h) => ['category', 'cat', 'type'].includes(h));

  // Fallback: try positional for common formats
  if (dateCol === -1) dateCol = 0;
  if (descCol === -1) descCol = headers.length > 2 ? 2 : 1;
  if (amountCol === -1) amountCol = headers.length - 1;

  // Parse transactions
  const transactions: Array<{
    date: string;
    description: string;
    amount: number;
    category?: string;
  }> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle CSV with quoted fields
    const cols = parseCSVLine(line);

    try {
      const rawDate = cols[dateCol]?.trim();
      const description = cols[descCol]?.trim() || 'Unknown';
      const amountStr = cols[amountCol]?.trim().replace(/[$,]/g, '') || '0';
      const category = categoryCol >= 0 ? cols[categoryCol]?.trim() : undefined;

      // Parse date (handle various formats)
      const date = parseDate(rawDate);
      if (!date) continue;

      // Parse amount
      const amount = parseFloat(amountStr);
      if (isNaN(amount)) continue;

      transactions.push({
        date,
        description,
        amount,
        category,
      });
    } catch (err) {
      console.error(`Failed to parse line ${i + 1}:`, line, err);
    }
  }

  if (transactions.length === 0) {
    throw new ValidationError('No valid transactions found in CSV');
  }

  // Get or create manual account
  const accountId = await financeService.getOrCreateManualAccount(accountName);

  // Import transactions
  const result = await financeService.importTransactions(accountId, transactions);

  return c.json({
    success: true,
    data: {
      ...result,
      accountId,
      accountName,
    },
    message: `Imported ${result.imported} transactions (${result.skipped} skipped)`,
  });
});

/**
 * GET /api/finance/manual-accounts
 * Get list of manual upload accounts
 */
financeRouter.get('/manual-accounts', async (c) => {
  const accounts = await financeService.getManualAccounts();
  return c.json({
    success: true,
    data: accounts,
    count: accounts.length,
  });
});

// ============================================
// CSV Parsing Helpers
// ============================================

/**
 * Parse a single CSV line, handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Parse various date formats to YYYY-MM-DD
 */
function parseDate(dateStr: string): string | null {
  if (!dateStr) return null;

  // Remove quotes
  dateStr = dateStr.replace(/"/g, '').trim();

  // Try common formats
  const formats = [
    // MM/DD/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // MM-DD-YYYY
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    // YYYY-MM-DD (already correct)
    /^(\d{4})-(\d{2})-(\d{2})$/,
    // MM/DD/YY
    /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/,
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      let year = match[3] || match[1];
      let month = match[1];
      let day = match[2];

      // Handle YYYY-MM-DD format
      if (match[1].length === 4) {
        year = match[1];
        month = match[2];
        day = match[3];
      }

      // Handle 2-digit year
      if (year.length === 2) {
        year = `20${year}`;
      }

      // Pad month and day
      month = month.padStart(2, '0');
      day = day.padStart(2, '0');

      return `${year}-${month}-${day}`;
    }
  }

  // Try Date.parse as fallback
  const parsed = Date.parse(dateStr);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    return d.toISOString().split('T')[0];
  }

  return null;
}

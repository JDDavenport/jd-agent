/**
 * Crypto Routes - Cypherpunk PoW Coin Tracker
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { cryptoService } from '../../services/crypto-service';
import { bugReportService } from '../../services/bug-report-service';
import { ValidationError, NotFoundError, AppError } from '../middleware/error-handler';

export const cryptoRouter = new Hono();

const filtersSchema = z.object({
  search: z.string().optional(),
  privacyLevel: z.enum(['none', 'optional', 'default', 'mandatory']).optional(),
  privacyFocus: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  algorithm: z.string().optional(),
  minMarketCap: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined)),
  maxMarketCap: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined)),
  minAgeYears: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined)),
  maxAgeYears: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 50)),
  offset: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : 0)),
  sortBy: z
    .enum([
      'marketCap',
      'price',
      'change24h',
      'change7d',
      'volume',
      'name',
      'circulatingSupply',
      'ath',
      'cypherpunk',
      'hashrate',
    ])
    .optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
});

const historySchema = z.object({
  range: z.enum(['30d', '90d', '1y', 'all']).optional(),
});

const bugReportSchema = z.object({
  title: z.string().min(3, 'Title is required'),
  description: z.string().min(10, 'Description is required'),
  steps: z.string().optional(),
  expected: z.string().optional(),
  actual: z.string().optional(),
  reporterEmail: z.string().email().optional(),
  pageUrl: z.string().url().optional(),
  userAgent: z.string().optional(),
});

function rangeToDays(range?: string) {
  switch (range) {
    case '90d':
      return 90;
    case '1y':
      return 365;
    case 'all':
      return 365 * 5;
    case '30d':
    default:
      return 30;
  }
}

/**
 * GET /api/crypto/coins
 * List PoW coins with filters
 */
cryptoRouter.get('/coins', async (c) => {
  const query = c.req.query();
  const parseResult = filtersSchema.safeParse(query);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const coins = await cryptoService.getCoins(parseResult.data);

  return c.json({
    success: true,
    data: coins,
    count: coins.length,
  });
});

/**
 * GET /api/crypto/coins/:id
 * Get a single coin
 */
cryptoRouter.get('/coins/:id', async (c) => {
  const id = c.req.param('id');
  const coin = await cryptoService.getCoinById(id);

  if (!coin) {
    throw new NotFoundError('Coin');
  }

  return c.json({ success: true, data: coin });
});

/**
 * GET /api/crypto/coins/:id/market
 * Market history for charting
 */
cryptoRouter.get('/coins/:id/market', async (c) => {
  const id = c.req.param('id');
  const parseResult = historySchema.safeParse(c.req.query());
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const days = rangeToDays(parseResult.data.range);
  const history = await cryptoService.getMarketHistory(id, days);
  return c.json({ success: true, data: history });
});

/**
 * GET /api/crypto/coins/:id/network
 * Network history for charting
 */
cryptoRouter.get('/coins/:id/network', async (c) => {
  const id = c.req.param('id');
  const parseResult = historySchema.safeParse(c.req.query());
  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const days = rangeToDays(parseResult.data.range);
  const history = await cryptoService.getNetworkHistory(id, days);
  return c.json({ success: true, data: history });
});

/**
 * GET /api/crypto/coins/:id/pools
 * Latest mining pool distribution
 */
cryptoRouter.get('/coins/:id/pools', async (c) => {
  const id = c.req.param('id');
  const pools = await cryptoService.getLatestPools(id);
  return c.json({ success: true, data: pools });
});

/**
 * GET /api/crypto/alerts
 * Network health alerts
 */
cryptoRouter.get('/alerts', async (c) => {
  const alerts = await cryptoService.getAlerts();
  return c.json({ success: true, data: alerts });
});

/**
 * GET /api/crypto/health
 * Network health summary
 */
cryptoRouter.get('/health', async (c) => {
  const summary = await cryptoService.getHealthSummary();
  return c.json({ success: true, data: summary });
});

/**
 * POST /api/crypto/refresh
 * Force refresh market data
 */
cryptoRouter.post('/refresh', async (c) => {
  await cryptoService.refreshMarketData(true);
  return c.json({ success: true, message: 'Market data refreshed' });
});

/**
 * GET /api/crypto/coins/:id/markets
 * Trading markets for a coin (CoinGecko tickers)
 */
cryptoRouter.get('/coins/:id/markets', async (c) => {
  const id = c.req.param('id');
  const coin = await cryptoService.getCoinById(id);
  if (!coin) {
    throw new NotFoundError('Coin');
  }

  const response = await fetch(
    `https://api.coingecko.com/api/v3/coins/${coin.coingeckoId}/tickers?include_exchange_logo=false`,
    { headers: { Accept: 'application/json' } }
  );

  if (!response.ok) {
    throw new AppError(502, 'Failed to fetch markets from CoinGecko', 'COINGECKO_ERROR');
  }

  const payload = await response.json();
  const tickers = Array.isArray(payload.tickers) ? payload.tickers : [];

  const markets = tickers.slice(0, 25).map((ticker: any) => ({
    market: ticker.market?.name || 'Unknown',
    base: ticker.base,
    target: ticker.target,
    last: ticker.last,
    volume: ticker.volume,
    tradeUrl: ticker.trade_url,
  }));

  return c.json({ success: true, data: markets });
});

/**
 * POST /api/crypto/bugs
 * Submit a bug report
 */
cryptoRouter.post('/bugs', async (c) => {
  const body = await c.req.json();
  const parseResult = bugReportSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  if (!bugReportService.isConfigured()) {
    throw new AppError(
      400,
      'Bug report email is not configured. Set GoDaddy SMTP credentials.',
      'BUG_REPORT_NOT_CONFIGURED'
    );
  }

  await bugReportService.sendBugReport(parseResult.data);
  return c.json({ success: true, message: 'Bug report sent' });
});

/**
 * GET /api/crypto/bugs/status
 * Check bug report SMTP configuration
 */
cryptoRouter.get('/bugs/status', async (c) => {
  return c.json({
    success: true,
    data: {
      configured: bugReportService.isConfigured(),
    },
  });
});

/**
 * POST /api/crypto/bugs/test
 * Verify SMTP and send a test email
 */
cryptoRouter.post('/bugs/test', async (c) => {
  if (!bugReportService.isConfigured()) {
    throw new AppError(
      400,
      'Bug report email is not configured. Set GoDaddy SMTP credentials.',
      'BUG_REPORT_NOT_CONFIGURED'
    );
  }

  await bugReportService.verifyConnection();
  await bugReportService.sendTestEmail();
  return c.json({ success: true, message: 'SMTP verified and test email sent' });
});

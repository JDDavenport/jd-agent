// Load environment from root .env file
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Process-level error handlers - MUST be first to catch all errors
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught Exception:', error);
  console.error('[FATAL] Stack:', error.stack);
  // Give time for logs to flush
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise);
  console.error('[FATAL] Reason:', reason);
  if (reason instanceof Error) {
    console.error('[FATAL] Stack:', reason.stack);
  }
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SHUTDOWN] Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[SHUTDOWN] Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

const rootEnvPath = join(import.meta.dir, '../../.env');
if (existsSync(rootEnvPath)) {
  const envContent = readFileSync(rootEnvPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      let value = valueParts.join('=');
      // Remove surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && value && !process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { health } from './api/routes/health';
import { tasksRouter } from './api/routes/tasks';
import { projectsRouter } from './api/routes/projects';
import { vaultRouter } from './api/routes/vault';
import { calendarRouter } from './api/routes/calendar';
import { chatRouter } from './api/routes/chat';
import { webhooksRouter } from './api/routes/webhooks';
import { ceremoniesRouter } from './api/routes/ceremonies';
import { ingestionRouter } from './api/routes/ingestion';
import { systemRouter } from './api/routes/system';
import { setupRouter } from './api/routes/setup';
import { setupUI } from './api/routes/setup-ui';
import { chatUI } from './api/routes/chat-ui';
import { brainDumpUI } from './api/routes/brain-dump-ui';
import searchRouter from './api/routes/search';
import analyticsRouter from './api/routes/analytics';
import dashboardRouter from './api/routes/dashboard';
import { scheduleRouter } from './api/routes/schedule';
import { logsRouter } from './api/routes/logs';
import { privacyRouter } from './api/routes/privacy';
import { whoopRouter } from './api/routes/whoop';
import { contextsRouter } from './api/routes/contexts';
import { labelsRouter } from './api/routes/labels';
import { filtersRouter } from './api/routes/filters';
import { peopleRouter } from './api/routes/people';
import { goalsRouter } from './api/routes/goals';
import { habitsRouter } from './api/routes/habits';
import { milestonesRouter } from './api/routes/milestones';
import { progressRouter } from './api/routes/progress';
import { reflectionsRouter } from './api/routes/reflections';
import { taskGenerationRouter } from './api/routes/task-generation';
import { goalVaultRouter } from './api/routes/goal-vault';
import { canvasIntegrityRouter } from './api/routes/canvas-integrity';
import { canvasMaterialsRouter } from './api/routes/canvas-materials';
import testingRouter from './api/routes/testing';
import { jobsRouter } from './api/routes/jobs';
import { oauthRouter } from './api/routes/oauth';
import { journalRouter } from './api/routes/journal';
import { voiceProfilesRouter } from './api/routes/voice-profiles';
import { financeRouter } from './api/routes/finance';
import recordingsRouter from './api/routes/recordings';
import { acquisitionRouter } from './api/routes/acquisition';
import { roadmapRouter } from './api/routes/roadmap';
import jupyterRouter from './api/routes/jupyter';
import { cryptoRouter } from './api/routes/crypto';
import adExchangeRouter from './api/routes/ad-exchange';
import sosatisfyingRouter from './api/routes/sosatisfying';
import { briefingRouter } from './api/routes/briefing';
import { productivityRouter } from './api/routes/productivity';
import { garmin } from './api/routes/garmin';
import { classesRouter } from './api/routes/classes';
import readHelpRouter from './api/routes/read-help';
import { studyHelpAuthRouter } from './api/routes/study-help-auth';
import { studyHelpCoursesRouter } from './api/routes/study-help-courses';
import { studyHelpChatRouter } from './api/routes/study-help-chat';
import { studyHelpSyncRouter } from './api/routes/study-help-sync';
import { canvasConnectRouter } from './api/routes/canvas-connect';
import { errorHandler, requestLogger, AppError } from './api/middleware/error-handler';
import { getTelegramBot } from './integrations/telegram-bot';
import { MasterAgent } from './agents/master-agent';
import { plaudIntegration } from './integrations/plaud';
import plaudDashboardRouter from './api/routes/plaud-dashboard';

// Create Hono app
const app = new Hono();

// Global middleware - CORS configuration
// CORS_ALLOWED_ORIGINS can be set to a comma-separated list of additional origins
const additionalOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];

app.use('*', cors({
  origin: (origin) => {
    // Allow all localhost ports for development
    if (origin?.startsWith('http://localhost:')) return origin;
    // Allow all Vercel deployments
    if (origin?.endsWith('.vercel.app')) return origin;
    // Allow specific production domains
    if (origin === 'https://jdagent.app' || origin === 'https://www.jdagent.app') return origin;
    // Allow Study Aide domains
    if (origin === 'https://studyaide.app' || origin === 'https://www.studyaide.app') return origin;
    // Allow Cloudflare tunnel domain (api.jdagent.dev or custom)
    if (origin?.endsWith('.jdagent.dev')) return origin;
    // Allow additional origins from environment (for custom tunnel domains)
    if (additionalOrigins.includes(origin || '')) return origin;
    // Default: allow the origin (permissive for now)
    return origin || '*';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400,
}));
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', errorHandler);

// Global error handler
app.onError((err, c) => {
  console.error('Error caught by onError:', err);

  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred';

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorCode = err.code || 'APP_ERROR';
    message = err.message;
  } else if (err instanceof Error) {
    message = err.message;
  }

  return c.json({
    success: false,
    error: {
      code: errorCode,
      message,
    },
    timestamp: new Date().toISOString(),
  }, statusCode as any);
});

// Root endpoint
app.get('/', (c) => {
  return c.json({
    name: 'JD Agent API',
    version: '0.3.0',
    status: 'running',
    phase: 'Phase 3 - Verify & Coach',
    endpoints: {
      chat: '/api/chat',
      tasks: '/api/tasks',
      projects: '/api/projects',
      vault: '/api/vault',
      calendar: '/api/calendar',
      ceremonies: '/api/ceremonies',
      ingestion: '/api/ingestion',
      search: '/api/search',
      analytics: '/api/analytics',
      dashboard: '/api/dashboard',
      system: '/api/system',
      setup: '/api/setup',
      health: '/api/health',
      logs: '/api/logs',
      whoop: '/api/whoop',
      contexts: '/api/contexts',
      labels: '/api/labels',
      filters: '/api/filters',
      people: '/api/people',
      goals: '/api/goals',
      habits: '/api/habits',
      milestones: '/api/milestones',
      progress: '/api/progress',
      reflections: '/api/reflections',
      taskGeneration: '/api/task-generation',
      goalVault: '/api/goal-vault',
      testing: '/api/testing',
      jobs: '/api/jobs',
      canvasIntegrity: '/api/canvas-integrity',
      oauth: '/api/oauth',
      voiceProfiles: '/api/voice-profiles',
      finance: '/api/finance',
      crypto: '/api/crypto',
      briefing: '/api/briefing',
      productivity: '/api/productivity',
      roadmap: '/api/roadmap',
      garmin: '/api/garmin',
    },
    privacyPolicy: '/privacy',
    setupWizard: '/setup',
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
app.route('/api/health', health);
app.route('/api/tasks', tasksRouter);
app.route('/api/projects', projectsRouter);
app.route('/api/vault', vaultRouter);
app.route('/api/calendar', calendarRouter);
app.route('/api/chat', chatRouter);
app.route('/api/ceremonies', ceremoniesRouter);
app.route('/api/ingestion', ingestionRouter);
app.route('/api/search', searchRouter);
app.route('/api/analytics', analyticsRouter);
app.route('/api/dashboard', dashboardRouter);
app.route('/api/schedule', scheduleRouter);
app.route('/api/system', systemRouter);
app.route('/api/setup', setupRouter);
app.route('/api/webhooks', webhooksRouter);
app.route('/api/logs', logsRouter);
app.route('/api/whoop', whoopRouter);
app.route('/api/contexts', contextsRouter);
app.route('/api/labels', labelsRouter);
app.route('/api/filters', filtersRouter);
app.route('/api/people', peopleRouter);
app.route('/api/goals', goalsRouter);
app.route('/api/habits', habitsRouter);
app.route('/api/milestones', milestonesRouter);
app.route('/api/progress', progressRouter);
app.route('/api/reflections', reflectionsRouter);
app.route('/api/task-generation', taskGenerationRouter);
app.route('/api/goal-vault', goalVaultRouter);
app.route('/api/testing', testingRouter);
app.route('/api/jobs', jobsRouter);
app.route('/api/canvas-integrity', canvasIntegrityRouter);
app.route('/api/canvas-materials', canvasMaterialsRouter);
app.route('/api/oauth', oauthRouter);
app.route('/api/journal', journalRouter);
app.route('/api/voice-profiles', voiceProfilesRouter);
app.route('/api/finance', financeRouter);
app.route('/api/recordings', recordingsRouter);
app.route('/api/acquisition', acquisitionRouter);
app.route('/api/roadmap', roadmapRouter);
app.route('/api/jupyter', jupyterRouter);
app.route('/api/crypto', cryptoRouter);
app.route('/api/ad-exchange', adExchangeRouter);
app.route('/api/v1/sosatisfying', sosatisfyingRouter);
app.route('/api/briefing', briefingRouter);
app.route('/api/productivity', productivityRouter);
app.route('/api/garmin', garmin);
app.route('/api/classes', classesRouter);
app.route('/api/read-help', readHelpRouter);
app.route('/api/study-help/auth', studyHelpAuthRouter);
app.route('/api/study-help/courses', studyHelpCoursesRouter);
app.route('/api/study-help/chat', studyHelpChatRouter);
app.route('/api/study-help/sync', studyHelpSyncRouter);
app.route('/api/canvas', canvasConnectRouter);
app.route('/api/plaud', plaudDashboardRouter);

// Web UI
app.route('/setup', setupUI);
app.route('/chat', chatUI);
app.route('/brain-dump', brainDumpUI);
app.route('/privacy', privacyRouter);

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${c.req.path} not found`,
      },
      timestamp: new Date().toISOString(),
    },
    404
  );
});

// Get port from environment
const port = parseInt(process.env.PORT || '3000', 10);

console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║     ██╗██████╗      █████╗  ██████╗ ███████╗███╗   ██╗████████╗
║     ██║██╔══██╗    ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝
║     ██║██║  ██║    ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   
║██   ██║██║  ██║    ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   
║╚█████╔╝██████╔╝    ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   
║ ╚════╝ ╚═════╝     ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   
║                                                              ║
║  Phase 3: Verify & Coach                                     ║
║  Personal AI Agent System                                    ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

🚀 Server starting on port ${port}...
📍 Local: http://localhost:${port}
`);

// Initialize Telegram Bot for two-way chat
const telegramBot = getTelegramBot();
if (telegramBot.isConfigured()) {
  // Create a master agent instance for the bot
  const botAgent = new MasterAgent();
  
  // Connect bot messages to the agent
  telegramBot.setMessageHandler(async (message: string, _chatId: number) => {
    const result = await botAgent.chat(message);
    return result.message;
  });
  
  // Start listening for messages
  telegramBot.startPolling();
  console.log('💬 Telegram bot is listening! Message @JDtwobot to chat with your agent.');
} else {
  console.log('⚠️  Telegram bot not configured - set TELEGRAM_TOKEN and TELEGRAM_CHAT_ID');
}

// Start the server explicitly with Bun.serve
const server = Bun.serve({
  port,
  hostname: '0.0.0.0',
  fetch: app.fetch,
});

console.log(`✅ Server listening on ${server.hostname}:${server.port}`);

// Auto-start Plaud file watcher
if (plaudIntegration.isConfigured()) {
  plaudIntegration.startWatching();
  console.log('🎙️  Plaud file watcher started - auto-syncing recordings');
}

// Server is started explicitly above with Bun.serve()

// Load environment from root .env file
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const rootEnvPath = join(import.meta.dir, '../../.env');
if (existsSync(rootEnvPath)) {
  const envContent = readFileSync(rootEnvPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=');
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
import testingRouter from './api/routes/testing';
import { jobsRouter } from './api/routes/jobs';
import { oauthRouter } from './api/routes/oauth';
import { journalRouter } from './api/routes/journal';
import { voiceProfilesRouter } from './api/routes/voice-profiles';
import { errorHandler, requestLogger, AppError } from './api/middleware/error-handler';
import { getTelegramBot } from './integrations/telegram-bot';
import { MasterAgent } from './agents/master-agent';

// Create Hono app
const app = new Hono();

// Global middleware
app.use('*', cors());
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
app.route('/api/oauth', oauthRouter);
app.route('/api/journal', journalRouter);
app.route('/api/voice-profiles', voiceProfilesRouter);

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

// Export for Bun - bind to 0.0.0.0 for container deployments
export default {
  port,
  hostname: '0.0.0.0',
  fetch: app.fetch,
};

/**
 * VIP Pipeline Configuration Checker
 *
 * Checks which services are configured for the VIP pipeline
 * and provides guidance on what's missing.
 *
 * Usage: bun run src/scripts/check-vip-config.ts
 */

console.log(`
╔══════════════════════════════════════════════════════════════╗
║  VIP Pipeline Configuration Check                            ║
╚══════════════════════════════════════════════════════════════╝
`);

interface ConfigCheck {
  name: string;
  configured: boolean;
  envVars: string[];
  setupUrl?: string;
  notes?: string;
}

const checks: ConfigCheck[] = [];

// Check Database
const dbConfigured = !!process.env.DATABASE_URL;
checks.push({
  name: 'PostgreSQL Database',
  configured: dbConfigured,
  envVars: ['DATABASE_URL'],
  notes: dbConfigured ? `Connected to: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'localhost'}` : undefined,
});

// Check Redis
const redisConfigured = true; // Assume localhost if not set
checks.push({
  name: 'Redis (Job Queue)',
  configured: redisConfigured,
  envVars: ['REDIS_URL'],
  notes: process.env.REDIS_URL || 'Using default: localhost:6379',
});

// Check Deepgram
const deepgramConfigured = !!process.env.DEEPGRAM_API_KEY;
checks.push({
  name: 'Deepgram (Transcription)',
  configured: deepgramConfigured,
  envVars: ['DEEPGRAM_API_KEY'],
  setupUrl: 'https://console.deepgram.com',
  notes: deepgramConfigured ? 'API key configured' : 'Free tier: $200 credit',
});

// Check R2 Storage
const r2Configured = !!(
  process.env.R2_ENDPOINT &&
  process.env.R2_ACCESS_KEY &&
  process.env.R2_SECRET_KEY &&
  process.env.R2_BUCKET_NAME
);
checks.push({
  name: 'Cloudflare R2 (Storage)',
  configured: r2Configured,
  envVars: ['R2_ENDPOINT', 'R2_ACCESS_KEY', 'R2_SECRET_KEY', 'R2_BUCKET_NAME'],
  setupUrl: 'https://dash.cloudflare.com',
  notes: r2Configured ? `Bucket: ${process.env.R2_BUCKET_NAME}` : 'Free tier: 10GB storage',
});

// Check LLM Providers
const groqConfigured = !!process.env.GROQ_API_KEY;
const geminiConfigured = !!process.env.GOOGLE_AI_API_KEY;
const openaiConfigured = !!process.env.OPENAI_API_KEY;
const llmConfigured = groqConfigured || geminiConfigured || openaiConfigured;
checks.push({
  name: 'LLM Provider (Summarization)',
  configured: llmConfigured,
  envVars: ['GROQ_API_KEY', 'GOOGLE_AI_API_KEY', 'OPENAI_API_KEY'],
  notes: llmConfigured
    ? `Using: ${[groqConfigured && 'Groq', geminiConfigured && 'Gemini', openaiConfigured && 'OpenAI'].filter(Boolean).join(', ')}`
    : 'Need at least one provider',
});

// Check Telegram
const telegramConfigured = !!(process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_CHAT_ID);
checks.push({
  name: 'Telegram (Notifications)',
  configured: telegramConfigured,
  envVars: ['TELEGRAM_TOKEN', 'TELEGRAM_CHAT_ID'],
  notes: telegramConfigured ? 'Bot configured' : 'Optional - create bot via @BotFather',
});

// Check Plaud Sync Path
const plaudPathConfigured = !!process.env.PLAUD_SYNC_PATH;
checks.push({
  name: 'Plaud Sync Path',
  configured: plaudPathConfigured,
  envVars: ['PLAUD_SYNC_PATH'],
  notes: plaudPathConfigured ? process.env.PLAUD_SYNC_PATH : 'Optional - for file watcher mode',
});

// Display results
console.log('Service Configuration Status:\n');

for (const check of checks) {
  const status = check.configured ? '✅' : '❌';
  console.log(`${status} ${check.name}`);

  if (check.notes) {
    console.log(`   ${check.notes}`);
  }

  if (!check.configured) {
    console.log(`   Missing: ${check.envVars.join(', ')}`);
    if (check.setupUrl) {
      console.log(`   Setup: ${check.setupUrl}`);
    }
  }
  console.log('');
}

// Summary
const configuredCount = checks.filter(c => c.configured).length;
const requiredChecks = checks.filter(c => !['Telegram (Notifications)', 'Plaud Sync Path'].includes(c.name));
const requiredConfigured = requiredChecks.filter(c => c.configured).length;

console.log('─'.repeat(60));
console.log(`\nConfiguration: ${configuredCount}/${checks.length} services configured`);
console.log(`Required for VIP: ${requiredConfigured}/${requiredChecks.length} services ready\n`);

if (requiredConfigured === requiredChecks.length) {
  console.log('✅ VIP Pipeline is ready to process real audio!\n');
  console.log('To test:');
  console.log('  1. Start the hub: bun run dev');
  console.log('  2. Start the worker: bun run worker');
  console.log('  3. Upload an audio file via API or sync folder\n');
} else {
  console.log('⚠️  Some required services are not configured.\n');
  console.log('Add missing environment variables to /hub/.env\n');

  // Show example .env additions
  const missing = checks.filter(c => !c.configured && !['Telegram (Notifications)', 'Plaud Sync Path'].includes(c.name));
  if (missing.length > 0) {
    console.log('Example .env additions needed:\n');
    console.log('```');
    for (const check of missing) {
      for (const envVar of check.envVars) {
        if (!process.env[envVar]) {
          console.log(`${envVar}=your_value_here`);
        }
      }
    }
    console.log('```\n');
  }
}

process.exit(0);

import { z } from 'zod';

// Environment variable schema
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Redis (optional for Phase 0)
  REDIS_URL: z.string().url().optional(),

  // AI
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  VOYAGE_API_KEY: z.string().optional(),

  // Transcription
  DEEPGRAM_API_KEY: z.string().optional(),

  // OCR
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),

  // File Storage
  R2_ENDPOINT: z.string().url().optional(),
  R2_ACCESS_KEY: z.string().optional(),
  R2_SECRET_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),

  // Task System - Linear
  LINEAR_API_KEY: z.string().optional(),
  LINEAR_TEAM_ID: z.string().optional(),
  LINEAR_WEBHOOK_SECRET: z.string().optional(),

  // Google (Calendar, Gmail, Drive)
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_USER_EMAIL: z.string().email().optional(),
  GOOGLE_CALENDAR_ID: z.string().optional(),

  // Canvas
  CANVAS_BASE_URL: z.string().url().optional(),
  CANVAS_TOKEN: z.string().optional(),
  CANVAS_TERM_FILTER: z.string().optional(),

  // Notifications
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  USER_PHONE_NUMBER: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  USER_EMAIL: z.string().email().optional(),

  // Telegram (alternative notification)
  TELEGRAM_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),

  // Whoop (health & fitness)
  WHOOP_CLIENT_ID: z.string().optional(),
  WHOOP_CLIENT_SECRET: z.string().optional(),
  WHOOP_REDIRECT_URI: z.string().url().optional(),

  // App
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  API_BASE_URL: z.string().url().optional(),
});

// Parse and validate environment
function loadConfig() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Invalid environment variables:');
    console.error(result.error.format());
    throw new Error('Invalid environment configuration');
  }

  return result.data;
}

export const config = loadConfig();

// Type-safe config access
export type Config = z.infer<typeof envSchema>;

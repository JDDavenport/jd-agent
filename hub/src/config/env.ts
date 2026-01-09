import { z } from 'zod';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Environment types
export type Environment = 'development' | 'staging' | 'production';

// Zod schema for environment variables
const envSchema = z.object({
  // Core settings
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.string().transform(Number).default('3000'),

  // Database - Neon PostgreSQL
  DATABASE_URL: z.string().url().startsWith('postgres'),
  DATABASE_SSL: z.string().transform(val => val === 'true').default('true'),
  DATABASE_POOL_SIZE: z.string().transform(Number).default('10'),

  // Redis/Queue (optional in some environments)
  REDIS_URL: z.string().optional(),

  // API Keys
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Integration Keys (optional)
  NOTION_TOKEN: z.string().optional(),
  TODOIST_API_TOKEN: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),

  // Security
  JWT_SECRET: z.string().min(32).optional(),
  ENCRYPTION_KEY: z.string().optional(),

  // Feature flags
  ENABLE_AI_FEATURES: z.string().transform(val => val === 'true').default('true'),
  ENABLE_QUEUE_PROCESSING: z.string().transform(val => val === 'true').default('true'),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Determine current environment
 */
export function getCurrentEnvironment(): Environment {
  const env = process.env.APP_ENV || process.env.NODE_ENV || 'development';
  if (env === 'production' || env === 'staging' || env === 'development') {
    return env;
  }
  return 'development';
}

/**
 * Load environment-specific .env file
 */
function loadEnvFile(): void {
  const environment = getCurrentEnvironment();
  const rootDir = path.resolve(__dirname, '../../');

  // Priority order for env files
  const envFiles = [
    `.env.${environment}.local`,  // Highest priority - local overrides
    `.env.${environment}`,        // Environment-specific
    '.env.local',                 // Local overrides (gitignored)
    '.env',                       // Base config
  ];

  // Load files in reverse order so higher priority files override
  for (const envFile of envFiles.reverse()) {
    const filePath = path.join(rootDir, envFile);
    if (fs.existsSync(filePath)) {
      dotenv.config({ path: filePath, override: true });
    }
  }
}

/**
 * Validate and load environment configuration
 */
export function loadEnv(): EnvConfig {
  // Load the appropriate .env files
  loadEnvFile();

  // Validate environment variables
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const environment = getCurrentEnvironment();
    console.error(`\n[ENV ERROR] Invalid environment configuration for: ${environment}`);
    console.error('Missing or invalid environment variables:\n');

    for (const error of result.error.errors) {
      console.error(`  - ${error.path.join('.')}: ${error.message}`);
    }

    console.error('\nPlease check your .env files and ensure all required variables are set.');
    console.error(`Looking for: .env.${environment}, .env.local, .env\n`);

    // In development, don't crash - use defaults where possible
    if (getCurrentEnvironment() === 'development') {
      console.warn('[ENV] Running in development mode with partial configuration\n');
      return envSchema.parse({
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/jd_agent_dev',
      });
    }

    process.exit(1);
  }

  return result.data;
}

/**
 * Get database configuration for current environment
 */
export function getDatabaseConfig(env: EnvConfig) {
  const environment = getCurrentEnvironment();

  return {
    connectionString: env.DATABASE_URL,
    ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : false,
    max: env.DATABASE_POOL_SIZE,
    idleTimeoutMillis: environment === 'production' ? 30000 : 10000,
    connectionTimeoutMillis: environment === 'production' ? 5000 : 2000,
  };
}

/**
 * Check if running in specific environment
 */
export const isDevelopment = () => getCurrentEnvironment() === 'development';
export const isStaging = () => getCurrentEnvironment() === 'staging';
export const isProduction = () => getCurrentEnvironment() === 'production';

/**
 * Get environment display name
 */
export function getEnvironmentLabel(): string {
  const env = getCurrentEnvironment();
  const labels: Record<Environment, string> = {
    development: 'Development (Local)',
    staging: 'Staging',
    production: 'Production',
  };
  return labels[env];
}

// Export singleton config
let _config: EnvConfig | null = null;

export function getConfig(): EnvConfig {
  if (!_config) {
    _config = loadEnv();
  }
  return _config;
}

// Convenience export
export const env = new Proxy({} as EnvConfig, {
  get(_, prop: string) {
    return getConfig()[prop as keyof EnvConfig];
  },
});

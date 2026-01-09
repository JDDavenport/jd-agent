#!/usr/bin/env bun
/**
 * Environment-aware database migration script
 *
 * Usage:
 *   bun run scripts/db/migrate.ts [environment]
 *
 * Examples:
 *   bun run scripts/db/migrate.ts development
 *   bun run scripts/db/migrate.ts staging
 *   bun run scripts/db/migrate.ts production
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

type Environment = 'development' | 'staging' | 'production';

const validEnvironments: Environment[] = ['development', 'staging', 'production'];

// Parse command line args
const args = process.argv.slice(2);
const targetEnv = (args[0] || 'development') as Environment;
const dryRun = args.includes('--dry-run');

if (!validEnvironments.includes(targetEnv)) {
  console.error(`\nError: Invalid environment "${targetEnv}"`);
  console.error(`Valid environments: ${validEnvironments.join(', ')}\n`);
  process.exit(1);
}

// Check for environment file
const hubDir = path.resolve(__dirname, '../..');
const envFile = path.join(hubDir, `.env.${targetEnv}`);

if (!fs.existsSync(envFile)) {
  console.error(`\nError: Environment file not found: ${envFile}`);
  console.error(`Please create .env.${targetEnv} from .env.${targetEnv}.example\n`);
  process.exit(1);
}

console.log('\n========================================');
console.log(`Database Migration - ${targetEnv.toUpperCase()}`);
console.log('========================================\n');

if (targetEnv === 'production') {
  console.log('WARNING: You are about to migrate PRODUCTION database!');
  console.log('This action cannot be undone.');
  console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...\n');

  if (!dryRun) {
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

if (dryRun) {
  console.log('[DRY RUN] Would execute migration with:');
  console.log(`  Environment: ${targetEnv}`);
  console.log(`  Config file: ${envFile}`);
  console.log('\n[DRY RUN] No changes made.\n');
  process.exit(0);
}

try {
  // Set environment variables
  process.env.APP_ENV = targetEnv;
  process.env.NODE_ENV = targetEnv;

  // Load environment file
  const envContent = fs.readFileSync(envFile, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      process.env[key] = value;
    }
  });

  console.log(`Loading environment from: ${envFile}`);
  console.log(`Database URL: ${process.env.DATABASE_URL?.replace(/:[^@]+@/, ':***@')}`);
  console.log('\nRunning migrations...\n');

  // Run drizzle-kit push (applies schema changes)
  execSync('bunx drizzle-kit push', {
    cwd: hubDir,
    stdio: 'inherit',
    env: process.env,
  });

  console.log('\n========================================');
  console.log(`Migration completed for ${targetEnv.toUpperCase()}`);
  console.log('========================================\n');

} catch (error) {
  console.error('\nMigration failed:', error);
  process.exit(1);
}

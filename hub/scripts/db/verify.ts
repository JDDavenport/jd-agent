#!/usr/bin/env bun
/**
 * Database Environment Verification Script
 *
 * Verifies database connectivity and basic operations for an environment.
 *
 * Usage:
 *   bun run scripts/db/verify.ts [environment]
 *
 * Examples:
 *   bun run scripts/db/verify.ts development
 *   bun run scripts/db/verify.ts staging
 *   bun run scripts/db/verify.ts production
 *   bun run scripts/db/verify.ts --all
 */

import * as path from 'path';
import * as fs from 'fs';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { sql } from 'drizzle-orm';
import * as schema from '../../src/db/schema';

const { Pool } = pg;

type Environment = 'development' | 'staging' | 'production';

const validEnvironments: Environment[] = ['development', 'staging', 'production'];

// Parse command line args
const args = process.argv.slice(2);
const verifyAll = args.includes('--all');
const targetEnv = verifyAll ? null : (args[0] || 'development') as Environment;

interface VerificationResult {
  environment: Environment;
  status: 'success' | 'failed' | 'skipped';
  connection: boolean;
  tables: number;
  canRead: boolean;
  canWrite: boolean;
  latency: number;
  error?: string;
}

async function verifyEnvironment(environment: Environment): Promise<VerificationResult> {
  const result: VerificationResult = {
    environment,
    status: 'failed',
    connection: false,
    tables: 0,
    canRead: false,
    canWrite: false,
    latency: 0,
  };

  const hubDir = path.resolve(__dirname, '../..');
  const envFile = path.join(hubDir, `.env.${environment}`);

  // Check for environment file
  if (!fs.existsSync(envFile)) {
    result.status = 'skipped';
    result.error = `Environment file not found: .env.${environment}`;
    return result;
  }

  // Load environment variables
  const envContent = fs.readFileSync(envFile, 'utf-8');
  const envVars: Record<string, string> = {};

  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      envVars[key] = value;
    }
  });

  const databaseUrl = envVars.DATABASE_URL;
  if (!databaseUrl) {
    result.status = 'skipped';
    result.error = 'DATABASE_URL not found in environment file';
    return result;
  }

  // Create database connection
  const useSSL = envVars.DATABASE_SSL !== 'false';
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: useSSL ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000,
  });

  const db = drizzle(pool, { schema });

  try {
    // Test 1: Connection and latency
    const startTime = Date.now();
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    result.latency = Date.now() - startTime;
    result.connection = true;

    // Test 2: Count tables
    const tablesResult = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    result.tables = Number((tablesResult.rows[0] as any).count) || 0;

    // Test 3: Can read (try to query tasks)
    try {
      await db.select().from(schema.tasks).limit(1);
      result.canRead = true;
    } catch {
      result.canRead = false;
    }

    // Test 4: Can write (only in development/staging)
    if (environment !== 'production') {
      try {
        // Try to insert and then delete a test label
        const testName = `_test_${Date.now()}`;
        await db.insert(schema.labels).values({ name: testName, color: '#000000' });
        await db.delete(schema.labels).where(sql`name = ${testName}`);
        result.canWrite = true;
      } catch {
        result.canWrite = false;
      }
    } else {
      // Don't test writes in production
      result.canWrite = true; // Assume true - we don't want to write to prod
    }

    result.status = 'success';

  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  } finally {
    await pool.end();
  }

  return result;
}

function printResult(result: VerificationResult) {
  const statusIcon = {
    success: '\x1b[32m[PASS]\x1b[0m',
    failed: '\x1b[31m[FAIL]\x1b[0m',
    skipped: '\x1b[33m[SKIP]\x1b[0m',
  }[result.status];

  console.log(`\n${statusIcon} ${result.environment.toUpperCase()}`);
  console.log('─'.repeat(40));

  if (result.status === 'skipped') {
    console.log(`  Skipped: ${result.error}`);
    return;
  }

  if (result.status === 'failed') {
    console.log(`  Error: ${result.error}`);
    return;
  }

  console.log(`  Connection:  ${result.connection ? '\x1b[32m OK\x1b[0m' : '\x1b[31m FAILED\x1b[0m'}`);
  console.log(`  Latency:     ${result.latency}ms`);
  console.log(`  Tables:      ${result.tables}`);
  console.log(`  Can Read:    ${result.canRead ? '\x1b[32m OK\x1b[0m' : '\x1b[31m FAILED\x1b[0m'}`);
  console.log(`  Can Write:   ${result.canWrite ? '\x1b[32m OK\x1b[0m' : '\x1b[31m FAILED\x1b[0m'}${result.environment === 'production' ? ' (not tested)' : ''}`);
}

async function main() {
  console.log('\n========================================');
  console.log('Database Environment Verification');
  console.log('========================================');

  const environmentsToVerify = verifyAll
    ? validEnvironments
    : targetEnv && validEnvironments.includes(targetEnv)
      ? [targetEnv]
      : ['development' as Environment];

  if (!verifyAll && targetEnv && !validEnvironments.includes(targetEnv)) {
    console.error(`\nError: Invalid environment "${targetEnv}"`);
    console.error(`Valid environments: ${validEnvironments.join(', ')}`);
    console.error('Or use --all to verify all environments\n');
    process.exit(1);
  }

  const results: VerificationResult[] = [];

  for (const env of environmentsToVerify) {
    const result = await verifyEnvironment(env);
    results.push(result);
    printResult(result);
  }

  // Summary
  console.log('\n========================================');
  console.log('Summary');
  console.log('========================================\n');

  const passed = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const skipped = results.filter(r => r.status === 'skipped').length;

  console.log(`  Passed:  ${passed}`);
  console.log(`  Failed:  ${failed}`);
  console.log(`  Skipped: ${skipped}`);
  console.log('');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('\nVerification failed:', error);
  process.exit(1);
});

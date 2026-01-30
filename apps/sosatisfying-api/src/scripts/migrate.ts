import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import pg from 'pg';
import { getEnv } from '../config/env';

const { Pool } = pg;

const { databaseUrl } = getEnv();
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
});

const run = async () => {
  const migrationsDir = join(import.meta.dir, '../../migrations');
  if (!existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found: ${migrationsDir}`);
  }

  const migrations = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const client = await pool.connect();
  try {
    for (const file of migrations) {
      const migrationPath = join(migrationsDir, file);
      const sql = readFileSync(migrationPath, 'utf-8');

      if (file.includes('0001')) {
        const result = await client.query(`SELECT to_regclass('public.sos_users') as table_name`);
        if (result.rows[0]?.table_name) {
          console.log(`[Migrate] ${file} already applied, skipping.`);
          continue;
        }
      }

      if (file.includes('0002')) {
        const result = await client.query(`SELECT to_regclass('public.sos_bug_reports') as table_name`);
        if (result.rows[0]?.table_name) {
          console.log(`[Migrate] ${file} already applied, skipping.`);
          continue;
        }
      }

      if (file.includes('0003')) {
        const result = await client.query(`SELECT to_regclass('public.sos_ad_spaces') as table_name`);
        if (result.rows[0]?.table_name) {
          console.log(`[Migrate] ${file} already applied, skipping.`);
          continue;
        }
      }

      if (file.includes('0004')) {
        const result = await client.query(`SELECT to_regclass('public.sos_rank_settings') as table_name`);
        if (result.rows[0]?.table_name) {
          console.log(`[Migrate] ${file} already applied, skipping.`);
          continue;
        }
      }

      console.log(`[Migrate] Applying ${file}...`);
      await client.query(sql);
      console.log(`[Migrate] ${file} applied.`);
    }
  } finally {
    client.release();
  }
};

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[Migrate] Failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });

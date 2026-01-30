import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';
import { getEnv } from '../config/env';

const { Pool } = pg;

const { databaseUrl } = getEnv();

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[SoSatisfying DB] Pool error:', err.message);
});

export const db = drizzle(pool, { schema });
export { pool };

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';
import { getConfig, getDatabaseConfig, getCurrentEnvironment, getEnvironmentLabel } from '../config/env';

const { Pool } = pg;

// Load environment configuration
const config = getConfig();
const dbConfig = getDatabaseConfig(config);

// Create PostgreSQL connection pool with environment-aware settings
const pool = new Pool({
  connectionString: dbConfig.connectionString,
  ssl: dbConfig.ssl,
  max: dbConfig.max,
  idleTimeoutMillis: dbConfig.idleTimeoutMillis,
  connectionTimeoutMillis: dbConfig.connectionTimeoutMillis,
});

// Handle pool errors to prevent crashes
pool.on('error', (err) => {
  console.error('[Database] Pool error:', err.message);
  console.error('[Database] Pool error stack:', err.stack);
  // Don't crash the process, let the connection be retried
});

pool.on('connect', () => {
  console.log('[Database] New client connected to pool');
});

// Log connection info (without sensitive data)
const environment = getCurrentEnvironment();
console.log(`[Database] Connecting to ${getEnvironmentLabel()}`);
console.log(`[Database] Pool size: ${dbConfig.max}, SSL: ${dbConfig.ssl ? 'enabled' : 'disabled'}`);

// Create Drizzle ORM instance
export const db = drizzle(pool, { schema });

// Export pool for direct access if needed
export { pool };

// Export environment info for other modules
export { environment };

// Health check function
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error(`[Database] Connection failed (${getEnvironmentLabel()}):`, error);
    return false;
  }
}

// Get current database info (safe to expose)
export function getDatabaseInfo() {
  const url = new URL(dbConfig.connectionString);
  return {
    environment: getCurrentEnvironment(),
    environmentLabel: getEnvironmentLabel(),
    host: url.hostname,
    database: url.pathname.slice(1),
    ssl: !!dbConfig.ssl,
    poolSize: dbConfig.max,
  };
}

import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;
let dbInitError: Error | null = null;

export async function getDatabase(): Promise<Database> {
  if (dbInitError) {
    throw dbInitError;
  }

  if (!db) {
    try {
      console.log('[SQLite] Initializing database...');
      db = await Database.load('sqlite:vault.db');
      console.log('[SQLite] Database loaded, running migrations...');
      await runMigrations(db);
      console.log('[SQLite] Database ready');
    } catch (error) {
      dbInitError = error as Error;
      console.error('[SQLite] Failed to initialize database:', error);
      throw error;
    }
  }
  return db;
}

export function isDatabaseReady(): boolean {
  return db !== null && !dbInitError;
}

export function getDatabaseError(): Error | null {
  return dbInitError;
}

export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}

async function runMigrations(database: Database): Promise<void> {
  // Create migration tracking table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const migrations = [
    { name: '001_initial_schema', fn: migration001InitialSchema },
    { name: '002_sync_queue', fn: migration002SyncQueue },
  ];

  for (const migration of migrations) {
    const applied = await database.select<{ name: string }[]>(
      'SELECT name FROM migrations WHERE name = ?',
      [migration.name]
    );

    if (applied.length === 0) {
      console.log(`Running migration: ${migration.name}`);
      await migration.fn(database);
      await database.execute(
        'INSERT INTO migrations (name) VALUES (?)',
        [migration.name]
      );
    }
  }
}

async function migration001InitialSchema(database: Database): Promise<void> {
  // Vault Pages table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS vault_pages (
      id TEXT PRIMARY KEY,
      parent_id TEXT REFERENCES vault_pages(id) ON DELETE SET NULL,
      title TEXT NOT NULL DEFAULT 'Untitled',
      icon TEXT,
      cover_image TEXT,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      is_archived INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      para_type TEXT,
      is_system INTEGER NOT NULL DEFAULT 0,
      legacy_entry_id TEXT,
      last_viewed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      -- Sync metadata
      sync_status TEXT NOT NULL DEFAULT 'synced',
      server_version INTEGER NOT NULL DEFAULT 0,
      local_version INTEGER NOT NULL DEFAULT 1,
      deleted_at TEXT
    )
  `);

  // Vault Blocks table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS vault_blocks (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL REFERENCES vault_pages(id) ON DELETE CASCADE,
      parent_block_id TEXT REFERENCES vault_blocks(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      -- Sync metadata
      sync_status TEXT NOT NULL DEFAULT 'synced',
      server_version INTEGER NOT NULL DEFAULT 0,
      local_version INTEGER NOT NULL DEFAULT 1
    )
  `);

  // Create indexes
  await database.execute('CREATE INDEX IF NOT EXISTS idx_pages_parent ON vault_pages(parent_id)');
  await database.execute('CREATE INDEX IF NOT EXISTS idx_pages_favorite ON vault_pages(is_favorite)');
  await database.execute('CREATE INDEX IF NOT EXISTS idx_pages_archived ON vault_pages(is_archived)');
  await database.execute('CREATE INDEX IF NOT EXISTS idx_pages_sync_status ON vault_pages(sync_status)');
  await database.execute('CREATE INDEX IF NOT EXISTS idx_blocks_page ON vault_blocks(page_id)');
  await database.execute('CREATE INDEX IF NOT EXISTS idx_blocks_parent ON vault_blocks(parent_block_id)');
  await database.execute('CREATE INDEX IF NOT EXISTS idx_blocks_order ON vault_blocks(page_id, parent_block_id, sort_order)');
  await database.execute('CREATE INDEX IF NOT EXISTS idx_blocks_sync_status ON vault_blocks(sync_status)');
}

async function migration002SyncQueue(database: Database): Promise<void> {
  // Sync queue for offline changes
  await database.execute(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      last_attempt_at TEXT
    )
  `);

  // Sync metadata table
  await database.execute(`
    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await database.execute('CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id)');
  await database.execute('CREATE INDEX IF NOT EXISTS idx_sync_queue_created ON sync_queue(created_at)');
}

// Helper for generating UUIDs
export function generateId(): string {
  return crypto.randomUUID();
}

// Helper for ISO timestamps
export function now(): string {
  return new Date().toISOString();
}

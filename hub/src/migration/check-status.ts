import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Load env
const rootEnvPath = join(import.meta.dir, '../../../.env');
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

import { db } from '../db/client';
import { vaultEntries } from '../db/schema';
import { sql, count, eq, or, inArray, isNull } from 'drizzle-orm';

async function main() {
  // Get counts by context for imported sources
  const results = await db.execute(sql`
    SELECT
      COALESCE(parent.title, 'No Parent') as bucket,
      ve.source,
      COUNT(*) as count
    FROM vault_entries ve
    LEFT JOIN vault_entries parent ON ve.parent_id = parent.id
    WHERE ve.source IN ('apple_notes', 'notion', 'todoist', 'google_drive', 'manual')
    GROUP BY parent.title, ve.source
    ORDER BY count DESC
    LIMIT 50
  `);

  console.log('\n=== Migration Status ===\n');
  console.log('Entries by bucket and source:');
  console.table(results.rows);

  // Get bucket folder count
  const buckets = await db.execute(sql`
    SELECT title, context
    FROM vault_entries
    WHERE source = 'manual'
    AND tags @> ARRAY['bucket']::text[]
    ORDER BY title
  `);

  console.log('\nBucket folders created:');
  console.table(buckets.rows);

  // Total imported
  const total = await db.execute(sql`
    SELECT source, COUNT(*) as count
    FROM vault_entries
    WHERE source IN ('apple_notes', 'notion', 'todoist', 'google_drive')
    GROUP BY source
  `);

  console.log('\nTotal imported by source:');
  console.table(total.rows);

  process.exit(0);
}

main().catch(console.error);

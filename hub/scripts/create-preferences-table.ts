import { db } from '../src/db/client';
import { sql } from 'drizzle-orm';

async function createTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS budget_report_preferences (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      daily_email_enabled BOOLEAN NOT NULL DEFAULT true,
      daily_sms_enabled BOOLEAN NOT NULL DEFAULT true,
      daily_time TEXT NOT NULL DEFAULT '07:00',
      weekly_email_enabled BOOLEAN NOT NULL DEFAULT true,
      weekly_sms_enabled BOOLEAN NOT NULL DEFAULT true,
      weekly_day INTEGER NOT NULL DEFAULT 0,
      weekly_time TEXT NOT NULL DEFAULT '09:00',
      alerts_enabled BOOLEAN NOT NULL DEFAULT true,
      large_transaction_threshold_cents INTEGER NOT NULL DEFAULT 10000,
      unusual_spending_multiplier REAL NOT NULL DEFAULT 2.0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  console.log('Table created successfully');
  process.exit(0);
}

createTable().catch(e => { console.error(e); process.exit(1); });

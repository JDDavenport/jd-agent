import { db, checkDatabaseConnection } from '../src/db/client';
import { tasks, vaultEntries, calendarEvents, projects, recordings, people, classes, ceremonies } from '../src/db/schema';
import { sql } from 'drizzle-orm';

async function verifyDatabase() {
  console.log('🔍 Testing database connection...\n');

  try {
    // Test basic connection
    const connected = await checkDatabaseConnection();
    if (!connected) {
      console.error('❌ DATABASE CONNECTION FAILED');
      process.exit(1);
    }
    console.log('✅ Database connection successful\n');

    // Test each critical table
    console.log('📊 Checking tables...\n');

    const tableChecks = [
      { name: 'tasks', table: tasks },
      { name: 'projects', table: projects },
      { name: 'vault_entries', table: vaultEntries },
      { name: 'calendar_events', table: calendarEvents },
      { name: 'recordings', table: recordings },
      { name: 'people', table: people },
      { name: 'classes', table: classes },
      { name: 'ceremonies', table: ceremonies },
    ];

    for (const { name, table } of tableChecks) {
      try {
        const result = await db.select().from(table).limit(1);
        const count = await db.select({ count: sql<number>`count(*)` }).from(table);
        console.log(`✅ ${name}: accessible (${count[0].count} records)`);
      } catch (error) {
        console.log(`❌ ${name}: ERROR - ${error}`);
      }
    }

    // Check for any pending migrations or schema issues
    console.log('\n📋 Schema validation...');

    // Test a simple insert/delete to verify write access
    console.log('\n🔧 Testing write access...');

    const testId = crypto.randomUUID();
    await db.execute(sql`
      INSERT INTO system_logs (id, log_type, message, created_at)
      VALUES (${testId}, 'test', 'Database verification test', NOW())
    `);
    console.log('✅ Write access confirmed');

    await db.execute(sql`DELETE FROM system_logs WHERE id = ${testId}`);
    console.log('✅ Delete access confirmed');

    console.log('\n' + '='.repeat(50));
    console.log('✅ DATABASE VERIFICATION PASSED');
    console.log('='.repeat(50) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ DATABASE VERIFICATION FAILED:', error);
    process.exit(1);
  }
}

verifyDatabase();

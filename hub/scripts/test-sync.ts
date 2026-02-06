#!/usr/bin/env bun
/**
 * Test Study Help Sync
 */

import { syncUserCanvas } from '../src/services/study-help-sync';
import { db } from '../src/db/client';
import { studyHelpUsers } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('Testing Study Help Sync...\n');

  // Get JD's user ID
  const [jd] = await db
    .select()
    .from(studyHelpUsers)
    .where(eq(studyHelpUsers.email, 'jddavenport46@gmail.com'))
    .limit(1);

  if (!jd) {
    console.log('❌ JD account not found');
    process.exit(1);
  }

  console.log('Found user:', jd.email, jd.id);
  console.log('Canvas connected:', !!jd.canvasAccessTokenEncrypted);
  console.log('Institution:', jd.institutionId);
  console.log();

  console.log('Starting sync...');
  const result = await syncUserCanvas(jd.id);

  console.log('\nSync Result:');
  console.log('  Success:', result.success);
  console.log('  Courses:', result.coursesUpdated);
  console.log('  Assignments:', result.assignmentsUpdated);
  console.log('  Materials:', result.materialsUpdated);
  
  if (result.errors.length > 0) {
    console.log('  Errors:');
    for (const error of result.errors.slice(0, 10)) {
      console.log('    -', error.slice(0, 200));
    }
  }

  process.exit(0);
}

main().catch(e => {
  console.error('Failed:', e);
  process.exit(1);
});

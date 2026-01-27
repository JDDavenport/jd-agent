/**
 * Manual Test Script: Canvas Integrity Agent
 *
 * Tests the full Canvas integrity agent with reading detection
 *
 * Usage:
 *   bun run scripts/test-canvas-integrity-agent.ts
 *
 * This will:
 * 1. Run a full Canvas audit (visits MODULES, FILES, PAGES)
 * 2. Detect readings, files, and pages
 * 3. Create tasks for all detected items
 * 4. Display results
 */

import { CanvasIntegrityAgent } from '../src/agents/canvas-integrity';
import { db } from '../src/db/client';
import { canvasItems, tasks } from '../src/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';

async function testCanvasIntegrityAgent() {
  console.log('🧪 Testing Canvas Integrity Agent (Full Audit)\n');
  console.log('This will run a full browser-based audit including reading detection.\n');

  // Check current state
  const beforeItems = await db
    .select({ count: sql<number>`count(*)` })
    .from(canvasItems);

  const beforeTasks = await db
    .select({ count: sql<number>`count(*)` })
    .from(tasks)
    .where(eq(tasks.source, 'canvas'));

  console.log('📊 State BEFORE audit:');
  console.log(`  - Canvas items: ${beforeItems[0]?.count || 0}`);
  console.log(`  - Canvas tasks: ${beforeTasks[0]?.count || 0}\n`);

  // Run full audit
  console.log('🚀 Running full Canvas audit...\n');
  const agent = new CanvasIntegrityAgent();

  try {
    const result = await agent.runAudit('full');

    console.log('\n✅ Audit Complete!\n');
    console.log('📈 Results:');
    console.log(`  - Audit ID: ${result.auditId}`);
    console.log(`  - Status: ${result.status}`);
    console.log(`  - Courses audited: ${result.coursesAudited}`);
    console.log(`  - Pages visited: ${result.pagesVisited}`);
    console.log(`  - Items discovered: ${result.itemsDiscovered}`);
    console.log(`  - Tasks created: ${result.tasksCreated}`);
    console.log(`  - Tasks verified: ${result.tasksVerified}`);
    console.log(`  - Tasks updated: ${result.tasksUpdated}`);
    console.log(`  - Discrepancies: ${result.discrepanciesFound}`);
    console.log(`  - Integrity score: ${result.integrityScore}%\n`);

    // Show new items
    if (result.findings.newItems.length > 0) {
      console.log('🆕 New items detected:');
      result.findings.newItems.slice(0, 10).forEach((item, i) => {
        console.log(`  ${i + 1}. ${item}`);
      });
      if (result.findings.newItems.length > 10) {
        console.log(`  ...and ${result.findings.newItems.length - 10} more\n`);
      }
    } else {
      console.log('ℹ️  No new items detected\n');
    }

    // Show errors if any
    if (result.findings.errors.length > 0) {
      console.log('⚠️  Errors encountered:');
      result.findings.errors.forEach((error, i) => {
        console.log(`  ${i + 1}. ${error}`);
      });
      console.log('');
    }

    // Check state after
    const afterItems = await db
      .select({ count: sql<number>`count(*)` })
      .from(canvasItems);

    const afterTasks = await db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(eq(tasks.source, 'canvas'));

    console.log('📊 State AFTER audit:');
    console.log(`  - Canvas items: ${afterItems[0]?.count || 0} (+${(afterItems[0]?.count || 0) - (beforeItems[0]?.count || 0)})`);
    console.log(`  - Canvas tasks: ${afterTasks[0]?.count || 0} (+${(afterTasks[0]?.count || 0) - (beforeTasks[0]?.count || 0)})\n`);

    // Check for reading items specifically
    const readingItems = await db
      .select({
        canvasType: canvasItems.canvasType,
        count: sql<number>`count(*)`,
      })
      .from(canvasItems)
      .where(inArray(canvasItems.canvasType, ['file', 'external_url', 'page']))
      .groupBy(canvasItems.canvasType);

    console.log('📚 Reading items by type:');
    if (readingItems.length === 0) {
      console.log('  ℹ️  No reading items found (file, page, external_url)');
      console.log('  💡 This could mean:');
      console.log('     - No readings in Canvas modules');
      console.log('     - Browser automation didn\'t visit MODULES page');
      console.log('     - Reading detection keywords didn\'t match');
    } else {
      readingItems.forEach((item) => {
        console.log(`  - ${item.canvasType}: ${item.count}`);
      });
    }

    // Show sample reading tasks
    const readingTasks = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        sourceRef: tasks.sourceRef,
        dueDate: tasks.dueDate,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.source, 'canvas'),
          sql`${tasks.title} LIKE '📖 Read:%'`
        )
      )
      .limit(5);

    console.log('\n📖 Sample reading tasks:');
    if (readingTasks.length === 0) {
      console.log('  ℹ️  No reading tasks found');
    } else {
      readingTasks.forEach((task, i) => {
        console.log(`  ${i + 1}. ${task.title}`);
        console.log(`     Due: ${task.dueDate || 'No due date'}`);
        console.log(`     Source: ${task.sourceRef}`);
      });
    }

    console.log('\n✅ Test complete!\n');

    // Cleanup
    await agent.cleanup();

  } catch (error) {
    console.error('\n❌ Audit failed:', error);

    // Try cleanup even on error
    try {
      await agent.cleanup();
    } catch (cleanupError) {
      console.error('Failed to cleanup:', cleanupError);
    }

    process.exit(1);
  }
}

testCanvasIntegrityAgent()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test script failed:', error);
    process.exit(1);
  });

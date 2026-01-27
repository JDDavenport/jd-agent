/**
 * Test Script: Canvas Reading Detection
 * Checks if Canvas agent detects reading materials
 */

import { db } from '../src/db/client';
import { canvasItems, tasks, readHelpBooks } from '../src/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';

async function testCanvasReadings() {
  console.log('🔍 Testing Canvas Reading Detection\n');

  // Check total canvas items
  const totalItems = await db
    .select({ count: sql<number>`count(*)` })
    .from(canvasItems);
  console.log(`✅ Total Canvas items: ${totalItems[0]?.count || 0}`);

  // Check reading-related items (files, external_url, pages)
  const readingTypes = await db
    .select({
      canvasType: canvasItems.canvasType,
      count: sql<number>`count(*)`,
    })
    .from(canvasItems)
    .where(inArray(canvasItems.canvasType, ['file', 'external_url', 'page']))
    .groupBy(canvasItems.canvasType);

  console.log('\n📚 Reading-related Canvas items:');
  readingTypes.forEach((item) => {
    console.log(`  - ${item.canvasType}: ${item.count}`);
  });

  // Check if any have material type 'reading'
  const readingMaterials = await db
    .select({
      id: canvasItems.id,
      title: canvasItems.title,
      canvasType: canvasItems.canvasType,
      courseName: canvasItems.courseName,
      url: canvasItems.url,
    })
    .from(canvasItems)
    .where(
      and(
        inArray(canvasItems.canvasType, ['file', 'external_url', 'page']),
        sql`${canvasItems.title} ~* 'reading|article|chapter|case|paper'`
      )
    )
    .limit(10);

  console.log('\n📖 Sample reading assignments (based on title keywords):');
  if (readingMaterials.length === 0) {
    console.log('  ❌ No reading materials found with keywords');
  } else {
    readingMaterials.forEach((item, i) => {
      console.log(`  ${i + 1}. ${item.title}`);
      console.log(`     Type: ${item.canvasType} | Course: ${item.courseName}`);
      console.log(`     URL: ${item.url || 'N/A'}`);
    });
  }

  // Check if any Canvas items have linked tasks
  const itemsWithTasks = await db
    .select({
      canvasType: canvasItems.canvasType,
      count: sql<number>`count(*)`,
    })
    .from(canvasItems)
    .where(sql`${canvasItems.taskId} IS NOT NULL`)
    .groupBy(canvasItems.canvasType);

  console.log('\n✅ Canvas items with linked tasks:');
  if (itemsWithTasks.length === 0) {
    console.log('  ❌ No Canvas items linked to tasks');
  } else {
    itemsWithTasks.forEach((item) => {
      console.log(`  - ${item.canvasType}: ${item.count} tasks`);
    });
  }

  // Check if any tasks have Canvas source
  const canvasTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      source: tasks.source,
      sourceRef: tasks.sourceRef,
      dueDate: tasks.dueDate,
    })
    .from(tasks)
    .where(eq(tasks.source, 'canvas'))
    .limit(5);

  console.log('\n📝 Sample Canvas tasks:');
  if (canvasTasks.length === 0) {
    console.log('  ❌ No tasks with Canvas source');
  } else {
    canvasTasks.forEach((task, i) => {
      console.log(`  ${i + 1}. ${task.title}`);
      console.log(`     Due: ${task.dueDate || 'N/A'}`);
      console.log(`     Source Ref: ${task.sourceRef || 'N/A'}`);
    });
  }

  // Check Read Help books
  const totalBooks = await db
    .select({ count: sql<number>`count(*)` })
    .from(readHelpBooks);
  console.log(`\n📚 Total Read Help books: ${totalBooks[0]?.count || 0}`);

  // Check if any books have tags
  const booksWithTags = await db
    .select({
      id: readHelpBooks.id,
      title: readHelpBooks.title,
      tags: readHelpBooks.tags,
    })
    .from(readHelpBooks)
    .where(sql`${readHelpBooks.tags} IS NOT NULL`)
    .limit(5);

  console.log('\n🏷️  Sample books with tags:');
  if (booksWithTags.length === 0) {
    console.log('  ℹ️  No books with tags (expected - no class integration yet)');
  } else {
    booksWithTags.forEach((book, i) => {
      console.log(`  ${i + 1}. ${book.title}`);
      console.log(`     Tags: ${book.tags?.join(', ') || 'none'}`);
    });
  }

  console.log('\n✅ Test complete!\n');
}

testCanvasReadings()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });

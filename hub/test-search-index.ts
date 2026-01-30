import { db } from './src/db/client';
import { readHelpSearchIndex, readHelpChapters } from './src/db/schema';
import { eq } from 'drizzle-orm';

async function checkSearchIndex() {
  const bookId = 'bf889019-dd5d-4a58-96f2-3b4e6204c7b2';

  console.log('\n=== Checking Search Index ===\n');

  // Check chapters
  const chapters = await db
    .select()
    .from(readHelpChapters)
    .where(eq(readHelpChapters.bookId, bookId));

  console.log(`Chapters found: ${chapters.length}`);
  for (const ch of chapters) {
    console.log(`  - ${ch.chapterNumber}. ${ch.title?.substring(0, 50)}`);
  }

  // Check search index
  const searchEntries = await db
    .select()
    .from(readHelpSearchIndex)
    .where(eq(readHelpSearchIndex.bookId, bookId));

  console.log(`\nSearch index entries: ${searchEntries.length}`);

  if (searchEntries.length > 0) {
    console.log(`First entry preview:`);
    console.log(`  - Content: ${searchEntries[0].content.substring(0, 100)}...`);
  } else {
    console.log(`\nNo search index entries found! This is the problem.`);
    console.log(`The reprocessChapters function should have created these.`);
  }

  process.exit(0);
}

checkSearchIndex();

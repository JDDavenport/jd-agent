import { db } from './src/db/client';
import { readHelpSearchIndex } from './src/db/schema';
import { eq, like } from 'drizzle-orm';

async function testSearch() {
  const bookId = 'bf889019-dd5d-4a58-96f2-3b4e6204c7b2';
  const searchTerm = 'ryanair';

  console.log(`\nSearching for "${searchTerm}" in book ${bookId}...\n`);

  // Direct search using LIKE
  const results = await db
    .select()
    .from(readHelpSearchIndex)
    .where(eq(readHelpSearchIndex.bookId, bookId))
    .limit(1000);

  console.log(`Total search entries for this book: ${results.length}`);

  // Filter in JavaScript (like the service does)
  const matches = results.filter(r =>
    r.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  console.log(`Matches for "${searchTerm}": ${matches.length}`);

  if (matches.length > 0) {
    console.log(`\nFirst 3 matches:`);
    for (let i = 0; i < Math.min(3, matches.length); i++) {
      const match = matches[i];
      const preview = match.content.substring(0, 150).replace(/\n/g, ' ');
      console.log(`  ${i + 1}. Page ${match.pageNumber}: ${preview}...`);
    }
  }

  process.exit(0);
}

testSearch();

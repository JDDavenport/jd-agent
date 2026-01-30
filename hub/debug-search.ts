import { db } from './src/db/client';
import { readHelpSearchIndex } from './src/db/schema';
import { eq } from 'drizzle-orm';

async function debugSearch() {
  const bookId = 'bf889019-dd5d-4a58-96f2-3b4e6204c7b2';
  const query = 'ryan air';
  const limit = 20;

  console.log('\n=== Debug Search Logic ===\n');
  console.log(`Query: "${query}"`);
  console.log(`Book ID: ${bookId}`);
  console.log(`Limit: ${limit}\n`);

  // Step 1: Mimic the service's query
  console.log('Step 1: Fetching from database (limit 100)...');
  let searchQuery = db
    .select({
      id: readHelpSearchIndex.id,
      bookId: readHelpSearchIndex.bookId,
      chapterId: readHelpSearchIndex.chapterId,
      pageNumber: readHelpSearchIndex.pageNumber,
      content: readHelpSearchIndex.content,
    })
    .from(readHelpSearchIndex);

  searchQuery = searchQuery.where(eq(readHelpSearchIndex.bookId, bookId)) as typeof searchQuery;

  const results = await searchQuery.limit(limit * 5); // Get more, then filter
  console.log(`  Fetched: ${results.length} entries`);

  // Step 2: Search terms
  const searchTerms = query.toLowerCase().split(/\s+/);
  console.log(`\nStep 2: Search terms: ${JSON.stringify(searchTerms)}`);

  // Step 3: Score and filter
  console.log('\nStep 3: Scoring results...');
  const scoredResults = results
    .map((r) => {
      const contentLower = r.content.toLowerCase();
      let score = 0;
      for (const term of searchTerms) {
        if (contentLower.includes(term)) {
          score += 1;
        }
      }
      return { ...r, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  console.log(`  Scored results with score > 0: ${scoredResults.length}`);

  if (scoredResults.length > 0) {
    console.log(`\nFirst result:`);
    console.log(`  Score: ${scoredResults[0].score}`);
    console.log(`  Content preview: ${scoredResults[0].content.substring(0, 150)}...`);
  } else {
    console.log(`\nNo results found!`);
    console.log(`\nLet's check if any content contains "ryanair"...`);

    const anyMatch = results.find(r => r.content.toLowerCase().includes('ryanair'));
    if (anyMatch) {
      console.log(`  Found match! Content: ${anyMatch.content.substring(0, 150)}...`);
    } else {
      console.log(`  No matches for "ryanair" in first ${results.length} entries`);
    }
  }

  process.exit(0);
}

debugSearch();

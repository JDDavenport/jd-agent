/**
 * Import Utah Businesses to Acquisition Database
 *
 * Run with: bun run scripts/import-utah-businesses.ts
 */

import { UtahBusinessScraper } from '../src/services/utah-business-scraper';

async function main() {
  const scraper = new UtahBusinessScraper(20, 30, true); // 20-30 years old, active only

  console.log('\n=== Utah Business Import ===\n');

  console.log('Running scraper for 20-30 year old Utah businesses...\n');
  console.log('This will search 15 prefixes (may take a few minutes).\n');

  // Scrape with 15 prefixes for a good test set
  const { scrapeResult, importResult } = await scraper.scrapeAndImport(15);

  console.log(`\nScrape complete:`);
  console.log(`  - Total scraped: ${scrapeResult.totalScraped}`);
  console.log(`  - In age range: ${scrapeResult.matchingAgeRange}`);
  if (scrapeResult.errors.length > 0) {
    console.log(`  - Errors: ${scrapeResult.errors.join(', ')}`);
  }

  console.log(`\nImport complete:`);
  console.log(`  - Imported: ${importResult.imported}`);
  console.log(`  - Skipped (duplicates): ${importResult.skipped}`);

  console.log('\nDone!');
  process.exit(0);
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});

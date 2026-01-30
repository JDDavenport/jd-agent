/**
 * Utah Business Import Script
 *
 * Imports scraped Utah business data to the database
 */

import { utahBusinessScraper } from '../src/services/utah-business-scraper';

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          Utah Business Import                              ║');
  console.log('║          Import scraped results to database                ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const results = utahBusinessScraper.loadResults();
  console.log(`Found ${results.length} businesses in results file\n`);

  if (results.length === 0) {
    console.log('No results found. Run the scraper first:');
    console.log('  bun run scripts/utah-scrape.ts scrape 50');
    return;
  }

  console.log('Importing to database...\n');
  const importResult = await utahBusinessScraper.importToDatabase();

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('IMPORT RESULTS:');
  console.log(`  Imported: ${importResult.imported}`);
  console.log(`  Skipped (duplicates): ${importResult.skipped}`);
  console.log(`  Errors: ${importResult.errors.length}`);
  console.log('════════════════════════════════════════════════════════════\n');

  if (importResult.errors.length > 0) {
    console.log('Errors:');
    importResult.errors.slice(0, 10).forEach((e) => console.log(`  - ${e}`));
    if (importResult.errors.length > 10) {
      console.log(`  ... and ${importResult.errors.length - 10} more`);
    }
  }
}

main().catch(console.error);

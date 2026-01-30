/**
 * Utah Business Scraper - Run Script
 *
 * Runs the Utah business scraper to find companies 20-30 years old
 */

import { UtahBusinessScraper } from '../src/services/utah-business-scraper';

const args = process.argv.slice(2);
const mode = args[0] || 'test';
const maxPrefixes = parseInt(args[1] || '10');

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          Utah Business Registry Scraper                    ║');
  console.log('║          Finding companies 20-30 years old                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const scraper = new UtahBusinessScraper(20, 30);

  if (mode === 'test') {
    console.log('Running TEST search (prefix: "UTA")...\n');

    const businesses = await scraper.testSearch();

    console.log(`\n════════════════════════════════════════════════════════════`);
    console.log(`RESULTS: Found ${businesses.length} businesses in target range`);
    console.log(`════════════════════════════════════════════════════════════\n`);

    if (businesses.length > 0) {
      console.log('Sample results:\n');
      businesses.slice(0, 10).forEach((biz, i) => {
        console.log(`${i + 1}. ${biz.name}`);
        console.log(`   Entity #: ${biz.entityNumber}`);
        console.log(`   File Date: ${biz.fileDate} (${biz.fileYear})`);
        console.log(`   Type: ${biz.entityType}`);
        console.log(`   Status: ${biz.status}`);
        console.log('');
      });
    }

  } else if (mode === 'scrape') {
    console.log(`Running FULL scrape (max ${maxPrefixes} prefixes)...\n`);

    const result = await scraper.scrape(maxPrefixes);

    console.log(`\n════════════════════════════════════════════════════════════`);
    console.log(`RESULTS:`);
    console.log(`  Success: ${result.success}`);
    console.log(`  Businesses found: ${result.businesses.length}`);
    console.log(`  Errors: ${result.errors.length}`);
    console.log(`════════════════════════════════════════════════════════════\n`);

    if (result.errors.length > 0) {
      console.log('Errors:');
      result.errors.forEach(e => console.log(`  - ${e}`));
    }

    if (result.businesses.length > 0) {
      // Show breakdown by year
      const byYear: Record<number, number> = {};
      result.businesses.forEach(b => {
        byYear[b.fileYear] = (byYear[b.fileYear] || 0) + 1;
      });

      console.log('\nBreakdown by year:');
      Object.keys(byYear).sort().forEach(year => {
        console.log(`  ${year}: ${byYear[parseInt(year)]} businesses`);
      });

      // Show breakdown by type
      const byType: Record<string, number> = {};
      result.businesses.forEach(b => {
        byType[b.entityType] = (byType[b.entityType] || 0) + 1;
      });

      console.log('\nBreakdown by entity type:');
      Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });

      // Show sample businesses
      console.log('\nSample businesses (first 20):');
      result.businesses.slice(0, 20).forEach((biz, i) => {
        console.log(`${i + 1}. ${biz.name} (${biz.fileYear}) - ${biz.entityType}`);
      });
    }

  } else {
    console.log('Usage:');
    console.log('  bun run scripts/utah-scrape.ts test           # Quick test search');
    console.log('  bun run scripts/utah-scrape.ts scrape [N]     # Full scrape with N prefixes');
  }
}

main().catch(console.error);

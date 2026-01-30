/**
 * Utah Business Search - Exploration Script
 *
 * Opens the Utah business search in a visible browser to explore the interface
 * and understand its structure before scraping.
 */

import { chromium } from 'playwright';

const URLS_TO_TRY = [
  'https://businessregistration.utah.gov/EntitySearch/OnlineEntitySearch',
  'https://secure.utah.gov/bes/index.html',
  'https://entityregistry.utah.gov/s/search-entity',
  'https://corporations.utah.gov/searches/',
];

async function explore() {
  console.log('Opening Utah business search for exploration...\n');
  console.log('Target: Companies 20-30 years old (formed 1996-2006)\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500, // Slow down actions for visibility
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  });

  const page = await context.newPage();

  // Try each URL
  for (const url of URLS_TO_TRY) {
    console.log(`\nTrying: ${url}`);
    try {
      await page.goto(url, { timeout: 15000 });
      await page.waitForTimeout(3000);

      const title = await page.title();
      console.log(`  Title: ${title}`);
      console.log(`  Final URL: ${page.url()}`);

      // Take screenshot
      const screenshotPath = `/tmp/utah-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`  Screenshot: ${screenshotPath}`);

    } catch (e) {
      console.log(`  Failed: ${e}`);
    }
  }

  console.log('\n\nBrowser is open. Explore manually to understand the interface.');
  console.log('Look for:');
  console.log('  - Search input fields');
  console.log('  - Advanced search options');
  console.log('  - Date filter fields');
  console.log('  - Results table structure');
  console.log('  - Pagination controls');
  console.log('\nPress Ctrl+C to close.\n');

  // Keep browser open
  await new Promise(() => {});
}

explore().catch(console.error);

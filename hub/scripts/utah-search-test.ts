/**
 * Utah Business Registration - Public Search with Results
 *
 * Search requires at least 3 characters
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(process.env.HOME || '/tmp', '.jd-agent', 'utah-business');

async function testSearch() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('Testing Utah Public Business Entity Search...\n');

  const browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  });

  const page = await context.newPage();

  try {
    // Start at main page and click public search link
    console.log('1. Loading main page...');
    await page.goto('https://businessregistration.utah.gov/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await page.waitForTimeout(3000);

    // Click public search link
    console.log('2. Clicking Search Business Entity Records...');
    await page.locator('a:has-text("Search Business Entity Records")').click();
    await page.waitForTimeout(5000);

    console.log(`   URL: ${page.url()}`);

    // Search for "AAA" (3+ chars required)
    console.log('\n3. Searching for "AAA" (starts with)...');
    await page.locator('#BusinessSearch_Index_txtEntityName').fill('AAA');

    // Click search button
    await page.locator('#btnSearch').click();
    await page.waitForTimeout(3000);

    await page.screenshot({ path: join(OUTPUT_DIR, '01-after-search.png'), fullPage: true });

    // Handle Partial/Full dialog if it appears
    console.log('\n4. Checking for results dialog...');
    const partialBtn = page.locator('button:has-text("Partial")');
    if (await partialBtn.count() > 0 && await partialBtn.isVisible()) {
      console.log('   Found dialog, clicking Partial...');
      await partialBtn.click();
      await page.waitForTimeout(5000);
    }

    await page.screenshot({ path: join(OUTPUT_DIR, '02-results.png'), fullPage: true });

    // Analyze results
    console.log('\n5. Analyzing results...');
    const resultsText = await page.locator('body').innerText();
    writeFileSync(join(OUTPUT_DIR, 'results.txt'), resultsText);

    // Check for table
    const tables = await page.locator('table').count();
    console.log(`   Tables: ${tables}`);

    // Get headers
    const headers = await page.locator('th').allTextContents();
    if (headers.length > 0) {
      console.log(`   Headers: ${headers.map(h => h.trim()).filter(h => h).join(' | ')}`);
    }

    // Look for dates
    const dates = resultsText.match(/\d{1,2}\/\d{1,2}\/\d{4}/g) || [];
    console.log(`   Dates found: ${dates.length}`);

    if (dates.length > 0) {
      const years = dates.map(d => parseInt(d.split('/')[2]));
      const uniqueYears = [...new Set(years)].sort();
      console.log(`   Years: ${uniqueYears.join(', ')}`);

      // Check for target range
      const targetCount = dates.filter(d => {
        const year = parseInt(d.split('/')[2]);
        return year >= 1996 && year <= 2006;
      }).length;
      console.log(`   In 1996-2006 range: ${targetCount}`);
    }

    // Get first few rows
    const rows = await page.locator('tbody tr').all();
    console.log(`   Rows: ${rows.length}`);

    if (rows.length > 0) {
      console.log('\n   First 10 results:');
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const cells = await rows[i].locator('td').allTextContents();
        const cellStr = cells.map(c => c.trim().substring(0, 25)).join(' | ');
        console.log(`   ${i+1}. ${cellStr}`);
      }
    }

    // Click first result to see detail page
    console.log('\n6. Checking entity detail...');
    const firstLink = page.locator('tbody tr:first-child a').first();
    if (await firstLink.count() > 0) {
      await firstLink.click();
      await page.waitForTimeout(5000);
      await page.screenshot({ path: join(OUTPUT_DIR, '03-detail.png'), fullPage: true });

      const detailText = await page.locator('body').innerText();
      writeFileSync(join(OUTPUT_DIR, 'detail.txt'), detailText);

      // Look for registration/formation dates
      const detailDates = detailText.match(/\d{1,2}\/\d{1,2}\/\d{4}/g) || [];
      console.log(`   Detail dates: ${detailDates.join(', ') || 'none'}`);

      // Check for specific field labels
      if (detailText.includes('Formation') || detailText.includes('Registration Date') ||
          detailText.includes('File Date') || detailText.includes('Incorporated')) {
        console.log('   ✓ Found formation/registration date field!');
      }
    }

    console.log('\n--- Done ---');
    console.log(`Output: ${OUTPUT_DIR}`);

  } catch (e) {
    console.error('Error:', e);
    await page.screenshot({ path: join(OUTPUT_DIR, 'error.png'), fullPage: true });
  } finally {
    await browser.close();
  }
}

testSearch().catch(console.error);

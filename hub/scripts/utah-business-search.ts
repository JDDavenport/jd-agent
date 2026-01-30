/**
 * Utah Business Registry Scraper
 *
 * Attempts to access the Utah Division of Corporations business search
 * to find commercial businesses by formation date.
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const OUTPUT_DIR = join(process.env.HOME || '/tmp', '.jd-agent', 'utah-business');

// Different URLs to try
const URLS = {
  corporations: 'https://corporations.utah.gov/searches/',
  businessSearch: 'https://businessregistration.utah.gov/',
  listBuilder: 'https://secure.utah.gov/bes/action/index',
};

async function exploreBusiness() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('Exploring Utah commercial business search options...\n');

  const browser = await chromium.launch({
    headless: false, // Keep visible for debugging
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  });

  const page = await context.newPage();

  try {
    // Try corporations.utah.gov first
    console.log('1. Checking corporations.utah.gov...');
    await page.goto(URLS.corporations, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: join(OUTPUT_DIR, 'corporations-page.png'), fullPage: true });
    console.log(`   Current URL: ${page.url()}`);

    // Look for search links
    const searchLinks = await page.locator('a').all();
    console.log(`   Found ${searchLinks.length} links`);

    for (const link of searchLinks) {
      const text = await link.textContent();
      const href = await link.getAttribute('href');
      if (text?.toLowerCase().includes('search') || text?.toLowerCase().includes('entity') || text?.toLowerCase().includes('business')) {
        console.log(`   - ${text?.trim()}: ${href}`);
      }
    }

    // Look for "Business Entity Search" link and click it
    const businessEntityLink = page.locator('a:has-text("Business Entity Search"), a:has-text("Entity Search")').first();
    if (await businessEntityLink.count() > 0) {
      console.log('\n2. Clicking Business Entity Search...');
      await businessEntityLink.click();
      await page.waitForTimeout(5000);
      await page.screenshot({ path: join(OUTPUT_DIR, 'business-entity-search.png'), fullPage: true });
      console.log(`   Current URL: ${page.url()}`);

      // Save text content
      const bodyText = await page.locator('body').innerText();
      writeFileSync(join(OUTPUT_DIR, 'business-entity-page.txt'), bodyText);
    }

    // Check if we can search without login
    console.log('\n3. Looking for public search options...');

    // Check for search form
    const searchInputs = await page.locator('input:visible').count();
    const searchButtons = await page.locator('button:has-text("Search"):visible').count();
    console.log(`   Visible inputs: ${searchInputs}`);
    console.log(`   Search buttons: ${searchButtons}`);

    // Check if there's a login requirement
    const loginText = await page.locator('body').innerText();
    if (loginText.toLowerCase().includes('login') || loginText.toLowerCase().includes('sign in')) {
      console.log('   ⚠️  Login may be required');
    }

    // Now try the direct list builder URL
    console.log('\n4. Trying List Builder...');
    await page.goto(URLS.listBuilder, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: join(OUTPUT_DIR, 'list-builder.png'), fullPage: true });
    console.log(`   Current URL: ${page.url()}`);

    // Check what's on this page
    const listBuilderText = await page.locator('body').innerText();
    writeFileSync(join(OUTPUT_DIR, 'list-builder-text.txt'), listBuilderText);

    // Look for date filters
    if (listBuilderText.toLowerCase().includes('date') || listBuilderText.toLowerCase().includes('formation')) {
      console.log('   ✓ Date-related options found');
    }

    console.log('\n--- Exploration complete ---');
    console.log(`Output saved to: ${OUTPUT_DIR}`);
    console.log('\nBrowser left open. Press Ctrl+C to close.');

    // Keep browser open for manual exploration
    await new Promise(() => {});

  } catch (e) {
    console.error('Error:', e);
    await page.screenshot({ path: join(OUTPUT_DIR, 'error.png'), fullPage: true });
    await browser.close();
  }
}

exploreBusiness().catch(console.error);

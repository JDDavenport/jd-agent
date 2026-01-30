/**
 * Utah Business Data Request Page Scraper
 *
 * The secure.utah.gov/datarequest/businesses page allows downloading
 * business lists with various filters.
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const DATA_REQUEST_URL = 'https://secure.utah.gov/datarequest/businesses/index.html';
const OUTPUT_DIR = join(process.env.HOME || '/tmp', '.jd-agent', 'utah-business');

async function exploreDataRequest() {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('Exploring Utah Data Request page...\n');

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  });

  const page = await context.newPage();

  try {
    console.log('Loading data request page...');
    await page.goto(DATA_REQUEST_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: join(OUTPUT_DIR, 'data-request-page.png'), fullPage: true });
    console.log('Screenshot saved');

    // Get page content
    const bodyText = await page.locator('body').innerText();
    writeFileSync(join(OUTPUT_DIR, 'data-request-text.txt'), bodyText);

    const html = await page.content();
    writeFileSync(join(OUTPUT_DIR, 'data-request.html'), html);

    console.log('\n--- Page Analysis ---');
    console.log(`URL: ${page.url()}`);

    // Look for form elements
    const checkboxes = await page.locator('input[type="checkbox"]').count();
    const radios = await page.locator('input[type="radio"]').count();
    const selects = await page.locator('select').count();
    const textInputs = await page.locator('input[type="text"]').count();

    console.log(`Checkboxes: ${checkboxes}`);
    console.log(`Radio buttons: ${radios}`);
    console.log(`Select dropdowns: ${selects}`);
    console.log(`Text inputs: ${textInputs}`);

    // Look for entity types
    console.log('\n--- Entity Types Available ---');
    const labels = await page.locator('label').allTextContents();
    const entityTypes = labels.filter(l =>
      l.includes('Corporation') ||
      l.includes('LLC') ||
      l.includes('Partnership') ||
      l.includes('Company')
    );
    entityTypes.slice(0, 15).forEach(t => console.log(`  - ${t.trim()}`));

    // Check for date options
    console.log('\n--- Date/Time Options ---');
    const dateOptions = labels.filter(l =>
      l.toLowerCase().includes('month') ||
      l.toLowerCase().includes('year') ||
      l.toLowerCase().includes('recent') ||
      l.toLowerCase().includes('new')
    );
    dateOptions.forEach(t => console.log(`  - ${t.trim()}`));

    // Check for status options
    console.log('\n--- Status Options ---');
    const statusOptions = labels.filter(l =>
      l.toLowerCase().includes('active') ||
      l.toLowerCase().includes('expired') ||
      l.toLowerCase().includes('inactive')
    );
    statusOptions.forEach(t => console.log(`  - ${t.trim()}`));

    // Check if there's a submit/download button
    const buttons = await page.locator('button, input[type="submit"]').allTextContents();
    console.log('\n--- Buttons ---');
    buttons.forEach(b => console.log(`  - ${b.trim()}`));

    console.log('\n--- Done ---');

  } catch (e) {
    console.error('Error:', e);
    await page.screenshot({ path: join(OUTPUT_DIR, 'error.png'), fullPage: true });
  } finally {
    await browser.close();
  }
}

exploreDataRequest().catch(console.error);

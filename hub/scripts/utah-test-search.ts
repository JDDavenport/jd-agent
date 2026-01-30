/**
 * Utah Business Search - Test Search Script
 *
 * Performs a test search to understand the results structure
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const SEARCH_URL = 'https://entityregistry.utah.gov/s/search-entity';
const OUTPUT_DIR = join(process.env.HOME || '/tmp', '.jd-agent', 'utah-business');

async function testSearch() {
  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('Starting Utah Business Search test...\n');
  console.log('Target: Companies 20-30 years old (formed 1996-2006)\n');

  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  });

  const page = await context.newPage();

  try {
    console.log('Navigating to search page...');
    await page.goto(SEARCH_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(5000);

    await page.screenshot({ path: join(OUTPUT_DIR, '01-search-page.png'), fullPage: true });
    console.log('Screenshot: 01-search-page.png');

    // Wait for "Lookup criteria" or form to appear
    console.log('Waiting for form to load...');
    await page.waitForSelector('text=Lookup criteria', { timeout: 10000 });
    console.log('Form loaded');

    // Get all visible inputs
    const visibleInputs = await page.locator('input:visible').all();
    console.log(`Visible inputs found: ${visibleInputs.length}`);

    // Log info about each input
    for (let i = 0; i < visibleInputs.length; i++) {
      const input = visibleInputs[i];
      const placeholder = await input.getAttribute('placeholder') || 'none';
      const name = await input.getAttribute('name') || 'none';
      const id = await input.getAttribute('id') || 'none';
      console.log(`  Input ${i + 1}: placeholder="${placeholder}" name="${name}" id="${id}"`);
    }

    // Find Entity Name input - first visible text input that's not the global search
    // The Entity Name field should be in the form area
    let entityNameInput = null;

    // Look for input near "Entity Name" label
    const entityNameLabel = page.locator('text=Entity Name');
    if (await entityNameLabel.count() > 0) {
      // Find the nearest input to this label
      // In Lightning, the input might be in a sibling or parent container
      const formContainer = page.locator('.slds-form, [class*="form"]').first();
      if (await formContainer.count() > 0) {
        entityNameInput = formContainer.locator('input:visible').first();
      }
    }

    if (!entityNameInput || await entityNameInput.count() === 0) {
      // Fallback: use the first visible input that's not a search box
      const allInputs = await page.locator('input:visible').all();
      for (const inp of allInputs) {
        const placeholder = await inp.getAttribute('placeholder');
        if (placeholder && !placeholder.toLowerCase().includes('search')) {
          entityNameInput = inp;
          break;
        }
      }
    }

    if (!entityNameInput || await entityNameInput.count() === 0) {
      // Last resort: just use the first visible text input
      entityNameInput = page.locator('input[type="text"]:visible').first();
    }

    console.log('Attempting to fill Entity Name field...');
    await entityNameInput?.fill('A');
    console.log('Filled form');

    await page.screenshot({ path: join(OUTPUT_DIR, '02-filled-form.png'), fullPage: true });

    // Click Search
    const searchButton = page.locator('button:has-text("Search")');
    await searchButton.click();
    console.log('Clicked Search');

    // Wait for results
    console.log('Waiting for results (10 seconds)...');
    await page.waitForTimeout(10000);

    await page.screenshot({ path: join(OUTPUT_DIR, '03-search-results.png'), fullPage: true });
    console.log('Screenshot: 03-search-results.png');

    // Save HTML for analysis
    const html = await page.content();
    writeFileSync(join(OUTPUT_DIR, 'results-page.html'), html);

    // Get all text
    const bodyText = await page.locator('body').innerText();
    writeFileSync(join(OUTPUT_DIR, 'visible-text.txt'), bodyText);

    console.log('\n--- Page Analysis ---');

    // Check for tables
    const tables = await page.locator('table').count();
    console.log(`Tables: ${tables}`);

    const tableRows = await page.locator('tr').count();
    console.log(`Table rows: ${tableRows}`);

    // Look for dates
    const dateMatches = bodyText.match(/\d{1,2}\/\d{1,2}\/\d{4}/g) || [];
    console.log(`Dates found: ${dateMatches.length}`);
    if (dateMatches.length > 0) {
      console.log(`Samples: ${dateMatches.slice(0, 5).join(', ')}`);
    }

    // Check for no results
    if (bodyText.toLowerCase().includes('no results') || bodyText.toLowerCase().includes('no record')) {
      console.log('⚠️  No results found');
    }

    // Extract table data if present
    if (tableRows > 1) {
      console.log('\n--- Table Data ---');
      const rows = await page.locator('tbody tr').all();
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const cells = await rows[i].locator('td, th').allTextContents();
        console.log(`Row ${i + 1}: ${cells.join(' | ')}`);
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

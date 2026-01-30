/**
 * Plaud Click File - Navigate to file by clicking and capture download
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const STORAGE_PATH = '/Users/jddavenport/Documents/PlaudSync/.plaud-auth.json';
const SYNC_PATH = '/Users/jddavenport/Documents/PlaudSync';

async function main() {
  console.log('=== Plaud Click File ===\n');

  if (!existsSync(SYNC_PATH)) {
    mkdirSync(SYNC_PATH, { recursive: true });
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: STORAGE_PATH,
    acceptDownloads: true, // Enable downloads
  });

  const page = await context.newPage();

  // Track all API calls to find file content endpoints
  page.on('response', async (response) => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';

    // Log any file-related API calls
    if (url.includes('api.plaud.ai/file') && !url.includes('simple')) {
      console.log(`[API] ${response.status()} ${url.slice(0, 100)}`);
      if (response.status() === 200 && contentType.includes('json')) {
        try {
          const data = await response.json();
          const preview = JSON.stringify(data).slice(0, 300);
          console.log(`  ${preview}`);
        } catch (e) {}
      }
    }

    // Log audio responses
    if (contentType.includes('audio') || url.includes('.ogg') || url.includes('.mp3')) {
      console.log(`[AUDIO] ${url.slice(0, 150)}`);
    }

    // Log S3 URLs
    if (url.includes('s3.') || url.includes('amazonaws.com')) {
      console.log(`[S3] ${url.slice(0, 200)}`);
    }
  });

  // Navigate to home
  console.log('Navigating to Plaud...');
  await page.goto('https://web.plaud.ai/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Close the Plaud Desktop modal
  console.log('Closing popups...');
  try {
    // Look for the "Never show this" checkbox first
    const neverShow = page.locator('text="Never show this"');
    if (await neverShow.isVisible({ timeout: 2000 })) {
      await neverShow.click();
      await page.waitForTimeout(500);
    }
  } catch (e) {}

  // Click close button on modal
  try {
    const closeBtn = page.locator('.modal-overlay button, [class*="close-btn"], [aria-label="Close"]').first();
    if (await closeBtn.isVisible({ timeout: 1000 })) {
      await closeBtn.click();
      await page.waitForTimeout(1000);
    }
  } catch (e) {}

  // Force remove modal
  await page.evaluate(() => {
    document.querySelectorAll('.modal-overlay, [class*="modal-content"]').forEach(el => {
      (el as HTMLElement).remove();
    });
  });

  await page.waitForTimeout(1000);
  console.log('Popups closed\n');

  // Take screenshot of current state
  await page.screenshot({ path: '/tmp/plaud-home.png', fullPage: true });
  console.log('Home screenshot saved to /tmp/plaud-home.png');

  // Find and click the first file in the list
  console.log('\nLooking for file list items...');

  // Find file list items
  const fileItems = await page.locator('[class*="file-list-item"], [class*="recording-item"], [class*="item-content"]').all();
  console.log(`Found ${fileItems.length} file items`);

  if (fileItems.length > 0) {
    // Click the first file
    console.log('Clicking first file...');
    await fileItems[0].click({ timeout: 10000 });
    await page.waitForTimeout(5000);

    console.log(`Current URL: ${page.url()}`);

    // Take screenshot
    await page.screenshot({ path: '/tmp/plaud-file-clicked.png', fullPage: true });
    console.log('File detail screenshot saved to /tmp/plaud-file-clicked.png');

    // Look for download/export button
    console.log('\nLooking for export/download options...');

    // First look for a "more" menu
    const moreBtn = page.locator('[class*="more-btn"], [class*="icon-more"], [aria-label*="more"]').first();
    if (await moreBtn.isVisible({ timeout: 2000 })) {
      console.log('Found more button, clicking...');
      await moreBtn.click();
      await page.waitForTimeout(1000);
    }

    // Look for export/download option
    const exportBtn = page.locator('text="Export"').first();
    if (await exportBtn.isVisible({ timeout: 2000 })) {
      console.log('Found Export button!');

      // Set up download handler
      const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
      await exportBtn.click();

      console.log('Clicked Export, waiting for download...');
      const download = await downloadPromise;

      const filename = download.suggestedFilename();
      const savePath = join(SYNC_PATH, filename);
      await download.saveAs(savePath);

      console.log(`Downloaded: ${savePath}`);
    } else {
      console.log('No Export button found, checking for audio element...');

      // Check for audio element
      const audioSrc = await page.evaluate(() => {
        const audio = document.querySelector('audio');
        return audio?.src || audio?.currentSrc || null;
      });

      if (audioSrc) {
        console.log(`Audio source: ${audioSrc}`);
      }
    }
  } else {
    // Try clicking on "View all" link
    console.log('No file items found, trying "View all" link...');
    const viewAll = page.locator('text="View all"');
    if (await viewAll.isVisible({ timeout: 2000 })) {
      await viewAll.click();
      await page.waitForTimeout(3000);
      console.log(`Navigated to: ${page.url()}`);
    }
  }

  // Check localStorage for file info
  console.log('\n=== Checking localStorage ===');
  const fileInfo = await page.evaluate(() => {
    const items: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('file') || key.includes('audio') || key.includes('url'))) {
        items[key] = (localStorage.getItem(key) || '').slice(0, 200);
      }
    }
    return items;
  });

  for (const [key, value] of Object.entries(fileInfo)) {
    if (value.includes('http') || value.includes('s3')) {
      console.log(`${key}: ${value}`);
    }
  }

  // Keep open briefly
  console.log('\nWaiting for manual inspection...');
  await page.waitForTimeout(10000);

  await browser.close();
}

main().catch(console.error);

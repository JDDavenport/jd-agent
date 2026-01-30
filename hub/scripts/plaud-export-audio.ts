/**
 * Plaud Export Audio - Click Export audio to download
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

const STORAGE_PATH = '/Users/jddavenport/Documents/PlaudSync/.plaud-auth.json';
const SYNC_PATH = '/Users/jddavenport/Documents/PlaudSync';

async function main() {
  console.log('=== Plaud Export Audio ===\n');

  if (!existsSync(SYNC_PATH)) {
    mkdirSync(SYNC_PATH, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: false,
    downloadsPath: SYNC_PATH,
  });

  const context = await browser.newContext({
    storageState: STORAGE_PATH,
    acceptDownloads: true,
  });

  const page = await context.newPage();

  // Navigate to home
  console.log('Navigating to Plaud...');
  await page.goto('https://web.plaud.ai/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Close modals
  await page.evaluate(() => {
    document.querySelectorAll('.modal-overlay, [class*="modal-content"]').forEach(el => {
      (el as HTMLElement).remove();
    });
  });
  await page.waitForTimeout(1000);

  // Get file list first
  const token = await page.evaluate(() => localStorage.getItem('tokenstr'));

  const files = await page.evaluate(async (authToken) => {
    const response = await fetch('https://api.plaud.ai/file/simple/web?skip=0&limit=10&is_trash=2&sort_by=start_time&is_desc=true', {
      headers: { 'Authorization': authToken || '' }
    });
    const data = await response.json();
    return data.data_file_list || [];
  }, token);

  console.log(`Found ${files.length} files\n`);

  // Process each file
  for (const file of files.slice(0, 2)) { // Process first 2 for testing
    console.log(`\n=== ${file.filename} ===`);

    // Click on the file
    console.log('Clicking on file...');
    const fileItem = page.locator(`text="${file.filename}"`).first();
    if (await fileItem.isVisible({ timeout: 3000 })) {
      await fileItem.click();
    } else {
      // Navigate directly
      await page.goto(`https://web.plaud.ai/file/${file.id}`);
    }

    await page.waitForTimeout(3000);
    console.log(`URL: ${page.url()}`);

    // Look for "Export audio" text
    console.log('Looking for Export audio option...');

    const exportAudio = page.locator('text="Export audio"').first();
    if (await exportAudio.isVisible({ timeout: 3000 })) {
      console.log('Found "Export audio", clicking...');

      // Set up download handler
      const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

      await exportAudio.click();
      console.log('Clicked! Waiting for download...');

      try {
        const download = await downloadPromise;
        const filename = download.suggestedFilename();
        const savePath = join(SYNC_PATH, filename);
        await download.saveAs(savePath);
        console.log(`Downloaded: ${savePath}`);
      } catch (e) {
        console.log('No immediate download, checking for dialog...');
        await page.screenshot({ path: '/tmp/plaud-export-clicked.png' });

        // May need to select format or confirm
        await page.waitForTimeout(2000);

        // Look for any confirm/download buttons
        const confirmBtn = page.locator('button:has-text("Download"), button:has-text("Export"), button:has-text("Confirm")').first();
        if (await confirmBtn.isVisible({ timeout: 2000 })) {
          console.log('Found confirm button, clicking...');
          const downloadPromise2 = page.waitForEvent('download', { timeout: 60000 });
          await confirmBtn.click();
          const download = await downloadPromise2;
          const filename = download.suggestedFilename();
          const savePath = join(SYNC_PATH, filename);
          await download.saveAs(savePath);
          console.log(`Downloaded: ${savePath}`);
        }
      }
    } else {
      console.log('Export audio not visible, trying to find more menu...');

      // Look for a more/menu icon to open options
      const moreBtn = page.locator('[class*="more"], [class*="icon_more"], svg:has(circle)').first();
      if (await moreBtn.isVisible({ timeout: 2000 })) {
        console.log('Found more button, clicking...');
        await moreBtn.click();
        await page.waitForTimeout(1000);

        // Now try Export audio
        const exportAudio2 = page.locator('text="Export audio"').first();
        if (await exportAudio2.isVisible({ timeout: 2000 })) {
          console.log('Found Export audio in dropdown, clicking...');
          const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
          await exportAudio2.click();

          try {
            const download = await downloadPromise;
            const filename = download.suggestedFilename();
            const savePath = join(SYNC_PATH, filename);
            await download.saveAs(savePath);
            console.log(`Downloaded: ${savePath}`);
          } catch (e) {
            console.log('Download failed or dialog appeared');
            await page.screenshot({ path: '/tmp/plaud-export-menu.png' });
          }
        }
      }
    }

    // Go back to home for next file
    await page.goto('https://web.plaud.ai/');
    await page.waitForTimeout(2000);
  }

  // Wait a bit
  await page.waitForTimeout(5000);

  // List files in sync folder
  console.log('\n\nFiles in sync folder:');
  const syncFiles = readdirSync(SYNC_PATH);
  syncFiles.forEach(f => console.log(`  ${f}`));

  await browser.close();
}

main().catch(console.error);

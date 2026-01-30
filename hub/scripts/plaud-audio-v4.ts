/**
 * Plaud Download Audio v4 - Click Export audio directly
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const STORAGE_PATH = '/Users/jddavenport/Documents/PlaudSync/.plaud-auth.json';
const SYNC_PATH = '/Users/jddavenport/Documents/PlaudSync';

async function main() {
  console.log('=== Plaud Audio Download v4 ===\n');

  const browser = await chromium.launch({
    headless: false,
    downloadsPath: SYNC_PATH,
  });

  const context = await browser.newContext({
    storageState: STORAGE_PATH,
    acceptDownloads: true,
  });

  const page = await context.newPage();

  // Close modal
  const closeModal = async () => {
    await page.evaluate(() => {
      document.querySelectorAll('.modal-overlay').forEach(el => (el as HTMLElement).remove());
    });
  };

  await page.goto('https://web.plaud.ai/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await closeModal();

  const token = await page.evaluate(() => localStorage.getItem('tokenstr'));

  const files = await page.evaluate(async (authToken) => {
    const resp = await fetch('https://api.plaud.ai/file/simple/web?skip=0&limit=10&is_trash=2&sort_by=start_time&is_desc=true', {
      headers: { 'Authorization': authToken || '' }
    });
    return (await resp.json()).data_file_list || [];
  }, token);

  const file = files[0];
  console.log(`Target: ${file.filename}`);
  console.log(`Size: ${Math.round(file.filesize / 1024 / 1024 * 10) / 10} MB\n`);

  // Navigate to file
  await page.goto(`https://web.plaud.ai/file/${file.id}`);
  await page.waitForTimeout(4000);
  await closeModal();

  // Use Playwright's text locator to find and click Export audio
  console.log('Looking for "Export audio" text...');

  try {
    // Try to click on text "Export audio"
    const exportBtn = page.locator('text="Export audio"').first();

    // Check if it exists
    const count = await exportBtn.count();
    console.log(`Found ${count} "Export audio" elements`);

    if (count > 0) {
      // Get bounding box
      const box = await exportBtn.boundingBox();
      console.log('Bounding box:', box);

      if (box) {
        console.log('Clicking Export audio...');

        // Set up download handler BEFORE clicking
        const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

        await exportBtn.click({ force: true });
        console.log('Clicked!');

        try {
          const download = await downloadPromise;
          const filename = download.suggestedFilename();
          console.log(`Download started: ${filename}`);

          // Create directory
          const date = new Date(file.start_time).toISOString().split('T')[0];
          const safeName = file.filename.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
          const dirPath = join(SYNC_PATH, `${date}_${safeName}_${file.id.slice(0, 8)}`);

          if (!existsSync(dirPath)) {
            mkdirSync(dirPath, { recursive: true });
          }

          const savePath = join(dirPath, filename);
          await download.saveAs(savePath);
          console.log(`\n*** DOWNLOADED: ${savePath} ***`);
        } catch (e) {
          console.log('Waiting for download timed out, checking page state...');
          await page.screenshot({ path: '/tmp/plaud-export-after-click.png' });

          // Maybe a confirmation dialog appeared
          await page.waitForTimeout(2000);

          // Look for any download/confirm button
          const btns = await page.locator('button').all();
          for (const btn of btns) {
            const text = await btn.textContent();
            if (text?.toLowerCase().includes('download') || text?.toLowerCase().includes('confirm')) {
              console.log(`Found button: ${text}, clicking...`);
              const dl = page.waitForEvent('download', { timeout: 30000 });
              await btn.click();
              try {
                const download = await dl;
                console.log(`Downloaded: ${download.suggestedFilename()}`);
              } catch {
                console.log('No download after button click');
              }
              break;
            }
          }
        }
      }
    } else {
      console.log('Export audio not found, taking screenshot...');
      await page.screenshot({ path: '/tmp/plaud-no-export-v4.png', fullPage: true });
    }
  } catch (e) {
    console.log('Error:', e);
    await page.screenshot({ path: '/tmp/plaud-error.png' });
  }

  await page.waitForTimeout(5000);
  await browser.close();
}

main().catch(console.error);

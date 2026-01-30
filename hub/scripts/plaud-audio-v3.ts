/**
 * Plaud Download Audio v3 - Click the correct more menu icon
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const STORAGE_PATH = '/Users/jddavenport/Documents/PlaudSync/.plaud-auth.json';
const SYNC_PATH = '/Users/jddavenport/Documents/PlaudSync';

async function main() {
  console.log('=== Plaud Audio Download v3 ===\n');

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

  // The more menu button is around x=1103 based on earlier analysis
  // Click at that position directly
  console.log('Clicking more menu icon (x=1103, y=23)...');
  await page.mouse.click(1103, 23);
  await page.waitForTimeout(1000);

  // Check if Export audio is visible
  let exportVisible = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('*')).find(
      e => e.textContent?.trim() === 'Export audio' && e.children.length === 0
    );
    return el ? (el as HTMLElement).offsetParent !== null : false;
  });

  console.log('Export audio visible after first click:', exportVisible);

  if (!exportVisible) {
    // Try clicking a bit to the left (x=1023)
    console.log('Trying x=1035...');
    await page.mouse.click(1035, 23);
    await page.waitForTimeout(1000);

    exportVisible = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('*')).find(
        e => e.textContent?.trim() === 'Export audio' && e.children.length === 0
      );
      return el ? (el as HTMLElement).offsetParent !== null : false;
    });

    console.log('Export audio visible after second click:', exportVisible);
  }

  if (exportVisible) {
    console.log('\n*** Found Export audio! Clicking... ***');

    const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

    await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('*')).find(
        e => e.textContent?.trim() === 'Export audio' && e.children.length === 0
      );
      if (el) (el as HTMLElement).click();
    });

    try {
      const download = await downloadPromise;
      const filename = download.suggestedFilename();

      // Create directory
      const date = new Date(file.start_time).toISOString().split('T')[0];
      const safeName = file.filename.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
      const dirPath = join(SYNC_PATH, `${date}_${safeName}_${file.id.slice(0, 8)}`);

      if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
      }

      const savePath = join(dirPath, filename);
      await download.saveAs(savePath);
      console.log(`\n*** Downloaded: ${savePath} ***`);
    } catch (e) {
      console.log('Download error, checking for dialog...');
      await page.screenshot({ path: '/tmp/plaud-after-export-click.png' });

      // Look for confirm button
      await page.waitForTimeout(1000);
      const confirmClicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b =>
          (b as HTMLElement).offsetParent !== null &&
          (b.textContent?.includes('Download') || b.textContent?.includes('Export'))
        );
        if (btn) {
          btn.click();
          return btn.textContent;
        }
        return null;
      });

      if (confirmClicked) {
        console.log('Clicked:', confirmClicked);
        try {
          const download = await page.waitForEvent('download', { timeout: 30000 });
          console.log(`Downloaded: ${download.suggestedFilename()}`);
        } catch {
          console.log('Still no download');
        }
      }
    }
  } else {
    console.log('Could not find Export audio menu');
    await page.screenshot({ path: '/tmp/plaud-no-export.png' });

    // Print what menus are visible
    const menus = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('*'))
        .filter(e => e.textContent?.includes('Export') && (e as HTMLElement).offsetParent !== null)
        .map(e => ({
          tag: e.tagName,
          text: e.textContent?.slice(0, 50),
          class: (e as HTMLElement).className?.toString().slice(0, 50)
        }))
        .slice(0, 10);
    });
    console.log('Elements containing "Export":', menus);
  }

  await page.waitForTimeout(10000);
  await browser.close();
}

main().catch(console.error);

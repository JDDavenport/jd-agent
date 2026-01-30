/**
 * Plaud Export Audio v2 - Better modal handling
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

const STORAGE_PATH = '/Users/jddavenport/Documents/PlaudSync/.plaud-auth.json';
const SYNC_PATH = '/Users/jddavenport/Documents/PlaudSync';

async function dismissModals(page: any) {
  await page.evaluate(() => {
    // Remove modal overlays
    document.querySelectorAll('.modal-overlay, [class*="modal-overlay"]').forEach(el => {
      (el as HTMLElement).remove();
    });
    // Hide modals
    document.querySelectorAll('[class*="modal"], [class*="dialog"]').forEach(el => {
      (el as HTMLElement).style.display = 'none';
    });
  });
  await page.waitForTimeout(500);
}

async function main() {
  console.log('=== Plaud Export Audio v2 ===\n');

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

  // Get token first via home page
  await page.goto('https://web.plaud.ai/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await dismissModals(page);

  const token = await page.evaluate(() => localStorage.getItem('tokenstr'));

  // Get file list
  const files = await page.evaluate(async (authToken) => {
    const response = await fetch('https://api.plaud.ai/file/simple/web?skip=0&limit=10&is_trash=2&sort_by=start_time&is_desc=true', {
      headers: { 'Authorization': authToken || '' }
    });
    const data = await response.json();
    return data.data_file_list || [];
  }, token);

  console.log(`Found ${files.length} files\n`);

  // Use a transcribed file (Steve Jobs)
  const targetFile = files.find((f: any) => f.is_trans && f.filename.includes('Steve')) || files[0];
  console.log(`Target: ${targetFile.filename}`);
  console.log(`ID: ${targetFile.id}`);
  console.log(`Transcribed: ${targetFile.is_trans}\n`);

  // Navigate directly to file
  console.log('Navigating directly to file...');
  await page.goto(`https://web.plaud.ai/file/${targetFile.id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await dismissModals(page);
  await page.waitForTimeout(1000);

  console.log(`URL: ${page.url()}`);
  await page.screenshot({ path: '/tmp/plaud-file-v2.png', fullPage: true });

  // Try to find Export audio by force clicking with JavaScript
  console.log('\nLooking for Export audio...');

  // First, list all visible text that includes "Export"
  const exportElements = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('*'));
    return elements
      .filter(el => el.textContent?.includes('Export') && el.children.length === 0)
      .map(el => ({
        tag: el.tagName,
        class: el.className,
        text: el.textContent?.trim().slice(0, 50),
        visible: (el as HTMLElement).offsetParent !== null
      }))
      .slice(0, 10);
  });

  console.log('Elements with "Export":', exportElements);

  // Click on Export audio via JavaScript
  const clicked = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll('*'));
    const exportEl = elements.find(el =>
      el.textContent?.trim() === 'Export audio' &&
      el.children.length === 0
    );
    if (exportEl) {
      (exportEl as HTMLElement).click();
      return true;
    }
    return false;
  });

  if (clicked) {
    console.log('Clicked Export audio via JS!');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/plaud-export-clicked-v2.png', fullPage: true });

    // Check for download dialog or format selection
    console.log('\nChecking for dialog...');

    // Look for any new dialogs
    const dialogContent = await page.evaluate(() => {
      const dialogs = document.querySelectorAll('[class*="dialog"], [class*="modal"]:not(.modal-overlay)');
      const texts: string[] = [];
      dialogs.forEach(d => {
        if ((d as HTMLElement).offsetParent !== null) {
          texts.push(d.textContent?.slice(0, 200) || '');
        }
      });
      return texts;
    });

    console.log('Dialog content:', dialogContent);

    // Check if download started
    try {
      const download = await page.waitForEvent('download', { timeout: 10000 });
      const filename = download.suggestedFilename();
      const savePath = join(SYNC_PATH, filename);
      await download.saveAs(savePath);
      console.log(`\nDownloaded: ${savePath}`);
    } catch (e) {
      console.log('No immediate download, checking for options...');

      // Look for audio format selection
      const options = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button, [role="button"]');
        return Array.from(buttons)
          .filter(b => (b as HTMLElement).offsetParent !== null)
          .map(b => ({
            text: b.textContent?.trim().slice(0, 30),
            class: b.className
          }))
          .slice(0, 10);
      });

      console.log('Visible buttons:', options);

      // Try clicking on any download/confirm button
      const downloadBtn = await page.evaluate(() => {
        const buttons = document.querySelectorAll('button, [role="button"]');
        const btn = Array.from(buttons).find(b =>
          b.textContent?.toLowerCase().includes('download') ||
          b.textContent?.toLowerCase().includes('export')
        );
        if (btn) {
          (btn as HTMLElement).click();
          return btn.textContent?.trim();
        }
        return null;
      });

      if (downloadBtn) {
        console.log(`Clicked: ${downloadBtn}`);
        try {
          const download = await page.waitForEvent('download', { timeout: 30000 });
          const filename = download.suggestedFilename();
          const savePath = join(SYNC_PATH, filename);
          await download.saveAs(savePath);
          console.log(`Downloaded: ${savePath}`);
        } catch (e2) {
          console.log('Still no download');
        }
      }
    }
  } else {
    console.log('Could not find Export audio element');

    // Check what elements are visible
    const visibleText = await page.evaluate(() => {
      const elements = document.querySelectorAll('.file-detail-sidebar, [class*="sidebar"], [class*="action"], [class*="menu"]');
      const texts: string[] = [];
      elements.forEach(el => {
        if ((el as HTMLElement).offsetParent !== null) {
          texts.push(el.textContent?.slice(0, 200) || '');
        }
      });
      return texts;
    });

    console.log('Sidebar/action content:', visibleText);
  }

  // Wait a bit
  await page.waitForTimeout(10000);

  // List files
  console.log('\n\nFiles in sync folder:');
  const syncFiles = readdirSync(SYNC_PATH);
  syncFiles.forEach(f => console.log(`  ${f}`));

  await browser.close();
}

main().catch(console.error);

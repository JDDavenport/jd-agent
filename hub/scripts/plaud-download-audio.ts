/**
 * Plaud Download Audio - Export audio files via UI
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

const STORAGE_PATH = '/Users/jddavenport/Documents/PlaudSync/.plaud-auth.json';
const SYNC_PATH = '/Users/jddavenport/Documents/PlaudSync';

async function dismissModals(page: any) {
  await page.evaluate(() => {
    document.querySelectorAll('.modal-overlay, [class*="modal-overlay"]').forEach(el => {
      (el as HTMLElement).remove();
    });
  });
  await page.waitForTimeout(300);
}

async function main() {
  console.log('=== Plaud Audio Download ===\n');

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

  // Get file list first
  await page.goto('https://web.plaud.ai/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await dismissModals(page);

  const token = await page.evaluate(() => localStorage.getItem('tokenstr'));

  const files = await page.evaluate(async (authToken) => {
    const response = await fetch('https://api.plaud.ai/file/simple/web?skip=0&limit=20&is_trash=2&sort_by=start_time&is_desc=true', {
      headers: { 'Authorization': authToken || '' }
    });
    const data = await response.json();
    return data.data_file_list || [];
  }, token);

  console.log(`Found ${files.length} files\n`);

  // Download audio for each file
  for (const file of files) {
    console.log(`\n=== ${file.filename} ===`);
    console.log(`ID: ${file.id}`);
    console.log(`Size: ${Math.round(file.filesize / 1024 / 1024 * 10) / 10} MB`);

    // Check if audio already exists
    const date = new Date(file.start_time).toISOString().split('T')[0];
    const safeName = file.filename.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
    const dirName = `${date}_${safeName}_${file.id.slice(0, 8)}`;
    const dirPath = join(SYNC_PATH, dirName);

    // Check for existing audio file
    if (existsSync(dirPath)) {
      const existingFiles = readdirSync(dirPath);
      const hasAudio = existingFiles.some(f => f.endsWith('.mp3') || f.endsWith('.ogg') || f.endsWith('.m4a'));
      if (hasAudio) {
        console.log('Audio already downloaded, skipping');
        continue;
      }
    }

    // Navigate to file page
    console.log('Opening file...');
    await page.goto(`https://web.plaud.ai/file/${file.id}`);
    await page.waitForTimeout(3000);
    await dismissModals(page);

    // Find and click the more menu (3 dots icon)
    console.log('Looking for menu...');

    // Click on the more icon using the SVG use element
    const menuOpened = await page.evaluate(() => {
      // Find the more icon by looking for the icon_more use element
      const useElements = document.querySelectorAll('use');
      for (const use of useElements) {
        const href = use.getAttribute('href') || use.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
        if (href?.includes('icon_more')) {
          // Click the parent clickable element
          let parent = use.parentElement;
          while (parent && parent.tagName !== 'BODY') {
            if (parent.classList.contains('cursor-pointer') ||
                parent.tagName === 'BUTTON' ||
                parent.getAttribute('role') === 'button') {
              (parent as HTMLElement).click();
              return 'clicked more icon';
            }
            parent = parent.parentElement;
          }
          // Just click the svg parent
          (use.parentElement as HTMLElement)?.click();
          return 'clicked svg';
        }
      }
      return null;
    });

    console.log('Menu result:', menuOpened);
    await page.waitForTimeout(1000);

    // Check if Export audio is now visible and click it
    const exportClicked = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      const exportAudio = elements.find(el =>
        el.textContent?.trim() === 'Export audio' &&
        el.children.length === 0 &&
        (el as HTMLElement).offsetParent !== null
      );
      if (exportAudio) {
        (exportAudio as HTMLElement).click();
        return true;
      }
      return false;
    });

    if (exportClicked) {
      console.log('Clicked Export audio!');

      // Wait for download
      try {
        const download = await page.waitForEvent('download', { timeout: 60000 });
        const filename = download.suggestedFilename();

        // Save to the file's directory
        if (!existsSync(dirPath)) {
          mkdirSync(dirPath, { recursive: true });
        }

        const savePath = join(dirPath, filename);
        await download.saveAs(savePath);
        console.log(`Downloaded: ${savePath}`);
      } catch (e) {
        console.log('Download timeout or error, checking for dialog...');
        await page.screenshot({ path: '/tmp/plaud-export-state.png' });

        // Maybe there's a format selection dialog
        await page.waitForTimeout(2000);

        // Try clicking any visible download/confirm button
        const btnClicked = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const downloadBtn = btns.find(b =>
            (b as HTMLElement).offsetParent !== null &&
            (b.textContent?.toLowerCase().includes('download') ||
             b.textContent?.toLowerCase().includes('export') ||
             b.textContent?.toLowerCase().includes('confirm'))
          );
          if (downloadBtn) {
            downloadBtn.click();
            return downloadBtn.textContent?.trim();
          }
          return null;
        });

        if (btnClicked) {
          console.log(`Clicked: ${btnClicked}`);
          try {
            const download = await page.waitForEvent('download', { timeout: 30000 });
            const filename = download.suggestedFilename();
            if (!existsSync(dirPath)) {
              mkdirSync(dirPath, { recursive: true });
            }
            const savePath = join(dirPath, filename);
            await download.saveAs(savePath);
            console.log(`Downloaded: ${savePath}`);
          } catch (e2) {
            console.log('Still no download');
          }
        }
      }
    } else {
      console.log('Export audio not found/visible');

      // Debug: show what's visible
      const visibleMenuItems = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('[class*="menu"], [class*="dropdown"], [class*="popover"]'))
          .filter(el => (el as HTMLElement).offsetParent !== null)
          .map(el => el.textContent?.slice(0, 100))
          .slice(0, 5);
      });
      console.log('Visible menus:', visibleMenuItems);
    }

    // Small delay between files
    await page.waitForTimeout(1000);
  }

  console.log('\n\n=== Download Complete ===');
  console.log('Files in sync folder:');
  readdirSync(SYNC_PATH)
    .filter(f => f.startsWith('2026'))
    .forEach(dir => {
      const files = readdirSync(join(SYNC_PATH, dir));
      const audioFile = files.find(f => f.endsWith('.mp3') || f.endsWith('.ogg') || f.endsWith('.m4a'));
      console.log(`  ${dir}: ${audioFile || 'no audio'}`);
    });

  await browser.close();
}

main().catch(console.error);

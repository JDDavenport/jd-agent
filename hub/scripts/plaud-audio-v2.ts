/**
 * Plaud Download Audio v2 - Find the correct menu trigger
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const STORAGE_PATH = '/Users/jddavenport/Documents/PlaudSync/.plaud-auth.json';
const SYNC_PATH = '/Users/jddavenport/Documents/PlaudSync';

async function main() {
  console.log('=== Plaud Audio Download v2 ===\n');

  const browser = await chromium.launch({
    headless: false,
    downloadsPath: SYNC_PATH,
  });

  const context = await browser.newContext({
    storageState: STORAGE_PATH,
    acceptDownloads: true,
  });

  const page = await context.newPage();

  // Close modal helper
  const closeModal = async () => {
    await page.evaluate(() => {
      document.querySelectorAll('.modal-overlay').forEach(el => (el as HTMLElement).remove());
    });
  };

  // Navigate to home
  await page.goto('https://web.plaud.ai/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await closeModal();

  const token = await page.evaluate(() => localStorage.getItem('tokenstr'));

  // Get files
  const files = await page.evaluate(async (authToken) => {
    const resp = await fetch('https://api.plaud.ai/file/simple/web?skip=0&limit=10&is_trash=2&sort_by=start_time&is_desc=true', {
      headers: { 'Authorization': authToken || '' }
    });
    return (await resp.json()).data_file_list || [];
  }, token);

  // Use the first file (user's recording)
  const file = files[0];
  console.log(`Target: ${file.filename}`);
  console.log(`ID: ${file.id}\n`);

  // Navigate to file
  await page.goto(`https://web.plaud.ai/file/${file.id}`);
  await page.waitForTimeout(4000);
  await closeModal();

  // Take screenshot to see the page
  await page.screenshot({ path: '/tmp/plaud-file-page.png', fullPage: true });
  console.log('Screenshot saved to /tmp/plaud-file-page.png');

  // Find all clickable elements in the header area
  console.log('\nLooking for menu trigger in header...');

  const headerButtons = await page.evaluate(() => {
    // Look for the file header/toolbar area
    const header = document.querySelector('[class*="header"], [class*="toolbar"], [class*="actions"]');
    const buttons = document.querySelectorAll('button, [role="button"], [class*="cursor-pointer"]');

    return Array.from(buttons)
      .filter(b => (b as HTMLElement).offsetParent !== null)
      .map(b => ({
        tag: b.tagName,
        class: (b as HTMLElement).className?.toString().slice(0, 80),
        text: b.textContent?.trim().slice(0, 30),
        hasSvg: b.querySelector('svg') !== null,
        rect: (b as HTMLElement).getBoundingClientRect()
      }))
      .filter(b => b.rect.top < 200) // Only in top area
      .slice(0, 15);
  });

  console.log('Header buttons:', JSON.stringify(headerButtons, null, 2));

  // Try clicking on elements that look like menu triggers (have svg, near top right)
  const menuClicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('[class*="cursor-pointer"]'));

    for (const btn of buttons) {
      const rect = (btn as HTMLElement).getBoundingClientRect();
      const hasSvg = btn.querySelector('svg') !== null;
      const hasMoreIcon = btn.querySelector('use[href*="more"], use[xlink\\:href*="more"]') !== null;

      // Look for buttons in the top-right area with icons
      if (rect.top < 150 && rect.left > 600 && hasSvg) {
        console.log('Clicking:', rect.left, rect.top);
        (btn as HTMLElement).click();
        return { clicked: true, x: rect.left, y: rect.top };
      }
    }

    return { clicked: false };
  });

  console.log('Menu click result:', menuClicked);
  await page.waitForTimeout(1000);

  // Check for dropdown menu
  const dropdownContent = await page.evaluate(() => {
    const dropdowns = document.querySelectorAll('[class*="dropdown"], [class*="popover"], [class*="menu"]:not([class*="menu-list"])');
    return Array.from(dropdowns)
      .filter(d => (d as HTMLElement).offsetParent !== null)
      .map(d => d.textContent?.slice(0, 200))
      .filter(t => t && t.length > 5);
  });

  console.log('Dropdown content:', dropdownContent);

  // Check if Export audio is visible now
  const exportVisible = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('*')).find(
      e => e.textContent?.trim() === 'Export audio' && e.children.length === 0
    );
    return el ? (el as HTMLElement).offsetParent !== null : false;
  });

  console.log('Export audio visible:', exportVisible);

  if (exportVisible) {
    console.log('\nClicking Export audio...');

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
      const savePath = join(SYNC_PATH, filename);
      await download.saveAs(savePath);
      console.log(`\n*** Downloaded: ${savePath} ***`);
    } catch (e) {
      console.log('Download error:', e);
    }
  } else {
    // Try clicking multiple potential menu buttons
    console.log('\nTrying alternative menu triggers...');

    for (let i = 0; i < 3; i++) {
      const clicked = await page.evaluate((index) => {
        const buttons = Array.from(document.querySelectorAll('[class*="cursor-pointer"]:has(svg)'))
          .filter(b => {
            const rect = (b as HTMLElement).getBoundingClientRect();
            return rect.top < 200 && (b as HTMLElement).offsetParent !== null;
          });

        if (buttons[index]) {
          (buttons[index] as HTMLElement).click();
          return true;
        }
        return false;
      }, i);

      if (clicked) {
        await page.waitForTimeout(500);
        await page.screenshot({ path: `/tmp/plaud-menu-try-${i}.png` });

        const hasExport = await page.evaluate(() => {
          const el = Array.from(document.querySelectorAll('*')).find(
            e => e.textContent?.trim() === 'Export audio' && e.children.length === 0
          );
          return el ? (el as HTMLElement).offsetParent !== null : false;
        });

        if (hasExport) {
          console.log(`Found Export audio after clicking button ${i}!`);
          break;
        }
      }
    }
  }

  // Keep browser open for inspection
  console.log('\nBrowser open for 30 seconds...');
  await page.waitForTimeout(30000);

  await browser.close();
}

main().catch(console.error);

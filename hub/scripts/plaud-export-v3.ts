/**
 * Plaud Export Audio v3 - Open menu first
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
  console.log('=== Plaud Export Audio v3 ===\n');

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

  await page.goto('https://web.plaud.ai/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await dismissModals(page);

  const token = await page.evaluate(() => localStorage.getItem('tokenstr'));

  const files = await page.evaluate(async (authToken) => {
    const response = await fetch('https://api.plaud.ai/file/simple/web?skip=0&limit=10&is_trash=2&sort_by=start_time&is_desc=true', {
      headers: { 'Authorization': authToken || '' }
    });
    const data = await response.json();
    return data.data_file_list || [];
  }, token);

  console.log(`Found ${files.length} files\n`);

  // Use Steve Jobs file
  const targetFile = files.find((f: any) => f.is_trans && f.filename.includes('Steve')) || files[0];
  console.log(`Target: ${targetFile.filename}\n`);

  // Navigate to file
  await page.goto(`https://web.plaud.ai/file/${targetFile.id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await dismissModals(page);
  await page.waitForTimeout(1000);

  console.log(`URL: ${page.url()}\n`);

  // Find the more/menu icon in the header area
  console.log('Looking for menu trigger...');

  // The "more" icon is usually 3 dots or similar
  const menuTriggers = await page.evaluate(() => {
    const icons = document.querySelectorAll('svg, [class*="icon"], [class*="more"]');
    return Array.from(icons)
      .filter(el => (el as HTMLElement).offsetParent !== null)
      .map(el => ({
        tag: el.tagName,
        class: (el as HTMLElement).className,
        parent: (el as HTMLElement).parentElement?.className?.slice(0, 50),
        html: (el as HTMLElement).outerHTML?.slice(0, 100)
      }))
      .slice(0, 20);
  });

  console.log('Visible icons:', menuTriggers.slice(0, 5));

  // Look for the icon_more svg or similar
  const moreIconClicked = await page.evaluate(() => {
    // Look for SVG with icon_more class or use element
    const moreIcon = document.querySelector('use[*|href="#icon-icon_more"], [class*="icon_more"], svg.icon-more');
    if (moreIcon) {
      // Click the parent (usually a button or div)
      let parent = moreIcon.parentElement;
      while (parent && parent.tagName !== 'BUTTON' && !parent.className.includes('btn')) {
        if (parent.className.includes('cursor-pointer') || parent.onclick) {
          break;
        }
        parent = parent.parentElement;
      }
      if (parent) {
        (parent as HTMLElement).click();
        return 'clicked icon_more parent';
      }
      (moreIcon as HTMLElement).click();
      return 'clicked icon_more';
    }

    // Try finding by use href
    const useElements = document.querySelectorAll('use');
    for (const use of useElements) {
      const href = use.getAttribute('href') || use.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
      if (href?.includes('more')) {
        let parent = use.parentElement?.parentElement;
        if (parent) {
          (parent as HTMLElement).click();
          return `clicked use ${href}`;
        }
      }
    }

    // Look for 3-dot pattern or menu buttons
    const buttons = document.querySelectorAll('[class*="cursor-pointer"]:has(svg)');
    for (const btn of buttons) {
      const svg = btn.querySelector('svg');
      if (svg && svg.querySelector('circle, path')) {
        // Might be a dot menu
        const circles = svg.querySelectorAll('circle');
        if (circles.length >= 3) {
          (btn as HTMLElement).click();
          return 'clicked 3-dot menu';
        }
      }
    }

    return null;
  });

  console.log('Menu trigger result:', moreIconClicked);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/plaud-menu-opened.png', fullPage: true });

  // Now check if Export audio is visible
  const exportVisible = await page.evaluate(() => {
    const exportAudio = Array.from(document.querySelectorAll('*'))
      .find(el => el.textContent?.trim() === 'Export audio' && el.children.length === 0);
    if (exportAudio) {
      return (exportAudio as HTMLElement).offsetParent !== null;
    }
    return false;
  });

  console.log('Export audio visible after menu:', exportVisible);

  if (exportVisible) {
    // Click Export audio
    console.log('Clicking Export audio...');

    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

    await page.evaluate(() => {
      const exportAudio = Array.from(document.querySelectorAll('*'))
        .find(el => el.textContent?.trim() === 'Export audio' && el.children.length === 0);
      if (exportAudio) {
        (exportAudio as HTMLElement).click();
      }
    });

    try {
      const download = await downloadPromise;
      const filename = download.suggestedFilename();
      const savePath = join(SYNC_PATH, filename);
      await download.saveAs(savePath);
      console.log(`\n*** Downloaded: ${savePath} ***`);
    } catch (e) {
      console.log('Download not immediate, checking for dialog...');
      await page.waitForTimeout(2000);
      await page.screenshot({ path: '/tmp/plaud-export-dialog.png', fullPage: true });

      // Check for format dialog or confirmation
      const buttons = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('button'))
          .filter(b => (b as HTMLElement).offsetParent !== null)
          .map(b => b.textContent?.trim())
          .filter(t => t);
      });

      console.log('Visible buttons:', buttons);
    }
  } else {
    console.log('Export audio not visible, checking page structure...');

    // Get the full sidebar content
    const sidebarContent = await page.evaluate(() => {
      const sidebar = document.querySelector('[class*="sidebar"], [class*="right-panel"], [class*="action-panel"]');
      return sidebar?.textContent?.slice(0, 500) || 'No sidebar found';
    });

    console.log('Sidebar content:', sidebarContent);
  }

  await page.waitForTimeout(10000);

  console.log('\n\nFiles in sync folder:');
  readdirSync(SYNC_PATH).forEach(f => console.log(`  ${f}`));

  await browser.close();
}

main().catch(console.error);

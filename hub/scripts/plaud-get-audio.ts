/**
 * Plaud Get Audio - Find the actual audio download URL
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const STORAGE_PATH = '/Users/jddavenport/Documents/PlaudSync/.plaud-auth.json';
const SYNC_PATH = '/Users/jddavenport/Documents/PlaudSync';

async function main() {
  console.log('=== Plaud Audio Finder ===\n');

  if (!existsSync(SYNC_PATH)) {
    mkdirSync(SYNC_PATH, { recursive: true });
  }

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: STORAGE_PATH,
  });

  const page = await context.newPage();

  // Track S3/CDN URLs
  const mediaUrls: string[] = [];

  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('s3.') || url.includes('amazonaws.com') || url.includes('cloudfront') ||
        url.includes('.ogg') || url.includes('.mp3') || url.includes('.m4a') ||
        (url.includes('file') && url.includes('download'))) {
      console.log(`[REQ] ${url.slice(0, 200)}`);
      mediaUrls.push(url);
    }
  });

  page.on('response', async (response) => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';

    if (contentType.includes('audio') || contentType.includes('ogg')) {
      console.log(`[AUDIO RESP] ${url.slice(0, 200)}`);
      console.log(`  Type: ${contentType}`);
    }
  });

  // Navigate to get token
  await page.goto('https://web.plaud.ai/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Dismiss any modals/popups
  console.log('Dismissing modals...');
  await page.evaluate(() => {
    // Close any modal overlays
    document.querySelectorAll('.modal-overlay, [class*="modal"], [class*="popup"], [class*="dialog"]').forEach(el => {
      if (el instanceof HTMLElement) {
        el.style.display = 'none';
      }
    });

    // Click any close buttons
    document.querySelectorAll('[class*="close"], [aria-label*="close"], button:has(svg)').forEach(el => {
      if (el instanceof HTMLElement && el.offsetParent !== null) {
        try { el.click(); } catch (e) {}
      }
    });
  });

  await page.waitForTimeout(1000);

  const token = await page.evaluate(() => localStorage.getItem('tokenstr'));

  // Get files
  const files = await page.evaluate(async (authToken) => {
    const response = await fetch('https://api.plaud.ai/file/simple/web?skip=0&limit=5&is_trash=2&sort_by=start_time&is_desc=true', {
      headers: { 'Authorization': authToken || '' }
    });
    const data = await response.json();
    return data.data_file_list || [];
  }, token);

  console.log(`Found ${files.length} files\n`);

  const file = files[0];
  console.log(`Target: ${file.filename} (${file.id})`);
  console.log(`Full name: ${file.fullname}`);
  console.log(`Size: ${Math.round(file.filesize / 1024 / 1024 * 10) / 10}MB\n`);

  // Navigate directly to file detail page instead of clicking
  console.log('Navigating to file detail...');
  await page.goto(`https://web.plaud.ai/file-detail/${file.id}`, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Dismiss modals again
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    document.querySelectorAll('.modal-overlay, [class*="modal"], [class*="popup"]').forEach(el => {
      if (el instanceof HTMLElement) el.style.display = 'none';
    });
  });

  // Wait for content to load
  console.log('Waiting for content...');
  await page.waitForTimeout(5000);

  console.log(`Current URL: ${page.url()}`);

  // Take screenshot
  await page.screenshot({ path: '/tmp/plaud-audio-finder.png', fullPage: true });
  console.log('Screenshot saved\n');

  // Look for audio element
  const audioInfo = await page.evaluate(() => {
    const audio = document.querySelector('audio');
    if (audio) {
      return {
        src: audio.src,
        currentSrc: audio.currentSrc,
        sources: Array.from(audio.querySelectorAll('source')).map(s => ({ src: s.src, type: s.type }))
      };
    }
    return null;
  });

  console.log('Audio element:', audioInfo);

  // Check for more button / download option
  console.log('\nLooking for download/export options...');

  // Find and click "more" or menu buttons
  const moreButtons = await page.locator('[class*="more"], [aria-label*="more"], [class*="menu"], [class*="option"]').all();
  console.log(`Found ${moreButtons.length} potential menu buttons`);

  for (let i = 0; i < Math.min(3, moreButtons.length); i++) {
    try {
      const btn = moreButtons[i];
      if (await btn.isVisible({ timeout: 500 })) {
        const className = await btn.getAttribute('class');
        console.log(`  Checking button: ${className?.slice(0, 50)}`);
      }
    } catch (e) {}
  }

  // Get full file info - try POST request
  console.log('\n=== Trying POST /file endpoint ===');

  const postResult = await page.evaluate(async ({ fileId, authToken }) => {
    try {
      const resp = await fetch('https://api.plaud.ai/file', {
        method: 'POST',
        headers: {
          'Authorization': authToken || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ file_id: fileId })
      });
      return { status: resp.status, data: await resp.text() };
    } catch (e) {
      return { error: String(e) };
    }
  }, { fileId: file.id, authToken: token });

  console.log('POST /file:', postResult.status);
  if (postResult.data) {
    console.log(postResult.data.slice(0, 1000));
  }

  // Try file/web endpoint
  console.log('\n=== Trying /file/web endpoint ===');

  const webResult = await page.evaluate(async ({ fileId, authToken }) => {
    try {
      const resp = await fetch(`https://api.plaud.ai/file/web?file_id=${fileId}`, {
        headers: { 'Authorization': authToken || '' }
      });
      return { status: resp.status, data: await resp.text() };
    } catch (e) {
      return { error: String(e) };
    }
  }, { fileId: file.id, authToken: token });

  console.log('/file/web:', webResult.status);
  if (webResult.data) {
    console.log(webResult.data.slice(0, 1000));
  }

  // Try content endpoint with POST
  console.log('\n=== Trying POST /file/content ===');

  const contentResult = await page.evaluate(async ({ fileId, authToken }) => {
    try {
      const resp = await fetch('https://api.plaud.ai/file/content', {
        method: 'POST',
        headers: {
          'Authorization': authToken || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ file_id: fileId })
      });
      return { status: resp.status, data: await resp.text() };
    } catch (e) {
      return { error: String(e) };
    }
  }, { fileId: file.id, authToken: token });

  console.log('POST /file/content:', contentResult.status);
  if (contentResult.data) {
    console.log(contentResult.data.slice(0, 1000));
  }

  // Look for transcript on page
  console.log('\n=== Looking for transcript on page ===');

  const pageText = await page.evaluate(() => {
    // Find main content area
    const mainContent = document.querySelector('[class*="content"], [class*="transcript"], main');
    if (mainContent) {
      return mainContent.textContent?.slice(0, 2000);
    }
    return null;
  });

  if (pageText && pageText.length > 100) {
    console.log('Page content sample:');
    console.log(pageText.slice(0, 500));
  }

  // Media URLs captured
  console.log('\n=== Media URLs Captured ===');
  mediaUrls.forEach(url => console.log(url));

  await page.waitForTimeout(5000);
  await browser.close();
}

main().catch(console.error);

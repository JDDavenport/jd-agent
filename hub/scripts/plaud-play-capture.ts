/**
 * Plaud Play Capture - Capture audio URL when playing
 */

import { chromium } from 'playwright';

const STORAGE_PATH = '/Users/jddavenport/Documents/PlaudSync/.plaud-auth.json';

async function main() {
  console.log('=== Plaud Play Capture ===\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: STORAGE_PATH,
  });

  const page = await context.newPage();

  // Capture ALL network requests
  const allRequests: { url: string; method: string; type: string }[] = [];
  const audioUrls: string[] = [];

  page.on('request', (request) => {
    const url = request.url();
    allRequests.push({
      url: url.slice(0, 200),
      method: request.method(),
      type: request.resourceType()
    });

    // Log audio/media requests
    if (request.resourceType() === 'media' || url.includes('audio') || url.includes('.mp3') ||
        url.includes('.ogg') || url.includes('.m4a') || url.includes('s3.amazonaws')) {
      console.log(`[REQ ${request.resourceType()}] ${request.method()} ${url.slice(0, 150)}`);
      audioUrls.push(url);
    }
  });

  page.on('response', async (response) => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';

    if (contentType.includes('audio') || contentType.includes('video')) {
      console.log(`[AUDIO RESP] ${url.slice(0, 150)}`);
      console.log(`  Content-Type: ${contentType}`);
      audioUrls.push(url);
    }
  });

  // Navigate to home first
  console.log('Navigating to Plaud...');
  await page.goto('https://web.plaud.ai/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Close modals
  await page.evaluate(() => {
    document.querySelectorAll('.modal-overlay').forEach(el => (el as HTMLElement).remove());
  });
  await page.waitForTimeout(1000);

  // Get token and files
  const token = await page.evaluate(() => localStorage.getItem('tokenstr'));

  // Click on a file with transcript (Steve Jobs one)
  console.log('\nClicking on file...');

  // Find the Steve Jobs file
  const fileItem = page.locator('text="Steve Jobs"').first();
  if (await fileItem.isVisible({ timeout: 3000 })) {
    await fileItem.click();
    await page.waitForTimeout(5000);
    console.log(`Current URL: ${page.url()}`);
  } else {
    console.log('Could not find Steve Jobs file, clicking first file...');
    const firstFile = page.locator('[class*="file-list-item"]').first();
    await firstFile.click();
    await page.waitForTimeout(5000);
  }

  // Take screenshot
  await page.screenshot({ path: '/tmp/plaud-file-view.png', fullPage: true });
  console.log('Screenshot saved\n');

  // Look for play button
  console.log('Looking for play button...');

  const playSelectors = [
    '[class*="play"]',
    '[aria-label*="play"]',
    'button:has(svg path[d*="M"])',
    '[class*="audio-player"] button',
    '[class*="player"] button',
  ];

  for (const selector of playSelectors) {
    const el = page.locator(selector).first();
    try {
      if (await el.isVisible({ timeout: 1000 })) {
        const className = await el.getAttribute('class');
        console.log(`Found: ${selector} - class="${className?.slice(0, 50)}"`);
      }
    } catch (e) {}
  }

  // Try to click play
  console.log('\nTrying to click play...');

  try {
    // Look for an element with play icon or player controls
    const playBtn = page.locator('[class*="play"]:not([class*="display"])').first();
    if (await playBtn.isVisible({ timeout: 2000 })) {
      console.log('Clicking play button...');
      await playBtn.click();
      await page.waitForTimeout(5000);
    }
  } catch (e) {
    console.log('Could not find/click play button');
  }

  // Check for audio element
  const audioInfo = await page.evaluate(() => {
    const audio = document.querySelector('audio');
    if (audio) {
      return {
        src: audio.src,
        currentSrc: audio.currentSrc,
        readyState: audio.readyState,
        duration: audio.duration,
        paused: audio.paused
      };
    }
    return null;
  });

  console.log('\nAudio element:', audioInfo);

  // Print all captured media requests
  console.log('\n=== All Media/Audio URLs ===');
  for (const url of audioUrls) {
    console.log(url);
  }

  // Check for blob URLs
  console.log('\n=== Blob URLs ===');
  for (const req of allRequests) {
    if (req.url.includes('blob:')) {
      console.log(`${req.method} ${req.type} ${req.url}`);
    }
  }

  // Check for S3 requests
  console.log('\n=== S3/CDN Requests ===');
  for (const req of allRequests) {
    if (req.url.includes('s3.') || req.url.includes('amazonaws') || req.url.includes('cloudfront')) {
      console.log(`${req.method} ${req.type} ${req.url}`);
    }
  }

  // Keep open for inspection
  console.log('\nBrowser open for 15 seconds...');
  await page.waitForTimeout(15000);

  await browser.close();
}

main().catch(console.error);

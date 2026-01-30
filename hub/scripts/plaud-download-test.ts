/**
 * Plaud Download Test - Navigate to file detail and find audio URL
 */

import { chromium } from 'playwright';

const STORAGE_PATH = '/Users/jddavenport/Documents/PlaudSync/.plaud-auth.json';

async function main() {
  console.log('Testing Plaud download...');

  const browser = await chromium.launch({ headless: false }); // Show browser
  const context = await browser.newContext({
    storageState: STORAGE_PATH,
  });

  const page = await context.newPage();

  // Track all requests
  const audioUrls: string[] = [];

  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('mp3') || url.includes('audio') || url.includes('media') || url.includes('.m4a') || url.includes('blob')) {
      console.log(`[REQ] ${request.method()} ${url.slice(0, 150)}`);
    }
  });

  page.on('response', async (response) => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';

    if (contentType.includes('audio') || url.includes('mp3') || url.includes('.m4a')) {
      console.log(`[AUDIO] ${response.status()} ${contentType} ${url.slice(0, 150)}`);
      audioUrls.push(url);
    }

    // Log API responses that might contain file info
    if (url.includes('api.plaud.ai') && !url.includes('posthog')) {
      if (url.includes('file') && !url.includes('simple')) {
        try {
          const data = await response.json();
          console.log(`[API] ${url.slice(0, 80)}`);
          console.log(JSON.stringify(data).slice(0, 500));
        } catch (e) {
          // Not JSON
        }
      }
    }
  });

  // Navigate to home first
  console.log('\nNavigating to Plaud...');
  await page.goto('https://web.plaud.ai/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Get first file ID
  const token = await page.evaluate(() => localStorage.getItem('tokenstr'));

  const files = await page.evaluate(async (authToken) => {
    const response = await fetch('https://api.plaud.ai/file/simple/web?skip=0&limit=5&is_trash=2&sort_by=start_time&is_desc=true', {
      headers: { 'Authorization': authToken || '' }
    });
    const data = await response.json();
    return data.data_file_list || [];
  }, token);

  if (files.length === 0) {
    console.log('No files found');
    await browser.close();
    return;
  }

  const firstFile = files[0];
  console.log(`\nGoing to file: ${firstFile.filename} (${firstFile.id})`);

  // Navigate to file detail page
  await page.goto(`https://web.plaud.ai/file-detail/${firstFile.id}`);
  await page.waitForLoadState('networkidle');

  // Wait for page to load and look for audio player
  await page.waitForTimeout(3000);

  // Take screenshot
  await page.screenshot({ path: '/tmp/plaud-file-detail.png', fullPage: true });
  console.log('Screenshot saved to /tmp/plaud-file-detail.png');

  // Check for audio element
  const audioInfo = await page.evaluate(() => {
    const audio = document.querySelector('audio');
    if (audio) {
      return {
        src: audio.src || audio.getAttribute('src'),
        currentSrc: audio.currentSrc,
        sources: Array.from(audio.querySelectorAll('source')).map(s => s.src)
      };
    }
    return null;
  });

  console.log('\nAudio element info:', audioInfo);

  // Look for any links or buttons with download
  const downloadLinks = await page.evaluate(() => {
    const links: { text: string; href: string }[] = [];
    document.querySelectorAll('a, button').forEach((el) => {
      const text = el.textContent?.trim() || '';
      if (text.toLowerCase().includes('download') || text.toLowerCase().includes('export')) {
        links.push({
          text,
          href: el.getAttribute('href') || ''
        });
      }
    });
    return links;
  });

  console.log('\nDownload links found:', downloadLinks);

  // Check localStorage for any cached audio URLs
  const storageData = await page.evaluate(() => {
    const result: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('audio') || key.includes('file') || key.includes('url'))) {
        result[key] = (localStorage.getItem(key) || '').slice(0, 200);
      }
    }
    return result;
  });

  console.log('\nRelevant localStorage:', storageData);

  // Try clicking on the play button if audio not found
  if (!audioInfo || !audioInfo.src) {
    console.log('\nTrying to find play button...');

    const playButton = page.locator('[class*="play"], [aria-label*="play"], button:has(svg), .icon-play').first();
    if (await playButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Found play button, clicking...');
      await playButton.click();
      await page.waitForTimeout(3000);

      // Check for audio again
      const audioAfterPlay = await page.evaluate(() => {
        const audio = document.querySelector('audio');
        return audio ? { src: audio.src, currentSrc: audio.currentSrc } : null;
      });

      console.log('Audio after play:', audioAfterPlay);
    }
  }

  console.log('\n=== Audio URLs captured ===');
  audioUrls.forEach(url => console.log(url));

  // Keep browser open for manual inspection
  console.log('\nBrowser open for inspection. Press Ctrl+C to close.');
  await page.waitForTimeout(30000);

  await browser.close();
}

main().catch(console.error);

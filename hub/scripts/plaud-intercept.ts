/**
 * Plaud Intercept - Capture all network traffic when viewing a file
 */

import { chromium } from 'playwright';

const STORAGE_PATH = '/Users/jddavenport/Documents/PlaudSync/.plaud-auth.json';

async function main() {
  console.log('=== Plaud Network Intercept ===\n');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: STORAGE_PATH,
  });

  const page = await context.newPage();

  // Log ALL requests
  const requests: { method: string; url: string; postData?: string }[] = [];
  const responses: { url: string; status: number; contentType: string; size: number; sample?: string }[] = [];

  page.on('request', (request) => {
    const url = request.url();
    if (!url.includes('google') && !url.includes('posthog') && !url.includes('datadog') && !url.includes('sentry') && !url.includes('cookieyes')) {
      requests.push({
        method: request.method(),
        url: url,
        postData: request.postData() || undefined
      });
    }
  });

  page.on('response', async (response) => {
    const url = response.url();
    const contentType = response.headers()['content-type'] || '';
    const contentLength = parseInt(response.headers()['content-length'] || '0');

    if (!url.includes('google') && !url.includes('posthog') && !url.includes('datadog') && !url.includes('sentry') && !url.includes('cookieyes') && !url.includes('stripe')) {
      const info: typeof responses[0] = {
        url: url.slice(0, 150),
        status: response.status(),
        contentType: contentType.slice(0, 50),
        size: contentLength
      };

      // For JSON responses from plaud API, capture sample
      if (url.includes('api.plaud.ai') && contentType.includes('json')) {
        try {
          const text = await response.text();
          info.sample = text.slice(0, 500);
        } catch (e) {
          // ignore
        }
      }

      // For audio/media responses
      if (contentType.includes('audio') || contentType.includes('video') || url.includes('.mp3') || url.includes('.m4a')) {
        console.log(`\n>>> AUDIO: ${url}`);
        console.log(`    Type: ${contentType}, Size: ${contentLength}`);
      }

      responses.push(info);
    }
  });

  // Navigate to home
  console.log('Navigating to home...');
  await page.goto('https://web.plaud.ai/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const token = await page.evaluate(() => localStorage.getItem('tokenstr'));

  // Get first file
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

  // Clear previous logs
  requests.length = 0;
  responses.length = 0;

  const file = files[0];
  console.log(`\nNavigating to file: ${file.filename} (${file.id})`);
  console.log('Capturing network traffic...\n');

  // Navigate to file detail
  await page.goto(`https://web.plaud.ai/file-detail/${file.id}`, { timeout: 60000 });

  // Wait for page to load
  await page.waitForTimeout(5000);

  // Try to click play button if exists
  try {
    const playButton = page.locator('[class*="play"]').first();
    if (await playButton.isVisible({ timeout: 2000 })) {
      console.log('Clicking play button...');
      await playButton.click();
      await page.waitForTimeout(3000);
    }
  } catch (e) {
    // no play button
  }

  console.log('\n=== API Requests ===');
  for (const req of requests.filter(r => r.url.includes('api.plaud.ai'))) {
    console.log(`${req.method} ${req.url}`);
    if (req.postData) {
      console.log(`  POST: ${req.postData.slice(0, 200)}`);
    }
  }

  console.log('\n=== API Responses ===');
  for (const res of responses.filter(r => r.url.includes('api.plaud.ai'))) {
    console.log(`[${res.status}] ${res.url}`);
    if (res.sample) {
      console.log(`  ${res.sample.slice(0, 300)}`);
    }
  }

  console.log('\n=== Other Interesting Requests ===');
  for (const req of requests.filter(r => !r.url.includes('api.plaud.ai') && (r.url.includes('audio') || r.url.includes('mp3') || r.url.includes('blob') || r.url.includes('media') || r.url.includes('s3')))) {
    console.log(`${req.method} ${req.url}`);
  }

  // Check page structure for transcript
  console.log('\n=== Page Content ===');
  const pageContent = await page.evaluate(() => {
    // Look for transcript elements
    const transcriptEls = document.querySelectorAll('[class*="transcript"], [class*="text"], [class*="content"]');
    const texts: string[] = [];

    transcriptEls.forEach(el => {
      const text = el.textContent?.trim();
      if (text && text.length > 100 && text.length < 5000) {
        texts.push(`[${el.className}]: ${text.slice(0, 200)}...`);
      }
    });

    return texts.slice(0, 5);
  });

  console.log('Transcript-like content:', pageContent);

  // Take screenshot
  await page.screenshot({ path: '/tmp/plaud-file-detail-intercept.png', fullPage: true });
  console.log('\nScreenshot saved to /tmp/plaud-file-detail-intercept.png');

  // Keep browser open
  console.log('\nPress Ctrl+C to close...');
  await page.waitForTimeout(30000);

  await browser.close();
}

main().catch(console.error);

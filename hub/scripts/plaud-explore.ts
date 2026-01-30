/**
 * Plaud Dashboard Explorer
 *
 * Uses saved session to explore the Plaud dashboard and find recordings
 */

import { chromium } from 'playwright';

const STORAGE_PATH = '/Users/jddavenport/Documents/PlaudSync/.plaud-auth.json';

async function main() {
  console.log('Loading saved session...');

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: STORAGE_PATH,
  });

  const page = await context.newPage();

  // Enable request/response logging
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('api') && !url.includes('posthog') && !url.includes('google') && !url.includes('datadog')) {
      console.log(`[API] ${response.status()} ${url.slice(0, 100)}`);
      if (response.status() === 200 && url.includes('record')) {
        try {
          const data = await response.json();
          console.log('[API Response]', JSON.stringify(data).slice(0, 500));
        } catch (e) {
          // Not JSON
        }
      }
    }
  });

  console.log('Navigating to Plaud dashboard...');
  await page.goto('https://web.plaud.ai/');
  await page.waitForLoadState('networkidle');

  // Take screenshot
  await page.screenshot({ path: '/tmp/plaud-dashboard.png', fullPage: true });
  console.log('Screenshot saved to /tmp/plaud-dashboard.png');

  // Wait a bit for dynamic content
  await page.waitForTimeout(3000);

  // Get page structure
  console.log('\n=== Page Analysis ===');
  console.log('URL:', page.url());
  console.log('Title:', await page.title());

  // Find recording-related elements
  const recordingSelectors = [
    '[class*="recording"]',
    '[class*="record"]',
    '[class*="audio"]',
    '[class*="item"]',
    '[class*="card"]',
    '[class*="list"]',
    '[data-pld]',
  ];

  for (const selector of recordingSelectors) {
    try {
      const count = await page.locator(selector).count();
      if (count > 0 && count < 100) {
        console.log(`\n${selector}: ${count} elements`);
        const elements = await page.locator(selector).all();
        for (let i = 0; i < Math.min(3, elements.length); i++) {
          const el = elements[i];
          const text = await el.textContent();
          const className = await el.getAttribute('class');
          const dataPld = await el.getAttribute('data-pld');
          console.log(`  [${i}] class="${className?.slice(0, 50)}" data-pld="${dataPld}" text="${text?.slice(0, 50)}"`);
        }
      }
    } catch (e) {
      // Selector not found
    }
  }

  // Look for specific Plaud data attributes
  console.log('\n=== Looking for data-pld attributes ===');
  const dataPldElements = await page.locator('[data-pld]').all();
  const dataPldValues = new Set<string>();
  for (const el of dataPldElements) {
    const value = await el.getAttribute('data-pld');
    if (value) dataPldValues.add(value);
  }
  console.log('Found data-pld values:', Array.from(dataPldValues).slice(0, 20));

  // Get page HTML structure for analysis
  const bodyHTML = await page.evaluate(() => {
    const body = document.body;
    const walk = (el: Element, depth: number): string => {
      if (depth > 4) return '';
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : '';
      const classes = el.className && typeof el.className === 'string'
        ? `.${el.className.split(' ').filter(c => c).slice(0, 2).join('.')}`
        : '';
      const dataPld = el.getAttribute('data-pld') ? `[data-pld="${el.getAttribute('data-pld')}"]` : '';

      let result = '  '.repeat(depth) + `<${tag}${id}${classes}${dataPld}>\n`;

      for (const child of el.children) {
        result += walk(child, depth + 1);
      }
      return result;
    };
    return walk(body, 0);
  });

  console.log('\n=== Page Structure (first 3000 chars) ===');
  console.log(bodyHTML.slice(0, 3000));

  // Look for any links or navigation
  console.log('\n=== Navigation Links ===');
  const links = await page.locator('a').all();
  for (const link of links.slice(0, 10)) {
    const href = await link.getAttribute('href');
    const text = await link.textContent();
    if (href && !href.startsWith('javascript')) {
      console.log(`  ${href} - "${text?.trim().slice(0, 30)}"`);
    }
  }

  // Keep browser open for manual inspection
  console.log('\n\nBrowser is open. Press Ctrl+C to close.');
  console.log('Explore the page manually to find recordings...');

  // Wait indefinitely
  await new Promise(() => {});
}

main().catch(console.error);

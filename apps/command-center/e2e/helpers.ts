import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Wait for page to be fully ready
 */
export async function waitForPageReady(page: Page, timeout = 30000) {
  await page.waitForLoadState('domcontentloaded', { timeout });
  await page.waitForLoadState('networkidle', { timeout });
}

/**
 * Wait for an element to be visible and stable
 */
export async function waitForElement(locator: Locator, timeout = 10000) {
  await locator.waitFor({ state: 'visible', timeout });
  await locator.waitFor({ state: 'attached', timeout });
}

/**
 * Fill a form field and verify the value
 */
export async function fillFormField(page: Page, selector: string, value: string) {
  const input = page.locator(selector);
  await input.waitFor({ state: 'visible' });
  await input.clear();
  await input.fill(value);
  await expect(input).toHaveValue(value);
}

/**
 * Click a button and wait for navigation
 */
export async function clickAndWaitForNavigation(page: Page, selector: string) {
  const [response] = await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.click(selector),
  ]);
  return response;
}

/**
 * Check if an element exists without throwing
 */
export async function elementExists(page: Page, selector: string): Promise<boolean> {
  try {
    const count = await page.locator(selector).count();
    return count > 0;
  } catch {
    return false;
  }
}

/**
 * Wait for API response
 */
export async function waitForAPIResponse(page: Page, urlPattern: string | RegExp) {
  return page.waitForResponse(
    (response) => {
      const url = response.url();
      if (typeof urlPattern === 'string') {
        return url.includes(urlPattern);
      }
      return urlPattern.test(url);
    },
    { timeout: 10000 }
  );
}

/**
 * Take a screenshot with a descriptive name
 */
export async function takeScreenshot(page: Page, name: string) {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  await page.screenshot({
    path: `screenshots/${name}-${timestamp}.png`,
    fullPage: true,
  });
}

/**
 * Mock API responses
 */
export async function mockAPIResponse(page: Page, url: string, data: any, status = 200) {
  await page.route(url, (route) => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(data),
    });
  });
}

/**
 * Clear all cookies and local storage
 */
export async function clearBrowserData(page: Page) {
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Check if text is visible on page
 */
export async function isTextVisible(page: Page, text: string | RegExp): Promise<boolean> {
  try {
    const locator = typeof text === 'string'
      ? page.locator(`text=${text}`)
      : page.locator(`text=${text}`);
    await locator.waitFor({ state: 'visible', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Wait for loading spinner to disappear
 */
export async function waitForLoadingToComplete(page: Page) {
  try {
    const spinner = page.locator('[class*="loading"], [class*="spinner"]').first();
    await spinner.waitFor({ state: 'hidden', timeout: 10000 });
  } catch {
    // No spinner found or it disappeared quickly
  }
}

/**
 * Navigate to a page and wait for it to be ready
 */
export async function navigateAndWait(page: Page, url: string) {
  await page.goto(url);
  await waitForPageReady(page);
  await waitForLoadingToComplete(page);
}

/**
 * Get all error messages on page
 */
export async function getErrorMessages(page: Page): Promise<string[]> {
  const errorLocators = [
    '[class*="error"]',
    '[role="alert"]',
    '.alert-error',
    '.error-message',
  ];

  const errors: string[] = [];
  for (const selector of errorLocators) {
    const elements = await page.locator(selector).all();
    for (const el of elements) {
      const text = await el.textContent();
      if (text) errors.push(text.trim());
    }
  }

  return errors;
}

/**
 * Retry an action with exponential backoff
 */
export async function retryWithBackoff<T>(
  action: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await action();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, i);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Check if page has sidebar navigation
 */
export async function hasSidebar(page: Page): Promise<boolean> {
  const sidebarSelectors = [
    'aside',
    '[class*="sidebar"]',
    'nav[class*="side"]',
  ];

  for (const selector of sidebarSelectors) {
    if (await elementExists(page, selector)) {
      return true;
    }
  }

  return false;
}

/**
 * Get current route path
 */
export function getCurrentPath(page: Page): string {
  const url = new URL(page.url());
  return url.pathname;
}

/**
 * Assert that element contains text
 */
export async function assertTextContains(locator: Locator, text: string | RegExp) {
  const content = await locator.textContent();
  if (typeof text === 'string') {
    expect(content).toContain(text);
  } else {
    expect(content).toMatch(text);
  }
}

/**
 * Count visible elements matching selector
 */
export async function countVisibleElements(page: Page, selector: string): Promise<number> {
  const elements = await page.locator(selector).all();
  let count = 0;

  for (const el of elements) {
    if (await el.isVisible()) {
      count++;
    }
  }

  return count;
}

/**
 * Press keyboard shortcut
 */
export async function pressShortcut(page: Page, shortcut: string) {
  const keys = shortcut.split('+').map((k) => k.trim());
  for (const key of keys.slice(0, -1)) {
    await page.keyboard.down(key);
  }
  await page.keyboard.press(keys[keys.length - 1]);
  for (const key of keys.slice(0, -1).reverse()) {
    await page.keyboard.up(key);
  }
}

/**
 * Hover over element and wait
 */
export async function hoverAndWait(page: Page, selector: string, waitMs = 500) {
  await page.hover(selector);
  await page.waitForTimeout(waitMs);
}

/**
 * Scroll element into view
 */
export async function scrollIntoView(locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  await locator.waitFor({ state: 'visible' });
}

/**
 * Wait for element to be stable (not animating)
 */
export async function waitForStable(locator: Locator, timeout = 5000) {
  await locator.waitFor({ state: 'visible', timeout });

  let lastBox = await locator.boundingBox();
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const currentBox = await locator.boundingBox();

    if (
      lastBox &&
      currentBox &&
      lastBox.x === currentBox.x &&
      lastBox.y === currentBox.y &&
      lastBox.width === currentBox.width &&
      lastBox.height === currentBox.height
    ) {
      return;
    }

    lastBox = currentBox;
  }
}

/**
 * Get page console logs
 */
export function captureConsoleLogs(page: Page): { type: string; text: string }[] {
  const logs: { type: string; text: string }[] = [];

  page.on('console', (msg) => {
    logs.push({
      type: msg.type(),
      text: msg.text(),
    });
  });

  return logs;
}

/**
 * Check for console errors
 */
export async function checkForConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];

  page.on('pageerror', (error) => {
    errors.push(error.message);
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  return errors;
}

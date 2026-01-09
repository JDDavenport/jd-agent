/**
 * JD Agent - Playwright Bridge
 *
 * Wrapper around Playwright for browser automation.
 * Provides simplified methods for the testing agent.
 */

import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import type {
  NavigateInput,
  ClickInput,
  FillInput,
  ScreenshotInput,
  ScrollInput,
  VerifyTextInput,
  VerifyElementInput,
  VerifyUrlInput,
  VerifyElementStateInput,
  GetElementTextInput,
  ApiRequestInput,
  ToolResult,
  ScreenshotResult,
  ApiRequestResult,
} from './types';

export class PlaywrightBridge {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private baseUrl: string;
  private apiBaseUrl: string;
  private screenshotDir: string;
  private headless: boolean;
  private viewport: { width: number; height: number };

  constructor(options: {
    baseUrl: string;
    apiBaseUrl: string;
    screenshotDir?: string;
    headless?: boolean;
    viewport?: { width: number; height: number };
  }) {
    this.baseUrl = options.baseUrl;
    this.apiBaseUrl = options.apiBaseUrl;
    this.screenshotDir = options.screenshotDir || './test-screenshots';
    this.headless = options.headless ?? true;
    this.viewport = options.viewport || { width: 1024, height: 768 };
  }

  // ============================================
  // Lifecycle
  // ============================================

  async initialize(): Promise<void> {
    // Ensure screenshot directory exists
    if (!fs.existsSync(this.screenshotDir)) {
      fs.mkdirSync(this.screenshotDir, { recursive: true });
    }

    this.browser = await chromium.launch({
      headless: this.headless,
    });

    this.context = await this.browser.newContext({
      viewport: this.viewport,
    });

    this.page = await this.context.newPage();

    // Set up console logging
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`[Browser Console Error] ${msg.text()}`);
      }
    });

    this.page.on('pageerror', (error) => {
      console.log(`[Browser Page Error] ${error.message}`);
    });
  }

  async close(): Promise<void> {
    await this.context?.close();
    await this.browser?.close();
    this.page = null;
    this.context = null;
    this.browser = null;
  }

  isReady(): boolean {
    return this.page !== null;
  }

  // ============================================
  // Navigation
  // ============================================

  async navigate(input: NavigateInput): Promise<ToolResult> {
    if (!this.page) return { success: false, error: 'Browser not initialized' };

    try {
      const url = input.path.startsWith('http')
        ? input.path
        : `${this.baseUrl}${input.path}`;

      await this.page.goto(url, { waitUntil: 'networkidle' });

      if (input.waitForSelector) {
        await this.page.waitForSelector(input.waitForSelector, { timeout: 10000 });
      }

      // Wait for page to stabilize
      await this.page.waitForTimeout(500);

      return {
        success: true,
        data: {
          url: this.page.url(),
          title: await this.page.title(),
        }
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async click(input: ClickInput): Promise<ToolResult> {
    if (!this.page) return { success: false, error: 'Browser not initialized' };

    try {
      let locator;

      if (input.selector) {
        locator = this.page.locator(input.selector).first();
      } else if (input.text) {
        // Try multiple strategies to find by text
        locator = this.page.locator(`text="${input.text}"`).first();

        // If not found, try more flexible matching
        const count = await locator.count();
        if (count === 0) {
          locator = this.page.getByRole('button', { name: input.text }).first();
        }
        if (await locator.count() === 0) {
          locator = this.page.getByRole('link', { name: input.text }).first();
        }
      } else {
        return { success: false, error: 'Must provide selector or text' };
      }

      await locator.waitFor({ state: 'visible', timeout: 5000 });
      await locator.click();

      if (input.waitAfter) {
        await this.page.waitForTimeout(input.waitAfter);
      } else {
        await this.page.waitForTimeout(500);
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async fill(input: FillInput): Promise<ToolResult> {
    if (!this.page) return { success: false, error: 'Browser not initialized' };

    try {
      let locator;

      if (input.selector) {
        locator = this.page.locator(input.selector).first();
      } else if (input.placeholder) {
        locator = this.page.locator(`[placeholder*="${input.placeholder}" i]`).first();
      } else if (input.label) {
        locator = this.page.getByLabel(input.label).first();
      } else {
        return { success: false, error: 'Must provide selector, placeholder, or label' };
      }

      await locator.waitFor({ state: 'visible', timeout: 5000 });

      if (input.clearFirst !== false) {
        await locator.clear();
      }

      await locator.fill(input.value);

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async scroll(input: ScrollInput): Promise<ToolResult> {
    if (!this.page) return { success: false, error: 'Browser not initialized' };

    try {
      const amount = input.amount || 300;
      const delta = input.direction === 'down' ? amount : -amount;

      if (input.selector) {
        const element = this.page.locator(input.selector).first();
        await element.evaluate((el, d) => {
          el.scrollBy(0, d);
        }, delta);
      } else {
        await this.page.mouse.wheel(0, delta);
      }

      await this.page.waitForTimeout(300);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async wait(milliseconds: number): Promise<ToolResult> {
    if (!this.page) return { success: false, error: 'Browser not initialized' };

    try {
      await this.page.waitForTimeout(milliseconds);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // ============================================
  // Screenshots
  // ============================================

  async takeScreenshot(input: ScreenshotInput): Promise<ScreenshotResult> {
    if (!this.page) return { success: false, error: 'Browser not initialized' };

    try {
      const timestamp = Date.now();
      const safeName = input.name.replace(/[^a-z0-9-]/gi, '-');
      const filename = `${safeName}-${timestamp}.jpeg`;
      const filepath = path.join(this.screenshotDir, filename);

      let buffer: Buffer;

      if (input.selector) {
        const element = this.page.locator(input.selector).first();
        buffer = await element.screenshot({
          type: 'jpeg',
          quality: 50, // Lower quality for smaller size
          scale: 'css',
        });
      } else {
        buffer = await this.page.screenshot({
          fullPage: input.fullPage || false,
          type: 'jpeg',
          quality: 50, // Lower quality for smaller size
          scale: 'css',
        });
      }

      // Save to file
      fs.writeFileSync(filepath, buffer);

      // Return base64 for vision analysis
      const base64 = buffer.toString('base64');

      return {
        success: true,
        data: {
          path: filepath,
          base64,
        },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // ============================================
  // Verification
  // ============================================

  async verifyTextVisible(input: VerifyTextInput): Promise<ToolResult> {
    if (!this.page) return { success: false, error: 'Browser not initialized' };

    try {
      const timeout = input.timeout || 5000;
      const locator = this.page.locator(`text=${input.text}`).first();

      await locator.waitFor({ state: 'visible', timeout });

      return {
        success: true,
        data: { visible: true, text: input.text }
      };
    } catch {
      return {
        success: true,
        data: { visible: false, text: input.text }
      };
    }
  }

  async verifyElementExists(input: VerifyElementInput): Promise<ToolResult> {
    if (!this.page) return { success: false, error: 'Browser not initialized' };

    try {
      const locator = this.page.locator(input.selector);
      const count = await locator.count();
      const exists = count > 0;
      const shouldExist = input.shouldExist !== false;

      return {
        success: true,
        data: {
          exists,
          count,
          matches: exists === shouldExist,
        },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async verifyUrl(input: VerifyUrlInput): Promise<ToolResult> {
    if (!this.page) return { success: false, error: 'Browser not initialized' };

    try {
      const currentUrl = this.page.url();
      const urlPath = new URL(currentUrl).pathname;

      let matches = true;
      const checks: Record<string, boolean> = {};

      if (input.expectedPath) {
        checks.pathMatches = urlPath === input.expectedPath;
        matches = matches && checks.pathMatches;
      }

      if (input.contains) {
        checks.containsMatch = currentUrl.includes(input.contains);
        matches = matches && checks.containsMatch;
      }

      return {
        success: true,
        data: {
          currentUrl,
          currentPath: urlPath,
          matches,
          checks,
        },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async verifyElementState(input: VerifyElementStateInput): Promise<ToolResult> {
    if (!this.page) return { success: false, error: 'Browser not initialized' };

    try {
      const locator = this.page.locator(input.selector).first();
      let actualState: boolean;

      switch (input.state) {
        case 'visible':
          actualState = await locator.isVisible();
          break;
        case 'hidden':
          actualState = !(await locator.isVisible());
          break;
        case 'enabled':
          actualState = await locator.isEnabled();
          break;
        case 'disabled':
          actualState = await locator.isDisabled();
          break;
        case 'checked':
          actualState = await locator.isChecked();
          break;
        case 'unchecked':
          actualState = !(await locator.isChecked());
          break;
        default:
          return { success: false, error: `Unknown state: ${input.state}` };
      }

      return {
        success: true,
        data: {
          expectedState: input.state,
          matches: actualState,
        },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  async getElementText(input: GetElementTextInput): Promise<ToolResult> {
    if (!this.page) return { success: false, error: 'Browser not initialized' };

    try {
      const locator = this.page.locator(input.selector).first();
      const text = await locator.textContent();

      return {
        success: true,
        data: { text: text?.trim() || '' },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // ============================================
  // API Testing
  // ============================================

  async apiRequest(input: ApiRequestInput): Promise<ApiRequestResult> {
    try {
      const url = input.endpoint.startsWith('http')
        ? input.endpoint
        : `${this.apiBaseUrl}${input.endpoint}`;

      const startTime = Date.now();

      const response = await fetch(url, {
        method: input.method,
        headers: {
          'Content-Type': 'application/json',
          ...input.headers,
        },
        body: input.body ? JSON.stringify(input.body) : undefined,
      });

      const duration = Date.now() - startTime;

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = await response.text();
      }

      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return {
        success: true,
        data: {
          status: response.status,
          body,
          headers,
          duration,
        },
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  // ============================================
  // Page Information
  // ============================================

  async getCurrentUrl(): Promise<string> {
    return this.page?.url() || '';
  }

  async getPageTitle(): Promise<string> {
    return this.page?.title() || '';
  }

  async getConsoleErrors(): Promise<string[]> {
    // This would need to be collected over time via event listener
    // For now, return empty array
    return [];
  }
}

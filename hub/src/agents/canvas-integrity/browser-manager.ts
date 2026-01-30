// Use type-only imports for TypeScript - these don't load the module at runtime
import type { Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// Lazy-load playwright to reduce startup memory
let playwrightModule: typeof import('playwright') | null = null;

async function getPlaywright() {
  if (!playwrightModule) {
    console.log('[BrowserManager] Loading playwright module...');
    playwrightModule = await import('playwright');
    console.log('[BrowserManager] Playwright module loaded');
  }
  return playwrightModule;
}

// ============================================
// Types
// ============================================

export interface BrowserManagerConfig {
  headless?: boolean;
  sessionDir?: string;
  screenshotDir?: string;
  canvasBaseUrl?: string;
}

export interface CanvasCredentials {
  username?: string;
  password?: string;
  // For SSO, we may need additional fields
  ssoProvider?: string;
}

export interface SessionInfo {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
  }>;
  savedAt: string;
}

// ============================================
// Constants
// ============================================

const DEFAULT_DATA_DIR = process.env.CANVAS_DATA_DIR || '/tmp/jd-agent-canvas';
const DEFAULT_SESSION_DIR = path.join(DEFAULT_DATA_DIR, 'sessions');
const DEFAULT_SCREENSHOT_DIR = path.join(DEFAULT_DATA_DIR, 'screenshots');
const DEFAULT_CANVAS_URL = process.env.CANVAS_BASE_URL || 'https://canvas.instructure.com';

const SESSION_FILE = 'canvas-session.json';

// ============================================
// Browser Manager
// ============================================

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: Required<BrowserManagerConfig>;
  private isInitialized = false;

  constructor(config: BrowserManagerConfig = {}) {
    this.config = {
      headless: config.headless ?? true,
      sessionDir: config.sessionDir ?? DEFAULT_SESSION_DIR,
      screenshotDir: config.screenshotDir ?? DEFAULT_SCREENSHOT_DIR,
      canvasBaseUrl: config.canvasBaseUrl ?? DEFAULT_CANVAS_URL,
    };

    // Ensure directories exist
    this.ensureDirectories();
  }

  private ensureDirectories() {
    if (!fs.existsSync(this.config.sessionDir)) {
      fs.mkdirSync(this.config.sessionDir, { recursive: true });
    }
    if (!fs.existsSync(this.config.screenshotDir)) {
      fs.mkdirSync(this.config.screenshotDir, { recursive: true });
    }
  }

  // ----------------------------------------
  // Initialization
  // ----------------------------------------

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[BrowserManager] Already initialized');
      return;
    }

    console.log('[BrowserManager] Initializing browser...');

    const { chromium } = await getPlaywright();
    this.browser = await chromium.launch({
      headless: this.config.headless,
    });

    // Create a new context with a realistic viewport
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    this.page = await this.context.newPage();
    this.isInitialized = true;

    console.log('[BrowserManager] Browser initialized');
  }

  // ----------------------------------------
  // Session Management
  // ----------------------------------------

  async saveSession(): Promise<void> {
    if (!this.context) {
      throw new Error('Browser context not initialized');
    }

    const cookies = await this.context.cookies();
    const sessionInfo: SessionInfo = {
      cookies: cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        expires: c.expires,
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: c.sameSite,
      })),
      savedAt: new Date().toISOString(),
    };

    const sessionPath = path.join(this.config.sessionDir, SESSION_FILE);
    fs.writeFileSync(sessionPath, JSON.stringify(sessionInfo, null, 2));

    console.log('[BrowserManager] Session saved');
  }

  async restoreSession(): Promise<boolean> {
    const sessionPath = path.join(this.config.sessionDir, SESSION_FILE);

    if (!fs.existsSync(sessionPath)) {
      console.log('[BrowserManager] No saved session found');
      return false;
    }

    try {
      const sessionData = fs.readFileSync(sessionPath, 'utf-8');
      const sessionInfo: SessionInfo = JSON.parse(sessionData);

      // Check if session is too old (7 days)
      const savedAt = new Date(sessionInfo.savedAt);
      const daysSinceSave = (Date.now() - savedAt.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceSave > 7) {
        console.log('[BrowserManager] Session expired, need to re-login');
        return false;
      }

      if (!this.context) {
        await this.initialize();
      }

      // Restore cookies
      await this.context!.addCookies(sessionInfo.cookies);

      console.log('[BrowserManager] Session restored');
      return true;
    } catch (error) {
      console.error('[BrowserManager] Failed to restore session:', error);
      return false;
    }
  }

  async isSessionValid(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Navigate to Canvas and check if we're logged in
      await this.page.goto(this.config.canvasBaseUrl, { waitUntil: 'networkidle' });

      // Check for login indicators
      const loginButton = await this.page.$('#login_form, .ic-Login');
      const dashboard = await this.page.$('#dashboard, .ic-Dashboard-header');

      if (loginButton) {
        console.log('[BrowserManager] Session invalid - login required');
        return false;
      }

      if (dashboard) {
        console.log('[BrowserManager] Session valid - dashboard accessible');
        return true;
      }

      // Check URL for login redirect
      const url = this.page.url();
      if (url.includes('login') || url.includes('auth')) {
        console.log('[BrowserManager] Session invalid - redirected to login');
        return false;
      }

      return true;
    } catch (error) {
      console.error('[BrowserManager] Session validation error:', error);
      return false;
    }
  }

  // ----------------------------------------
  // Login
  // ----------------------------------------

  async login(credentials?: CanvasCredentials): Promise<boolean> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    console.log('[BrowserManager] Attempting login...');

    // Navigate to Canvas login
    await this.page.goto(this.config.canvasBaseUrl, { waitUntil: 'networkidle' });

    // Check if already logged in
    const dashboard = await this.page.$('#dashboard, .ic-Dashboard-header');
    if (dashboard) {
      console.log('[BrowserManager] Already logged in');
      await this.saveSession();
      return true;
    }

    // If no credentials provided, we need manual login
    if (!credentials?.username || !credentials?.password) {
      console.log('[BrowserManager] No credentials provided - manual login required');
      console.log('[BrowserManager] Please log in manually in the browser window');

      // Wait for manual login (up to 5 minutes)
      try {
        await this.page.waitForURL('**/dashboard**', { timeout: 300000 });
        console.log('[BrowserManager] Manual login successful');
        await this.saveSession();
        return true;
      } catch {
        console.log('[BrowserManager] Manual login timed out');
        return false;
      }
    }

    // Attempt automated login
    try {
      // Look for username field
      const usernameField = await this.page.$('#pseudonym_session_unique_id, input[name="pseudonym_session[unique_id]"]');
      if (usernameField) {
        await usernameField.fill(credentials.username);
      }

      // Look for password field
      const passwordField = await this.page.$('#pseudonym_session_password, input[name="pseudonym_session[password]"]');
      if (passwordField) {
        await passwordField.fill(credentials.password);
      }

      // Submit the form
      const submitButton = await this.page.$('.Button--login, input[type="submit"], button[type="submit"]');
      if (submitButton) {
        await submitButton.click();
      }

      // Wait for navigation
      await this.page.waitForURL('**/dashboard**', { timeout: 30000 });

      console.log('[BrowserManager] Login successful');
      await this.saveSession();
      return true;
    } catch (error) {
      console.error('[BrowserManager] Login failed:', error);
      return false;
    }
  }

  // ----------------------------------------
  // Page Access
  // ----------------------------------------

  async getPage(): Promise<Page> {
    if (!this.page) {
      await this.initialize();
    }
    return this.page!;
  }

  getCanvasBaseUrl(): string {
    return this.config.canvasBaseUrl;
  }

  // ----------------------------------------
  // Screenshots
  // ----------------------------------------

  async takeScreenshot(name: string): Promise<string> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}_${timestamp}.png`;
    const filepath = path.join(this.config.screenshotDir, filename);

    await this.page.screenshot({ path: filepath, fullPage: true });

    console.log(`[BrowserManager] Screenshot saved: ${filename}`);
    return filepath;
  }

  async takeElementScreenshot(selector: string, name: string): Promise<string | null> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    const element = await this.page.$(selector);
    if (!element) {
      console.log(`[BrowserManager] Element not found: ${selector}`);
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}_${timestamp}.png`;
    const filepath = path.join(this.config.screenshotDir, filename);

    await element.screenshot({ path: filepath });

    console.log(`[BrowserManager] Element screenshot saved: ${filename}`);
    return filepath;
  }

  // ----------------------------------------
  // Navigation Helpers
  // ----------------------------------------

  async navigateTo(url: string, options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' }): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    await this.page.goto(url, { waitUntil: options?.waitUntil ?? 'networkidle' });
  }

  async waitForSelector(selector: string, timeout = 10000): Promise<boolean> {
    if (!this.page) return false;

    try {
      await this.page.waitForSelector(selector, { timeout });
      return true;
    } catch {
      return false;
    }
  }

  async scrollToBottom(): Promise<void> {
    if (!this.page) return;

    await this.page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
  }

  async expandCollapsedSections(): Promise<number> {
    if (!this.page) return 0;

    const expandedCount = await this.page.evaluate(() => {
      const collapsedButtons = document.querySelectorAll(
        '[aria-expanded="false"], .collapsed, .module-item-toggle[aria-expanded="false"]'
      );
      let count = 0;
      collapsedButtons.forEach((button: Element) => {
        if (button instanceof HTMLElement) {
          button.click();
          count++;
        }
      });
      return count;
    });

    if (expandedCount > 0) {
      // Wait for animations
      await this.page.waitForTimeout(500);
    }

    return expandedCount;
  }

  // ----------------------------------------
  // Cleanup
  // ----------------------------------------

  async close(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }

    if (this.context) {
      await this.context.close();
      this.context = null;
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    this.isInitialized = false;
    console.log('[BrowserManager] Browser closed');
  }

  isReady(): boolean {
    return this.isInitialized && this.browser !== null && this.page !== null;
  }
}

// ============================================
// Singleton
// ============================================

let browserManagerInstance: BrowserManager | null = null;

export function getBrowserManager(config?: BrowserManagerConfig): BrowserManager {
  if (!browserManagerInstance) {
    browserManagerInstance = new BrowserManager(config);
  }
  return browserManagerInstance;
}

export async function closeBrowserManager(): Promise<void> {
  if (browserManagerInstance) {
    await browserManagerInstance.close();
    browserManagerInstance = null;
  }
}

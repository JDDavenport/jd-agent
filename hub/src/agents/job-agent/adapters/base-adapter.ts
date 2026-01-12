import type { Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// Lazy-load playwright to reduce startup memory
let playwrightModule: typeof import('playwright') | null = null;

async function getPlaywright() {
  if (!playwrightModule) {
    console.log('[JobAdapter] Loading playwright module...');
    playwrightModule = await import('playwright');
  }
  return playwrightModule;
}

// ============================================
// Types
// ============================================

export interface JobListing {
  title: string;
  company: string;
  location?: string;
  locationType?: 'remote' | 'hybrid' | 'onsite';
  salaryMin?: number;
  salaryMax?: number;
  description?: string;
  requirements?: string[];
  url: string;
  platform: string;
  platformJobId?: string;
  postedDate?: string;
}

export interface ApplicationResult {
  success: boolean;
  jobId?: string;
  message: string;
  screenshotPath?: string;
  errors?: string[];
}

export interface AdapterConfig {
  headless?: boolean;
  sessionDir?: string;
  screenshotDir?: string;
  slowMo?: number;
}

export interface Credentials {
  email?: string;
  username?: string;
  password?: string;
}

// ============================================
// Base Adapter Class
// ============================================

export abstract class BaseJobAdapter {
  protected browser: Browser | null = null;
  protected context: BrowserContext | null = null;
  protected page: Page | null = null;
  protected config: Required<AdapterConfig>;
  protected isInitialized = false;

  abstract readonly platform: string;
  abstract readonly loginUrl: string;
  abstract readonly jobSearchUrl: string;

  constructor(config: AdapterConfig = {}) {
    const dataDir = process.env.JOB_AGENT_DATA_DIR || '/tmp/jd-agent-jobs';

    this.config = {
      headless: config.headless ?? (process.env.JOB_AGENT_HEADLESS !== 'false'),
      sessionDir: config.sessionDir ?? path.join(dataDir, 'sessions'),
      screenshotDir: config.screenshotDir ?? path.join(dataDir, 'screenshots'),
      slowMo: config.slowMo ?? 50,
    };

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
  // Lifecycle Methods
  // ----------------------------------------

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log(`[${this.platform}Adapter] Already initialized`);
      return;
    }

    console.log(`[${this.platform}Adapter] Initializing browser...`);

    const { chromium } = await getPlaywright();
    this.browser = await chromium.launch({
      headless: this.config.headless,
      slowMo: this.config.slowMo,
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    // Try to load saved session
    await this.loadSession();

    this.page = await this.context.newPage();
    this.isInitialized = true;

    console.log(`[${this.platform}Adapter] Browser initialized`);
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.saveSession();
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      this.isInitialized = false;
      console.log(`[${this.platform}Adapter] Browser closed`);
    }
  }

  // ----------------------------------------
  // Session Management
  // ----------------------------------------

  protected getSessionPath(): string {
    return path.join(this.config.sessionDir, `${this.platform.toLowerCase()}-session.json`);
  }

  protected async saveSession(): Promise<void> {
    if (!this.context) return;

    try {
      const cookies = await this.context.cookies();
      const sessionData = {
        cookies,
        savedAt: new Date().toISOString(),
      };
      fs.writeFileSync(this.getSessionPath(), JSON.stringify(sessionData, null, 2));
      console.log(`[${this.platform}Adapter] Session saved`);
    } catch (error) {
      console.error(`[${this.platform}Adapter] Failed to save session:`, error);
    }
  }

  protected async loadSession(): Promise<boolean> {
    if (!this.context) return false;

    try {
      const sessionPath = this.getSessionPath();
      if (!fs.existsSync(sessionPath)) {
        console.log(`[${this.platform}Adapter] No saved session found`);
        return false;
      }

      const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));

      // Check if session is too old (7 days)
      const savedAt = new Date(sessionData.savedAt);
      const daysSinceSaved = (Date.now() - savedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceSaved > 7) {
        console.log(`[${this.platform}Adapter] Session expired, need fresh login`);
        return false;
      }

      await this.context.addCookies(sessionData.cookies);
      console.log(`[${this.platform}Adapter] Session restored`);
      return true;
    } catch (error) {
      console.error(`[${this.platform}Adapter] Failed to load session:`, error);
      return false;
    }
  }

  // ----------------------------------------
  // Utility Methods
  // ----------------------------------------

  protected async takeScreenshot(name: string): Promise<string> {
    if (!this.page) throw new Error('Page not initialized');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${this.platform.toLowerCase()}-${name}-${timestamp}.png`;
    const filepath = path.join(this.config.screenshotDir, filename);

    await this.page.screenshot({ path: filepath, fullPage: true });
    console.log(`[${this.platform}Adapter] Screenshot saved: ${filename}`);
    return filepath;
  }

  protected async waitForNavigation(timeout = 30000): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    await this.page.waitForLoadState('networkidle', { timeout });
  }

  protected async typeSlowly(selector: string, text: string, delay = 50): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    await this.page.type(selector, text, { delay });
  }

  protected async clickAndWait(selector: string, timeout = 30000): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');
    await this.page.click(selector);
    await this.waitForNavigation(timeout);
  }

  // ----------------------------------------
  // Abstract Methods (to be implemented by subclasses)
  // ----------------------------------------

  abstract login(credentials: Credentials): Promise<boolean>;
  abstract isLoggedIn(): Promise<boolean>;
  abstract searchJobs(query: string, filters?: Record<string, string>): Promise<JobListing[]>;
  abstract getJobDetails(jobId: string): Promise<JobListing | null>;
  abstract applyToJob(
    jobId: string,
    resumePath: string,
    coverLetter?: string,
    answers?: Record<string, string>
  ): Promise<ApplicationResult>;
}

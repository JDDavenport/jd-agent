/**
 * JD Agent - Plaud Web Scraper
 *
 * Uses Playwright to automate downloading recordings from web.plaud.ai
 *
 * Flow:
 * 1. Login with email/password
 * 2. Navigate to recordings list
 * 3. Download new audio files
 * 4. Save to PlaudSync folder for processing
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { db } from '../db/client';
import { recordings } from '../db/schema';
import { eq } from 'drizzle-orm';

const PLAUD_URL = 'https://web.plaud.ai';
const STATE_FILE = join(process.env.PLAUD_SYNC_PATH || '/tmp', '.plaud-scraper-state.json');

interface ScraperState {
  lastSyncTime: string;
  downloadedIds: string[];
  cookies?: any[];
}

interface Recording {
  id: string;
  title: string;
  duration: number;
  createdAt: string;
  audioUrl?: string;
}

interface SyncResult {
  success: boolean;
  downloaded: number;
  skipped: number;
  errors: string[];
  recordings: string[];
}

export class PlaudScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private syncPath: string;
  private email: string | null;
  private password: string | null;

  constructor() {
    this.syncPath = process.env.PLAUD_SYNC_PATH || '/Users/jddavenport/Documents/PlaudSync';
    this.email = process.env.PLAUD_EMAIL || null;
    this.password = process.env.PLAUD_PASSWORD || null;

    // Ensure sync path exists
    if (!existsSync(this.syncPath)) {
      mkdirSync(this.syncPath, { recursive: true });
    }
  }

  isConfigured(): boolean {
    return this.email !== null && this.password !== null;
  }

  private loadState(): ScraperState {
    try {
      if (existsSync(STATE_FILE)) {
        return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
      }
    } catch (e) {
      console.error('[PlaudScraper] Error loading state:', e);
    }
    return { lastSyncTime: '', downloadedIds: [] };
  }

  private saveState(state: ScraperState): void {
    try {
      writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (e) {
      console.error('[PlaudScraper] Error saving state:', e);
    }
  }

  async init(): Promise<void> {
    if (this.browser) return;

    console.log('[PlaudScraper] Launching browser...');
    this.browser = await chromium.launch({
      headless: true, // Set to false for debugging
    });

    // Try to restore cookies from previous session
    const state = this.loadState();
    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    if (state.cookies && state.cookies.length > 0) {
      await this.context.addCookies(state.cookies);
    }

    this.page = await this.context.newPage();
  }

  async close(): Promise<void> {
    if (this.context) {
      // Save cookies for next session
      const cookies = await this.context.cookies();
      const state = this.loadState();
      state.cookies = cookies;
      this.saveState(state);
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }

  async login(): Promise<boolean> {
    if (!this.page || !this.email || !this.password) {
      console.error('[PlaudScraper] Not initialized or missing credentials');
      return false;
    }

    console.log('[PlaudScraper] Navigating to login page...');
    await this.page.goto(`${PLAUD_URL}/login`);
    await this.page.waitForLoadState('networkidle');

    // Check if already logged in
    const url = this.page.url();
    if (!url.includes('/login')) {
      console.log('[PlaudScraper] Already logged in');
      return true;
    }

    // Dismiss cookie banner if present
    try {
      const closeButton = this.page.locator('button:has-text("×"), button:has-text("Close"), [aria-label="Close"]');
      if (await closeButton.isVisible({ timeout: 2000 })) {
        await closeButton.click();
      }
    } catch (e) {
      // Cookie banner not present, continue
    }

    console.log('[PlaudScraper] Filling login form...');

    // Fill email
    await this.page.fill('input[placeholder="Email address"], input[type="email"], input[name="email"]', this.email);

    // Fill password
    await this.page.fill('input[placeholder="Password"], input[type="password"], input[name="password"]', this.password);

    // Click login button
    await this.page.click('button:has-text("Log in"), button:has-text("Login"), button[type="submit"]');

    // Wait for navigation
    try {
      await this.page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 15000 });
      console.log('[PlaudScraper] Login successful');
      return true;
    } catch (e) {
      console.error('[PlaudScraper] Login failed - check credentials');
      await this.page.screenshot({ path: '/tmp/plaud-login-failed.png' });
      return false;
    }
  }

  async getRecordings(): Promise<Recording[]> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    console.log('[PlaudScraper] Fetching recordings list...');

    // Navigate to recordings/home page
    await this.page.goto(`${PLAUD_URL}/`);
    await this.page.waitForLoadState('networkidle');

    // Take screenshot for debugging
    await this.page.screenshot({ path: '/tmp/plaud-recordings-page.png' });
    console.log('[PlaudScraper] Screenshot saved to /tmp/plaud-recordings-page.png');

    // Wait for recordings to load
    await this.page.waitForTimeout(3000);

    // Try to extract recordings from the page
    // This will need to be adjusted based on actual page structure
    const recordingsList: Recording[] = [];

    try {
      // Look for recording items - adjust selectors based on actual page structure
      const recordingElements = await this.page.locator('[class*="recording"], [class*="item"], [data-recording-id]').all();

      console.log(`[PlaudScraper] Found ${recordingElements.length} potential recording elements`);

      for (const el of recordingElements) {
        try {
          const id = await el.getAttribute('data-recording-id') || await el.getAttribute('data-id') || '';
          const title = await el.locator('[class*="title"], h3, h4, .name').first().textContent() || 'Untitled';

          if (id) {
            recordingsList.push({
              id,
              title: title.trim(),
              duration: 0,
              createdAt: new Date().toISOString(),
            });
          }
        } catch (e) {
          // Skip this element
        }
      }
    } catch (e) {
      console.error('[PlaudScraper] Error extracting recordings:', e);
    }

    // If no recordings found with standard selectors, try to intercept API calls
    if (recordingsList.length === 0) {
      console.log('[PlaudScraper] Trying to intercept API calls...');

      // Set up request interception
      const apiRecordings: Recording[] = [];

      this.page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('/api/') && url.includes('recording')) {
          try {
            const data = await response.json();
            console.log('[PlaudScraper] API response:', JSON.stringify(data).slice(0, 200));
          } catch (e) {
            // Not JSON
          }
        }
      });

      // Refresh to capture API calls
      await this.page.reload();
      await this.page.waitForLoadState('networkidle');
      await this.page.waitForTimeout(3000);
    }

    return recordingsList;
  }

  async downloadRecording(recording: Recording): Promise<string | null> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    console.log(`[PlaudScraper] Downloading: ${recording.title}`);

    try {
      // Navigate to recording detail page
      // This URL pattern may need adjustment
      await this.page.goto(`${PLAUD_URL}/recording/${recording.id}`);
      await this.page.waitForLoadState('networkidle');

      // Look for download button or audio element
      const downloadButton = this.page.locator('button:has-text("Download"), a:has-text("Download"), [class*="download"]');

      if (await downloadButton.isVisible({ timeout: 5000 })) {
        // Set up download handler
        const [download] = await Promise.all([
          this.page.waitForEvent('download'),
          downloadButton.click(),
        ]);

        const filename = download.suggestedFilename() || `${recording.id}.mp3`;
        const savePath = join(this.syncPath, filename);
        await download.saveAs(savePath);

        console.log(`[PlaudScraper] Saved: ${savePath}`);
        return savePath;
      }

      // Try to find audio element and extract URL
      const audioSrc = await this.page.locator('audio source, audio').first().getAttribute('src');
      if (audioSrc) {
        console.log(`[PlaudScraper] Found audio URL: ${audioSrc.slice(0, 100)}...`);

        // Download the audio file
        const response = await this.page.request.get(audioSrc);
        const buffer = await response.body();

        const filename = `${recording.title.replace(/[^a-zA-Z0-9]/g, '_')}_${recording.id.slice(0, 8)}.mp3`;
        const savePath = join(this.syncPath, filename);
        writeFileSync(savePath, buffer);

        console.log(`[PlaudScraper] Saved: ${savePath}`);
        return savePath;
      }

      console.log('[PlaudScraper] Could not find download button or audio URL');
      await this.page.screenshot({ path: `/tmp/plaud-recording-${recording.id}.png` });
      return null;
    } catch (e) {
      console.error(`[PlaudScraper] Error downloading ${recording.title}:`, e);
      return null;
    }
  }

  async sync(): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      downloaded: 0,
      skipped: 0,
      errors: [],
      recordings: [],
    };

    if (!this.isConfigured()) {
      result.errors.push('Plaud credentials not configured. Set PLAUD_EMAIL and PLAUD_PASSWORD in .env');
      return result;
    }

    try {
      await this.init();

      // Login
      const loggedIn = await this.login();
      if (!loggedIn) {
        result.errors.push('Login failed');
        return result;
      }

      // Get recordings
      const recordings = await this.getRecordings();
      console.log(`[PlaudScraper] Found ${recordings.length} recordings`);

      // Load state to check which recordings we've already downloaded
      const state = this.loadState();

      for (const recording of recordings) {
        if (state.downloadedIds.includes(recording.id)) {
          result.skipped++;
          continue;
        }

        const savedPath = await this.downloadRecording(recording);
        if (savedPath) {
          result.downloaded++;
          result.recordings.push(savedPath);
          state.downloadedIds.push(recording.id);
        } else {
          result.errors.push(`Failed to download: ${recording.title}`);
        }
      }

      // Save state
      state.lastSyncTime = new Date().toISOString();
      this.saveState(state);

      result.success = true;
    } catch (e) {
      result.errors.push(String(e));
    } finally {
      await this.close();
    }

    return result;
  }

  /**
   * Interactive mode - opens browser for manual login/exploration
   */
  async explore(): Promise<void> {
    console.log('[PlaudScraper] Opening browser for exploration...');

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(`${PLAUD_URL}/login`);

    console.log('[PlaudScraper] Browser opened. Please login manually and explore.');
    console.log('[PlaudScraper] Press Ctrl+C to close when done.');

    // Keep browser open
    await new Promise(() => {});
  }
}

export const plaudScraper = new PlaudScraper();

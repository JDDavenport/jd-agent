/**
 * Plaud Browser Sync Service
 *
 * Uses Playwright with persistent browser context to sync recordings.
 * Handles automatic login with stored credentials.
 */

import { chromium, BrowserContext, Page } from 'playwright';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { db } from '../db/client';
import { recordings } from '../db/schema';
import { eq } from 'drizzle-orm';

const USER_DATA_DIR = '/Users/jddavenport/Documents/PlaudSync/.plaud-browser';
const SYNC_PATH = '/Users/jddavenport/Documents/PlaudSync';
const STATE_PATH = join(SYNC_PATH, '.sync-state.json');
const STORAGE_PATH = join(SYNC_PATH, '.plaud-auth.json');

// Credentials from environment
const EMAIL = process.env.PLAUD_EMAIL || 'jddavenport46@gmail.com';
const PASSWORD = process.env.PLAUD_PASSWORD || 'Warcraft46!';

interface SyncState {
  lastSync: string;
  downloadedIds: string[];
}

interface SyncResult {
  success: boolean;
  synced: number;
  skipped: number;
  newRecordings: string[];
  errors: string[];
}

function loadState(): SyncState {
  try {
    if (existsSync(STATE_PATH)) {
      return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('[PlaudBrowserSync] Error loading state:', e);
  }
  return { lastSync: '', downloadedIds: [] };
}

function saveState(state: SyncState): void {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

class PlaudBrowserSync {
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private isRunning = false;

  isConfigured(): boolean {
    return !!(EMAIL && PASSWORD);
  }

  async sync(): Promise<SyncResult> {
    if (this.isRunning) {
      console.log('[PlaudBrowserSync] Sync already in progress, skipping');
      return { success: false, synced: 0, skipped: 0, newRecordings: [], errors: ['Sync already running'] };
    }

    this.isRunning = true;
    const result: SyncResult = { success: false, synced: 0, skipped: 0, newRecordings: [], errors: [] };

    try {
      console.log('[PlaudBrowserSync] Starting sync...');

      // Ensure sync directory exists
      if (!existsSync(SYNC_PATH)) {
        mkdirSync(SYNC_PATH, { recursive: true });
      }

      // Launch browser with persistent context
      this.context = await chromium.launchPersistentContext(USER_DATA_DIR, {
        headless: true, // Run headless for background sync
        viewport: { width: 1280, height: 800 },
      });

      this.page = this.context.pages()[0] || await this.context.newPage();

      // Navigate to Plaud
      console.log('[PlaudBrowserSync] Navigating to Plaud...');
      await this.page.goto('https://web.plaud.ai/');
      await this.page.waitForLoadState('networkidle');
      await this.page.waitForTimeout(2000);

      const url = this.page.url();

      // Handle login if needed
      if (url.includes('/login')) {
        console.log('[PlaudBrowserSync] Session expired, logging in...');
        const loggedIn = await this.login();
        if (!loggedIn) {
          result.errors.push('Login failed');
          return result;
        }
      }

      // Get auth token
      const token = await this.page.evaluate(() => localStorage.getItem('tokenstr'));
      if (!token) {
        result.errors.push('No auth token found');
        return result;
      }

      // Save session for future use
      await this.context.storageState({ path: STORAGE_PATH });

      // Fetch recordings
      console.log('[PlaudBrowserSync] Fetching recordings...');
      const filesResult = await this.page.evaluate(async (authToken) => {
        const response = await fetch('https://api.plaud.ai/file/simple/web?skip=0&limit=100&is_trash=2&sort_by=start_time&is_desc=true', {
          headers: { 'Authorization': authToken || '' }
        });
        return response.json();
      }, token);

      const files = filesResult.data_file_list || [];
      console.log(`[PlaudBrowserSync] Found ${files.length} recordings`);

      const state = loadState();

      for (const file of files) {
        const id = file.id;
        const title = file.filename || 'Untitled';
        const duration = Math.round((file.duration || 0) / 60000);
        const date = new Date(file.start_time).toISOString().split('T')[0];
        const shortId = id.slice(0, 8);

        if (state.downloadedIds.includes(id)) {
          result.skipped++;
          continue;
        }

        console.log(`[PlaudBrowserSync] Syncing: ${title} (${duration}min)`);

        // Create file directory
        const safeTitle = title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_').slice(0, 50);
        const dirName = `${date}_${safeTitle}_${shortId}`;
        const dirPath = join(SYNC_PATH, dirName);

        if (!existsSync(dirPath)) {
          mkdirSync(dirPath, { recursive: true });
        }

        // Save metadata
        writeFileSync(join(dirPath, 'metadata.json'), JSON.stringify({
          id: file.id,
          title: file.filename,
          duration: file.duration,
          startTime: file.start_time,
          endTime: file.end_time,
          detail: file
        }, null, 2));

        // Check if recording already exists in database
        const existing = await db.select().from(recordings)
          .where(eq(recordings.originalFilename, title))
          .limit(1);

        if (existing.length === 0) {
          // Create database entry
          const durationSeconds = file.duration ? Math.round(file.duration / 1000) : null;
          const recordedAt = file.start_time ? new Date(file.start_time) : new Date();

          await db.insert(recordings).values({
            filePath: dirPath,
            originalFilename: title,
            durationSeconds,
            fileSizeBytes: file.filesize || null,
            recordingType: 'conversation',
            context: `Plaud recording: ${title}`,
            status: 'pending',
            recordedAt,
            uploadedAt: new Date(),
          });
          console.log(`[PlaudBrowserSync] Created DB entry for: ${title}`);
        }

        state.downloadedIds.push(id);
        result.synced++;
        result.newRecordings.push(title);
      }

      // Save state
      state.lastSync = new Date().toISOString();
      saveState(state);

      result.success = true;
      console.log(`[PlaudBrowserSync] Sync complete: ${result.synced} synced, ${result.skipped} skipped`);

    } catch (error) {
      console.error('[PlaudBrowserSync] Sync error:', error);
      result.errors.push(String(error));
    } finally {
      await this.close();
      this.isRunning = false;
    }

    return result;
  }

  private async login(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Enter email
      const emailInput = this.page.locator('input[placeholder="Email address"]');
      await emailInput.click();
      await this.page.waitForTimeout(300);
      await emailInput.fill(EMAIL);

      // Enter password
      const passwordInput = this.page.locator('input[placeholder="Password"]');
      await passwordInput.click();
      await this.page.waitForTimeout(300);
      await passwordInput.fill(PASSWORD);

      // Submit form
      await this.page.keyboard.press('Enter');

      // Wait for login to complete
      await this.page.waitForURL(u => !u.toString().includes('/login'), { timeout: 30000 });
      console.log('[PlaudBrowserSync] Login successful');
      return true;

    } catch (error) {
      console.error('[PlaudBrowserSync] Login failed:', error);
      return false;
    }
  }

  private async close(): Promise<void> {
    if (this.context) {
      try {
        await this.context.close();
      } catch (e) {
        // Ignore close errors
      }
      this.context = null;
      this.page = null;
    }
  }
}

export const plaudBrowserSync = new PlaudBrowserSync();

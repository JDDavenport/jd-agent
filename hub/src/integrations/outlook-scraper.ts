/**
 * JD Agent - Outlook.com Email Scraper
 *
 * Playwright-based scraper for Outlook.com personal email accounts.
 * Uses session persistence to avoid repeated logins.
 *
 * Usage:
 * 1. First time: Run `bun run outlook-login` to authenticate manually
 * 2. Scheduler will then poll for new emails using saved session
 */

import type { Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// Lazy-load playwright
let playwrightModule: typeof import('playwright') | null = null;

async function getPlaywright() {
  if (!playwrightModule) {
    console.log('[OutlookScraper] Loading playwright module...');
    playwrightModule = await import('playwright');
    console.log('[OutlookScraper] Playwright module loaded');
  }
  return playwrightModule;
}

// ============================================
// Types
// ============================================

export interface OutlookScraperConfig {
  headless?: boolean;
  sessionDir?: string;
  email?: string;
  pollIntervalMinutes?: number;
}

export interface OutlookEmail {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  preview: string;
  receivedAt: Date;
  isUnread: boolean;
  hasAttachments: boolean;
  conversationId?: string;
}

export interface OutlookEmailFull extends OutlookEmail {
  body: string;
  to: string;
}

interface SessionInfo {
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
  email?: string;
}

// ============================================
// Constants
// ============================================

const DEFAULT_DATA_DIR =
  process.env.OUTLOOK_SESSION_DIR || '/tmp/jd-agent-outlook';
const SESSION_FILE = 'outlook-session.json';
const OUTLOOK_URL = 'https://outlook.live.com/mail/0/';
const OUTLOOK_LOGIN_URL = 'https://login.live.com/';

// ============================================
// Outlook Scraper
// ============================================

export class OutlookScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: Required<OutlookScraperConfig>;
  private isInitialized = false;
  private lastProcessedId: string | null = null;

  constructor(config: OutlookScraperConfig = {}) {
    this.config = {
      headless: config.headless ?? (process.env.OUTLOOK_HEADLESS !== 'false'),
      sessionDir: config.sessionDir ?? DEFAULT_DATA_DIR,
      email: config.email ?? process.env.OUTLOOK_EMAIL ?? '',
      pollIntervalMinutes: config.pollIntervalMinutes ?? 10,
    };

    // Ensure directory exists
    if (!fs.existsSync(this.config.sessionDir)) {
      fs.mkdirSync(this.config.sessionDir, { recursive: true });
    }

    if (this.config.email) {
      console.log(`[OutlookScraper] Configured for: ${this.config.email}`);
    } else {
      console.log('[OutlookScraper] Not configured - set OUTLOOK_EMAIL');
    }
  }

  /**
   * Check if scraper is configured
   */
  isConfigured(): boolean {
    return !!this.config.email;
  }

  /**
   * Initialize browser
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log('[OutlookScraper] Initializing browser...');

    const { chromium } = await getPlaywright();
    this.browser = await chromium.launch({
      headless: this.config.headless,
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-US',
    });

    this.page = await this.context.newPage();
    this.isInitialized = true;

    console.log('[OutlookScraper] Browser initialized');
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      this.isInitialized = false;
      console.log('[OutlookScraper] Browser closed');
    }
  }

  // ----------------------------------------
  // Session Management
  // ----------------------------------------

  private get sessionPath(): string {
    return path.join(this.config.sessionDir, SESSION_FILE);
  }

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
      email: this.config.email,
    };

    fs.writeFileSync(this.sessionPath, JSON.stringify(sessionInfo, null, 2));
    console.log('[OutlookScraper] Session saved');
  }

  async restoreSession(): Promise<boolean> {
    if (!fs.existsSync(this.sessionPath)) {
      console.log('[OutlookScraper] No saved session found');
      return false;
    }

    try {
      const sessionData = fs.readFileSync(this.sessionPath, 'utf-8');
      const sessionInfo: SessionInfo = JSON.parse(sessionData);

      // Check if session is too old (7 days)
      const savedAt = new Date(sessionInfo.savedAt);
      const daysSinceSave =
        (Date.now() - savedAt.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSinceSave > 7) {
        console.log('[OutlookScraper] Session expired (>7 days)');
        return false;
      }

      if (!this.context) {
        await this.initialize();
      }

      await this.context!.addCookies(sessionInfo.cookies);
      console.log('[OutlookScraper] Session restored');
      return true;
    } catch (error) {
      console.error('[OutlookScraper] Failed to restore session:', error);
      return false;
    }
  }

  async isSessionValid(): Promise<boolean> {
    if (!this.page) return false;

    try {
      await this.page.goto(OUTLOOK_URL, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      // Wait a moment for redirects
      await this.page.waitForTimeout(2000);

      const currentUrl = this.page.url();

      // Check if redirected to login
      if (
        currentUrl.includes('login.live.com') ||
        currentUrl.includes('login.microsoftonline.com')
      ) {
        console.log('[OutlookScraper] Session invalid - redirected to login');
        return false;
      }

      // Check for inbox elements
      const inboxElement = await this.page.$(
        '[data-folder-name="inbox"], [aria-label="Inbox"], .jGG6V'
      );
      if (inboxElement) {
        console.log('[OutlookScraper] Session valid - inbox detected');
        return true;
      }

      console.log('[OutlookScraper] Session status unclear');
      return false;
    } catch (error) {
      console.error('[OutlookScraper] Session check failed:', error);
      return false;
    }
  }

  // ----------------------------------------
  // Login
  // ----------------------------------------

  /**
   * Interactive login - run in non-headless mode for user to authenticate
   */
  async login(waitForManual: boolean = true): Promise<boolean> {
    if (!this.page) {
      await this.initialize();
    }

    console.log('[OutlookScraper] Starting login flow...');

    try {
      // Navigate to login page
      await this.page!.goto(OUTLOOK_LOGIN_URL, { waitUntil: 'networkidle' });

      if (waitForManual) {
        console.log('[OutlookScraper] Please complete login manually...');
        console.log('[OutlookScraper] The browser will wait until you reach the inbox.');

        // Wait for navigation to Outlook inbox (up to 5 minutes)
        await this.page!.waitForURL('**/mail/**', { timeout: 300000 });

        // Give time for page to fully load
        await this.page!.waitForTimeout(3000);

        // Save session
        await this.saveSession();

        console.log('[OutlookScraper] Login successful, session saved!');
        return true;
      }

      return false;
    } catch (error) {
      console.error('[OutlookScraper] Login failed:', error);
      return false;
    }
  }

  // ----------------------------------------
  // Email Fetching
  // ----------------------------------------

  /**
   * Get unread emails from inbox
   */
  async getUnreadEmails(limit: number = 20): Promise<OutlookEmail[]> {
    if (!this.page) {
      const restored = await this.restoreSession();
      if (!restored) {
        throw new Error('No valid session - run outlook-login first');
      }
    }

    // Ensure we're on the inbox
    const isValid = await this.isSessionValid();
    if (!isValid) {
      throw new Error('Session expired - run outlook-login to re-authenticate');
    }

    const emails: OutlookEmail[] = [];

    try {
      // Wait for email list to load
      await this.page!.waitForSelector('[role="listbox"], .jGG6V', {
        timeout: 15000,
      });

      // Get email items - Outlook uses various selectors
      const emailItems = await this.page!.$$(
        '[data-convid], [aria-label*="mail"], .hcptT'
      );

      console.log(`[OutlookScraper] Found ${emailItems.length} email items`);

      for (const item of emailItems.slice(0, limit)) {
        try {
          const email = await this.parseEmailItem(item);
          if (email) {
            emails.push(email);
          }
        } catch (parseError) {
          console.error('[OutlookScraper] Failed to parse email item:', parseError);
        }
      }

      // Filter to unread only
      const unread = emails.filter((e) => e.isUnread);
      console.log(`[OutlookScraper] ${unread.length} unread emails`);

      return unread;
    } catch (error) {
      console.error('[OutlookScraper] Failed to get emails:', error);
      throw error;
    }
  }

  /**
   * Parse a single email item from the list
   */
  private async parseEmailItem(item: any): Promise<OutlookEmail | null> {
    try {
      // Get conversation ID
      const convId =
        (await item.getAttribute('data-convid')) ||
        (await item.getAttribute('id')) ||
        `outlook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Check if unread - look for unread indicator
      const isUnread = !!(await item.$('[data-icon-name="Read"], .unread, [aria-label*="Unread"]'));

      // Get sender
      const senderEl = await item.$('.OZZZK, [data-testid="AvatarGroup"], .hpOpW');
      const from = senderEl ? await senderEl.textContent() : 'Unknown';

      // Get subject
      const subjectEl = await item.$('.hcptT, .lvHighlightSubjectClass, [data-testid="subject"]');
      const subject = subjectEl
        ? (await subjectEl.textContent()) || '(no subject)'
        : '(no subject)';

      // Get preview
      const previewEl = await item.$('.HVFZx, .lvHighlightBodyClass, [data-testid="preview"]');
      const preview = previewEl ? (await previewEl.textContent()) || '' : '';

      // Check for attachments
      const hasAttachments = !!(await item.$('[data-icon-name="Attach"], .attachmentIcon'));

      // Try to get time - this is tricky in Outlook's UI
      const timeEl = await item.$('.dw6E4, [data-testid="timestamp"]');
      const timeText = timeEl ? await timeEl.textContent() : '';
      const receivedAt = this.parseRelativeTime(timeText || '');

      return {
        id: convId,
        from: from?.trim() || 'Unknown',
        fromEmail: '', // Not easily available from list view
        subject: subject.trim(),
        preview: preview.trim(),
        receivedAt,
        isUnread,
        hasAttachments,
        conversationId: convId,
      };
    } catch (error) {
      console.error('[OutlookScraper] Error parsing email item:', error);
      return null;
    }
  }

  /**
   * Parse relative time strings like "3:45 PM", "Yesterday", "Mon 1/20"
   */
  private parseRelativeTime(timeText: string): Date {
    const now = new Date();
    const text = timeText.trim().toLowerCase();

    // If it's a time like "3:45 PM", it's today
    if (text.match(/^\d{1,2}:\d{2}\s*(am|pm)?$/i)) {
      const [time, period] = text.split(/\s+/);
      const [hours, minutes] = time.split(':').map(Number);
      let hour = hours;
      if (period?.toLowerCase() === 'pm' && hour !== 12) hour += 12;
      if (period?.toLowerCase() === 'am' && hour === 12) hour = 0;
      now.setHours(hour, minutes, 0, 0);
      return now;
    }

    // Yesterday
    if (text.includes('yesterday')) {
      now.setDate(now.getDate() - 1);
      return now;
    }

    // Day of week (Mon, Tue, etc.)
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    for (let i = 0; i < days.length; i++) {
      if (text.startsWith(days[i])) {
        const currentDay = now.getDay();
        const daysAgo = (currentDay - i + 7) % 7 || 7;
        now.setDate(now.getDate() - daysAgo);
        return now;
      }
    }

    // Default to now if parsing fails
    return now;
  }

  /**
   * Get full email content by clicking on it
   */
  async getEmailContent(emailId: string): Promise<OutlookEmailFull | null> {
    if (!this.page) return null;

    try {
      // Click on the email item
      const item = await this.page.$(`[data-convid="${emailId}"]`);
      if (!item) {
        console.log(`[OutlookScraper] Email ${emailId} not found`);
        return null;
      }

      await item.click();
      await this.page.waitForTimeout(1500);

      // Wait for reading pane to load
      await this.page.waitForSelector('.allowTextSelection, .ReadingPaneContent', {
        timeout: 10000,
      });

      // Get body content
      const bodyEl = await this.page.$('.allowTextSelection, [role="document"]');
      const body = bodyEl ? await bodyEl.textContent() : '';

      // Get full from/to info
      const fromEl = await this.page.$('.OZZZK, [data-testid="MessageHeaderFrom"]');
      const toEl = await this.page.$('[data-testid="MessageHeaderTo"]');

      const from = fromEl ? await fromEl.textContent() : 'Unknown';
      const to = toEl ? await toEl.textContent() : '';

      // Get subject
      const subjectEl = await this.page.$('.allowTextSelection h2, [role="heading"]');
      const subject = subjectEl ? await subjectEl.textContent() : '(no subject)';

      return {
        id: emailId,
        from: from?.trim() || 'Unknown',
        fromEmail: this.extractEmail(from || ''),
        subject: subject?.trim() || '(no subject)',
        preview: (body || '').substring(0, 200),
        body: body?.trim() || '',
        to: to?.trim() || '',
        receivedAt: new Date(),
        isUnread: false, // Reading it marks as read
        hasAttachments: false,
        conversationId: emailId,
      };
    } catch (error) {
      console.error('[OutlookScraper] Failed to get email content:', error);
      return null;
    }
  }

  /**
   * Extract email address from a string like "John Doe <john@example.com>"
   */
  private extractEmail(text: string): string {
    const match = text.match(/<([^>]+)>/);
    return match ? match[1] : text;
  }

  /**
   * Get new emails since last check
   */
  async getNewEmails(): Promise<OutlookEmail[]> {
    const emails = await this.getUnreadEmails(50);

    if (!this.lastProcessedId) {
      // First run - just save the latest ID
      if (emails.length > 0) {
        this.lastProcessedId = emails[0].id;
      }
      return emails;
    }

    // Find new emails (those before our last processed ID)
    const newEmails: OutlookEmail[] = [];
    for (const email of emails) {
      if (email.id === this.lastProcessedId) {
        break;
      }
      newEmails.push(email);
    }

    // Update last processed ID
    if (emails.length > 0) {
      this.lastProcessedId = emails[0].id;
    }

    return newEmails;
  }

  /**
   * Get scraper status for system health
   */
  async getStatus(): Promise<{
    enabled: boolean;
    sessionValid: boolean;
    lastCheck: Date | null;
    email: string;
    error?: string;
  }> {
    const enabled = this.isConfigured();
    let sessionValid = false;
    let error: string | undefined;

    if (enabled) {
      try {
        await this.restoreSession();
        sessionValid = await this.isSessionValid();
      } catch (e) {
        error = String(e);
      }
    }

    return {
      enabled,
      sessionValid,
      lastCheck: new Date(),
      email: this.config.email,
      error,
    };
  }
}

// Export singleton instance
export const outlookScraper = new OutlookScraper();

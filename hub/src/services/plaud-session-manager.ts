/**
 * Plaud Session Manager
 *
 * Handles Plaud authentication with:
 * - Session health checks
 * - Auto-refresh before expiration
 * - Persistent storage in database
 * - Browser-based login flow
 */

import { chromium, BrowserContext, Page } from 'playwright';
import { existsSync, mkdirSync, writeFileSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

// ============================================
// Types
// ============================================

interface PlaudSession {
  token: string;
  userId?: string;
  email?: string;
  createdAt: string;
  lastValidated: string;
  expiresAt?: string;
}

interface SessionState {
  session: PlaudSession | null;
  browserStoragePath: string;
  lastLoginAttempt: string | null;
  loginFailures: number;
}

// ============================================
// Constants
// ============================================

const SYNC_PATH = process.env.PLAUD_SYNC_PATH || '/Users/jddavenport/Documents/PlaudSync';
const SESSION_STATE_PATH = join(SYNC_PATH, '.plaud-session-state.json');
const BROWSER_STORAGE_PATH = join(SYNC_PATH, '.plaud-auth.json');
const SESSION_MAX_AGE_HOURS = 24; // Consider session stale after 24h
const TOKEN_CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// ============================================
// State Management
// ============================================

function loadSessionState(): SessionState {
  try {
    if (existsSync(SESSION_STATE_PATH)) {
      return JSON.parse(readFileSync(SESSION_STATE_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('[PlaudSession] Error loading state:', e);
  }
  return {
    session: null,
    browserStoragePath: BROWSER_STORAGE_PATH,
    lastLoginAttempt: null,
    loginFailures: 0,
  };
}

function saveSessionState(state: SessionState): void {
  if (!existsSync(SYNC_PATH)) {
    mkdirSync(SYNC_PATH, { recursive: true });
  }
  writeFileSync(SESSION_STATE_PATH, JSON.stringify(state, null, 2));
}

// ============================================
// Plaud Session Manager
// ============================================

export class PlaudSessionManager {
  private state: SessionState;
  private healthCheckTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.state = loadSessionState();
  }

  // ============================================
  // Session Status
  // ============================================

  /**
   * Check if we have a session
   */
  hasSession(): boolean {
    return existsSync(BROWSER_STORAGE_PATH);
  }

  /**
   * Get session age in hours
   */
  getSessionAgeHours(): number | null {
    if (!this.state.session?.createdAt) {
      // Try to get from file modification time
      if (existsSync(BROWSER_STORAGE_PATH)) {
        const stat = statSync(BROWSER_STORAGE_PATH);
        const ageMs = Date.now() - stat.mtime.getTime();
        return ageMs / (1000 * 60 * 60);
      }
      return null;
    }
    const ageMs = Date.now() - new Date(this.state.session.createdAt).getTime();
    return ageMs / (1000 * 60 * 60);
  }

  /**
   * Check if session is likely stale (needs refresh)
   */
  isSessionStale(): boolean {
    const ageHours = this.getSessionAgeHours();
    if (ageHours === null) return true;
    return ageHours > SESSION_MAX_AGE_HOURS;
  }

  /**
   * Get session status
   */
  getStatus(): {
    hasSession: boolean;
    sessionAgeHours: number | null;
    isStale: boolean;
    lastValidated: string | null;
    lastLoginAttempt: string | null;
    loginFailures: number;
  } {
    return {
      hasSession: this.hasSession(),
      sessionAgeHours: this.getSessionAgeHours(),
      isStale: this.isSessionStale(),
      lastValidated: this.state.session?.lastValidated || null,
      lastLoginAttempt: this.state.lastLoginAttempt,
      loginFailures: this.state.loginFailures,
    };
  }

  // ============================================
  // Session Validation
  // ============================================

  /**
   * Validate session by making an API call
   */
  async validateSession(): Promise<boolean> {
    if (!this.hasSession()) {
      return false;
    }

    console.log('[PlaudSession] Validating session...');

    const browser = await chromium.launch({ headless: true });

    try {
      const context = await browser.newContext({
        storageState: BROWSER_STORAGE_PATH,
      });

      const page = await context.newPage();
      await page.goto('https://web.plaud.ai/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Try to get auth token
      const token = await page.evaluate(() => localStorage.getItem('tokenstr'));

      if (!token) {
        console.log('[PlaudSession] No auth token found - session invalid');
        return false;
      }

      // Try to make an API call
      const testResult = await page.evaluate(async (authToken) => {
        try {
          const response = await fetch(
            'https://api.plaud.ai/file/simple/web?skip=0&limit=1&is_trash=2',
            {
              headers: { Authorization: authToken },
            }
          );
          return { ok: response.ok, status: response.status };
        } catch (e) {
          return { ok: false, error: String(e) };
        }
      }, token);

      if (testResult.ok) {
        console.log('[PlaudSession] Session valid');

        // Update state
        this.state.session = {
          token,
          createdAt: this.state.session?.createdAt || new Date().toISOString(),
          lastValidated: new Date().toISOString(),
        };
        this.state.loginFailures = 0;
        saveSessionState(this.state);

        return true;
      } else {
        console.log(`[PlaudSession] Session invalid: ${testResult.status || testResult.error}`);
        return false;
      }
    } catch (error) {
      console.error('[PlaudSession] Validation error:', error);
      return false;
    } finally {
      await browser.close();
    }
  }

  // ============================================
  // Login Flow
  // ============================================

  /**
   * Run interactive login flow
   * Opens browser for user to log in manually
   */
  async login(options?: { headless?: boolean; timeout?: number }): Promise<boolean> {
    const { headless = false, timeout = 120000 } = options || {};

    console.log('[PlaudSession] Starting login flow...');
    this.state.lastLoginAttempt = new Date().toISOString();
    saveSessionState(this.state);

    const browser = await chromium.launch({
      headless,
      slowMo: headless ? 0 : 100, // Slow down for visibility when not headless
    });

    try {
      const context = await browser.newContext();
      const page = await context.newPage();

      // Navigate to Plaud login
      await page.goto('https://web.plaud.ai/');
      await page.waitForLoadState('networkidle');

      console.log('[PlaudSession] Waiting for login...');
      console.log('[PlaudSession] Please log in with your Plaud account.');

      // Wait for successful login (token appears in localStorage)
      const startTime = Date.now();
      let token: string | null = null;

      while (Date.now() - startTime < timeout) {
        await page.waitForTimeout(2000);

        token = await page.evaluate(() => localStorage.getItem('tokenstr'));
        if (token) {
          console.log('[PlaudSession] Login successful!');
          break;
        }

        // Check if we're on the dashboard (another indicator of success)
        const url = page.url();
        if (url.includes('/dashboard') || url.includes('/notes')) {
          token = await page.evaluate(() => localStorage.getItem('tokenstr'));
          if (token) {
            console.log('[PlaudSession] Login successful (detected dashboard)!');
            break;
          }
        }
      }

      if (!token) {
        console.error('[PlaudSession] Login timed out');
        this.state.loginFailures++;
        saveSessionState(this.state);
        return false;
      }

      // Save browser storage state
      await context.storageState({ path: BROWSER_STORAGE_PATH });

      // Update session state
      this.state.session = {
        token,
        createdAt: new Date().toISOString(),
        lastValidated: new Date().toISOString(),
      };
      this.state.loginFailures = 0;
      saveSessionState(this.state);

      console.log('[PlaudSession] Session saved successfully');
      return true;
    } catch (error) {
      console.error('[PlaudSession] Login error:', error);
      this.state.loginFailures++;
      saveSessionState(this.state);
      return false;
    } finally {
      await browser.close();
    }
  }

  /**
   * Automated login using stored credentials (email/password)
   * Less reliable than manual login due to potential captchas/2FA
   */
  async automatedLogin(email: string, password: string): Promise<boolean> {
    console.log('[PlaudSession] Attempting automated login...');
    this.state.lastLoginAttempt = new Date().toISOString();
    saveSessionState(this.state);

    const browser = await chromium.launch({ headless: true });

    try {
      const context = await browser.newContext();
      const page = await context.newPage();

      // Navigate to Plaud
      await page.goto('https://web.plaud.ai/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Look for login elements
      const hasLoginButton = await page.locator('text=Log in').count() > 0;
      const hasEmailField = await page.locator('input[type="email"]').count() > 0;

      if (hasLoginButton) {
        await page.click('text=Log in');
        await page.waitForTimeout(1000);
      }

      // Fill email
      const emailInput = page.locator('input[type="email"], input[name="email"]');
      if ((await emailInput.count()) > 0) {
        await emailInput.fill(email);
      }

      // Fill password
      const passwordInput = page.locator('input[type="password"], input[name="password"]');
      if ((await passwordInput.count()) > 0) {
        await passwordInput.fill(password);
      }

      // Submit
      const submitButton = page.locator('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in")');
      if ((await submitButton.count()) > 0) {
        await submitButton.click();
      }

      // Wait for login to complete
      await page.waitForTimeout(5000);

      // Check for token
      const token = await page.evaluate(() => localStorage.getItem('tokenstr'));

      if (token) {
        console.log('[PlaudSession] Automated login successful!');

        // Save browser storage state
        await context.storageState({ path: BROWSER_STORAGE_PATH });

        // Update session state
        this.state.session = {
          token,
          email,
          createdAt: new Date().toISOString(),
          lastValidated: new Date().toISOString(),
        };
        this.state.loginFailures = 0;
        saveSessionState(this.state);

        return true;
      } else {
        console.log('[PlaudSession] Automated login failed - no token received');
        console.log('[PlaudSession] This may be due to captcha, 2FA, or changed login flow');
        this.state.loginFailures++;
        saveSessionState(this.state);
        return false;
      }
    } catch (error) {
      console.error('[PlaudSession] Automated login error:', error);
      this.state.loginFailures++;
      saveSessionState(this.state);
      return false;
    } finally {
      await browser.close();
    }
  }

  // ============================================
  // Google OAuth Login
  // ============================================

  /**
   * Login using Google OAuth (Plaud supports this)
   * Requires manual interaction for Google auth
   */
  async googleLogin(): Promise<boolean> {
    console.log('[PlaudSession] Starting Google OAuth login...');
    console.log('[PlaudSession] A browser window will open. Please sign in with Google.');

    return this.login({ headless: false, timeout: 180000 }); // 3 min timeout for Google auth
  }

  // ============================================
  // Health Check & Auto-Refresh
  // ============================================

  /**
   * Ensure session is valid, refresh if needed
   */
  async ensureValidSession(): Promise<boolean> {
    // Check if we have a session at all
    if (!this.hasSession()) {
      console.log('[PlaudSession] No session found');
      return false;
    }

    // Check if session is stale
    if (this.isSessionStale()) {
      console.log('[PlaudSession] Session is stale, validating...');
      const isValid = await this.validateSession();
      if (!isValid) {
        console.log('[PlaudSession] Session expired. Please run login.');
        return false;
      }
    }

    return true;
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks(intervalMs: number = TOKEN_CHECK_INTERVAL_MS): void {
    if (this.healthCheckTimer) {
      console.log('[PlaudSession] Health checks already running');
      return;
    }

    console.log(`[PlaudSession] Starting health checks every ${intervalMs / 60000} minutes`);

    this.healthCheckTimer = setInterval(async () => {
      try {
        const isValid = await this.ensureValidSession();
        if (!isValid) {
          console.log('[PlaudSession] ⚠️ Session invalid! Manual login required.');
          // Could trigger notification here
        }
      } catch (error) {
        console.error('[PlaudSession] Health check error:', error);
      }
    }, intervalMs);
  }

  /**
   * Stop periodic health checks
   */
  stopHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
      console.log('[PlaudSession] Health checks stopped');
    }
  }

  // ============================================
  // Clear Session
  // ============================================

  /**
   * Clear all session data
   */
  clearSession(): void {
    this.state.session = null;
    saveSessionState(this.state);

    // Don't delete browser storage file as it might be in use
    console.log('[PlaudSession] Session cleared');
  }
}

// ============================================
// Singleton Instance
// ============================================

export const plaudSessionManager = new PlaudSessionManager();

// ============================================
// CLI Runner
// ============================================

if (import.meta.main) {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  const manager = new PlaudSessionManager();

  switch (command) {
    case 'status':
      console.log('=== Plaud Session Status ===\n');
      console.log(JSON.stringify(manager.getStatus(), null, 2));
      break;

    case 'validate':
      manager.validateSession().then((valid) => {
        console.log(`\nSession valid: ${valid}`);
        process.exit(valid ? 0 : 1);
      });
      break;

    case 'login':
      console.log('Opening browser for manual login...');
      manager.login().then((success) => {
        console.log(`\nLogin ${success ? 'successful' : 'failed'}`);
        process.exit(success ? 0 : 1);
      });
      break;

    case 'google':
      console.log('Opening browser for Google OAuth login...');
      manager.googleLogin().then((success) => {
        console.log(`\nLogin ${success ? 'successful' : 'failed'}`);
        process.exit(success ? 0 : 1);
      });
      break;

    case 'auto':
      const email = process.env.PLAUD_EMAIL;
      const password = process.env.PLAUD_PASSWORD;
      if (!email || !password) {
        console.error('Set PLAUD_EMAIL and PLAUD_PASSWORD environment variables');
        process.exit(1);
      }
      manager.automatedLogin(email, password).then((success) => {
        console.log(`\nLogin ${success ? 'successful' : 'failed'}`);
        process.exit(success ? 0 : 1);
      });
      break;

    case 'clear':
      manager.clearSession();
      console.log('Session cleared');
      break;

    default:
      console.log(`
Plaud Session Manager CLI

Usage: bun run src/services/plaud-session-manager.ts <command>

Commands:
  status    Show session status
  validate  Validate current session
  login     Interactive browser login
  google    Google OAuth login
  auto      Automated login (requires PLAUD_EMAIL/PLAUD_PASSWORD)
  clear     Clear session data
`);
  }
}

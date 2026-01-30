/**
 * JD Agent - WHOOP Auto-Authorization Service
 *
 * Uses Playwright to automate WHOOP login when OAuth refresh tokens expire.
 * This runs automatically when the normal OAuth refresh fails.
 *
 * Flow:
 * 1. Detect when refresh token has expired (API returns 401)
 * 2. Launch headless browser
 * 3. Navigate to WHOOP OAuth authorization URL
 * 4. Auto-fill login credentials
 * 5. Complete OAuth flow and capture new tokens
 * 6. Save tokens to database
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { db } from '../db/client';
import { integrationCredentials } from '../db/schema';
import { eq } from 'drizzle-orm';
import { whoopIntegration } from '../integrations/whoop';

const STATE_FILE = join(process.env.HOME || '/tmp', '.jd-agent', 'whoop-auth-state.json');
const STATE_DIR = join(process.env.HOME || '/tmp', '.jd-agent');

interface AuthState {
  lastAuthTime: string;
  cookies?: any[];
  authAttempts: number;
  lastError?: string;
}

interface AuthResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  error?: string;
}

export class WhoopAutoAuth {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private _email: string | null = null;
  private _password: string | null = null;
  private _clientId: string | null = null;
  private _clientSecret: string | null = null;
  private _redirectUri: string | null = null;
  private _initialized = false;
  private baseUrl = 'https://api.prod.whoop.com';

  constructor() {
    // Ensure state directory exists
    if (!existsSync(STATE_DIR)) {
      mkdirSync(STATE_DIR, { recursive: true });
    }
  }

  // Lazy-load credentials to ensure .env is loaded first
  private initCredentials(): void {
    if (!this._initialized) {
      this._email = process.env.WHOOP_EMAIL || null;
      this._password = process.env.WHOOP_PASSWORD || null;
      this._clientId = process.env.WHOOP_CLIENT_ID || null;
      this._clientSecret = process.env.WHOOP_CLIENT_SECRET || null;
      this._redirectUri = process.env.WHOOP_REDIRECT_URI || 'http://localhost:3000/api/whoop/callback';
      this._initialized = true;
    }
  }

  private get email(): string | null {
    this.initCredentials();
    return this._email;
  }

  private get password(): string | null {
    this.initCredentials();
    return this._password;
  }

  private get clientId(): string | null {
    this.initCredentials();
    return this._clientId;
  }

  private get clientSecret(): string | null {
    this.initCredentials();
    return this._clientSecret;
  }

  private get redirectUri(): string {
    this.initCredentials();
    return this._redirectUri || 'http://localhost:3000/api/whoop/callback';
  }

  isConfigured(): boolean {
    return !!(this.email && this.password && this.clientId && this.clientSecret);
  }

  private loadState(): AuthState {
    try {
      if (existsSync(STATE_FILE)) {
        return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
      }
    } catch (e) {
      console.error('[WhoopAutoAuth] Error loading state:', e);
    }
    return { lastAuthTime: '', authAttempts: 0 };
  }

  private saveState(state: AuthState): void {
    try {
      writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    } catch (e) {
      console.error('[WhoopAutoAuth] Error saving state:', e);
    }
  }

  async init(): Promise<void> {
    if (this.browser) return;

    console.log('[WhoopAutoAuth] Launching browser...');
    this.browser = await chromium.launch({
      headless: true, // Set to false for debugging
    });

    // Try to restore cookies from previous session
    const state = this.loadState();
    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    if (state.cookies && state.cookies.length > 0) {
      try {
        await this.context.addCookies(state.cookies);
      } catch (e) {
        console.log('[WhoopAutoAuth] Could not restore cookies, starting fresh');
      }
    }

    this.page = await this.context.newPage();
  }

  async close(): Promise<void> {
    if (this.context) {
      // Save cookies for next session
      try {
        const cookies = await this.context.cookies();
        const state = this.loadState();
        state.cookies = cookies;
        this.saveState(state);
      } catch (e) {
        // Ignore cookie save errors on close
      }
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }

  /**
   * Get the OAuth authorization URL
   */
  private getAuthorizationUrl(): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId!,
      redirect_uri: this.redirectUri,
      scope: 'read:recovery read:cycles read:workout read:sleep read:profile offline',
      state: 'auto_auth_' + Date.now(),
    });

    return `${this.baseUrl}/oauth/oauth2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCodeForTokens(code: string): Promise<AuthResult> {
    try {
      const response = await fetch(`${this.baseUrl}/oauth/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.redirectUri,
          client_id: this.clientId!,
          client_secret: this.clientSecret!,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Token exchange failed: ${error}` };
      }

      const data = await response.json() as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
      };

      return {
        success: true,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      };
    } catch (error) {
      return { success: false, error: `Token exchange error: ${error}` };
    }
  }

  /**
   * Save tokens to database
   */
  private async saveTokens(result: AuthResult): Promise<void> {
    try {
      await db
        .insert(integrationCredentials)
        .values({
          integration: 'whoop',
          accessToken: result.accessToken!,
          refreshToken: result.refreshToken!,
          tokenType: 'Bearer',
          expiresAt: result.expiresAt!,
          scope: 'read:recovery read:cycles read:workout read:sleep read:profile offline',
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: integrationCredentials.integration,
          set: {
            accessToken: result.accessToken!,
            refreshToken: result.refreshToken!,
            expiresAt: result.expiresAt!,
            updatedAt: new Date(),
          },
        });
      console.log('[WhoopAutoAuth] Tokens saved to database');
    } catch (error) {
      console.error('[WhoopAutoAuth] Failed to save tokens:', error);
      throw error;
    }
  }

  /**
   * Perform automated authentication
   */
  async authenticate(): Promise<AuthResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'WHOOP auto-auth not configured. Set WHOOP_EMAIL, WHOOP_PASSWORD, WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET in .env',
      };
    }

    const state = this.loadState();
    state.authAttempts++;
    this.saveState(state);

    try {
      await this.init();

      if (!this.page) {
        return { success: false, error: 'Failed to initialize browser' };
      }

      console.log('[WhoopAutoAuth] Starting OAuth flow...');

      // Set up request interception to capture the callback
      let authCode: string | null = null;
      let capturedError: string | null = null;

      // Listen for the redirect to capture the auth code (from both request and response)
      this.page.on('request', (request) => {
        const url = request.url();
        if (url.includes('/api/whoop/callback') || url.startsWith(this.redirectUri)) {
          const urlObj = new URL(url);
          const code = urlObj.searchParams.get('code');
          if (code && !authCode) {
            authCode = code;
            console.log('[WhoopAutoAuth] Captured auth code from request');
          }
          const error = urlObj.searchParams.get('error');
          if (error) {
            capturedError = error;
          }
        }
      });

      this.page.on('response', (response) => {
        const url = response.url();
        if (url.includes('/api/whoop/callback') || url.startsWith(this.redirectUri)) {
          const urlObj = new URL(url);
          const code = urlObj.searchParams.get('code');
          if (code && !authCode) {
            authCode = code;
            console.log('[WhoopAutoAuth] Captured auth code from response URL');
          }
        }
      });

      // Navigate to WHOOP OAuth page
      const authUrl = this.getAuthorizationUrl();
      console.log('[WhoopAutoAuth] Navigating to auth URL...');
      await this.page.goto(authUrl);
      await this.page.waitForLoadState('networkidle');

      // Take screenshot for debugging
      await this.page.screenshot({ path: '/tmp/whoop-auth-page.png' });

      // Check if we're on the login page
      const pageUrl = this.page.url();
      console.log('[WhoopAutoAuth] Current URL:', pageUrl);

      // Look for login form elements
      const emailInput = this.page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
      const passwordInput = this.page.locator('input[type="password"], input[name="password"]').first();

      if (await emailInput.isVisible({ timeout: 5000 })) {
        console.log('[WhoopAutoAuth] Login form detected, filling credentials...');

        // Fill email
        await emailInput.fill(this.email!);
        await this.page.waitForTimeout(500);

        // Fill password
        await passwordInput.fill(this.password!);
        await this.page.waitForTimeout(500);

        // Take screenshot before submitting
        await this.page.screenshot({ path: '/tmp/whoop-auth-filled.png' });

        // Find and click login/submit button
        const submitButton = this.page.locator('button[type="submit"], button:has-text("Log in"), button:has-text("Sign in"), button:has-text("Login")').first();

        if (await submitButton.isVisible()) {
          console.log('[WhoopAutoAuth] Clicking submit button...');
          await submitButton.click();
        } else {
          // Try pressing Enter
          await passwordInput.press('Enter');
        }

        // Wait for navigation after login
        await this.page.waitForTimeout(3000);
        await this.page.waitForLoadState('networkidle');

        await this.page.screenshot({ path: '/tmp/whoop-auth-after-login.png' });
      }

      // Check if we need to authorize the app (look for GRANT, Authorize, Allow, Accept buttons)
      const authorizeButton = this.page.locator('button:has-text("GRANT"), button:has-text("Grant"), button:has-text("Authorize"), button:has-text("Allow"), button:has-text("Accept")').first();
      if (await authorizeButton.isVisible({ timeout: 5000 })) {
        console.log('[WhoopAutoAuth] Authorization prompt detected, clicking authorize/grant...');
        await this.page.screenshot({ path: '/tmp/whoop-auth-before-grant.png' });
        await authorizeButton.click();
        console.log('[WhoopAutoAuth] Clicked authorize button, waiting for redirect...');
        await this.page.waitForTimeout(5000);
        await this.page.screenshot({ path: '/tmp/whoop-auth-after-grant.png' });
      }

      // Wait for redirect with auth code
      console.log('[WhoopAutoAuth] Waiting for redirect with auth code...');
      await this.page.waitForTimeout(8000);

      // Check if we captured the auth code
      if (capturedError) {
        return { success: false, error: `OAuth error: ${capturedError}` };
      }

      if (!authCode) {
        // Try to extract from current URL
        const currentUrl = this.page.url();
        console.log('[WhoopAutoAuth] Current URL after redirect:', currentUrl);

        if (currentUrl.includes('/api/whoop/callback') || currentUrl.includes('code=')) {
          const urlObj = new URL(currentUrl);
          authCode = urlObj.searchParams.get('code');
          if (authCode) {
            console.log('[WhoopAutoAuth] Captured auth code from final URL');
          }
        }
      }

      if (!authCode) {
        await this.page.screenshot({ path: '/tmp/whoop-auth-failed.png' });
        return { success: false, error: 'Failed to capture authorization code. Check /tmp/whoop-auth-*.png for screenshots.' };
      }

      console.log('[WhoopAutoAuth] Got authorization code, exchanging for tokens...');

      // Exchange code for tokens
      const result = await this.exchangeCodeForTokens(authCode);

      if (result.success) {
        // Save to database
        await this.saveTokens(result);

        // Reload tokens in the main WHOOP integration singleton
        await whoopIntegration.reloadTokens();

        // Update state
        state.lastAuthTime = new Date().toISOString();
        state.lastError = undefined;
        this.saveState(state);

        console.log('[WhoopAutoAuth] Authentication successful!');
      } else {
        state.lastError = result.error;
        this.saveState(state);
      }

      return result;
    } catch (error) {
      const errorMsg = `Authentication error: ${error}`;
      console.error('[WhoopAutoAuth]', errorMsg);

      const state = this.loadState();
      state.lastError = errorMsg;
      this.saveState(state);

      return { success: false, error: errorMsg };
    } finally {
      await this.close();
    }
  }

  /**
   * Check if re-authentication is needed
   */
  async needsReauth(): Promise<boolean> {
    try {
      const credentials = await db
        .select()
        .from(integrationCredentials)
        .where(eq(integrationCredentials.integration, 'whoop'))
        .limit(1);

      if (credentials.length === 0) {
        return true;
      }

      const cred = credentials[0];

      // No tokens
      if (!cred.accessToken || !cred.refreshToken) {
        return true;
      }

      // Token expired and no refresh token
      if (cred.expiresAt && cred.expiresAt < new Date()) {
        // Try refresh first before declaring need for reauth
        // This is handled by the main WHOOP integration
        return false;
      }

      return false;
    } catch (error) {
      console.error('[WhoopAutoAuth] Error checking auth status:', error);
      return true;
    }
  }

  /**
   * Get authentication status
   */
  async getStatus(): Promise<{
    configured: boolean;
    hasTokens: boolean;
    lastAuthTime: string | null;
    authAttempts: number;
    lastError: string | null;
  }> {
    const state = this.loadState();

    let hasTokens = false;
    try {
      const credentials = await db
        .select()
        .from(integrationCredentials)
        .where(eq(integrationCredentials.integration, 'whoop'))
        .limit(1);
      hasTokens = credentials.length > 0 && !!credentials[0].accessToken;
    } catch {
      // Ignore DB errors
    }

    return {
      configured: this.isConfigured(),
      hasTokens,
      lastAuthTime: state.lastAuthTime || null,
      authAttempts: state.authAttempts,
      lastError: state.lastError || null,
    };
  }

  /**
   * Interactive mode - opens browser for manual login/debugging
   */
  async explore(): Promise<void> {
    console.log('[WhoopAutoAuth] Opening browser for exploration...');

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    const authUrl = this.getAuthorizationUrl();
    await page.goto(authUrl);

    console.log('[WhoopAutoAuth] Browser opened. Please login manually and explore.');
    console.log('[WhoopAutoAuth] Auth URL:', authUrl);
    console.log('[WhoopAutoAuth] Press Ctrl+C to close when done.');

    // Keep browser open
    await new Promise(() => {});
  }
}

// Singleton instance
let whoopAutoAuthInstance: WhoopAutoAuth | null = null;

export function getWhoopAutoAuth(): WhoopAutoAuth {
  if (!whoopAutoAuthInstance) {
    whoopAutoAuthInstance = new WhoopAutoAuth();
  }
  return whoopAutoAuthInstance;
}

export const whoopAutoAuth = getWhoopAutoAuth();

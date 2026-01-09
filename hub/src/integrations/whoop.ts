/**
 * JD Agent - Whoop Integration
 *
 * Health and fitness data integration with Whoop API
 * - OAuth 2.0 authentication flow
 * - Recovery, strain, and sleep metrics
 * - Tokens persisted to database
 */

import { db } from '../db/client';
import { integrationCredentials } from '../db/schema';
import { eq } from 'drizzle-orm';
import { config } from '../lib/config';

// ============================================
// Types
// ============================================

interface WhoopTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

interface WhoopUser {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
}

interface WhoopCycle {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  score: {
    strain: number;
    kilojoule: number;
    average_heart_rate: number;
    max_heart_rate: number;
  };
  recovery?: {
    user_calibrating: boolean;
    recovery_score: number;
    resting_heart_rate: number;
    hrv_rmssd_milli: number;
  };
}

interface WhoopRecovery {
  cycle_id: number;
  sleep_id: number;
  user_id: number;
  created_at: string;
  score: {
    user_calibrating: boolean;
    recovery_score: number;
    resting_heart_rate: number;
    hrv_rmssd_milli: number;
  };
}

interface WhoopWorkout {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  sport_id: number;
  score: {
    strain: number;
    kilojoule: number;
    average_heart_rate: number;
    max_heart_rate: number;
  };
}

interface WhoopSleep {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  score: {
    stage_summary: {
      total_sleep_time_milli: number;
      total_awake_time_milli: number;
      total_no_data_time_milli: number;
      total_light_sleep_time_milli: number;
      total_slow_wave_sleep_time_milli: number;
      total_rem_sleep_time_milli: number;
    };
    sleep_needed: {
      baseline_milli: number;
      need_from_sleep_debt_milli: number;
      need_from_recent_strain_milli: number;
      need_from_recent_nap_milli: number;
    };
  };
}

// ============================================
// Whoop Integration Class
// ============================================

class WhoopIntegration {
  private clientId: string | null = null;
  private clientSecret: string | null = null;
  private redirectUri: string | null = null;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private baseUrl = 'https://api.prod.whoop.com';
  private initialized = false;

  constructor() {
    this.clientId = config.WHOOP_CLIENT_ID || null;
    this.clientSecret = config.WHOOP_CLIENT_SECRET || null;
    this.redirectUri = config.WHOOP_REDIRECT_URI || 'http://localhost:3000/api/whoop/callback';
  }

  /**
   * Initialize by loading tokens from database
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const credentials = await db
        .select()
        .from(integrationCredentials)
        .where(eq(integrationCredentials.integration, 'whoop'))
        .limit(1);

      if (credentials.length > 0) {
        const cred = credentials[0];
        this.accessToken = cred.accessToken;
        this.refreshToken = cred.refreshToken;
        this.tokenExpiresAt = cred.expiresAt;
        console.log('[Whoop] Loaded tokens from database');
      }
      this.initialized = true;
    } catch (error) {
      console.error('[Whoop] Failed to load tokens from database:', error);
      this.initialized = true;
    }
  }

  /**
   * Save tokens to database
   */
  private async saveTokens(): Promise<void> {
    try {
      await db
        .insert(integrationCredentials)
        .values({
          integration: 'whoop',
          accessToken: this.accessToken,
          refreshToken: this.refreshToken,
          tokenType: 'Bearer',
          expiresAt: this.tokenExpiresAt,
          scope: 'read:recovery read:workout read:sleep',
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: integrationCredentials.integration,
          set: {
            accessToken: this.accessToken,
            refreshToken: this.refreshToken,
            expiresAt: this.tokenExpiresAt,
            updatedAt: new Date(),
          },
        });
      console.log('[Whoop] Tokens saved to database');
    } catch (error) {
      console.error('[Whoop] Failed to save tokens to database:', error);
    }
  }

  /**
   * Check if Whoop is configured
   */
  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  /**
   * Check if Whoop is authorized (has valid tokens)
   */
  async isAuthorized(): Promise<boolean> {
    await this.initialize();
    return !!this.accessToken;
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthorizationUrl(state?: string): string {
    if (!this.clientId || !this.redirectUri) {
      throw new Error('Whoop integration not configured');
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'read:recovery read:cycles read:workout read:sleep read:profile',
      ...(state && { state }),
    });

    return `${this.baseUrl}/oauth/oauth2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<WhoopTokenResponse> {
    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      throw new Error('Whoop integration not configured');
    }

    const response = await fetch(`${this.baseUrl}/oauth/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Whoop token exchange failed: ${error}`);
    }

    const data: WhoopTokenResponse = await response.json();

    // Store tokens
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);

    // Persist to database
    await this.saveTokens();

    return data;
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(): Promise<string> {
    if (!this.clientId || !this.clientSecret || !this.refreshToken) {
      throw new Error('Whoop integration not configured or no refresh token');
    }

    const response = await fetch(`${this.baseUrl}/oauth/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      // If refresh fails, clear tokens
      this.accessToken = null;
      this.refreshToken = null;
      this.tokenExpiresAt = null;
      throw new Error(`Whoop token refresh failed: ${error}`);
    }

    const data: WhoopTokenResponse = await response.json();
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);

    // Persist to database
    await this.saveTokens();

    return data.access_token;
  }

  /**
   * Ensure we have a valid access token
   */
  private async ensureValidToken(): Promise<string> {
    await this.initialize();

    if (!this.accessToken) {
      throw new Error('No access token. Please authorize Whoop first.');
    }

    // Check if token is expired (refresh 5 minutes before expiry)
    if (this.tokenExpiresAt && this.tokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000) {
      console.log('[Whoop] Token expiring soon, refreshing...');
      return this.refreshAccessToken();
    }

    return this.accessToken;
  }

  /**
   * Make authenticated API request
   */
  private async apiRequest<T>(endpoint: string): Promise<T> {
    const token = await this.ensureValidToken();

    const url = `https://api.prod.whoop.com/developer/v2${endpoint}`;
    console.log(`[Whoop] API Request: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Whoop API request failed: HTTP ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get current user information
   */
  async getUser(): Promise<WhoopUser> {
    return this.apiRequest<WhoopUser>('/user/profile/basic');
  }

  /**
   * Get cycle data (includes recovery) for a date range
   */
  async getCycles(startDate: Date, endDate: Date): Promise<WhoopCycle[]> {
    const params = new URLSearchParams({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    });
    const response = await this.apiRequest<{ records: WhoopCycle[] }>(`/cycle?${params}`);
    return response.records || [];
  }

  /**
   * Get today's recovery score (using v2 recovery endpoint directly)
   */
  async getTodayRecovery(): Promise<WhoopRecovery | null> {
    try {
      // Get latest recovery directly from v2 endpoint
      const response = await this.apiRequest<{ records: any[] }>('/recovery?limit=1');

      if (!response.records || response.records.length === 0) {
        return null;
      }

      const recovery = response.records[0];

      // Convert v2 format to our WhoopRecovery format
      return {
        cycle_id: recovery.cycle_id,
        sleep_id: recovery.sleep_id || 0,
        user_id: recovery.user_id,
        created_at: recovery.created_at,
        score: {
          user_calibrating: recovery.score?.user_calibrating || false,
          recovery_score: recovery.score?.recovery_score || 0,
          resting_heart_rate: recovery.score?.resting_heart_rate || 0,
          hrv_rmssd_milli: recovery.score?.hrv_rmssd_milli || 0,
        },
      };
    } catch (error) {
      console.error('[Whoop] Failed to get recovery:', error);
      return null;
    }
  }

  /**
   * Get workout data for a date range
   */
  async getWorkouts(startDate: Date, endDate: Date): Promise<WhoopWorkout[]> {
    const params = new URLSearchParams({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    });
    const response = await this.apiRequest<{ records: WhoopWorkout[] }>(`/activity/workout?${params}`);
    return response.records || [];
  }

  /**
   * Get sleep data for a date range
   */
  async getSleep(startDate: Date, endDate: Date): Promise<WhoopSleep[]> {
    const params = new URLSearchParams({
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    });
    const response = await this.apiRequest<{ records: WhoopSleep[] }>(`/activity/sleep?${params}`);
    return response.records || [];
  }

  /**
   * Get last night's sleep
   */
  async getLastNightSleep(): Promise<WhoopSleep | null> {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const sleeps = await this.getSleep(threeDaysAgo, tomorrow);
    return sleeps.length > 0 ? sleeps[0] : null;
  }

  /**
   * Disconnect Whoop (clear tokens)
   */
  async disconnect(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiresAt = null;

    try {
      await db
        .delete(integrationCredentials)
        .where(eq(integrationCredentials.integration, 'whoop'));
      console.log('[Whoop] Disconnected and tokens cleared');
    } catch (error) {
      console.error('[Whoop] Failed to clear tokens from database:', error);
    }
  }
}

// ============================================
// Singleton Instance
// ============================================

let whoopInstance: WhoopIntegration | null = null;

export function getWhoopIntegration(): WhoopIntegration {
  if (!whoopInstance) {
    whoopInstance = new WhoopIntegration();
  }
  return whoopInstance;
}

export const whoopIntegration = getWhoopIntegration();

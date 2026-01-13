/**
 * JD Agent - Plaud Cloud API Integration
 *
 * Direct integration with Plaud's cloud API to fetch recordings automatically.
 * No manual export or Zapier required.
 *
 * API Documentation: https://docs.plaud.ai/
 * Platform: https://platform.plaud.cn
 *
 * Setup:
 * 1. Get API credentials from Plaud Developer Platform
 * 2. Set PLAUD_CLIENT_ID and PLAUD_CLIENT_SECRET in .env
 * 3. Run sync via scheduler or manual trigger
 */

import { db } from '../db/client';
import { recordings, transcripts, vaultPages, vaultBlocks } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

// ============================================
// Types
// ============================================

interface PlaudAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface PlaudFile {
  id: string;
  title: string;
  duration_seconds: number;
  created_at: string;
  updated_at: string;
  status: string;
  has_transcript: boolean;
  has_summary: boolean;
}

interface PlaudFileData {
  id: string;
  title: string;
  transcript?: string;
  summary?: string;
  audio_url?: string;
  duration_seconds: number;
  recorded_at: string;
  speakers?: Array<{ id: number; name?: string }>;
  segments?: Array<{
    start: number;
    end: number;
    text: string;
    speaker?: number;
  }>;
}

interface SyncResult {
  synced: number;
  skipped: number;
  errors: string[];
  newRecordings: string[];
}

// ============================================
// Plaud API Client
// ============================================

export class PlaudApiClient {
  private baseUrl = 'https://platform.plaud.cn';
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private clientId: string | null = null;
  private clientSecret: string | null = null;
  private lastSyncedId: string | null = null;

  constructor() {
    this.clientId = process.env.PLAUD_CLIENT_ID || null;
    this.clientSecret = process.env.PLAUD_CLIENT_SECRET || null;

    if (this.clientId && this.clientSecret) {
      console.log('[Plaud API] Client initialized');
    } else {
      console.log('[Plaud API] Not configured - set PLAUD_CLIENT_ID and PLAUD_CLIENT_SECRET');
    }
  }

  /**
   * Check if API is configured
   */
  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  /**
   * Get access token (with caching)
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error('Plaud API not configured');
    }

    const response = await fetch(`${this.baseUrl}/api/oauth/api-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get access token: ${response.status}`);
    }

    const data: PlaudAuthResponse = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000);

    console.log('[Plaud API] Access token refreshed');
    return this.accessToken;
  }

  /**
   * Make authenticated API request
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.getAccessToken();

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${await response.text()}`);
    }

    return response.json();
  }

  /**
   * List all recordings from Plaud cloud
   */
  async listRecordings(options: {
    limit?: number;
    since?: Date;
  } = {}): Promise<PlaudFile[]> {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', String(options.limit));
    if (options.since) params.set('created_after', options.since.toISOString());

    const result = await this.request<{ files: PlaudFile[] }>(
      `/api/files/?${params.toString()}`
    );

    return result.files || [];
  }

  /**
   * Get recording data (transcript, summary, audio URL)
   */
  async getRecordingData(fileId: string): Promise<PlaudFileData> {
    return this.request<PlaudFileData>(`/api/files/${fileId}/data`);
  }

  /**
   * Sync new recordings from Plaud cloud to JD Agent
   */
  async syncNewRecordings(): Promise<SyncResult> {
    const result: SyncResult = {
      synced: 0,
      skipped: 0,
      errors: [],
      newRecordings: [],
    };

    if (!this.isConfigured()) {
      result.errors.push('Plaud API not configured');
      return result;
    }

    try {
      // Get recordings from last 24 hours (or since last sync)
      const since = new Date();
      since.setHours(since.getHours() - 24);

      const plaudFiles = await this.listRecordings({
        limit: 50,
        since,
      });

      console.log(`[Plaud API] Found ${plaudFiles.length} recordings to check`);

      for (const file of plaudFiles) {
        try {
          // Check if already synced
          const existing = await db
            .select()
            .from(recordings)
            .where(eq(recordings.id, file.id))
            .limit(1);

          if (existing.length > 0) {
            result.skipped++;
            continue;
          }

          // Only sync if transcript is ready
          if (!file.has_transcript) {
            console.log(`[Plaud API] Skipping ${file.id} - no transcript yet`);
            result.skipped++;
            continue;
          }

          // Get full recording data
          const data = await this.getRecordingData(file.id);

          // Create recording
          const [recording] = await db.insert(recordings).values({
            id: file.id,
            filePath: data.audio_url || `plaud-api:${file.id}`,
            originalFilename: data.title,
            durationSeconds: data.duration_seconds,
            recordingType: 'other',
            status: 'complete',
            recordedAt: new Date(data.recorded_at),
          }).returning();

          // Create transcript
          await db.insert(transcripts).values({
            recordingId: recording.id,
            fullText: data.transcript || '',
            segments: data.segments || [],
            wordCount: (data.transcript || '').split(/\s+/).length,
            speakerCount: data.speakers?.length || 1,
            confidenceScore: 0.95,
          });

          // Create Vault page
          const [page] = await db.insert(vaultPages).values({
            title: data.title,
            icon: '🎙️',
          }).returning();

          // Add summary block
          if (data.summary) {
            await db.insert(vaultBlocks).values({
              pageId: page.id,
              type: 'callout',
              content: {
                icon: '📝',
                text: `**Summary**\n\n${data.summary}`,
              },
              sortOrder: 0,
            });
          }

          // Add transcript block with speaker labels
          if (data.transcript) {
            let formattedTranscript = data.transcript;

            // Format with speaker labels if segments available
            if (data.segments && data.segments.length > 0) {
              formattedTranscript = data.segments
                .map(seg => {
                  const time = formatTime(seg.start);
                  const speaker = seg.speaker !== undefined
                    ? data.speakers?.find(s => s.id === seg.speaker)?.name || `Speaker ${seg.speaker + 1}`
                    : 'Speaker';
                  return `**[${time}] ${speaker}:**\n${seg.text}`;
                })
                .join('\n\n');
            }

            await db.insert(vaultBlocks).values({
              pageId: page.id,
              type: 'text',
              content: {
                text: `## Full Transcript\n\n${formattedTranscript}`,
              },
              sortOrder: 1,
            });
          }

          result.synced++;
          result.newRecordings.push(data.title);
          console.log(`[Plaud API] Synced: ${data.title}`);

        } catch (err) {
          result.errors.push(`${file.id}: ${String(err)}`);
          console.error(`[Plaud API] Error syncing ${file.id}:`, err);
        }
      }

      console.log(`[Plaud API] Sync complete: ${result.synced} synced, ${result.skipped} skipped`);
      return result;

    } catch (error) {
      result.errors.push(String(error));
      console.error('[Plaud API] Sync failed:', error);
      return result;
    }
  }

  /**
   * Get status
   */
  getStatus(): {
    configured: boolean;
    authenticated: boolean;
    lastSync?: Date;
  } {
    return {
      configured: this.isConfigured(),
      authenticated: !!(this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry),
    };
  }
}

// ============================================
// Helper Functions
// ============================================

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// ============================================
// Singleton instance
// ============================================

export const plaudApiClient = new PlaudApiClient();

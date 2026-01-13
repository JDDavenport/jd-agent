/**
 * Plaud Google Drive Sync Service
 *
 * Polls Google Drive for Plaud exports (audio + transcripts).
 * Downloads new files and processes them through the Plaud pipeline.
 *
 * Workflow:
 * 1. User records with Plaud
 * 2. In Plaud app, tap Share → Save to Google Drive
 * 3. This service polls Google Drive every 15 minutes
 * 4. New files are downloaded and processed
 *
 * Supported exports:
 * - Audio files (.mp3, .m4a, .wav)
 * - Transcript files (.txt)
 * - Combined exports (folder with audio + transcript)
 */

import { google, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { db } from '../db/client';
import { recordings, transcripts, vaultPages, vaultBlocks } from '../db/schema';
import { eq } from 'drizzle-orm';
import { plaudIntegration } from '../integrations/plaud';

// ============================================
// Types
// ============================================

interface PlaudExport {
  id: string;
  title: string;
  audioFileId?: string;
  audioFileName?: string;
  transcriptFileId?: string;
  transcriptFileName?: string;
  folderId?: string;
  createdAt: Date;
}

interface SyncResult {
  processed: number;
  skipped: number;
  errors: string[];
  newRecordings: string[];
}

interface SyncState {
  lastSyncAt: string;
  syncedFileIds: string[];
  watchFolderId?: string;
}

// ============================================
// State Management
// ============================================

const STATE_FILE = '.plaud-gdrive-state.json';

function loadState(syncPath: string): SyncState {
  const statePath = join(syncPath, STATE_FILE);
  try {
    if (existsSync(statePath)) {
      return JSON.parse(readFileSync(statePath, 'utf-8'));
    }
  } catch (e) {
    console.log('[PlaudGDrive] Could not load state, starting fresh');
  }
  return {
    lastSyncAt: new Date(0).toISOString(),
    syncedFileIds: [],
  };
}

function saveState(syncPath: string, state: SyncState): void {
  const statePath = join(syncPath, STATE_FILE);
  try {
    writeFileSync(statePath, JSON.stringify(state, null, 2));
  } catch (e) {
    console.error('[PlaudGDrive] Could not save state:', e);
  }
}

// ============================================
// Plaud Google Drive Sync Service
// ============================================

export class PlaudGDriveSync {
  private auth: OAuth2Client | null = null;
  private drive: drive_v3.Drive | null = null;
  private syncPath: string;
  private folderName: string;
  private state: SyncState;
  private pollTimer: NodeJS.Timeout | null = null;
  private isPolling = false;
  private pollIntervalMs: number;

  constructor() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    this.syncPath = process.env.PLAUD_SYNC_PATH || '';
    this.folderName = process.env.PLAUD_GDRIVE_FOLDER || 'Plaud';
    this.pollIntervalMs = parseInt(process.env.PLAUD_GDRIVE_POLL_INTERVAL_MS || '900000', 10); // 15 min default

    if (!clientId || !clientSecret || !refreshToken) {
      console.log('[PlaudGDrive] Not configured - missing Google credentials');
      this.state = { lastSyncAt: new Date(0).toISOString(), syncedFileIds: [] };
      return;
    }

    if (!this.syncPath) {
      console.log('[PlaudGDrive] Not configured - missing PLAUD_SYNC_PATH');
      this.state = { lastSyncAt: new Date(0).toISOString(), syncedFileIds: [] };
      return;
    }

    // Ensure sync path exists
    if (!existsSync(this.syncPath)) {
      mkdirSync(this.syncPath, { recursive: true });
    }

    // Set up OAuth2 client
    this.auth = new google.auth.OAuth2(clientId, clientSecret);
    this.auth.setCredentials({ refresh_token: refreshToken });

    // Initialize Drive API
    this.drive = google.drive({ version: 'v3', auth: this.auth });

    // Load state
    this.state = loadState(this.syncPath);

    console.log(`[PlaudGDrive] Initialized - watching for folder "${this.folderName}"`);
  }

  // ============================================
  // Configuration
  // ============================================

  isConfigured(): boolean {
    return !!this.drive && !!this.syncPath;
  }

  getStatus(): {
    configured: boolean;
    polling: boolean;
    watchFolder: string;
    lastSync: string | null;
    syncedCount: number;
    pollIntervalMinutes: number;
  } {
    return {
      configured: this.isConfigured(),
      polling: this.isPolling,
      watchFolder: this.folderName,
      lastSync: this.state.lastSyncAt !== new Date(0).toISOString() ? this.state.lastSyncAt : null,
      syncedCount: this.state.syncedFileIds.length,
      pollIntervalMinutes: Math.round(this.pollIntervalMs / 60000),
    };
  }

  // ============================================
  // Folder Discovery
  // ============================================

  async findPlaudFolder(): Promise<string | null> {
    if (!this.isConfigured() || !this.drive) return null;

    // If we already have the folder ID, verify it exists
    if (this.state.watchFolderId) {
      try {
        await this.drive.files.get({ fileId: this.state.watchFolderId });
        return this.state.watchFolderId;
      } catch {
        this.state.watchFolderId = undefined;
      }
    }

    // Search for folder by name
    try {
      const response = await this.drive.files.list({
        q: `name = '${this.folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        pageSize: 10,
      });

      if (response.data.files && response.data.files.length > 0) {
        const folderId = response.data.files[0].id!;
        this.state.watchFolderId = folderId;
        saveState(this.syncPath, this.state);
        console.log(`[PlaudGDrive] Found folder "${this.folderName}" with ID: ${folderId}`);
        return folderId;
      }

      console.log(`[PlaudGDrive] Folder "${this.folderName}" not found - create it in Google Drive`);
      return null;
    } catch (error) {
      console.error('[PlaudGDrive] Error searching for folder:', error);
      return null;
    }
  }

  // ============================================
  // File Listing & Download
  // ============================================

  /**
   * List all Plaud files (audio, transcripts) in the folder
   */
  async listPlaudFiles(folderId: string): Promise<drive_v3.Schema$File[]> {
    if (!this.drive) return [];

    const allFiles: drive_v3.Schema$File[] = [];
    const audioMimeTypes = ['audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/x-wav'];
    const textMimeTypes = ['text/plain', 'application/octet-stream']; // .txt files

    const listFolder = async (parentId: string, path: string = '') => {
      let pageToken: string | undefined;

      do {
        const response = await this.drive!.files.list({
          q: `'${parentId}' in parents and trashed = false`,
          fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, parents, createdTime)',
          pageSize: 100,
          pageToken,
        });

        if (response.data.files) {
          for (const file of response.data.files) {
            if (file.mimeType === 'application/vnd.google-apps.folder') {
              // Recurse into subfolders (Plaud might create per-recording folders)
              await listFolder(file.id!, path ? `${path}/${file.name}` : file.name!);
            } else {
              const ext = extname(file.name || '').toLowerCase();
              const isAudio = audioMimeTypes.includes(file.mimeType || '') ||
                             ['.mp3', '.m4a', '.wav'].includes(ext);
              const isText = textMimeTypes.includes(file.mimeType || '') || ext === '.txt';

              if (isAudio || isText) {
                (file as any).drivePath = path;
                (file as any).isAudio = isAudio;
                (file as any).isText = isText;
                allFiles.push(file);
              }
            }
          }
        }

        pageToken = response.data.nextPageToken || undefined;
        await this.sleep(100);
      } while (pageToken);
    };

    await listFolder(folderId);
    return allFiles;
  }

  /**
   * Download a file from Google Drive
   */
  async downloadFile(fileId: string, localPath: string): Promise<void> {
    if (!this.drive) throw new Error('Drive not initialized');

    const dir = dirname(localPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    const response = await this.drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );

    writeFileSync(localPath, Buffer.from(response.data as ArrayBuffer));
  }

  /**
   * Read text content from a Drive file
   */
  async readTextFile(fileId: string): Promise<string> {
    if (!this.drive) throw new Error('Drive not initialized');

    const response = await this.drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'text' }
    );

    return response.data as string;
  }

  // ============================================
  // Sync Logic
  // ============================================

  async sync(): Promise<SyncResult> {
    const result: SyncResult = {
      processed: 0,
      skipped: 0,
      errors: [],
      newRecordings: [],
    };

    if (!this.isConfigured()) {
      result.errors.push('Not configured');
      return result;
    }

    console.log('[PlaudGDrive] Starting sync...');

    // Find the Plaud folder
    const folderId = await this.findPlaudFolder();
    if (!folderId) {
      result.errors.push(`Folder "${this.folderName}" not found - create it in Google Drive`);
      return result;
    }

    // List all files
    const files = await this.listPlaudFiles(folderId);
    console.log(`[PlaudGDrive] Found ${files.length} files in Google Drive`);

    // Group files by base name (to pair audio + transcript)
    const fileGroups = new Map<string, { audio?: drive_v3.Schema$File; transcript?: drive_v3.Schema$File }>();

    for (const file of files) {
      const baseName = basename(file.name || '', extname(file.name || ''));
      const drivePath = (file as any).drivePath || '';
      const key = drivePath ? `${drivePath}/${baseName}` : baseName;

      if (!fileGroups.has(key)) {
        fileGroups.set(key, {});
      }

      const group = fileGroups.get(key)!;
      if ((file as any).isAudio) {
        group.audio = file;
      } else if ((file as any).isText) {
        group.transcript = file;
      }
    }

    // Process each group
    for (const [key, group] of fileGroups) {
      try {
        // Need at least audio or transcript
        if (!group.audio && !group.transcript) continue;

        // Check if already synced (by audio file ID or transcript file ID)
        const audioId = group.audio?.id;
        const transcriptId = group.transcript?.id;

        if (audioId && this.state.syncedFileIds.includes(audioId)) {
          result.skipped++;
          continue;
        }
        if (transcriptId && this.state.syncedFileIds.includes(transcriptId)) {
          result.skipped++;
          continue;
        }

        const title = basename(key);
        console.log(`[PlaudGDrive] Processing: ${title}`);

        // If we have audio, download and process through Plaud integration
        if (group.audio) {
          const localPath = join(this.syncPath, `${title}${extname(group.audio.name || '.mp3')}`);

          if (!existsSync(localPath)) {
            await this.downloadFile(group.audio.id!, localPath);
            console.log(`[PlaudGDrive] Downloaded audio: ${localPath}`);
          }

          // Mark as synced - Plaud file watcher will pick it up
          if (audioId) this.state.syncedFileIds.push(audioId);
          result.processed++;
          result.newRecordings.push(title);
        }
        // If we only have transcript (no audio), create Vault page directly
        else if (group.transcript) {
          const transcriptText = await this.readTextFile(group.transcript.id!);

          await this.createVaultPageFromTranscript(title, transcriptText);

          if (transcriptId) this.state.syncedFileIds.push(transcriptId);
          result.processed++;
          result.newRecordings.push(title);
        }

        await this.sleep(200);

      } catch (error) {
        const errorMsg = `Failed to process ${key}: ${error}`;
        console.error(`[PlaudGDrive] ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }

    // Update state
    this.state.lastSyncAt = new Date().toISOString();
    saveState(this.syncPath, this.state);

    console.log(`[PlaudGDrive] Sync complete: ${result.processed} processed, ${result.skipped} skipped`);
    return result;
  }

  /**
   * Create a Vault page from transcript text (when no audio available)
   */
  private async createVaultPageFromTranscript(title: string, transcriptText: string): Promise<void> {
    // Create Vault page
    const [page] = await db.insert(vaultPages).values({
      title: `${title}`,
      icon: '🎙️',
    }).returning();

    // Parse transcript for any structure (Plaud often includes timestamps)
    const hasTimestamps = /\[\d{2}:\d{2}\]/.test(transcriptText);

    // Add transcript block
    await db.insert(vaultBlocks).values({
      pageId: page.id,
      type: 'text',
      content: {
        text: hasTimestamps
          ? `## Transcript\n\n${transcriptText}`
          : `## Recording Notes\n\n${transcriptText}`,
      },
      sortOrder: 0,
    });

    console.log(`[PlaudGDrive] Created Vault page: ${title}`);
  }

  // ============================================
  // Polling
  // ============================================

  startPolling(): boolean {
    if (!this.isConfigured()) {
      console.log('[PlaudGDrive] Cannot start polling - not configured');
      return false;
    }

    if (this.isPolling) {
      console.log('[PlaudGDrive] Already polling');
      return true;
    }

    console.log(`[PlaudGDrive] Starting polling every ${this.pollIntervalMs / 60000} minutes`);

    // Run initial sync
    this.sync().catch(e => console.error('[PlaudGDrive] Initial sync failed:', e));

    // Set up interval
    this.pollTimer = setInterval(async () => {
      try {
        await this.sync();
      } catch (error) {
        console.error('[PlaudGDrive] Polling sync failed:', error);
      }
    }, this.pollIntervalMs);

    this.isPolling = true;
    return true;
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isPolling = false;
    console.log('[PlaudGDrive] Stopped polling');
  }

  // ============================================
  // Utilities
  // ============================================

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create the Plaud folder in Google Drive if it doesn't exist
   */
  async createPlaudFolder(): Promise<string> {
    if (!this.isConfigured() || !this.drive) {
      throw new Error('Not configured');
    }

    // Check if folder exists
    let folderId = await this.findPlaudFolder();
    if (folderId) return folderId;

    // Create folder
    const response = await this.drive.files.create({
      requestBody: {
        name: this.folderName,
        mimeType: 'application/vnd.google-apps.folder',
      },
      fields: 'id',
    });

    folderId = response.data.id!;
    this.state.watchFolderId = folderId;
    saveState(this.syncPath, this.state);

    console.log(`[PlaudGDrive] Created folder "${this.folderName}" in Google Drive`);
    return folderId;
  }
}

// ============================================
// Singleton Instance
// ============================================

export const plaudGDriveSync = new PlaudGDriveSync();

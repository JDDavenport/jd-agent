/**
 * Remarkable Google Drive Sync Service
 *
 * Polls Google Drive for PDFs exported from Remarkable tablet.
 * Downloads new files to the local sync folder for processing.
 *
 * Workflow:
 * 1. User exports notes from Remarkable → Google Drive
 * 2. This service polls Google Drive every 30 minutes
 * 3. New PDFs are downloaded to REMARKABLE_SYNC_PATH
 * 4. Existing Remarkable integration processes them
 *
 * Folder structure in Google Drive:
 *   Remarkable/MBA/Spring2026/MGMT501/2026-01-10.pdf
 */

import { google, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { db } from '../db/client';
import { eq } from 'drizzle-orm';

// ============================================
// Types
// ============================================

interface SyncedFile {
  driveFileId: string;
  filename: string;
  drivePath: string;
  localPath: string;
  syncedAt: Date;
  size: number;
}

interface SyncResult {
  downloaded: number;
  skipped: number;
  errors: string[];
  files: SyncedFile[];
}

interface GDriveSyncConfig {
  folderId?: string;        // Google Drive folder ID to watch
  folderName?: string;      // Folder name to search for (e.g., "Remarkable")
  pollIntervalMs: number;   // Poll interval (default 30 min)
  syncPath: string;         // Local path to save files
}

// ============================================
// State Management (simple in-memory + file)
// ============================================

interface SyncState {
  lastSyncAt: string;
  syncedFileIds: string[];
  watchFolderId?: string;
}

const STATE_FILE = '.remarkable-gdrive-state.json';

function loadState(syncPath: string): SyncState {
  const statePath = join(syncPath, STATE_FILE);
  try {
    if (existsSync(statePath)) {
      return JSON.parse(readFileSync(statePath, 'utf-8'));
    }
  } catch (e) {
    console.log('[RemarkableGDrive] Could not load state, starting fresh');
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
    console.error('[RemarkableGDrive] Could not save state:', e);
  }
}

// ============================================
// Remarkable Google Drive Sync Service
// ============================================

export class RemarkableGDriveSync {
  private auth: OAuth2Client;
  private drive: drive_v3.Drive;
  private config: GDriveSyncConfig;
  private state: SyncState;
  private pollTimer: NodeJS.Timeout | null = null;
  private isPolling = false;

  constructor() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
    const syncPath = process.env.REMARKABLE_SYNC_PATH;

    if (!clientId || !clientSecret || !refreshToken) {
      console.log('[RemarkableGDrive] Not configured - missing Google credentials');
      this.config = { pollIntervalMs: 30 * 60 * 1000, syncPath: '' };
      return;
    }

    if (!syncPath) {
      console.log('[RemarkableGDrive] Not configured - missing REMARKABLE_SYNC_PATH');
      this.config = { pollIntervalMs: 30 * 60 * 1000, syncPath: '' };
      return;
    }

    // Set up OAuth2 client
    this.auth = new google.auth.OAuth2(clientId, clientSecret);
    this.auth.setCredentials({ refresh_token: refreshToken });

    // Initialize Drive API
    this.drive = google.drive({ version: 'v3', auth: this.auth });

    // Config
    this.config = {
      folderName: process.env.REMARKABLE_GDRIVE_FOLDER || 'Remarkable',
      pollIntervalMs: parseInt(process.env.REMARKABLE_POLL_INTERVAL_MS || '1800000', 10), // 30 min default
      syncPath,
    };

    // Load state
    this.state = loadState(syncPath);

    console.log(`[RemarkableGDrive] Initialized - watching for folder "${this.config.folderName}"`);
  }

  // ============================================
  // Configuration
  // ============================================

  isConfigured(): boolean {
    return !!this.drive && !!this.config.syncPath;
  }

  getStatus(): {
    configured: boolean;
    polling: boolean;
    watchFolder: string | null;
    lastSync: string | null;
    syncedCount: number;
    pollIntervalMinutes: number;
  } {
    return {
      configured: this.isConfigured(),
      polling: this.isPolling,
      watchFolder: this.config.folderName || null,
      lastSync: this.state.lastSyncAt !== new Date(0).toISOString() ? this.state.lastSyncAt : null,
      syncedCount: this.state.syncedFileIds.length,
      pollIntervalMinutes: Math.round(this.config.pollIntervalMs / 60000),
    };
  }

  // ============================================
  // Folder Discovery
  // ============================================

  /**
   * Find the Remarkable folder in Google Drive
   */
  async findRemarkableFolder(): Promise<string | null> {
    if (!this.isConfigured()) return null;

    // If we already have the folder ID, verify it still exists
    if (this.state.watchFolderId) {
      try {
        await this.drive.files.get({ fileId: this.state.watchFolderId });
        return this.state.watchFolderId;
      } catch {
        // Folder no longer exists, search again
        this.state.watchFolderId = undefined;
      }
    }

    // Search for folder by name
    try {
      const response = await this.drive.files.list({
        q: `name = '${this.config.folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id, name)',
        pageSize: 10,
      });

      if (response.data.files && response.data.files.length > 0) {
        const folderId = response.data.files[0].id!;
        this.state.watchFolderId = folderId;
        saveState(this.config.syncPath, this.state);
        console.log(`[RemarkableGDrive] Found folder "${this.config.folderName}" with ID: ${folderId}`);
        return folderId;
      }

      console.log(`[RemarkableGDrive] Folder "${this.config.folderName}" not found in Google Drive`);
      return null;
    } catch (error) {
      console.error('[RemarkableGDrive] Error searching for folder:', error);
      return null;
    }
  }

  // ============================================
  // File Listing & Download
  // ============================================

  /**
   * List all PDF files in the Remarkable folder (recursively)
   */
  async listPdfFiles(folderId: string): Promise<drive_v3.Schema$File[]> {
    const allFiles: drive_v3.Schema$File[] = [];

    const listFolder = async (parentId: string, path: string = '') => {
      let pageToken: string | undefined;

      do {
        const response = await this.drive.files.list({
          q: `'${parentId}' in parents and trashed = false`,
          fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, parents)',
          pageSize: 100,
          pageToken,
        });

        if (response.data.files) {
          for (const file of response.data.files) {
            if (file.mimeType === 'application/vnd.google-apps.folder') {
              // Recurse into subfolders
              await listFolder(file.id!, path ? `${path}/${file.name}` : file.name!);
            } else if (file.mimeType === 'application/pdf') {
              // Add path info to file
              (file as any).drivePath = path;
              allFiles.push(file);
            }
          }
        }

        pageToken = response.data.nextPageToken || undefined;

        // Rate limiting
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
    // Ensure directory exists
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

  // ============================================
  // Sync Logic
  // ============================================

  /**
   * Sync new PDFs from Google Drive
   */
  async sync(): Promise<SyncResult> {
    const result: SyncResult = {
      downloaded: 0,
      skipped: 0,
      errors: [],
      files: [],
    };

    if (!this.isConfigured()) {
      result.errors.push('Not configured');
      return result;
    }

    console.log('[RemarkableGDrive] Starting sync...');

    // Find the Remarkable folder
    const folderId = await this.findRemarkableFolder();
    if (!folderId) {
      result.errors.push(`Folder "${this.config.folderName}" not found in Google Drive`);
      return result;
    }

    // List all PDFs
    const files = await this.listPdfFiles(folderId);
    console.log(`[RemarkableGDrive] Found ${files.length} PDFs in Google Drive`);

    // Process each file
    for (const file of files) {
      try {
        // Skip if already synced
        if (this.state.syncedFileIds.includes(file.id!)) {
          result.skipped++;
          continue;
        }

        // Build local path maintaining folder structure
        const drivePath = (file as any).drivePath || '';
        const localPath = join(this.config.syncPath, drivePath, file.name!);

        // Skip if file already exists locally
        if (existsSync(localPath)) {
          this.state.syncedFileIds.push(file.id!);
          result.skipped++;
          continue;
        }

        // Download file
        console.log(`[RemarkableGDrive] Downloading: ${drivePath}/${file.name}`);
        await this.downloadFile(file.id!, localPath);

        // Track synced file
        this.state.syncedFileIds.push(file.id!);
        result.downloaded++;
        result.files.push({
          driveFileId: file.id!,
          filename: file.name!,
          drivePath,
          localPath,
          syncedAt: new Date(),
          size: parseInt(file.size || '0', 10),
        });

        // Rate limiting
        await this.sleep(200);

      } catch (error) {
        const errorMsg = `Failed to download ${file.name}: ${error}`;
        console.error(`[RemarkableGDrive] ${errorMsg}`);
        result.errors.push(errorMsg);
      }
    }

    // Update state
    this.state.lastSyncAt = new Date().toISOString();
    saveState(this.config.syncPath, this.state);

    console.log(`[RemarkableGDrive] Sync complete: ${result.downloaded} downloaded, ${result.skipped} skipped`);
    return result;
  }

  // ============================================
  // Polling
  // ============================================

  /**
   * Start automatic polling
   */
  startPolling(): boolean {
    if (!this.isConfigured()) {
      console.log('[RemarkableGDrive] Cannot start polling - not configured');
      return false;
    }

    if (this.isPolling) {
      console.log('[RemarkableGDrive] Already polling');
      return true;
    }

    console.log(`[RemarkableGDrive] Starting polling every ${this.config.pollIntervalMs / 60000} minutes`);

    // Run initial sync
    this.sync().catch(e => console.error('[RemarkableGDrive] Initial sync failed:', e));

    // Set up interval
    this.pollTimer = setInterval(async () => {
      try {
        await this.sync();
      } catch (error) {
        console.error('[RemarkableGDrive] Polling sync failed:', error);
      }
    }, this.config.pollIntervalMs);

    this.isPolling = true;
    return true;
  }

  /**
   * Stop automatic polling
   */
  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isPolling = false;
    console.log('[RemarkableGDrive] Stopped polling');
  }

  // ============================================
  // Utilities
  // ============================================

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create the Remarkable folder structure in Google Drive
   */
  async createFolderStructure(classes: string[]): Promise<{ folderId: string; classFolders: Record<string, string> }> {
    if (!this.isConfigured()) {
      throw new Error('Not configured');
    }

    // Create root Remarkable folder
    let rootFolder = await this.findRemarkableFolder();
    if (!rootFolder) {
      const response = await this.drive.files.create({
        requestBody: {
          name: this.config.folderName || 'Remarkable',
          mimeType: 'application/vnd.google-apps.folder',
        },
        fields: 'id',
      });
      rootFolder = response.data.id!;
      this.state.watchFolderId = rootFolder;
      saveState(this.config.syncPath, this.state);
      console.log(`[RemarkableGDrive] Created folder "${this.config.folderName}"`);
    }

    // Create MBA folder
    const mbaResponse = await this.drive.files.create({
      requestBody: {
        name: 'MBA',
        mimeType: 'application/vnd.google-apps.folder',
        parents: [rootFolder],
      },
      fields: 'id',
    });
    const mbaFolderId = mbaResponse.data.id!;

    // Create class folders
    const classFolders: Record<string, string> = {};
    for (const className of classes) {
      const classResponse = await this.drive.files.create({
        requestBody: {
          name: className,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [mbaFolderId],
        },
        fields: 'id',
      });
      classFolders[className] = classResponse.data.id!;
    }

    return { folderId: rootFolder, classFolders };
  }
}

// ============================================
// Singleton Instance
// ============================================

export const remarkableGDriveSync = new RemarkableGDriveSync();

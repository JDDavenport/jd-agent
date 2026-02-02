/**
 * Plaud Watcher - Watches PlaudSync folder for new recordings
 */

import * as chokidar from 'chokidar';
import * as fs from 'fs';
import * as path from 'path';

export class PlaudWatcher {
  private apiBase: string;
  private sessionToken: string;
  private watchPath: string;
  private watcher: chokidar.FSWatcher | null = null;
  private syncedFiles: Set<string> = new Set();

  constructor(apiBase: string, sessionToken: string, watchPath: string) {
    this.apiBase = apiBase;
    this.sessionToken = sessionToken;
    this.watchPath = watchPath;
  }

  /**
   * Start watching for new recordings
   */
  start(): void {
    if (this.watcher) {
      this.watcher.close();
    }

    console.log(`[PlaudWatcher] Starting watch on: ${this.watchPath}`);

    this.watcher = chokidar.watch(this.watchPath, {
      persistent: true,
      ignoreInitial: false,
      depth: 2,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100,
      },
    });

    // Watch for transcript files
    this.watcher.on('add', (filePath) => {
      if (filePath.endsWith('transcript-deepgram.txt') || filePath.endsWith('transcript.txt')) {
        this.handleNewTranscript(filePath);
      }
    });

    this.watcher.on('error', (error) => {
      console.error('[PlaudWatcher] Error:', error);
    });
  }

  /**
   * Stop watching
   */
  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  /**
   * Handle new transcript file
   */
  private async handleNewTranscript(filePath: string): Promise<void> {
    // Avoid duplicate syncs
    if (this.syncedFiles.has(filePath)) {
      return;
    }
    this.syncedFiles.add(filePath);

    const recordingDir = path.dirname(filePath);
    const recordingName = path.basename(recordingDir);

    console.log(`[PlaudWatcher] New transcript found: ${recordingName}`);

    try {
      // Read transcript
      const transcript = fs.readFileSync(filePath, 'utf-8');

      // Read metadata if available
      const metadataPath = path.join(recordingDir, 'metadata.json');
      let metadata: any = {};
      if (fs.existsSync(metadataPath)) {
        try {
          metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
        } catch (e) {
          // Ignore parse errors
        }
      }

      // Read audio file info
      const audioFiles = fs.readdirSync(recordingDir).filter(f => 
        f.endsWith('.mp3') || f.endsWith('.m4a') || f.endsWith('.wav')
      );
      const audioFile = audioFiles[0];

      // Extract date from folder name (e.g., "2026-01-30_Strategy_Class_abc123")
      const dateMatch = recordingName.match(/^(\d{4}-\d{2}-\d{2})/);
      const recordingDate = dateMatch ? dateMatch[1] : null;

      // Upload to backend
      await this.uploadTranscript({
        recordingId: recordingName,
        recordingDate,
        title: metadata.title || recordingName.replace(/^\d{4}-\d{2}-\d{2}_/, '').replace(/_/g, ' '),
        transcript,
        metadata: {
          ...metadata,
          audioFile,
          duration: metadata.duration,
        },
      });

      console.log(`[PlaudWatcher] Synced: ${recordingName}`);
    } catch (error) {
      console.error(`[PlaudWatcher] Failed to sync ${recordingName}:`, error);
      // Remove from synced so it can be retried
      this.syncedFiles.delete(filePath);
    }
  }

  /**
   * Upload transcript to backend
   */
  private async uploadTranscript(data: {
    recordingId: string;
    recordingDate: string | null;
    title: string;
    transcript: string;
    metadata: any;
  }): Promise<void> {
    const response = await fetch(`${this.apiBase}/api/sync/plaud`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `study_help_session=${this.sessionToken}`,
      },
      body: JSON.stringify(data),
    });

    const json = await response.json();

    if (!json.success) {
      throw new Error(json.error?.message || 'Failed to upload transcript');
    }
  }

  /**
   * Sync all existing recordings
   */
  async syncAll(): Promise<number> {
    const dirs = fs.readdirSync(this.watchPath).filter(d => {
      const fullPath = path.join(this.watchPath, d);
      return fs.statSync(fullPath).isDirectory() && d.match(/^\d{4}-\d{2}-\d{2}/);
    });

    let synced = 0;

    for (const dir of dirs) {
      const transcriptPath = path.join(this.watchPath, dir, 'transcript-deepgram.txt');
      const altTranscriptPath = path.join(this.watchPath, dir, 'transcript.txt');

      if (fs.existsSync(transcriptPath)) {
        await this.handleNewTranscript(transcriptPath);
        synced++;
      } else if (fs.existsSync(altTranscriptPath)) {
        await this.handleNewTranscript(altTranscriptPath);
        synced++;
      }
    }

    return synced;
  }
}

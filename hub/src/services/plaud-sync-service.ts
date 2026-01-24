/**
 * Plaud Sync Service
 *
 * Downloads recordings, transcripts, and summaries from web.plaud.ai
 * Uses saved browser session for authentication.
 */

import { chromium, BrowserContext } from 'playwright';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { gunzipSync } from 'zlib';

// Use environment variable for sync path, with fallback
const SYNC_PATH = process.env.PLAUD_SYNC_PATH || '/Users/jddavenport/Documents/PlaudSync';
const STORAGE_PATH = join(SYNC_PATH, '.plaud-auth.json');
const STATE_PATH = join(SYNC_PATH, '.plaud-sync-state.json');

interface PlaudFile {
  id: string;
  filename: string;
  duration: number;
  filesize: number;
  filetype: string;
  fullname: string;
  start_time: number;
  is_trans: boolean;
  is_summary: boolean;
}

interface ContentItem {
  data_id: string;
  data_type: string;
  data_link: string;
  data_title?: string;
  data_content?: string;
}

interface SyncState {
  lastSync: string;
  syncedFiles: Record<string, {
    syncedAt: string;
    hasTranscript: boolean;
    hasSummary: boolean;
    hasAudio: boolean;
  }>;
}

interface SyncResult {
  success: boolean;
  filesProcessed: number;
  transcriptsDownloaded: number;
  summariesDownloaded: number;
  audioDownloaded: number;
  errors: string[];
}

function loadState(): SyncState {
  try {
    if (existsSync(STATE_PATH)) {
      return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('[PlaudSync] Error loading state:', e);
  }
  return { lastSync: '', syncedFiles: {} };
}

function saveState(state: SyncState): void {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

export class PlaudSyncService {
  private context: BrowserContext | null = null;

  constructor() {
    if (!existsSync(SYNC_PATH)) {
      mkdirSync(SYNC_PATH, { recursive: true });
    }
  }

  hasSession(): boolean {
    return existsSync(STORAGE_PATH);
  }

  async sync(): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      filesProcessed: 0,
      transcriptsDownloaded: 0,
      summariesDownloaded: 0,
      audioDownloaded: 0,
      errors: [],
    };

    if (!this.hasSession()) {
      result.errors.push('No Plaud session found. Run plaud-login.ts first.');
      return result;
    }

    const browser = await chromium.launch({ headless: true });

    try {
      this.context = await browser.newContext({
        storageState: STORAGE_PATH,
      });

      const page = await this.context.newPage();

      // Navigate to get auth context
      await page.goto('https://web.plaud.ai/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const token = await page.evaluate(() => localStorage.getItem('tokenstr'));
      if (!token) {
        result.errors.push('No auth token found. Session may have expired.');
        return result;
      }

      console.log('[PlaudSync] Authenticated successfully');

      // Get file list
      const filesResponse = await page.evaluate(async (authToken) => {
        const response = await fetch('https://api.plaud.ai/file/simple/web?skip=0&limit=100&is_trash=2&sort_by=start_time&is_desc=true', {
          headers: { 'Authorization': authToken }
        });
        return response.json() as Promise<{ data_file_list?: PlaudFile[] }>;
      }, token);

      const files: PlaudFile[] = (filesResponse as { data_file_list?: PlaudFile[] }).data_file_list || [];
      console.log(`[PlaudSync] Found ${files.length} files`);

      const state = loadState();

      for (const file of files) {
        console.log(`\n[PlaudSync] Processing: ${file.filename}`);

        // Create directory for this file
        const date = new Date(file.start_time).toISOString().split('T')[0];
        const safeName = file.filename.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
        const dirName = `${date}_${safeName}_${file.id.slice(0, 8)}`;
        const dirPath = join(SYNC_PATH, dirName);

        if (!existsSync(dirPath)) {
          mkdirSync(dirPath, { recursive: true });
        }

        // Check if already synced and up-to-date
        const syncedInfo = state.syncedFiles[file.id];
        if (syncedInfo?.hasTranscript && syncedInfo?.hasSummary && syncedInfo?.hasAudio) {
          console.log('[PlaudSync]   Already synced');
          continue;
        }

        // Get file detail
        const detail = await page.evaluate(async ({ fileId, authToken }) => {
          const resp = await fetch(`https://api.plaud.ai/file/detail/${fileId}`, {
            headers: { 'Authorization': authToken }
          });
          return resp.json() as Promise<{ data?: { pre_download_content_list?: any[]; content_list?: ContentItem[] } }>;
        }, { fileId: file.id, authToken: token }) as { data?: { pre_download_content_list?: any[]; content_list?: ContentItem[] } };

        if (!detail.data) {
          console.log('[PlaudSync]   No detail data');
          result.errors.push(`No detail for ${file.filename}`);
          continue;
        }

        // Save metadata
        const metadata = {
          id: file.id,
          filename: file.filename,
          duration: file.duration,
          durationMinutes: Math.round(file.duration / 60000),
          startTime: new Date(file.start_time).toISOString(),
          isTranscribed: file.is_trans,
          isSummarized: file.is_summary,
          fileType: file.filetype,
          fileSize: file.filesize,
        };
        writeFileSync(join(dirPath, 'metadata.json'), JSON.stringify(metadata, null, 2));

        let hasTranscript = false;
        let hasSummary = false;
        let hasAudio = false;

        // Download from pre_download_content_list
        const preDownload = detail.data.pre_download_content_list || [];
        for (const item of preDownload) {
          if (item.data_content) {
            const filename = item.data_type === 'auto_sum_note' ? 'summary.md' : 'content.md';
            writeFileSync(join(dirPath, filename), item.data_content);
            console.log(`[PlaudSync]   Saved ${filename} (pre-download)`);
            if (item.data_type === 'auto_sum_note') hasSummary = true;
          }
        }

        // Download from content_list URLs
        const contentList: ContentItem[] = detail.data.content_list || [];
        for (const item of contentList) {
          if (!item.data_link) continue;

          try {
            const response = await page.request.get(item.data_link);
            if (!response.ok()) continue;

            let buffer = await response.body();
            let content: string;

            // Decompress if gzipped
            if (item.data_link.includes('.gz')) {
              try {
                content = gunzipSync(buffer).toString('utf-8');
              } catch {
                content = buffer.toString('utf-8');
              }
            } else {
              content = buffer.toString('utf-8');
            }

            if (item.data_type === 'transaction') {
              // Transcript
              writeFileSync(join(dirPath, 'transcript.json'), content);
              hasTranscript = true;
              result.transcriptsDownloaded++;

              // Also save as readable text
              try {
                const parsed = JSON.parse(content);

                // Handle Plaud's transcript format: array of {start_time, end_time, content, speaker}
                if (Array.isArray(parsed)) {
                  const text = parsed
                    .map((u: any) => `[${u.speaker || 'Speaker'}]: ${u.content}`)
                    .join('\n\n');
                  writeFileSync(join(dirPath, 'transcript.txt'), text);
                } else if (parsed.results?.utterances) {
                  // Deepgram format
                  const text = parsed.results.utterances
                    .map((u: any) => `[${u.speaker || 'Speaker'}]: ${u.transcript}`)
                    .join('\n\n');
                  writeFileSync(join(dirPath, 'transcript.txt'), text);
                }
              } catch {}

              console.log('[PlaudSync]   Downloaded transcript');
            } else if (item.data_type === 'auto_sum_note') {
              writeFileSync(join(dirPath, 'summary.md'), content);
              hasSummary = true;
              result.summariesDownloaded++;
              console.log('[PlaudSync]   Downloaded summary');
            } else if (item.data_type === 'consumer_note') {
              const noteName = item.data_title?.replace(/[^a-zA-Z0-9]/g, '_') || 'note';
              writeFileSync(join(dirPath, `note_${noteName}.md`), content);
              console.log(`[PlaudSync]   Downloaded note: ${item.data_title}`);
            }
          } catch (e) {
            console.error(`[PlaudSync]   Error downloading ${item.data_type}:`, e);
          }
        }

        // Download audio file
        const audioExtensions = ['.m4a', '.mp3', '.wav', '.ogg'];
        const existingAudio = audioExtensions.find(ext => existsSync(join(dirPath, `audio${ext}`)));
        if (!existingAudio) {
          try {
            console.log('[PlaudSync]   Downloading audio...');
            const audioResp = await page.evaluate(async ({ fileId, authToken }) => {
              const resp = await fetch(`https://api.plaud.ai/file/download/${fileId}`, {
                headers: { 'Authorization': authToken }
              });
              if (!resp.ok) return { error: `HTTP ${resp.status}` };

              const blob = await resp.blob();
              const arrayBuffer = await blob.arrayBuffer();
              const bytes = new Uint8Array(arrayBuffer);

              // Convert to hex string for transfer (more reliable for binary)
              let hex = '';
              for (let i = 0; i < bytes.length; i++) {
                hex += bytes[i].toString(16).padStart(2, '0');
              }
              return { hex, size: bytes.length };
            }, { fileId: file.id, authToken: token });

            if (audioResp.error) {
              console.error(`[PlaudSync]   Audio download failed: ${audioResp.error}`);
            } else if (audioResp.hex) {
              const audioBuffer = Buffer.from(audioResp.hex, 'hex');

              // Detect format from header
              let ext = '.m4a';
              if (audioBuffer[0] === 0xff && (audioBuffer[1] & 0xe0) === 0xe0) {
                ext = '.mp3';
              } else if (audioBuffer.toString('ascii', 0, 4) === 'RIFF') {
                ext = '.wav';
              } else if (audioBuffer.toString('ascii', 0, 4) === 'OggS') {
                ext = '.ogg';
              } else if (audioBuffer.indexOf('ID3') === 0) {
                ext = '.mp3';
              }

              const finalPath = join(dirPath, `audio${ext}`);
              writeFileSync(finalPath, audioBuffer);
              hasAudio = true;
              result.audioDownloaded++;
              console.log(`[PlaudSync]   Downloaded audio (${Math.round(audioBuffer.length / 1024 / 1024 * 10) / 10} MB)`);
            }
          } catch (e) {
            console.error('[PlaudSync]   Error downloading audio:', e);
          }
        } else {
          hasAudio = true;
          console.log('[PlaudSync]   Audio already exists');
        }

        // Update state
        state.syncedFiles[file.id] = {
          syncedAt: new Date().toISOString(),
          hasTranscript,
          hasSummary,
          hasAudio,
        };

        result.filesProcessed++;
      }

      state.lastSync = new Date().toISOString();
      saveState(state);

      result.success = true;
      console.log('\n[PlaudSync] Sync complete');
      console.log(`[PlaudSync] Files processed: ${result.filesProcessed}`);
      console.log(`[PlaudSync] Transcripts: ${result.transcriptsDownloaded}`);
      console.log(`[PlaudSync] Summaries: ${result.summariesDownloaded}`);
      console.log(`[PlaudSync] Audio files: ${result.audioDownloaded}`);

    } catch (e) {
      result.errors.push(String(e));
      console.error('[PlaudSync] Error:', e);
    } finally {
      await browser.close();
    }

    return result;
  }

  /**
   * Get list of files from Plaud
   */
  async getFiles(): Promise<PlaudFile[]> {
    if (!this.hasSession()) {
      return [];
    }

    const browser = await chromium.launch({ headless: true });

    try {
      const context = await browser.newContext({
        storageState: STORAGE_PATH,
      });

      const page = await context.newPage();
      await page.goto('https://web.plaud.ai/');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const token = await page.evaluate(() => localStorage.getItem('tokenstr'));
      if (!token) return [];

      const response = await page.evaluate(async (authToken) => {
        const resp = await fetch('https://api.plaud.ai/file/simple/web?skip=0&limit=100&is_trash=2&sort_by=start_time&is_desc=true', {
          headers: { 'Authorization': authToken }
        });
        return resp.json() as Promise<{ data_file_list?: PlaudFile[] }>;
      }, token) as { data_file_list?: PlaudFile[] };

      return response.data_file_list || [];
    } finally {
      await browser.close();
    }
  }
}

export const plaudSyncService = new PlaudSyncService();

// CLI runner
if (import.meta.main) {
  console.log('=== Plaud Sync ===\n');
  const service = new PlaudSyncService();

  if (!service.hasSession()) {
    console.log('No session found. Run: bun run scripts/plaud-login.ts');
    process.exit(1);
  }

  service.sync().then((result) => {
    if (result.success) {
      console.log('\nSync completed successfully!');
    } else {
      console.log('\nSync failed:', result.errors);
      process.exit(1);
    }
  });
}

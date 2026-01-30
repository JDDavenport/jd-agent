/**
 * Plaud Full Sync - Get all recordings with transcript and summary
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const STORAGE_PATH = '/Users/jddavenport/Documents/PlaudSync/.plaud-auth.json';
const SYNC_PATH = '/Users/jddavenport/Documents/PlaudSync';
const STATE_PATH = join(SYNC_PATH, '.sync-state.json');

interface SyncState {
  lastSync: string;
  downloadedIds: string[];
}

function loadState(): SyncState {
  try {
    if (existsSync(STATE_PATH)) {
      return JSON.parse(readFileSync(STATE_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('Error loading state:', e);
  }
  return { lastSync: '', downloadedIds: [] };
}

function saveState(state: SyncState): void {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

async function main() {
  console.log('=== Plaud Full Sync ===\n');

  // Ensure sync directory exists
  if (!existsSync(SYNC_PATH)) {
    mkdirSync(SYNC_PATH, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: STORAGE_PATH,
  });

  const page = await context.newPage();

  // Navigate to get auth context
  await page.goto('https://web.plaud.ai/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const token = await page.evaluate(() => localStorage.getItem('tokenstr'));
  console.log('Auth token loaded');

  // Get all files
  const filesResult = await page.evaluate(async (authToken) => {
    const response = await fetch('https://api.plaud.ai/file/simple/web?skip=0&limit=100&is_trash=2&sort_by=start_time&is_desc=true', {
      headers: { 'Authorization': authToken || '' }
    });
    return response.json();
  }, token);

  const files = filesResult.data_file_list || [];
  console.log(`Found ${files.length} total recordings\n`);

  const state = loadState();
  let downloadCount = 0;
  let skipCount = 0;

  for (const file of files) {
    const id = file.id;
    const title = file.filename || 'Untitled';
    const duration = Math.round((file.duration || 0) / 60000);
    const date = new Date(file.start_time).toISOString().split('T')[0];

    console.log(`[${id.slice(0, 8)}] ${title} (${duration}min) - ${date}`);

    if (state.downloadedIds.includes(id)) {
      console.log('  → Already synced\n');
      skipCount++;
      continue;
    }

    // Get full file details from /file/detail endpoint
    console.log('  → Fetching details...');

    const detailResult = await page.evaluate(async ({ fileId, authToken }) => {
      try {
        // Try /file/detail endpoint
        const detailResp = await fetch(`https://api.plaud.ai/file/detail?file_id=${fileId}`, {
          headers: { 'Authorization': authToken || '' }
        });
        return detailResp.json();
      } catch (e) {
        return { error: String(e) };
      }
    }, { fileId: id, authToken: token });

    if (detailResult.data) {
      const data = detailResult.data;

      // Create file directory
      const safeTitle = title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_').slice(0, 50);
      const dirName = `${date}_${safeTitle}_${id.slice(0, 8)}`;
      const dirPath = join(SYNC_PATH, dirName);

      if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
      }

      // Save metadata
      const metadata = {
        id: file.id,
        title: file.filename,
        duration: file.duration,
        startTime: file.start_time,
        endTime: file.end_time,
        filesize: file.filesize,
        filetype: file.filetype,
        isTranscribed: file.is_trans,
        isSummarized: file.is_summary,
        detail: data
      };

      writeFileSync(join(dirPath, 'metadata.json'), JSON.stringify(metadata, null, 2));
      console.log('  → Saved metadata.json');

      // Try to get transcript
      if (data.transcript || data.transcription) {
        const transcript = data.transcript || data.transcription;
        writeFileSync(join(dirPath, 'transcript.txt'),
          typeof transcript === 'string' ? transcript : JSON.stringify(transcript, null, 2));
        console.log('  → Saved transcript.txt');
      }

      // Try to get summary
      if (data.summary) {
        writeFileSync(join(dirPath, 'summary.txt'),
          typeof data.summary === 'string' ? data.summary : JSON.stringify(data.summary, null, 2));
        console.log('  → Saved summary.txt');
      }

      // Try to get audio URL from detail
      if (data.audio_url || data.audioUrl || data.file_url || data.fileUrl || data.ori_url) {
        const audioUrl = data.audio_url || data.audioUrl || data.file_url || data.fileUrl || data.ori_url;
        console.log(`  → Found audio URL: ${audioUrl.slice(0, 80)}...`);

        try {
          const audioResp = await page.request.get(audioUrl);
          if (audioResp.ok()) {
            const buffer = await audioResp.body();
            const ext = file.filetype?.includes('mp3') ? 'mp3' : 'm4a';
            writeFileSync(join(dirPath, `audio.${ext}`), buffer);
            console.log(`  → Downloaded audio.${ext} (${Math.round(buffer.length / 1024)}KB)`);
          }
        } catch (e) {
          console.log(`  → Audio download failed: ${e}`);
        }
      }

      state.downloadedIds.push(id);
      downloadCount++;
      console.log('  → Done\n');
    } else {
      console.log('  → No detail data found');
      console.log('  → Response:', JSON.stringify(detailResult).slice(0, 200));

      // Try alternative endpoints
      const altResult = await page.evaluate(async ({ fileId, authToken }) => {
        // Try various API patterns
        const endpoints = [
          `https://api.plaud.ai/file/${fileId}/info`,
          `https://api.plaud.ai/file/info/${fileId}`,
          `https://api.plaud.ai/file/get/${fileId}`,
          `https://api.plaud.ai/file/content/${fileId}`,
        ];

        const results: Record<string, any> = {};
        for (const endpoint of endpoints) {
          try {
            const resp = await fetch(endpoint, {
              headers: { 'Authorization': authToken || '' }
            });
            results[endpoint] = { status: resp.status, data: await resp.text().then(t => t.slice(0, 200)) };
          } catch (e) {
            results[endpoint] = { error: String(e) };
          }
        }
        return results;
      }, { fileId: id, authToken: token });

      console.log('  → Alt endpoints:', JSON.stringify(altResult, null, 2).slice(0, 500));
      console.log();
    }

    // Rate limit
    await page.waitForTimeout(500);
  }

  // Save state
  state.lastSync = new Date().toISOString();
  saveState(state);

  console.log('\n=== Sync Complete ===');
  console.log(`Downloaded: ${downloadCount}`);
  console.log(`Skipped: ${skipCount}`);

  await browser.close();
}

main().catch(console.error);

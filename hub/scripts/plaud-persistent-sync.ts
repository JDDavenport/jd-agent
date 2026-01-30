/**
 * Plaud Sync using persistent browser context (with Google cookies)
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const USER_DATA_DIR = '/Users/jddavenport/Documents/PlaudSync/.plaud-browser';
const SYNC_PATH = '/Users/jddavenport/Documents/PlaudSync';
const STATE_PATH = join(SYNC_PATH, '.sync-state.json');
const STORAGE_PATH = join(SYNC_PATH, '.plaud-auth.json');

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
  console.log('=== Plaud Sync (Persistent Browser) ===\n');

  // Use persistent context with saved Google cookies
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false, // Need visible browser for potential OAuth
    viewport: { width: 1280, height: 800 },
  });

  const page = context.pages()[0] || await context.newPage();

  // Navigate to Plaud
  console.log('Navigating to Plaud...');
  await page.goto('https://web.plaud.ai/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Check if we need to login
  const url = page.url();
  console.log('Current URL:', url);

  if (url.includes('/login')) {
    console.log('\nSession expired. Please login manually in the browser window.');
    console.log('Click "Continue with Google" and complete the login...');

    // Wait for successful navigation away from login
    try {
      await page.waitForURL(u => !u.toString().includes('/login'), { timeout: 300000 });
      console.log('Login successful!');

      // Save the new storage state
      await context.storageState({ path: STORAGE_PATH });
      console.log('Session saved to:', STORAGE_PATH);
    } catch (e) {
      console.error('Login timeout. Please try again.');
      await context.close();
      process.exit(1);
    }
  }

  // Get auth token
  const token = await page.evaluate(() => localStorage.getItem('tokenstr'));
  if (!token) {
    console.error('No auth token found!');
    await context.close();
    process.exit(1);
  }
  console.log('Auth token loaded\n');

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
    const shortId = id.slice(0, 8);

    console.log(`[${shortId}] ${title} (${duration}min) - ${date}`);

    if (state.downloadedIds.includes(id)) {
      console.log('  → Already synced\n');
      skipCount++;
      continue;
    }

    // Get full file details
    console.log('  → Fetching details...');

    const detailResult = await page.evaluate(async ({ fileId, authToken }) => {
      try {
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
      const dirName = `${date}_${safeTitle}_${shortId}`;
      const dirPath = join(SYNC_PATH, dirName);

      if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
      }

      // Save metadata
      writeFileSync(join(dirPath, 'metadata.json'), JSON.stringify({
        id: file.id,
        title: file.filename,
        duration: file.duration,
        startTime: file.start_time,
        endTime: file.end_time,
        detail: data
      }, null, 2));
      console.log('  → Saved metadata.json');

      // Save transcript if available
      if (data.transcript || data.transcription) {
        const transcript = data.transcript || data.transcription;
        writeFileSync(join(dirPath, 'transcript.txt'),
          typeof transcript === 'string' ? transcript : JSON.stringify(transcript, null, 2));
        console.log('  → Saved transcript.txt');
      }

      // Save summary if available
      if (data.summary) {
        writeFileSync(join(dirPath, 'summary.txt'),
          typeof data.summary === 'string' ? data.summary : JSON.stringify(data.summary, null, 2));
        console.log('  → Saved summary.txt');
      }

      // Download audio if available
      const audioUrl = data.audio_url || data.audioUrl || data.file_url || data.fileUrl || data.ori_url;
      if (audioUrl) {
        console.log('  → Downloading audio...');
        try {
          const audioResp = await page.request.get(audioUrl);
          if (audioResp.ok()) {
            const buffer = await audioResp.body();
            const ext = file.filetype?.includes('mp3') ? 'mp3' : 'm4a';
            writeFileSync(join(dirPath, `audio.${ext}`), buffer);
            console.log(`  → Saved audio.${ext} (${Math.round(buffer.length / 1024)}KB)`);
          }
        } catch (e) {
          console.log(`  → Audio download failed: ${e}`);
        }
      }

      state.downloadedIds.push(id);
      downloadCount++;
      console.log('  → Done\n');
    } else {
      console.log('  → No detail data, skipping\n');
    }

    // Rate limit
    await page.waitForTimeout(500);
  }

  // Save state and session
  state.lastSync = new Date().toISOString();
  saveState(state);
  await context.storageState({ path: STORAGE_PATH });

  console.log('\n=== Sync Complete ===');
  console.log(`Downloaded: ${downloadCount}`);
  console.log(`Skipped: ${skipCount}`);

  await context.close();
}

main().catch(console.error);

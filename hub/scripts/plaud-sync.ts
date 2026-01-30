/**
 * Plaud Sync Script
 *
 * Uses saved session to fetch recordings via API and download new ones
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';

const STORAGE_PATH = '/Users/jddavenport/Documents/PlaudSync/.plaud-auth.json';
const SYNC_PATH = '/Users/jddavenport/Documents/PlaudSync';
const STATE_PATH = join(SYNC_PATH, '.sync-state.json');

interface PlaudFile {
  id: string;
  file_id: string;
  title: string;
  duration: number;
  start_time: string;
  end_time: string;
  audio_url?: string;
  transcript_url?: string;
  summary_url?: string;
  file_type?: string;
  status?: string;
}

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
  console.log('=== Plaud Sync ===');
  console.log('Loading saved session...');

  // Ensure sync directory exists
  if (!existsSync(SYNC_PATH)) {
    mkdirSync(SYNC_PATH, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: STORAGE_PATH,
  });

  const page = await context.newPage();

  // Capture the recordings API response
  let recordings: PlaudFile[] = [];

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('api.plaud.ai/file/simple/web') && url.includes('limit=99999')) {
      try {
        const data = await response.json();
        if (data.data && Array.isArray(data.data)) {
          recordings = data.data;
          console.log(`Captured ${recordings.length} recordings from API`);
        }
      } catch (e) {
        console.error('Error parsing recordings response:', e);
      }
    }
  });

  console.log('Fetching recordings from Plaud...');
  await page.goto('https://web.plaud.ai/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // If we didn't capture from response listener, try direct API call
  if (recordings.length === 0) {
    console.log('Trying direct API call...');

    // Get cookies for API request
    const cookies = await context.cookies();
    const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    // Get localStorage token
    const token = await page.evaluate(() => {
      return localStorage.getItem('tokenstr');
    });

    console.log('Token:', token ? `${token.slice(0, 50)}...` : 'not found');

    // Make API request with auth
    const apiResponse = await page.evaluate(async (authToken) => {
      const response = await fetch('https://api.plaud.ai/file/simple/web?skip=0&limit=99999&is_trash=2&sort_by=start_time&is_desc=true', {
        headers: {
          'Authorization': authToken || '',
        }
      });
      return response.json();
    }, token);

    if (apiResponse.data && Array.isArray(apiResponse.data)) {
      recordings = apiResponse.data;
      console.log(`Got ${recordings.length} recordings from direct API call`);
    }
  }

  if (recordings.length === 0) {
    console.log('No recordings found');
    await browser.close();
    return;
  }

  console.log(`\nFound ${recordings.length} recordings:`);

  // Load sync state
  const state = loadState();
  let downloadCount = 0;
  let skipCount = 0;

  for (const rec of recordings) {
    const id = rec.id || rec.file_id;
    const title = rec.title || 'Untitled';
    const duration = rec.duration || 0;
    const date = rec.start_time ? new Date(rec.start_time).toLocaleDateString() : 'Unknown date';

    console.log(`\n[${id.slice(0, 8)}] ${title} (${Math.round(duration / 60)}min) - ${date}`);

    // Check if already downloaded
    if (state.downloadedIds.includes(id)) {
      console.log('  → Already synced, skipping');
      skipCount++;
      continue;
    }

    // Navigate to recording detail to get download URL
    console.log('  → Fetching download URL...');

    try {
      // Go to the file detail page
      await page.goto(`https://web.plaud.ai/file-detail/${id}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      // Look for audio element or download link
      const audioSrc = await page.evaluate(() => {
        const audio = document.querySelector('audio source, audio');
        if (audio) {
          return audio.getAttribute('src');
        }
        return null;
      });

      if (audioSrc) {
        console.log('  → Found audio URL');

        // Download the audio file
        const response = await page.request.get(audioSrc);
        if (response.ok()) {
          const buffer = await response.body();
          const safeTitle = title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_').slice(0, 50);
          const filename = `${date.replace(/\//g, '-')}_${safeTitle}_${id.slice(0, 8)}.mp3`;
          const filePath = join(SYNC_PATH, filename);

          writeFileSync(filePath, buffer);
          console.log(`  → Downloaded: ${filename} (${Math.round(buffer.length / 1024)}KB)`);

          state.downloadedIds.push(id);
          downloadCount++;
        } else {
          console.log(`  → Download failed: ${response.status()}`);
        }
      } else {
        console.log('  → No audio source found, checking for API...');

        // Try to get file info from API
        const token = await page.evaluate(() => localStorage.getItem('tokenstr'));

        const fileInfo = await page.evaluate(async ({ fileId, authToken }) => {
          const response = await fetch(`https://api.plaud.ai/file/${fileId}`, {
            headers: {
              'Authorization': authToken || '',
            }
          });
          return response.json();
        }, { fileId: id, authToken: token });

        console.log('  → File info:', JSON.stringify(fileInfo).slice(0, 200));

        if (fileInfo.data?.audio_url) {
          console.log('  → Found audio_url in API response');
          const response = await page.request.get(fileInfo.data.audio_url);
          if (response.ok()) {
            const buffer = await response.body();
            const safeTitle = title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_').slice(0, 50);
            const filename = `${date.replace(/\//g, '-')}_${safeTitle}_${id.slice(0, 8)}.mp3`;
            const filePath = join(SYNC_PATH, filename);

            writeFileSync(filePath, buffer);
            console.log(`  → Downloaded: ${filename} (${Math.round(buffer.length / 1024)}KB)`);

            state.downloadedIds.push(id);
            downloadCount++;
          }
        }
      }
    } catch (e) {
      console.error(`  → Error: ${e}`);
    }

    // Rate limit
    await page.waitForTimeout(1000);
  }

  // Save state
  state.lastSync = new Date().toISOString();
  saveState(state);

  console.log(`\n=== Sync Complete ===`);
  console.log(`Downloaded: ${downloadCount}`);
  console.log(`Skipped: ${skipCount}`);
  console.log(`State saved to: ${STATE_PATH}`);

  await browser.close();
}

main().catch(console.error);

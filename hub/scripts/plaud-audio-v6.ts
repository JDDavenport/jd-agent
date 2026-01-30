/**
 * Plaud Download Audio v6 - Use the download endpoint that returned 200
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const STORAGE_PATH = '/Users/jddavenport/Documents/PlaudSync/.plaud-auth.json';
const SYNC_PATH = '/Users/jddavenport/Documents/PlaudSync';

async function main() {
  console.log('=== Plaud Audio Download v6 ===\n');

  const browser = await chromium.launch({
    headless: false,
    downloadsPath: SYNC_PATH,
  });

  const context = await browser.newContext({
    storageState: STORAGE_PATH,
    acceptDownloads: true,
  });

  const page = await context.newPage();

  await page.goto('https://web.plaud.ai/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const token = await page.evaluate(() => localStorage.getItem('tokenstr'));
  console.log('Token:', token?.slice(0, 50) + '...');

  // Get files via API
  const files = await page.evaluate(async (authToken) => {
    const resp = await fetch('https://api.plaud.ai/file/simple/web?skip=0&limit=10&is_trash=2&sort_by=start_time&is_desc=true', {
      headers: { 'Authorization': authToken || '' }
    });
    return (await resp.json()).data_file_list || [];
  }, token);

  const file = files[0];
  console.log(`\nTarget: ${file.filename}`);
  console.log(`ID: ${file.id}`);
  console.log(`Size: ${Math.round(file.filesize / 1024 / 1024 * 10) / 10} MB\n`);

  // Get detailed file info
  console.log('Fetching file details...');
  const detailsResp = await page.evaluate(async (args) => {
    const resp = await fetch(`https://api.plaud.ai/file/detail/${args.fileId}`, {
      headers: { 'Authorization': args.token || '' }
    });
    return await resp.json();
  }, { fileId: file.id, token });

  // Extract the actual data
  const details = detailsResp.data || detailsResp;
  console.log('Detail keys:', Object.keys(details));

  // Print all fields
  console.log('\nAll detail fields:');
  for (const [key, value] of Object.entries(details)) {
    if (typeof value === 'string' && value.length > 100) {
      console.log(`  ${key}: ${value.slice(0, 100)}...`);
    } else if (Array.isArray(value)) {
      console.log(`  ${key}: [${value.length} items]`);
    } else {
      console.log(`  ${key}:`, value);
    }
  }

  // Check content_list for audio
  if (details.content_list) {
    console.log('\nContent list:');
    for (const item of details.content_list) {
      console.log(`  - data_type: ${item.data_type}`);
      if (item.data_link) {
        console.log(`    data_link: ${item.data_link.slice(0, 80)}...`);
      }
    }
  }

  // Check the download endpoint
  console.log('\n\nChecking /file/download endpoint...');
  const downloadResult = await page.evaluate(async (args) => {
    try {
      const resp = await fetch(`https://api.plaud.ai/file/download/${args.fileId}`, {
        headers: { 'Authorization': args.token || '' }
      });

      const contentType = resp.headers.get('content-type') || '';
      const contentLength = resp.headers.get('content-length') || '';

      if (contentType.includes('audio') || contentType.includes('octet-stream')) {
        // It's a binary file - return metadata only
        return {
          status: resp.status,
          contentType,
          contentLength,
          isBinary: true
        };
      }

      // It's likely JSON
      const data = await resp.json();
      return {
        status: resp.status,
        contentType,
        data
      };
    } catch (e) {
      return { error: String(e) };
    }
  }, { fileId: file.id, token });

  console.log('Download endpoint result:');
  console.log(JSON.stringify(downloadResult, null, 2));

  // If we got data with a URL, try to download it
  if (downloadResult.data) {
    const data = downloadResult.data;
    console.log('\nLooking for download URL in response...');

    // Look for any URL-like fields
    const findUrls = (obj: any, path = ''): string[] => {
      const urls: string[] = [];
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        if (typeof value === 'string' && (value.startsWith('http') || value.includes('.m4a') || value.includes('.mp3'))) {
          console.log(`  Found URL at ${currentPath}: ${value.slice(0, 100)}...`);
          urls.push(value);
        } else if (typeof value === 'object' && value !== null) {
          urls.push(...findUrls(value, currentPath));
        }
      }
      return urls;
    };

    const urls = findUrls(data);
    console.log(`\nFound ${urls.length} URLs`);

    // Try downloading the first audio URL
    for (const url of urls) {
      if (url.includes('audio') || url.includes('.m4a') || url.includes('.mp3') || url.includes('.aac')) {
        console.log(`\nDownloading audio from: ${url.slice(0, 100)}...`);

        try {
          // Use page to download (respects auth)
          const audioData = await page.evaluate(async (audioUrl) => {
            const resp = await fetch(audioUrl);
            if (!resp.ok) return { error: `HTTP ${resp.status}` };

            const blob = await resp.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);

            // Convert to base64 for transfer
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            return {
              size: bytes.length,
              type: blob.type,
              base64: btoa(binary)
            };
          }, url);

          if (audioData.error) {
            console.log('Error:', audioData.error);
            continue;
          }

          console.log(`Downloaded ${Math.round(audioData.size / 1024 / 1024 * 10) / 10} MB, type: ${audioData.type}`);

          // Create directory
          const date = new Date(file.start_time).toISOString().split('T')[0];
          const safeName = file.filename.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
          const dirPath = join(SYNC_PATH, `${date}_${safeName}_${file.id.slice(0, 8)}`);

          if (!existsSync(dirPath)) {
            mkdirSync(dirPath, { recursive: true });
          }

          // Determine extension from content type
          let ext = '.m4a';
          if (audioData.type.includes('mp3')) ext = '.mp3';
          else if (audioData.type.includes('wav')) ext = '.wav';
          else if (audioData.type.includes('ogg')) ext = '.ogg';

          // Save file
          const audioBuffer = Buffer.from(audioData.base64, 'base64');
          const audioPath = join(dirPath, `audio${ext}`);
          writeFileSync(audioPath, audioBuffer);

          console.log(`\n*** SAVED: ${audioPath} ***`);
          break;
        } catch (e) {
          console.log('Download error:', e);
        }
      }
    }
  }

  // Also try to get audio URL from the playback endpoint
  console.log('\n\nTrying playback endpoint...');
  const playbackResult = await page.evaluate(async (args) => {
    try {
      const resp = await fetch(`https://api.plaud.ai/file/playback/${args.fileId}`, {
        headers: { 'Authorization': args.token || '' }
      });
      return await resp.json();
    } catch (e) {
      return { error: String(e) };
    }
  }, { fileId: file.id, token });

  console.log('Playback result:', JSON.stringify(playbackResult, null, 2).slice(0, 500));

  await page.waitForTimeout(3000);
  await browser.close();
}

main().catch(console.error);

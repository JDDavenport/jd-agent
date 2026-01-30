/**
 * Plaud Download Audio v7 - Download binary from /file/download endpoint
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const STORAGE_PATH = '/Users/jddavenport/Documents/PlaudSync/.plaud-auth.json';
const SYNC_PATH = '/Users/jddavenport/Documents/PlaudSync';

async function main() {
  console.log('=== Plaud Audio Download v7 ===\n');

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
  console.log('Token obtained');

  // Get files via API
  const files = await page.evaluate(async (authToken) => {
    const resp = await fetch('https://api.plaud.ai/file/simple/web?skip=0&limit=10&is_trash=2&sort_by=start_time&is_desc=true', {
      headers: { 'Authorization': authToken || '' }
    });
    return (await resp.json()).data_file_list || [];
  }, token);

  console.log(`Found ${files.length} files\n`);

  // Process each file
  for (const file of files) {
    console.log(`\n=== ${file.filename} ===`);
    console.log(`ID: ${file.id}`);
    console.log(`Size: ${Math.round(file.filesize / 1024 / 1024 * 10) / 10} MB`);

    // Create directory
    const date = new Date(file.start_time).toISOString().split('T')[0];
    const safeName = file.filename.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
    const dirPath = join(SYNC_PATH, `${date}_${safeName}_${file.id.slice(0, 8)}`);

    const audioPath = join(dirPath, 'audio.m4a');

    // Check if already downloaded
    if (existsSync(audioPath)) {
      console.log('Already downloaded, skipping...');
      continue;
    }

    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }

    // Download audio from the binary endpoint
    console.log('Downloading audio...');

    try {
      // Download as blob in browser context, then save
      const result = await page.evaluate(async (args) => {
        try {
          const resp = await fetch(`https://api.plaud.ai/file/download/${args.fileId}`, {
            headers: { 'Authorization': args.token || '' }
          });

          if (!resp.ok) {
            return { error: `HTTP ${resp.status}` };
          }

          const contentType = resp.headers.get('content-type') || '';
          const blob = await resp.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);

          // Convert to base64 in chunks to avoid stack overflow
          const CHUNK_SIZE = 8192;
          let base64 = '';
          for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
            const chunk = bytes.slice(i, i + CHUNK_SIZE);
            let binary = '';
            for (let j = 0; j < chunk.length; j++) {
              binary += String.fromCharCode(chunk[j]);
            }
            base64 += btoa(binary);
          }

          // Wait, that's wrong - we need proper base64
          // Let's use a different approach
          return {
            size: bytes.length,
            type: contentType,
            // Return array of numbers for first 1000 bytes to check format
            header: Array.from(bytes.slice(0, 1000))
          };
        } catch (e) {
          return { error: String(e) };
        }
      }, { fileId: file.id, token });

      if (result.error) {
        console.log('Error:', result.error);
        continue;
      }

      console.log(`Got ${result.size} bytes, type: ${result.type}`);

      // Check file header to determine format
      const header = Buffer.from(result.header);
      const headerStr = header.toString('ascii', 0, 20);
      console.log('File header:', headerStr.replace(/[^\x20-\x7E]/g, '.'));

      // ftyp = m4a/mp4, ID3 = mp3, RIFF = wav
      let ext = '.m4a';
      if (header.indexOf('ID3') === 0 || (header[0] === 0xff && (header[1] & 0xe0) === 0xe0)) {
        ext = '.mp3';
      } else if (header.toString('ascii', 0, 4) === 'RIFF') {
        ext = '.wav';
      } else if (header.toString('ascii', 0, 4) === 'OggS') {
        ext = '.ogg';
      }

      console.log(`Detected format: ${ext}`);

      // Now download the full file using page navigation
      // This triggers proper download handling
      const downloadUrl = `https://api.plaud.ai/file/download/${file.id}`;

      // Navigate to trigger download
      const downloadPromise = page.waitForEvent('download', { timeout: 120000 });

      // Use a new page to avoid navigating away
      const downloadPage = await context.newPage();

      // Set authorization header for the request
      await downloadPage.setExtraHTTPHeaders({
        'Authorization': token || ''
      });

      await downloadPage.goto(downloadUrl);

      try {
        const download = await downloadPromise;
        const filename = download.suggestedFilename() || `audio${ext}`;
        const savePath = join(dirPath, filename);
        await download.saveAs(savePath);
        console.log(`*** SAVED: ${savePath} ***`);
      } catch (e) {
        // If no download event, the page might have received the content directly
        // Let's try a different approach - use evaluate to save
        console.log('No download event, saving via buffer...');

        // Re-fetch and get full data
        const fullData = await page.evaluate(async (args) => {
          const resp = await fetch(`https://api.plaud.ai/file/download/${args.fileId}`, {
            headers: { 'Authorization': args.token || '' }
          });

          if (!resp.ok) return null;

          const blob = await resp.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);

          // Convert to hex string (more reliable than base64 for binary)
          let hex = '';
          for (let i = 0; i < bytes.length; i++) {
            hex += bytes[i].toString(16).padStart(2, '0');
          }
          return hex;
        }, { fileId: file.id, token });

        if (fullData) {
          const audioBuffer = Buffer.from(fullData, 'hex');
          const savePath = join(dirPath, `audio${ext}`);
          writeFileSync(savePath, audioBuffer);
          console.log(`*** SAVED: ${savePath} (${Math.round(audioBuffer.length / 1024 / 1024 * 10) / 10} MB) ***`);
        }
      }

      await downloadPage.close();

    } catch (e) {
      console.log('Error downloading:', e);
    }

    // Only do first file for now
    break;
  }

  await page.waitForTimeout(3000);
  await browser.close();
}

main().catch(console.error);

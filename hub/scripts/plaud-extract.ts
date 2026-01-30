/**
 * Plaud Extract - Get file details including audio and transcript
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const STORAGE_PATH = '/Users/jddavenport/Documents/PlaudSync/.plaud-auth.json';
const SYNC_PATH = '/Users/jddavenport/Documents/PlaudSync';

async function main() {
  console.log('=== Plaud Extract ===\n');

  if (!existsSync(SYNC_PATH)) {
    mkdirSync(SYNC_PATH, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: STORAGE_PATH,
  });

  const page = await context.newPage();

  // Capture detailed API responses
  const apiResponses: Record<string, any> = {};

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('api.plaud.ai') && !url.includes('posthog')) {
      try {
        const data = await response.json();
        apiResponses[url] = data;
      } catch (e) {}
    }
  });

  // Navigate
  await page.goto('https://web.plaud.ai/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const token = await page.evaluate(() => localStorage.getItem('tokenstr'));
  console.log('Loaded auth token');

  // Get file list
  const files = await page.evaluate(async (authToken) => {
    const response = await fetch('https://api.plaud.ai/file/simple/web?skip=0&limit=10&is_trash=2&sort_by=start_time&is_desc=true', {
      headers: { 'Authorization': authToken || '' }
    });
    return response.json();
  }, token);

  console.log(`Found ${files.data_file_total} files\n`);

  for (const file of files.data_file_list || []) {
    console.log(`\n=== ${file.filename} ===`);
    console.log(`ID: ${file.id}`);
    console.log(`Duration: ${Math.round(file.duration / 60000)} min`);
    console.log(`Size: ${Math.round(file.filesize / 1024 / 1024 * 10) / 10} MB`);
    console.log(`File: ${file.fullname}`);
    console.log(`Is transcribed: ${file.is_trans}`);
    console.log(`Is summarized: ${file.is_summary}`);

    // Get file detail
    const detail = await page.evaluate(async ({ fileId, authToken }) => {
      const resp = await fetch(`https://api.plaud.ai/file/detail/${fileId}`, {
        headers: { 'Authorization': authToken || '' }
      });
      return resp.json();
    }, { fileId: file.id, authToken: token });

    if (detail.data) {
      console.log('\nDetail data keys:', Object.keys(detail.data).join(', '));

      // Check for audio URL
      const d = detail.data;
      for (const key of ['audio_url', 'audioUrl', 'file_url', 'fileUrl', 'ori_url', 'oriUrl', 'media_url', 'mediaUrl', 's3_url']) {
        if (d[key]) {
          console.log(`${key}: ${d[key]}`);
        }
      }

      // Check for transcript
      if (d.transcript || d.transcription || d.trans) {
        console.log('Has transcript: YES');
      }
      if (d.summary) {
        console.log('Has summary: YES');
      }

      // Save full detail to file for analysis
      const safeName = file.filename.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
      writeFileSync(
        join(SYNC_PATH, `${safeName}_${file.id.slice(0, 8)}_detail.json`),
        JSON.stringify(detail.data, null, 2)
      );
      console.log(`Saved detail to ${safeName}_${file.id.slice(0, 8)}_detail.json`);
    }

    // Try transcript endpoint
    console.log('\nTrying transcript endpoint...');
    const transcript = await page.evaluate(async ({ fileId, authToken }) => {
      const resp = await fetch(`https://api.plaud.ai/file/transcript/${fileId}`, {
        headers: { 'Authorization': authToken || '' }
      });
      return { status: resp.status, data: await resp.text().then(t => t.slice(0, 1000)) };
    }, { fileId: file.id, authToken: token });

    console.log(`/file/transcript/:id - ${transcript.status}`);
    if (transcript.status === 200) {
      console.log(transcript.data.slice(0, 300));
    }

    // Try summary endpoint
    const summary = await page.evaluate(async ({ fileId, authToken }) => {
      const resp = await fetch(`https://api.plaud.ai/file/summary/${fileId}`, {
        headers: { 'Authorization': authToken || '' }
      });
      return { status: resp.status, data: await resp.text().then(t => t.slice(0, 1000)) };
    }, { fileId: file.id, authToken: token });

    console.log(`/file/summary/:id - ${summary.status}`);
    if (summary.status === 200) {
      console.log(summary.data.slice(0, 300));
    }

    // Try content endpoint
    const content = await page.evaluate(async ({ fileId, authToken }) => {
      const resp = await fetch(`https://api.plaud.ai/file/content/${fileId}`, {
        headers: { 'Authorization': authToken || '' }
      });
      return { status: resp.status, data: await resp.text().then(t => t.slice(0, 1000)) };
    }, { fileId: file.id, authToken: token });

    console.log(`/file/content/:id - ${content.status}`);
    if (content.status === 200) {
      console.log(content.data.slice(0, 300));
    }

    // Try ori (original) endpoint
    const ori = await page.evaluate(async ({ fileId, authToken }) => {
      const resp = await fetch(`https://api.plaud.ai/file/ori?file_id=${fileId}`, {
        headers: { 'Authorization': authToken || '' }
      });
      return { status: resp.status, data: await resp.text().then(t => t.slice(0, 1000)) };
    }, { fileId: file.id, authToken: token });

    console.log(`/file/ori?file_id= - ${ori.status}`);
    if (ori.status === 200) {
      console.log(ori.data.slice(0, 500));

      // If we got a URL, try to download
      try {
        const oriData = JSON.parse(ori.data);
        if (oriData.data?.url || oriData.url) {
          const audioUrl = oriData.data?.url || oriData.url;
          console.log(`\nAudio URL found: ${audioUrl.slice(0, 100)}...`);

          // Download the audio
          const audioResp = await page.request.get(audioUrl);
          if (audioResp.ok()) {
            const buffer = await audioResp.body();
            const safeName = file.filename.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
            const ext = file.fullname?.split('.').pop() || 'ogg';
            const audioPath = join(SYNC_PATH, `${safeName}_${file.id.slice(0, 8)}.${ext}`);
            writeFileSync(audioPath, buffer);
            console.log(`Downloaded audio: ${audioPath} (${Math.round(buffer.length / 1024 / 1024 * 10) / 10}MB)`);
          }
        }
      } catch (e) {
        console.log('Could not parse ori response');
      }
    }

    // Only process first 2 files for testing
    if (files.data_file_list.indexOf(file) >= 1) {
      console.log('\n(Stopping after 2 files for testing)');
      break;
    }
  }

  // Print captured API URLs
  console.log('\n=== All captured API endpoints ===');
  for (const url of Object.keys(apiResponses)) {
    console.log(url.slice(0, 100));
  }

  await browser.close();
  console.log('\nDone!');
}

main().catch(console.error);

/**
 * Plaud Download Audio v5 - Find audio source directly
 * Instead of clicking UI, find the audio element or API requests
 */

import { chromium } from 'playwright';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { gunzipSync } from 'zlib';

const STORAGE_PATH = '/Users/jddavenport/Documents/PlaudSync/.plaud-auth.json';
const SYNC_PATH = '/Users/jddavenport/Documents/PlaudSync';

async function main() {
  console.log('=== Plaud Audio Download v5 ===\n');

  const browser = await chromium.launch({
    headless: false,
    downloadsPath: SYNC_PATH,
  });

  const context = await browser.newContext({
    storageState: STORAGE_PATH,
    acceptDownloads: true,
  });

  const page = await context.newPage();

  // Track all network requests for audio files
  const audioUrls: string[] = [];

  page.on('request', request => {
    const url = request.url();
    if (url.includes('.mp3') || url.includes('.m4a') || url.includes('.wav') ||
        url.includes('audio') || url.includes('.aac') || url.includes('.ogg')) {
      console.log('Audio request:', url.slice(0, 100));
      audioUrls.push(url);
    }
  });

  page.on('response', async response => {
    const contentType = response.headers()['content-type'] || '';
    if (contentType.includes('audio')) {
      console.log('Audio response:', response.url().slice(0, 100));
      audioUrls.push(response.url());
    }
  });

  // Close modal helper
  const closeModal = async () => {
    await page.evaluate(() => {
      document.querySelectorAll('.modal-overlay').forEach(el => (el as HTMLElement).remove());
    });
  };

  // Navigate to home
  await page.goto('https://web.plaud.ai/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await closeModal();

  const token = await page.evaluate(() => localStorage.getItem('tokenstr'));

  // Get files via API
  const files = await page.evaluate(async (authToken) => {
    const resp = await fetch('https://api.plaud.ai/file/simple/web?skip=0&limit=10&is_trash=2&sort_by=start_time&is_desc=true', {
      headers: { 'Authorization': authToken || '' }
    });
    return (await resp.json()).data_file_list || [];
  }, token);

  const file = files[0];
  console.log(`Target: ${file.filename}`);
  console.log(`ID: ${file.id}`);
  console.log(`Size: ${Math.round(file.filesize / 1024 / 1024 * 10) / 10} MB\n`);

  // Get detailed file info via API
  console.log('Fetching file details...');
  const details = await page.evaluate(async (args) => {
    const resp = await fetch(`https://api.plaud.ai/file/detail/${args.fileId}`, {
      headers: { 'Authorization': args.token || '' }
    });
    return await resp.json();
  }, { fileId: file.id, token });

  console.log('File details keys:', Object.keys(details));

  // Look for audio URL in the content_list
  if (details.content_list) {
    console.log('\nContent list items:');
    for (const item of details.content_list) {
      console.log(`  - ${item.data_type}: ${item.data_link?.slice(0, 80)}...`);

      // Look for audio type
      if (item.data_type?.includes('audio') || item.data_type?.includes('record')) {
        console.log('\n*** Found audio content! ***');
        console.log('Full URL:', item.data_link);
      }
    }
  }

  // Check for audio_link or similar fields
  const audioFields = Object.entries(details).filter(([key]) =>
    key.toLowerCase().includes('audio') ||
    key.toLowerCase().includes('record') ||
    key.toLowerCase().includes('media') ||
    key.toLowerCase().includes('file')
  );

  if (audioFields.length > 0) {
    console.log('\nAudio-related fields:');
    for (const [key, value] of audioFields) {
      console.log(`  ${key}:`, typeof value === 'string' ? value.slice(0, 100) : value);
    }
  }

  // Navigate to file page and look for audio element
  console.log('\nNavigating to file page...');
  await page.goto(`https://web.plaud.ai/file/${file.id}`);
  await page.waitForTimeout(4000);
  await closeModal();

  // Check for audio elements in the DOM
  const audioInfo = await page.evaluate(() => {
    const audioElements = document.querySelectorAll('audio, video');
    const sources: { tag: string; src: string; type: string }[] = [];

    audioElements.forEach(el => {
      const src = el.getAttribute('src');
      if (src) sources.push({ tag: el.tagName, src, type: 'element' });

      el.querySelectorAll('source').forEach(source => {
        const srcUrl = source.getAttribute('src');
        if (srcUrl) sources.push({ tag: 'source', src: srcUrl, type: 'source' });
      });
    });

    // Also look for audio player controls
    const players = document.querySelectorAll('[class*="audio"], [class*="player"], [class*="waveform"]');
    const playerInfo = Array.from(players).map(p => ({
      class: (p as HTMLElement).className?.toString().slice(0, 50),
      hasPlay: p.querySelector('[class*="play"]') !== null
    }));

    return { sources, playerInfo };
  });

  console.log('\nAudio elements found:', audioInfo.sources);
  console.log('Player controls:', audioInfo.playerInfo);

  // Check network requests captured
  console.log('\nAudio URLs captured:', audioUrls);

  // Try clicking play button to trigger audio load
  console.log('\nLooking for play button...');
  const playClicked = await page.evaluate(() => {
    const playBtns = document.querySelectorAll('[class*="play"], button:has(svg path[d*="M8"]), [class*="audio"] button');
    for (const btn of playBtns) {
      if ((btn as HTMLElement).offsetParent !== null) {
        (btn as HTMLElement).click();
        return true;
      }
    }
    return false;
  });

  console.log('Play button clicked:', playClicked);
  await page.waitForTimeout(3000);

  // Check again for audio URLs
  console.log('Audio URLs after play:', audioUrls);

  // Check for any blob URLs or audio sources now
  const audioSources = await page.evaluate(() => {
    const audios = document.querySelectorAll('audio');
    return Array.from(audios).map(a => ({
      src: a.src,
      currentSrc: a.currentSrc,
      duration: a.duration
    }));
  });

  console.log('Audio sources after play:', audioSources);

  // Try to find the download through the API directly
  console.log('\nTrying download API...');

  // Try various download endpoints
  const downloadEndpoints = [
    `https://api.plaud.ai/file/download/${file.id}`,
    `https://api.plaud.ai/file/audio/${file.id}`,
    `https://api.plaud.ai/file/export/${file.id}`,
    `https://api.plaud.ai/file/${file.id}/download`,
    `https://api.plaud.ai/file/${file.id}/audio`,
  ];

  for (const endpoint of downloadEndpoints) {
    const result = await page.evaluate(async (args) => {
      try {
        const resp = await fetch(args.url, {
          headers: { 'Authorization': args.token || '' }
        });
        const contentType = resp.headers.get('content-type');
        if (resp.ok && contentType?.includes('audio')) {
          return { url: args.url, status: resp.status, contentType, hasAudio: true };
        }
        const text = await resp.text();
        return { url: args.url, status: resp.status, contentType, body: text.slice(0, 200) };
      } catch (e) {
        return { url: args.url, error: String(e) };
      }
    }, { url: endpoint, token });

    console.log(`${endpoint}:`, result.status || result.error);
    if (result.hasAudio) {
      console.log('*** FOUND AUDIO ENDPOINT! ***');
    }
  }

  // Last resort: take a screenshot and look at the page structure
  await page.screenshot({ path: '/tmp/plaud-v5-page.png', fullPage: true });
  console.log('\nScreenshot saved to /tmp/plaud-v5-page.png');

  // Print all data types in content_list
  if (details.content_list) {
    console.log('\nAll data_type values:');
    const types = details.content_list.map((item: any) => item.data_type);
    console.log(types);
  }

  await page.waitForTimeout(5000);
  await browser.close();
}

main().catch(console.error);

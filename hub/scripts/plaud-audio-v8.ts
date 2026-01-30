/**
 * Plaud Download Audio v8 - Direct HTTP download using saved token
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, createWriteStream } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';

const STORAGE_PATH = '/Users/jddavenport/Documents/PlaudSync/.plaud-auth.json';
const SYNC_PATH = '/Users/jddavenport/Documents/PlaudSync';

async function getToken(): Promise<string> {
  const storage = JSON.parse(readFileSync(STORAGE_PATH, 'utf-8'));

  // Find token in localStorage
  for (const origin of storage.origins || []) {
    for (const item of origin.localStorage || []) {
      if (item.name === 'tokenstr') {
        return item.value;
      }
    }
  }

  throw new Error('Token not found in storage');
}

async function main() {
  console.log('=== Plaud Audio Download v8 ===\n');

  const token = await getToken();
  console.log('Token loaded from storage');

  // Get files list
  const filesResp = await fetch('https://api.plaud.ai/file/simple/web?skip=0&limit=10&is_trash=2&sort_by=start_time&is_desc=true', {
    headers: { 'Authorization': token }
  });

  const filesData = await filesResp.json();
  const files = filesData.data_file_list || [];

  console.log(`Found ${files.length} files\n`);

  for (const file of files) {
    console.log(`\n=== ${file.filename} ===`);
    console.log(`ID: ${file.id}`);
    console.log(`Size: ${Math.round(file.filesize / 1024 / 1024 * 10) / 10} MB`);

    // Create directory
    const date = new Date(file.start_time).toISOString().split('T')[0];
    const safeName = file.filename.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
    const dirPath = join(SYNC_PATH, `${date}_${safeName}_${file.id.slice(0, 8)}`);

    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }

    // Check if already downloaded
    const possiblePaths = [
      join(dirPath, 'audio.m4a'),
      join(dirPath, 'audio.mp3'),
      join(dirPath, 'audio.wav'),
    ];

    if (possiblePaths.some(p => existsSync(p))) {
      console.log('Already downloaded, skipping...');
      continue;
    }

    // Download audio
    console.log('Downloading audio...');

    try {
      const downloadResp = await fetch(`https://api.plaud.ai/file/download/${file.id}`, {
        headers: { 'Authorization': token }
      });

      if (!downloadResp.ok) {
        console.log(`Error: HTTP ${downloadResp.status}`);
        continue;
      }

      const contentType = downloadResp.headers.get('content-type') || '';
      console.log(`Content-Type: ${contentType}`);

      // Get the binary data
      const arrayBuffer = await downloadResp.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      console.log(`Downloaded: ${Math.round(buffer.length / 1024 / 1024 * 10) / 10} MB`);

      // Detect file format from header
      let ext = '.m4a';
      const header = buffer.toString('ascii', 0, 12);

      if (header.indexOf('ID3') === 0 || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) {
        ext = '.mp3';
      } else if (header.indexOf('RIFF') === 0) {
        ext = '.wav';
      } else if (header.indexOf('OggS') === 0) {
        ext = '.ogg';
      } else if (header.indexOf('ftyp') >= 0) {
        ext = '.m4a';
      }

      // Check if it's actually gzipped JSON (transcript, not audio)
      if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
        console.log('Warning: Response is gzipped - might be transcript, not audio');
        console.log('Skipping...');
        continue;
      }

      const audioPath = join(dirPath, `audio${ext}`);
      writeFileSync(audioPath, buffer);

      console.log(`*** SAVED: ${audioPath} ***`);

    } catch (e) {
      console.log('Error downloading:', e);
    }
  }

  console.log('\n=== Done ===');
}

main().catch(console.error);

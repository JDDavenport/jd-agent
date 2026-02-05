/**
 * Test Deepgram transcription on a single file
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { createClient } from '@deepgram/sdk';

async function main() {
  console.log('=== Test Deepgram ===\n');

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    console.error('DEEPGRAM_API_KEY not set');
    process.exit(1);
  }
  console.log('API Key:', apiKey.slice(0, 8) + '...');

  // Find a small audio file
  const syncPath = '/Users/jddavenport/Documents/PlaudSync';
  const dirs = readdirSync(syncPath).filter(d => d.startsWith('2026'));
  
  let testFile: string | null = null;
  let testSize = Infinity;
  
  for (const dir of dirs) {
    const audioPath = join(syncPath, dir, 'audio.ogg');
    if (existsSync(audioPath)) {
      const stats = require('fs').statSync(audioPath);
      // Find a small but non-empty file (1-5 MB)
      if (stats.size > 1000000 && stats.size < 5000000 && stats.size < testSize) {
        testFile = audioPath;
        testSize = stats.size;
      }
    }
  }

  if (!testFile) {
    console.error('No suitable test file found');
    process.exit(1);
  }

  console.log(`Test file: ${testFile}`);
  console.log(`Size: ${Math.round(testSize / 1024)} KB\n`);

  // Read the file
  const buffer = readFileSync(testFile);
  console.log(`Buffer size: ${buffer.length} bytes`);

  // Create client
  const client = createClient(apiKey);

  console.log('\nSending to Deepgram...');
  const startTime = Date.now();

  try {
    const response = await client.listen.prerecorded.transcribeFile(
      buffer,
      {
        model: 'nova-2',
        smart_format: true,
        diarize: true,
        punctuate: true,
      }
    );

    const duration = Date.now() - startTime;
    console.log(`Response received in ${duration}ms`);
    
    if (response.result) {
      console.log('\n✅ Transcription successful!');
      const transcript = response.result.results?.channels?.[0]?.alternatives?.[0]?.transcript;
      console.log(`\nTranscript (first 500 chars):\n${transcript?.slice(0, 500)}`);
      console.log(`\nWord count: ${transcript?.split(' ').length || 0}`);
    } else {
      console.log('\n❌ No result returned');
      console.log('Response:', JSON.stringify(response, null, 2).slice(0, 1000));
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

main().catch(console.error);

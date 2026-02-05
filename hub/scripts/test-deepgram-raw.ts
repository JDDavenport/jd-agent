/**
 * Test Deepgram transcription using raw fetch API
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('=== Test Deepgram (Raw) ===\n');

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
      const stats = statSync(audioPath);
      // Find a small but non-empty file (1-3 MB)
      if (stats.size > 1000000 && stats.size < 3000000 && stats.size < testSize) {
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

  console.log('\nSending to Deepgram (raw fetch)...');
  const startTime = Date.now();

  try {
    const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&diarize=true&punctuate=true', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'audio/ogg',
      },
      body: buffer,
    });

    const duration = Date.now() - startTime;
    console.log(`Response status: ${response.status}`);
    console.log(`Response received in ${duration}ms`);
    
    const data = await response.json();
    
    if (response.ok && data.results) {
      console.log('\n✅ Transcription successful!');
      const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript;
      console.log(`\nTranscript (first 500 chars):\n${transcript?.slice(0, 500)}`);
      console.log(`\nWord count: ${transcript?.split(' ').length || 0}`);
    } else {
      console.log('\n❌ Error response:');
      console.log(JSON.stringify(data, null, 2).slice(0, 1000));
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

main().catch(console.error);

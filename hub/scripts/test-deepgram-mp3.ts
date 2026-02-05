/**
 * Test Deepgram transcription with MP3 file
 */

import { readFileSync } from 'fs';

async function main() {
  console.log('=== Test Deepgram (MP3) ===\n');

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    console.error('DEEPGRAM_API_KEY not set');
    process.exit(1);
  }
  console.log('API Key:', apiKey.slice(0, 8) + '...');

  // Read the converted MP3 file
  const testFile = '/tmp/test-audio.mp3';
  const buffer = readFileSync(testFile);
  console.log(`Test file: ${testFile}`);
  console.log(`Buffer size: ${buffer.length} bytes\n`);

  console.log('Sending to Deepgram...');
  const startTime = Date.now();

  try {
    const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&diarize=true&punctuate=true', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'audio/mp3',
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
      console.log(`\nTranscript (first 1000 chars):\n${transcript?.slice(0, 1000)}`);
      console.log(`\n\nWord count: ${transcript?.split(' ').length || 0}`);
    } else {
      console.log('\n❌ Error response:');
      console.log(JSON.stringify(data, null, 2).slice(0, 1000));
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

main().catch(console.error);

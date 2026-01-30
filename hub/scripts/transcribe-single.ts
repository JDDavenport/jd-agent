/**
 * Transcribe a single Plaud audio file with Deepgram
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { deepgramIntegration } from '../src/integrations/deepgram';

const DIR = '/Users/jddavenport/Documents/PlaudSync/2026-01-14_2026_01_14_09_41_07_4e94c983';

async function main() {
  console.log('=== Transcribing New Recording ===\n');

  if (!deepgramIntegration.isReady()) {
    console.error('Deepgram not configured. Set DEEPGRAM_API_KEY environment variable.');
    process.exit(1);
  }

  const audioPath = join(DIR, 'audio.mp3');
  console.log(`Audio: ${audioPath}`);

  const audioBuffer = readFileSync(audioPath);
  console.log(`Size: ${Math.round(audioBuffer.length / 1024 / 1024 * 10) / 10} MB`);

  console.log('\nTranscribing with Deepgram (this may take a few minutes for long audio)...');
  const startTime = Date.now();

  const result = await deepgramIntegration.transcribeBuffer(audioBuffer, 'audio/mpeg');

  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log(`\nTranscription completed in ${duration}s`);

  if (!result.success) {
    console.error('Transcription failed:', result.error);
    process.exit(1);
  }

  console.log(`Words: ${result.wordCount}`);
  console.log(`Speakers: ${result.speakerCount}`);
  console.log(`Duration: ${Math.round((result.duration || 0) / 60)} minutes`);
  console.log(`Confidence: ${Math.round((result.confidence || 0) * 100)}%`);

  // Save full result
  const deepgramPath = join(DIR, 'transcript-deepgram.json');
  writeFileSync(deepgramPath, JSON.stringify({
    transcribedAt: new Date().toISOString(),
    wordCount: result.wordCount,
    speakerCount: result.speakerCount,
    duration: result.duration,
    confidence: result.confidence,
    segments: result.segments,
  }, null, 2));

  // Save readable transcript
  const txtPath = join(DIR, 'transcript-deepgram.txt');
  if (result.segments && result.segments.length > 0) {
    const readableText = result.segments
      .map(s => `[Speaker ${s.speaker ?? 0}]: ${s.text}`)
      .join('\n\n');
    writeFileSync(txtPath, readableText);
  } else if (result.fullText) {
    writeFileSync(txtPath, result.fullText);
  }

  console.log('\nSaved:');
  console.log(`  - ${deepgramPath}`);
  console.log(`  - ${txtPath}`);

  // Preview
  if (result.fullText) {
    console.log('\n=== Preview (first 500 chars) ===');
    console.log(result.fullText.slice(0, 500) + '...');
  }
}

main().catch(console.error);

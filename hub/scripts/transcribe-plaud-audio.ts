/**
 * Transcribe Plaud audio files with Deepgram
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { deepgramIntegration } from '../src/integrations/deepgram';

const SYNC_PATH = '/Users/jddavenport/Documents/PlaudSync';

async function main() {
  console.log('=== Plaud Audio Transcription ===\n');

  if (!deepgramIntegration.isReady()) {
    console.error('Deepgram not configured. Set DEEPGRAM_API_KEY environment variable.');
    process.exit(1);
  }

  // Find all Plaud directories
  const dirs = readdirSync(SYNC_PATH)
    .filter(d => d.startsWith('2026') || d.startsWith('2025') || d.startsWith('2024'))
    .map(d => join(SYNC_PATH, d))
    .filter(d => {
      try {
        return readdirSync(d).length > 0;
      } catch {
        return false;
      }
    });

  console.log(`Found ${dirs.length} Plaud recordings\n`);

  for (const dir of dirs) {
    const dirName = dir.split('/').pop();
    console.log(`\n=== ${dirName} ===`);

    // Check if already has Deepgram transcript
    const deepgramPath = join(dir, 'transcript-deepgram.json');
    if (existsSync(deepgramPath)) {
      console.log('Already transcribed with Deepgram, skipping...');
      continue;
    }

    // Find audio file
    const audioExtensions = ['.ogg', '.mp3', '.m4a', '.wav'];
    let audioPath: string | null = null;
    let audioExt = '';

    for (const ext of audioExtensions) {
      const path = join(dir, `audio${ext}`);
      if (existsSync(path)) {
        audioPath = path;
        audioExt = ext;
        break;
      }
    }

    if (!audioPath) {
      console.log('No audio file found, skipping...');
      continue;
    }

    console.log(`Audio: audio${audioExt}`);

    // Read audio file
    const audioBuffer = readFileSync(audioPath);
    console.log(`Size: ${Math.round(audioBuffer.length / 1024 / 1024 * 10) / 10} MB`);

    // Determine mimetype
    const mimeTypes: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.ogg': 'audio/ogg',
      '.m4a': 'audio/mp4',
      '.wav': 'audio/wav',
    };
    const mimetype = mimeTypes[audioExt] || 'audio/mpeg';

    // Transcribe with Deepgram
    console.log('Transcribing with Deepgram...');
    const startTime = Date.now();

    const result = await deepgramIntegration.transcribeBuffer(audioBuffer, mimetype);

    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`Transcription completed in ${duration}s`);

    if (!result.success) {
      console.error('Transcription failed:', result.error);
      continue;
    }

    console.log(`Words: ${result.wordCount}`);
    console.log(`Speakers: ${result.speakerCount}`);
    console.log(`Duration: ${Math.round((result.duration || 0) / 60)} minutes`);
    console.log(`Confidence: ${Math.round((result.confidence || 0) * 100)}%`);

    // Save full result
    writeFileSync(deepgramPath, JSON.stringify({
      transcribedAt: new Date().toISOString(),
      wordCount: result.wordCount,
      speakerCount: result.speakerCount,
      duration: result.duration,
      confidence: result.confidence,
      segments: result.segments,
    }, null, 2));

    // Save readable transcript
    if (result.segments && result.segments.length > 0) {
      const readableText = result.segments
        .map(s => `[Speaker ${s.speaker ?? 0}]: ${s.text}`)
        .join('\n\n');
      writeFileSync(join(dir, 'transcript-deepgram.txt'), readableText);
    } else if (result.fullText) {
      writeFileSync(join(dir, 'transcript-deepgram.txt'), result.fullText);
    }

    console.log('Saved transcript-deepgram.json and transcript-deepgram.txt');
  }

  console.log('\n=== Done ===');
}

main().catch(console.error);

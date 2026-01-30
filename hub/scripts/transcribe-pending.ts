/**
 * Transcribe pending recordings that have audio but no transcripts
 */

import { db } from '../src/db/client';
import { recordings, transcripts } from '../src/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';
import { deepgramIntegration } from '../src/integrations/deepgram';

const SYNC_PATH = '/Users/jddavenport/Documents/PlaudSync';

async function main() {
  console.log('=== Transcribe Pending Recordings ===\n');

  // Get pending recordings
  const pendingRecordings = await db
    .select()
    .from(recordings)
    .where(inArray(recordings.status, ['pending', 'transcribing']));

  console.log(`Found ${pendingRecordings.length} pending recordings\n`);

  for (const recording of pendingRecordings) {
    console.log(`\nProcessing: ${recording.originalFilename}`);

    // Check if transcript already exists
    const existingTranscript = await db
      .select()
      .from(transcripts)
      .where(eq(transcripts.recordingId, recording.id))
      .limit(1);

    if (existingTranscript.length > 0) {
      console.log('  Already has transcript, updating status...');
      await db.update(recordings)
        .set({ status: 'complete', processedAt: new Date() })
        .where(eq(recordings.id, recording.id));
      continue;
    }

    // Find the audio file
    let audioPath: string | null = null;

    // Check if filePath is a local path
    if (recording.filePath?.startsWith('/')) {
      if (existsSync(recording.filePath)) {
        audioPath = recording.filePath;
      }
    }

    // Search in sync folder by filename pattern
    if (!audioPath && recording.originalFilename) {
      const folders = readdirSync(SYNC_PATH, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);

      for (const folder of folders) {
        const folderPath = join(SYNC_PATH, folder);
        const audioExtensions = ['.ogg', '.mp3', '.m4a', '.wav'];

        for (const ext of audioExtensions) {
          const testPath = join(folderPath, `audio${ext}`);
          if (existsSync(testPath)) {
            // Check if this folder matches the recording
            if (folder.includes(recording.originalFilename?.split(' ')[0] || '') ||
                recording.originalFilename?.includes(folder.split('_')[1] || '')) {
              audioPath = testPath;
              break;
            }
          }
        }
        if (audioPath) break;
      }
    }

    if (!audioPath) {
      console.log('  Could not find audio file, skipping');
      continue;
    }

    console.log(`  Audio: ${audioPath}`);

    // Convert OGG to MP3 if needed
    let transcribeAudioPath = audioPath;
    if (audioPath.endsWith('.ogg')) {
      const mp3Path = audioPath.replace('.ogg', '_converted.mp3');
      if (!existsSync(mp3Path)) {
        console.log('  Converting OGG to MP3...');
        try {
          execSync(`ffmpeg -i "${audioPath}" -acodec libmp3lame -ar 16000 "${mp3Path}" -y`, {
            stdio: 'pipe',
            timeout: 300000,
          });
        } catch (err) {
          console.log('  FFmpeg conversion failed, skipping');
          continue;
        }
      }
      transcribeAudioPath = mp3Path;
    }

    console.log('  Transcribing with Deepgram...');
    const audioBuffer = readFileSync(transcribeAudioPath);
    const mimeType = transcribeAudioPath.endsWith('.mp3') ? 'audio/mpeg' : 'audio/mp4';

    const result = await deepgramIntegration.transcribeBuffer(audioBuffer, mimeType);

    if (!result.success) {
      console.log(`  Transcription failed: ${result.error}`);
      await db.update(recordings)
        .set({ status: 'failed', errorMessage: result.error })
        .where(eq(recordings.id, recording.id));
      continue;
    }

    // Build full text from segments
    let fullText = result.fullText || '';
    if (!fullText && result.segments) {
      fullText = result.segments.map(s => `[Speaker ${s.speaker ?? 0}]: ${s.text}`).join('\n\n');
    }

    // Save transcript to database
    await db.insert(transcripts).values({
      recordingId: recording.id,
      fullText,
      segments: result.segments || [],
      wordCount: result.wordCount || 0,
      speakerCount: result.speakerCount || 1,
      confidenceScore: result.confidence || 0,
    });

    // Update recording status
    await db.update(recordings)
      .set({ status: 'complete', processedAt: new Date() })
      .where(eq(recordings.id, recording.id));

    console.log(`  ✓ Transcribed (${result.wordCount} words, ${result.speakerCount} speakers)`);

    // Save to file as well
    const dirPath = dirname(audioPath);
    writeFileSync(join(dirPath, 'transcript-deepgram.json'), JSON.stringify({
      transcribedAt: new Date().toISOString(),
      wordCount: result.wordCount,
      speakerCount: result.speakerCount,
      segments: result.segments,
    }, null, 2));
    writeFileSync(join(dirPath, 'transcript-deepgram.txt'), fullText);

    // Small delay between API calls
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n=== Done ===');
  process.exit(0);
}

main().catch(console.error);

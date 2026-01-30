/**
 * Import existing Plaud recordings into the database
 * Run this once to populate the recordings table with already-synced files
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { db } from '../src/db/client';
import { recordings, transcripts } from '../src/db/schema';

const SYNC_PATH = '/Users/jddavenport/Documents/PlaudSync';

async function main() {
  console.log('=== Import Plaud Recordings ===\n');

  // Find all Plaud directories
  const dirs = readdirSync(SYNC_PATH)
    .filter(d => d.startsWith('2026') || d.startsWith('2025') || d.startsWith('2024'))
    .map(d => join(SYNC_PATH, d))
    .filter(d => {
      try {
        const stat = statSync(d);
        return stat.isDirectory();
      } catch {
        return false;
      }
    });

  console.log(`Found ${dirs.length} Plaud recording directories\n`);

  let imported = 0;
  let skipped = 0;

  for (const dir of dirs) {
    const dirName = dir.split('/').pop();
    console.log(`\n=== ${dirName} ===`);

    // Find audio file
    const audioExtensions = ['.mp3', '.ogg', '.m4a', '.wav'];
    let audioPath: string | null = null;

    for (const ext of audioExtensions) {
      const path = join(dir, `audio${ext}`);
      if (existsSync(path)) {
        audioPath = path;
        break;
      }
    }

    if (!audioPath) {
      console.log('No audio file found, skipping...');
      skipped++;
      continue;
    }

    // Check if already in database by file path
    const existing = await db.query.recordings.findFirst({
      where: (r, { eq }) => eq(r.filePath, audioPath),
    });

    if (existing) {
      console.log('Already in database, skipping...');
      skipped++;
      continue;
    }

    // Load metadata
    let metadata: any = {};
    const metadataPath = join(dir, 'metadata.json');
    if (existsSync(metadataPath)) {
      try {
        metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
      } catch {}
    }

    // Get audio file stats
    const audioStats = statSync(audioPath);

    // Create recording record
    const [recording] = await db.insert(recordings).values({
      filePath: audioPath,
      originalFilename: metadata.filename || dirName,
      durationSeconds: metadata.duration ? Math.round(metadata.duration / 1000) : undefined,
      fileSizeBytes: audioStats.size,
      recordingType: 'conversation',
      context: `Plaud recording: ${metadata.filename || dirName}`,
      status: 'pending',
      recordedAt: metadata.startTime ? new Date(metadata.startTime) : new Date(),
    }).returning();

    console.log(`Created recording: ${recording.id}`);

    // Check for Deepgram transcript
    const deepgramPath = join(dir, 'transcript-deepgram.json');
    const deepgramTxtPath = join(dir, 'transcript-deepgram.txt');

    if (existsSync(deepgramPath) && existsSync(deepgramTxtPath)) {
      try {
        const dgData = JSON.parse(readFileSync(deepgramPath, 'utf-8'));
        const fullText = readFileSync(deepgramTxtPath, 'utf-8');

        await db.insert(transcripts).values({
          recordingId: recording.id,
          fullText,
          segments: dgData.segments || [],
          wordCount: dgData.wordCount || 0,
          speakerCount: dgData.speakerCount || 1,
          confidenceScore: dgData.confidence || 0,
        });

        // Update recording status
        await db.update(recordings)
          .set({ status: 'complete', processedAt: new Date() })
          .where((await import('drizzle-orm')).eq(recordings.id, recording.id));

        console.log(`  Transcript imported (${dgData.wordCount} words)`);
      } catch (e) {
        console.error('  Error importing transcript:', e);
      }
    } else {
      console.log('  No Deepgram transcript found');
    }

    imported++;
  }

  console.log(`\n=== Done ===`);
  console.log(`Imported: ${imported}`);
  console.log(`Skipped: ${skipped}`);

  process.exit(0);
}

main().catch(console.error);

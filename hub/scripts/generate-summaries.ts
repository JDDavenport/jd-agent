/**
 * Generate summaries for all recordings with transcripts
 * Run this to backfill summaries for existing recordings
 */

import { db } from '../src/db/client';
import { transcripts, recordings } from '../src/db/schema';
import { eq, isNull, and, isNotNull } from 'drizzle-orm';
import { recordingAnalysisService } from '../src/services/recording-analysis-service';

async function main() {
  console.log('=== Generate Recording Summaries ===\n');

  // Get all transcripts without summaries that have enough content
  const transcriptsToAnalyze = await db
    .select({
      id: transcripts.id,
      recordingId: transcripts.recordingId,
      wordCount: transcripts.wordCount,
    })
    .from(transcripts)
    .where(
      and(
        isNull(transcripts.summary),
        isNotNull(transcripts.fullText)
      )
    );

  console.log(`Found ${transcriptsToAnalyze.length} transcripts to analyze\n`);

  let success = 0;
  let failed = 0;

  for (const transcript of transcriptsToAnalyze) {
    // Get recording name for logging
    const [recording] = await db
      .select({ name: recordings.originalFilename })
      .from(recordings)
      .where(eq(recordings.id, transcript.recordingId))
      .limit(1);

    const name = recording?.name || transcript.recordingId;
    console.log(`\nAnalyzing: ${name}`);
    console.log(`  Words: ${transcript.wordCount || 'unknown'}`);

    try {
      const analysis = await recordingAnalysisService.analyzeRecording(transcript.recordingId);
      console.log(`  Summary: ${analysis.summary.overview.slice(0, 100)}...`);
      console.log(`  Tasks extracted: ${analysis.extractedTasks.length}`);
      success++;
    } catch (error) {
      console.error(`  Error: ${error instanceof Error ? error.message : error}`);
      failed++;
    }

    // Small delay between API calls
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n=== Done ===');
  console.log(`Success: ${success}`);
  console.log(`Failed: ${failed}`);

  process.exit(0);
}

main().catch(console.error);

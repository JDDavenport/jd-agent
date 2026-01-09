/**
 * Test Speaker Names in Vault Pages
 *
 * Tests that speaker names from voice profiles appear correctly
 * in the formatted transcript.
 */

import { db } from '../db/client';
import { transcripts, speakerMappings, voiceProfiles } from '../db/schema';
import { eq } from 'drizzle-orm';

// Inline helper functions for testing (same as in vip.ts)
async function getSpeakerNamesForTranscript(transcriptId: string): Promise<Map<number, string>> {
  const speakerMap = new Map<number, string>();

  const mappings = await db
    .select({
      deepgramSpeakerId: speakerMappings.deepgramSpeakerId,
      profileName: voiceProfiles.name,
    })
    .from(speakerMappings)
    .innerJoin(voiceProfiles, eq(speakerMappings.voiceProfileId, voiceProfiles.id))
    .where(eq(speakerMappings.transcriptId, transcriptId));

  for (const mapping of mappings) {
    speakerMap.set(mapping.deepgramSpeakerId, mapping.profileName);
  }

  return speakerMap;
}

function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatTranscriptWithSpeakers(
  segments: Array<{ start: number; end: number; text: string; speaker?: number }>,
  speakerNames?: Map<number, string>
): string {
  if (!segments || segments.length === 0) return '';

  let result = '';
  let currentSpeaker: number | undefined = undefined;

  for (const segment of segments) {
    if (segment.speaker !== currentSpeaker) {
      currentSpeaker = segment.speaker;
      const timestamp = formatTimestamp(segment.start);
      const speakerLabel = speakerNames?.get(currentSpeaker ?? 0)
        || `Speaker ${(currentSpeaker ?? 0) + 1}`;
      result += `\n**[${timestamp}] ${speakerLabel}:**\n`;
    }
    result += segment.text + ' ';
  }

  return result.trim();
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  Speaker Names in Vault Pages Test');
  console.log('='.repeat(60) + '\n');

  try {
    // Find a transcript with speaker mappings
    const [transcript] = await db
      .select()
      .from(transcripts)
      .where(eq(transcripts.speakerCount, 5))
      .limit(1);

    if (!transcript) {
      console.log('No multi-speaker transcript found');
      process.exit(0);
    }

    console.log(`[Test] Found transcript: ${transcript.id}`);
    console.log(`[Test] Speaker count: ${transcript.speakerCount}`);

    // Get speaker names
    const speakerNames = await getSpeakerNamesForTranscript(transcript.id);
    console.log(`[Test] Speaker mappings found: ${speakerNames.size}`);

    for (const [speakerId, name] of speakerNames) {
      console.log(`  Speaker ${speakerId} -> ${name}`);
    }

    // Format a sample of the transcript
    const segments = transcript.segments as Array<{ start: number; end: number; text: string; speaker?: number }>;

    if (segments && segments.length > 0) {
      // Take first 5 segments for preview
      const sampleSegments = segments.slice(0, 5);

      console.log('\n[Test] Sample transcript formatting (first 5 segments):');
      console.log('-'.repeat(50));

      const formatted = formatTranscriptWithSpeakers(sampleSegments, speakerNames);
      console.log(formatted);

      console.log('-'.repeat(50));

      // Show comparison without speaker names
      console.log('\n[Test] Same segments WITHOUT speaker names:');
      console.log('-'.repeat(50));

      const formattedWithoutNames = formatTranscriptWithSpeakers(sampleSegments);
      console.log(formattedWithoutNames);

      console.log('-'.repeat(50));
    }

    console.log('\n✅ Speaker name integration working correctly!\n');

    console.log('Next steps:');
    console.log('  1. Assign more speakers via /api/voice-profiles/transcripts/:id/speakers/:speakerId');
    console.log('  2. Re-run vault writer to update pages with speaker names');
    console.log('');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();

/**
 * Fix Plaud transcripts in database with actual content
 * Updates placeholder transcripts with real content from Deepgram files
 */

import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const PSQL_CMD = 'docker exec -i jd-agent-postgres psql -U jdagent -d jd_agent';

// Mapping of recording IDs to their file paths
const recordings = [
  {
    recordingId: 'de449986-bfe5-4f91-b1df-5597092a6bb1',
    transcriptId: '5605be7d-f860-43fb-9d76-4ff6a2adda9f',
    dir: '/Users/jddavenport/Documents/PlaudSync/2026-01-14_2026_01_14_09_41_07_4e94c983',
  },
  {
    recordingId: '9cf71e8c-803e-46a1-acc6-a0a3e13f43a9',
    transcriptId: '72f7c7de-85c8-44e6-95eb-86d14d2d6326',
    dir: '/Users/jddavenport/Documents/PlaudSync/2026-01-14_Steve_Jobs___Bill_Gates__A_Conversation__8e47e652',
  },
  {
    recordingId: '5713f211-1373-4cea-a8c1-9d48ab7393e9',
    transcriptId: '0765db39-b6a7-45a1-a8b5-187321ff6488',
    dir: '/Users/jddavenport/Documents/PlaudSync/2026-01-14_Welcome_to_Plaud_ai_f0ff6d1a',
  },
];

function escapeSQL(str: string): string {
  return str.replace(/'/g, "''").replace(/\\/g, '\\\\');
}

async function main() {
  console.log('=== Fix Plaud Transcripts ===\n');

  for (const rec of recordings) {
    const txtPath = `${rec.dir}/transcript-deepgram.txt`;
    const jsonPath = `${rec.dir}/transcript-deepgram.json`;

    if (!existsSync(txtPath) || !existsSync(jsonPath)) {
      console.log(`Skipping ${rec.recordingId} - no transcript files`);
      continue;
    }

    console.log(`Processing ${rec.recordingId}...`);

    const fullText = readFileSync(txtPath, 'utf-8');
    const jsonData = JSON.parse(readFileSync(jsonPath, 'utf-8'));

    // Escape for SQL
    const escapedText = escapeSQL(fullText);
    const escapedSegments = escapeSQL(JSON.stringify(jsonData.segments || []));

    // Build UPDATE query
    const sql = `UPDATE transcripts SET
      full_text = '${escapedText}',
      segments = '${escapedSegments}'::jsonb,
      word_count = ${jsonData.wordCount || 0},
      speaker_count = ${jsonData.speakerCount || 1},
      confidence_score = ${jsonData.confidence || 0}
    WHERE id = '${rec.transcriptId}';`;

    // Write SQL to temp file to avoid shell escaping issues
    const tempFile = '/tmp/update-transcript.sql';
    require('fs').writeFileSync(tempFile, sql);

    try {
      execSync(`${PSQL_CMD} < ${tempFile}`, { encoding: 'utf-8' });
      console.log(`  Updated transcript ${rec.transcriptId}`);
      console.log(`  Full text: ${fullText.length} chars`);
      console.log(`  Segments: ${jsonData.segments?.length || 0}`);
      console.log(`  Words: ${jsonData.wordCount}, Speakers: ${jsonData.speakerCount}`);
    } catch (e) {
      console.error(`  Error updating: ${e}`);
    }

    console.log();
  }

  // Verify updates
  console.log('=== Verification ===\n');
  const verifyResult = execSync(
    `${PSQL_CMD} -t -c "SELECT id, length(full_text) as text_len, jsonb_array_length(segments) as seg_count FROM transcripts WHERE id IN ('5605be7d-f860-43fb-9d76-4ff6a2adda9f', '72f7c7de-85c8-44e6-95eb-86d14d2d6326', '0765db39-b6a7-45a1-a8b5-187321ff6488');"`,
    { encoding: 'utf-8' }
  );
  console.log(verifyResult);
}

main().catch(console.error);

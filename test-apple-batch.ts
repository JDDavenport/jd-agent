#!/usr/bin/env bun
import { AppleNotesExtractorBatch } from './hub/src/integrations/apple-notes-extractor-batch';

async function main() {
  console.log('Testing batch Apple Notes extractor...\n');

  // Test with small batch size (10 notes)
  const extractor = new AppleNotesExtractorBatch({ batchSize: 10 });

  let count = 0;
  for await (const entry of extractor.extractAll()) {
    count++;
    console.log(`${count}. ${entry.title} (${entry.sourcePath})`);

    // Only show first 10 for test
    if (count >= 10) {
      console.log('\n... stopping test at 10 notes');
      break;
    }
  }

  console.log(`\n✅ Successfully extracted ${count} notes in test`);
}

main().catch(console.error);

#!/usr/bin/env bun
import { AppleNotesExtractorBatch } from './hub/src/integrations/apple-notes-extractor-batch';

async function main() {
  console.log('Debug test - extracting 3 batches of 5 notes...\n');

  const extractor = new AppleNotesExtractorBatch({ batchSize: 5 });

  let batchCount = 0;
  let totalCount = 0;

  for await (const entry of extractor.extractAll()) {
    totalCount++;
    console.log(`Note ${totalCount}: ${entry.title}`);
    console.log(`  Folder: ${entry.sourcePath}`);
    console.log(`  Content length: ${entry.content.length} chars\n`);

    // Stop after first 15 notes (3 batches)
    if (totalCount >= 15) {
      break;
    }
  }

  console.log(`✅ Successfully extracted ${totalCount} notes`);
}

main().catch(console.error);

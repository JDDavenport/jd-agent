#!/usr/bin/env bun
/**
 * Apple Notes Migration (No Classification)
 *
 * Extract all Apple Notes and import to vault without AI classification
 */

import { createAppleNotesExtractor } from '../integrations/apple-notes-extractor-batch';
import { importService } from '../services/import-service';

async function main() {
  console.log('🍎 Starting Apple Notes Migration (No Classification)\n');

  const extractor = createAppleNotesExtractor();

  // Extract all notes
  console.log('📝 Extracting Apple Notes...');
  const entries: any[] = [];

  let count = 0;
  for await (const entry of extractor.extractAll()) {
    entries.push(entry);
    count++;

    if (count % 50 === 0) {
      console.log(`  Extracted ${count} notes...`);
    }
  }

  console.log(`✅ Extracted ${entries.length} Apple Notes\n`);

  // Import without classification
  console.log('💾 Importing to vault (without classification)...');

  // Transform entries to match import format (without classification)
  const toImport = entries.map(entry => ({
    raw: entry,
    classification: {
      category: 'uncategorized',
      tags: [],
      summary: entry.title,
      contentType: 'note', // Apple Notes are notes
    }
  }));

  const result = await importService.importBatch(
    toImport,
    {
      checkDuplicates: true,
      skipOnError: true,
    },
    (current, total) => {
      if (current % 50 === 0) {
        console.log(`  Imported ${current}/${total}`);
      }
    }
  );

  console.log('\n' + '='.repeat(60));
  console.log('📊 APPLE NOTES MIGRATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`✓ Extracted:  ${entries.length}`);
  console.log(`✓ Imported:   ${result.imported}`);
  console.log(`⊗ Duplicates: ${result.duplicates}`);
  console.log(`⊘ Skipped:    ${result.skipped}`);
  console.log(`✗ Failed:     ${result.failed}`);
  console.log('='.repeat(60));

  if (result.errors.length > 0) {
    console.log('\n⚠️  ERRORS:');
    result.errors.slice(0, 5).forEach(e => {
      console.log(`  - ${e.entry}: ${e.error}`);
    });
    if (result.errors.length > 5) {
      console.log(`  ... and ${result.errors.length - 5} more`);
    }
  }

  // Get vault stats
  const stats = await importService.getImportStats();
  console.log('\n📊 Vault Statistics:');
  console.log(`  Total entries: ${stats.total}`);
  console.log(`  By source:`);
  Object.entries(stats.bySource).forEach(([source, count]) => {
    console.log(`    - ${source}: ${count}`);
  });

  console.log('\n✅ Apple Notes migration complete!\n');
}

main().catch(error => {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
});

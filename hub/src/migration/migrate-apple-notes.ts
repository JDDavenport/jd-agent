#!/usr/bin/env bun
/**
 * Apple Notes Migration
 *
 * Extract all Apple Notes and import to vault
 */

import { createAppleNotesExtractor } from '../integrations/apple-notes-extractor-batch';
import { classificationService } from '../services/classification-service';
import { importService } from '../services/import-service';

async function main() {
  console.log('🍎 Starting Apple Notes Migration\n');

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

  // Classify
  console.log('🤖 Classifying entries...');
  const classified: Array<{ raw: any; classification: any }> = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    try {
      const classification = await classificationService.classify(entry);
      classified.push({ raw: entry, classification });

      if ((i + 1) % 50 === 0) {
        console.log(`  Classified ${i + 1}/${entries.length}`);
      }
    } catch (error: any) {
      console.error(`Error classifying "${entry.title}":`, error.message);
    }
  }

  console.log(`✅ Classified ${classified.length} entries\n`);

  // Import
  console.log('💾 Importing to vault...');
  const result = await importService.importBatch(
    classified,
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
  console.log(`✓ Classified: ${classified.length}`);
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

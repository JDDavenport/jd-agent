/**
 * Dedupe Vault Pages
 *
 * Finds and merges duplicate vault pages (pages with same title under same parent).
 *
 * For each set of duplicates:
 * - Keeps the oldest page (first created)
 * - Moves all blocks from duplicates to the keeper
 * - Moves all children from duplicates to the keeper
 * - Deletes the duplicate pages
 *
 * Run with: bun run scripts/dedupe-vault-pages.ts
 * Dry run:  bun run scripts/dedupe-vault-pages.ts --dry-run
 */

import { VaultPageService } from '../src/services/vault-page-service';

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const vaultPageService = new VaultPageService();

  console.log('=== Dedupe Vault Pages ===\n');

  if (isDryRun) {
    console.log('** DRY RUN MODE - No changes will be made **\n');
  }

  // Find duplicates
  console.log('Finding duplicate pages...\n');
  const duplicates = await vaultPageService.findDuplicates();

  if (duplicates.size === 0) {
    console.log('No duplicate pages found!');
    process.exit(0);
  }

  console.log(`Found ${duplicates.size} groups of duplicates:\n`);

  let totalDuplicates = 0;
  for (const [key, pages] of duplicates) {
    const [keeper, ...dups] = pages;
    console.log(`  "${keeper.title}" (parent: ${keeper.parentId || 'root'})`);
    console.log(`    - Keep: ${keeper.id} (created: ${keeper.createdAt})`);
    for (const dup of dups) {
      console.log(`    - Delete: ${dup.id} (created: ${dup.createdAt})`);
      totalDuplicates++;
    }
  }

  console.log(`\nTotal duplicates to merge: ${totalDuplicates}\n`);

  if (isDryRun) {
    console.log('Dry run complete. Run without --dry-run to actually merge duplicates.');
    process.exit(0);
  }

  // Merge duplicates
  console.log('Merging duplicates...\n');
  const result = await vaultPageService.mergeDuplicates();

  console.log('\n=== Summary ===');
  console.log(`Blocks moved: ${result.merged}`);
  console.log(`Pages deleted: ${result.deleted}`);

  process.exit(0);
}

main().catch(console.error);

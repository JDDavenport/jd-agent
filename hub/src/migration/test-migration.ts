#!/usr/bin/env bun
/**
 * Test Migration Script
 *
 * Quick test of the migration system with a small sample
 *
 * Usage:
 *   bun run src/migration/test-migration.ts
 *
 * Set environment variables for the sources you want to test:
 *   NOTION_API_KEY=xxx
 *   TODOIST_API_KEY=xxx
 *   GOOGLE_CLIENT_ID=xxx
 *   GOOGLE_CLIENT_SECRET=xxx
 *   GOOGLE_REFRESH_TOKEN=xxx
 */

import { MigrationRunner } from './runner';
import type { MigrationConfig } from './runner';

async function main() {
  console.log('🧪 Testing Migration System\n');

  // Build config from environment variables
  const config: MigrationConfig = {
    sources: {},
    options: {
      dryRun: false, // Set to true to test without actually importing
      checkDuplicates: true,
      batchSize: 10,
    },
  };

  // Check which sources are configured
  if (process.env.NOTION_API_KEY) {
    console.log('✓ Notion API key found');
    config.sources.notion = {
      apiKey: process.env.NOTION_API_KEY,
      // FULL MIGRATION - no limit
      includeArchived: false,
    };
  } else {
    console.log('○ Notion API key not found (NOTION_API_KEY)');
  }

  if (process.env.TODOIST_API_KEY) {
    console.log('✓ Todoist API key found');
    config.sources.todoist = {
      apiKey: process.env.TODOIST_API_KEY,
      // FULL MIGRATION - no limit
    };
  } else {
    console.log('○ Todoist API key not found (TODOIST_API_KEY)');
  }

  // Note: Google Drive and Apple Notes migrations are currently disabled
  // - Google Drive: OAuth refresh token expired - needs re-authentication
  // - Apple Notes: macOS permission issues - requires accessibility permissions
  // To re-enable, see /docs/integrations/google-drive.md and /docs/integrations/apple-notes.md

  // Check if any sources are configured
  if (Object.keys(config.sources).length === 0) {
    console.error('\n❌ No sources configured!');
    console.error('\nSet at least one of these environment variables:');
    console.error('  - NOTION_API_KEY');
    console.error('  - TODOIST_API_KEY');
    console.error('  - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN');
    console.error('\nOr run on macOS to use Apple Notes\n');
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Starting migration...');
  console.log('='.repeat(60) + '\n');

  // Run migration
  const runner = new MigrationRunner(config);
  const results = await runner.run();

  // Check for resumes
  const totalResumes = results.reduce((sum, r) => sum + r.resumes, 0);
  if (totalResumes > 0) {
    console.log(`\n🎯 Found ${totalResumes} resume(s)! These have been automatically tagged and categorized.`);
  }

  // Check import stats
  const { importService } = await import('../services/import-service');
  const stats = await importService.getImportStats();

  console.log('\n📊 Vault Statistics:');
  console.log(`  Total entries: ${stats.total}`);
  console.log(`  By source:`);
  Object.entries(stats.bySource).forEach(([source, count]) => {
    console.log(`    - ${source}: ${count}`);
  });
  console.log(`  By content type:`);
  Object.entries(stats.byContentType).forEach(([type, count]) => {
    console.log(`    - ${type}: ${count}`);
  });
  if (stats.needingReview > 0) {
    console.log(`\n⚠️  ${stats.needingReview} entries need review`);
  }

  console.log('\n✅ Migration test complete!\n');
}

main().catch(error => {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
});

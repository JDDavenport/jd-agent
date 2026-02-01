#!/usr/bin/env bun
/**
 * Learning Materials Sync Script
 *
 * Syncs all learning materials (Plaud, Remarkable) to Vault
 *
 * Usage:
 *   bun run scripts/sync-learning.ts          # Full sync
 *   bun run scripts/sync-learning.ts plaud    # Plaud only
 *   bun run scripts/sync-learning.ts remarkable # Remarkable only
 *   bun run scripts/sync-learning.ts status   # Show status
 */

import { learningSyncService } from '../src/services/learning-sync-service';
import { plaudSessionManager } from '../src/services/plaud-session-manager';
import { remarkableCloudSync } from '../src/services/remarkable-cloud-sync';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'all';

  console.log('╔══════════════════════════════════════════╗');
  console.log('║     Learning Materials Sync Service      ║');
  console.log('╚══════════════════════════════════════════╝\n');

  switch (command) {
    case 'status': {
      console.log('📊 Sync Status\n');

      // Plaud status
      const plaudStatus = plaudSessionManager.getStatus();
      console.log('🎙️  Plaud:');
      console.log(`   Session: ${plaudStatus.hasSession ? '✅ Found' : '❌ Missing'}`);
      if (plaudStatus.hasSession) {
        console.log(`   Age: ${plaudStatus.sessionAgeHours?.toFixed(1) || '?'} hours`);
        console.log(`   Stale: ${plaudStatus.isStale ? '⚠️ Yes' : '✅ No'}`);
      }

      // Remarkable status
      const rmStatus = remarkableCloudSync.getStatus();
      console.log('\n✍️  Remarkable:');
      console.log(`   Configured: ${rmStatus.configured ? '✅ Yes' : '❌ No'}`);
      if (rmStatus.configured) {
        console.log(`   Documents: ${rmStatus.documentCount}`);
        console.log(`   Last Sync: ${rmStatus.lastSync || 'Never'}`);
      }

      // Overall sync status
      const syncStatus = learningSyncService.getStatus();
      console.log('\n📚 Learning Sync:');
      console.log(`   Last Full Sync: ${syncStatus.lastFullSync}`);
      console.log(`   Recordings Processed: ${syncStatus.processedRecordings} (${syncStatus.classifiedRecordings} classified)`);
      console.log(`   Notes Processed: ${syncStatus.processedNotes} (${syncStatus.classifiedNotes} classified)`);

      // Unclassified items
      const unclassified = learningSyncService.getUnclassified();
      if (unclassified.recordings.length > 0 || unclassified.notes.length > 0) {
        console.log('\n⚠️  Unclassified Items:');
        if (unclassified.recordings.length > 0) {
          console.log(`   Recordings: ${unclassified.recordings.length}`);
        }
        if (unclassified.notes.length > 0) {
          console.log(`   Notes: ${unclassified.notes.length}`);
        }
      }
      break;
    }

    case 'plaud': {
      console.log('🎙️  Syncing Plaud recordings...\n');

      // Check session first
      const valid = await plaudSessionManager.ensureValidSession();
      if (!valid) {
        console.log('❌ Plaud session invalid.');
        console.log('   Run: bun run scripts/plaud-session-manager.ts login');
        process.exit(1);
      }

      const result = await learningSyncService.syncPlaud();

      console.log('\n📊 Results:');
      console.log(`   Success: ${result.success ? '✅' : '❌'}`);
      console.log(`   Items Processed: ${result.itemsProcessed}`);
      console.log(`   Vault Pages Created: ${result.vaultPagesCreated}`);
      if (result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.join(', ')}`);
      }
      break;
    }

    case 'remarkable': {
      console.log('✍️  Syncing Remarkable notes...\n');

      if (!remarkableCloudSync.isConfigured()) {
        console.log('❌ Remarkable not configured.');
        console.log('   Set REMARKABLE_DEVICE_TOKEN environment variable.');
        process.exit(1);
      }

      const result = await learningSyncService.syncRemarkable();

      console.log('\n📊 Results:');
      console.log(`   Success: ${result.success ? '✅' : '❌'}`);
      console.log(`   Items Processed: ${result.itemsProcessed}`);
      console.log(`   Vault Pages Created: ${result.vaultPagesCreated}`);
      if (result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.join(', ')}`);
      }
      break;
    }

    case 'all': {
      console.log('📚 Running full sync...\n');

      // Pre-flight checks
      const plaudValid = await plaudSessionManager.ensureValidSession();
      const remarkableConfigured = remarkableCloudSync.isConfigured();

      if (!plaudValid) {
        console.log('⚠️  Plaud session invalid - will skip Plaud sync');
      }
      if (!remarkableConfigured) {
        console.log('⚠️  Remarkable not configured - will skip Remarkable sync');
      }

      console.log('');

      const results = await learningSyncService.syncAll();

      console.log('\n╔══════════════════════════════════════════╗');
      console.log('║              Sync Complete               ║');
      console.log('╚══════════════════════════════════════════╝\n');

      console.log('🎙️  Plaud:');
      console.log(`   Success: ${results.plaud.success ? '✅' : '❌'}`);
      console.log(`   Processed: ${results.plaud.itemsProcessed}`);
      console.log(`   Pages Created: ${results.plaud.vaultPagesCreated}`);

      console.log('\n✍️  Remarkable:');
      console.log(`   Success: ${results.remarkable.success ? '✅' : '❌'}`);
      console.log(`   Processed: ${results.remarkable.itemsProcessed}`);
      console.log(`   Pages Created: ${results.remarkable.vaultPagesCreated}`);

      // Show any errors
      const allErrors = [...results.plaud.errors, ...results.remarkable.errors];
      if (allErrors.length > 0) {
        console.log('\n⚠️  Errors:');
        allErrors.forEach((e) => console.log(`   - ${e}`));
      }
      break;
    }

    case 'structure': {
      console.log('🏗️  Ensuring MBA Vault structure...\n');

      const structure = await learningSyncService.ensureMBAStructure();

      console.log('✅ Structure created/verified:\n');
      console.log(`   Project ID: ${structure.projectId}`);
      console.log('   Course Pages:');
      for (const [code, id] of Object.entries(structure.coursePages)) {
        console.log(`     ${code}: ${id}`);
      }
      break;
    }

    case 'unclassified': {
      console.log('📋 Unclassified Items\n');

      const unclassified = learningSyncService.getUnclassified();

      if (unclassified.recordings.length === 0 && unclassified.notes.length === 0) {
        console.log('✅ All items are classified!');
        break;
      }

      if (unclassified.recordings.length > 0) {
        console.log('🎙️  Recordings:');
        unclassified.recordings.forEach((r) => {
          console.log(`   - ${r.id} (synced: ${r.syncedAt})`);
        });
      }

      if (unclassified.notes.length > 0) {
        console.log('\n✍️  Notes:');
        unclassified.notes.forEach((n) => {
          console.log(`   - ${n.name} (synced: ${n.syncedAt})`);
        });
      }

      console.log('\nTo classify an item, use the API or:');
      console.log('  learningSyncService.classifyItem("recording", "<id>", "MBA580")');
      break;
    }

    case 'help':
    default:
      console.log(`
Usage: bun run scripts/sync-learning.ts <command>

Commands:
  status        Show sync status for all sources
  all           Run full sync (Plaud + Remarkable)
  plaud         Sync Plaud recordings only
  remarkable    Sync Remarkable notes only
  structure     Ensure MBA Vault folder structure exists
  unclassified  List items that need manual classification
  help          Show this help

Environment Variables:
  PLAUD_SYNC_PATH         Path to Plaud sync folder
  REMARKABLE_DEVICE_TOKEN Remarkable Cloud device token
  REMARKABLE_SYNC_PATH    Path for Remarkable files
`);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

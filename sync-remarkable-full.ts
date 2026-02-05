/**
 * Remarkable Cloud Full Sync Script
 * Downloads all documents from Remarkable Cloud WITH hashes for rendering
 * 
 * Run: cd ~/projects/JD\ Agent && bun run sync-remarkable-full.ts
 */

import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

const REMARKABLE_AUTH_URL = 'https://webapp-prod.cloud.remarkable.engineering';
const REMARKABLE_SYNC_URL = 'https://eu.tectonic.remarkable.com';
const STORAGE_PATH = process.env.REMARKABLE_SYNC_PATH || './storage/remarkable';
const HUB_STATE_FILE = join(STORAGE_PATH, '../..', 'Documents/RemarkableSync/.remarkable-cloud-state.json').replace('/projects/JD Agent/storage/remarkable/../..', '');

interface HubSyncState {
  lastSyncAt: string;
  deviceToken: string | null;
  userToken: string | null;
  userTokenExpiresAt: number | null;
  documents: Record<string, {
    hash: string;
    name: string;
    type: 'DocumentType' | 'CollectionType';
    parent: string | null;
    lastModified: number;
    lastNotified: number | null;
    pageCount?: number;
  }>;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const deviceToken = process.env.REMARKABLE_DEVICE_TOKEN;
  
  if (!deviceToken) {
    console.error('❌ REMARKABLE_DEVICE_TOKEN not set');
    process.exit(1);
  }

  console.log('📓 Remarkable Cloud Full Sync (with hashes)');
  console.log('============================================');

  // Step 1: Authenticate
  console.log('\n1. Authenticating...');
  const authResponse = await fetch(
    `${REMARKABLE_AUTH_URL}/token/json/2/user/new`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${deviceToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!authResponse.ok) {
    console.error('❌ Auth failed:', authResponse.status);
    process.exit(1);
  }

  const userToken = await authResponse.text();
  const payload = JSON.parse(Buffer.from(userToken.split('.')[1], 'base64').toString());
  console.log('   ✅ Authenticated');

  // Step 2: Get document index
  console.log('\n2. Fetching document index...');
  const rootResponse = await fetch(
    `${REMARKABLE_SYNC_URL}/sync/v3/root`,
    {
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'rm-source': 'RoR-Browser',
      },
    }
  );

  if (!rootResponse.ok) {
    console.error('❌ Failed to get root:', rootResponse.status);
    process.exit(1);
  }

  const rootData = await rootResponse.json();
  
  const indexResponse = await fetch(
    `${REMARKABLE_SYNC_URL}/sync/v3/files/${rootData.hash}`,
    {
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'rm-source': 'RoR-Browser',
      },
    }
  );

  if (!indexResponse.ok) {
    console.error('❌ Failed to get index:', indexResponse.status);
    process.exit(1);
  }

  const indexText = await indexResponse.text();
  const lines = indexText.split('\n').filter(l => l.trim()).slice(1); // Skip header
  console.log(`   Found ${lines.length} entries`);

  // Step 3: Process documents with full metadata
  console.log('\n3. Fetching document metadata (this takes a while)...');
  
  const state: HubSyncState = {
    lastSyncAt: new Date().toISOString(),
    deviceToken: null, // Will be loaded from env
    userToken,
    userTokenExpiresAt: payload.exp * 1000,
    documents: {},
  };

  let processed = 0;
  let errors = 0;

  for (const line of lines) {
    const parts = line.split(':');
    if (parts.length < 3) continue;

    const [hash, , id] = parts;

    try {
      // Get document's file index to find metadata
      const docIndexResponse = await fetch(
        `${REMARKABLE_SYNC_URL}/sync/v3/files/${hash}`,
        {
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'rm-source': 'RoR-Browser',
          },
        }
      );

      if (!docIndexResponse.ok) {
        errors++;
        continue;
      }

      const docIndexText = await docIndexResponse.text();
      const docLines = docIndexText.split('\n');

      // Find metadata file
      const metadataLine = docLines.find(l => l.includes('.metadata:'));
      if (!metadataLine) {
        errors++;
        continue;
      }

      const metadataHash = metadataLine.split(':')[0];

      // Fetch metadata
      const metadataResponse = await fetch(
        `${REMARKABLE_SYNC_URL}/sync/v3/files/${metadataHash}`,
        {
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'rm-source': 'RoR-Browser',
          },
        }
      );

      if (!metadataResponse.ok) {
        errors++;
        continue;
      }

      const metadata = await metadataResponse.json();

      // Count pages
      const pageCount = docLines.filter(l => l.endsWith('.rm:0')).length ||
                        docLines.filter(l => l.includes('.rm:')).length;

      state.documents[id] = {
        hash,
        name: metadata.visibleName || 'Untitled',
        type: metadata.type || 'DocumentType',
        parent: metadata.parent || null,
        lastModified: parseInt(metadata.lastModified || '0'),
        lastNotified: null,
        pageCount,
      };

      processed++;
      if (processed % 20 === 0) {
        process.stdout.write(`   Processed ${processed}/${lines.length}...\r`);
      }

    } catch (e) {
      errors++;
    }

    // Rate limiting
    await sleep(30);
  }

  console.log(`\n   ✅ Processed ${processed} documents, ${errors} errors`);

  // Step 4: Save state
  console.log('\n4. Saving state...');
  
  const statePath = process.env.HOME + '/Documents/RemarkableSync/.remarkable-cloud-state.json';
  const stateDir = statePath.substring(0, statePath.lastIndexOf('/'));
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }
  writeFileSync(statePath, JSON.stringify(state, null, 2));
  console.log(`   Saved to: ${statePath}`);

  // Step 5: List some documents
  console.log('\n5. Sample documents with hashes:');
  const docs = Object.entries(state.documents)
    .filter(([, d]) => d.type === 'DocumentType')
    .slice(0, 10);
  
  for (const [id, doc] of docs) {
    console.log(`   📓 ${doc.name}`);
    console.log(`      ID: ${id}`);
    console.log(`      Hash: ${doc.hash.substring(0, 16)}...`);
    console.log(`      Pages: ${doc.pageCount || 'unknown'}`);
  }

  console.log('\n✅ Full sync complete!');
  console.log(`   Documents: ${Object.keys(state.documents).length}`);
  console.log(`   Ready for PDF rendering via Hub API`);
}

main().catch(e => {
  console.error('❌ Error:', e);
  process.exit(1);
});

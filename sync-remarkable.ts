/**
 * Remarkable Cloud Sync Script
 * Downloads all documents from Remarkable Cloud to local storage
 * 
 * Run: cd ~/projects/JD\ Agent && source .env && bun run sync-remarkable.ts
 */

import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

const REMARKABLE_AUTH_URL = 'https://webapp-prod.cloud.remarkable.engineering';
const REMARKABLE_SYNC_URL = 'https://eu.tectonic.remarkable.com';
const STORAGE_PATH = process.env.REMARKABLE_SYNC_PATH || './storage/remarkable';
const STATE_FILE = join(STORAGE_PATH, '.sync-state.json');

interface SyncState {
  lastSyncAt: string;
  userToken: string | null;
  userTokenExpiresAt: number | null;
  documents: Record<string, {
    name: string;
    type: string;
    parent: string | null;
    lastModified: number;
    downloaded: boolean;
  }>;
}

function loadState(): SyncState {
  try {
    if (existsSync(STATE_FILE)) {
      return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch (e) {
    console.log('Starting fresh state');
  }
  return {
    lastSyncAt: new Date(0).toISOString(),
    userToken: null,
    userTokenExpiresAt: null,
    documents: {},
  };
}

function saveState(state: SyncState): void {
  if (!existsSync(STORAGE_PATH)) {
    mkdirSync(STORAGE_PATH, { recursive: true });
  }
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getUserToken(deviceToken: string): Promise<string> {
  const response = await fetch(
    `${REMARKABLE_AUTH_URL}/token/json/2/user/new`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${deviceToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get user token: ${response.status}`);
  }

  return await response.text();
}

async function getDocumentIndex(userToken: string): Promise<string[]> {
  // Get root hash
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
    throw new Error(`Failed to get root: ${rootResponse.status}`);
  }

  const rootData = await rootResponse.json();

  // Get root index
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
    throw new Error(`Failed to get index: ${indexResponse.status}`);
  }

  const indexText = await indexResponse.text();
  return indexText.split('\n').filter(l => l.trim()).slice(1); // Skip header
}

async function getDocumentMetadata(
  userToken: string, 
  hash: string, 
  id: string
): Promise<{ name: string; type: string; parent: string | null; lastModified: number } | null> {
  try {
    // Get document's file index
    const indexResponse = await fetch(
      `${REMARKABLE_SYNC_URL}/sync/v3/files/${hash}`,
      {
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'rm-source': 'RoR-Browser',
        },
      }
    );

    if (!indexResponse.ok) return null;

    const indexText = await indexResponse.text();
    const lines = indexText.split('\n');

    // Find metadata file hash
    const metadataLine = lines.find(l => l.includes('.metadata:'));
    if (!metadataLine) return null;

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

    if (!metadataResponse.ok) return null;

    const metadata = await metadataResponse.json();

    return {
      name: metadata.visibleName || 'Untitled',
      type: metadata.type || 'DocumentType',
      parent: metadata.parent || null,
      lastModified: parseInt(metadata.lastModified || '0'),
    };
  } catch (error) {
    return null;
  }
}

async function main() {
  const deviceToken = process.env.REMARKABLE_DEVICE_TOKEN;
  
  if (!deviceToken) {
    console.error('❌ REMARKABLE_DEVICE_TOKEN not set');
    process.exit(1);
  }

  console.log('📓 Remarkable Cloud Sync');
  console.log('========================');
  console.log(`Storage: ${STORAGE_PATH}`);
  
  // Ensure storage directory exists
  if (!existsSync(STORAGE_PATH)) {
    mkdirSync(STORAGE_PATH, { recursive: true });
    console.log('Created storage directory');
  }

  const state = loadState();

  // Get user token
  console.log('\n1. Authenticating...');
  const userToken = await getUserToken(deviceToken);
  state.userToken = userToken;
  const payload = JSON.parse(Buffer.from(userToken.split('.')[1], 'base64').toString());
  state.userTokenExpiresAt = payload.exp * 1000;
  console.log('   ✅ Authenticated');

  // Get document index
  console.log('\n2. Fetching document index...');
  const indexLines = await getDocumentIndex(userToken);
  console.log(`   Found ${indexLines.length} entries`);

  // Process documents
  console.log('\n3. Processing documents...');
  let processed = 0;
  let skipped = 0;
  let folders = 0;
  let documents = 0;

  for (const line of indexLines) {
    const parts = line.split(':');
    if (parts.length < 3) continue;

    const [hash, , id] = parts;

    // Check if already processed
    if (state.documents[id] && state.documents[id].downloaded) {
      skipped++;
      continue;
    }

    // Get metadata
    const metadata = await getDocumentMetadata(userToken, hash, id);
    
    if (metadata) {
      state.documents[id] = {
        ...metadata,
        downloaded: true,
      };

      if (metadata.type === 'CollectionType') {
        folders++;
      } else {
        documents++;
      }

      processed++;
      
      // Progress indicator
      if (processed % 10 === 0) {
        process.stdout.write(`   Processed ${processed}... \r`);
      }
    }

    // Rate limiting
    await sleep(30);
  }

  console.log(`\n   ✅ Processed ${processed} new, ${skipped} skipped`);
  console.log(`   📁 ${folders} folders, 📓 ${documents} documents`);

  // Build folder structure
  console.log('\n4. Building folder structure...');
  
  // Create a map of folder names
  const folderMap = new Map<string, string>();
  for (const [id, doc] of Object.entries(state.documents)) {
    if (doc.type === 'CollectionType') {
      folderMap.set(id, doc.name);
    }
  }

  // Get document paths
  const getPath = (parentId: string | null): string => {
    if (!parentId) return '';
    const folder = state.documents[parentId];
    if (!folder) return '';
    const parentPath = getPath(folder.parent);
    return parentPath ? `${parentPath}/${folder.name}` : folder.name;
  };

  // List documents by folder
  const byFolder = new Map<string, { id: string; name: string }[]>();
  for (const [id, doc] of Object.entries(state.documents)) {
    if (doc.type === 'DocumentType') {
      const path = getPath(doc.parent) || 'Root';
      if (!byFolder.has(path)) {
        byFolder.set(path, []);
      }
      byFolder.get(path)!.push({ id, name: doc.name });
    }
  }

  console.log('   Documents by folder:');
  for (const [folder, docs] of Array.from(byFolder.entries()).sort()) {
    console.log(`   📁 ${folder}: ${docs.length} docs`);
    // List first 3 docs
    docs.slice(0, 3).forEach(d => console.log(`      📓 ${d.name}`));
    if (docs.length > 3) {
      console.log(`      ... and ${docs.length - 3} more`);
    }
  }

  // Save state
  state.lastSyncAt = new Date().toISOString();
  saveState(state);

  console.log('\n✅ Sync complete!');
  console.log(`   Last sync: ${state.lastSyncAt}`);
  console.log(`   Total documents: ${Object.keys(state.documents).length}`);
  console.log(`   State saved to: ${STATE_FILE}`);
}

main().catch(e => {
  console.error('❌ Error:', e);
  process.exit(1);
});

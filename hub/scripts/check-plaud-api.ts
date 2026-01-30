/**
 * Check Plaud API for new recordings
 */

import { existsSync, readFileSync } from 'fs';

const STORAGE_PATH = '/Users/jddavenport/Documents/PlaudSync/.plaud-auth.json';

// Get auth token
function getToken(): string | null {
  if (!existsSync(STORAGE_PATH)) return null;
  const storage = JSON.parse(readFileSync(STORAGE_PATH, 'utf-8'));
  for (const origin of storage.origins || []) {
    for (const item of origin.localStorage || []) {
      if (item.name === 'tokenstr') {
        return item.value;
      }
    }
  }
  return null;
}

async function main() {
  const token = getToken();
  if (!token) {
    console.log('❌ No Plaud session found. Run plaud-login.ts first.');
    process.exit(1);
  }

  // Fetch files from Plaud API
  console.log('Fetching recordings from Plaud API...');
  const resp = await fetch(
    'https://api.plaud.ai/file/simple/web?skip=0&limit=20&is_trash=2&sort_by=start_time&is_desc=true',
    { headers: { Authorization: token } }
  );

  if (!resp.ok) {
    console.log(`❌ API error: ${resp.status}`);
    process.exit(1);
  }

  const data = await resp.json() as { data_file_list?: any[] };
  const files = data.data_file_list || [];

  console.log(`\n=== Found ${files.length} recordings on Plaud ===`);
  for (const f of files.slice(0, 15)) {
    const date = new Date(f.start_time);
    const duration = Math.round(f.duration / 60000);
    console.log(`${date.toISOString().split('T')[0]} | ${duration}min | ${f.filename}`);
  }
}

main().catch(console.error);

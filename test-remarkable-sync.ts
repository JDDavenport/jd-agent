/**
 * Test script for Remarkable Cloud Sync
 * Run with: cd ~/projects/JD\ Agent && bun run test-remarkable-sync.ts
 */

const REMARKABLE_AUTH_URL = 'https://webapp-prod.cloud.remarkable.engineering';
const REMARKABLE_SYNC_URL = 'https://eu.tectonic.remarkable.com';

async function testSync() {
  const deviceToken = process.env.REMARKABLE_DEVICE_TOKEN;
  
  if (!deviceToken) {
    console.error('REMARKABLE_DEVICE_TOKEN not set');
    process.exit(1);
  }
  
  console.log('Device token (first 50 chars):', deviceToken.substring(0, 50) + '...');
  
  // Step 1: Get user token
  console.log('\n1. Getting user token...');
  try {
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
    
    console.log('   Status:', response.status);
    
    if (!response.ok) {
      const text = await response.text();
      console.error('   Error:', text);
      process.exit(1);
    }
    
    const userToken = await response.text();
    console.log('   User token (first 50 chars):', userToken.substring(0, 50) + '...');
    
    // Step 2: Get root hash
    console.log('\n2. Getting root hash...');
    const rootResponse = await fetch(
      `${REMARKABLE_SYNC_URL}/sync/v3/root`,
      {
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'rm-source': 'RoR-Browser',
        },
      }
    );
    
    console.log('   Status:', rootResponse.status);
    
    if (!rootResponse.ok) {
      const text = await rootResponse.text();
      console.error('   Error:', text);
      process.exit(1);
    }
    
    const rootData = await rootResponse.json();
    console.log('   Root hash:', rootData.hash);
    
    // Step 3: Get root index
    console.log('\n3. Getting root index...');
    const indexResponse = await fetch(
      `${REMARKABLE_SYNC_URL}/sync/v3/files/${rootData.hash}`,
      {
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'rm-source': 'RoR-Browser',
        },
      }
    );
    
    console.log('   Status:', indexResponse.status);
    
    if (!indexResponse.ok) {
      const text = await indexResponse.text();
      console.error('   Error:', text);
      process.exit(1);
    }
    
    const indexText = await indexResponse.text();
    const lines = indexText.split('\n').filter(l => l.trim());
    console.log('   Found', lines.length, 'entries');
    console.log('   First 5 entries:');
    lines.slice(0, 5).forEach(line => console.log('     ', line.substring(0, 80)));
    
    console.log('\n✅ Remarkable Cloud sync test passed!');
    console.log('   Documents found:', lines.length - 1); // -1 for header
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testSync();

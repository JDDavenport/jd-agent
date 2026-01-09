/**
 * JD Agent - Comprehensive Vault API Test Script
 *
 * Tests all vault-related endpoints including:
 * - CRUD operations
 * - Full-text search
 * - Tag management
 * - Related entries
 * - Filtering
 *
 * Server must be running on http://localhost:3000 before executing.
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const results: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<void>) {
  const start = Date.now();
  try {
    await testFn();
    results.push({ name, passed: true, duration: Date.now() - start });
    console.log(`  ✅ ${name}`);
  } catch (error) {
    results.push({ name, passed: false, error: String(error), duration: Date.now() - start });
    console.log(`  ❌ ${name}: ${error}`);
  }
}

async function apiCall(method: string, path: string, body?: any): Promise<any> {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  return { status: response.status, ok: response.ok, data };
}

async function main() {
  console.log('\n🧪 JD Agent - Vault API Test Suite');
  console.log('='.repeat(60));
  console.log(`Testing against: ${API_BASE}`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  // Verify server is running
  try {
    const health = await fetch(`${API_BASE}/api/health`);
    if (!health.ok) throw new Error('Server not healthy');
  } catch {
    console.error('❌ Server not running. Start with: bun run dev');
    process.exit(1);
  }

  let testEntryId: string = '';
  let testEntryId2: string = '';

  // ===== VAULT CRUD TESTS =====
  console.log('📦 Vault CRUD Operations\n');

  await runTest('Create vault entry with minimal fields', async () => {
    const res = await apiCall('POST', '/api/vault', {
      title: 'Test Entry - Minimal',
      contentType: 'note',
      context: 'Test',
      source: 'manual',
    });
    if (!res.ok) throw new Error(`Failed: ${res.status} - ${JSON.stringify(res.data)}`);
    if (!res.data.data?.id) throw new Error('No entry ID returned');
    testEntryId = res.data.data.id;
  });

  await runTest('Create vault entry with all fields', async () => {
    const res = await apiCall('POST', '/api/vault', {
      title: 'Test Entry - Full Fields',
      content: 'This is comprehensive test content for the vault entry. It includes keywords like TypeScript, JavaScript, and API testing.',
      contentType: 'document',
      context: 'Test',
      source: 'manual',
      tags: ['test', 'api', 'automation'],
      sourceDate: new Date().toISOString(),
    });
    if (!res.ok) throw new Error(`Failed: ${res.status} - ${JSON.stringify(res.data)}`);
    if (!res.data.data?.id) throw new Error('No entry ID returned');
    testEntryId2 = res.data.data.id;
  });

  await runTest('Get vault entry by ID', async () => {
    const res = await apiCall('GET', `/api/vault/${testEntryId}`);
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.data?.id !== testEntryId) throw new Error('Wrong entry returned');
  });

  await runTest('Update vault entry title', async () => {
    const res = await apiCall('PATCH', `/api/vault/${testEntryId}`, {
      title: 'Test Entry - Updated Title',
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.data?.title !== 'Test Entry - Updated Title') throw new Error('Title not updated');
  });

  await runTest('Update vault entry content', async () => {
    const res = await apiCall('PATCH', `/api/vault/${testEntryId}`, {
      content: 'Updated content with new information.',
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
  });

  await runTest('Update vault entry context', async () => {
    const res = await apiCall('PATCH', `/api/vault/${testEntryId}`, {
      context: 'Test Updated',
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.data?.context !== 'Test Updated') throw new Error('Context not updated');
  });

  // ===== LIST ENDPOINTS =====
  console.log('\n📋 List Endpoints\n');

  await runTest('List all vault entries', async () => {
    const res = await apiCall('GET', '/api/vault');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
  });

  await runTest('List vault entries with context filter', async () => {
    const res = await apiCall('GET', '/api/vault?context=Test');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
  });

  await runTest('List vault entries with contentType filter', async () => {
    const res = await apiCall('GET', '/api/vault?contentType=note');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
  });

  await runTest('List vault entries with source filter', async () => {
    const res = await apiCall('GET', '/api/vault?source=manual');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
  });

  await runTest('Get vault stats', async () => {
    const res = await apiCall('GET', '/api/vault/stats');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (typeof res.data.data?.totalEntries !== 'number') throw new Error('Missing totalEntries');
  });

  await runTest('Get vault contexts', async () => {
    const res = await apiCall('GET', '/api/vault/contexts');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
  });

  await runTest('Get vault tags', async () => {
    const res = await apiCall('GET', '/api/vault/tags');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
  });

  // ===== SEARCH =====
  console.log('\n🔍 Search\n');

  await runTest('Full-text search', async () => {
    const res = await apiCall('GET', '/api/vault/search?query=TypeScript');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
  });

  await runTest('Search with context filter', async () => {
    const res = await apiCall('GET', '/api/vault/search?query=test&context=Test');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
  });

  await runTest('Search with limit', async () => {
    const res = await apiCall('GET', '/api/vault/search?query=test&limit=5');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
    if (res.data.data.length > 5) throw new Error('Limit not respected');
  });

  // ===== TAG MANAGEMENT =====
  console.log('\n🏷️ Tag Management\n');

  await runTest('Add tags to entry', async () => {
    const res = await apiCall('POST', `/api/vault/${testEntryId}/tags`, {
      tags: ['new-tag', 'another-tag'],
    });
    if (!res.ok) throw new Error(`Failed: ${res.status} - ${JSON.stringify(res.data)}`);
    const tags = res.data.data?.tags || [];
    if (!tags.includes('new-tag')) throw new Error('Tag not added');
  });

  await runTest('Remove tags from entry', async () => {
    const res = await apiCall('DELETE', `/api/vault/${testEntryId}/tags`, {
      tags: ['another-tag'],
    });
    if (!res.ok) throw new Error(`Failed: ${res.status} - ${JSON.stringify(res.data)}`);
    const tags = res.data.data?.tags || [];
    if (tags.includes('another-tag')) throw new Error('Tag not removed');
  });

  // ===== RELATED ENTRIES =====
  console.log('\n🔗 Related Entries\n');

  await runTest('Link entries', async () => {
    const res = await apiCall('POST', `/api/vault/${testEntryId}/link`, {
      relatedIds: [testEntryId2],
    });
    if (!res.ok) throw new Error(`Failed: ${res.status} - ${JSON.stringify(res.data)}`);
    const related = res.data.data?.relatedEntries || [];
    if (!related.includes(testEntryId2)) throw new Error('Entry not linked');
  });

  await runTest('Get related entries', async () => {
    const res = await apiCall('GET', `/api/vault/${testEntryId}/related`);
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
    if (res.data.data.length === 0) throw new Error('No related entries found');
  });

  // ===== VALIDATION TESTS =====
  console.log('\n🛡️ Validation\n');

  await runTest('Reject invalid entry ID format', async () => {
    const res = await apiCall('GET', '/api/vault/invalid-id');
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Reject missing required fields', async () => {
    const res = await apiCall('POST', '/api/vault', {
      content: 'No title provided',
    });
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Reject invalid contentType', async () => {
    const res = await apiCall('POST', '/api/vault', {
      title: 'Test',
      contentType: 'invalid_type',
      context: 'Test',
      source: 'manual',
    });
    if (res.ok) throw new Error('Should have failed');
  });

  await runTest('Reject invalid source', async () => {
    const res = await apiCall('POST', '/api/vault', {
      title: 'Test',
      contentType: 'note',
      context: 'Test',
      source: 'invalid_source',
    });
    if (res.ok) throw new Error('Should have failed');
  });

  await runTest('Reject search without query', async () => {
    const res = await apiCall('GET', '/api/vault/search');
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // ===== CLEANUP =====
  console.log('\n🧹 Cleanup\n');

  await runTest('Delete test entries', async () => {
    const allIds = [testEntryId, testEntryId2].filter(Boolean);
    const deleteResults = await Promise.all(
      allIds.map((id) => apiCall('DELETE', `/api/vault/${id}`))
    );
    const failures = deleteResults.filter((r) => !r.ok);
    if (failures.length > 0) throw new Error(`Failed to delete ${failures.length} entries`);
  });

  // ===== SUMMARY =====
  console.log('\n' + '='.repeat(60));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;
  const percentage = Math.round((passed / total) * 100);

  console.log(`\n📊 Results: ${passed}/${total} tests passed (${percentage}%)`);

  if (failed > 0) {
    console.log('\n❌ Failed tests:');
    results.filter((r) => !r.passed).forEach((r) => {
      console.log(`   - ${r.name}: ${r.error}`);
    });
  }

  console.log(`\n⏱️  Total time: ${results.reduce((a, b) => a + b.duration, 0)}ms`);
  console.log(`Finished: ${new Date().toISOString()}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main();

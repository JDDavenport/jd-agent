/**
 * JD Agent - Comprehensive Search API Test Script
 *
 * Tests all search-related endpoints including:
 * - Universal search
 * - Quick search
 * - Natural language search
 * - Search suggestions
 * - Class-specific queries
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
  console.log('\n🧪 JD Agent - Search API Test Suite');
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

  // ===== UNIVERSAL SEARCH =====
  console.log('🔍 Universal Search (POST /api/search)\n');

  await runTest('Search with basic query', async () => {
    const res = await apiCall('POST', '/api/search', { query: 'test' });
    if (!res.ok) throw new Error(`Failed: ${res.status} - ${JSON.stringify(res.data)}`);
    if (!res.data.results) throw new Error('Missing results array');
    if (typeof res.data.total !== 'number') throw new Error('Missing total');
    if (typeof res.data.timing !== 'number') throw new Error('Missing timing');
  });

  await runTest('Search with type filter', async () => {
    const res = await apiCall('POST', '/api/search', { query: 'test', types: ['task'] });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.results)) throw new Error('Expected results array');
    // All results should be tasks
    for (const result of res.data.results) {
      if (result.type !== 'task') throw new Error(`Expected task type, got ${result.type}`);
    }
  });

  await runTest('Search with multiple types', async () => {
    const res = await apiCall('POST', '/api/search', {
      query: 'test',
      types: ['task', 'vault'],
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.results)) throw new Error('Expected results array');
  });

  await runTest('Search with context filter', async () => {
    const res = await apiCall('POST', '/api/search', {
      query: 'test',
      context: 'MBA',
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.results)) throw new Error('Expected results array');
  });

  await runTest('Search with limit', async () => {
    const res = await apiCall('POST', '/api/search', {
      query: 'test',
      limit: 5,
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.results.length > 5) throw new Error('Limit not respected');
  });

  await runTest('Search with offset', async () => {
    const res = await apiCall('POST', '/api/search', {
      query: 'test',
      offset: 10,
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.results)) throw new Error('Expected results array');
  });

  await runTest('Search with date range', async () => {
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const res = await apiCall('POST', '/api/search', {
      query: 'test',
      dateFrom: monthAgo.toISOString(),
      dateTo: now.toISOString(),
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.results)) throw new Error('Expected results array');
  });

  await runTest('Search returns searchType and timing', async () => {
    const res = await apiCall('POST', '/api/search', { query: 'test' });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.searchType) throw new Error('Missing searchType');
    if (!['fulltext', 'semantic', 'hybrid'].includes(res.data.searchType)) {
      throw new Error(`Invalid searchType: ${res.data.searchType}`);
    }
    if (typeof res.data.timing !== 'number') throw new Error('Missing timing');
  });

  // ===== QUICK SEARCH =====
  console.log('\n⚡ Quick Search (GET /api/search)\n');

  await runTest('Quick search with query param', async () => {
    const res = await apiCall('GET', '/api/search?q=test');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.results)) throw new Error('Expected results array');
  });

  await runTest('Quick search with type param', async () => {
    const res = await apiCall('GET', '/api/search?q=test&type=task');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.results)) throw new Error('Expected results array');
  });

  await runTest('Quick search with context param', async () => {
    const res = await apiCall('GET', '/api/search?q=test&context=Personal');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.results)) throw new Error('Expected results array');
  });

  await runTest('Quick search with limit param', async () => {
    const res = await apiCall('GET', '/api/search?q=test&limit=3');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.results.length > 3) throw new Error('Limit not respected');
  });

  // ===== NATURAL LANGUAGE SEARCH =====
  console.log('\n💬 Natural Language Search\n');

  await runTest('Natural language search - basic query', async () => {
    const res = await apiCall('POST', '/api/search/natural', {
      query: 'What are my tasks for today?',
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    // Should return some kind of response object
    if (typeof res.data !== 'object') throw new Error('Expected object response');
  });

  await runTest('Natural language search - deadline query', async () => {
    const res = await apiCall('POST', '/api/search/natural', {
      query: 'What deadlines do I have this week?',
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (typeof res.data !== 'object') throw new Error('Expected object response');
  });

  await runTest('Natural language search - event query', async () => {
    const res = await apiCall('POST', '/api/search/natural', {
      query: 'Show me upcoming meetings',
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (typeof res.data !== 'object') throw new Error('Expected object response');
  });

  // ===== SEARCH SUGGESTIONS =====
  console.log('\n💡 Search Suggestions\n');

  await runTest('Get suggestions with prefix', async () => {
    const res = await apiCall('GET', '/api/search/suggest?prefix=test');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.suggestions)) throw new Error('Expected suggestions array');
  });

  await runTest('Suggestions with custom limit', async () => {
    const res = await apiCall('GET', '/api/search/suggest?prefix=test&limit=3');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.suggestions)) throw new Error('Expected suggestions array');
    if (res.data.suggestions.length > 3) throw new Error('Limit not respected');
  });

  await runTest('Empty prefix returns empty array', async () => {
    const res = await apiCall('GET', '/api/search/suggest');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.suggestions)) throw new Error('Expected suggestions array');
    if (res.data.suggestions.length !== 0) throw new Error('Expected empty array');
  });

  // ===== CLASS-SPECIFIC SEARCH =====
  console.log('\n📚 Class-Specific Search\n');

  await runTest('List class agents', async () => {
    const res = await apiCall('GET', '/api/search/class');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.agents)) throw new Error('Expected agents array');
  });

  // Note: These may return 404 or 500 depending on implementation
  await runTest('Query non-existent class returns error', async () => {
    const res = await apiCall('POST', '/api/search/class/non-existent-id', {
      question: 'What topics are covered?',
    });
    // Should return error status (404 for not found, 500 for agent load failure)
    if (res.ok) throw new Error('Should have returned error for non-existent class');
    if (res.status !== 404 && res.status !== 500) {
      throw new Error(`Expected 404 or 500, got ${res.status}`);
    }
  });

  await runTest('Query class by name - non-existent returns 404', async () => {
    const res = await apiCall('POST', '/api/search/class/by-name/NONEXISTENT123', {
      question: 'What topics are covered?',
    });
    // 404 is expected for non-existent class by name
    if (res.ok) throw new Error('Should have returned error');
    if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
  });

  await runTest('Get class summary - non-existent returns error', async () => {
    const res = await apiCall('GET', '/api/search/class/non-existent-id/summary');
    // Should return error status (404 for not found, 500 for agent load failure)
    if (res.ok) throw new Error('Should have returned error for non-existent class');
    if (res.status !== 404 && res.status !== 500) {
      throw new Error(`Expected 404 or 500, got ${res.status}`);
    }
  });

  // ===== VALIDATION TESTS =====
  console.log('\n🛡️ Validation\n');

  await runTest('POST search requires query', async () => {
    const res = await apiCall('POST', '/api/search', {});
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('POST search rejects empty query', async () => {
    const res = await apiCall('POST', '/api/search', { query: '' });
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('GET search requires q param', async () => {
    const res = await apiCall('GET', '/api/search');
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Natural language requires query', async () => {
    const res = await apiCall('POST', '/api/search/natural', {});
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Class query requires question', async () => {
    const res = await apiCall('POST', '/api/search/class/some-id', {});
    if (res.ok && res.status !== 404) throw new Error('Should have failed with 400');
    // 400 for missing question or 404 for missing class - both valid
  });

  await runTest('Class query by name requires question', async () => {
    const res = await apiCall('POST', '/api/search/class/by-name/MBA501', {});
    if (res.ok && res.status !== 404) throw new Error('Should have failed with 400');
  });

  // ===== SEARCH RESULT STRUCTURE =====
  console.log('\n📦 Response Structure\n');

  await runTest('Search results have correct structure', async () => {
    const res = await apiCall('POST', '/api/search', { query: 'test' });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);

    // Check top-level structure
    if (!('results' in res.data)) throw new Error('Missing results');
    if (!('total' in res.data)) throw new Error('Missing total');
    if (!('query' in res.data)) throw new Error('Missing query');
    if (!('searchType' in res.data)) throw new Error('Missing searchType');
    if (!('timing' in res.data)) throw new Error('Missing timing');

    // Check result items structure if any exist
    if (res.data.results.length > 0) {
      const result = res.data.results[0];
      if (!result.type) throw new Error('Result missing type');
      if (!result.id) throw new Error('Result missing id');
      if (!result.title) throw new Error('Result missing title');
      if (typeof result.score !== 'number') throw new Error('Result missing score');
    }
  });

  await runTest('Search result items have metadata', async () => {
    const res = await apiCall('POST', '/api/search', { query: 'test' });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);

    // Check result items have metadata if any exist
    if (res.data.results.length > 0) {
      const result = res.data.results[0];
      if (!result.metadata) throw new Error('Result missing metadata');
      if (typeof result.metadata !== 'object') throw new Error('Metadata should be object');
    }
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

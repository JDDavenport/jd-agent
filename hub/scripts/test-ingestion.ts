/**
 * JD Agent - Comprehensive Ingestion API Test Script
 *
 * Tests all ingestion-related endpoints including:
 * - Integration status checks
 * - Canvas LMS endpoints
 * - Remarkable endpoints
 * - Plaud endpoints
 * - Gmail endpoints
 * - Quick capture
 * - Voice memo processing
 *
 * Note: Many integrations may not be configured, tests handle both states.
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
const createdIds: { tasks: string[]; vault: string[] } = { tasks: [], vault: [] };

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
  console.log('\n🧪 JD Agent - Ingestion API Test Suite');
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

  // ===== OVERALL STATUS =====
  console.log('📊 Integration Status\n');

  await runTest('Get overall ingestion status', async () => {
    const res = await apiCall('GET', '/api/ingestion/status');
    if (!res.ok) throw new Error(`Failed: ${res.status} - ${JSON.stringify(res.data)}`);
    if (!res.data.data) throw new Error('Missing data');
    if (!('canvas' in res.data.data)) throw new Error('Missing canvas status');
    if (!('remarkable' in res.data.data)) throw new Error('Missing remarkable status');
    if (!('plaud' in res.data.data)) throw new Error('Missing plaud status');
  });

  await runTest('Status includes configuration flags', async () => {
    const res = await apiCall('GET', '/api/ingestion/status');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (typeof res.data.data.canvas.configured !== 'boolean') {
      throw new Error('Canvas configured should be boolean');
    }
  });

  // ===== CANVAS INTEGRATION =====
  console.log('\n📚 Canvas LMS Integration\n');

  await runTest('Get Canvas status', async () => {
    const res = await apiCall('GET', '/api/ingestion/canvas/status');
    // May return 400 if not configured, or 200 if configured
    if (res.status !== 200 && res.status !== 400) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
    if (res.status === 400) {
      if (res.data.error?.code !== 'NOT_CONFIGURED') {
        throw new Error('Expected NOT_CONFIGURED error');
      }
    } else {
      if (typeof res.data.data?.configured !== 'boolean') {
        throw new Error('Missing configured flag');
      }
    }
  });

  await runTest('Get Canvas courses (handles not configured)', async () => {
    const res = await apiCall('GET', '/api/ingestion/canvas/courses');
    if (res.status !== 200 && res.status !== 400) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
    if (res.status === 200) {
      if (!Array.isArray(res.data.data)) throw new Error('Expected courses array');
    }
  });

  await runTest('Get Canvas assignments (handles not configured)', async () => {
    const res = await apiCall('GET', '/api/ingestion/canvas/assignments');
    if (res.status !== 200 && res.status !== 400) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
  });

  await runTest('Get Canvas current courses (handles not configured)', async () => {
    const res = await apiCall('GET', '/api/ingestion/canvas/current-courses');
    if (res.status !== 200 && res.status !== 400) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
  });

  await runTest('Canvas sync endpoint exists', async () => {
    const res = await apiCall('POST', '/api/ingestion/canvas/sync');
    // Should return 400 (not configured) or 200 (success) or 500 (error)
    if (res.status !== 200 && res.status !== 400 && res.status !== 500) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
  });

  await runTest('Canvas assignment sync endpoint exists', async () => {
    const res = await apiCall('POST', '/api/ingestion/canvas/sync/assignments');
    if (res.status !== 200 && res.status !== 400 && res.status !== 500) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
  });

  await runTest('Canvas daily check endpoint exists', async () => {
    const res = await apiCall('POST', '/api/ingestion/canvas/daily-check');
    if (res.status !== 200 && res.status !== 400 && res.status !== 500) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
  });

  await runTest('Canvas deep scan validates course ID', async () => {
    const res = await apiCall('GET', '/api/ingestion/canvas/course/invalid/deep-scan');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    if (res.data.error?.code !== 'INVALID_ID' && res.data.error?.code !== 'NOT_CONFIGURED') {
      throw new Error('Expected INVALID_ID or NOT_CONFIGURED error');
    }
  });

  // ===== REMARKABLE INTEGRATION =====
  console.log('\n📝 Remarkable Integration\n');

  await runTest('Get Remarkable status', async () => {
    const res = await apiCall('GET', '/api/ingestion/remarkable/status');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.data) throw new Error('Missing data');
    if (typeof res.data.data.configured !== 'boolean') {
      throw new Error('Missing configured flag');
    }
  });

  await runTest('Remarkable status includes setup instructions when not configured', async () => {
    const res = await apiCall('GET', '/api/ingestion/remarkable/status');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    // If not configured, should have setup instructions
    if (!res.data.data.configured && !res.data.setupInstructions) {
      throw new Error('Expected setup instructions when not configured');
    }
  });

  await runTest('Get Remarkable documents (handles not configured)', async () => {
    const res = await apiCall('GET', '/api/ingestion/remarkable/documents');
    if (res.status !== 200 && res.status !== 400) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
  });

  await runTest('Remarkable sync endpoint exists', async () => {
    const res = await apiCall('POST', '/api/ingestion/remarkable/sync');
    if (res.status !== 200 && res.status !== 400 && res.status !== 500) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
  });

  await runTest('Remarkable watch start endpoint exists', async () => {
    const res = await apiCall('POST', '/api/ingestion/remarkable/watch/start');
    if (res.status !== 200 && res.status !== 400) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
  });

  await runTest('Remarkable watch stop endpoint exists', async () => {
    const res = await apiCall('POST', '/api/ingestion/remarkable/watch/stop');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
  });

  // ===== PLAUD INTEGRATION =====
  console.log('\n🎙️ Plaud Integration\n');

  await runTest('Get Plaud status', async () => {
    const res = await apiCall('GET', '/api/ingestion/plaud/status');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.data) throw new Error('Missing data');
    if (typeof res.data.data.configured !== 'boolean') {
      throw new Error('Missing configured flag');
    }
  });

  await runTest('Get Plaud recordings (handles not configured)', async () => {
    const res = await apiCall('GET', '/api/ingestion/plaud/recordings');
    if (res.status !== 200 && res.status !== 400) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
  });

  await runTest('Plaud sync endpoint exists', async () => {
    const res = await apiCall('POST', '/api/ingestion/plaud/sync');
    if (res.status !== 200 && res.status !== 400 && res.status !== 500) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
  });

  await runTest('Plaud watch start endpoint exists', async () => {
    const res = await apiCall('POST', '/api/ingestion/plaud/watch/start');
    if (res.status !== 200 && res.status !== 400) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
  });

  await runTest('Plaud watch stop endpoint exists', async () => {
    const res = await apiCall('POST', '/api/ingestion/plaud/watch/stop');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
  });

  // ===== GMAIL INTEGRATION =====
  console.log('\n📧 Gmail Integration\n');

  await runTest('Get Gmail status', async () => {
    const res = await apiCall('GET', '/api/ingestion/gmail/status');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.data) throw new Error('Missing data');
    if (typeof res.data.data.configured !== 'boolean') {
      throw new Error('Missing configured flag');
    }
  });

  await runTest('Gmail fetch endpoint exists', async () => {
    const res = await apiCall('POST', '/api/ingestion/gmail/fetch');
    if (res.status !== 200 && res.status !== 400 && res.status !== 500) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
  });

  // ===== QUICK CAPTURE =====
  console.log('\n⚡ Quick Capture\n');

  await runTest('Capture a task', async () => {
    const res = await apiCall('POST', '/api/ingestion/capture', {
      type: 'task',
      content: 'Test task from ingestion test',
      context: 'Test',
    });
    if (!res.ok) throw new Error(`Failed: ${res.status} - ${JSON.stringify(res.data)}`);
    if (!res.data.success) throw new Error('Expected success');
    if (res.data.data?.type !== 'task') throw new Error('Expected task type');
    if (!res.data.data?.id) throw new Error('Missing ID');
    createdIds.tasks.push(res.data.data.id);
  });

  await runTest('Capture a note', async () => {
    const res = await apiCall('POST', '/api/ingestion/capture', {
      type: 'note',
      content: 'Test note from ingestion test - this is some longer content for the note',
      context: 'Test',
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
    if (res.data.data?.type !== 'vault_entry') throw new Error('Expected vault_entry type');
    if (!res.data.data?.id) throw new Error('Missing ID');
    createdIds.vault.push(res.data.data.id);
  });

  await runTest('Capture an idea', async () => {
    const res = await apiCall('POST', '/api/ingestion/capture', {
      type: 'idea',
      content: 'Test idea from ingestion test - a brilliant new concept',
      context: 'Test',
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
    if (res.data.data?.type !== 'vault_entry') throw new Error('Expected vault_entry type');
    createdIds.vault.push(res.data.data.id);
  });

  await runTest('Capture defaults to task type', async () => {
    const res = await apiCall('POST', '/api/ingestion/capture', {
      content: 'Another test task with default type',
      context: 'Test',
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.data?.type !== 'task') throw new Error('Expected default task type');
    createdIds.tasks.push(res.data.data.id);
  });

  await runTest('Capture uses default context', async () => {
    const res = await apiCall('POST', '/api/ingestion/capture', {
      content: 'Task with default context',
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
    createdIds.tasks.push(res.data.data.id);
  });

  // ===== VOICE MEMO =====
  console.log('\n🎤 Voice Memo Processing\n');

  await runTest('Process voice memo', async () => {
    const res = await apiCall('POST', '/api/ingestion/voice', {
      transcript: 'This is a test voice memo transcription. Remember to call the dentist and schedule an appointment.',
      duration: 15,
      context: 'Test',
    });
    if (!res.ok) throw new Error(`Failed: ${res.status} - ${JSON.stringify(res.data)}`);
    if (!res.data.success) throw new Error('Expected success');
    if (!res.data.data?.vaultEntryId) throw new Error('Missing vault entry ID');
    if (!res.data.data?.taskId) throw new Error('Missing task ID');
    createdIds.vault.push(res.data.data.vaultEntryId);
    createdIds.tasks.push(res.data.data.taskId);
  });

  await runTest('Voice memo creates both vault entry and task', async () => {
    const res = await apiCall('POST', '/api/ingestion/voice', {
      transcript: 'Another voice memo for testing the dual creation functionality.',
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.data?.vaultEntryId || !res.data.data?.taskId) {
      throw new Error('Should create both vault entry and task');
    }
    createdIds.vault.push(res.data.data.vaultEntryId);
    createdIds.tasks.push(res.data.data.taskId);
  });

  // ===== VALIDATION TESTS =====
  console.log('\n🛡️ Validation\n');

  await runTest('Capture requires content', async () => {
    const res = await apiCall('POST', '/api/ingestion/capture', {
      type: 'task',
      context: 'Test',
    });
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    if (res.data.error?.code !== 'INVALID_CONTENT') {
      throw new Error('Expected INVALID_CONTENT error');
    }
  });

  await runTest('Capture rejects empty content', async () => {
    const res = await apiCall('POST', '/api/ingestion/capture', {
      type: 'task',
      content: '',
    });
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Capture rejects whitespace-only content', async () => {
    const res = await apiCall('POST', '/api/ingestion/capture', {
      type: 'task',
      content: '   ',
    });
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Capture rejects invalid type', async () => {
    const res = await apiCall('POST', '/api/ingestion/capture', {
      type: 'invalid_type',
      content: 'Some content',
    });
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    if (res.data.error?.code !== 'INVALID_TYPE') {
      throw new Error('Expected INVALID_TYPE error');
    }
  });

  await runTest('Voice memo requires transcript', async () => {
    const res = await apiCall('POST', '/api/ingestion/voice', {
      duration: 10,
    });
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    if (res.data.error?.code !== 'INVALID_TRANSCRIPT') {
      throw new Error('Expected INVALID_TRANSCRIPT error');
    }
  });

  await runTest('Voice memo rejects empty transcript', async () => {
    const res = await apiCall('POST', '/api/ingestion/voice', {
      transcript: '',
    });
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // ===== CLEANUP =====
  console.log('\n🧹 Cleanup\n');

  await runTest('Delete test tasks', async () => {
    const deleteResults = await Promise.all(
      createdIds.tasks.map((id) => apiCall('DELETE', `/api/tasks/${id}`))
    );
    const failures = deleteResults.filter((r) => !r.ok);
    if (failures.length > 0) {
      console.log(`    (Note: ${failures.length} tasks may already be deleted)`);
    }
  });

  await runTest('Delete test vault entries', async () => {
    const deleteResults = await Promise.all(
      createdIds.vault.map((id) => apiCall('DELETE', `/api/vault/${id}`))
    );
    const failures = deleteResults.filter((r) => !r.ok);
    if (failures.length > 0) {
      console.log(`    (Note: ${failures.length} vault entries may already be deleted)`);
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

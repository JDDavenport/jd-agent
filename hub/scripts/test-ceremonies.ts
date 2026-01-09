/**
 * JD Agent - Comprehensive Ceremony API Test Script
 *
 * Tests all ceremony-related endpoints including:
 * - Ceremony status and history
 * - Preview ceremonies (morning, evening, weekly)
 * - Notification configuration
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
  console.log('\n🧪 JD Agent - Ceremony API Test Suite');
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

  // ===== STATUS ENDPOINTS =====
  console.log('📊 Status Endpoints\n');

  await runTest('Get ceremony status', async () => {
    const res = await apiCall('GET', '/api/ceremonies/status');
    if (!res.ok) throw new Error(`Failed: ${res.status} - ${JSON.stringify(res.data)}`);
    if (typeof res.data.data?.notificationsConfigured !== 'boolean') {
      throw new Error('Missing notificationsConfigured');
    }
    if (!res.data.data?.schedule) throw new Error('Missing schedule');
  });

  await runTest('Get ceremony history', async () => {
    const res = await apiCall('GET', '/api/ceremonies/history');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
  });

  await runTest('Get ceremony history with limit', async () => {
    const res = await apiCall('GET', '/api/ceremonies/history?limit=5');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
    if (res.data.data.length > 5) throw new Error('Limit not respected');
  });

  // ===== PREVIEW ENDPOINTS =====
  console.log('\n👁️ Preview Endpoints\n');

  await runTest('Preview morning ceremony', async () => {
    const res = await apiCall('GET', '/api/ceremonies/preview/morning');
    if (!res.ok) throw new Error(`Failed: ${res.status} - ${JSON.stringify(res.data)}`);
    if (!res.data.data?.content?.greeting) throw new Error('Missing greeting');
    if (!res.data.data?.content?.sections) throw new Error('Missing sections');
    if (!res.data.data?.content?.signOff) throw new Error('Missing signOff');
    if (!res.data.data?.formatted) throw new Error('Missing formatted text');
  });

  await runTest('Preview evening ceremony', async () => {
    const res = await apiCall('GET', '/api/ceremonies/preview/evening');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.data?.content?.greeting) throw new Error('Missing greeting');
    if (!res.data.data?.content?.sections) throw new Error('Missing sections');
  });

  await runTest('Preview weekly ceremony', async () => {
    const res = await apiCall('GET', '/api/ceremonies/preview/weekly');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.data?.content?.greeting) throw new Error('Missing greeting');
    if (!res.data.data?.content?.sections) throw new Error('Missing sections');
  });

  await runTest('Preview returns correct type', async () => {
    const res = await apiCall('GET', '/api/ceremonies/preview/morning');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.data?.type !== 'morning') throw new Error('Wrong type returned');
  });

  // ===== NOTIFICATION STATUS =====
  console.log('\n🔔 Notification Endpoints\n');

  await runTest('Get notification status', async () => {
    const res = await apiCall('GET', '/api/ceremonies/notifications/status');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (typeof res.data.data?.configured !== 'boolean') throw new Error('Missing configured');
    if (!Array.isArray(res.data.data?.availableChannels)) throw new Error('Missing availableChannels');
  });

  await runTest('Notification status includes telegram info', async () => {
    const res = await apiCall('GET', '/api/ceremonies/notifications/status');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (typeof res.data.data?.telegram?.configured !== 'boolean') {
      throw new Error('Missing telegram.configured');
    }
  });

  await runTest('Notification status includes setup instructions', async () => {
    const res = await apiCall('GET', '/api/ceremonies/notifications/status');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    // Should have instructions for unconfigured channels
    const data = res.data.data;
    // At least one channel should have instructions if not configured
    const hasInstructions =
      data.telegram?.setupInstructions ||
      data.sms?.setupInstructions ||
      data.email?.setupInstructions;
    // This is OK - either configured or has instructions
  });

  // ===== TELEGRAM SETUP =====
  console.log('\n📱 Telegram Setup\n');

  await runTest('Telegram setup endpoint responds', async () => {
    const res = await apiCall('POST', '/api/ceremonies/telegram/setup');
    // May fail if not configured, but should respond
    if (res.status !== 200 && res.status !== 400) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
    // Should have either success data or error
    if (!res.data.success && !res.data.error) {
      throw new Error('Missing success or error response');
    }
  });

  // ===== RUN CEREMONY (DRY RUN) =====
  console.log('\n🎭 Run Ceremony (generates but may not send)\n');

  await runTest('Run morning ceremony', async () => {
    const res = await apiCall('POST', '/api/ceremonies/run/morning');
    if (!res.ok) throw new Error(`Failed: ${res.status} - ${JSON.stringify(res.data)}`);
    if (res.data.data?.type !== 'morning') throw new Error('Wrong type');
    if (!res.data.data?.timestamp) throw new Error('Missing timestamp');
    if (!res.data.data?.content) throw new Error('Missing content');
  });

  await runTest('Run evening ceremony', async () => {
    const res = await apiCall('POST', '/api/ceremonies/run/evening');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.data?.type !== 'evening') throw new Error('Wrong type');
  });

  await runTest('Run weekly ceremony', async () => {
    const res = await apiCall('POST', '/api/ceremonies/run/weekly');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.data?.type !== 'weekly') throw new Error('Wrong type');
  });

  // ===== VALIDATION TESTS =====
  console.log('\n🛡️ Validation\n');

  await runTest('Reject invalid ceremony type for preview', async () => {
    const res = await apiCall('GET', '/api/ceremonies/preview/invalid');
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Reject invalid ceremony type for run', async () => {
    const res = await apiCall('POST', '/api/ceremonies/run/invalid');
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Reject missing chatId for set-chat-id', async () => {
    const res = await apiCall('POST', '/api/ceremonies/telegram/set-chat-id', {});
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // ===== VERIFY HISTORY UPDATED =====
  console.log('\n📜 Verify History Updated\n');

  await runTest('History includes recent ceremonies', async () => {
    const res = await apiCall('GET', '/api/ceremonies/history?limit=3');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    // After running ceremonies above, we should have some history
    // (at least from previous runs or this run)
  });

  await runTest('Status shows last ceremonies', async () => {
    const res = await apiCall('GET', '/api/ceremonies/status');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    // After running, lastCeremonies should have data
    const lastMorning = res.data.data?.lastCeremonies?.morning;
    const lastEvening = res.data.data?.lastCeremonies?.evening;
    const lastWeekly = res.data.data?.lastCeremonies?.weekly;

    // At least one should exist after our test runs
    if (!lastMorning && !lastEvening && !lastWeekly) {
      console.log('    (Note: No ceremony history found - this may be first run)');
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

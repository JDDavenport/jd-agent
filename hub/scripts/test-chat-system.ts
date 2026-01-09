/**
 * JD Agent - Comprehensive Chat & System API Test Script
 *
 * Tests all chat and system-related endpoints including:
 * - Chat with Master Agent
 * - Chat status and context
 * - Time tracking
 * - Integrity checks
 * - System info
 *
 * Note: Chat may require OPENAI_API_KEY to be configured.
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
  console.log('\n🧪 JD Agent - Chat & System API Test Suite');
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

  // ===== CHAT STATUS =====
  console.log('💬 Chat Status\n');

  await runTest('Get chat status', async () => {
    const res = await apiCall('GET', '/api/chat/status');
    if (!res.ok) throw new Error(`Failed: ${res.status} - ${JSON.stringify(res.data)}`);
    if (!res.data.success) throw new Error('Expected success');
    if (typeof res.data.data?.configured !== 'boolean') throw new Error('Missing configured flag');
    if (typeof res.data.data?.historyLength !== 'number') throw new Error('Missing historyLength');
  });

  await runTest('Chat status includes context', async () => {
    const res = await apiCall('GET', '/api/chat/status');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.data?.context) throw new Error('Missing context');
    if (!res.data.data.context.currentTime) throw new Error('Missing currentTime');
  });

  await runTest('Chat status shows task counts', async () => {
    const res = await apiCall('GET', '/api/chat/status');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (typeof res.data.data?.context?.todaysTaskCount !== 'number') {
      throw new Error('Missing todaysTaskCount');
    }
    if (typeof res.data.data?.context?.upcomingEventCount !== 'number') {
      throw new Error('Missing upcomingEventCount');
    }
  });

  // ===== CHAT CONTEXT =====
  console.log('\n📋 Chat Context\n');

  await runTest('Get chat context', async () => {
    const res = await apiCall('GET', '/api/chat/context');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
    if (!res.data.data) throw new Error('Missing data');
  });

  await runTest('Context includes current time', async () => {
    const res = await apiCall('GET', '/api/chat/context');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.data?.currentTime) throw new Error('Missing currentTime');
  });

  await runTest('Context includes task info', async () => {
    const res = await apiCall('GET', '/api/chat/context');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data?.todaysTasks)) throw new Error('Missing todaysTasks');
  });

  // ===== CHAT CLEAR =====
  console.log('\n🗑️ Chat History\n');

  await runTest('Clear chat history', async () => {
    const res = await apiCall('POST', '/api/chat/clear');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
  });

  await runTest('History length is 0 after clear', async () => {
    const res = await apiCall('GET', '/api/chat/status');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.data?.historyLength !== 0) throw new Error('Expected historyLength to be 0');
  });

  // ===== CHAT MESSAGE =====
  console.log('\n🗣️ Chat Message\n');

  await runTest('Send chat message (handles unconfigured)', async () => {
    const res = await apiCall('POST', '/api/chat', {
      message: 'Hello, what can you help me with?',
    });
    // May return 503 if not configured, 200 if configured
    if (res.status !== 200 && res.status !== 503) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
    if (res.status === 503) {
      if (res.data.error?.code !== 'AGENT_NOT_CONFIGURED') {
        throw new Error('Expected AGENT_NOT_CONFIGURED error');
      }
      console.log('    (Note: Agent not configured - OPENAI_API_KEY not set)');
    } else {
      if (!res.data.success) throw new Error('Expected success');
      if (!res.data.data?.message) throw new Error('Missing response message');
    }
  });

  await runTest('Chat with clearHistory flag', async () => {
    const res = await apiCall('POST', '/api/chat', {
      message: 'Start fresh',
      clearHistory: true,
    });
    // May return 503 if not configured
    if (res.status !== 200 && res.status !== 503) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
  });

  // ===== CHAT VALIDATION =====
  console.log('\n🛡️ Chat Validation\n');

  await runTest('Chat requires message', async () => {
    const res = await apiCall('POST', '/api/chat', {});
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Chat rejects empty message', async () => {
    const res = await apiCall('POST', '/api/chat', { message: '' });
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // ===== SYSTEM INFO =====
  console.log('\n📊 System Info\n');

  await runTest('Get system info', async () => {
    const res = await apiCall('GET', '/api/system/info');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
    if (!res.data.data?.name) throw new Error('Missing name');
    if (!res.data.data?.version) throw new Error('Missing version');
  });

  await runTest('System info includes integrations status', async () => {
    const res = await apiCall('GET', '/api/system/info');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.data?.integrations) throw new Error('Missing integrations');
    if (typeof res.data.data.integrations.openai !== 'boolean') {
      throw new Error('Missing openai integration status');
    }
  });

  await runTest('System info includes environment', async () => {
    const res = await apiCall('GET', '/api/system/info');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.data?.environment) throw new Error('Missing environment');
  });

  // ===== SYSTEM HEALTH =====
  console.log('\n🏥 System Health\n');

  await runTest('Get system health', async () => {
    const res = await apiCall('GET', '/api/system/health');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
    if (!res.data.data) throw new Error('Missing data');
  });

  await runTest('Health includes status', async () => {
    const res = await apiCall('GET', '/api/system/health');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.data?.status) throw new Error('Missing status');
  });

  // ===== TIME TRACKING =====
  console.log('\n⏱️ Time Tracking\n');

  await runTest('Get today time tracking', async () => {
    const res = await apiCall('GET', '/api/system/time/today');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
    if (!res.data.data) throw new Error('Missing data');
  });

  await runTest('Log time entry', async () => {
    const res = await apiCall('POST', '/api/system/time/log', {
      totalScreenTimeMinutes: 120,
      productiveMinutes: 90,
      wasteMinutes: 30,
    });
    if (!res.ok) throw new Error(`Failed: ${res.status} - ${JSON.stringify(res.data)}`);
    if (!res.data.success) throw new Error('Expected success');
  });

  await runTest('Log time entry with date', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];

    const res = await apiCall('POST', '/api/system/time/log', {
      date: dateStr,
      totalScreenTimeMinutes: 180,
      productiveMinutes: 120,
      wasteMinutes: 60,
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
  });

  await runTest('Log time with app breakdown', async () => {
    const res = await apiCall('POST', '/api/system/time/log', {
      totalScreenTimeMinutes: 60,
      appBreakdown: {
        'VS Code': 30,
        'Chrome': 20,
        'Slack': 10,
      },
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
  });

  await runTest('Get daily report', async () => {
    const res = await apiCall('GET', '/api/system/time/report');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
    if (!res.data.data) throw new Error('Missing data');
  });

  await runTest('Get daily report with date', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const res = await apiCall('GET', `/api/system/time/report?date=${yesterday.toISOString()}`);
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
  });

  await runTest('Get time stats', async () => {
    const res = await apiCall('GET', '/api/system/time/stats');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
    if (!res.data.data) throw new Error('Missing data');
  });

  await runTest('Get time stats with custom days', async () => {
    const res = await apiCall('GET', '/api/system/time/stats?days=14');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
  });

  await runTest('Get weekly summary', async () => {
    const res = await apiCall('GET', '/api/system/time/weekly');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
    if (!res.data.data) throw new Error('Missing data');
  });

  await runTest('Get time range', async () => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const res = await apiCall(
      'GET',
      `/api/system/time/range?start=${weekAgo.toISOString().split('T')[0]}&end=${now.toISOString().split('T')[0]}`
    );
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
  });

  await runTest('Time range requires start', async () => {
    const now = new Date();
    const res = await apiCall('GET', `/api/system/time/range?end=${now.toISOString().split('T')[0]}`);
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Time range requires end', async () => {
    const now = new Date();
    const res = await apiCall('GET', `/api/system/time/range?start=${now.toISOString().split('T')[0]}`);
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // ===== INTEGRITY CHECKS =====
  console.log('\n🔒 Integrity Checks\n');

  await runTest('Run integrity check', async () => {
    const res = await apiCall('POST', '/api/system/integrity/check', {});
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
    if (!res.data.data) throw new Error('Missing data');
    if (typeof res.data.data.passed !== 'number') throw new Error('Missing passed count');
    if (typeof res.data.data.totalChecks !== 'number') throw new Error('Missing totalChecks');
  });

  await runTest('Run integrity check with autoFix', async () => {
    const res = await apiCall('POST', '/api/system/integrity/check', { autoFix: true });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
  });

  await runTest('Integrity check includes health status', async () => {
    const res = await apiCall('POST', '/api/system/integrity/check', {});
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.data?.overallHealth) throw new Error('Missing overallHealth');
  });

  await runTest('Get integrity history', async () => {
    const res = await apiCall('GET', '/api/system/integrity/history');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
    if (typeof res.data.count !== 'number') throw new Error('Missing count');
  });

  await runTest('Get integrity history with limit', async () => {
    const res = await apiCall('GET', '/api/system/integrity/history?limit=5');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.data.length > 5) throw new Error('Limit not respected');
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

/**
 * JD Agent - Comprehensive Analytics API Test Script
 *
 * Tests all analytics-related endpoints including:
 * - Dashboard overview
 * - Task metrics
 * - Time tracking
 * - Goals & coaching
 * - System health & verification
 * - Integrity checks
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

function futureDate(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString();
}

async function main() {
  console.log('\n🧪 JD Agent - Analytics API Test Suite');
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

  // ===== DASHBOARD =====
  console.log('📊 Dashboard Overview\n');

  await runTest('Get dashboard overview', async () => {
    const res = await apiCall('GET', '/api/analytics/dashboard');
    if (!res.ok) throw new Error(`Failed: ${res.status} - ${JSON.stringify(res.data)}`);
    if (!res.data.timestamp) throw new Error('Missing timestamp');
    if (!res.data.tasks) throw new Error('Missing tasks section');
    if (!res.data.calendar) throw new Error('Missing calendar section');
    if (!res.data.vault) throw new Error('Missing vault section');
    if (!res.data.recordings) throw new Error('Missing recordings section');
    if (!res.data.systemHealth) throw new Error('Missing systemHealth section');
  });

  await runTest('Dashboard has correct task stats structure', async () => {
    const res = await apiCall('GET', '/api/analytics/dashboard');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    const tasks = res.data.tasks;
    if (typeof tasks.total !== 'number') throw new Error('Missing tasks.total');
    if (typeof tasks.completedToday !== 'number') throw new Error('Missing tasks.completedToday');
    if (typeof tasks.completedThisWeek !== 'number') throw new Error('Missing tasks.completedThisWeek');
    if (typeof tasks.overdue !== 'number') throw new Error('Missing tasks.overdue');
  });

  await runTest('Dashboard has correct vault stats structure', async () => {
    const res = await apiCall('GET', '/api/analytics/dashboard');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    const vault = res.data.vault;
    if (typeof vault.totalEntries !== 'number') throw new Error('Missing vault.totalEntries');
    if (typeof vault.addedThisWeek !== 'number') throw new Error('Missing vault.addedThisWeek');
  });

  await runTest('Dashboard has system health status', async () => {
    const res = await apiCall('GET', '/api/analytics/dashboard');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    const health = res.data.systemHealth;
    if (!['healthy', 'warning', 'critical'].includes(health.status)) {
      throw new Error(`Invalid status: ${health.status}`);
    }
    if (typeof health.recentFailures !== 'number') throw new Error('Missing recentFailures');
  });

  // ===== TASK METRICS =====
  console.log('\n📈 Task Metrics\n');

  await runTest('Get task metrics (default 7d)', async () => {
    const res = await apiCall('GET', '/api/analytics/tasks');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.period !== '7d') throw new Error('Expected default period 7d');
    if (!res.data.byStatus) throw new Error('Missing byStatus');
    if (!Array.isArray(res.data.byContext)) throw new Error('Missing byContext array');
    if (!Array.isArray(res.data.completionByDay)) throw new Error('Missing completionByDay');
  });

  await runTest('Get task metrics (24h period)', async () => {
    const res = await apiCall('GET', '/api/analytics/tasks?period=24h');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.period !== '24h') throw new Error('Period not respected');
  });

  await runTest('Get task metrics (30d period)', async () => {
    const res = await apiCall('GET', '/api/analytics/tasks?period=30d');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.period !== '30d') throw new Error('Period not respected');
  });

  await runTest('Get task metrics (90d period)', async () => {
    const res = await apiCall('GET', '/api/analytics/tasks?period=90d');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.period !== '90d') throw new Error('Period not respected');
  });

  await runTest('Task metrics byStatus is object', async () => {
    const res = await apiCall('GET', '/api/analytics/tasks');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (typeof res.data.byStatus !== 'object') throw new Error('byStatus should be object');
  });

  await runTest('Task metrics bySource is object', async () => {
    const res = await apiCall('GET', '/api/analytics/tasks');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (typeof res.data.bySource !== 'object') throw new Error('bySource should be object');
  });

  // ===== TIME TRACKING =====
  console.log('\n⏱️ Time Tracking\n');

  await runTest('Get time tracking data (default 7 days)', async () => {
    const res = await apiCall('GET', '/api/analytics/time');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.period !== '7d') throw new Error('Expected default 7d period');
    if (!Array.isArray(res.data.dailyData)) throw new Error('Missing dailyData array');
    if (!res.data.aggregates) throw new Error('Missing aggregates');
    if (!res.data.weeklyTrend) throw new Error('Missing weeklyTrend');
  });

  await runTest('Get time tracking data (14 days)', async () => {
    const res = await apiCall('GET', '/api/analytics/time?days=14');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.period !== '14d') throw new Error('Days not respected');
  });

  await runTest('Time tracking aggregates structure', async () => {
    const res = await apiCall('GET', '/api/analytics/time');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    const agg = res.data.aggregates;
    if (typeof agg.totalProductive !== 'number') throw new Error('Missing totalProductive');
    if (typeof agg.totalWaste !== 'number') throw new Error('Missing totalWaste');
    if (typeof agg.totalScreenTime !== 'number') throw new Error('Missing totalScreenTime');
    if (typeof agg.avgDailyProductive !== 'number') throw new Error('Missing avgDailyProductive');
    if (typeof agg.avgDailyWaste !== 'number') throw new Error('Missing avgDailyWaste');
  });

  await runTest('Time tracking weekly trend structure', async () => {
    const res = await apiCall('GET', '/api/analytics/time');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    const trend = res.data.weeklyTrend;
    if (!['improving', 'stable', 'worsening'].includes(trend.trend)) {
      throw new Error(`Invalid trend: ${trend.trend}`);
    }
  });

  await runTest('Log manual time entry', async () => {
    const res = await apiCall('POST', '/api/analytics/time/log', {
      appName: 'Test App',
      minutes: 30,
    });
    if (!res.ok) throw new Error(`Failed: ${res.status} - ${JSON.stringify(res.data)}`);
    if (!res.data.success) throw new Error('Expected success response');
  });

  await runTest('Log time entry with date', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const res = await apiCall('POST', '/api/analytics/time/log', {
      date: yesterday.toISOString(),
      appName: 'Another Test App',
      minutes: 15,
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success response');
  });

  // ===== GOALS & COACHING =====
  console.log('\n🎯 Goals & Coaching\n');

  let testGoalId: string = '';

  await runTest('Get goals (initially may be empty)', async () => {
    const res = await apiCall('GET', '/api/analytics/goals');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.goals)) throw new Error('Expected goals array');
    if (typeof res.data.summary !== 'string') throw new Error('Expected summary string');
  });

  await runTest('Create a goal', async () => {
    const res = await apiCall('POST', '/api/analytics/goals', {
      title: 'Test Goal - Complete Module 1',
      level: 'weekly',
      targetDate: futureDate(7),
      progress: 0,
    });
    if (!res.ok) throw new Error(`Failed: ${res.status} - ${JSON.stringify(res.data)}`);
    if (!res.data.success) throw new Error('Expected success');
    if (!res.data.goal?.id) throw new Error('Missing goal ID');
    testGoalId = res.data.goal.id;
  });

  await runTest('Create semester goal', async () => {
    const res = await apiCall('POST', '/api/analytics/goals', {
      title: 'Test Semester Goal - Graduate with honors',
      level: 'semester',
      targetDate: futureDate(120),
      progress: 25,
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
  });

  await runTest('Create monthly goal', async () => {
    const res = await apiCall('POST', '/api/analytics/goals', {
      title: 'Test Monthly Goal - Read 4 books',
      level: 'monthly',
      targetDate: futureDate(30),
      progress: 50,
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
  });

  await runTest('Get goals shows created goals', async () => {
    const res = await apiCall('GET', '/api/analytics/goals');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.goals.length < 3) throw new Error('Expected at least 3 goals');
  });

  await runTest('Update goal progress', async () => {
    if (!testGoalId) throw new Error('No test goal ID');
    const res = await apiCall('PATCH', `/api/analytics/goals/${testGoalId}/progress`, {
      progress: 50,
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
  });

  await runTest('Get coaching report', async () => {
    const res = await apiCall('GET', '/api/analytics/coaching');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (typeof res.data.tasksCompleted !== 'number') throw new Error('Missing tasksCompleted');
    if (typeof res.data.tasksMissed !== 'number') throw new Error('Missing tasksMissed');
    if (typeof res.data.completionRate !== 'number') throw new Error('Missing completionRate');
    if (typeof res.data.coachingMessage !== 'string') throw new Error('Missing coachingMessage');
    if (![1, 2, 3].includes(res.data.escalationLevel)) throw new Error('Invalid escalation level');
  });

  // ===== SYSTEM HEALTH =====
  console.log('\n🏥 System Health & Verification\n');

  await runTest('Get system health status', async () => {
    const res = await apiCall('GET', '/api/analytics/health');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!['healthy', 'warning', 'critical'].includes(res.data.overallStatus)) {
      throw new Error(`Invalid status: ${res.data.overallStatus}`);
    }
    if (!res.data.summary) throw new Error('Missing summary');
    if (!Array.isArray(res.data.checks)) throw new Error('Missing checks array');
    if (typeof res.data.browserVerificationAvailable !== 'boolean') {
      throw new Error('Missing browserVerificationAvailable');
    }
  });

  await runTest('Health check summary structure', async () => {
    const res = await apiCall('GET', '/api/analytics/health');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    const summary = res.data.summary;
    if (typeof summary.passed !== 'number') throw new Error('Missing passed count');
    if (typeof summary.failed !== 'number') throw new Error('Missing failed count');
    if (typeof summary.warnings !== 'number') throw new Error('Missing warnings count');
  });

  await runTest('Run verification', async () => {
    const res = await apiCall('POST', '/api/analytics/verify', {});
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.overallStatus) throw new Error('Missing overallStatus');
    if (!Array.isArray(res.data.checks)) throw new Error('Missing checks');
  });

  await runTest('Run verification with options', async () => {
    const res = await apiCall('POST', '/api/analytics/verify', {
      takeScreenshots: false,
      autoCorrect: false,
      notifyOnFailure: false,
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.overallStatus) throw new Error('Missing overallStatus');
  });

  await runTest('Verify URL endpoint', async () => {
    const res = await apiCall('POST', '/api/analytics/verify-url', {
      url: 'http://localhost:3000/api/health',
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (typeof res.data.success !== 'boolean') throw new Error('Missing success');
    if (typeof res.data.browserAvailable !== 'boolean') throw new Error('Missing browserAvailable');
  });

  await runTest('Screenshot endpoint (requires URL)', async () => {
    const res = await apiCall('POST', '/api/analytics/screenshot', {
      url: 'http://localhost:3000/api/health',
    });
    // May succeed or fail based on Playwright availability
    if (res.status !== 200 && res.status !== 500) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
    if (typeof res.data.browserAvailable !== 'boolean') {
      throw new Error('Missing browserAvailable');
    }
  });

  // ===== INTEGRITY CHECKS =====
  console.log('\n🔒 Integrity Checks\n');

  await runTest('Get integrity check history', async () => {
    const res = await apiCall('GET', '/api/analytics/integrity');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.checks)) throw new Error('Missing checks array');
    if (!res.data.summary) throw new Error('Missing summary');
  });

  await runTest('Integrity summary structure', async () => {
    const res = await apiCall('GET', '/api/analytics/integrity');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    const summary = res.data.summary;
    if (typeof summary.total !== 'number') throw new Error('Missing total');
    if (typeof summary.passed !== 'number') throw new Error('Missing passed');
    if (typeof summary.failed !== 'number') throw new Error('Missing failed');
    if (typeof summary.passRate !== 'number') throw new Error('Missing passRate');
  });

  await runTest('Get integrity with limit', async () => {
    const res = await apiCall('GET', '/api/analytics/integrity?limit=10');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.checks.length > 10) throw new Error('Limit not respected');
  });

  // ===== VALIDATION TESTS =====
  console.log('\n🛡️ Validation\n');

  await runTest('Time log requires appName', async () => {
    const res = await apiCall('POST', '/api/analytics/time/log', {
      minutes: 30,
    });
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Time log requires minutes', async () => {
    const res = await apiCall('POST', '/api/analytics/time/log', {
      appName: 'Test',
    });
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Goal creation requires title', async () => {
    const res = await apiCall('POST', '/api/analytics/goals', {
      level: 'weekly',
      targetDate: futureDate(7),
    });
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Goal creation requires level', async () => {
    const res = await apiCall('POST', '/api/analytics/goals', {
      title: 'Test Goal',
      targetDate: futureDate(7),
    });
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Goal creation requires targetDate', async () => {
    const res = await apiCall('POST', '/api/analytics/goals', {
      title: 'Test Goal',
      level: 'weekly',
    });
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Goal progress update requires progress', async () => {
    const res = await apiCall('PATCH', '/api/analytics/goals/some-id/progress', {});
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Screenshot requires URL', async () => {
    const res = await apiCall('POST', '/api/analytics/screenshot', {});
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Verify-url requires URL', async () => {
    const res = await apiCall('POST', '/api/analytics/verify-url', {});
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
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

/**
 * JD Agent - Comprehensive Schedule API Test Script
 *
 * Tests all schedule-related endpoints including:
 * - Task scheduling
 * - Task unscheduling
 * - Task rescheduling
 * - Today's schedule
 * - Schedule range queries
 * - Auto-scheduling suggestions
 * - Calendar sync
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
let testTaskId: string = '';
let testTaskId2: string = '';

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

function futureDate(hoursFromNow: number): string {
  const date = new Date();
  date.setHours(date.getHours() + hoursFromNow);
  return date.toISOString();
}

function todayAt(hour: number, minute: number = 0): string {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

async function main() {
  console.log('\n🧪 JD Agent - Schedule API Test Suite');
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

  // ===== SETUP: Create test tasks =====
  console.log('🔧 Setup: Creating test tasks\n');

  await runTest('Create test task 1', async () => {
    const res = await apiCall('POST', '/api/tasks', {
      title: 'Schedule Test Task 1',
      description: 'Task for schedule testing',
      context: 'Test',
      source: 'manual',
      timeEstimateMinutes: 60,
    });
    if (!res.ok) throw new Error(`Failed: ${res.status} - ${JSON.stringify(res.data)}`);
    if (!res.data.data?.id) throw new Error('Missing task ID');
    testTaskId = res.data.data.id;
  });

  await runTest('Create test task 2', async () => {
    const res = await apiCall('POST', '/api/tasks', {
      title: 'Schedule Test Task 2',
      description: 'Another task for schedule testing',
      context: 'Test',
      source: 'manual',
      timeEstimateMinutes: 30,
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.data?.id) throw new Error('Missing task ID');
    testTaskId2 = res.data.data.id;
  });

  // ===== SCHEDULE TASK =====
  console.log('\n📅 Schedule Task\n');

  await runTest('Schedule a task', async () => {
    const res = await apiCall('POST', '/api/schedule/task', {
      taskId: testTaskId,
      startTime: futureDate(2),
      createCalendarEvent: false,
    });
    if (!res.ok) throw new Error(`Failed: ${res.status} - ${JSON.stringify(res.data)}`);
    if (!res.data.success) throw new Error('Expected success');
    if (!res.data.data?.scheduledStart) throw new Error('Missing scheduledStart');
    if (!res.data.data?.scheduledEnd) throw new Error('Missing scheduledEnd');
  });

  await runTest('Schedule task with explicit end time', async () => {
    const startTime = futureDate(4);
    const endTime = futureDate(5);
    const res = await apiCall('POST', '/api/schedule/task', {
      taskId: testTaskId2,
      startTime,
      endTime,
      createCalendarEvent: false,
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
  });

  await runTest('Schedule non-existent task fails', async () => {
    const res = await apiCall('POST', '/api/schedule/task', {
      taskId: '00000000-0000-0000-0000-000000000000',
      startTime: futureDate(1),
      createCalendarEvent: false,
    });
    if (res.ok && res.data.success) throw new Error('Should have failed');
    // May return 400 with error or success: false
  });

  // ===== TODAY'S SCHEDULE =====
  console.log('\n📋 Today\'s Schedule\n');

  await runTest('Get today\'s schedule', async () => {
    const res = await apiCall('GET', '/api/schedule/today');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
    if (typeof res.data.count !== 'number') throw new Error('Missing count');
  });

  await runTest('Today\'s schedule returns task details', async () => {
    const res = await apiCall('GET', '/api/schedule/today');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    // Check structure if any tasks exist
    if (res.data.data.length > 0) {
      const task = res.data.data[0];
      if (!task.id) throw new Error('Task missing id');
      if (!task.title) throw new Error('Task missing title');
    }
  });

  // ===== SCHEDULE RANGE =====
  console.log('\n📆 Schedule Range\n');

  await runTest('Get schedule for date range', async () => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    const end = new Date(now);
    end.setDate(end.getDate() + 7);

    const res = await apiCall('GET', `/api/schedule/range?start=${start.toISOString()}&end=${end.toISOString()}`);
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
    if (typeof res.data.count !== 'number') throw new Error('Missing count');
  });

  await runTest('Schedule range requires start param', async () => {
    const end = new Date();
    const res = await apiCall('GET', `/api/schedule/range?end=${end.toISOString()}`);
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Schedule range requires end param', async () => {
    const start = new Date();
    const res = await apiCall('GET', `/api/schedule/range?start=${start.toISOString()}`);
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // ===== RESCHEDULE =====
  console.log('\n🔄 Reschedule Task\n');

  await runTest('Reschedule a task', async () => {
    const newStart = futureDate(6);
    const newEnd = futureDate(7);
    const res = await apiCall('PUT', `/api/schedule/task/${testTaskId}`, {
      startTime: newStart,
      endTime: newEnd,
    });
    if (!res.ok) throw new Error(`Failed: ${res.status} - ${JSON.stringify(res.data)}`);
    if (!res.data.success) throw new Error('Expected success');
  });

  await runTest('Reschedule with only start time', async () => {
    const newStart = futureDate(8);
    const res = await apiCall('PUT', `/api/schedule/task/${testTaskId}`, {
      startTime: newStart,
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
  });

  await runTest('Reschedule non-existent task', async () => {
    const res = await apiCall('PUT', '/api/schedule/task/00000000-0000-0000-0000-000000000000', {
      startTime: futureDate(1),
    });
    // Should fail gracefully
    if (res.ok && res.data.success) throw new Error('Should have failed for non-existent task');
  });

  // ===== SUGGESTIONS =====
  console.log('\n💡 Scheduling Suggestions\n');

  await runTest('Get scheduling suggestions', async () => {
    const res = await apiCall('GET', '/api/schedule/suggestions');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
    if (typeof res.data.count !== 'number') throw new Error('Missing count');
  });

  await runTest('Get suggestions with custom days', async () => {
    const res = await apiCall('GET', '/api/schedule/suggestions?days=14');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
  });

  await runTest('Suggestions have correct structure', async () => {
    const res = await apiCall('GET', '/api/schedule/suggestions');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    // If suggestions exist, check structure
    if (res.data.data.length > 0) {
      const suggestion = res.data.data[0];
      if (!suggestion.task) throw new Error('Missing task');
      if (!suggestion.task.id) throw new Error('Missing task.id');
      if (!suggestion.suggestedStart) throw new Error('Missing suggestedStart');
    }
  });

  await runTest('Accept scheduling suggestion', async () => {
    const res = await apiCall('POST', `/api/schedule/suggestions/${testTaskId}/accept`, {
      startTime: futureDate(10),
      endTime: futureDate(11),
    });
    // May succeed or fail depending on task state
    if (res.status !== 200 && res.status !== 400) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
  });

  // ===== CALENDAR SYNC =====
  console.log('\n📆 Calendar Sync\n');

  await runTest('Sync all to calendar', async () => {
    const res = await apiCall('POST', '/api/schedule/sync-calendar');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
    if (typeof res.data.data?.synced !== 'number') throw new Error('Missing synced count');
  });

  // ===== UNSCHEDULE =====
  console.log('\n❌ Unschedule Task\n');

  await runTest('Unschedule a task', async () => {
    const res = await apiCall('DELETE', `/api/schedule/task/${testTaskId}`);
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
  });

  await runTest('Unschedule already unscheduled task', async () => {
    const res = await apiCall('DELETE', `/api/schedule/task/${testTaskId}`);
    // Should handle gracefully - may succeed with "already unscheduled" or fail
    if (res.status !== 200 && res.status !== 400) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
  });

  await runTest('Unschedule non-existent task', async () => {
    const res = await apiCall('DELETE', '/api/schedule/task/00000000-0000-0000-0000-000000000000');
    // Should fail gracefully
    if (res.ok && res.data.success) {
      // Some implementations may return success even for non-existent
      console.log('    (Note: Returns success for non-existent task)');
    }
  });

  // ===== VALIDATION =====
  console.log('\n🛡️ Validation\n');

  await runTest('Schedule requires taskId', async () => {
    const res = await apiCall('POST', '/api/schedule/task', {
      startTime: futureDate(1),
    });
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Schedule requires startTime', async () => {
    const res = await apiCall('POST', '/api/schedule/task', {
      taskId: testTaskId,
    });
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Schedule validates UUID format', async () => {
    const res = await apiCall('POST', '/api/schedule/task', {
      taskId: 'not-a-uuid',
      startTime: futureDate(1),
    });
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Schedule validates datetime format', async () => {
    const res = await apiCall('POST', '/api/schedule/task', {
      taskId: testTaskId,
      startTime: 'not-a-date',
    });
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Reschedule requires startTime', async () => {
    const res = await apiCall('PUT', `/api/schedule/task/${testTaskId}`, {});
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // ===== CLEANUP =====
  console.log('\n🧹 Cleanup\n');

  await runTest('Delete test tasks', async () => {
    const results = await Promise.all([
      apiCall('DELETE', `/api/tasks/${testTaskId}`),
      apiCall('DELETE', `/api/tasks/${testTaskId2}`),
    ]);
    const failures = results.filter(r => !r.ok);
    if (failures.length > 0) {
      console.log(`    (Note: ${failures.length} tasks may already be deleted)`);
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

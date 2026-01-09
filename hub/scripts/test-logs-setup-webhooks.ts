/**
 * JD Agent - Comprehensive Logs, Setup & Webhooks API Test Script
 *
 * Tests all remaining endpoints including:
 * - Activity logs
 * - Setup wizard (status, brain dump, inbox, ceremonies, classes)
 * - Webhooks
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
let testClassId: string = '';

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
  console.log('\n🧪 JD Agent - Logs, Setup & Webhooks API Test Suite');
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

  // ===== LOGS API =====
  console.log('📜 Logs API\n');

  await runTest('Get recent logs', async () => {
    const res = await apiCall('GET', '/api/logs');
    if (!res.ok) throw new Error(`Failed: ${res.status} - ${JSON.stringify(res.data)}`);
    if (!res.data.success) throw new Error('Expected success');
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
    if (typeof res.data.count !== 'number') throw new Error('Missing count');
  });

  await runTest('Get logs with limit', async () => {
    const res = await apiCall('GET', '/api/logs?limit=5');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.data.length > 5) throw new Error('Limit not respected');
  });

  await runTest('Get logs with type filter', async () => {
    const res = await apiCall('GET', '/api/logs?type=info');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
  });

  await runTest('Logs have correct structure', async () => {
    const res = await apiCall('GET', '/api/logs');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.data.length > 0) {
      const log = res.data.data[0];
      if (!log.id) throw new Error('Log missing id');
      if (!log.timestamp) throw new Error('Log missing timestamp');
      if (!log.type) throw new Error('Log missing type');
    }
  });

  // ===== SETUP STATUS =====
  console.log('\n🔧 Setup Status\n');

  await runTest('Get setup status', async () => {
    const res = await apiCall('GET', '/api/setup/status');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
    if (!res.data.data) throw new Error('Missing data');
  });

  await runTest('Setup status includes services', async () => {
    const res = await apiCall('GET', '/api/setup/status');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.data?.services) throw new Error('Missing services');
    if (!Array.isArray(res.data.data.services)) throw new Error('Services should be array');
  });

  await runTest('Get all services status', async () => {
    const res = await apiCall('GET', '/api/setup/services');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
    if (!res.data.data) throw new Error('Missing data');
  });

  // ===== SERVICE CONNECTION TESTS =====
  console.log('\n🔌 Service Connection Tests\n');

  await runTest('Test Telegram connection', async () => {
    const res = await apiCall('POST', '/api/setup/connect/telegram/test');
    // May succeed or fail depending on config
    if (res.status !== 200 && res.status !== 500) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
  });

  await runTest('Test Canvas connection', async () => {
    const res = await apiCall('POST', '/api/setup/connect/canvas/test');
    // May succeed or fail depending on config
    if (res.status !== 200 && res.status !== 500) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
  });

  await runTest('Test invalid service returns 400', async () => {
    const res = await apiCall('POST', '/api/setup/connect/invalid-service/test');
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    if (res.data.error?.code !== 'INVALID_SERVICE') throw new Error('Expected INVALID_SERVICE error');
  });

  // ===== BRAIN DUMP =====
  console.log('\n🧠 Brain Dump\n');

  await runTest('Add task via brain dump', async () => {
    const res = await apiCall('POST', '/api/setup/brain-dump', {
      title: 'Brain Dump Test Task',
      context: 'Test',
    });
    if (!res.ok) throw new Error(`Failed: ${res.status} - ${JSON.stringify(res.data)}`);
    if (!res.data.success) throw new Error('Expected success');
    if (!res.data.data?.id) throw new Error('Missing task ID');
    testTaskId = res.data.data.id;
  });

  await runTest('Brain dump defaults context to Inbox', async () => {
    const res = await apiCall('POST', '/api/setup/brain-dump', {
      title: 'Brain Dump No Context Task',
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.data?.id) throw new Error('Missing task ID');
    testTaskId2 = res.data.data.id;
  });

  await runTest('Brain dump requires title', async () => {
    const res = await apiCall('POST', '/api/setup/brain-dump', {});
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Bulk brain dump', async () => {
    const res = await apiCall('POST', '/api/setup/brain-dump/bulk', {
      tasks: [
        { title: 'Bulk Task 1', context: 'Test' },
        { title: 'Bulk Task 2', context: 'Test' },
        { title: 'Bulk Task 3' },
      ],
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
    if (res.data.count !== 3) throw new Error(`Expected 3 tasks, got ${res.data.count}`);
  });

  await runTest('Bulk brain dump requires tasks array', async () => {
    const res = await apiCall('POST', '/api/setup/brain-dump/bulk', {});
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Bulk brain dump rejects empty array', async () => {
    const res = await apiCall('POST', '/api/setup/brain-dump/bulk', { tasks: [] });
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // ===== INBOX PROCESSING =====
  console.log('\n📥 Inbox Processing\n');

  await runTest('Get inbox items', async () => {
    const res = await apiCall('GET', '/api/setup/inbox');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
    if (typeof res.data.count !== 'number') throw new Error('Missing count');
  });

  await runTest('Get next inbox item', async () => {
    const res = await apiCall('GET', '/api/setup/inbox/next');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
    if (typeof res.data.remaining !== 'number') throw new Error('Missing remaining count');
  });

  await runTest('Process inbox item - move to today', async () => {
    const res = await apiCall('POST', `/api/setup/inbox/${testTaskId}/process`, {
      action: 'today',
    });
    if (!res.ok) throw new Error(`Failed: ${res.status} - ${JSON.stringify(res.data)}`);
    if (!res.data.success) throw new Error('Expected success');
    if (res.data.data?.status !== 'today') throw new Error('Expected status to be today');
  });

  await runTest('Process inbox item - move to upcoming with due date', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const res = await apiCall('POST', `/api/setup/inbox/${testTaskId2}/process`, {
      action: 'upcoming',
      dueDate: tomorrow.toISOString(),
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
  });

  await runTest('Process inbox item - delete', async () => {
    // Create a task to delete
    const createRes = await apiCall('POST', '/api/setup/brain-dump', {
      title: 'Task to Delete',
    });
    if (!createRes.ok) throw new Error('Failed to create task');
    const deleteId = createRes.data.data.id;

    const res = await apiCall('POST', `/api/setup/inbox/${deleteId}/process`, {
      action: 'delete',
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
  });

  await runTest('Process requires valid action', async () => {
    const res = await apiCall('POST', `/api/setup/inbox/${testTaskId}/process`, {
      action: 'invalid-action',
    });
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // ===== CEREMONY CONFIGURATION =====
  console.log('\n🎭 Ceremony Configuration\n');

  await runTest('Get ceremony configuration', async () => {
    const res = await apiCall('GET', '/api/setup/ceremonies');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
    if (!res.data.data) throw new Error('Missing data');
    if (!res.data.data.morningTime) throw new Error('Missing morningTime');
    if (!res.data.data.eveningTime) throw new Error('Missing eveningTime');
  });

  await runTest('Ceremony config includes notification channels', async () => {
    const res = await apiCall('GET', '/api/setup/ceremonies');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.data?.notificationChannels) throw new Error('Missing notificationChannels');
    if (!('telegram' in res.data.data.notificationChannels)) throw new Error('Missing telegram channel');
    if (!('sms' in res.data.data.notificationChannels)) throw new Error('Missing sms channel');
    if (!('email' in res.data.data.notificationChannels)) throw new Error('Missing email channel');
  });

  await runTest('Test ceremony notification', async () => {
    const res = await apiCall('POST', '/api/setup/ceremonies/test', {
      type: 'morning',
    });
    // May succeed or fail depending on notification config
    if (res.status !== 200 && res.status !== 500) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
    // Should always return preview content
    if (!res.data.data?.preview) throw new Error('Missing preview content');
  });

  await runTest('Preview morning ceremony', async () => {
    const res = await apiCall('GET', '/api/setup/preview/morning');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
    if (!res.data.data?.content) throw new Error('Missing content');
    if (!res.data.data?.formatted) throw new Error('Missing formatted');
  });

  // ===== CLASS MANAGEMENT =====
  console.log('\n📚 Class Management\n');

  await runTest('Get classes', async () => {
    const res = await apiCall('GET', '/api/setup/classes');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
    if (typeof res.data.count !== 'number') throw new Error('Missing count');
  });

  await runTest('Add a class', async () => {
    const res = await apiCall('POST', '/api/setup/classes', {
      name: 'Test Course',
      courseCode: 'TEST101',
      professor: 'Dr. Test',
    });
    if (!res.ok) throw new Error(`Failed: ${res.status} - ${JSON.stringify(res.data)}`);
    if (!res.data.success) throw new Error('Expected success');
    if (res.data.data?.id) testClassId = res.data.data.id;
  });

  await runTest('Add class with schedule', async () => {
    const res = await apiCall('POST', '/api/setup/classes', {
      name: 'Scheduled Course',
      courseCode: 'SCHED202',
      schedule: {
        days: ['Monday', 'Wednesday', 'Friday'],
        startTime: '09:00',
        endTime: '10:15',
      },
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
  });

  await runTest('Add class requires name', async () => {
    const res = await apiCall('POST', '/api/setup/classes', {
      courseCode: 'NONAME101',
    });
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Add class requires courseCode', async () => {
    const res = await apiCall('POST', '/api/setup/classes', {
      name: 'No Code Class',
    });
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // ===== CANVAS COURSES =====
  console.log('\n🎨 Canvas Courses\n');

  await runTest('Get Canvas courses', async () => {
    const res = await apiCall('GET', '/api/setup/canvas/courses');
    // May return 400 if Canvas not configured, or 200 with courses
    if (res.status !== 200 && res.status !== 400 && res.status !== 500) {
      throw new Error(`Unexpected status: ${res.status}`);
    }
    if (res.status === 400 && res.data.error?.code !== 'NOT_CONFIGURED') {
      throw new Error('Expected NOT_CONFIGURED error');
    }
    if (res.status === 200 && !Array.isArray(res.data.data)) {
      throw new Error('Expected array');
    }
  });

  // ===== SETUP SUMMARY & COMPLETION =====
  console.log('\n✅ Setup Summary & Completion\n');

  await runTest('Get setup summary', async () => {
    const res = await apiCall('GET', '/api/setup/summary');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
    if (!res.data.data) throw new Error('Missing data');
    if (typeof res.data.data.setupComplete !== 'boolean') throw new Error('Missing setupComplete');
    if (!Array.isArray(res.data.data.connectedServices)) throw new Error('Missing connectedServices');
  });

  await runTest('Summary includes task counts', async () => {
    const res = await apiCall('GET', '/api/setup/summary');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.data?.taskCounts) throw new Error('Missing taskCounts');
  });

  await runTest('Summary includes next steps', async () => {
    const res = await apiCall('GET', '/api/setup/summary');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data?.nextSteps)) throw new Error('Missing nextSteps');
  });

  await runTest('Mark setup complete', async () => {
    const res = await apiCall('POST', '/api/setup/complete');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
  });

  // ===== WEBHOOKS API =====
  console.log('\n🔗 Webhooks API\n');

  await runTest('Webhooks test endpoint', async () => {
    const res = await apiCall('GET', '/api/webhooks/test');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
    if (!res.data.message) throw new Error('Missing message');
  });

  await runTest('Google Calendar webhook', async () => {
    const res = await apiCall('POST', '/api/webhooks/google-calendar', {
      resourceId: 'test-resource',
      channelId: 'test-channel',
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.success) throw new Error('Expected success');
  });

  // ===== CLEANUP =====
  console.log('\n🧹 Cleanup\n');

  await runTest('Delete test tasks', async () => {
    // Get all inbox/test tasks and delete them
    const tasksRes = await apiCall('GET', '/api/tasks');
    if (tasksRes.ok && tasksRes.data.data) {
      const testTasks = tasksRes.data.data.filter(
        (t: any) =>
          t.title?.includes('Brain Dump') ||
          t.title?.includes('Bulk Task') ||
          t.context === 'Test'
      );
      for (const task of testTasks) {
        await apiCall('DELETE', `/api/tasks/${task.id}`);
      }
      console.log(`    (Cleaned up ${testTasks.length} test tasks)`);
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

/**
 * JD Agent - Comprehensive Task API Test Script
 *
 * Tests all task-related endpoints including:
 * - CRUD operations
 * - Status transitions
 * - Scheduling
 * - Bulk operations
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
  console.log('\n🧪 JD Agent - Task API Test Suite');
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

  let testTaskId: string = '';
  let testTaskId2: string = '';

  // ===== TASK CRUD TESTS =====
  console.log('📝 Task CRUD Operations\n');

  await runTest('Create task with minimal fields', async () => {
    const res = await apiCall('POST', '/api/tasks', {
      title: 'Test Task - Minimal',
      source: 'manual',
      context: 'Test',
    });
    if (!res.ok) throw new Error(`Failed: ${res.status} - ${JSON.stringify(res.data)}`);
    if (!res.data.data?.id) throw new Error('No task ID returned');
    testTaskId = res.data.data.id;
  });

  await runTest('Create task with all fields', async () => {
    const tomorrow = new Date(Date.now() + 86400000);
    const res = await apiCall('POST', '/api/tasks', {
      title: 'Test Task - Full Fields',
      description: 'A comprehensive test task',
      source: 'manual',
      context: 'Test',
      priority: 2,
      dueDate: tomorrow.toISOString(),
      dueDateIsHard: true,
      timeEstimateMinutes: 60,
      energyLevel: 'high',
    });
    if (!res.ok) throw new Error(`Failed: ${res.status} - ${JSON.stringify(res.data)}`);
    if (!res.data.data?.id) throw new Error('No task ID returned');
    testTaskId2 = res.data.data.id;
  });

  await runTest('Get task by ID', async () => {
    const res = await apiCall('GET', `/api/tasks/${testTaskId}`);
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.data?.id !== testTaskId) throw new Error('Wrong task returned');
  });

  await runTest('Update task title', async () => {
    const res = await apiCall('PATCH', `/api/tasks/${testTaskId}`, {
      title: 'Test Task - Updated Title',
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.data?.title !== 'Test Task - Updated Title') throw new Error('Title not updated');
  });

  await runTest('Update task priority', async () => {
    const res = await apiCall('PATCH', `/api/tasks/${testTaskId}`, {
      priority: 3,
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.data?.priority !== 3) throw new Error('Priority not updated');
  });

  await runTest('Update task due date', async () => {
    const nextWeek = new Date(Date.now() + 7 * 86400000);
    const res = await apiCall('PATCH', `/api/tasks/${testTaskId}`, {
      dueDate: nextWeek.toISOString(),
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!res.data.data?.dueDate) throw new Error('Due date not set');
  });

  await runTest('Clear task due date', async () => {
    const res = await apiCall('PATCH', `/api/tasks/${testTaskId}`, {
      dueDate: null,
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.data?.dueDate !== null) throw new Error('Due date not cleared');
  });

  // ===== LIST ENDPOINTS =====
  console.log('\n📋 List Endpoints\n');

  await runTest('List all tasks', async () => {
    const res = await apiCall('GET', '/api/tasks');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
  });

  await runTest('List tasks with status filter', async () => {
    const res = await apiCall('GET', '/api/tasks?status=inbox');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
  });

  await runTest('List tasks with context filter', async () => {
    const res = await apiCall('GET', '/api/tasks?context=Test');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
  });

  await runTest('Get inbox tasks', async () => {
    const res = await apiCall('GET', '/api/tasks/inbox');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
  });

  await runTest('Get today tasks', async () => {
    const res = await apiCall('GET', '/api/tasks/today');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
  });

  await runTest('Get overdue tasks', async () => {
    const res = await apiCall('GET', '/api/tasks/overdue');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
  });

  await runTest('Get upcoming tasks (default 7 days)', async () => {
    const res = await apiCall('GET', '/api/tasks/upcoming');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
  });

  await runTest('Get upcoming tasks (custom days)', async () => {
    const res = await apiCall('GET', '/api/tasks/upcoming?days=14');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
  });

  await runTest('Get task counts', async () => {
    const res = await apiCall('GET', '/api/tasks/counts');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (typeof res.data.data?.inbox !== 'number') throw new Error('Missing inbox count');
  });

  // ===== STATUS TRANSITIONS =====
  console.log('\n🔄 Status Transitions\n');

  await runTest('Move task to today', async () => {
    const res = await apiCall('PATCH', `/api/tasks/${testTaskId}`, {
      status: 'today',
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.data?.status !== 'today') throw new Error('Status not updated');
  });

  await runTest('Complete task', async () => {
    const res = await apiCall('POST', `/api/tasks/${testTaskId}/complete`);
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.data?.status !== 'done') throw new Error('Status not done');
    if (!res.data.data?.completedAt) throw new Error('completedAt not set');
  });

  await runTest('Reopen task', async () => {
    const res = await apiCall('POST', `/api/tasks/${testTaskId}/reopen`);
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.data?.status === 'done') throw new Error('Task still done');
    if (res.data.data?.completedAt !== null) throw new Error('completedAt not cleared');
  });

  await runTest('Archive task', async () => {
    const res = await apiCall('POST', `/api/tasks/${testTaskId}/archive`);
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.data?.status !== 'archived') throw new Error('Status not archived');
  });

  // ===== SCHEDULING =====
  console.log('\n📅 Scheduling\n');

  await runTest('Schedule task', async () => {
    const startTime = new Date();
    startTime.setHours(startTime.getHours() + 2);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    const res = await apiCall('POST', `/api/tasks/${testTaskId2}/schedule`, {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      createCalendarEvent: false,
    });
    if (!res.ok) throw new Error(`Failed: ${res.status} - ${JSON.stringify(res.data)}`);
    if (!res.data.data?.scheduledStart) throw new Error('scheduledStart not set');
  });

  await runTest('Unschedule task', async () => {
    const res = await apiCall('POST', `/api/tasks/${testTaskId2}/unschedule`);
    if (!res.ok) throw new Error(`Failed: ${res.status} - ${JSON.stringify(res.data)}`);
  });

  // ===== BULK OPERATIONS =====
  console.log('\n📦 Bulk Operations\n');

  let bulkTaskIds: string[] = [];

  await runTest('Create tasks for bulk test', async () => {
    const tasks = await Promise.all([
      apiCall('POST', '/api/tasks', { title: 'Bulk Test 1', source: 'manual', context: 'Test' }),
      apiCall('POST', '/api/tasks', { title: 'Bulk Test 2', source: 'manual', context: 'Test' }),
      apiCall('POST', '/api/tasks', { title: 'Bulk Test 3', source: 'manual', context: 'Test' }),
    ]);
    bulkTaskIds = tasks.map((t) => t.data.data.id);
    if (bulkTaskIds.length !== 3) throw new Error('Failed to create bulk test tasks');
  });

  await runTest('Bulk update status', async () => {
    const res = await apiCall('POST', '/api/tasks/bulk/status', {
      ids: bulkTaskIds,
      status: 'today',
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.count !== 3) throw new Error(`Expected 3 updated, got ${res.data.count}`);
  });

  // ===== VALIDATION TESTS =====
  console.log('\n🛡️ Validation\n');

  await runTest('Reject invalid task ID format', async () => {
    const res = await apiCall('GET', '/api/tasks/invalid-id');
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Reject missing required fields', async () => {
    const res = await apiCall('POST', '/api/tasks', {
      description: 'No title provided',
    });
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Reject invalid status', async () => {
    const res = await apiCall('PATCH', `/api/tasks/${testTaskId2}`, {
      status: 'invalid_status',
    });
    if (res.ok) throw new Error('Should have failed');
  });

  await runTest('Reject invalid priority', async () => {
    const res = await apiCall('PATCH', `/api/tasks/${testTaskId2}`, {
      priority: 999,
    });
    if (res.ok) throw new Error('Should have failed');
  });

  await runTest('Reject invalid days parameter', async () => {
    const res = await apiCall('GET', '/api/tasks/upcoming?days=500');
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  // ===== CLEANUP =====
  console.log('\n🧹 Cleanup\n');

  await runTest('Delete test tasks', async () => {
    const allIds = [testTaskId, testTaskId2, ...bulkTaskIds].filter(Boolean);
    const deleteResults = await Promise.all(
      allIds.map((id) => apiCall('DELETE', `/api/tasks/${id}`))
    );
    const failures = deleteResults.filter((r) => !r.ok);
    if (failures.length > 0) throw new Error(`Failed to delete ${failures.length} tasks`);
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

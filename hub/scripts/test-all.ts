/**
 * JD Agent - Master Test Script
 *
 * Runs comprehensive tests against all API endpoints.
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
    console.log(`✅ ${name}`);
  } catch (error) {
    results.push({ name, passed: false, error: String(error), duration: Date.now() - start });
    console.log(`❌ ${name}: ${error}`);
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

  if (!response.ok) {
    throw new Error(`API ${method} ${path} failed: ${response.status} - ${text.substring(0, 200)}`);
  }

  return data;
}

async function main() {
  console.log('\n🧪 JD Agent System Test Suite');
  console.log('=' .repeat(60));
  console.log(`Testing against: ${API_BASE}`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  // ===== HEALTH TESTS =====
  console.log('🏥 Health Tests\n');

  await runTest('Health endpoint returns status', async () => {
    const health = await apiCall('GET', '/api/health');
    if (!['healthy', 'degraded', 'unhealthy'].includes(health.status)) {
      throw new Error(`Unexpected status: ${health.status}`);
    }
  });

  await runTest('Detailed health endpoint', async () => {
    const health = await apiCall('GET', '/api/health/detailed');
    if (!health.checks) throw new Error('Missing checks in response');
    if (!health.checks.database) throw new Error('Missing database check');
  });

  await runTest('Liveness probe', async () => {
    const live = await apiCall('GET', '/api/health/live');
    if (live.status !== 'alive') throw new Error('Not alive');
  });

  await runTest('Readiness probe', async () => {
    const ready = await apiCall('GET', '/api/health/ready');
    if (ready.status !== 'ready') throw new Error('Not ready');
  });

  // ===== TASK TESTS =====
  console.log('\n✅ Task Tests\n');

  let testTaskId: string;

  await runTest('Create task', async () => {
    const response = await apiCall('POST', '/api/tasks', {
      title: 'Test Task - Verification Suite',
      source: 'manual',
      context: 'Test',
      description: 'Created by automated test suite',
      dueDate: new Date(Date.now() + 86400000).toISOString(),
    });
    if (!response.data?.id) throw new Error('No task ID returned');
    testTaskId = response.data.id;
  });

  await runTest('List tasks', async () => {
    const response = await apiCall('GET', '/api/tasks');
    if (!response.success) throw new Error('List failed');
    if (!Array.isArray(response.data)) throw new Error('Tasks should be an array');
  });

  await runTest('Get single task', async () => {
    if (!testTaskId) throw new Error('No test task ID');
    const response = await apiCall('GET', `/api/tasks/${testTaskId}`);
    if (response.data.id !== testTaskId) throw new Error('Wrong task returned');
  });

  await runTest('Update task status', async () => {
    if (!testTaskId) throw new Error('No test task ID');
    const response = await apiCall('PATCH', `/api/tasks/${testTaskId}`, {
      status: 'today',
    });
    if (response.data.status !== 'today') throw new Error('Status not updated');
  });

  await runTest('Complete task', async () => {
    if (!testTaskId) throw new Error('No test task ID');
    const response = await apiCall('POST', `/api/tasks/${testTaskId}/complete`);
    if (response.data.status !== 'done') throw new Error('Task not completed');
  });

  await runTest('Get task counts', async () => {
    const response = await apiCall('GET', '/api/tasks/counts');
    if (!response.success) throw new Error('Counts failed');
  });

  await runTest('Get today tasks', async () => {
    const response = await apiCall('GET', '/api/tasks/today');
    if (!response.success) throw new Error('Today tasks failed');
  });

  await runTest('Delete task', async () => {
    if (!testTaskId) throw new Error('No test task ID');
    await apiCall('DELETE', `/api/tasks/${testTaskId}`);
  });

  // ===== VAULT TESTS =====
  console.log('\n🗄️ Vault Tests\n');

  let testVaultId: string;

  await runTest('Create vault entry', async () => {
    const response = await apiCall('POST', '/api/vault', {
      title: 'Test Note - Verification Suite',
      content: 'This is test content created by the automated test suite for verification purposes.',
      contentType: 'note',
      context: 'Test',
      source: 'manual',
      tags: ['test', 'verification', 'automated'],
    });
    if (!response.data?.id) throw new Error('No vault entry ID returned');
    testVaultId = response.data.id;
  });

  await runTest('List vault entries', async () => {
    const response = await apiCall('GET', '/api/vault');
    if (!response.success) throw new Error('List failed');
    if (!Array.isArray(response.data)) throw new Error('Should be array');
  });

  await runTest('Search vault (simple)', async () => {
    const response = await apiCall('GET', '/api/vault/search?query=test');
    if (!response.success) throw new Error('Search failed');
    if (!Array.isArray(response.data)) throw new Error('Search should return array');
  });

  await runTest('Get vault entry', async () => {
    if (!testVaultId) throw new Error('No test vault ID');
    const response = await apiCall('GET', `/api/vault/${testVaultId}`);
    if (response.data.id !== testVaultId) throw new Error('Wrong entry returned');
  });

  await runTest('Get vault stats', async () => {
    const response = await apiCall('GET', '/api/vault/stats');
    if (!response.success) throw new Error('Stats failed');
  });

  await runTest('Get vault contexts', async () => {
    const response = await apiCall('GET', '/api/vault/contexts');
    if (!response.success) throw new Error('Contexts failed');
  });

  await runTest('Update vault entry', async () => {
    if (!testVaultId) throw new Error('No test vault ID');
    const response = await apiCall('PATCH', `/api/vault/${testVaultId}`, {
      title: 'Test Note - Updated',
    });
    if (response.data.title !== 'Test Note - Updated') throw new Error('Not updated');
  });

  await runTest('Delete vault entry', async () => {
    if (!testVaultId) throw new Error('No test vault ID');
    await apiCall('DELETE', `/api/vault/${testVaultId}`);
  });

  // ===== CALENDAR TESTS =====
  console.log('\n📅 Calendar Tests\n');

  await runTest('List calendar events', async () => {
    const response = await apiCall('GET', '/api/calendar');
    if (!response.success) throw new Error('List failed');
    if (!Array.isArray(response.data)) throw new Error('Should be array');
  });

  await runTest('Get today events', async () => {
    const response = await apiCall('GET', '/api/calendar/today');
    if (!response.success) throw new Error('Today failed');
  });

  await runTest('Get upcoming events', async () => {
    const response = await apiCall('GET', '/api/calendar/upcoming?days=7');
    if (!response.success) throw new Error('Upcoming failed');
  });

  await runTest('Get calendar status', async () => {
    const response = await apiCall('GET', '/api/calendar/status');
    if (!response.success) throw new Error('Status failed');
  });

  let testEventId: string;

  await runTest('Create calendar event', async () => {
    const startTime = new Date(Date.now() + 86400000); // Tomorrow
    const endTime = new Date(startTime.getTime() + 3600000); // +1 hour
    const response = await apiCall('POST', '/api/calendar', {
      title: 'Test Event - Verification Suite',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      eventType: 'meeting',
      context: 'Test',
    });
    if (!response.data?.id) throw new Error('No event ID returned');
    testEventId = response.data.id;
  });

  await runTest('Delete calendar event', async () => {
    if (!testEventId) throw new Error('No test event ID');
    await apiCall('DELETE', `/api/calendar/${testEventId}`);
  });

  // ===== CHAT TESTS =====
  console.log('\n💬 Chat Tests\n');

  await runTest('Get chat status', async () => {
    const response = await apiCall('GET', '/api/chat/status');
    if (!response.success) throw new Error('Status failed');
  });

  await runTest('Get chat context', async () => {
    const response = await apiCall('GET', '/api/chat/context');
    if (!response.success) throw new Error('Context failed');
  });

  // Only test chat if agent is configured
  const chatStatus = await apiCall('GET', '/api/chat/status');
  if (chatStatus.data?.configured) {
    await runTest('Send chat message', async () => {
      const response = await apiCall('POST', '/api/chat', {
        message: 'Hello, this is an automated test. Please respond with a brief confirmation.',
      });
      if (!response.success) throw new Error('Chat failed');
      if (!response.data?.message) throw new Error('No response message');
    });

    await runTest('Clear chat history', async () => {
      const response = await apiCall('POST', '/api/chat/clear');
      if (!response.success) throw new Error('Clear failed');
    });
  } else {
    console.log('⚠️  Chat agent not configured - skipping chat message tests');
  }

  // ===== GOALS & HABITS TESTS =====
  console.log('\n🎯 Goals & Habits Tests\n');

  let testGoalId: string;
  let testHabitId: string;

  await runTest('Create goal', async () => {
    const response = await apiCall('POST', '/api/goals', {
      title: 'Test Goal - Master Suite',
      lifeArea: 'personal',
      goalType: 'achievement',
      metricType: 'milestone',
    });
    if (!response.success) throw new Error('Failed to create goal');
    testGoalId = response.data.id;
  });

  await runTest('List goals', async () => {
    const response = await apiCall('GET', '/api/goals');
    if (!response.success) throw new Error('List failed');
  });

  await runTest('Get goals by life area', async () => {
    const response = await apiCall('GET', '/api/goals/by-life-area');
    if (!response.success) throw new Error('Failed');
  });

  await runTest('Create habit', async () => {
    const response = await apiCall('POST', '/api/habits', {
      title: 'Test Habit - Master Suite',
      lifeArea: 'personal',
      frequency: 'daily',
    });
    if (!response.success) throw new Error('Failed to create habit');
    testHabitId = response.data.id;
  });

  await runTest('Complete habit', async () => {
    if (!testHabitId) throw new Error('No habit ID');
    const response = await apiCall('POST', `/api/habits/${testHabitId}/complete`);
    if (!response.success) throw new Error('Failed to complete habit');
  });

  await runTest('Get progress overview', async () => {
    const response = await apiCall('GET', '/api/progress/overview');
    if (!response.success) throw new Error('Failed');
  });

  await runTest('Get life areas', async () => {
    const response = await apiCall('GET', '/api/progress/life-areas');
    if (!response.success) throw new Error('Failed');
  });

  await runTest('Create reflection', async () => {
    if (!testGoalId) throw new Error('No goal ID');
    const response = await apiCall('POST', `/api/reflections/${testGoalId}`, {
      content: 'Test reflection from master suite',
      reflectionType: 'progress',
    });
    if (!response.success) throw new Error('Failed');
  });

  await runTest('Delete goal', async () => {
    if (!testGoalId) throw new Error('No goal ID');
    await apiCall('DELETE', `/api/goals/${testGoalId}`);
  });

  await runTest('Delete habit', async () => {
    if (!testHabitId) throw new Error('No habit ID');
    await apiCall('DELETE', `/api/habits/${testHabitId}`);
  });

  // ===== CEREMONY TESTS =====
  console.log('\n🎭 Ceremony Tests\n');

  await runTest('Get ceremony status', async () => {
    const response = await apiCall('GET', '/api/ceremonies/status');
    if (!response.success) throw new Error('Status failed');
  });

  await runTest('Get ceremony history', async () => {
    const response = await apiCall('GET', '/api/ceremonies/history');
    if (!response.success) throw new Error('History failed');
  });

  await runTest('Preview morning ceremony', async () => {
    const response = await apiCall('GET', '/api/ceremonies/preview/morning');
    if (!response.success) throw new Error('Preview failed');
    if (!response.data?.content) throw new Error('No content generated');
  });

  await runTest('Preview evening ceremony', async () => {
    const response = await apiCall('GET', '/api/ceremonies/preview/evening');
    if (!response.success) throw new Error('Preview failed');
  });

  await runTest('Get notification status', async () => {
    const response = await apiCall('GET', '/api/ceremonies/notifications/status');
    if (!response.success) throw new Error('Notification status failed');
  });

  // ===== SEARCH TESTS =====
  console.log('\n🔍 Search Tests\n');

  await runTest('Global search', async () => {
    const response = await apiCall('GET', '/api/search?q=test');
    // Search returns results directly or with a results array
    if (!response.results && !Array.isArray(response)) {
      throw new Error('Search did not return results');
    }
  });

  // ===== ANALYTICS TESTS (Optional) =====
  console.log('\n📊 Analytics Tests (Optional)\n');

  // Analytics is not critical - skip if not implemented
  try {
    const analyticsCheck = await fetch(`${API_BASE}/api/analytics`);
    if (analyticsCheck.status === 404) {
      console.log('⚠️  Analytics endpoint not implemented - skipping');
    } else {
      await runTest('Get analytics overview', async () => {
        const response = await apiCall('GET', '/api/analytics');
        if (!response.success && !response.data) throw new Error('Analytics failed');
      });
    }
  } catch (e) {
    console.log('⚠️  Analytics check failed - skipping');
  }

  // ===== SYSTEM TESTS =====
  console.log('\n⚙️ System Tests\n');

  await runTest('Get system info', async () => {
    const response = await apiCall('GET', '/api/system/info');
    if (!response.success) throw new Error('System info failed');
  });

  // ===== RESULTS SUMMARY =====
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`Total:   ${total}`);
  console.log(`Passed:  ${passed} ✅`);
  console.log(`Failed:  ${failed} ❌`);
  console.log(`Success: ${Math.round((passed / total) * 100)}%`);

  if (failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}`);
      console.log(`    Error: ${r.error?.substring(0, 100)}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Completed: ${new Date().toISOString()}`);
  console.log('='.repeat(60) + '\n');

  // Exit with error code if any tests failed
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test suite crashed:', err);
  process.exit(1);
});

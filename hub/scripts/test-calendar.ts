/**
 * JD Agent - Comprehensive Calendar API Test Script
 *
 * Tests all calendar-related endpoints including:
 * - CRUD operations
 * - Time-based queries
 * - Conflict detection
 * - Google Calendar integration status
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

function futureDate(hoursFromNow: number): string {
  const date = new Date();
  date.setHours(date.getHours() + hoursFromNow);
  return date.toISOString();
}

async function main() {
  console.log('\n🧪 JD Agent - Calendar API Test Suite');
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

  let testEventId: string = '';
  let testEventId2: string = '';

  // ===== CALENDAR CRUD TESTS =====
  console.log('📅 Calendar CRUD Operations\n');

  await runTest('Create calendar event with minimal fields', async () => {
    const res = await apiCall('POST', '/api/calendar', {
      title: 'Test Event - Minimal',
      startTime: futureDate(2),
      endTime: futureDate(3),
      syncToGoogle: false,
    });
    if (!res.ok) throw new Error(`Failed: ${res.status} - ${JSON.stringify(res.data)}`);
    if (!res.data.data?.id) throw new Error('No event ID returned');
    testEventId = res.data.data.id;
  });

  await runTest('Create calendar event with all fields', async () => {
    const res = await apiCall('POST', '/api/calendar', {
      title: 'Test Event - Full Fields',
      description: 'A comprehensive test event',
      location: 'Test Location',
      startTime: futureDate(24),
      endTime: futureDate(25),
      allDay: false,
      eventType: 'meeting',
      context: 'Test',
      syncToGoogle: false,
    });
    if (!res.ok) throw new Error(`Failed: ${res.status} - ${JSON.stringify(res.data)}`);
    if (!res.data.data?.id) throw new Error('No event ID returned');
    testEventId2 = res.data.data.id;
  });

  await runTest('Get calendar event by ID', async () => {
    const res = await apiCall('GET', `/api/calendar/${testEventId}`);
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.data?.id !== testEventId) throw new Error('Wrong event returned');
  });

  await runTest('Update calendar event title', async () => {
    const res = await apiCall('PATCH', `/api/calendar/${testEventId}`, {
      title: 'Test Event - Updated Title',
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.data?.title !== 'Test Event - Updated Title') throw new Error('Title not updated');
  });

  await runTest('Update calendar event location', async () => {
    const res = await apiCall('PATCH', `/api/calendar/${testEventId}`, {
      location: 'New Test Location',
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.data?.location !== 'New Test Location') throw new Error('Location not updated');
  });

  await runTest('Update calendar event type', async () => {
    const res = await apiCall('PATCH', `/api/calendar/${testEventId}`, {
      eventType: 'personal',
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.data?.eventType !== 'personal') throw new Error('Event type not updated');
  });

  // ===== LIST ENDPOINTS =====
  console.log('\n📋 List Endpoints\n');

  await runTest('List all calendar events', async () => {
    const res = await apiCall('GET', '/api/calendar');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
  });

  await runTest('Get today events', async () => {
    const res = await apiCall('GET', '/api/calendar/today');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
  });

  await runTest('Get upcoming events (default 7 days)', async () => {
    const res = await apiCall('GET', '/api/calendar/upcoming');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
  });

  await runTest('Get upcoming events (custom days)', async () => {
    const res = await apiCall('GET', '/api/calendar/upcoming?days=14');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
    if (res.data.days !== 14) throw new Error('Days parameter not respected');
  });

  await runTest('List events with eventType filter', async () => {
    const res = await apiCall('GET', '/api/calendar?eventType=meeting');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Expected array');
  });

  await runTest('Get calendar status', async () => {
    const res = await apiCall('GET', '/api/calendar/status');
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (typeof res.data.data?.googleConfigured !== 'boolean') throw new Error('Missing googleConfigured');
  });

  // ===== CONFLICT DETECTION =====
  console.log('\n⚠️ Conflict Detection\n');

  await runTest('Check for conflicts (no conflict)', async () => {
    const res = await apiCall('POST', '/api/calendar/check-conflicts', {
      startTime: futureDate(100),
      endTime: futureDate(101),
    });
    if (!res.ok) throw new Error(`Failed: ${res.status} - ${JSON.stringify(res.data)}`);
    if (res.data.data?.hasConflict !== false) throw new Error('Should have no conflict');
  });

  await runTest('Check for conflicts (with conflict)', async () => {
    // Create an event, then check for conflict at same time
    const event = await apiCall('POST', '/api/calendar', {
      title: 'Conflict Test Event',
      startTime: futureDate(50),
      endTime: futureDate(51),
      syncToGoogle: false,
    });
    const conflictEventId = event.data.data.id;

    const res = await apiCall('POST', '/api/calendar/check-conflicts', {
      startTime: futureDate(50),
      endTime: futureDate(51),
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.data?.hasConflict !== true) throw new Error('Should have conflict');

    // Cleanup
    await apiCall('DELETE', `/api/calendar/${conflictEventId}`);
  });

  await runTest('Check conflicts with excludeId', async () => {
    // Should not conflict with itself
    const res = await apiCall('POST', '/api/calendar/check-conflicts', {
      startTime: futureDate(2),
      endTime: futureDate(3),
      excludeId: testEventId,
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    // Even if time overlaps, excluding the event itself should work
  });

  // ===== EVENT TYPES =====
  console.log('\n🏷️ Event Types\n');

  await runTest('Create class event', async () => {
    const res = await apiCall('POST', '/api/calendar', {
      title: 'Test Class',
      startTime: futureDate(72),
      endTime: futureDate(73),
      eventType: 'class',
      context: 'MBA501',
      syncToGoogle: false,
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.data?.eventType !== 'class') throw new Error('Event type not set');
    await apiCall('DELETE', `/api/calendar/${res.data.data.id}`);
  });

  await runTest('Create deadline event', async () => {
    const res = await apiCall('POST', '/api/calendar', {
      title: 'Test Deadline',
      startTime: futureDate(96),
      endTime: futureDate(97),
      eventType: 'deadline',
      syncToGoogle: false,
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.data?.eventType !== 'deadline') throw new Error('Event type not set');
    await apiCall('DELETE', `/api/calendar/${res.data.data.id}`);
  });

  await runTest('Create blocked_time event', async () => {
    const res = await apiCall('POST', '/api/calendar', {
      title: 'Focus Time',
      startTime: futureDate(120),
      endTime: futureDate(122),
      eventType: 'blocked_time',
      syncToGoogle: false,
    });
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    if (res.data.data?.eventType !== 'blocked_time') throw new Error('Event type not set');
    await apiCall('DELETE', `/api/calendar/${res.data.data.id}`);
  });

  // ===== VALIDATION TESTS =====
  console.log('\n🛡️ Validation\n');

  await runTest('Reject invalid event ID format', async () => {
    const res = await apiCall('GET', '/api/calendar/invalid-id');
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Reject missing required fields', async () => {
    const res = await apiCall('POST', '/api/calendar', {
      description: 'No title or times',
    });
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Reject end time before start time', async () => {
    const res = await apiCall('POST', '/api/calendar', {
      title: 'Invalid Times',
      startTime: futureDate(10),
      endTime: futureDate(5),
    });
    if (res.ok) throw new Error('Should have failed');
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await runTest('Reject invalid event type', async () => {
    const res = await apiCall('POST', '/api/calendar', {
      title: 'Invalid Type',
      startTime: futureDate(10),
      endTime: futureDate(11),
      eventType: 'invalid_type',
    });
    if (res.ok) throw new Error('Should have failed');
  });

  // ===== CLEANUP =====
  console.log('\n🧹 Cleanup\n');

  await runTest('Delete test events', async () => {
    const allIds = [testEventId, testEventId2].filter(Boolean);
    const deleteResults = await Promise.all(
      allIds.map((id) => apiCall('DELETE', `/api/calendar/${id}`))
    );
    const failures = deleteResults.filter((r) => !r.ok);
    if (failures.length > 0) throw new Error(`Failed to delete ${failures.length} events`);
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

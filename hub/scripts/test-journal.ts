/**
 * Journal API Tests
 *
 * Tests all endpoints for daily journal/review functionality.
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
    console.log('  [PASS] ' + name);
  } catch (error) {
    results.push({ name, passed: false, error: String(error), duration: Date.now() - start });
    console.log('  [FAIL] ' + name + ': ' + error);
  }
}

async function apiCall(method: string, path: string, body?: any): Promise<any> {
  const url = API_BASE + path;
  const response = await fetch(url, {
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
    throw new Error('API ' + method + ' ' + path + ' failed: ' + response.status + ' - ' + text.substring(0, 200));
  }

  return data;
}

async function main() {
  console.log('\n========================================');
  console.log('Journal API Tests');
  console.log('========================================');
  console.log('Testing against: ' + API_BASE);
  console.log('Started: ' + new Date().toISOString() + '\n');

  // Store IDs for subsequent tests
  let testReviewId: string = '';
  let testHabitId: string = '';
  const today = new Date().toISOString().split('T')[0];

  // ===== DAILY REVIEW DATA TESTS =====
  console.log('--- Daily Review Data Tests ---\n');

  await runTest('GET /api/journal/daily-review - Get review data for today', async () => {
    const response = await apiCall('GET', '/api/journal/daily-review');
    if (!response.success) throw new Error('Failed to get daily review data');
    if (!response.data) throw new Error('No data returned');
    
    // The response has data.review and data.habits
    const review = response.data.review;
    const habits = response.data.habits;
    
    // Store the review ID for later tests
    if (review && review.id) {
      testReviewId = review.id;
    }
    
    console.log('    -> Review ID: ' + (testReviewId || 'none'));
    console.log('    -> Status: ' + (review ? (review.reviewCompleted ? 'completed' : 'draft') : 'new'));
    if (habits) {
      console.log('    -> Habits: ' + habits.length);
      // Get first habit ID for toggle test
      if (habits.length > 0) {
        testHabitId = habits[0].id;
      }
    }
    if (response.data.goals) {
      console.log('    -> Goal domains: ' + response.data.goals.length);
    }
  });

  await runTest('GET /api/journal/daily-review?date=YYYY-MM-DD - Get review data for specific date', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const response = await apiCall('GET', '/api/journal/daily-review?date=' + yesterday);
    if (!response.success) throw new Error('Failed to get review data for specific date');
    console.log('    -> Date: ' + yesterday);
  });

  // ===== SAVE DRAFT TESTS =====
  console.log('\n--- Save Draft Tests ---\n');

  await runTest('POST /api/journal/daily-review/save - Save draft (minimal)', async () => {
    if (!testReviewId) {
      throw new Error('No review ID available - need existing review');
    }

    const response = await apiCall('POST', '/api/journal/daily-review/save', {
      id: testReviewId,
      currentStep: 1,
    });
    if (!response.success) throw new Error('Failed to save minimal draft');
    console.log('    -> Saved review ID: ' + testReviewId);
  });

  await runTest('POST /api/journal/daily-review/save - Save draft with journal text', async () => {
    if (!testReviewId) throw new Error('No review ID from previous test');
    
    const response = await apiCall('POST', '/api/journal/daily-review/save', {
      id: testReviewId,
      journalText: 'Test journal entry from automated tests. Today was productive.',
      currentStep: 2,
    });
    if (!response.success) throw new Error('Failed to save draft with journal text');
  });

  await runTest('POST /api/journal/daily-review/save - Save draft with mood', async () => {
    if (!testReviewId) throw new Error('No review ID from previous test');
    
    const response = await apiCall('POST', '/api/journal/daily-review/save', {
      id: testReviewId,
      journalText: 'Test journal entry from automated tests. Today was productive.',
      mood: 'good',
      currentStep: 3,
    });
    if (!response.success) throw new Error('Failed to save draft with mood');
  });

  await runTest('POST /api/journal/daily-review/save - Save draft with tags', async () => {
    if (!testReviewId) throw new Error('No review ID from previous test');
    
    const response = await apiCall('POST', '/api/journal/daily-review/save', {
      id: testReviewId,
      journalText: 'Test journal entry from automated tests. Today was productive.',
      mood: 'good',
      tags: ['test', 'automated', 'productive'],
      currentStep: 4,
    });
    if (!response.success) throw new Error('Failed to save draft with tags');
  });

  await runTest('POST /api/journal/daily-review/save - Save draft with tasks reviewed', async () => {
    if (!testReviewId) throw new Error('No review ID from previous test');
    
    const response = await apiCall('POST', '/api/journal/daily-review/save', {
      id: testReviewId,
      journalText: 'Test journal entry from automated tests. Today was productive.',
      mood: 'good',
      tags: ['test', 'automated', 'productive'],
      tasksReviewed: [
        {
          taskId: crypto.randomUUID(),
          taskTitle: 'Test Task 1',
          completedAt: new Date().toISOString(),
          projectName: 'Test Project',
          reflectionNote: 'Completed successfully',
        },
      ],
      currentStep: 5,
    });
    if (!response.success) throw new Error('Failed to save draft with tasks reviewed');
  });

  // ===== HABIT TOGGLE TESTS =====
  console.log('\n--- Habit Toggle Tests ---\n');

  await runTest('POST /api/journal/habits/:habitId/toggle - Toggle habit completion', async () => {
    if (!testHabitId) {
      console.log('    -> Skipping: No habits available to toggle');
      return;
    }
    
    const response = await apiCall('POST', '/api/journal/habits/' + testHabitId + '/toggle?date=' + today);
    if (!response.success) throw new Error('Failed to toggle habit');
    console.log('    -> Toggled habit: ' + testHabitId);
    console.log('    -> New state: ' + (response.data.completed ? 'completed' : 'incomplete'));
  });

  await runTest('POST /api/journal/habits/:habitId/toggle - Toggle habit back', async () => {
    if (!testHabitId) {
      console.log('    -> Skipping: No habits available to toggle');
      return;
    }
    
    const response = await apiCall('POST', '/api/journal/habits/' + testHabitId + '/toggle?date=' + today);
    if (!response.success) throw new Error('Failed to toggle habit back');
    console.log('    -> Toggled back: ' + testHabitId);
    console.log('    -> New state: ' + (response.data.completed ? 'completed' : 'incomplete'));
  });

  // ===== HISTORY TESTS =====
  console.log('\n--- History Tests ---\n');

  await runTest('GET /api/journal/daily-review/history - Get history (default pagination)', async () => {
    const response = await apiCall('GET', '/api/journal/daily-review/history');
    if (!response.success) throw new Error('Failed to get review history');
    const total = response.data.total || (response.data.reviews ? response.data.reviews.length : 0);
    console.log('    -> Total reviews: ' + total);
    if (Array.isArray(response.data.reviews)) {
      console.log('    -> Page items: ' + response.data.reviews.length);
    }
  });

  await runTest('GET /api/journal/daily-review/history?page=1&limit=5 - Get history with pagination', async () => {
    const response = await apiCall('GET', '/api/journal/daily-review/history?page=1&limit=5');
    if (!response.success) throw new Error('Failed to get paginated history');
    if (Array.isArray(response.data.reviews) && response.data.reviews.length > 5) {
      throw new Error('Pagination limit not respected');
    }
  });

  // ===== SEARCH TESTS =====
  console.log('\n--- Search Tests ---\n');

  await runTest('GET /api/journal/daily-review/search?q=test - Search reviews', async () => {
    const response = await apiCall('GET', '/api/journal/daily-review/search?q=test');
    if (!response.success) throw new Error('Failed to search reviews');
    const count = Array.isArray(response.data) ? response.data.length : 0;
    console.log('    -> Results: ' + count);
  });

  // ===== COMPLETE REVIEW TESTS =====
  console.log('\n--- Complete Review Tests ---\n');

  await runTest('POST /api/journal/daily-review/complete - Complete a review', async () => {
    if (!testReviewId) throw new Error('No review ID from previous tests');
    
    const response = await apiCall('POST', '/api/journal/daily-review/complete', {
      id: testReviewId,
      journalText: 'Completed test journal entry. This was a productive day working on automated tests for the journal API.',
      mood: 'good',
      tags: ['test', 'completed', 'automated'],
      reviewDurationSeconds: 300,
    });
    if (!response.success) throw new Error('Failed to complete review');
    console.log('    -> Review completed: ' + testReviewId);
    if (response.data.vaultEntryId) {
      console.log('    -> Vault entry created: ' + response.data.vaultEntryId);
    }
  });

  // ===== UPDATE METRICS TESTS =====
  console.log('\n--- Update Metrics Tests ---\n');

  await runTest('POST /api/journal/daily-review/:id/update-metrics - Update review metrics', async () => {
    if (!testReviewId) throw new Error('No review ID from previous tests');
    
    const response = await apiCall('POST', '/api/journal/daily-review/' + testReviewId + '/update-metrics?date=' + today);
    if (!response.success) throw new Error('Failed to update metrics');
    console.log('    -> Metrics updated for: ' + testReviewId);
  });

  // ===== RESULTS SUMMARY =====
  console.log('\n========================================');
  console.log('JOURNAL API TEST RESULTS\n');

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log('Total:   ' + total);
  console.log('Passed:  ' + passed);
  console.log('Failed:  ' + failed);
  console.log('Success: ' + Math.round((passed / total) * 100) + '%');

  if (failed > 0) {
    console.log('\nFailed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log('  - ' + r.name);
      const errMsg = r.error ? r.error.substring(0, 200) : 'Unknown error';
      console.log('    Error: ' + errMsg);
    });
  }

  console.log('\n========================================');
  console.log('Completed: ' + new Date().toISOString());
  console.log('========================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test suite crashed:', err);
  process.exit(1);
});

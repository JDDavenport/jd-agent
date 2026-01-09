/**
 * Goals & Habits System Tests
 *
 * Tests all endpoints for goals, milestones, habits, reflections, and progress.
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

  if (!response.ok) {
    throw new Error(`API ${method} ${path} failed: ${response.status} - ${text.substring(0, 200)}`);
  }

  return data;
}

async function main() {
  console.log('\n🎯 Goals & Habits System Tests');
  console.log('='.repeat(60));
  console.log(`Testing against: ${API_BASE}`);
  console.log(`Started: ${new Date().toISOString()}\n`);

  // Store IDs for cleanup
  let testGoalId: string;
  let testMilestoneId: string;
  let testHabitId: string;
  let testReflectionId: string;

  // ===== LIFE AREAS TESTS =====
  console.log('🌈 Life Areas Tests\n');

  await runTest('Get life areas metadata', async () => {
    const response = await apiCall('GET', '/api/progress/life-areas');
    if (!response.success) throw new Error('Failed to get life areas');
    // Response might have areas directly or nested
    const areas = response.data.areas || response.data;
    const areaKeys = Object.keys(areas);
    if (areaKeys.length !== 6) throw new Error(`Expected 6 life areas, got ${areaKeys.length}`);
    if (!areaKeys.includes('spiritual')) throw new Error('Missing spiritual area');
    if (!areaKeys.includes('fitness')) throw new Error('Missing fitness area');
  });

  // ===== GOALS TESTS =====
  console.log('\n🎯 Goals API Tests\n');

  await runTest('Create goal', async () => {
    const response = await apiCall('POST', '/api/goals', {
      title: 'Test Goal - Automated Suite',
      description: 'A test goal created by automated tests',
      lifeArea: 'personal',
      goalType: 'achievement',
      metricType: 'milestone',
      motivation: 'Testing the goals system',
      vision: 'Complete test coverage',
      targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
    if (!response.success) throw new Error('Failed to create goal');
    if (!response.data?.id) throw new Error('No goal ID returned');
    testGoalId = response.data.id;
  });

  await runTest('List goals', async () => {
    const response = await apiCall('GET', '/api/goals');
    if (!response.success) throw new Error('Failed to list goals');
    if (!Array.isArray(response.data)) throw new Error('Expected array');
  });

  await runTest('List goals by status', async () => {
    const response = await apiCall('GET', '/api/goals?status=active');
    if (!response.success) throw new Error('Failed to filter by status');
    response.data.forEach((g: any) => {
      if (g.status !== 'active') throw new Error('Filter not applied');
    });
  });

  await runTest('List goals by life area', async () => {
    const response = await apiCall('GET', '/api/goals?lifeArea=personal');
    if (!response.success) throw new Error('Failed to filter by life area');
    response.data.forEach((g: any) => {
      if (g.lifeArea !== 'personal') throw new Error('Life area filter not applied');
    });
  });

  await runTest('Get goal by ID', async () => {
    if (!testGoalId) throw new Error('No test goal ID');
    const response = await apiCall('GET', `/api/goals/${testGoalId}`);
    if (!response.success) throw new Error('Failed to get goal');
    if (response.data.id !== testGoalId) throw new Error('Wrong goal returned');
  });

  await runTest('Get goal with relations', async () => {
    if (!testGoalId) throw new Error('No test goal ID');
    const response = await apiCall('GET', `/api/goals/${testGoalId}?includeRelations=true`);
    if (!response.success) throw new Error('Failed to get goal with relations');
    if (response.data.milestones === undefined) throw new Error('Missing milestones relation');
    if (response.data.habits === undefined) throw new Error('Missing habits relation');
  });

  await runTest('Get goals by life area summary', async () => {
    const response = await apiCall('GET', '/api/goals/by-life-area');
    if (!response.success) throw new Error('Failed to get by life area');
    if (!response.data.areas) throw new Error('Missing areas');
  });

  await runTest('Update goal', async () => {
    if (!testGoalId) throw new Error('No test goal ID');
    const response = await apiCall('PATCH', `/api/goals/${testGoalId}`, {
      description: 'Updated description',
      progressPercentage: 25,
    });
    if (!response.success) throw new Error('Failed to update goal');
    if (response.data.progressPercentage !== 25) throw new Error('Progress not updated');
  });

  await runTest('Update goal progress', async () => {
    if (!testGoalId) throw new Error('No test goal ID');
    const response = await apiCall('POST', `/api/goals/${testGoalId}/progress`, {
      progress: 50,
    });
    if (!response.success) throw new Error('Failed to update progress');
    if (response.data.progressPercentage !== 50) throw new Error('Progress not set to 50');
  });

  await runTest('Get goal health report', async () => {
    if (!testGoalId) throw new Error('No test goal ID');
    const response = await apiCall('GET', `/api/goals/${testGoalId}/health`);
    if (!response.success) throw new Error('Failed to get health report');
    if (response.data.healthScore === undefined) throw new Error('Missing health score');
    if (!response.data.breakdown) throw new Error('Missing breakdown');
  });

  await runTest('Get goals needing attention', async () => {
    const response = await apiCall('GET', '/api/goals/needs-attention');
    if (!response.success) throw new Error('Failed to get needs attention');
    if (!Array.isArray(response.data)) throw new Error('Expected array');
  });

  await runTest('Pause goal', async () => {
    if (!testGoalId) throw new Error('No test goal ID');
    const response = await apiCall('POST', `/api/goals/${testGoalId}/pause`);
    if (!response.success) throw new Error('Failed to pause goal');
    if (response.data.status !== 'paused') throw new Error('Goal not paused');
  });

  await runTest('Resume goal', async () => {
    if (!testGoalId) throw new Error('No test goal ID');
    const response = await apiCall('POST', `/api/goals/${testGoalId}/resume`);
    if (!response.success) throw new Error('Failed to resume goal');
    if (response.data.status !== 'active') throw new Error('Goal not resumed');
  });

  // ===== MILESTONE TESTS =====
  console.log('\n🏁 Milestone API Tests\n');

  await runTest('Create milestone', async () => {
    if (!testGoalId) throw new Error('No test goal ID');
    const response = await apiCall('POST', '/api/milestones', {
      goalId: testGoalId,
      title: 'Test Milestone 1',
      description: 'First milestone for testing',
      targetDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      orderIndex: 0,
    });
    if (!response.success) throw new Error('Failed to create milestone');
    if (!response.data?.id) throw new Error('No milestone ID returned');
    testMilestoneId = response.data.id;
  });

  await runTest('Create second milestone', async () => {
    if (!testGoalId) throw new Error('No test goal ID');
    const response = await apiCall('POST', '/api/milestones', {
      goalId: testGoalId,
      title: 'Test Milestone 2',
      description: 'Second milestone for testing',
      orderIndex: 1,
    });
    if (!response.success) throw new Error('Failed to create second milestone');
  });

  await runTest('List milestones by goal', async () => {
    if (!testGoalId) throw new Error('No test goal ID');
    const response = await apiCall('GET', `/api/milestones?goalId=${testGoalId}`);
    if (!response.success) throw new Error('Failed to list milestones');
    if (!Array.isArray(response.data)) throw new Error('Expected array');
    if (response.data.length < 2) throw new Error('Expected at least 2 milestones');
  });

  await runTest('Get milestone by ID', async () => {
    if (!testMilestoneId) throw new Error('No test milestone ID');
    const response = await apiCall('GET', `/api/milestones/${testMilestoneId}`);
    if (!response.success) throw new Error('Failed to get milestone');
    if (response.data.id !== testMilestoneId) throw new Error('Wrong milestone returned');
  });

  await runTest('Get upcoming milestones', async () => {
    const response = await apiCall('GET', '/api/milestones/upcoming?days=14');
    if (!response.success) throw new Error('Failed to get upcoming milestones');
    if (!Array.isArray(response.data)) throw new Error('Expected array');
  });

  await runTest('Start milestone', async () => {
    if (!testMilestoneId) throw new Error('No test milestone ID');
    const response = await apiCall('POST', `/api/milestones/${testMilestoneId}/start`);
    if (!response.success) throw new Error('Failed to start milestone');
    if (response.data.status !== 'in_progress') throw new Error('Milestone not in progress');
  });

  await runTest('Update milestone', async () => {
    if (!testMilestoneId) throw new Error('No test milestone ID');
    const response = await apiCall('PATCH', `/api/milestones/${testMilestoneId}`, {
      description: 'Updated milestone description',
    });
    if (!response.success) throw new Error('Failed to update milestone');
  });

  await runTest('Complete milestone with evidence', async () => {
    if (!testMilestoneId) throw new Error('No test milestone ID');
    const response = await apiCall('POST', `/api/milestones/${testMilestoneId}/complete`, {
      evidence: 'Completed as part of automated test suite',
    });
    if (!response.success) throw new Error('Failed to complete milestone');
    if (response.data.milestone.status !== 'completed') throw new Error('Milestone not completed');
    // Check that goal progress was updated
    if (response.data.goalProgress === undefined) throw new Error('Goal progress not returned');
  });

  await runTest('Verify goal progress after milestone completion', async () => {
    if (!testGoalId) throw new Error('No test goal ID');
    const response = await apiCall('GET', `/api/goals/${testGoalId}`);
    if (!response.success) throw new Error('Failed to get goal');
    // With 2 milestones and 1 completed, should be 50%
    if (response.data.progressPercentage !== 50) {
      throw new Error(`Expected 50% progress, got ${response.data.progressPercentage}%`);
    }
  });

  // ===== HABITS TESTS =====
  console.log('\n🔄 Habits API Tests\n');

  await runTest('Create habit', async () => {
    const response = await apiCall('POST', '/api/habits', {
      title: 'Test Habit - Daily Check',
      description: 'A test habit for automated testing',
      lifeArea: 'personal',
      frequency: 'daily',
      timeOfDay: 'morning',
      goalId: testGoalId,
    });
    if (!response.success) throw new Error('Failed to create habit');
    if (!response.data?.id) throw new Error('No habit ID returned');
    testHabitId = response.data.id;
  });

  await runTest('List habits', async () => {
    const response = await apiCall('GET', '/api/habits');
    if (!response.success) throw new Error('Failed to list habits');
    if (!Array.isArray(response.data)) throw new Error('Expected array');
  });

  await runTest('List habits by life area', async () => {
    const response = await apiCall('GET', '/api/habits?lifeArea=personal');
    if (!response.success) throw new Error('Failed to filter habits');
  });

  await runTest('Get habit by ID', async () => {
    if (!testHabitId) throw new Error('No test habit ID');
    const response = await apiCall('GET', `/api/habits/${testHabitId}`);
    if (!response.success) throw new Error('Failed to get habit');
    if (response.data.id !== testHabitId) throw new Error('Wrong habit returned');
  });

  await runTest('Complete habit', async () => {
    if (!testHabitId) throw new Error('No test habit ID');
    const response = await apiCall('POST', `/api/habits/${testHabitId}/complete`, {
      quality: 4,
      durationMinutes: 15,
      notes: 'Completed via automated test',
    });
    if (!response.success) throw new Error('Failed to complete habit');
    if (!response.data.completion) throw new Error('No completion record returned');
  });

  await runTest('Get habit streak', async () => {
    if (!testHabitId) throw new Error('No test habit ID');
    const response = await apiCall('GET', `/api/habits/${testHabitId}/streak`);
    if (!response.success) throw new Error('Failed to get streak');
    if (response.data.currentStreak === undefined) throw new Error('No streak data');
  });

  await runTest('Get habit completions', async () => {
    if (!testHabitId) throw new Error('No test habit ID');
    const response = await apiCall('GET', `/api/habits/${testHabitId}/completions`);
    if (!response.success) throw new Error('Failed to get completions');
    if (!Array.isArray(response.data)) throw new Error('Expected array');
    if (response.data.length < 1) throw new Error('Expected at least 1 completion');
  });

  await runTest('Get today habits', async () => {
    const response = await apiCall('GET', '/api/habits/today');
    if (!response.success) throw new Error('Failed to get today habits');
    if (!Array.isArray(response.data)) throw new Error('Expected array');
  });

  await runTest('Update habit', async () => {
    if (!testHabitId) throw new Error('No test habit ID');
    const response = await apiCall('PATCH', `/api/habits/${testHabitId}`, {
      description: 'Updated habit description',
    });
    if (!response.success) throw new Error('Failed to update habit');
  });

  // ===== REFLECTIONS TESTS =====
  console.log('\n📝 Reflections API Tests\n');

  await runTest('Create progress reflection', async () => {
    if (!testGoalId) throw new Error('No test goal ID');
    const response = await apiCall('POST', `/api/reflections/${testGoalId}`, {
      content: 'Making good progress on this test goal. The automated tests are passing.',
      reflectionType: 'progress',
    });
    if (!response.success) throw new Error('Failed to create reflection');
    if (!response.data?.id) throw new Error('No reflection ID returned');
    testReflectionId = response.data.id;
  });

  await runTest('Create win reflection', async () => {
    if (!testGoalId) throw new Error('No test goal ID');
    const response = await apiCall('POST', `/api/reflections/${testGoalId}`, {
      content: 'Completed the first milestone successfully!',
      reflectionType: 'win',
    });
    if (!response.success) throw new Error('Failed to create win reflection');
  });

  await runTest('Create obstacle reflection', async () => {
    if (!testGoalId) throw new Error('No test goal ID');
    const response = await apiCall('POST', `/api/reflections/${testGoalId}`, {
      content: 'Encountered some test failures that needed fixing.',
      reflectionType: 'obstacle',
    });
    if (!response.success) throw new Error('Failed to create obstacle reflection');
  });

  await runTest('List reflections by goal', async () => {
    if (!testGoalId) throw new Error('No test goal ID');
    const response = await apiCall('GET', `/api/reflections?goalId=${testGoalId}`);
    if (!response.success) throw new Error('Failed to list reflections');
    if (!Array.isArray(response.data)) throw new Error('Expected array');
    if (response.data.length < 3) throw new Error('Expected at least 3 reflections');
  });

  await runTest('Get recent reflections', async () => {
    const response = await apiCall('GET', '/api/reflections/recent?limit=10');
    if (!response.success) throw new Error('Failed to get recent reflections');
    if (!Array.isArray(response.data)) throw new Error('Expected array');
  });

  await runTest('Get win reflections', async () => {
    const response = await apiCall('GET', '/api/reflections/wins');
    if (!response.success) throw new Error('Failed to get wins');
    if (!Array.isArray(response.data)) throw new Error('Expected array');
  });

  await runTest('Get obstacle reflections', async () => {
    const response = await apiCall('GET', '/api/reflections/obstacles');
    if (!response.success) throw new Error('Failed to get obstacles');
    if (!Array.isArray(response.data)) throw new Error('Expected array');
  });

  await runTest('Search reflections', async () => {
    const response = await apiCall('GET', '/api/reflections/search?q=test');
    if (!response.success) throw new Error('Failed to search reflections');
    if (!Array.isArray(response.data)) throw new Error('Expected array');
  });

  await runTest('Get reflections by life area', async () => {
    const response = await apiCall('GET', '/api/reflections/area/personal');
    if (!response.success) throw new Error('Failed to get by area');
    if (!Array.isArray(response.data)) throw new Error('Expected array');
  });

  await runTest('Get reflection stats for goal', async () => {
    if (!testGoalId) throw new Error('No test goal ID');
    const response = await apiCall('GET', `/api/reflections/stats/${testGoalId}`);
    if (!response.success) throw new Error('Failed to get stats');
    if (response.data.total === undefined) throw new Error('Missing total');
    if (!response.data.byType) throw new Error('Missing byType');
  });

  // ===== PROGRESS DASHBOARD TESTS =====
  console.log('\n📊 Progress Dashboard Tests\n');

  await runTest('Get progress overview', async () => {
    const response = await apiCall('GET', '/api/progress/overview');
    if (!response.success) throw new Error('Failed to get overview');
    if (!response.data.goals) throw new Error('Missing goals');
    if (!response.data.habits) throw new Error('Missing habits');
    if (!response.data.alerts) throw new Error('Missing alerts');
    if (!response.data.upcoming) throw new Error('Missing upcoming');
  });

  await runTest('Get weekly report', async () => {
    const response = await apiCall('GET', '/api/progress/weekly');
    if (!response.success) throw new Error('Failed to get weekly report');
    if (!response.data.weekStart) throw new Error('Missing weekStart');
    if (!response.data.habits) throw new Error('Missing habits data');
    if (!response.data.goals) throw new Error('Missing goals data');
  });

  await runTest('Get all areas summary', async () => {
    const response = await apiCall('GET', '/api/progress/areas');
    if (!response.success) throw new Error('Failed to get areas');
    if (!Array.isArray(response.data)) throw new Error('Expected array');
  });

  await runTest('Get single area progress', async () => {
    const response = await apiCall('GET', '/api/progress/area/personal');
    if (!response.success) throw new Error('Failed to get personal area');
    if (!response.data.area) throw new Error('Missing area info');
    if (!response.data.goals) throw new Error('Missing goals');
    if (!response.data.habits) throw new Error('Missing habits');
  });

  await runTest('Get top streaks', async () => {
    const response = await apiCall('GET', '/api/progress/streaks?limit=5');
    if (!response.success) throw new Error('Failed to get streaks');
    if (!Array.isArray(response.data)) throw new Error('Expected array');
  });

  await runTest('Get habits dashboard', async () => {
    const response = await apiCall('GET', '/api/progress/habits');
    if (!response.success) throw new Error('Failed to get habits dashboard');
    if (response.data.today === undefined) throw new Error('Missing today data');
    if (!response.data.byArea) throw new Error('Missing byArea');
  });

  // ===== TASK GENERATION TESTS =====
  console.log('\n⚡ Task Generation Tests\n');

  await runTest('Generate all tasks', async () => {
    const response = await apiCall('POST', '/api/task-generation/generate');
    if (!response.success) throw new Error('Failed to generate tasks');
    if (!response.data.milestones) throw new Error('Missing milestones result');
    if (!response.data.checkins) throw new Error('Missing checkins result');
    if (!response.data.habits) throw new Error('Missing habits result');
  });

  await runTest('Generate milestone tasks', async () => {
    const response = await apiCall('POST', '/api/task-generation/milestones', {
      daysAhead: 14,
    });
    if (!response.success) throw new Error('Failed to generate milestone tasks');
    if (response.data.generated === undefined) throw new Error('Missing generated count');
  });

  await runTest('Generate checkin tasks', async () => {
    const response = await apiCall('POST', '/api/task-generation/checkins', {
      inactiveDays: 7,
    });
    if (!response.success) throw new Error('Failed to generate checkin tasks');
  });

  await runTest('Generate habit tasks', async () => {
    const response = await apiCall('POST', '/api/task-generation/habits');
    if (!response.success) throw new Error('Failed to generate habit tasks');
  });

  await runTest('Get tasks for goal', async () => {
    if (!testGoalId) throw new Error('No test goal ID');
    const response = await apiCall('GET', `/api/task-generation/goal/${testGoalId}/tasks`);
    if (!response.success) throw new Error('Failed to get goal tasks');
    if (!Array.isArray(response.data)) throw new Error('Expected array');
  });

  await runTest('Get tasks for habit', async () => {
    if (!testHabitId) throw new Error('No test habit ID');
    const response = await apiCall('GET', `/api/task-generation/habit/${testHabitId}/tasks`);
    if (!response.success) throw new Error('Failed to get habit tasks');
    if (!Array.isArray(response.data)) throw new Error('Expected array');
  });

  // ===== GOAL VAULT INTEGRATION TESTS =====
  console.log('\n📚 Goal Vault Integration Tests\n');

  await runTest('Get vault entries for goal', async () => {
    if (!testGoalId) throw new Error('No test goal ID');
    const response = await apiCall('GET', `/api/goal-vault/entries/${testGoalId}`);
    if (!response.success) throw new Error('Failed to get vault entries');
    if (!Array.isArray(response.data)) throw new Error('Expected array');
  });

  await runTest('Create goal note', async () => {
    if (!testGoalId) throw new Error('No test goal ID');
    const response = await apiCall('POST', '/api/goal-vault/note', {
      goalId: testGoalId,
      title: 'Test Goal Note',
      content: 'This is a test note created by the automated test suite.',
      tags: ['test', 'automated'],
    });
    if (!response.success) throw new Error('Failed to create goal note');
    if (!response.data.vaultEntryId) throw new Error('No vault entry ID returned');
  });

  await runTest('Export goal journey', async () => {
    if (!testGoalId) throw new Error('No test goal ID');
    const response = await apiCall('POST', `/api/goal-vault/export/journey/${testGoalId}`);
    if (!response.success) throw new Error('Failed to export journey');
    if (!response.data.vaultEntryId) throw new Error('No vault entry ID returned');
  });

  await runTest('Export reflection', async () => {
    if (!testReflectionId) throw new Error('No test reflection ID');
    const response = await apiCall('POST', `/api/goal-vault/export/reflection/${testReflectionId}`);
    if (!response.success) throw new Error('Failed to export reflection');
    if (!response.data.vaultEntryId) throw new Error('No vault entry ID returned');
  });

  // ===== CLEANUP =====
  console.log('\n🧹 Cleanup\n');

  await runTest('Deactivate habit', async () => {
    if (!testHabitId) throw new Error('No test habit ID');
    const response = await apiCall('PATCH', `/api/habits/${testHabitId}`, {
      isActive: false,
    });
    if (!response.success) throw new Error('Failed to deactivate habit');
  });

  await runTest('Delete reflection', async () => {
    if (!testReflectionId) throw new Error('No test reflection ID');
    const response = await apiCall('DELETE', `/api/reflections/${testReflectionId}`);
    if (!response.success) throw new Error('Failed to delete reflection');
  });

  await runTest('Abandon goal', async () => {
    if (!testGoalId) throw new Error('No test goal ID');
    const response = await apiCall('POST', `/api/goals/${testGoalId}/abandon`);
    if (!response.success) throw new Error('Failed to abandon goal');
    if (response.data.status !== 'abandoned') throw new Error('Goal not abandoned');
  });

  await runTest('Delete goal', async () => {
    if (!testGoalId) throw new Error('No test goal ID');
    const response = await apiCall('DELETE', `/api/goals/${testGoalId}`);
    if (!response.success) throw new Error('Failed to delete goal');
  });

  // ===== RESULTS SUMMARY =====
  console.log('\n' + '='.repeat(60));
  console.log('📊 GOALS & HABITS TEST RESULTS\n');

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
      console.log(`    Error: ${r.error?.substring(0, 150)}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Completed: ${new Date().toISOString()}`);
  console.log('='.repeat(60) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test suite crashed:', err);
  process.exit(1);
});

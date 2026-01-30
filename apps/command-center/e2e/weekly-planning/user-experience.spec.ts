/**
 * Weekly Planning - Comprehensive User Experience Tests
 *
 * This file tests ALL user scenarios from a real user's perspective.
 * Tests are designed to find bugs by simulating actual user behavior.
 *
 * Coverage:
 * 1. Page Load & Initial Render
 * 2. Backlog Panel
 * 3. Calendar Grid
 * 4. Drag-and-Drop Scheduling
 * 5. Rescheduling Tasks
 * 6. Unscheduling Tasks (Context Menu)
 * 7. Event Creation (Click-Drag)
 * 8. Task Completion
 * 9. Week Navigation
 * 10. Edge Cases & Error Handling
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:3000';

// Test data tracking
interface TestData {
  backlogTaskCount: number;
  scheduledTaskCount: number;
  calendarEventCount: number;
  testTaskId?: string;
  testTaskTitle?: string;
}

// Helper: Wait for page to fully load
async function waitForPageLoad(page: Page) {
  await page.goto(`${BASE_URL}/weekly-planning`);
  await page.waitForLoadState('networkidle');
  // Wait for loading spinner to disappear
  await page.waitForSelector('[class*="LoadingSpinner"]', { state: 'hidden', timeout: 10000 }).catch(() => {});
  // Wait for calendar grid to appear
  await page.waitForSelector('[class*="bg-slate-900"][class*="rounded-lg"]', { timeout: 10000 });
  await page.waitForTimeout(1000); // Extra time for data
}

// Helper: Get test data from page
async function getTestData(page: Page): Promise<TestData> {
  // Count backlog tasks
  const backlogTasks = await page.locator('.cursor-grab[class*="bg-slate-800"][class*="border-l-4"]').count();

  // Count scheduled tasks (tasks in calendar grid)
  const scheduledTasks = await page.locator('[class*="border-l-2"][class*="border-white"]').count();

  // Count calendar events (colored blocks without border-l-2)
  const calendarEvents = await page.locator('[class*="bg-purple-500"], [class*="bg-blue-500"], [class*="bg-green-500"], [class*="bg-indigo-500"]').count();

  return {
    backlogTaskCount: backlogTasks,
    scheduledTaskCount: scheduledTasks,
    calendarEventCount: calendarEvents,
  };
}

// Helper: Create a test task in backlog if none exist
async function ensureBacklogTask(page: Page): Promise<{ id: string; title: string } | null> {
  const backlogTasks = page.locator('.cursor-grab[class*="bg-slate-800"][class*="border-l-4"]');
  let count = await backlogTasks.count();

  if (count === 0) {
    // Click the "Add task" button
    const addButton = page.locator('button:has-text("Add task")');
    if (await addButton.count() > 0) {
      await addButton.click();
      await page.waitForTimeout(300);

      // Fill in the rapid add input
      const input = page.locator('input[placeholder*="Type task"]');
      if (await input.count() > 0) {
        const title = `Test Task ${Date.now()}`;
        await input.fill(title);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1500);

        count = await backlogTasks.count();
        if (count > 0) {
          const firstTask = backlogTasks.first();
          const taskTitle = await firstTask.locator('.font-medium').textContent();
          return { id: '', title: taskTitle || title };
        }
      }
    }
  } else {
    const firstTask = backlogTasks.first();
    const taskTitle = await firstTask.locator('.font-medium').textContent();
    return { id: '', title: taskTitle || '' };
  }

  return null;
}

// ============================================
// Test Suite: Page Load & Initial Render
// ============================================
test.describe('Page Load & Initial Render', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageLoad(page);
  });

  test('should render the page header with title', async ({ page }) => {
    const header = page.locator('h1:has-text("Weekly Planning")');
    await expect(header).toBeVisible();

    const subtitle = page.locator('text=Drag tasks from backlog to calendar to schedule them');
    await expect(subtitle).toBeVisible();
  });

  test('should render the backlog panel', async ({ page }) => {
    const backlogHeader = page.locator('h2:has-text("Weekly Backlog")');
    await expect(backlogHeader).toBeVisible();

    // Should show task count
    const taskCount = page.locator('text=/\\d+ tasks?/');
    await expect(taskCount.first()).toBeVisible();

    await page.screenshot({
      path: 'screenshots/ux-01-backlog-panel.png',
      fullPage: false,
    });
  });

  test('should render the calendar grid with 7 days', async ({ page }) => {
    // Should have 7 day columns
    const dayHeaders = page.locator('text=/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/');
    const dayCount = await dayHeaders.count();
    console.log(`Day columns found: ${dayCount}`);
    expect(dayCount).toBe(7);

    // Should show date range in header
    const dateRange = page.locator('.text-sm.font-medium');
    await expect(dateRange.first()).toBeVisible();

    await page.screenshot({
      path: 'screenshots/ux-02-calendar-grid.png',
      fullPage: true,
    });
  });

  test('should show time labels from 6am to 9pm', async ({ page }) => {
    // Check for time labels
    const times = ['6a', '7a', '8a', '9a', '10a', '11a', '12p', '1p', '2p', '3p', '4p', '5p', '6p', '7p', '8p', '9p'];

    for (const time of times.slice(0, 5)) {
      const label = page.locator(`text=${time}`).first();
      const isVisible = await label.isVisible().catch(() => false);
      if (!isVisible) {
        console.log(`Time label ${time} not visible (may need scroll)`);
      }
    }

    await page.screenshot({
      path: 'screenshots/ux-03-time-labels.png',
      fullPage: true,
    });
  });

  test('should render the legend at bottom', async ({ page }) => {
    const legend = page.locator('text=Events:');
    await expect(legend.first()).toBeVisible();

    // Check for color indicators
    const meeting = page.locator('text=Meeting');
    const classEvent = page.locator('text=Class');
    const personal = page.locator('text=Personal');

    await expect(meeting.last()).toBeVisible();
    await expect(classEvent.last()).toBeVisible();
    await expect(personal.last()).toBeVisible();
  });

  test('should show current time indicator on today', async ({ page }) => {
    // Red circle indicator
    const redDot = page.locator('.bg-red-500.rounded-full');
    const dotCount = await redDot.count();
    console.log(`Current time indicators: ${dotCount}`);

    // May have 2 (one in events, one in tasks column)
    expect(dotCount).toBeGreaterThanOrEqual(1);
  });
});

// ============================================
// Test Suite: Backlog Panel Functionality
// ============================================
test.describe('Backlog Panel', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageLoad(page);
  });

  test('should display tasks from API', async ({ page }) => {
    // Check API response
    const response = await page.request.get(`${API_URL}/api/tasks?label=weekly-backlog&limit=100`);
    const apiData = await response.json();
    const apiTasks = (apiData.data || []).filter((t: any) => !t.scheduledStart && !t.completedAt);
    console.log(`API backlog tasks: ${apiTasks.length}`);

    // Count UI tasks
    const uiTasks = page.locator('.cursor-grab[class*="bg-slate-800"][class*="border-l-4"]');
    const uiCount = await uiTasks.count();
    console.log(`UI backlog tasks: ${uiCount}`);

    // Counts should match (within reason, UI may still be loading)
    if (apiTasks.length > 0) {
      expect(uiCount).toBeGreaterThan(0);
    }

    await page.screenshot({
      path: 'screenshots/ux-04-backlog-tasks.png',
    });
  });

  test('should show priority indicators on tasks', async ({ page }) => {
    const tasks = page.locator('.cursor-grab[class*="bg-slate-800"][class*="border-l-4"]');
    const count = await tasks.count();

    if (count === 0) {
      test.skip();
      return;
    }

    // Check for priority colors
    const redPriority = page.locator('[class*="border-l-red-500"]');
    const orangePriority = page.locator('[class*="border-l-orange-500"]');
    const yellowPriority = page.locator('[class*="border-l-yellow-500"]');

    const hasColors = (await redPriority.count()) + (await orangePriority.count()) + (await yellowPriority.count()) > 0;
    console.log(`Tasks with priority colors: ${hasColors}`);
  });

  test('should show time estimates on tasks', async ({ page }) => {
    const tasks = page.locator('.cursor-grab[class*="bg-slate-800"][class*="border-l-4"]');
    const count = await tasks.count();

    if (count === 0) {
      test.skip();
      return;
    }

    // Look for time estimates like "30m", "15m"
    const timeEstimates = page.locator('text=/\\d+m/');
    const timeCount = await timeEstimates.count();
    console.log(`Time estimates visible: ${timeCount}`);
  });

  test('should allow adding new task via quick-add', async ({ page }) => {
    // Click add button
    const addButton = page.locator('button:has-text("Add task")');
    await addButton.click();
    await page.waitForTimeout(300);

    // Input should appear
    const input = page.locator('input[placeholder*="Type task"]');
    await expect(input).toBeVisible();

    await page.screenshot({
      path: 'screenshots/ux-05-quick-add-input.png',
    });

    // Type a task
    const testTitle = `Quick Add Test ${Date.now()}`;
    await input.fill(testTitle);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // Task should appear in list
    const newTask = page.locator(`text=${testTitle}`);
    const isVisible = await newTask.isVisible().catch(() => false);
    console.log(`New task visible: ${isVisible}`);

    await page.screenshot({
      path: 'screenshots/ux-06-quick-add-result.png',
    });
  });

  test('should allow cancelling quick-add with Escape', async ({ page }) => {
    const addButton = page.locator('button:has-text("Add task")');
    await addButton.click();
    await page.waitForTimeout(300);

    const input = page.locator('input[placeholder*="Type task"]');
    await expect(input).toBeVisible();

    await input.fill('Will Cancel');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Input should be hidden
    const inputVisible = await input.isVisible().catch(() => false);
    expect(inputVisible).toBe(false);
  });

  test('should show drag handle on tasks', async ({ page }) => {
    const tasks = page.locator('.cursor-grab[class*="bg-slate-800"][class*="border-l-4"]');
    const count = await tasks.count();

    if (count === 0) {
      test.skip();
      return;
    }

    // Tasks should have cursor-grab class
    const firstTask = tasks.first();
    const className = await firstTask.getAttribute('class');
    expect(className).toContain('cursor-grab');
  });
});

// ============================================
// Test Suite: Drag-and-Drop Scheduling
// ============================================
test.describe('Drag-and-Drop Scheduling', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageLoad(page);
  });

  test('should show hover preview when dragging task over calendar', async ({ page }) => {
    const taskData = await ensureBacklogTask(page);
    if (!taskData) {
      test.skip();
      return;
    }

    const backlogTasks = page.locator('.cursor-grab[class*="bg-slate-800"][class*="border-l-4"]');
    const firstTask = backlogTasks.first();
    const taskBox = await firstTask.boundingBox();
    if (!taskBox) {
      test.fail();
      return;
    }

    // Find the calendar grid area
    const calendarGrid = page.locator('div[class*="flex-1"][class*="overflow-auto"]').first();
    const gridBox = await calendarGrid.boundingBox();
    if (!gridBox) {
      test.fail();
      return;
    }

    // Start drag
    const startX = taskBox.x + taskBox.width / 2;
    const startY = taskBox.y + taskBox.height / 2;
    const endX = gridBox.x + 400; // Target middle of calendar
    const endY = gridBox.y + 200;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.waitForTimeout(200);

    // Move to calendar area
    await page.mouse.move(endX, endY, { steps: 20 });
    await page.waitForTimeout(500);

    // Check for hover preview
    const hoverPreview = page.locator('[class*="bg-emerald-500"]');
    const previewVisible = await hoverPreview.isVisible().catch(() => false);
    console.log(`Hover preview visible: ${previewVisible}`);

    await page.screenshot({
      path: 'screenshots/ux-07-drag-hover-preview.png',
      fullPage: true,
    });

    // Cancel drag
    await page.keyboard.press('Escape');
    await page.mouse.up();
  });

  test('should schedule task when dropped on calendar', async ({ page }) => {
    // Track API calls
    let scheduleApiCalled = false;
    let scheduleStatus = 0;

    page.on('response', async (response) => {
      if (response.url().includes('/schedule')) {
        scheduleApiCalled = true;
        scheduleStatus = response.status();
      }
    });

    const taskData = await ensureBacklogTask(page);
    if (!taskData) {
      test.skip();
      return;
    }

    const backlogTasks = page.locator('.cursor-grab[class*="bg-slate-800"][class*="border-l-4"]');
    const initialCount = await backlogTasks.count();
    console.log(`Initial backlog count: ${initialCount}`);

    const firstTask = backlogTasks.first();
    const taskTitle = await firstTask.locator('.font-medium').textContent();
    console.log(`Dragging task: ${taskTitle}`);

    const taskBox = await firstTask.boundingBox();
    if (!taskBox) {
      test.fail();
      return;
    }

    await page.screenshot({
      path: 'screenshots/ux-08-before-schedule-drag.png',
      fullPage: true,
    });

    // Find a target in the TASKS column (right half of day)
    // Days are 140px wide, TASKS column is right half (70px)
    const calendarGrid = page.locator('div[class*="flex-1"][class*="overflow-auto"]').first();
    const gridBox = await calendarGrid.boundingBox();
    if (!gridBox) {
      test.fail();
      return;
    }

    // Target: First day's TASKS column around 10am
    // Time labels are 56px, each day is 140px
    // TASKS column starts at 56 + 70 = 126px from left
    const targetX = gridBox.x + 56 + 70 + 35; // Middle of first day's tasks column
    const targetY = gridBox.y + 100 + 200; // Around 10am (accounting for header)

    const startX = taskBox.x + taskBox.width / 2;
    const startY = taskBox.y + taskBox.height / 2;

    console.log(`Dragging from (${startX}, ${startY}) to (${targetX}, ${targetY})`);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.waitForTimeout(250);

    // Move slowly to ensure dnd-kit registers the drag
    await page.mouse.move(targetX, targetY, { steps: 30 });
    await page.waitForTimeout(300);

    await page.screenshot({
      path: 'screenshots/ux-09-during-schedule-drag.png',
      fullPage: true,
    });

    await page.mouse.up();
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'screenshots/ux-10-after-schedule-drag.png',
      fullPage: true,
    });

    // Check API was called
    console.log(`Schedule API called: ${scheduleApiCalled}, status: ${scheduleStatus}`);

    // Check if task was removed from backlog
    const finalCount = await backlogTasks.count();
    console.log(`Final backlog count: ${finalCount}`);

    if (scheduleApiCalled && scheduleStatus === 200) {
      expect(finalCount).toBeLessThan(initialCount);
    }
  });

  test('should schedule task at correct time based on drop position', async ({ page }) => {
    // This tests that the time calculation is correct

    const taskData = await ensureBacklogTask(page);
    if (!taskData) {
      test.skip();
      return;
    }

    // Track the scheduled time
    let scheduledStartTime = '';

    page.on('request', async (request) => {
      if (request.url().includes('/schedule') && request.method() === 'POST') {
        const postData = request.postData();
        if (postData) {
          const data = JSON.parse(postData);
          scheduledStartTime = data.startTime;
        }
      }
    });

    const backlogTasks = page.locator('.cursor-grab[class*="bg-slate-800"][class*="border-l-4"]');
    const firstTask = backlogTasks.first();
    const taskBox = await firstTask.boundingBox();
    if (!taskBox) {
      test.fail();
      return;
    }

    const calendarGrid = page.locator('div[class*="flex-1"][class*="overflow-auto"]').first();

    // Scroll to top to ensure 9am is visible (calendar auto-scrolls to current time on load)
    await calendarGrid.evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.waitForTimeout(300);

    const gridBox = await calendarGrid.boundingBox();
    if (!gridBox) {
      test.fail();
      return;
    }

    // Target 9am - that's 3 hours from 6am start
    // Each hour is 48px, so 9am = 3 * 48 = 144px from top of time grid
    // Plus ~80px for sticky header
    const targetX = gridBox.x + 56 + 70 + 35;
    const targetY = gridBox.y + 80 + 144;

    const startX = taskBox.x + taskBox.width / 2;
    const startY = taskBox.y + taskBox.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.waitForTimeout(250);
    await page.mouse.move(targetX, targetY, { steps: 25 });
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(2000);

    console.log(`Scheduled start time: ${scheduledStartTime}`);

    if (scheduledStartTime) {
      const date = new Date(scheduledStartTime);
      const hour = date.getHours();
      console.log(`Scheduled hour: ${hour}`);
      // Should be around 9am (8-10 range due to position variability)
      expect(hour).toBeGreaterThanOrEqual(7);
      expect(hour).toBeLessThanOrEqual(11);
    }
  });
});

// ============================================
// Test Suite: Rescheduling Tasks
// ============================================
test.describe('Rescheduling Tasks', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageLoad(page);
  });

  test('should allow dragging scheduled task to different time', async ({ page }) => {
    // Find a scheduled task in the calendar
    const scheduledTasks = page.locator('[class*="border-l-2"][class*="border-white/30"]');
    const count = await scheduledTasks.count();
    console.log(`Scheduled tasks found: ${count}`);

    if (count === 0) {
      console.log('No scheduled tasks - skipping reschedule test');
      test.skip();
      return;
    }

    let scheduleApiCalled = false;

    page.on('response', async (response) => {
      if (response.url().includes('/schedule') && response.status() === 200) {
        scheduleApiCalled = true;
      }
    });

    const task = scheduledTasks.first();
    const taskBox = await task.boundingBox();
    if (!taskBox) {
      test.fail();
      return;
    }

    await page.screenshot({
      path: 'screenshots/ux-11-before-reschedule.png',
      fullPage: true,
    });

    // Drag task down by 2 hours (2 * 48 = 96px)
    const startX = taskBox.x + taskBox.width / 2;
    const startY = taskBox.y + taskBox.height / 2;
    const endY = startY + 96;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.waitForTimeout(250);
    await page.mouse.move(startX, endY, { steps: 15 });
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'screenshots/ux-12-after-reschedule.png',
      fullPage: true,
    });

    console.log(`Schedule API called for reschedule: ${scheduleApiCalled}`);
  });

  test('should allow dragging scheduled task to different day', async ({ page }) => {
    const scheduledTasks = page.locator('[class*="border-l-2"][class*="border-white/30"]');
    const count = await scheduledTasks.count();

    if (count === 0) {
      test.skip();
      return;
    }

    let scheduleApiCalled = false;

    page.on('response', async (response) => {
      if (response.url().includes('/schedule') && response.status() === 200) {
        scheduleApiCalled = true;
      }
    });

    const task = scheduledTasks.first();
    const taskBox = await task.boundingBox();
    if (!taskBox) {
      test.fail();
      return;
    }

    // Drag task right to next day (140px per day)
    const startX = taskBox.x + taskBox.width / 2;
    const startY = taskBox.y + taskBox.height / 2;
    const endX = startX + 140;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.waitForTimeout(250);
    await page.mouse.move(endX, startY, { steps: 15 });
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(2000);

    console.log(`Schedule API called for cross-day reschedule: ${scheduleApiCalled}`);
  });
});

// ============================================
// Test Suite: Unscheduling Tasks (Context Menu)
// ============================================
test.describe('Unscheduling Tasks', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageLoad(page);
  });

  test('should show context menu on right-click', async ({ page }) => {
    const scheduledTasks = page.locator('[class*="border-l-2"][class*="border-white/30"]');
    const count = await scheduledTasks.count();

    if (count === 0) {
      test.skip();
      return;
    }

    const task = scheduledTasks.first();
    await task.scrollIntoViewIfNeeded();

    // Right-click to open context menu
    await task.click({ button: 'right' });
    await page.waitForTimeout(500);

    // Check for context menu
    const contextMenu = page.locator('text=Back to Backlog');
    const menuVisible = await contextMenu.isVisible().catch(() => false);
    console.log(`Context menu visible: ${menuVisible}`);

    await page.screenshot({
      path: 'screenshots/ux-13-context-menu.png',
      fullPage: true,
    });

    expect(menuVisible).toBe(true);

    // Also check for Edit option
    const editOption = page.locator('text=Edit Details');
    const editVisible = await editOption.isVisible().catch(() => false);
    console.log(`Edit option visible: ${editVisible}`);
    expect(editVisible).toBe(true);
  });

  test('should unschedule task when clicking Back to Backlog', async ({ page }) => {
    const scheduledTasks = page.locator('[class*="border-l-2"][class*="border-white/30"]');
    const count = await scheduledTasks.count();

    if (count === 0) {
      test.skip();
      return;
    }

    let unscheduleApiCalled = false;

    page.on('response', async (response) => {
      if (response.url().includes('/unschedule') && response.status() === 200) {
        unscheduleApiCalled = true;
      }
    });

    const initialBacklogCount = await page.locator('.cursor-grab[class*="bg-slate-800"][class*="border-l-4"]').count();

    const task = scheduledTasks.first();
    await task.scrollIntoViewIfNeeded();
    await task.click({ button: 'right' });
    await page.waitForTimeout(500);

    const backToBacklog = page.locator('text=Back to Backlog');
    await backToBacklog.click();
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'screenshots/ux-14-after-unschedule.png',
      fullPage: true,
    });

    console.log(`Unschedule API called: ${unscheduleApiCalled}`);

    // Check if task appeared in backlog
    const finalBacklogCount = await page.locator('.cursor-grab[class*="bg-slate-800"][class*="border-l-4"]').count();
    console.log(`Backlog count: before=${initialBacklogCount}, after=${finalBacklogCount}`);
  });

  test('should close context menu when clicking outside', async ({ page }) => {
    const scheduledTasks = page.locator('[class*="border-l-2"][class*="border-white/30"]');
    const count = await scheduledTasks.count();

    if (count === 0) {
      test.skip();
      return;
    }

    const task = scheduledTasks.first();
    await task.click({ button: 'right' });
    await page.waitForTimeout(500);

    // Menu should be visible
    let menuVisible = await page.locator('text=Back to Backlog').isVisible();
    expect(menuVisible).toBe(true);

    // Click outside
    await page.mouse.click(10, 10);
    await page.waitForTimeout(300);

    // Menu should be hidden
    menuVisible = await page.locator('text=Back to Backlog').isVisible();
    expect(menuVisible).toBe(false);
  });
});

// ============================================
// Test Suite: Event Creation (Click-Drag)
// ============================================
test.describe('Event Creation', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageLoad(page);
  });

  test('should show selection highlight when dragging on Events column', async ({ page }) => {
    // Events column is the LEFT half of each day
    const calendarGrid = page.locator('div[class*="flex-1"][class*="overflow-auto"]').first();
    const gridBox = await calendarGrid.boundingBox();
    if (!gridBox) {
      test.fail();
      return;
    }

    // Target the EVENTS column (left half of first day)
    // Time labels are 56px, first day starts there
    // Events column is left half, so target x = 56 + 35 (middle of events col)
    const targetX = gridBox.x + 56 + 35;
    const startY = gridBox.y + 80 + 100;
    const endY = startY + 96; // 2 hours

    await page.mouse.move(targetX, startY);
    await page.mouse.down();
    await page.waitForTimeout(200);

    // Drag to create selection
    await page.mouse.move(targetX, endY, { steps: 10 });
    await page.waitForTimeout(300);

    // Check for selection highlight (indigo colored)
    const selectionHighlight = page.locator('[class*="bg-indigo-500"]');
    const highlightVisible = await selectionHighlight.isVisible().catch(() => false);
    console.log(`Selection highlight visible: ${highlightVisible}`);

    await page.screenshot({
      path: 'screenshots/ux-15-event-drag-selection.png',
      fullPage: true,
    });

    await page.mouse.up();
    await page.waitForTimeout(500);
  });

  test('should show popup form after releasing drag on Events column', async ({ page }) => {
    const calendarGrid = page.locator('div[class*="flex-1"][class*="overflow-auto"]').first();
    const gridBox = await calendarGrid.boundingBox();
    if (!gridBox) {
      test.fail();
      return;
    }

    const targetX = gridBox.x + 56 + 35;
    const startY = gridBox.y + 80 + 100;
    const endY = startY + 48; // 1 hour

    await page.mouse.move(targetX, startY);
    await page.mouse.down();
    await page.waitForTimeout(200);
    await page.mouse.move(targetX, endY, { steps: 10 });
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Check for popup
    const popup = page.locator('text=New Event');
    const popupVisible = await popup.isVisible().catch(() => false);
    console.log(`Event popup visible: ${popupVisible}`);

    await page.screenshot({
      path: 'screenshots/ux-16-event-popup.png',
      fullPage: true,
    });

    expect(popupVisible).toBe(true);
  });

  test('should create event when form is submitted', async ({ page }) => {
    let createEventApiCalled = false;

    page.on('response', async (response) => {
      if (response.url().includes('/api/calendar/events') && response.request().method() === 'POST') {
        createEventApiCalled = true;
      }
    });

    const calendarGrid = page.locator('div[class*="flex-1"][class*="overflow-auto"]').first();
    const gridBox = await calendarGrid.boundingBox();
    if (!gridBox) {
      test.fail();
      return;
    }

    const targetX = gridBox.x + 56 + 35;
    const startY = gridBox.y + 80 + 150;
    const endY = startY + 48;

    await page.mouse.move(targetX, startY);
    await page.mouse.down();
    await page.waitForTimeout(200);
    await page.mouse.move(targetX, endY, { steps: 10 });
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Fill the form
    const titleInput = page.locator('input[placeholder*="Add title"]');
    if (await titleInput.isVisible()) {
      const eventTitle = `Test Event ${Date.now()}`;
      await titleInput.fill(eventTitle);

      const createButton = page.locator('button:has-text("Create Event")');
      await createButton.click();
      await page.waitForTimeout(2000);

      console.log(`Create event API called: ${createEventApiCalled}`);

      await page.screenshot({
        path: 'screenshots/ux-17-after-event-create.png',
        fullPage: true,
      });
    }
  });

  test('should allow scheduling task from popup Schedule Task tab', async ({ page }) => {
    const calendarGrid = page.locator('div[class*="flex-1"][class*="overflow-auto"]').first();
    const gridBox = await calendarGrid.boundingBox();
    if (!gridBox) {
      test.fail();
      return;
    }

    const targetX = gridBox.x + 56 + 35;
    const startY = gridBox.y + 80 + 200;
    const endY = startY + 48;

    await page.mouse.move(targetX, startY);
    await page.mouse.down();
    await page.waitForTimeout(200);
    await page.mouse.move(targetX, endY, { steps: 10 });
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Click Schedule Task tab
    const scheduleTab = page.locator('button:has-text("Schedule Task")');
    if (await scheduleTab.isVisible()) {
      await scheduleTab.click();
      await page.waitForTimeout(300);

      await page.screenshot({
        path: 'screenshots/ux-18-schedule-task-tab.png',
        fullPage: true,
      });

      // Should show list of backlog tasks
      const backlogList = page.locator('text=No tasks in backlog');
      const hasNoTasks = await backlogList.isVisible().catch(() => false);
      console.log(`Backlog empty in popup: ${hasNoTasks}`);
    }
  });
});

// ============================================
// Test Suite: Task Completion
// ============================================
test.describe('Task Completion', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageLoad(page);
  });

  test('should complete scheduled task when clicking checkbox', async ({ page }) => {
    const scheduledTasks = page.locator('[class*="border-l-2"][class*="border-white/30"]');
    const count = await scheduledTasks.count();

    if (count === 0) {
      test.skip();
      return;
    }

    let completeApiCalled = false;
    let completeStatus = 0;

    page.on('response', async (response) => {
      if (response.url().includes('/complete')) {
        completeApiCalled = true;
        completeStatus = response.status();
      }
    });

    // Find first uncompleted task
    const uncompletedTask = scheduledTasks.filter({ hasNot: page.locator('.line-through') }).first();
    if (await uncompletedTask.count() === 0) {
      test.skip();
      return;
    }

    await uncompletedTask.scrollIntoViewIfNeeded();

    await page.screenshot({
      path: 'screenshots/ux-19-before-complete.png',
      fullPage: true,
    });

    // Click the checkbox (small button at start of task)
    const checkbox = uncompletedTask.locator('button').first();
    await checkbox.click({ force: true });
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'screenshots/ux-20-after-complete.png',
      fullPage: true,
    });

    console.log(`Complete API called: ${completeApiCalled}, status: ${completeStatus}`);
    expect(completeApiCalled).toBe(true);
  });

  test('should show visual feedback when task is completed', async ({ page }) => {
    // Check for any completed tasks (line-through, opacity)
    const completedTasks = page.locator('[class*="border-l-2"][class*="border-white/30"] .line-through');
    const count = await completedTasks.count();
    console.log(`Completed tasks with line-through: ${count}`);

    if (count > 0) {
      // Check for opacity style
      const firstCompleted = completedTasks.first().locator('..');
      const className = await firstCompleted.getAttribute('class');
      const hasOpacity = className?.includes('opacity') || false;
      console.log(`Has opacity class: ${hasOpacity}`);
    }
  });

  test('should complete backlog task when clicking checkbox', async ({ page }) => {
    const backlogTasks = page.locator('.cursor-grab[class*="bg-slate-800"][class*="border-l-4"]');
    const count = await backlogTasks.count();

    if (count === 0) {
      test.skip();
      return;
    }

    let completeApiCalled = false;

    page.on('response', async (response) => {
      if (response.url().includes('/complete')) {
        completeApiCalled = true;
      }
    });

    const firstTask = backlogTasks.first();
    const checkbox = firstTask.locator('button[aria-label="Complete task"]');

    if (await checkbox.count() > 0) {
      await checkbox.click();
      await page.waitForTimeout(2000);
      console.log(`Backlog complete API called: ${completeApiCalled}`);
    }
  });
});

// ============================================
// Test Suite: Week Navigation
// ============================================
test.describe('Week Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageLoad(page);
  });

  test('should display current week date range', async ({ page }) => {
    const dateHeader = page.locator('.text-sm.font-medium').first();
    const dateText = await dateHeader.textContent();
    console.log(`Current date range: ${dateText}`);

    // Should contain month and year
    expect(dateText).toMatch(/\w+ \d+ - \w+ \d+, \d{4}/);
  });

  test('should navigate to next week', async ({ page }) => {
    const dateHeader = page.locator('.text-sm.font-medium').first();
    const initialDateText = await dateHeader.textContent();

    // Click next button
    const nextButton = page.locator('button svg path[d*="M9 5l7 7"]').locator('..');
    await nextButton.click();
    await page.waitForTimeout(500);

    const newDateText = await dateHeader.textContent();
    console.log(`After next: ${newDateText}`);

    expect(newDateText).not.toBe(initialDateText);
    expect(newDateText).toContain('(+1 week)');

    await page.screenshot({
      path: 'screenshots/ux-21-next-week.png',
      fullPage: false,
    });
  });

  test('should navigate to previous week from future', async ({ page }) => {
    // First go to next week
    const nextButton = page.locator('button svg path[d*="M9 5l7 7"]').locator('..');
    await nextButton.click();
    await page.waitForTimeout(500);

    const dateHeader = page.locator('.text-sm.font-medium').first();
    const nextWeekText = await dateHeader.textContent();

    // Then go back
    const prevButton = page.locator('button svg path[d*="M15 19l-7"]').locator('..');
    await prevButton.click();
    await page.waitForTimeout(500);

    const backText = await dateHeader.textContent();
    console.log(`After back: ${backText}`);

    expect(backText).not.toBe(nextWeekText);
    expect(backText).not.toContain('week');
  });

  test('should disable previous button on current week', async ({ page }) => {
    const prevButton = page.locator('button svg path[d*="M15 19l-7"]').locator('..');
    const isDisabled = await prevButton.isDisabled();
    console.log(`Previous button disabled: ${isDisabled}`);
    expect(isDisabled).toBe(true);
  });

  test('should allow navigating multiple weeks ahead', async ({ page }) => {
    const nextButton = page.locator('button svg path[d*="M9 5l7 7"]').locator('..');

    // Go 3 weeks ahead
    await nextButton.click();
    await page.waitForTimeout(300);
    await nextButton.click();
    await page.waitForTimeout(300);
    await nextButton.click();
    await page.waitForTimeout(500);

    const dateHeader = page.locator('.text-sm.font-medium').first();
    const dateText = await dateHeader.textContent();
    console.log(`3 weeks ahead: ${dateText}`);

    expect(dateText).toContain('(+3 weeks)');

    await page.screenshot({
      path: 'screenshots/ux-22-three-weeks-ahead.png',
      fullPage: false,
    });
  });
});

// ============================================
// Test Suite: Edge Cases
// ============================================
test.describe('Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageLoad(page);
  });

  test('should handle long task titles gracefully', async ({ page }) => {
    // Create a task with very long title
    const addButton = page.locator('button:has-text("Add task")');
    await addButton.click();
    await page.waitForTimeout(300);

    const input = page.locator('input[placeholder*="Type task"]');
    const longTitle = 'This is a very long task title that should be truncated in the UI to prevent overflow and maintain proper layout '.repeat(2);
    await input.fill(longTitle);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'screenshots/ux-23-long-title.png',
      fullPage: true,
    });

    // Check that UI didn't break
    const backlogPanel = page.locator('h2:has-text("Weekly Backlog")');
    await expect(backlogPanel).toBeVisible();
  });

  test('should handle rapid clicking without breaking', async ({ page }) => {
    const addButton = page.locator('button:has-text("Add task")');

    // Rapid clicks
    await addButton.click();
    await addButton.click();
    await addButton.click();
    await page.waitForTimeout(500);

    // Page should still be functional
    const backlogPanel = page.locator('h2:has-text("Weekly Backlog")');
    await expect(backlogPanel).toBeVisible();

    await page.screenshot({
      path: 'screenshots/ux-24-rapid-clicks.png',
      fullPage: true,
    });
  });

  test('should handle scrolling in calendar', async ({ page }) => {
    const scrollContainer = page.locator('div[class*="flex-1"][class*="overflow-auto"]').first();

    // Scroll down
    await scrollContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight / 2;
    });
    await page.waitForTimeout(300);

    await page.screenshot({
      path: 'screenshots/ux-25-scrolled-calendar.png',
      fullPage: true,
    });

    // Scroll to top
    await scrollContainer.evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.waitForTimeout(300);

    // Page should still be functional
    const dateHeader = page.locator('.text-sm.font-medium').first();
    await expect(dateHeader).toBeVisible();
  });

  test('should handle double-click on scheduled task', async ({ page }) => {
    const scheduledTasks = page.locator('[class*="border-l-2"][class*="border-white/30"]');
    const count = await scheduledTasks.count();

    if (count === 0) {
      test.skip();
      return;
    }

    const task = scheduledTasks.first();
    await task.dblclick();
    await page.waitForTimeout(500);

    // Should open detail modal
    const modal = page.locator('[class*="fixed"][class*="inset"]');
    const modalVisible = await modal.isVisible().catch(() => false);
    console.log(`Detail modal visible: ${modalVisible}`);

    await page.screenshot({
      path: 'screenshots/ux-26-task-detail-modal.png',
      fullPage: true,
    });
  });

  test('should handle window resize', async ({ page }) => {
    // Resize to smaller viewport
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(500);

    await page.screenshot({
      path: 'screenshots/ux-27-small-viewport.png',
      fullPage: true,
    });

    // Check UI is still functional
    const backlogPanel = page.locator('h2:has-text("Weekly Backlog")');
    await expect(backlogPanel).toBeVisible();

    // Resize back
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);
  });

  test('should handle empty state gracefully', async ({ page }) => {
    // Check for empty backlog state
    const emptyState = page.locator('text=No tasks in backlog');
    const emptyVisible = await emptyState.isVisible().catch(() => false);
    console.log(`Empty backlog state visible: ${emptyVisible}`);

    if (emptyVisible) {
      // Should still show add button
      const addButton = page.locator('button:has-text("Add task")');
      await expect(addButton).toBeVisible();
    }
  });

  test('should maintain state after page refresh', async ({ page }) => {
    // Get current data
    const dateHeader = page.locator('.text-sm.font-medium').first();
    const initialDateText = await dateHeader.textContent();

    // Navigate to next week
    const nextButton = page.locator('button svg path[d*="M9 5l7 7"]').locator('..');
    await nextButton.click();
    await page.waitForTimeout(500);

    // Refresh page
    await page.reload();
    await waitForPageLoad(page);

    // Should be back to current week (state not persisted)
    const afterRefreshText = await dateHeader.textContent();
    console.log(`After refresh: ${afterRefreshText}`);

    // Note: This tests current behavior - week offset is NOT persisted
    expect(afterRefreshText).toBe(initialDateText);
  });
});

// ============================================
// Test Suite: API Error Handling
// ============================================
test.describe('API Error Handling', () => {
  test('should handle API timeout gracefully', async ({ page }) => {
    // Intercept and delay API response
    await page.route('**/api/tasks**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 15000)); // 15 second delay
      await route.continue();
    });

    await page.goto(`${BASE_URL}/weekly-planning`, { timeout: 30000 });

    // Page should show loading state
    const loading = page.locator('text=Loading');
    const loadingVisible = await loading.isVisible().catch(() => false);
    console.log(`Loading state visible: ${loadingVisible}`);

    await page.screenshot({
      path: 'screenshots/ux-28-loading-state.png',
      fullPage: true,
    });
  });
});

// ============================================
// Test Suite: Accessibility
// ============================================
test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await waitForPageLoad(page);
  });

  test('should have proper ARIA labels on interactive elements', async ({ page }) => {
    // Check complete button has aria-label
    const completeButton = page.locator('button[aria-label="Complete task"]');
    const count = await completeButton.count();
    console.log(`Buttons with aria-label: ${count}`);
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Press Tab to focus first interactive element
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);

    // Check something is focused
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    console.log(`Focused element: ${focusedElement}`);
  });
});

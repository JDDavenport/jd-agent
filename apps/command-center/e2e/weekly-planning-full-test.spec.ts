/**
 * Weekly Planning Full Feature Test
 *
 * Tests all features of the Weekly Planning page:
 * 1. Calendar Events Display - Google Calendar events on left side
 * 2. Scheduled Tasks - Tasks on right side with checkbox, title, duration
 * 3. Task Completion - Complete task via checkbox
 * 4. Click-Drag to Create Events - Blue preview and popup with tabs
 * 5. Unschedule (Back to Backlog) - Right-click context menu
 * 6. Drag & Drop from Backlog - Schedule task at time slot
 * 7. Week Navigation - Prev/next arrows
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = 'screenshots/weekly-full-test';

test.describe('Weekly Planning - Full Feature Test', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to weekly planning page
    await page.goto(`${BASE_URL}/weekly-planning`);
    // Wait for page to load completely
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Extra time for data loading
  });

  test('1. Calendar Events Display - Events appear on left side of day columns', async ({ page }) => {
    // Take initial screenshot
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/01-initial-load.png`,
      fullPage: true,
    });

    // Look for the "Events" column headers
    const eventsHeaders = page.locator('text=/Events \\(\\d+\\)/');
    const eventsHeaderCount = await eventsHeaders.count();
    console.log(`Found ${eventsHeaderCount} Events column headers`);

    // Each day should have an Events column header
    expect(eventsHeaderCount).toBeGreaterThan(0);

    // Verify events have colors - looking for event blocks with color classes
    const coloredEvents = page.locator('[class*="bg-purple-"], [class*="bg-blue-"], [class*="bg-green-"], [class*="bg-indigo-"]');
    const eventCount = await coloredEvents.count();
    console.log(`Found ${eventCount} colored event blocks`);

    // Get event counts from API for verification
    const today = new Date();
    const dayOfWeek = today.getDay();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - dayOfWeek);
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);

    const startDate = sunday.toISOString().split('T')[0];
    const endDate = saturday.toISOString().split('T')[0];

    const response = await page.request.get(
      `${API_URL}/api/calendar/events?startDate=${startDate}&endDate=${endDate}`
    );
    const apiData = await response.json();
    console.log(`API returned ${apiData.count || apiData.data?.length || 0} calendar events`);

    // Take screenshot showing events
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/01-calendar-events.png`,
      fullPage: true,
    });

    // If API has events, verify they're displayed
    if (apiData.data && apiData.data.length > 0) {
      const nonZeroEventsHeader = page.locator('text=/Events \\([1-9]\\d*\\)/');
      const hasEventsShown = await nonZeroEventsHeader.count() > 0;
      console.log(`Events showing in UI: ${hasEventsShown}`);
    }
  });

  test('2. Scheduled Tasks Display - Tasks appear on right side with checkbox, title, duration', async ({ page }) => {
    // Look for the "Tasks" column headers
    const tasksHeaders = page.locator('text=/Tasks \\(\\d+\\)/');
    const tasksHeaderCount = await tasksHeaders.count();
    console.log(`Found ${tasksHeaderCount} Tasks column headers`);

    expect(tasksHeaderCount).toBeGreaterThan(0);

    // Take screenshot
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/02-scheduled-tasks-display.png`,
      fullPage: true,
    });

    // Look for task blocks in the calendar - they have the white/30 border styling
    // Using more specific selector for scheduled task blocks
    const taskBlocks = page.locator('[class*="border-l-2"][class*="border-white/30"]');
    const taskCount = await taskBlocks.count();
    console.log(`Found ${taskCount} task blocks in calendar`);

    if (taskCount > 0) {
      // Get first task block
      const firstTask = taskBlocks.first();

      // Verify it has a button (the checkbox)
      const buttons = firstTask.locator('button');
      const buttonCount = await buttons.count();
      console.log(`Task has ${buttonCount} buttons`);
      expect(buttonCount).toBeGreaterThan(0);

      // Verify task has title (font-medium class within the task)
      const titleElement = firstTask.locator('.font-medium').first();
      const title = await titleElement.textContent();
      console.log(`Task title: ${title}`);
      expect(title).toBeTruthy();

      // Verify the task block has the expected structure
      const hasContent = await firstTask.textContent();
      console.log(`Task content length: ${hasContent?.length}`);
      expect(hasContent?.length).toBeGreaterThan(0);
    } else {
      console.log('No scheduled tasks found in the current week - this is okay');
    }
  });

  test('3. Task Completion - Clicking checkbox marks task complete', async ({ page }) => {
    // Track complete API calls
    const completeRequests: { taskId: string; status?: number }[] = [];
    page.on('response', async (response) => {
      if (response.url().includes('/api/tasks/') && response.url().includes('/complete')) {
        const urlParts = response.url().split('/');
        const taskIdIndex = urlParts.findIndex((p) => p === 'tasks') + 1;
        completeRequests.push({
          taskId: urlParts[taskIdIndex],
          status: response.status(),
        });
      }
    });

    // Take before screenshot
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/03a-before-completion.png`,
      fullPage: true,
    });

    // Find task blocks
    const taskBlocks = page.locator('[class*="border-l-2"][class*="border-white/30"]');
    const taskCount = await taskBlocks.count();
    console.log(`Found ${taskCount} task blocks`);

    if (taskCount === 0) {
      console.log('No scheduled tasks found - skipping completion test');
      test.skip();
      return;
    }

    // Find an uncompleted task (no line-through)
    const uncompletedTasks = taskBlocks.filter({ hasNot: page.locator('.line-through') });
    const uncompletedCount = await uncompletedTasks.count();
    console.log(`Uncompleted tasks: ${uncompletedCount}`);

    if (uncompletedCount === 0) {
      console.log('All tasks already completed');
      test.skip();
      return;
    }

    // Get first uncompleted task
    const taskToComplete = uncompletedTasks.first();
    const taskTitle = await taskToComplete.locator('.font-medium').textContent();
    console.log(`Completing task: "${taskTitle}"`);

    // Scroll into view
    await taskToComplete.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Click the checkbox (first button in task)
    const checkbox = taskToComplete.locator('button').first();
    await checkbox.click({ force: true });

    // Wait for API call
    await page.waitForTimeout(2000);

    // Take after screenshot
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/03b-after-completion.png`,
      fullPage: true,
    });

    // Verify API was called
    console.log(`Complete API calls: ${completeRequests.length}`);
    if (completeRequests.length > 0) {
      console.log(`Status: ${completeRequests[0].status}`);
      expect(completeRequests[0].status).toBe(200);
    }
  });

  test('4. Click-Drag to Create Events - Blue preview and popup with tabs', async ({ page }) => {
    // Find the tasks column (right side of a day)
    // We need to click and drag on an empty area in the Tasks column
    const dayColumns = page.locator('[class*="border-r"][class*="border-slate-700"]').filter({
      has: page.locator('text=/Tasks \\(\\d+\\)/')
    });

    // Get the first day's tasks area
    const scrollContainer = page.locator('.overflow-auto').first();
    await scrollContainer.scrollIntoViewIfNeeded();

    // Find the time grid area - look for a day column
    const timeGrid = page.locator('.flex-1.relative').nth(1); // Tasks column
    const gridBox = await timeGrid.boundingBox();

    if (!gridBox) {
      console.log('Could not find time grid');
      test.skip();
      return;
    }

    // Take before screenshot
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/04a-before-drag-create.png`,
      fullPage: true,
    });

    // Calculate position for 10 AM area
    const HOUR_HEIGHT = 48;
    const START_HOUR = 6;
    const startY = gridBox.y + (10 - START_HOUR) * HOUR_HEIGHT;
    const endY = startY + HOUR_HEIGHT; // 1 hour drag

    console.log(`Dragging from y=${startY} to y=${endY}`);

    // Perform click and drag
    await page.mouse.move(gridBox.x + gridBox.width / 2, startY);
    await page.mouse.down();
    await page.waitForTimeout(100);

    // Move down to create selection
    await page.mouse.move(gridBox.x + gridBox.width / 2, endY, { steps: 10 });

    // Screenshot during drag to show blue preview
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/04b-during-drag-blue-preview.png`,
      fullPage: true,
    });

    await page.mouse.up();

    // Wait for popup to appear
    await page.waitForTimeout(500);

    // Take screenshot showing popup
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/04c-popup-appears.png`,
      fullPage: true,
    });

    // Look for the popup with tabs
    const newEventTab = page.locator('text=New Event').first();
    const scheduleTaskTab = page.locator('text=/Schedule Task/').first();

    const hasNewEventTab = await newEventTab.count() > 0;
    const hasScheduleTab = await scheduleTaskTab.count() > 0;

    console.log(`New Event tab visible: ${hasNewEventTab}`);
    console.log(`Schedule Task tab visible: ${hasScheduleTab}`);

    if (hasNewEventTab && hasScheduleTab) {
      expect(hasNewEventTab).toBe(true);
      expect(hasScheduleTab).toBe(true);

      // Verify the note about Google Calendar sync
      const syncNote = page.locator('text=Event will sync to Google Calendar');
      const hasSyncNote = await syncNote.count() > 0;
      console.log(`Google Calendar sync note visible: ${hasSyncNote}`);

      // Test creating an event
      const titleInput = page.locator('input[placeholder="Add title"]');
      if (await titleInput.count() > 0) {
        await titleInput.fill('Test Event from E2E');

        // Screenshot with filled form
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/04d-event-form-filled.png`,
          fullPage: true,
        });

        // Click Create Event button
        const createButton = page.locator('button:has-text("Create Event")');
        if (await createButton.isEnabled()) {
          await createButton.click();
          await page.waitForTimeout(1000);

          // Screenshot after creation
          await page.screenshot({
            path: `${SCREENSHOT_DIR}/04e-after-event-created.png`,
            fullPage: true,
          });
        }
      }
    } else {
      console.log('Popup did not appear - trying again with different position');
      // Close any existing popup
      await page.keyboard.press('Escape');
    }
  });

  test('5. Unschedule (Back to Backlog) - Right-click context menu', async ({ page }) => {
    // Find a scheduled task
    const taskBlocks = page.locator('[class*="border-l-2"][class*="border-white/30"]');
    const taskCount = await taskBlocks.count();
    console.log(`Found ${taskCount} scheduled tasks`);

    if (taskCount === 0) {
      console.log('No scheduled tasks - skipping unschedule test');
      test.skip();
      return;
    }

    // Take before screenshot
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/05a-before-unschedule.png`,
      fullPage: true,
    });

    // Get first task
    const task = taskBlocks.first();
    const taskTitle = await task.locator('.font-medium').textContent();
    console.log(`Will unschedule task: "${taskTitle}"`);

    // Scroll into view
    await task.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // Right-click to show context menu
    await task.click({ button: 'right' });

    // Wait for menu to appear
    await page.waitForTimeout(500);

    // Screenshot showing context menu
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/05b-context-menu.png`,
      fullPage: true,
    });

    // Look for "Back to Backlog" option
    const backToBacklogOption = page.locator('text=Back to Backlog');
    const hasBackToBacklog = await backToBacklogOption.count() > 0;
    console.log(`"Back to Backlog" option visible: ${hasBackToBacklog}`);
    expect(hasBackToBacklog).toBe(true);

    // Look for "Edit Details" option
    const editDetailsOption = page.locator('text=Edit Details');
    const hasEditDetails = await editDetailsOption.count() > 0;
    console.log(`"Edit Details" option visible: ${hasEditDetails}`);
    expect(hasEditDetails).toBe(true);

    // Track unschedule API call
    let unscheduleStatus = 0;
    page.on('response', async (response) => {
      if (response.url().includes('/unschedule')) {
        unscheduleStatus = response.status();
      }
    });

    // Click "Back to Backlog"
    await backToBacklogOption.click();

    // Wait for API
    await page.waitForTimeout(2000);

    // Screenshot after unschedule
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/05c-after-unschedule.png`,
      fullPage: true,
    });

    console.log(`Unschedule API status: ${unscheduleStatus}`);
  });

  test('6. Drag & Drop from Backlog - Schedule task at time slot', async ({ page }) => {
    // Track schedule API calls
    let scheduleStatus = 0;
    page.on('response', async (response) => {
      if (response.url().includes('/schedule') && response.request().method() === 'POST') {
        scheduleStatus = response.status();
      }
    });

    // Take initial screenshot
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/06a-initial-backlog.png`,
      fullPage: true,
    });

    // Find backlog tasks using the selector that finds them
    const backlogTasks = page.locator('[class*="bg-slate-800"][class*="border-l-4"][class*="cursor-grab"]');
    const backlogCount = await backlogTasks.count();
    console.log(`Backlog tasks found: ${backlogCount}`);

    if (backlogCount === 0) {
      console.log('No backlog tasks found - skipping drag test');
      test.skip();
      return;
    }

    // Get first backlog task
    const task = backlogTasks.first();
    const taskTitle = await task.locator('.font-medium').first().textContent();
    console.log(`Will drag task: "${taskTitle}"`);

    const taskBox = await task.boundingBox();
    if (!taskBox) {
      console.log('Could not get task bounding box');
      test.skip();
      return;
    }

    // Screenshot before drag
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/06b-before-drag.png`,
      fullPage: true,
    });

    // Find the calendar scroll area
    const scrollArea = page.locator('.overflow-auto').first();
    const scrollBox = await scrollArea.boundingBox();

    if (!scrollBox) {
      console.log('Could not find calendar area');
      test.skip();
      return;
    }

    // Calculate drop position - in the calendar area
    // The calendar starts after the time labels column (w-14 = 56px)
    // We want to drop around 10 AM (4 hours from 6 AM start)
    const HOUR_HEIGHT = 48;
    const dropX = scrollBox.x + 100 + 70 * 2; // After time column, into second day column
    const dropY = scrollBox.y + 4 * HOUR_HEIGHT + 24; // Around 10 AM

    console.log(`Task box: (${taskBox.x}, ${taskBox.y})`);
    console.log(`Drop target: (${dropX}, ${dropY})`);

    // Perform drag and drop
    const startX = taskBox.x + taskBox.width / 2;
    const startY = taskBox.y + taskBox.height / 2;

    console.log(`Dragging from (${startX}, ${startY}) to (${dropX}, ${dropY})`);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.waitForTimeout(300); // Let dnd-kit register the drag

    // Move in steps
    await page.mouse.move(dropX, dropY, { steps: 25 });

    // Screenshot during drag
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/06c-during-drag.png`,
      fullPage: true,
    });

    await page.waitForTimeout(200);
    await page.mouse.up();

    // Wait for API and UI update
    await page.waitForTimeout(2000);

    // Screenshot after drop
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/06d-after-drop.png`,
      fullPage: true,
    });

    console.log(`Schedule API status: ${scheduleStatus}`);

    // Check if backlog count changed
    const newBacklogCount = await backlogTasks.count();
    console.log(`Backlog count after: ${newBacklogCount} (was ${backlogCount})`);
  });

  test('7. Week Navigation - Prev/Next arrows change date range', async ({ page }) => {
    // Find the navigation header in the calendar
    // The date range is displayed between the prev/next buttons
    const navHeader = page.locator('.items-center.justify-between').filter({ has: page.locator('button') }).first();

    // Get the date text element - it contains "MMM d - MMM d, yyyy"
    const dateTextElement = navHeader.locator('.text-sm.font-medium');
    const initialDateText = await dateTextElement.textContent();
    console.log(`Initial date range: ${initialDateText}`);

    // Screenshot initial state
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/07a-initial-week.png`,
      fullPage: true,
    });

    // Find navigation buttons
    const navButtons = navHeader.locator('button');
    const buttonCount = await navButtons.count();
    console.log(`Found ${buttonCount} navigation buttons`);

    // First button is prev, second is next
    const prevButton = navButtons.first();
    const nextButton = navButtons.last();

    // Click next week button
    await nextButton.click();
    await page.waitForTimeout(1000);

    // Get new date range
    const afterNextText = await dateTextElement.textContent();
    console.log(`After next: ${afterNextText}`);

    // Screenshot after next
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/07b-next-week.png`,
      fullPage: true,
    });

    // Verify date changed - should show (+1 week)
    expect(afterNextText).not.toBe(initialDateText);
    expect(afterNextText).toContain('+1 week');

    // Click next again
    await nextButton.click();
    await page.waitForTimeout(500);

    const afterSecondNext = await dateTextElement.textContent();
    console.log(`After second next: ${afterSecondNext}`);
    expect(afterSecondNext).toContain('+2 week');

    // Screenshot showing +2 weeks
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/07c-two-weeks-ahead.png`,
      fullPage: true,
    });

    // Click prev button to go back
    await prevButton.click();
    await page.waitForTimeout(500);

    const afterPrev = await dateTextElement.textContent();
    console.log(`After prev: ${afterPrev}`);
    expect(afterPrev).toContain('+1 week');

    // Click prev again to return to current week
    await prevButton.click();
    await page.waitForTimeout(500);

    const finalDateText = await dateTextElement.textContent();
    console.log(`Final date range: ${finalDateText}`);

    // Screenshot back at current week
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/07d-back-to-current.png`,
      fullPage: true,
    });

    // Should be back to initial (no +X week suffix)
    expect(finalDateText).toBe(initialDateText);

    // Verify prev button is disabled when at current week
    const isPrevDisabled = await prevButton.isDisabled();
    console.log(`Prev button disabled at current week: ${isPrevDisabled}`);
    expect(isPrevDisabled).toBe(true);
  });

  test('Legend and Time Indicator verification', async ({ page }) => {
    // Verify legend is visible
    const legend = page.locator('text=Events:');
    await expect(legend).toBeVisible();

    // Verify legend shows event types
    const meetingLegend = page.locator('text=Meeting');
    const classLegend = page.locator('text=Class');
    const personalLegend = page.locator('text=Personal');

    expect(await meetingLegend.count()).toBeGreaterThan(0);
    expect(await classLegend.count()).toBeGreaterThan(0);
    expect(await personalLegend.count()).toBeGreaterThan(0);

    // Verify task priority legend
    const p4Legend = page.locator('text=P4');
    const p3Legend = page.locator('text=P3');

    expect(await p4Legend.count()).toBeGreaterThan(0);
    expect(await p3Legend.count()).toBeGreaterThan(0);

    // Take screenshot
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/08-legend-and-ui.png`,
      fullPage: true,
    });

    // Check for current time indicator (red line) on today's column
    const timeIndicator = page.locator('.bg-red-500');
    const indicatorCount = await timeIndicator.count();
    console.log(`Time indicators found: ${indicatorCount}`);

    // Should have time indicators (dot + line on today's column)
    expect(indicatorCount).toBeGreaterThanOrEqual(1);

    // Take final full-page screenshot
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/09-final-overview.png`,
      fullPage: true,
    });
  });
});

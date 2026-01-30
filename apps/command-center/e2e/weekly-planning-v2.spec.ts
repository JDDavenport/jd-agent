/**
 * Weekly Planning V2 Test Suite
 *
 * Tests for the updated Weekly Planning page features:
 * 1. Click-drag on EVENTS column to create events (indigo preview)
 * 2. Hover preview when dragging tasks (dashed blue preview)
 * 3. Drag scheduled tasks to reschedule
 * 4. Other features: context menu, complete task, navigation
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = '/Users/jddavenport/Projects/JD Agent/apps/command-center/screenshots/v2-test';

test.describe('Weekly Planning V2 Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/weekly-planning`);
    // Wait for the calendar to load
    await page.waitForSelector('.bg-slate-900.rounded-lg', { timeout: 10000 });
    // Give time for data to load
    await page.waitForTimeout(2000);
  });

  test('Test 1: Click-drag on EVENTS column to create event', async ({ page }) => {
    console.log('TEST 1: Click-drag on EVENTS column to create event');

    // Take initial screenshot
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/01-initial-weekly-planning.png`,
      fullPage: true
    });

    // Find the first day column - the EVENTS side (left half of each day column)
    // Day columns have width: 140px, and are split into Events (left) and Tasks (right)
    // We need to find the Events column (with cursor-crosshair class)
    const eventsColumns = page.locator('.cursor-crosshair');
    const firstEventsColumn = eventsColumns.first();

    // Check if events column exists
    const eventsCount = await eventsColumns.count();
    console.log(`Found ${eventsCount} events columns`);

    if (eventsCount === 0) {
      console.log('ERROR: No events columns found');
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/01-error-no-events-columns.png`,
        fullPage: true
      });
      return;
    }

    // Get the bounding box of the first events column
    const box = await firstEventsColumn.boundingBox();
    if (!box) {
      console.log('ERROR: Could not get bounding box for events column');
      return;
    }

    console.log(`Events column at: x=${box.x}, y=${box.y}, width=${box.width}, height=${box.height}`);

    // Calculate position for 9:00 AM slot (3 hours from 6 AM start)
    // Each hour is 48px, so 9 AM is at 3 * 48 = 144px from top of grid
    const startX = box.x + box.width / 2;
    const startY = box.y + 150; // ~9:15 AM

    // Screenshot before drag
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/02-before-event-drag.png`,
      fullPage: true
    });

    // Perform mouse down
    await page.mouse.move(startX, startY);
    await page.mouse.down();

    // Take screenshot during drag start
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/03-event-drag-start.png`,
      fullPage: true
    });

    // Drag down 100px (about 2 hours)
    const endY = startY + 100;
    await page.mouse.move(startX, endY);

    // Take screenshot showing the INDIGO preview
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/04-event-drag-preview-indigo.png`,
      fullPage: true
    });

    // Check for indigo preview element
    const indigoPreview = page.locator('.bg-indigo-500\\/50');
    const hasIndigoPreview = await indigoPreview.count() > 0;
    console.log(`EXPECTED: Indigo/purple preview visible during drag`);
    console.log(`ACTUAL: Indigo preview visible = ${hasIndigoPreview}`);

    // Release mouse - should show popup
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Take screenshot of popup
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/05-event-popup-appeared.png`,
      fullPage: true
    });

    // Check for popup with "New Event" tab
    const popup = page.locator('text=New Event');
    const hasPopup = await popup.isVisible();
    console.log(`EXPECTED: Popup with "New Event" tab appears`);
    console.log(`ACTUAL: Popup visible = ${hasPopup}`);

    // Check for "Schedule Task" tab
    const scheduleTab = page.locator('text=Schedule Task');
    const hasScheduleTab = await scheduleTab.isVisible();
    console.log(`EXPECTED: "Schedule Task" tab available`);
    console.log(`ACTUAL: Schedule Task tab visible = ${hasScheduleTab}`);

    // Close popup by clicking cancel or outside
    const cancelBtn = page.locator('button:has-text("Cancel")');
    if (await cancelBtn.isVisible()) {
      await cancelBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/06-event-popup-closed.png`,
      fullPage: true
    });

    console.log('\nTest 1 Results:');
    console.log('================');
    console.log(`- Indigo preview during drag: ${hasIndigoPreview ? 'PASS' : 'FAIL'}`);
    console.log(`- New Event popup appears: ${hasPopup ? 'PASS' : 'FAIL'}`);
    console.log(`- Schedule Task tab present: ${hasScheduleTab ? 'PASS' : 'FAIL'}`);
  });

  test('Test 2: Hover preview when dragging tasks from backlog', async ({ page }) => {
    console.log('TEST 2: Hover preview when dragging tasks from backlog');

    // Take initial screenshot
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/10-task-drag-initial.png`,
      fullPage: true
    });

    // Find tasks in the Weekly Backlog panel
    const backlogPanel = page.locator('text=Weekly Backlog').locator('..');
    const backlogTasks = page.locator('[data-task-id], .cursor-grab').filter({ hasText: /\w+/ });

    // Look for draggable tasks in the left panel
    const leftPanel = page.locator('.w-72');
    const tasksInBacklog = leftPanel.locator('.cursor-grab, [draggable="true"]');

    const taskCount = await tasksInBacklog.count();
    console.log(`Found ${taskCount} draggable items in backlog`);

    // If no tasks in backlog, check for any task cards
    const taskCards = page.locator('.bg-slate-800').filter({ hasText: /\w{3,}/ });
    const cardCount = await taskCards.count();
    console.log(`Found ${cardCount} task cards total`);

    if (taskCount === 0 && cardCount === 0) {
      console.log('WARNING: No tasks found in backlog. May need to add tasks first.');
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/10-no-tasks-in-backlog.png`,
        fullPage: true
      });

      // Still try to test what we can
      console.log('EXPECTED: Tasks in backlog to drag');
      console.log('ACTUAL: No tasks found - test cannot complete fully');
      return;
    }

    // Find the first task to drag
    const firstTask = tasksInBacklog.first();
    const taskBox = await firstTask.boundingBox();

    if (!taskBox) {
      console.log('ERROR: Could not get task bounding box');
      return;
    }

    console.log(`Task at: x=${taskBox.x}, y=${taskBox.y}`);

    // Find the TASKS column (right side of day column) - the droppable area
    // Tasks columns are siblings of events columns
    const dayColumns = page.locator('[class*="day-"]');

    // Get the calendar grid area
    const calendarArea = page.locator('.overflow-auto').first();
    const calendarBox = await calendarArea.boundingBox();

    if (!calendarBox) {
      console.log('ERROR: Could not get calendar bounding box');
      return;
    }

    // Calculate drop target - middle of calendar, about 10 AM
    // Calendar starts with 56px time column, then 140px per day
    const dropX = calendarBox.x + 56 + 140 + 70 + 35; // Second day, Tasks column (right half)
    const dropY = calendarBox.y + 200; // ~10 AM area

    // Screenshot before drag
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/11-before-task-drag.png`,
      fullPage: true
    });

    // Start dragging the task
    await page.mouse.move(taskBox.x + taskBox.width / 2, taskBox.y + taskBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(100); // Wait for drag activation

    // Screenshot at drag start
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/12-task-drag-start.png`,
      fullPage: true
    });

    // Move to the drop target
    await page.mouse.move(dropX, dropY, { steps: 10 });
    await page.waitForTimeout(300);

    // Screenshot showing the DASHED BLUE hover preview
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/13-task-hover-preview-blue.png`,
      fullPage: true
    });

    // Check for dashed blue preview
    const bluePreview = page.locator('.border-blue-400.border-dashed');
    const hasBluePreview = await bluePreview.count() > 0;
    console.log(`EXPECTED: Dashed blue preview showing drop location`);
    console.log(`ACTUAL: Blue preview visible = ${hasBluePreview}`);

    // Drop the task
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Screenshot after drop
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/14-after-task-drop.png`,
      fullPage: true
    });

    console.log('\nTest 2 Results:');
    console.log('================');
    console.log(`- Dashed blue hover preview: ${hasBluePreview ? 'PASS' : 'NEEDS VERIFICATION'}`);
    console.log('- Check screenshots 13-task-hover-preview-blue.png for visual confirmation');
  });

  test('Test 3: Drag scheduled tasks to reschedule', async ({ page }) => {
    console.log('TEST 3: Drag scheduled tasks to reschedule');

    // Take initial screenshot
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/20-reschedule-initial.png`,
      fullPage: true
    });

    // Find scheduled tasks on the calendar (TaskBlock components)
    // These have class including cursor-grab and are within day columns
    const scheduledTasks = page.locator('.rounded.px-1\\.5.py-0\\.5.cursor-grab');
    const taskCount = await scheduledTasks.count();
    console.log(`Found ${taskCount} scheduled tasks on calendar`);

    if (taskCount === 0) {
      console.log('WARNING: No scheduled tasks found. Need to schedule a task first.');
      console.log('Attempting to schedule a task from backlog first...');

      // Try to find and schedule a task from backlog
      const leftPanel = page.locator('.w-72');
      const backlogTasks = leftPanel.locator('.cursor-grab');
      const backlogCount = await backlogTasks.count();

      if (backlogCount > 0) {
        const firstBacklogTask = backlogTasks.first();
        const box = await firstBacklogTask.boundingBox();
        if (box) {
          const calendarArea = page.locator('.overflow-auto').first();
          const calendarBox = await calendarArea.boundingBox();
          if (calendarBox) {
            // Schedule the task
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            await page.mouse.move(calendarBox.x + 150, calendarBox.y + 200, { steps: 10 });
            await page.mouse.up();
            await page.waitForTimeout(1000);

            await page.screenshot({
              path: `${SCREENSHOT_DIR}/20a-scheduled-task-for-test.png`,
              fullPage: true
            });
          }
        }
      }
    }

    // Re-check for scheduled tasks
    const updatedScheduledTasks = page.locator('.rounded.px-1\\.5.py-0\\.5.cursor-grab');
    const updatedCount = await updatedScheduledTasks.count();

    if (updatedCount === 0) {
      console.log('EXPECTED: Scheduled tasks to drag');
      console.log('ACTUAL: No scheduled tasks found - test cannot complete');
      return;
    }

    // Get the first scheduled task
    const firstScheduledTask = updatedScheduledTasks.first();
    const taskBox = await firstScheduledTask.boundingBox();

    if (!taskBox) {
      console.log('ERROR: Could not get scheduled task bounding box');
      return;
    }

    console.log(`Scheduled task at: x=${taskBox.x}, y=${taskBox.y}`);

    // Screenshot before reschedule drag
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/21-before-reschedule.png`,
      fullPage: true
    });

    // Test 3a: Drag UP or DOWN within same day
    console.log('\n3a. Testing drag within same day (up/down)...');

    await page.mouse.move(taskBox.x + taskBox.width / 2, taskBox.y + taskBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(100);

    // Move down 100px (about 2 hours)
    const newY = taskBox.y + 100;
    await page.mouse.move(taskBox.x + taskBox.width / 2, newY, { steps: 10 });
    await page.waitForTimeout(300);

    // Screenshot showing hover preview during reschedule
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/22-reschedule-same-day-preview.png`,
      fullPage: true
    });

    // Check for hover preview
    const hoverPreview = page.locator('.border-blue-400.border-dashed');
    const hasPreview = await hoverPreview.count() > 0;
    console.log(`EXPECTED: Hover preview at new position`);
    console.log(`ACTUAL: Hover preview visible = ${hasPreview}`);

    // Drop
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Screenshot after same-day reschedule
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/23-after-same-day-reschedule.png`,
      fullPage: true
    });

    // Test 3b: Drag to different day
    console.log('\n3b. Testing drag to different day...');

    // Find the task again (may have moved)
    const rescheduledTask = page.locator('.rounded.px-1\\.5.py-0\\.5.cursor-grab').first();
    const newTaskBox = await rescheduledTask.boundingBox();

    if (!newTaskBox) {
      console.log('ERROR: Could not find rescheduled task');
      return;
    }

    // Drag to a different day (200px to the right = 1+ days)
    await page.mouse.move(newTaskBox.x + newTaskBox.width / 2, newTaskBox.y + newTaskBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(100);

    const differentDayX = newTaskBox.x + 200;
    await page.mouse.move(differentDayX, newTaskBox.y, { steps: 10 });
    await page.waitForTimeout(300);

    // Screenshot showing drag to different day
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/24-drag-to-different-day-preview.png`,
      fullPage: true
    });

    // Drop
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Final screenshot
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/25-after-different-day-reschedule.png`,
      fullPage: true
    });

    console.log('\nTest 3 Results:');
    console.log('================');
    console.log(`- Same-day reschedule (up/down): Check screenshots 22-23`);
    console.log(`- Different-day reschedule: Check screenshots 24-25`);
    console.log(`- Hover preview visible: ${hasPreview ? 'PASS' : 'NEEDS VERIFICATION'}`);
  });

  test('Test 4: Other features - context menu, complete, navigation', async ({ page }) => {
    console.log('TEST 4: Other features');

    // Take initial screenshot
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/30-other-features-initial.png`,
      fullPage: true
    });

    // Test 4a: Week Navigation
    console.log('\n4a. Testing week navigation...');

    // Find navigation buttons
    const prevButton = page.locator('button:has(svg path[d*="15 19l-7-7 7-7"])');
    const nextButton = page.locator('button:has(svg path[d*="9 5l7 7-7 7"])');

    // Get current date range (use more specific selector)
    const dateRangeText = await page.locator('.bg-slate-800 .text-sm.font-medium').first().textContent();
    console.log(`Current date range: ${dateRangeText}`);

    // Click next week
    await nextButton.click();
    await page.waitForTimeout(500);

    // Screenshot after next week
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/31-navigation-next-week.png`,
      fullPage: true
    });

    const newDateRange = await page.locator('.bg-slate-800 .text-sm.font-medium').first().textContent();
    console.log(`After next: ${newDateRange}`);

    // Click previous (back to current)
    await prevButton.click();
    await page.waitForTimeout(500);

    // Screenshot after prev
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/32-navigation-back.png`,
      fullPage: true
    });

    const backDateRange = await page.locator('.bg-slate-800 .text-sm.font-medium').first().textContent();
    console.log(`After prev: ${backDateRange}`);

    console.log(`EXPECTED: Week navigation changes date range`);
    console.log(`ACTUAL: Date changed = ${dateRangeText !== newDateRange}`);

    // Test 4b: Right-click context menu on scheduled task
    console.log('\n4b. Testing right-click context menu...');

    // Find a scheduled task
    const scheduledTasks = page.locator('.rounded.px-1\\.5.py-0\\.5.cursor-grab');
    const taskCount = await scheduledTasks.count();

    if (taskCount > 0) {
      const task = scheduledTasks.first();
      const box = await task.boundingBox();

      if (box) {
        // Right-click to open context menu
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
        await page.waitForTimeout(300);

        // Screenshot showing context menu
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/33-context-menu.png`,
          fullPage: true
        });

        // Check for context menu options
        const backToBacklog = page.locator('text=Back to Backlog');
        const editDetails = page.locator('text=Edit Details');

        const hasBackToBacklog = await backToBacklog.isVisible();
        const hasEditDetails = await editDetails.isVisible();

        console.log(`EXPECTED: Context menu with "Back to Backlog" and "Edit Details"`);
        console.log(`ACTUAL: Back to Backlog visible = ${hasBackToBacklog}`);
        console.log(`ACTUAL: Edit Details visible = ${hasEditDetails}`);

        // Close context menu by clicking elsewhere
        await page.mouse.click(100, 100);
        await page.waitForTimeout(200);
      }
    } else {
      console.log('WARNING: No scheduled tasks for context menu test');
    }

    // Test 4c: Complete task checkbox
    console.log('\n4c. Testing complete task checkbox...');

    // Find task with checkbox
    const taskCheckboxes = page.locator('.rounded.px-1\\.5.py-0\\.5 button.w-3.h-3');
    const checkboxCount = await taskCheckboxes.count();

    if (checkboxCount > 0) {
      // Screenshot before complete
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/34-before-complete.png`,
        fullPage: true
      });

      // Click the first checkbox
      await taskCheckboxes.first().click();
      await page.waitForTimeout(500);

      // Screenshot after complete
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/35-after-complete.png`,
        fullPage: true
      });

      console.log(`EXPECTED: Task marked as complete (strikethrough, green check)`);
      console.log(`ACTUAL: Check screenshot 35-after-complete.png`);
    } else {
      console.log('WARNING: No task checkboxes found for complete test');
    }

    // Final screenshot
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/36-test-complete.png`,
      fullPage: true
    });

    console.log('\nTest 4 Results:');
    console.log('================');
    console.log('- Week navigation: Check screenshots 31-32');
    console.log('- Context menu: Check screenshot 33');
    console.log('- Complete task: Check screenshots 34-35');
  });

  test('Full visual verification', async ({ page }) => {
    console.log('FULL VISUAL VERIFICATION');

    // Take a high-quality screenshot of the entire page
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/40-full-page-1920.png`,
      fullPage: true
    });

    // Log page structure for debugging
    const pageContent = await page.content();

    // Check for key elements
    const hasWeeklyBacklog = await page.locator('text=Weekly Backlog').isVisible();
    const hasCalendar = await page.locator('.bg-slate-900.rounded-lg').first().isVisible();
    const hasLegend = await page.locator('text=Events:').isVisible();
    const hasDragHint = await page.locator('text=Drag on Events to create').isVisible();

    console.log('\nPage Structure Verification:');
    console.log('============================');
    console.log(`- Weekly Backlog panel: ${hasWeeklyBacklog ? 'PASS' : 'FAIL'}`);
    console.log(`- Calendar component: ${hasCalendar ? 'PASS' : 'FAIL'}`);
    console.log(`- Legend bar: ${hasLegend ? 'PASS' : 'FAIL'}`);
    console.log(`- Drag hint text: ${hasDragHint ? 'PASS' : 'FAIL'}`);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/41-final-state.png`,
      fullPage: true
    });
  });
});

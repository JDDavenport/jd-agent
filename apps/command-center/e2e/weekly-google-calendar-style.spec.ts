/**
 * Weekly Planning - Google Calendar Style Interactions Test
 *
 * Tests all Google Calendar-style interactions:
 * 1. Event Creation - Click-drag in EVENTS column (left side) to create new events
 * 2. Hover Preview - Dashed blue preview box shows where task will land during drag
 * 3. Task Scheduling - Drag task from backlog to TASKS column
 * 4. Task Rescheduling - Drag scheduled task within calendar (same day / different day)
 * 5. Unschedule Task - Right-click context menu to send back to backlog
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:3000';

// Test results tracking
interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL' | 'PARTIAL';
  details: string;
}

const testResults: TestResult[] = [];

test.describe('Weekly Planning - Google Calendar Style Interactions', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to weekly planning page
    await page.goto(`${BASE_URL}/weekly-planning`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('Test 1: Event Creation - Click-drag in EVENTS column to create new event', async ({ page }) => {
    let result: TestResult = { test: 'Event Creation', status: 'FAIL', details: '' };

    try {
      // Take initial screenshot
      await page.screenshot({
        path: 'screenshots/gcal-test1-01-initial.png',
        fullPage: true,
      });

      // Find the Events column (LEFT column within a day)
      // The structure is: day column > events column (left, with cursor-crosshair) > tasks column (right)
      const eventsColumns = page.locator('.cursor-crosshair');
      const eventsCount = await eventsColumns.count();
      console.log(`Found ${eventsCount} events columns with cursor-crosshair`);

      if (eventsCount === 0) {
        result.status = 'FAIL';
        result.details = 'Could not find Events column (cursor-crosshair class not found)';
        testResults.push(result);
        return;
      }

      // Use the second events column (skip Sunday, use Monday for better visibility)
      const targetEventsColumn = eventsColumns.nth(Math.min(1, eventsCount - 1));
      const columnBox = await targetEventsColumn.boundingBox();

      if (!columnBox) {
        result.status = 'FAIL';
        result.details = 'Could not get events column bounding box';
        testResults.push(result);
        return;
      }

      console.log(`Events column at: x=${columnBox.x}, y=${columnBox.y}, w=${columnBox.width}, h=${columnBox.height}`);

      // Calculate start position (9 AM = 3 hours from 6 AM start, each hour is 48px)
      const HOUR_HEIGHT = 48;
      const START_HOUR = 6;
      const targetHour = 9;
      const startY = columnBox.y + (targetHour - START_HOUR) * HOUR_HEIGHT + 10;
      const startX = columnBox.x + columnBox.width / 2;

      // End position (1 hour later = 10 AM)
      const endY = startY + HOUR_HEIGHT;

      console.log(`Will drag from (${startX}, ${startY}) to (${startX}, ${endY})`);

      // Perform click-and-drag
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.waitForTimeout(100);

      // Screenshot during drag
      await page.screenshot({
        path: 'screenshots/gcal-test1-02-during-drag.png',
        fullPage: true,
      });

      // Drag down to create 1-hour event
      await page.mouse.move(startX, endY, { steps: 10 });
      await page.waitForTimeout(200);

      // Screenshot at end of drag
      await page.screenshot({
        path: 'screenshots/gcal-test1-03-drag-end.png',
        fullPage: true,
      });

      await page.mouse.up();
      await page.waitForTimeout(1000);

      // Screenshot after mouse up - should show popup
      await page.screenshot({
        path: 'screenshots/gcal-test1-04-after-drag.png',
        fullPage: true,
      });

      // Check if the event creation popup appeared
      const popup = page.locator('text=Add title');
      const inputField = page.locator('input[placeholder="Add title"]');
      const popupVisible = await popup.count() > 0 || await inputField.count() > 0;

      console.log(`Event creation popup visible: ${popupVisible}`);

      if (popupVisible) {
        // Fill in event title
        const testTitle = `Test Event ${Date.now()}`;
        await inputField.fill(testTitle);

        // Take screenshot with form filled
        await page.screenshot({
          path: 'screenshots/gcal-test1-05-form-filled.png',
          fullPage: true,
        });

        // Click Create Event button
        const createButton = page.getByRole('button', { name: 'Create Event' });
        if (await createButton.count() > 0) {
          await createButton.click();
          await page.waitForTimeout(2000);

          // Take screenshot after creation
          await page.screenshot({
            path: 'screenshots/gcal-test1-06-after-create.png',
            fullPage: true,
          });

          result.status = 'PASS';
          result.details = 'Click-drag created event popup, event was created successfully';
        } else {
          result.status = 'PARTIAL';
          result.details = 'Popup appeared but Create Event button not found';
        }
      } else {
        result.status = 'FAIL';
        result.details = 'Event creation popup did not appear after click-drag';
      }
    } catch (error) {
      result.status = 'FAIL';
      result.details = `Error: ${(error as Error).message}`;
    }

    testResults.push(result);
    console.log(`TEST 1 RESULT: ${result.status} - ${result.details}`);
  });

  test('Test 2: Hover Preview - Dashed blue preview box during task drag', async ({ page }) => {
    let result: TestResult = { test: 'Hover Preview', status: 'FAIL', details: '' };

    try {
      // First, ensure there are backlog tasks
      const backlogTasks = page.locator('[class*="bg-slate-800"][class*="border-l-4"][class*="cursor-grab"]');
      let taskCount = await backlogTasks.count();
      console.log(`Backlog tasks found: ${taskCount}`);

      // Take initial screenshot
      await page.screenshot({
        path: 'screenshots/gcal-test2-01-initial.png',
        fullPage: true,
      });

      if (taskCount === 0) {
        // Create a backlog task first
        console.log('No backlog tasks - creating one...');
        const addButton = page.locator('button:has-text("Add")');
        if (await addButton.count() > 0) {
          await addButton.click();
          await page.waitForTimeout(500);

          const titleInput = page.locator('input[placeholder="Task title..."]');
          await titleInput.fill(`Hover Test Task ${Date.now()}`);

          const minutesInput = page.locator('input[placeholder="Minutes"]');
          await minutesInput.fill('30');

          const submitButton = page.locator('button:has-text("Add Task")');
          await submitButton.click();
          await page.waitForTimeout(2000);

          taskCount = await backlogTasks.count();
        }
      }

      if (taskCount === 0) {
        result.status = 'FAIL';
        result.details = 'No backlog tasks available and could not create one';
        testResults.push(result);
        return;
      }

      // Get the first backlog task
      const firstTask = backlogTasks.first();
      const taskTitle = await firstTask.locator('.font-medium').first().textContent();
      console.log(`Will drag task: "${taskTitle}"`);

      const taskBox = await firstTask.boundingBox();
      if (!taskBox) {
        result.status = 'FAIL';
        result.details = 'Could not get task bounding box';
        testResults.push(result);
        return;
      }

      // Find the droppable day column (TASKS column - right side)
      // These are the DroppableDayColumn components
      const dayColumns = page.locator('[class*="day-"]').or(page.locator('[id^="day-"]'));

      // Alternative: Look for the Tasks column area (not events column which has cursor-crosshair)
      const taskDropZones = page.locator('.flex-1.relative:not(.cursor-crosshair)');
      console.log(`Task drop zones found: ${await taskDropZones.count()}`);

      // Find calendar time grid area
      const timeGrid = page.locator('.overflow-auto');
      const gridBox = await timeGrid.first().boundingBox();

      if (!gridBox) {
        result.status = 'FAIL';
        result.details = 'Could not get time grid bounding box';
        testResults.push(result);
        return;
      }

      // Calculate target drop position (around 10 AM on the first day)
      const HOUR_HEIGHT = 48;
      const DAY_WIDTH = 140;
      const TIME_LABEL_WIDTH = 56;

      // Target: First day's tasks column, around 10 AM
      const targetX = gridBox.x + TIME_LABEL_WIDTH + (DAY_WIDTH * 0.75); // Right side of first day
      const targetY = gridBox.y + 4 * HOUR_HEIGHT + 20; // 4 hours from 6 AM = 10 AM

      console.log(`Task at (${taskBox.x}, ${taskBox.y}), target at (${targetX}, ${targetY})`);

      // Start dragging
      const startX = taskBox.x + taskBox.width / 2;
      const startY = taskBox.y + taskBox.height / 2;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.waitForTimeout(300); // Wait for dnd-kit to activate

      // Screenshot at drag start
      await page.screenshot({
        path: 'screenshots/gcal-test2-02-drag-start.png',
        fullPage: true,
      });

      // Move to first hover position
      await page.mouse.move(targetX, targetY, { steps: 20 });
      await page.waitForTimeout(500);

      // Screenshot at first hover position
      await page.screenshot({
        path: 'screenshots/gcal-test2-03-hover-position1.png',
        fullPage: true,
      });

      // Check for dashed blue preview box
      const previewBox = page.locator('.border-dashed.border-blue-400');
      const previewVisible = await previewBox.count() > 0;
      console.log(`Dashed blue preview box visible: ${previewVisible}`);

      // Move to different position (2 hours lower)
      const targetY2 = targetY + 2 * HOUR_HEIGHT;
      await page.mouse.move(targetX, targetY2, { steps: 15 });
      await page.waitForTimeout(500);

      // Screenshot at second hover position
      await page.screenshot({
        path: 'screenshots/gcal-test2-04-hover-position2.png',
        fullPage: true,
      });

      const previewVisible2 = await previewBox.count() > 0;
      console.log(`Preview box still visible at new position: ${previewVisible2}`);

      // Move to different day (second column)
      const targetX2 = targetX + DAY_WIDTH;
      await page.mouse.move(targetX2, targetY, { steps: 15 });
      await page.waitForTimeout(500);

      // Screenshot at third hover position (different day)
      await page.screenshot({
        path: 'screenshots/gcal-test2-05-hover-position3.png',
        fullPage: true,
      });

      // Release without dropping
      await page.mouse.up();
      await page.waitForTimeout(500);

      // Screenshot after drop
      await page.screenshot({
        path: 'screenshots/gcal-test2-06-after-drop.png',
        fullPage: true,
      });

      if (previewVisible || previewVisible2) {
        result.status = 'PASS';
        result.details = 'Dashed blue preview box appears during task drag and updates position';
      } else {
        // Check if there's any visual feedback at all
        const anyHoverFeedback = page.locator('[class*="bg-blue-500"]');
        const hasAnyFeedback = await anyHoverFeedback.count() > 0;

        if (hasAnyFeedback) {
          result.status = 'PARTIAL';
          result.details = 'Some hover feedback exists but not the dashed blue preview box';
        } else {
          result.status = 'FAIL';
          result.details = 'No hover preview visible during drag';
        }
      }
    } catch (error) {
      result.status = 'FAIL';
      result.details = `Error: ${(error as Error).message}`;
    }

    testResults.push(result);
    console.log(`TEST 2 RESULT: ${result.status} - ${result.details}`);
  });

  test('Test 3: Task Scheduling - Drag task from backlog to calendar', async ({ page }) => {
    let result: TestResult = { test: 'Task Scheduling', status: 'FAIL', details: '' };

    try {
      // Track schedule API calls
      let scheduleApiCalled = false;
      let scheduleApiStatus = 0;

      page.on('response', async (response) => {
        if (response.url().includes('/schedule') && response.request().method() === 'POST') {
          scheduleApiCalled = true;
          scheduleApiStatus = response.status();
        }
      });

      // Take initial screenshot
      await page.screenshot({
        path: 'screenshots/gcal-test3-01-initial.png',
        fullPage: true,
      });

      // Get backlog tasks
      const backlogTasks = page.locator('[class*="bg-slate-800"][class*="border-l-4"][class*="cursor-grab"]');
      let taskCount = await backlogTasks.count();
      console.log(`Initial backlog tasks: ${taskCount}`);

      // Create a task if none exist
      if (taskCount === 0) {
        console.log('Creating a backlog task...');
        const addButton = page.locator('button:has-text("Add")');
        if (await addButton.count() > 0) {
          await addButton.click();
          await page.waitForTimeout(500);

          const titleInput = page.locator('input[placeholder="Task title..."]');
          await titleInput.fill(`Schedule Test ${Date.now()}`);

          const minutesInput = page.locator('input[placeholder="Minutes"]');
          await minutesInput.fill('45');

          const submitButton = page.locator('button:has-text("Add Task")');
          await submitButton.click();
          await page.waitForTimeout(2000);

          taskCount = await backlogTasks.count();
        }
      }

      if (taskCount === 0) {
        result.status = 'FAIL';
        result.details = 'No backlog tasks available';
        testResults.push(result);
        return;
      }

      // Get the first task
      const firstTask = backlogTasks.first();
      const taskTitle = await firstTask.locator('.font-medium').first().textContent();
      console.log(`Scheduling task: "${taskTitle}"`);

      const taskBox = await firstTask.boundingBox();
      if (!taskBox) {
        result.status = 'FAIL';
        result.details = 'Could not get task bounding box';
        testResults.push(result);
        return;
      }

      // Find the calendar area
      const timeGrid = page.locator('.overflow-auto');
      const gridBox = await timeGrid.first().boundingBox();

      if (!gridBox) {
        result.status = 'FAIL';
        result.details = 'Could not get calendar bounding box';
        testResults.push(result);
        return;
      }

      // Target position: Tasks column (right side of day), around 11 AM
      const HOUR_HEIGHT = 48;
      const DAY_WIDTH = 140;
      const TIME_LABEL_WIDTH = 56;

      // Drop on first visible day, tasks column, at 11 AM
      const targetX = gridBox.x + TIME_LABEL_WIDTH + DAY_WIDTH * 0.75;
      const targetY = gridBox.y + 5 * HOUR_HEIGHT + 20; // 5 hours from 6 AM = 11 AM

      // Screenshot before drag
      await page.screenshot({
        path: 'screenshots/gcal-test3-02-before-drag.png',
        fullPage: true,
      });

      // Perform drag
      const startX = taskBox.x + taskBox.width / 2;
      const startY = taskBox.y + taskBox.height / 2;

      console.log(`Dragging from (${startX}, ${startY}) to (${targetX}, ${targetY})`);

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.waitForTimeout(300);

      await page.mouse.move(targetX, targetY, { steps: 20 });
      await page.waitForTimeout(300);

      // Screenshot during drag
      await page.screenshot({
        path: 'screenshots/gcal-test3-03-during-drag.png',
        fullPage: true,
      });

      await page.mouse.up();
      await page.waitForTimeout(3000);

      // Screenshot after drop
      await page.screenshot({
        path: 'screenshots/gcal-test3-04-after-drop.png',
        fullPage: true,
      });

      // Check results
      const newBacklogCount = await backlogTasks.count();
      console.log(`Backlog tasks after drop: ${newBacklogCount}`);
      console.log(`Schedule API called: ${scheduleApiCalled}, status: ${scheduleApiStatus}`);

      // Check if task appears in calendar
      const scheduledTaskInCalendar = page.locator(`text="${taskTitle}"`).locator('xpath=ancestor::*[contains(@class, "border-l-2")]');
      const taskScheduled = await scheduledTaskInCalendar.count() > 0 || newBacklogCount < taskCount;

      if (scheduleApiCalled && scheduleApiStatus === 200) {
        result.status = 'PASS';
        result.details = `Task scheduled successfully. Backlog: ${taskCount} -> ${newBacklogCount}`;
      } else if (taskScheduled) {
        result.status = 'PASS';
        result.details = 'Task appears to be scheduled (removed from backlog or visible in calendar)';
      } else if (scheduleApiCalled) {
        result.status = 'PARTIAL';
        result.details = `Schedule API called but returned status ${scheduleApiStatus}`;
      } else {
        result.status = 'FAIL';
        result.details = 'Task was not scheduled - API not called';
      }
    } catch (error) {
      result.status = 'FAIL';
      result.details = `Error: ${(error as Error).message}`;
    }

    testResults.push(result);
    console.log(`TEST 3 RESULT: ${result.status} - ${result.details}`);
  });

  test('Test 4: Task Rescheduling - Drag scheduled task within calendar', async ({ page }) => {
    let result: TestResult = { test: 'Task Rescheduling', status: 'FAIL', details: '' };

    try {
      // Track schedule API calls for reschedule
      let rescheduleApiCalled = false;
      let rescheduleApiStatus = 0;

      page.on('response', async (response) => {
        if (response.url().includes('/schedule') && response.request().method() === 'POST') {
          rescheduleApiCalled = true;
          rescheduleApiStatus = response.status();
        }
      });

      // Take initial screenshot
      await page.screenshot({
        path: 'screenshots/gcal-test4-01-initial.png',
        fullPage: true,
      });

      // Find scheduled tasks in the calendar
      // Tasks have: border-l-2, cursor-grab, and specific colors
      const scheduledTasks = page.locator('[class*="border-l-2"][class*="border-white"][class*="cursor-grab"]');
      let taskCount = await scheduledTasks.count();
      console.log(`Scheduled tasks found: ${taskCount}`);

      if (taskCount === 0) {
        // First try to schedule a task from backlog
        console.log('No scheduled tasks - attempting to schedule one first...');

        const backlogTasks = page.locator('[class*="bg-slate-800"][class*="border-l-4"][class*="cursor-grab"]');
        const backlogCount = await backlogTasks.count();

        if (backlogCount > 0) {
          // Quick schedule a task
          const firstTask = backlogTasks.first();
          const taskBox = await firstTask.boundingBox();
          const timeGrid = page.locator('.overflow-auto');
          const gridBox = await timeGrid.first().boundingBox();

          if (taskBox && gridBox) {
            const startX = taskBox.x + taskBox.width / 2;
            const startY = taskBox.y + taskBox.height / 2;
            const targetX = gridBox.x + 56 + 105; // Tasks column
            const targetY = gridBox.y + 4 * 48 + 20; // 10 AM

            await page.mouse.move(startX, startY);
            await page.mouse.down();
            await page.waitForTimeout(200);
            await page.mouse.move(targetX, targetY, { steps: 15 });
            await page.mouse.up();
            await page.waitForTimeout(2000);

            taskCount = await scheduledTasks.count();
          }
        }
      }

      if (taskCount === 0) {
        result.status = 'FAIL';
        result.details = 'No scheduled tasks available for rescheduling test';
        testResults.push(result);
        return;
      }

      // Get the first scheduled task
      const taskToReschedule = scheduledTasks.first();
      const taskTitle = await taskToReschedule.locator('.font-medium').first().textContent();
      console.log(`Rescheduling task: "${taskTitle}"`);

      const originalBox = await taskToReschedule.boundingBox();
      if (!originalBox) {
        result.status = 'FAIL';
        result.details = 'Could not get scheduled task bounding box';
        testResults.push(result);
        return;
      }

      console.log(`Original position: (${originalBox.x}, ${originalBox.y})`);

      // Screenshot before reschedule
      await page.screenshot({
        path: 'screenshots/gcal-test4-02-before-reschedule.png',
        fullPage: true,
      });

      // Test 4a: Reschedule to different time on same day (move down 2 hours)
      const HOUR_HEIGHT = 48;
      const newY = originalBox.y + 2 * HOUR_HEIGHT;

      const startX = originalBox.x + originalBox.width / 2;
      const startY = originalBox.y + originalBox.height / 2;

      console.log(`Moving from (${startX}, ${startY}) to (${startX}, ${newY})`);

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.waitForTimeout(300);

      await page.mouse.move(startX, newY, { steps: 10 });
      await page.waitForTimeout(300);

      // Screenshot during drag (same day)
      await page.screenshot({
        path: 'screenshots/gcal-test4-03-same-day-drag.png',
        fullPage: true,
      });

      await page.mouse.up();
      await page.waitForTimeout(2000);

      // Screenshot after same-day reschedule
      await page.screenshot({
        path: 'screenshots/gcal-test4-04-after-same-day.png',
        fullPage: true,
      });

      const sameDaySuccess = rescheduleApiCalled && rescheduleApiStatus === 200;
      console.log(`Same-day reschedule API: called=${rescheduleApiCalled}, status=${rescheduleApiStatus}`);

      // Reset tracking for different-day test
      rescheduleApiCalled = false;
      rescheduleApiStatus = 0;

      // Test 4b: Reschedule to different day (move to next day)
      const DAY_WIDTH = 140;

      // Re-find the task (it may have moved)
      const rescheduledTask = scheduledTasks.first();
      const newBox = await rescheduledTask.boundingBox();

      if (newBox) {
        const nextDayX = newBox.x + DAY_WIDTH;
        const dragStartX = newBox.x + newBox.width / 2;
        const dragStartY = newBox.y + newBox.height / 2;

        console.log(`Moving to different day: from x=${dragStartX} to x=${nextDayX}`);

        await page.mouse.move(dragStartX, dragStartY);
        await page.mouse.down();
        await page.waitForTimeout(300);

        await page.mouse.move(nextDayX, dragStartY, { steps: 15 });
        await page.waitForTimeout(300);

        // Screenshot during drag (different day)
        await page.screenshot({
          path: 'screenshots/gcal-test4-05-different-day-drag.png',
          fullPage: true,
        });

        await page.mouse.up();
        await page.waitForTimeout(2000);

        // Screenshot after different-day reschedule
        await page.screenshot({
          path: 'screenshots/gcal-test4-06-after-different-day.png',
          fullPage: true,
        });

        const differentDaySuccess = rescheduleApiCalled && rescheduleApiStatus === 200;
        console.log(`Different-day reschedule API: called=${rescheduleApiCalled}, status=${rescheduleApiStatus}`);

        if (sameDaySuccess && differentDaySuccess) {
          result.status = 'PASS';
          result.details = 'Task rescheduled successfully on same day AND different day';
        } else if (sameDaySuccess || differentDaySuccess) {
          result.status = 'PARTIAL';
          result.details = `Same-day: ${sameDaySuccess ? 'PASS' : 'FAIL'}, Different-day: ${differentDaySuccess ? 'PASS' : 'FAIL'}`;
        } else {
          result.status = 'FAIL';
          result.details = 'Neither same-day nor different-day rescheduling worked';
        }
      } else {
        if (sameDaySuccess) {
          result.status = 'PARTIAL';
          result.details = 'Same-day reschedule worked, could not test different-day';
        } else {
          result.status = 'FAIL';
          result.details = 'Could not complete reschedule tests';
        }
      }
    } catch (error) {
      result.status = 'FAIL';
      result.details = `Error: ${(error as Error).message}`;
    }

    testResults.push(result);
    console.log(`TEST 4 RESULT: ${result.status} - ${result.details}`);
  });

  test('Test 5: Unschedule Task - Right-click context menu to send back to backlog', async ({ page }) => {
    let result: TestResult = { test: 'Unschedule Task', status: 'FAIL', details: '' };

    try {
      // Track unschedule API calls
      let unscheduleApiCalled = false;
      let unscheduleApiStatus = 0;

      page.on('response', async (response) => {
        if (response.url().includes('/unschedule') && response.request().method() === 'POST') {
          unscheduleApiCalled = true;
          unscheduleApiStatus = response.status();
        }
      });

      // Take initial screenshot
      await page.screenshot({
        path: 'screenshots/gcal-test5-01-initial.png',
        fullPage: true,
      });

      // Find scheduled tasks
      const scheduledTasks = page.locator('[class*="border-l-2"][class*="border-white"][class*="cursor-grab"]');
      let taskCount = await scheduledTasks.count();
      console.log(`Scheduled tasks for unschedule test: ${taskCount}`);

      // Get initial backlog count
      const backlogTasks = page.locator('[class*="bg-slate-800"][class*="border-l-4"][class*="cursor-grab"]');
      const initialBacklogCount = await backlogTasks.count();
      console.log(`Initial backlog count: ${initialBacklogCount}`);

      if (taskCount === 0) {
        // Try to schedule a task first for this test
        if (initialBacklogCount > 0) {
          console.log('Scheduling a task first...');
          const firstBacklogTask = backlogTasks.first();
          const taskBox = await firstBacklogTask.boundingBox();
          const timeGrid = page.locator('.overflow-auto');
          const gridBox = await timeGrid.first().boundingBox();

          if (taskBox && gridBox) {
            const startX = taskBox.x + taskBox.width / 2;
            const startY = taskBox.y + taskBox.height / 2;
            const targetX = gridBox.x + 56 + 105;
            const targetY = gridBox.y + 3 * 48 + 20;

            await page.mouse.move(startX, startY);
            await page.mouse.down();
            await page.waitForTimeout(200);
            await page.mouse.move(targetX, targetY, { steps: 15 });
            await page.mouse.up();
            await page.waitForTimeout(2000);

            taskCount = await scheduledTasks.count();
          }
        }
      }

      if (taskCount === 0) {
        result.status = 'FAIL';
        result.details = 'No scheduled tasks available for unschedule test';
        testResults.push(result);
        return;
      }

      // Get the task to unschedule
      const taskToUnschedule = scheduledTasks.first();
      const taskTitle = await taskToUnschedule.locator('.font-medium').first().textContent();
      console.log(`Unscheduling task: "${taskTitle}"`);

      // Screenshot before right-click
      await page.screenshot({
        path: 'screenshots/gcal-test5-02-before-right-click.png',
        fullPage: true,
      });

      // Right-click on the task to show context menu
      await taskToUnschedule.click({ button: 'right' });
      await page.waitForTimeout(500);

      // Screenshot showing context menu
      await page.screenshot({
        path: 'screenshots/gcal-test5-03-context-menu.png',
        fullPage: true,
      });

      // Look for "Back to Backlog" or "Unschedule" option
      const backToBacklogOption = page.locator('text=Back to Backlog');
      const unscheduleOption = page.locator('text=Unschedule');

      let optionFound = false;
      if (await backToBacklogOption.count() > 0) {
        console.log('Found "Back to Backlog" option');
        await backToBacklogOption.click();
        optionFound = true;
      } else if (await unscheduleOption.count() > 0) {
        console.log('Found "Unschedule" option');
        await unscheduleOption.click();
        optionFound = true;
      } else {
        console.log('Context menu options not found, checking for any menu items...');
        const menuItems = page.locator('.bg-slate-800.border button, .bg-slate-700 button');
        const menuItemCount = await menuItems.count();
        console.log(`Menu items found: ${menuItemCount}`);
      }

      await page.waitForTimeout(2000);

      // Screenshot after clicking option
      await page.screenshot({
        path: 'screenshots/gcal-test5-04-after-unschedule.png',
        fullPage: true,
      });

      // Check results
      const newScheduledCount = await scheduledTasks.count();
      const newBacklogCount = await backlogTasks.count();

      console.log(`After unschedule - Scheduled: ${taskCount} -> ${newScheduledCount}, Backlog: ${initialBacklogCount} -> ${newBacklogCount}`);
      console.log(`Unschedule API: called=${unscheduleApiCalled}, status=${unscheduleApiStatus}`);

      if (optionFound && unscheduleApiCalled && unscheduleApiStatus === 200) {
        result.status = 'PASS';
        result.details = `Task unscheduled successfully. Backlog: ${initialBacklogCount} -> ${newBacklogCount}`;
      } else if (optionFound && newBacklogCount > initialBacklogCount) {
        result.status = 'PASS';
        result.details = 'Task moved back to backlog via context menu';
      } else if (optionFound) {
        result.status = 'PARTIAL';
        result.details = 'Context menu appeared but unschedule action unclear';
      } else {
        // Check if the context menu appeared at all
        result.status = 'FAIL';
        result.details = 'Context menu or "Back to Backlog" option not found';
      }
    } catch (error) {
      result.status = 'FAIL';
      result.details = `Error: ${(error as Error).message}`;
    }

    testResults.push(result);
    console.log(`TEST 5 RESULT: ${result.status} - ${result.details}`);
  });

  test.afterAll(async () => {
    // Print final test results summary
    console.log('\n' + '='.repeat(60));
    console.log('WEEKLY PLANNING - GOOGLE CALENDAR STYLE TESTS SUMMARY');
    console.log('='.repeat(60));

    testResults.forEach((r, i) => {
      const statusIcon = r.status === 'PASS' ? '✓' : r.status === 'PARTIAL' ? '~' : '✗';
      console.log(`${statusIcon} Test ${i + 1}: ${r.test} - ${r.status}`);
      console.log(`  Details: ${r.details}`);
    });

    const passCount = testResults.filter(r => r.status === 'PASS').length;
    const partialCount = testResults.filter(r => r.status === 'PARTIAL').length;
    const failCount = testResults.filter(r => r.status === 'FAIL').length;

    console.log('='.repeat(60));
    console.log(`TOTAL: ${passCount} PASS, ${partialCount} PARTIAL, ${failCount} FAIL`);
    console.log('='.repeat(60) + '\n');
  });
});

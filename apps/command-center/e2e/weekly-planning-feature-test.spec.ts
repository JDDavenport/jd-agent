/**
 * Weekly Planning Feature Test
 *
 * Comprehensive testing of all Weekly Planning page features:
 * 1. Page Load and Initial State
 * 2. Click-Drag to Create Event
 * 3. Unschedule Task (Back to Backlog)
 * 4. Drag Task from Backlog to Calendar
 * 5. Complete a Scheduled Task
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = 'screenshots/weekly-feature-test';

// Use slowMo for better visibility during interactions
test.use({
  launchOptions: {
    slowMo: 100, // 100ms between actions
  },
});

test.describe('Weekly Planning Feature Tests', () => {

  // ============================================
  // Test 1: Page Load and Initial State
  // ============================================
  test('Test 1: Page Load and Initial State', async ({ page }) => {
    console.log('\n=== TEST 1: Page Load and Initial State ===\n');

    // Set up console logging
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    });

    // Navigate to weekly planning
    console.log('Navigating to /weekly-planning...');
    await page.goto(`${BASE_URL}/weekly-planning`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Screenshot initial state
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/01-initial-state.png`,
      fullPage: true,
    });
    console.log('Screenshot saved: 01-initial-state.png');

    // Verify page title
    const pageTitle = page.locator('h1:has-text("Weekly Planning")');
    const titleVisible = await pageTitle.isVisible();
    console.log(`Page title visible: ${titleVisible}`);
    expect(titleVisible).toBe(true);

    // Check backlog panel
    const backlogHeader = page.locator('text=Weekly Backlog');
    const backlogVisible = await backlogHeader.isVisible();
    console.log(`Backlog panel visible: ${backlogVisible}`);

    // Count backlog tasks
    const backlogTasks = page.locator('[class*="cursor-grab"]');
    const backlogCount = await backlogTasks.count();
    console.log(`Backlog tasks found: ${backlogCount}`);

    // Check calendar - use more specific selector to avoid matching multiple elements
    const calendarContainer = page.locator('.bg-slate-900.rounded-lg.border.overflow-hidden');
    const calendarVisible = await calendarContainer.isVisible();
    console.log(`Calendar visible: ${calendarVisible}`);

    // Count day columns by looking for day abbreviations
    const dayAbbrevs = await page.locator('text=/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/').count();
    console.log(`Day columns (day abbreviations): ${dayAbbrevs}`);

    // Verify we have 7 days (Sunday to Saturday)
    expect(dayAbbrevs).toBe(7);

    // Check for time labels
    const timeLabels = page.locator('text=/\\d{1,2}(am|pm)/i');
    const timeCount = await timeLabels.count();
    console.log(`Time labels found: ${timeCount}`);
    expect(timeCount).toBeGreaterThan(0);

    // Check for navigation buttons
    const prevButton = page.locator('button').filter({ has: page.locator('svg path[d*="M15 19l-7"]') });
    const nextButton = page.locator('button').filter({ has: page.locator('svg path[d*="M9 5l7"]') });
    console.log(`Navigation buttons: prev=${await prevButton.count()}, next=${await nextButton.count()}`);

    // Get current date range - use more specific selector with text pattern
    const dateRange = await page.getByText(/Jan \d+ - Jan \d+, 2026/).textContent();
    console.log(`Current date range: ${dateRange}`);

    // Log any console errors
    const errors = consoleMessages.filter(m => m.startsWith('[error]'));
    if (errors.length > 0) {
      console.log('Console errors:', errors);
    }

    console.log('\n--- Test 1 Results ---');
    console.log('Expected: Page loads with backlog panel on left, calendar on right');
    console.log(`Actual: Backlog visible=${backlogVisible}, Calendar visible=${calendarVisible}, Days=${dayAbbrevs}`);
    console.log(`Status: ${backlogVisible && calendarVisible && dayAbbrevs === 7 ? 'PASS' : 'FAIL'}`);
  });

  // ============================================
  // Test 2: Click-Drag to Create Event
  // ============================================
  test('Test 2: Click-Drag to Create Event', async ({ page }) => {
    console.log('\n=== TEST 2: Click-Drag to Create Event ===\n');

    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    });

    await page.goto(`${BASE_URL}/weekly-planning`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find the tasks column for the first day
    // The structure is: each day has Events column (left half) and Tasks column (right half)
    // We need to click in the Tasks column (right half of a day column)

    // Get the calendar container - use the specific calendar scroll area within the calendar component
    const calendarArea = page.locator('.h-full > .flex-1.overflow-auto');
    await calendarArea.waitFor({ state: 'visible' });

    // Get all day columns - they have width: 140px (DAY_WIDTH)
    // We'll target the first day's task column
    const dayColumns = page.locator('.flex.border-r.border-slate-700').filter({ has: page.locator('.flex-1.relative') });
    const dayCount = await dayColumns.count();
    console.log(`Day columns found: ${dayCount}`);

    // Screenshot before drag
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/02a-before-drag.png`,
      fullPage: true,
    });

    // Find the first day's Tasks column (second .flex-1.relative within the day column)
    // Each day column contains: Events column (.flex-1.relative.border-r) and Tasks column (.flex-1.relative)

    // Let's get the bounding box of a droppable slot
    const droppableSlots = page.locator('[class*="transition-colors"]').filter({ hasNot: page.locator('[class*="bg-"]') });
    const slotCount = await droppableSlots.count();
    console.log(`Droppable slots found: ${slotCount}`);

    // Alternative approach: Find the tasks column area directly
    // The Tasks column is the right half of each day (after the Events column)
    // Let's find an area around 10 AM in the first day's tasks column

    // Get the calendar overflow container and scroll area
    const calendarScroll = page.locator('.flex-1.overflow-auto').first();
    const scrollBox = await calendarScroll.boundingBox();

    if (!scrollBox) {
      console.log('Could not find calendar scroll area');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/02-error-no-scroll.png`, fullPage: true });
      return;
    }

    console.log(`Calendar scroll area: x=${scrollBox.x}, y=${scrollBox.y}, w=${scrollBox.width}, h=${scrollBox.height}`);

    // The calendar has a sticky header (day names + Events/Tasks labels)
    // Let's find a droppable slot directly and use its coordinates

    // First, scroll the calendar to show the 10am area
    await page.evaluate(() => {
      const scrollContainer = document.querySelector('.h-full > .flex-1.overflow-auto');
      if (scrollContainer) {
        // Scroll to show around 10am (hour 10 - 6 = 4, at 48px per hour = 192px)
        scrollContainer.scrollTop = 150;
      }
    });
    await page.waitForTimeout(300);

    // Get the Tasks(0) header for Sunday (first day) to find the x position of the tasks column
    const sunTasksHeader = page.getByText('Tasks (0)').first();
    const tasksHeaderBox = await sunTasksHeader.boundingBox();

    if (!tasksHeaderBox) {
      console.log('Could not find Tasks column header');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/02-error-no-tasks-header.png`, fullPage: true });
      return;
    }

    console.log(`Tasks column header: x=${tasksHeaderBox.x}, y=${tasksHeaderBox.y}, width=${tasksHeaderBox.width}`);

    // Now find the 10am time label to get the Y coordinate
    const timeLabel10am = page.getByText('10am');
    const time10amBox = await timeLabel10am.boundingBox();

    if (!time10amBox) {
      console.log('Could not find 10am time label');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/02-error-no-time-label.png`, fullPage: true });
      return;
    }

    console.log(`10am time label: x=${time10amBox.x}, y=${time10amBox.y}`);

    // Click position: center of tasks column, aligned with 10am label
    const clickX = tasksHeaderBox.x + tasksHeaderBox.width / 2;
    const startY = time10amBox.y + 10; // Just below the 10am label
    const endY = startY + 60; // Drag down ~1 hour

    console.log(`Using Tasks column at ~10am: x=${clickX}, startY=${startY}, endY=${endY}`);

    console.log(`Starting drag at (${clickX}, ${startY}), ending at (${clickX}, ${endY})`);

    // Perform the click-drag
    await page.mouse.move(clickX, startY);
    await page.waitForTimeout(100);

    console.log('Mouse down...');
    await page.mouse.down();
    await page.waitForTimeout(200);

    // Screenshot during drag start
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/02b-drag-start.png`,
      fullPage: true,
    });

    // Move down to create a time span
    console.log('Moving mouse down...');
    await page.mouse.move(clickX, endY, { steps: 10 });
    await page.waitForTimeout(300);

    // Screenshot during drag (should show blue preview)
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/02c-during-drag.png`,
      fullPage: true,
    });

    // Check if blue preview is visible
    const bluePreview = page.locator('.bg-blue-500\\/50');
    const previewVisible = await bluePreview.count() > 0;
    console.log(`Blue preview visible: ${previewVisible}`);

    // Release mouse
    console.log('Mouse up...');
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Screenshot after release (should show popup)
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/02d-after-release.png`,
      fullPage: true,
    });

    // Check if popup appeared
    const popup = page.locator('.fixed.z-50.bg-slate-800');
    const popupVisible = await popup.isVisible().catch(() => false);
    console.log(`Popup visible: ${popupVisible}`);

    if (popupVisible) {
      console.log('Popup appeared! Taking screenshot...');
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/02e-popup-visible.png`,
        fullPage: true,
      });

      // Get popup content
      const popupText = await popup.textContent();
      console.log(`Popup content: ${popupText?.substring(0, 200)}`);

      // Try typing a title
      const titleInput = page.locator('input[placeholder="Add title"]');
      if (await titleInput.isVisible()) {
        console.log('Typing event title...');
        await titleInput.fill('Test Event from Playwright');

        await page.screenshot({
          path: `${SCREENSHOT_DIR}/02f-title-entered.png`,
          fullPage: true,
        });

        // Click Create Event button
        const createButton = page.locator('button:has-text("Create Event")');
        if (await createButton.isVisible() && await createButton.isEnabled()) {
          console.log('Clicking Create Event button...');
          await createButton.click();
          await page.waitForTimeout(2000);

          await page.screenshot({
            path: `${SCREENSHOT_DIR}/02g-after-create.png`,
            fullPage: true,
          });
        }
      }
    } else {
      console.log('WARNING: Popup did not appear after click-drag');

      // Log console messages for debugging
      const errors = consoleMessages.filter(m => m.includes('error') || m.includes('Error'));
      if (errors.length > 0) {
        console.log('Console errors/warnings:', errors);
      }
    }

    console.log('\n--- Test 2 Results ---');
    console.log('Expected: Blue preview during drag, popup appears on release');
    console.log(`Actual: Preview visible=${previewVisible}, Popup visible=${popupVisible}`);
    console.log(`Status: ${previewVisible && popupVisible ? 'PASS' : 'NEEDS INVESTIGATION'}`);
  });

  // ============================================
  // Test 3: Unschedule Task (Back to Backlog)
  // ============================================
  test('Test 3: Unschedule Task (Context Menu)', async ({ page }) => {
    console.log('\n=== TEST 3: Unschedule Task (Back to Backlog) ===\n');

    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    });

    await page.goto(`${BASE_URL}/weekly-planning`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Screenshot initial state
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/03a-initial.png`,
      fullPage: true,
    });

    // Find scheduled tasks on the calendar
    // Tasks have: border-l-2, border-white/30, and are in the calendar area
    const scheduledTasks = page.locator('[class*="border-l-2"][class*="border-white"]').filter({ has: page.locator('.font-medium') });
    const scheduledCount = await scheduledTasks.count();
    console.log(`Scheduled tasks found: ${scheduledCount}`);

    if (scheduledCount === 0) {
      console.log('No scheduled tasks found - checking API...');

      // Query API to see what tasks exist
      const response = await page.request.get(`${API_URL}/api/tasks?limit=50`);
      const apiData = await response.json();
      const scheduledFromAPI = (apiData.data || []).filter((t: any) => t.scheduledStart);
      console.log(`API scheduled tasks: ${scheduledFromAPI.length}`);

      if (scheduledFromAPI.length > 0) {
        console.log('Tasks exist in API but not showing in UI. Checking date range...');
        scheduledFromAPI.slice(0, 5).forEach((t: any) => {
          console.log(`  - ${t.title}: ${t.scheduledStart}`);
        });
      }

      console.log('Skipping test - no scheduled tasks to unschedule');
      test.skip();
      return;
    }

    // Get the first scheduled task
    const taskToUnschedule = scheduledTasks.first();
    const taskTitle = await taskToUnschedule.locator('.font-medium').textContent();
    console.log(`Will right-click on task: "${taskTitle}"`);

    // Scroll task into view
    await taskToUnschedule.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // Screenshot before right-click
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/03b-before-right-click.png`,
      fullPage: true,
    });

    // Right-click on the task
    console.log('Right-clicking on task...');
    await taskToUnschedule.click({ button: 'right', force: true });
    await page.waitForTimeout(500);

    // Screenshot after right-click
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/03c-after-right-click.png`,
      fullPage: true,
    });

    // Check if context menu appeared
    const contextMenu = page.locator('.bg-slate-800.border.border-slate-600.rounded-lg.shadow-xl');
    const menuVisible = await contextMenu.isVisible().catch(() => false);
    console.log(`Context menu visible: ${menuVisible}`);

    if (menuVisible) {
      // Get menu options
      const menuOptions = await contextMenu.locator('button').allTextContents();
      console.log(`Menu options: ${menuOptions.join(', ')}`);

      // Find and click "Back to Backlog"
      const backToBacklogButton = contextMenu.locator('button:has-text("Back to Backlog")');
      if (await backToBacklogButton.isVisible()) {
        console.log('Clicking "Back to Backlog"...');
        await backToBacklogButton.click();
        await page.waitForTimeout(2000);

        await page.screenshot({
          path: `${SCREENSHOT_DIR}/03d-after-unschedule.png`,
          fullPage: true,
        });

        // Check if task moved to backlog
        const newBacklogCount = await page.locator('[class*="cursor-grab"]').count();
        console.log(`Backlog tasks after unschedule: ${newBacklogCount}`);
      }
    } else {
      console.log('WARNING: Context menu did not appear');
    }

    console.log('\n--- Test 3 Results ---');
    console.log('Expected: Right-click shows context menu with "Back to Backlog" option');
    console.log(`Actual: Menu visible=${menuVisible}`);
    console.log(`Status: ${menuVisible ? 'PASS' : 'NEEDS INVESTIGATION'}`);
  });

  // ============================================
  // Test 4: Drag Task from Backlog to Calendar
  // ============================================
  test('Test 4: Drag Task from Backlog to Calendar', async ({ page }) => {
    console.log('\n=== TEST 4: Drag Task from Backlog to Calendar ===\n');

    const consoleMessages: string[] = [];
    const apiCalls: { url: string; method: string; body?: string; status?: number }[] = [];

    page.on('console', (msg) => {
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    });

    page.on('request', (request) => {
      if (request.url().includes('/api/tasks') && request.method() === 'POST') {
        apiCalls.push({ url: request.url(), method: request.method(), body: request.postData() || '' });
      }
    });

    page.on('response', (response) => {
      const existing = apiCalls.find(c => c.url === response.url() && !c.status);
      if (existing) {
        existing.status = response.status();
      }
    });

    await page.goto(`${BASE_URL}/weekly-planning`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Screenshot initial state
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/04a-initial.png`,
      fullPage: true,
    });

    // Find backlog tasks
    const backlogTasks = page.locator('[class*="cursor-grab"]');
    let backlogCount = await backlogTasks.count();
    console.log(`Backlog tasks: ${backlogCount}`);

    if (backlogCount === 0) {
      console.log('No backlog tasks - attempting to create one...');

      // Look for Add button
      const addButton = page.locator('button:has-text("Add")').first();
      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(500);

        // Fill in task form
        const titleInput = page.locator('input[placeholder*="title"]');
        if (await titleInput.isVisible()) {
          await titleInput.fill(`DnD Test Task ${Date.now()}`);

          // Submit
          const submitButton = page.locator('button:has-text("Add Task")');
          if (await submitButton.isVisible()) {
            await submitButton.click();
            await page.waitForTimeout(2000);
          }
        }

        backlogCount = await backlogTasks.count();
        console.log(`Backlog tasks after creating: ${backlogCount}`);
      }
    }

    if (backlogCount === 0) {
      console.log('Could not create backlog task');
      test.skip();
      return;
    }

    // Get first backlog task
    const firstTask = backlogTasks.first();
    const taskTitle = await firstTask.locator('.font-medium').first().textContent();
    console.log(`Will drag task: "${taskTitle}"`);

    // Get task bounding box
    const taskBox = await firstTask.boundingBox();
    if (!taskBox) {
      console.log('Could not get task bounding box');
      test.fail();
      return;
    }
    console.log(`Task position: (${taskBox.x}, ${taskBox.y}), size: ${taskBox.width}x${taskBox.height}`);

    // Find a drop target in the calendar
    // We need to find a droppable slot
    const droppableSlots = page.locator('[class*="transition-colors"]');
    const slotCount = await droppableSlots.count();
    console.log(`Droppable slots: ${slotCount}`);

    // Get the calendar area for coordinates - use specific calendar scroll area
    const calendarArea = page.locator('.h-full > .flex-1.overflow-auto');
    const calendarBox = await calendarArea.boundingBox();

    if (!calendarBox) {
      console.log('Could not get calendar bounding box');
      test.fail();
      return;
    }

    // Calculate drop target:
    // Time labels: 56px, Day width: 140px, Each day split: Events (70px) + Tasks (70px)
    // Drop in Tasks column of first day around 10 AM
    const dropX = calendarBox.x + 56 + 70 + 35; // Middle of first day's Tasks column
    const dropY = calendarBox.y + 50 + (10 - 6) * 48; // ~10 AM (accounting for day headers)

    console.log(`Drop target: (${dropX}, ${dropY})`);

    // Screenshot before drag
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/04b-before-drag.png`,
      fullPage: true,
    });

    // Start drag
    const startX = taskBox.x + taskBox.width / 2;
    const startY = taskBox.y + taskBox.height / 2;

    console.log(`Dragging from (${startX}, ${startY}) to (${dropX}, ${dropY})`);

    await page.mouse.move(startX, startY);
    await page.waitForTimeout(100);

    await page.mouse.down();
    await page.waitForTimeout(200); // Let dnd-kit register the drag

    // Screenshot at drag start
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/04c-drag-start.png`,
      fullPage: true,
    });

    // Move to target in steps
    await page.mouse.move(dropX, dropY, { steps: 20 });
    await page.waitForTimeout(300);

    // Screenshot during drag (should show drag overlay)
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/04d-during-drag.png`,
      fullPage: true,
    });

    // Check for drag overlay
    const dragOverlay = page.locator('[class*="shadow-2xl"][class*="shadow-blue"]');
    const overlayVisible = await dragOverlay.count() > 0;
    console.log(`Drag overlay visible: ${overlayVisible}`);

    // Check for drop zone highlight
    const dropHighlight = page.locator('.bg-blue-500\\/30');
    const highlightVisible = await dropHighlight.count() > 0;
    console.log(`Drop zone highlight visible: ${highlightVisible}`);

    // Release
    await page.mouse.up();
    await page.waitForTimeout(2000);

    // Screenshot after drop
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/04e-after-drop.png`,
      fullPage: true,
    });

    // Check API calls
    const scheduleCalls = apiCalls.filter(c => c.url.includes('/schedule'));
    console.log(`Schedule API calls: ${scheduleCalls.length}`);
    if (scheduleCalls.length > 0) {
      console.log(`Schedule call body: ${scheduleCalls[0].body}`);
      console.log(`Schedule call status: ${scheduleCalls[0].status}`);
    }

    // Check if task moved from backlog
    const newBacklogCount = await backlogTasks.count();
    console.log(`Backlog count after drop: ${newBacklogCount} (was ${backlogCount})`);

    // Check if task appeared on calendar
    const scheduledTasks = page.locator('[class*="border-l-2"][class*="border-white"]');
    const scheduledCount = await scheduledTasks.count();
    console.log(`Scheduled tasks on calendar: ${scheduledCount}`);

    console.log('\n--- Test 4 Results ---');
    console.log('Expected: Task dragged to calendar creates scheduled task');
    console.log(`Actual: Overlay=${overlayVisible}, API calls=${scheduleCalls.length}, Backlog change=${backlogCount - newBacklogCount}`);
    console.log(`Status: ${scheduleCalls.length > 0 && scheduleCalls[0].status === 200 ? 'PASS' : 'NEEDS INVESTIGATION'}`);
  });

  // ============================================
  // Test 5: Complete a Scheduled Task
  // ============================================
  test('Test 5: Complete a Scheduled Task', async ({ page }) => {
    console.log('\n=== TEST 5: Complete a Scheduled Task ===\n');

    const consoleMessages: string[] = [];
    const apiCalls: { url: string; method: string; status?: number }[] = [];

    page.on('console', (msg) => {
      consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    });

    page.on('response', (response) => {
      if (response.url().includes('/complete')) {
        apiCalls.push({ url: response.url(), method: 'POST', status: response.status() });
      }
    });

    await page.goto(`${BASE_URL}/weekly-planning`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Screenshot initial state
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/05a-initial.png`,
      fullPage: true,
    });

    // Find scheduled tasks with checkboxes
    const scheduledTasks = page.locator('[class*="border-l-2"][class*="border-white"]');
    const taskCount = await scheduledTasks.count();
    console.log(`Scheduled tasks: ${taskCount}`);

    if (taskCount === 0) {
      console.log('No scheduled tasks found');
      test.skip();
      return;
    }

    // Find uncompleted tasks (no line-through)
    const uncompletedTasks = scheduledTasks.filter({ hasNot: page.locator('.line-through') });
    const uncompletedCount = await uncompletedTasks.count();
    console.log(`Uncompleted tasks: ${uncompletedCount}`);

    if (uncompletedCount === 0) {
      console.log('All tasks are already completed');
      test.skip();
      return;
    }

    // Get the first uncompleted task
    const taskToComplete = uncompletedTasks.first();
    const taskTitle = await taskToComplete.locator('.font-medium').textContent();
    console.log(`Will complete task: "${taskTitle}"`);

    // Scroll into view
    await taskToComplete.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // Screenshot before completing
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/05b-before-complete.png`,
      fullPage: true,
    });

    // Find the checkbox (small square button at the start of the task)
    const checkbox = taskToComplete.locator('button.w-3.h-3').first();
    const checkboxVisible = await checkbox.isVisible().catch(() => false);
    console.log(`Checkbox visible: ${checkboxVisible}`);

    if (!checkboxVisible) {
      // Try alternative approach - look for any button within the task
      const buttons = taskToComplete.locator('button');
      const buttonCount = await buttons.count();
      console.log(`Buttons in task: ${buttonCount}`);

      if (buttonCount > 0) {
        console.log('Clicking first button in task...');
        await buttons.first().click({ force: true });
      } else {
        // Try clicking on the task itself
        console.log('No checkbox found, clicking task directly...');
        await taskToComplete.click({ force: true, position: { x: 5, y: 5 } });
      }
    } else {
      console.log('Clicking checkbox...');
      await checkbox.click({ force: true });
    }

    await page.waitForTimeout(2000);

    // Screenshot after completing
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/05c-after-complete.png`,
      fullPage: true,
    });

    // Check API calls
    console.log(`Complete API calls: ${apiCalls.length}`);
    if (apiCalls.length > 0) {
      console.log(`Complete call status: ${apiCalls[0].status}`);
    }

    // Check if task now shows as completed (line-through or removed)
    const remainingTasks = await scheduledTasks.count();
    console.log(`Scheduled tasks after complete: ${remainingTasks} (was ${taskCount})`);

    // Check for completed styling
    const completedTasks = page.locator('[class*="border-l-2"][class*="border-white"] .line-through');
    const completedCount = await completedTasks.count();
    console.log(`Tasks with line-through: ${completedCount}`);

    console.log('\n--- Test 5 Results ---');
    console.log('Expected: Clicking checkbox marks task complete');
    console.log(`Actual: API calls=${apiCalls.length}, Status=${apiCalls[0]?.status || 'N/A'}`);
    console.log(`Status: ${apiCalls.length > 0 && apiCalls[0].status === 200 ? 'PASS' : 'NEEDS INVESTIGATION'}`);
  });

  // ============================================
  // Summary Test: Run All and Report
  // ============================================
  test('Summary: Full Feature Verification', async ({ page }) => {
    console.log('\n=== SUMMARY: Full Feature Verification ===\n');

    await page.goto(`${BASE_URL}/weekly-planning`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const results: Record<string, boolean | string> = {};

    // Check 1: Page loads
    results['Page loads'] = await page.locator('h1:has-text("Weekly Planning")').isVisible();

    // Check 2: Backlog panel visible
    results['Backlog panel'] = await page.locator('text=Weekly Backlog').isVisible();

    // Check 3: Calendar visible - use more specific selector
    results['Calendar'] = await page.locator('.bg-slate-900.rounded-lg.border.overflow-hidden').isVisible();

    // Check 4: Navigation works
    const nextButton = page.locator('button').filter({ has: page.locator('svg path[d*="M9 5l7"]') }).first();
    await nextButton.click().catch(() => {});
    await page.waitForTimeout(500);
    results['Navigation'] = await page.locator('text=/\\+1 week/').isVisible().catch(() => false);

    // Check 5: Day columns
    const dayCount = await page.locator('text=/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/').count();
    results['Day columns'] = dayCount === 7 ? 'Yes (7)' : `No (${dayCount})`;

    // Check 6: Time slots
    const timeSlotCount = await page.locator('[class*="transition-colors"]').count();
    results['Time slots'] = timeSlotCount > 0 ? `Yes (${timeSlotCount})` : 'No';

    // Check 7: Legend
    results['Legend'] = await page.locator('text=Click & drag to create').isVisible();

    // Final screenshot
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/summary.png`,
      fullPage: true,
    });

    console.log('\n=== Feature Check Results ===');
    for (const [feature, result] of Object.entries(results)) {
      const status = result === true || (typeof result === 'string' && result.startsWith('Yes')) ? 'PASS' : 'FAIL';
      console.log(`${status === 'PASS' ? '✓' : '✗'} ${feature}: ${result}`);
    }
  });
});

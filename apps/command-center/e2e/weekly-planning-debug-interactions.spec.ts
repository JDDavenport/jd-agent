/**
 * Weekly Planning Debug Tests
 *
 * Tests the specific interactions to identify what's broken:
 * 1. Click-drag to create events in TASKS column
 * 2. Right-click context menu on scheduled tasks
 * 3. Drag from backlog to calendar
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:3000';

test.describe('Weekly Planning - Debug Interactions', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console logging
    page.on('console', (msg) => {
      console.log(`BROWSER [${msg.type()}]: ${msg.text()}`);
    });

    // Enable error logging
    page.on('pageerror', (error) => {
      console.log(`BROWSER ERROR: ${error.message}`);
    });

    // Navigate to weekly planning page
    await page.goto(`${BASE_URL}/weekly-planning`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Extra time for data loading
  });

  test('Test 1: Click-drag to create in TASKS column', async ({ page }) => {
    console.log('\n=== TEST 1: Click-drag to create ===\n');

    // Track network requests
    const networkRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/')) {
        networkRequests.push(`${request.method()} ${request.url()}`);
      }
    });

    // Take initial screenshot
    await page.screenshot({
      path: 'screenshots/debug-1a-initial.png',
      fullPage: true,
    });

    // Find the calendar area
    // The structure is: day column has two sub-columns - events (left) and tasks (right)
    // Look for a day column that is today (has bg-blue-900/10 class)
    const dayColumns = page.locator('.flex.border-r.border-slate-700');
    const dayCount = await dayColumns.count();
    console.log(`Found ${dayCount} day columns`);

    if (dayCount === 0) {
      console.log('ERROR: No day columns found');
      await page.screenshot({ path: 'screenshots/debug-1b-no-columns.png', fullPage: true });
      test.fail();
      return;
    }

    // Find the tasks column (right half of a day column)
    // Tasks columns have the droppable slots and task blocks
    // They're the second child of each day column
    const firstDayColumn = dayColumns.first();
    const tasksColumn = firstDayColumn.locator('> div').last(); // Right side is tasks

    const tasksBox = await tasksColumn.boundingBox();
    if (!tasksBox) {
      console.log('ERROR: Could not get tasks column bounding box');
      test.fail();
      return;
    }
    console.log(`Tasks column bounds: x=${tasksBox.x}, y=${tasksBox.y}, w=${tasksBox.width}, h=${tasksBox.height}`);

    // We need to find a clear area in the tasks column
    // Calculate position for ~10:00 AM (hour 10 - START_HOUR 6 = 4 hours, each hour is 48px)
    const HOUR_HEIGHT = 48;
    const START_HOUR = 6;
    const targetHour = 10;

    // Position relative to the column top
    const startY = tasksBox.y + (targetHour - START_HOUR) * HOUR_HEIGHT + 10;
    const endY = startY + 60; // Drag 60px down (about 1.5 hours)
    const centerX = tasksBox.x + tasksBox.width / 2;

    console.log(`Will click-drag from (${centerX}, ${startY}) to (${centerX}, ${endY})`);

    // Step 1: Move to start position
    await page.mouse.move(centerX, startY);
    await page.waitForTimeout(100);

    // Step 2: Mouse down
    console.log('Mouse down...');
    await page.mouse.down();
    await page.waitForTimeout(200);

    // Screenshot during drag start
    await page.screenshot({
      path: 'screenshots/debug-1c-drag-start.png',
      fullPage: true,
    });

    // Step 3: Move down (drag)
    console.log('Moving mouse down...');
    await page.mouse.move(centerX, endY, { steps: 10 });
    await page.waitForTimeout(500);

    // Screenshot during drag - CHECK FOR BLUE PREVIEW
    await page.screenshot({
      path: 'screenshots/debug-1d-during-drag-CHECK-BLUE-PREVIEW.png',
      fullPage: true,
    });

    // Check if blue preview appeared
    const bluePreview = page.locator('.bg-blue-500\\/50');
    const previewCount = await bluePreview.count();
    console.log(`Blue preview elements found: ${previewCount}`);

    // Step 4: Mouse up
    console.log('Mouse up...');
    await page.mouse.up();
    await page.waitForTimeout(1000);

    // Screenshot after mouseup - CHECK FOR POPUP
    await page.screenshot({
      path: 'screenshots/debug-1e-after-mouseup-CHECK-POPUP.png',
      fullPage: true,
    });

    // Check for event creation popup
    const popup = page.locator('.fixed.z-50.bg-slate-800');
    const popupCount = await popup.count();
    console.log(`Popup elements found: ${popupCount}`);

    // Check for "New Event" tab or "Add title" input
    const newEventTab = page.getByText('New Event');
    const addTitleInput = page.locator('input[placeholder="Add title"]');
    const hasNewEventTab = await newEventTab.isVisible().catch(() => false);
    const hasAddTitleInput = await addTitleInput.isVisible().catch(() => false);

    console.log(`\n=== TEST 1 RESULTS ===`);
    console.log(`Blue preview appeared during drag: ${previewCount > 0 ? 'YES' : 'NO'}`);
    console.log(`Popup appeared after mouseup: ${popupCount > 0 ? 'YES' : 'NO'}`);
    console.log(`New Event tab visible: ${hasNewEventTab ? 'YES' : 'NO'}`);
    console.log(`Add title input visible: ${hasAddTitleInput ? 'YES' : 'NO'}`);
    console.log(`Network requests made: ${networkRequests.length}`);
    networkRequests.forEach(r => console.log(`  - ${r}`));
    console.log('');

    // The test passes if popup appeared
    if (popupCount === 0) {
      console.log('ISSUE: Popup did not appear after click-drag');
    }
  });

  test('Test 2: Right-click context menu on scheduled task', async ({ page }) => {
    console.log('\n=== TEST 2: Right-click context menu ===\n');

    // Take initial screenshot
    await page.screenshot({
      path: 'screenshots/debug-2a-initial.png',
      fullPage: true,
    });

    // First, check if there are any scheduled tasks
    // Scheduled tasks have specific classes: border-l-2 border-white/30
    const scheduledTasks = page.locator('[class*="border-l-2"][class*="border-white"]');
    const taskCount = await scheduledTasks.count();
    console.log(`Scheduled tasks found: ${taskCount}`);

    if (taskCount === 0) {
      // Try alternative selector - tasks with cursor-grab in the calendar area
      const altTasks = page.locator('.flex-1.relative .cursor-grab');
      const altCount = await altTasks.count();
      console.log(`Alternative task selector count: ${altCount}`);

      // Check API for scheduled tasks
      try {
        const response = await page.request.get(`${API_URL}/api/tasks?hasSchedule=true&limit=10`);
        const data = await response.json();
        console.log(`API scheduled tasks: ${data.data?.length || 0}`);
        if (data.data && data.data.length > 0) {
          console.log('Sample:', data.data[0].title, data.data[0].scheduledStart);
        }
      } catch (e) {
        console.log('Could not fetch from API');
      }

      console.log('\nISSUE: No scheduled tasks visible in UI to test context menu');
      console.log('This test requires at least one scheduled task');

      await page.screenshot({
        path: 'screenshots/debug-2b-no-tasks.png',
        fullPage: true,
      });

      test.skip();
      return;
    }

    // Get the first scheduled task
    const firstTask = scheduledTasks.first();
    const taskTitle = await firstTask.locator('.font-medium').first().textContent();
    console.log(`Testing right-click on task: "${taskTitle}"`);

    // Scroll task into view
    await firstTask.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Get task position
    const taskBox = await firstTask.boundingBox();
    if (!taskBox) {
      console.log('ERROR: Could not get task bounding box');
      test.fail();
      return;
    }
    console.log(`Task bounds: x=${taskBox.x}, y=${taskBox.y}, w=${taskBox.width}, h=${taskBox.height}`);

    // Screenshot before right-click
    await page.screenshot({
      path: 'screenshots/debug-2c-before-rightclick.png',
      fullPage: true,
    });

    // Right-click on the task
    const clickX = taskBox.x + taskBox.width / 2;
    const clickY = taskBox.y + taskBox.height / 2;
    console.log(`Right-clicking at (${clickX}, ${clickY})`);

    await page.mouse.click(clickX, clickY, { button: 'right' });
    await page.waitForTimeout(500);

    // Screenshot after right-click - CHECK FOR CONTEXT MENU
    await page.screenshot({
      path: 'screenshots/debug-2d-after-rightclick-CHECK-MENU.png',
      fullPage: true,
    });

    // Check for context menu
    // The context menu should have "Back to Backlog" and "Edit Details" options
    const contextMenu = page.locator('.absolute.top-full');
    const menuCount = await contextMenu.count();
    console.log(`Context menu elements: ${menuCount}`);

    const backToBacklog = page.getByText('Back to Backlog');
    const editDetails = page.getByText('Edit Details');
    const hasBackToBacklog = await backToBacklog.isVisible().catch(() => false);
    const hasEditDetails = await editDetails.isVisible().catch(() => false);

    console.log(`\n=== TEST 2 RESULTS ===`);
    console.log(`Context menu appeared: ${menuCount > 0 ? 'YES' : 'NO'}`);
    console.log(`"Back to Backlog" visible: ${hasBackToBacklog ? 'YES' : 'NO'}`);
    console.log(`"Edit Details" visible: ${hasEditDetails ? 'YES' : 'NO'}`);
    console.log('');

    if (menuCount === 0) {
      console.log('ISSUE: Context menu did not appear on right-click');
    }
  });

  test('Test 3: Drag from backlog to calendar', async ({ page }) => {
    console.log('\n=== TEST 3: Drag from backlog to calendar ===\n');

    // Track network requests
    const networkRequests: { method: string; url: string; body?: string }[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/')) {
        networkRequests.push({
          method: request.method(),
          url: request.url(),
          body: request.postData() || undefined,
        });
      }
    });

    // Take initial screenshot
    await page.screenshot({
      path: 'screenshots/debug-3a-initial.png',
      fullPage: true,
    });

    // Find backlog tasks
    // Backlog tasks are in the left panel, have cursor-grab and border-l-4 classes
    const backlogTasks = page.locator('[class*="bg-slate-800"][class*="border-l-4"][class*="cursor-grab"]');
    const taskCount = await backlogTasks.count();
    console.log(`Backlog tasks found: ${taskCount}`);

    if (taskCount === 0) {
      // Try broader selector
      const altBacklog = page.locator('.w-72 [class*="cursor-grab"]');
      const altCount = await altBacklog.count();
      console.log(`Alternative backlog selector count: ${altCount}`);

      console.log('\nISSUE: No backlog tasks to drag');
      console.log('This test requires at least one task in the weekly backlog');

      await page.screenshot({
        path: 'screenshots/debug-3b-no-backlog.png',
        fullPage: true,
      });

      test.skip();
      return;
    }

    // Get first backlog task
    const firstTask = backlogTasks.first();
    const taskTitle = await firstTask.locator('.font-medium').first().textContent();
    console.log(`Will drag task: "${taskTitle}"`);

    const taskBox = await firstTask.boundingBox();
    if (!taskBox) {
      console.log('ERROR: Could not get task bounding box');
      test.fail();
      return;
    }
    console.log(`Task bounds: x=${taskBox.x}, y=${taskBox.y}, w=${taskBox.width}, h=${taskBox.height}`);

    // Find a drop target in the calendar
    // Time slots have the droppable behavior
    // Find the day columns area
    const dayColumns = page.locator('.flex.border-r.border-slate-700');
    const firstDay = dayColumns.first();
    const tasksColumn = firstDay.locator('> div').last();
    const targetBox = await tasksColumn.boundingBox();

    if (!targetBox) {
      console.log('ERROR: Could not get target bounding box');
      test.fail();
      return;
    }

    // Calculate positions
    const startX = taskBox.x + taskBox.width / 2;
    const startY = taskBox.y + taskBox.height / 2;

    // Target: middle of tasks column, ~10 AM position
    const HOUR_HEIGHT = 48;
    const START_HOUR = 6;
    const targetHour = 10;
    const endX = targetBox.x + targetBox.width / 2;
    const endY = targetBox.y + (targetHour - START_HOUR) * HOUR_HEIGHT + 10;

    console.log(`Drag from (${startX}, ${startY}) to (${endX}, ${endY})`);

    // Screenshot before drag
    await page.screenshot({
      path: 'screenshots/debug-3c-before-drag.png',
      fullPage: true,
    });

    // Step 1: Move to task
    await page.mouse.move(startX, startY);
    await page.waitForTimeout(100);

    // Step 2: Mouse down
    console.log('Mouse down on backlog task...');
    await page.mouse.down();
    await page.waitForTimeout(300); // dnd-kit has activation distance

    // Move slightly to trigger drag (dnd-kit has 8px activation distance)
    await page.mouse.move(startX + 10, startY);
    await page.waitForTimeout(200);

    // Screenshot after drag start
    await page.screenshot({
      path: 'screenshots/debug-3d-drag-started.png',
      fullPage: true,
    });

    // Check for drag overlay
    const dragOverlay = page.locator('[class*="shadow-2xl"][class*="border-2"][class*="border-blue-500"]');
    const overlayCount = await dragOverlay.count();
    console.log(`Drag overlay elements: ${overlayCount}`);

    // Step 3: Move toward calendar
    console.log('Moving toward calendar...');
    await page.mouse.move(endX, endY, { steps: 20 });
    await page.waitForTimeout(500);

    // Screenshot during drag - CHECK FOR OVERLAY
    await page.screenshot({
      path: 'screenshots/debug-3e-during-drag-CHECK-OVERLAY.png',
      fullPage: true,
    });

    // Check for drop highlight on time slots
    const dropHighlight = page.locator('.bg-blue-500\\/30');
    const highlightCount = await dropHighlight.count();
    console.log(`Drop highlight elements: ${highlightCount}`);

    // Step 4: Mouse up (drop)
    console.log('Dropping task...');
    await page.mouse.up();
    await page.waitForTimeout(2000);

    // Screenshot after drop
    await page.screenshot({
      path: 'screenshots/debug-3f-after-drop.png',
      fullPage: true,
    });

    // Check network requests
    const scheduleRequests = networkRequests.filter(r =>
      r.url.includes('/schedule') || r.url.includes('/api/tasks') && r.method === 'POST'
    );

    console.log(`\n=== TEST 3 RESULTS ===`);
    console.log(`Drag overlay appeared: ${overlayCount > 0 ? 'YES' : 'NO'}`);
    console.log(`Drop highlight appeared: ${highlightCount > 0 ? 'YES' : 'NO'}`);
    console.log(`Schedule API calls: ${scheduleRequests.length}`);
    scheduleRequests.forEach(r => {
      console.log(`  - ${r.method} ${r.url}`);
      if (r.body) console.log(`    Body: ${r.body}`);
    });
    console.log('');

    // Check if task count changed
    const tasksAfter = await backlogTasks.count();
    console.log(`Backlog tasks after drop: ${tasksAfter} (was ${taskCount})`);

    if (overlayCount === 0) {
      console.log('ISSUE: Drag overlay did not appear - drag may not be starting');
    }
    if (scheduleRequests.length === 0) {
      console.log('ISSUE: No schedule API call was made - drop may not be registering');
    }
  });

  test('Debug: Check page structure', async ({ page }) => {
    console.log('\n=== DEBUG: Page Structure ===\n');

    // Check if DndContext is present (look for its effects)
    const dndContext = await page.evaluate(() => {
      // Check if @dnd-kit is loaded
      return typeof window !== 'undefined' &&
             document.querySelector('[data-dnd-kit-context]') !== null;
    });
    console.log(`DndContext detected: ${dndContext}`);

    // Check for draggable elements
    const draggables = await page.evaluate(() => {
      // dnd-kit adds data attributes to draggable elements
      return document.querySelectorAll('[data-dnd-kit-draggable]').length;
    });
    console.log(`Draggable elements (data-dnd-kit-draggable): ${draggables}`);

    // Check for droppable elements
    const droppables = await page.evaluate(() => {
      return document.querySelectorAll('[data-dnd-kit-droppable]').length;
    });
    console.log(`Droppable elements (data-dnd-kit-droppable): ${droppables}`);

    // Check page dimensions
    const viewport = page.viewportSize();
    console.log(`Viewport: ${viewport?.width}x${viewport?.height}`);

    // Check if loading spinner is present
    const loadingSpinner = page.locator('[class*="animate-spin"]');
    const isLoading = await loadingSpinner.count();
    console.log(`Loading spinner present: ${isLoading > 0 ? 'YES (still loading!)' : 'NO'}`);

    // Check main sections
    const backlogPanel = page.locator('text=Weekly Backlog');
    const calendarHeader = page.locator('text=/Jan.*2026/');
    console.log(`Weekly Backlog panel: ${await backlogPanel.count() > 0 ? 'Found' : 'NOT FOUND'}`);
    console.log(`Calendar header: ${await calendarHeader.count() > 0 ? 'Found' : 'NOT FOUND'}`);

    // Screenshot with annotations
    await page.screenshot({
      path: 'screenshots/debug-structure.png',
      fullPage: true,
    });
  });
});

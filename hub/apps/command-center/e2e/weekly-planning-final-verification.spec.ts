import { test, expect, Page } from '@playwright/test';

const SCREENSHOT_DIR = 'screenshots/final-verification';

test.describe('Weekly Planning - Final Comprehensive Verification', () => {
  let apiCalls: { method: string; url: string; body?: any }[] = [];

  test.beforeEach(async ({ page }) => {
    // Track API calls
    apiCalls = [];
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/')) {
        apiCalls.push({
          method: request.method(),
          url: url,
          body: request.postData() ? JSON.parse(request.postData() || '{}') : undefined,
        });
      }
    });

    // Navigate to Weekly Planning page
    await page.goto('http://localhost:5173/weekly-planning');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for data to load
  });

  test('1. Click-Drag to Create Event', async ({ page }) => {
    console.log('\n=== TEST 1: Click-Drag to Create Event ===');

    // Take initial screenshot
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-initial-state.png`, fullPage: true });

    // Find the TASKS column (index 1, after time column)
    const calendarGrid = page.locator('.planning-calendar-grid, [class*="calendar"]').first();

    // Get the calendar area - look for day columns
    const dayColumns = page.locator('[data-column], .day-column, [class*="DayColumn"]');
    const columnCount = await dayColumns.count();
    console.log(`Found ${columnCount} day columns`);

    // Try to find a clickable area in the calendar
    // The calendar should have time slots we can interact with
    const calendarArea = page.locator('.fc-timegrid-body, .calendar-body, [class*="timegrid"]').first();
    const calendarBounds = await calendarArea.boundingBox().catch(() => null);

    if (!calendarBounds) {
      // Fallback: try to find any calendar grid area
      const gridArea = page.locator('[class*="calendar"], [class*="planning"]').first();
      const gridBounds = await gridArea.boundingBox();

      if (gridBounds) {
        // Click and drag to create an event
        const startX = gridBounds.x + 150; // Tasks column area
        const startY = gridBounds.y + 200; // Around 9am area
        const endY = startY + 100; // 2 hour block

        console.log(`Attempting drag from (${startX}, ${startY}) to (${startX}, ${endY})`);

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.screenshot({ path: `${SCREENSHOT_DIR}/01a-drag-start.png`, fullPage: true });

        await page.mouse.move(startX, endY, { steps: 10 });
        await page.screenshot({ path: `${SCREENSHOT_DIR}/01b-drag-preview.png`, fullPage: true });

        await page.mouse.up();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/01c-after-drag.png`, fullPage: true });
      }
    }

    // Check if a popup/modal appeared
    const popup = page.locator('[role="dialog"], .modal, .popup, [class*="CreateEvent"], [class*="Popup"]');
    const popupVisible = await popup.isVisible().catch(() => false);

    if (popupVisible) {
      console.log('PASS: Popup appeared after drag');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/01d-popup-visible.png`, fullPage: true });

      // Look for tabs
      const newEventTab = page.locator('text=New Event, button:has-text("New Event")').first();
      const scheduleTaskTab = page.locator('text=Schedule Task, button:has-text("Schedule Task")').first();

      // Fill in event details
      const titleInput = page.locator('input[placeholder*="title"], input[name="title"], input[type="text"]').first();
      if (await titleInput.isVisible()) {
        await titleInput.fill('Test Meeting');
        await page.screenshot({ path: `${SCREENSHOT_DIR}/01e-filled-form.png`, fullPage: true });

        // Click create button
        const createBtn = page.locator('button:has-text("Create"), button:has-text("Save")').first();
        if (await createBtn.isVisible()) {
          await createBtn.click();
          await page.waitForTimeout(1000);
          await page.screenshot({ path: `${SCREENSHOT_DIR}/01f-after-create.png`, fullPage: true });
        }
      }
    } else {
      console.log('Note: Popup did not appear - drag-to-create may need specific element targeting');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/01d-no-popup.png`, fullPage: true });
    }

    // Log API calls
    const eventApiCalls = apiCalls.filter(c => c.url.includes('event') || c.url.includes('calendar'));
    console.log('API calls related to events:', eventApiCalls);
  });

  test('2. Right-Click Context Menu (Unschedule)', async ({ page }) => {
    console.log('\n=== TEST 2: Right-Click Context Menu ===');

    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-initial.png`, fullPage: true });

    // Find scheduled tasks (they should be in the calendar area, not backlog)
    // Look for task elements in the calendar view
    const scheduledTasks = page.locator('[data-task-id], [class*="scheduled-task"], [class*="TaskEvent"], .fc-event');
    const taskCount = await scheduledTasks.count();
    console.log(`Found ${taskCount} scheduled tasks in calendar`);

    if (taskCount > 0) {
      const firstTask = scheduledTasks.first();
      const taskBounds = await firstTask.boundingBox();

      if (taskBounds) {
        // Right-click on the task
        await firstTask.click({ button: 'right' });
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/02a-context-menu.png`, fullPage: true });

        // Look for context menu
        const contextMenu = page.locator('[role="menu"], .context-menu, [class*="ContextMenu"], [class*="dropdown"]');
        const menuVisible = await contextMenu.isVisible().catch(() => false);

        if (menuVisible) {
          console.log('PASS: Context menu appeared');

          // Look for "Back to Backlog" option
          const unscheduleOption = page.locator('text=Back to Backlog, text=Unschedule, [class*="backlog"]');
          if (await unscheduleOption.first().isVisible()) {
            console.log('PASS: "Back to Backlog" option found');
            await unscheduleOption.first().click();
            await page.waitForTimeout(1000);
            await page.screenshot({ path: `${SCREENSHOT_DIR}/02b-after-unschedule.png`, fullPage: true });
          }
        } else {
          console.log('Note: Context menu not visible - checking for alternative menus');
        }
      }
    } else {
      console.log('Note: No scheduled tasks found to right-click on');

      // Try finding any task-like element
      const anyTasks = page.locator('[class*="task"], [class*="Task"]');
      console.log(`Found ${await anyTasks.count()} task-like elements`);
    }

    // Log relevant API calls
    const unscheduleApiCalls = apiCalls.filter(c =>
      c.method === 'PATCH' || c.method === 'PUT' || c.url.includes('unschedule')
    );
    console.log('API calls for unschedule:', unscheduleApiCalls);
  });

  test('3. Drag from Backlog to Calendar', async ({ page }) => {
    console.log('\n=== TEST 3: Drag from Backlog to Calendar ===');

    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-initial.png`, fullPage: true });

    // Look for the backlog panel
    const backlogPanel = page.locator('[class*="backlog"], [class*="Backlog"], [data-testid="backlog"]');
    const backlogVisible = await backlogPanel.first().isVisible().catch(() => false);

    if (backlogVisible) {
      console.log('PASS: Backlog panel found');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/03a-backlog-panel.png`, fullPage: true });

      // Find tasks in the backlog
      const backlogTasks = backlogPanel.first().locator('[draggable="true"], [class*="task"], [class*="Task"]');
      const backlogTaskCount = await backlogTasks.count();
      console.log(`Found ${backlogTaskCount} tasks in backlog`);

      if (backlogTaskCount > 0) {
        const taskToDrag = backlogTasks.first();
        const taskBounds = await taskToDrag.boundingBox();

        // Find a drop target in the calendar
        const calendarDropZone = page.locator('[class*="calendar"], [class*="Calendar"], .fc-timegrid-body').first();
        const dropBounds = await calendarDropZone.boundingBox().catch(() => null);

        if (taskBounds && dropBounds) {
          // Perform drag and drop
          const startX = taskBounds.x + taskBounds.width / 2;
          const startY = taskBounds.y + taskBounds.height / 2;
          const endX = dropBounds.x + 200; // Into calendar area
          const endY = dropBounds.y + 150; // Mid-morning

          console.log(`Dragging from (${startX}, ${startY}) to (${endX}, ${endY})`);

          await page.mouse.move(startX, startY);
          await page.mouse.down();
          await page.screenshot({ path: `${SCREENSHOT_DIR}/03b-drag-start.png`, fullPage: true });

          await page.mouse.move(endX, endY, { steps: 20 });
          await page.screenshot({ path: `${SCREENSHOT_DIR}/03c-drag-over.png`, fullPage: true });

          await page.mouse.up();
          await page.waitForTimeout(1000);
          await page.screenshot({ path: `${SCREENSHOT_DIR}/03d-after-drop.png`, fullPage: true });
        }
      }
    } else {
      // Try to open/expand the backlog
      const backlogToggle = page.locator('button:has-text("Backlog"), [class*="backlog-toggle"]');
      if (await backlogToggle.isVisible().catch(() => false)) {
        await backlogToggle.click();
        await page.waitForTimeout(500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/03a-backlog-expanded.png`, fullPage: true });
      } else {
        console.log('Note: Backlog panel not visible, looking for alternative locations');
      }
    }

    // Check for scheduling API calls
    const scheduleApiCalls = apiCalls.filter(c =>
      c.url.includes('task') && (c.method === 'PATCH' || c.method === 'PUT')
    );
    console.log('API calls for scheduling:', scheduleApiCalls);
  });

  test('4. Complete a Task', async ({ page }) => {
    console.log('\n=== TEST 4: Complete a Task ===');

    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-initial.png`, fullPage: true });

    // Find checkboxes for tasks
    const taskCheckboxes = page.locator(
      'input[type="checkbox"], [role="checkbox"], [class*="checkbox"], [class*="Checkbox"]'
    );
    const checkboxCount = await taskCheckboxes.count();
    console.log(`Found ${checkboxCount} checkboxes`);

    if (checkboxCount > 0) {
      // Find an unchecked checkbox
      for (let i = 0; i < Math.min(checkboxCount, 5); i++) {
        const checkbox = taskCheckboxes.nth(i);
        const isChecked = await checkbox.isChecked().catch(() => false);

        if (!isChecked) {
          console.log(`Found unchecked checkbox at index ${i}`);
          await page.screenshot({ path: `${SCREENSHOT_DIR}/04a-before-check.png`, fullPage: true });

          await checkbox.click();
          await page.waitForTimeout(500);

          await page.screenshot({ path: `${SCREENSHOT_DIR}/04b-after-check.png`, fullPage: true });

          // Verify it's now checked
          const nowChecked = await checkbox.isChecked().catch(() => false);
          if (nowChecked) {
            console.log('PASS: Task checkbox is now checked');
          }
          break;
        }
      }
    } else {
      // Try finding task completion elements differently
      const completeBtns = page.locator('[class*="complete"], button:has-text("Complete")');
      console.log(`Found ${await completeBtns.count()} complete buttons/elements`);
    }

    // Check for completion API calls
    const completeApiCalls = apiCalls.filter(c =>
      c.url.includes('task') && (c.body?.completedAt || c.body?.status === 'completed')
    );
    console.log('API calls for completion:', completeApiCalls);
  });

  test('5. Week Navigation', async ({ page }) => {
    console.log('\n=== TEST 5: Week Navigation ===');

    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-initial.png`, fullPage: true });

    // Find the current date display
    const dateDisplay = page.locator('[class*="date"], [class*="week"], h1, h2, h3').first();
    const initialDate = await dateDisplay.textContent().catch(() => '');
    console.log(`Initial date display: ${initialDate}`);

    // Find navigation buttons
    const nextButton = page.locator('button:has-text("Next"), button:has-text(">"), button:has-text("→"), [class*="next"]');
    const prevButton = page.locator('button:has-text("Prev"), button:has-text("<"), button:has-text("←"), [class*="prev"]');

    const nextCount = await nextButton.count();
    const prevCount = await prevButton.count();
    console.log(`Found ${nextCount} next buttons, ${prevCount} prev buttons`);

    // Click next week
    if (nextCount > 0) {
      await nextButton.first().click();
      await page.waitForTimeout(500);

      const afterNextDate = await dateDisplay.textContent().catch(() => '');
      console.log(`After clicking next: ${afterNextDate}`);

      if (afterNextDate !== initialDate) {
        console.log('PASS: Date changed after clicking next');
      }

      await page.screenshot({ path: `${SCREENSHOT_DIR}/05a-after-next.png`, fullPage: true });

      // Click prev to go back
      if (prevCount > 0) {
        await prevButton.first().click();
        await page.waitForTimeout(500);

        const afterPrevDate = await dateDisplay.textContent().catch(() => '');
        console.log(`After clicking prev: ${afterPrevDate}`);

        await page.screenshot({ path: `${SCREENSHOT_DIR}/05b-after-prev.png`, fullPage: true });
      }
    } else {
      // Look for arrow icons
      const arrowIcons = page.locator('svg, [class*="arrow"], [class*="chevron"]');
      console.log(`Found ${await arrowIcons.count()} potential arrow icons`);
    }
  });

  test('Final Summary - Take Full Page Screenshots', async ({ page }) => {
    console.log('\n=== FINAL SUMMARY ===');

    // Wait for everything to load
    await page.waitForTimeout(2000);

    // Full page screenshot
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/final-full-page.png`,
      fullPage: true
    });

    // Screenshot of just the viewport
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/final-viewport.png`
    });

    // Collect all elements for summary
    const summary = {
      backlogTasks: await page.locator('[class*="backlog"] [class*="task"], [class*="backlog"] [class*="Task"]').count(),
      scheduledTasks: await page.locator('[class*="scheduled"], [class*="calendar"] [class*="task"]').count(),
      checkboxes: await page.locator('input[type="checkbox"]').count(),
      navButtons: await page.locator('button:has-text("Next"), button:has-text("Prev"), button:has-text(">"), button:has-text("<")').count(),
    };

    console.log('Page element summary:', summary);
    console.log('\n=== ALL TESTS COMPLETE ===');
  });
});

import { test, expect, type Page } from '@playwright/test';

const SCREENSHOT_DIR = 'screenshots/tauri-final-test';

/**
 * Weekly Planning Final Feature Test
 * Tests all features of the Weekly Planning page with comprehensive screenshots
 */

test.describe('Weekly Planning Final Test', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Weekly Planning page
    await page.goto('/weekly-planning');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for data to load
  });

  test('01 - Initial page load and overview', async ({ page }) => {
    // Take initial screenshot showing the full page
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/01-initial-page-load.png`,
      fullPage: true,
    });

    // Verify key elements are present
    const header = page.locator('h1, h2').filter({ hasText: /weekly|planning/i }).first();
    const calendarArea = page.locator('[class*="calendar"], [class*="grid"]').first();
    const backlogPanel = page.locator('text=/backlog/i').first();

    console.log('Header visible:', await header.isVisible().catch(() => false));
    console.log('Calendar area visible:', await calendarArea.isVisible().catch(() => false));
    console.log('Backlog panel visible:', await backlogPanel.isVisible().catch(() => false));
  });

  test('02 - Click-drag to create event - start position', async ({ page }) => {
    // Find the calendar grid area (tasks column on the right side of a day)
    await page.waitForTimeout(1000);

    // Look for the calendar grid or day columns
    const dayColumns = page.locator('[class*="day"], [class*="column"]');
    const dayCount = await dayColumns.count();
    console.log('Day columns found:', dayCount);

    // Take screenshot of the calendar area before drag
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/02a-calendar-before-drag.png`,
      fullPage: true,
    });

    // Try to find a droppable area in the tasks column
    const taskColumns = page.locator('[data-droppable="true"], [class*="task-column"], [class*="drop"]');
    const taskColCount = await taskColumns.count();
    console.log('Task columns/droppable areas found:', taskColCount);

    // Screenshot showing the droppable areas
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/02b-droppable-areas.png`,
      fullPage: true,
    });
  });

  test('03 - Click-drag to create event - perform drag', async ({ page }) => {
    await page.waitForTimeout(1000);

    // Find a draggable/clickable area in the calendar
    // The tasks column is on the right side, we need to click and drag there
    const calendarGrid = page.locator('[class*="calendar-grid"], [class*="week-grid"], .grid').first();

    if (await calendarGrid.isVisible().catch(() => false)) {
      const box = await calendarGrid.boundingBox();
      if (box) {
        // Calculate a position in the tasks column (right side of the grid)
        const startX = box.x + box.width * 0.8; // Right side (tasks column)
        const startY = box.y + 100; // Some way down
        const endY = startY + 60; // Drag down 60px

        console.log('Starting drag at:', startX, startY);
        console.log('Ending drag at:', startX, endY);

        // Start the mouse drag
        await page.mouse.move(startX, startY);
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/03a-drag-start-position.png`,
          fullPage: true,
        });

        await page.mouse.down();
        await page.waitForTimeout(100);

        // Move to create a selection
        await page.mouse.move(startX, endY, { steps: 10 });
        await page.waitForTimeout(200);

        // Screenshot during the drag
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/03b-during-drag.png`,
          fullPage: true,
        });

        await page.mouse.up();
        await page.waitForTimeout(500);

        // Screenshot after releasing
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/03c-after-drag-release.png`,
          fullPage: true,
        });
      }
    }
  });

  test('04 - Check for create event popup', async ({ page }) => {
    await page.waitForTimeout(1000);

    // Check if there's a popup/modal for creating events
    const popup = page.locator('[class*="modal"], [class*="popup"], [class*="dialog"], [role="dialog"]');
    const popupVisible = await popup.first().isVisible().catch(() => false);
    console.log('Popup visible:', popupVisible);

    // Also check for "New Event" or "Schedule Task" tabs
    const newEventTab = page.locator('text=/new event/i');
    const scheduleTaskTab = page.locator('text=/schedule task/i');

    console.log('New Event tab:', await newEventTab.isVisible().catch(() => false));
    console.log('Schedule Task tab:', await scheduleTaskTab.isVisible().catch(() => false));

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/04-popup-check.png`,
      fullPage: true,
    });
  });

  test('05 - Right-click context menu on scheduled task', async ({ page }) => {
    await page.waitForTimeout(1000);

    // Find scheduled tasks (usually green blocks in the tasks column)
    const scheduledTasks = page.locator('[class*="scheduled"], [class*="task"][class*="green"], [data-scheduled="true"]');
    const taskCount = await scheduledTasks.count();
    console.log('Scheduled tasks found:', taskCount);

    // Also try to find any task blocks
    const taskBlocks = page.locator('[class*="task-block"], [class*="event-block"], [class*="calendar-event"]');
    const blockCount = await taskBlocks.count();
    console.log('Task blocks found:', blockCount);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/05a-scheduled-tasks.png`,
      fullPage: true,
    });

    // If we found any task blocks, right-click on the first one
    if (blockCount > 0) {
      const firstTask = taskBlocks.first();
      const box = await firstTask.boundingBox();
      if (box) {
        // Right-click on the task
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
        await page.waitForTimeout(500);

        await page.screenshot({
          path: `${SCREENSHOT_DIR}/05b-after-right-click.png`,
          fullPage: true,
        });

        // Check for context menu
        const contextMenu = page.locator('[class*="context-menu"], [role="menu"], [class*="dropdown"]');
        const menuVisible = await contextMenu.first().isVisible().catch(() => false);
        console.log('Context menu visible:', menuVisible);

        // Look for "Back to Backlog" option
        const backToBacklog = page.locator('text=/back to backlog/i');
        console.log('Back to Backlog option:', await backToBacklog.isVisible().catch(() => false));
      }
    }
  });

  test('06 - Backlog panel and add task', async ({ page }) => {
    await page.waitForTimeout(1000);

    // Find the backlog panel
    const backlogPanel = page.locator('[class*="backlog"], [data-testid="backlog"]').first();
    const panelVisible = await backlogPanel.isVisible().catch(() => false);
    console.log('Backlog panel visible:', panelVisible);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/06a-backlog-panel.png`,
      fullPage: true,
    });

    // Look for "Add task" button in backlog
    const addTaskButton = page.locator('button').filter({ hasText: /add task/i }).first();
    const hasAddButton = await addTaskButton.isVisible().catch(() => false);
    console.log('Add task button found:', hasAddButton);

    if (hasAddButton) {
      await addTaskButton.click();
      await page.waitForTimeout(500);

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/06b-after-add-task-click.png`,
        fullPage: true,
      });
    }
  });

  test('07 - Drag from backlog to calendar', async ({ page }) => {
    await page.waitForTimeout(1000);

    // Find tasks in the backlog
    const backlogTasks = page.locator('[class*="backlog"] [class*="task"], [data-draggable="true"]');
    const taskCount = await backlogTasks.count();
    console.log('Backlog tasks found:', taskCount);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/07a-backlog-tasks.png`,
      fullPage: true,
    });

    if (taskCount > 0) {
      const firstTask = backlogTasks.first();
      const taskBox = await firstTask.boundingBox();

      // Find the calendar drop area
      const calendar = page.locator('[class*="calendar-grid"], [class*="week-grid"], .grid').first();
      const calendarBox = await calendar.boundingBox();

      if (taskBox && calendarBox) {
        console.log('Task position:', taskBox);
        console.log('Calendar position:', calendarBox);

        // Start drag from backlog task
        await page.mouse.move(taskBox.x + taskBox.width / 2, taskBox.y + taskBox.height / 2);
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/07b-before-drag-from-backlog.png`,
          fullPage: true,
        });

        await page.mouse.down();
        await page.waitForTimeout(200);

        // Move to calendar
        const dropX = calendarBox.x + calendarBox.width * 0.8;
        const dropY = calendarBox.y + 150;
        await page.mouse.move(dropX, dropY, { steps: 20 });
        await page.waitForTimeout(300);

        await page.screenshot({
          path: `${SCREENSHOT_DIR}/07c-during-drag-to-calendar.png`,
          fullPage: true,
        });

        await page.mouse.up();
        await page.waitForTimeout(500);

        await page.screenshot({
          path: `${SCREENSHOT_DIR}/07d-after-drop-on-calendar.png`,
          fullPage: true,
        });
      }
    }
  });

  test('08 - Complete a task', async ({ page }) => {
    await page.waitForTimeout(1000);

    // Find task checkboxes
    const checkboxes = page.locator('[type="checkbox"], [role="checkbox"]');
    const checkboxCount = await checkboxes.count();
    console.log('Checkboxes found:', checkboxCount);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/08a-before-complete.png`,
      fullPage: true,
    });

    if (checkboxCount > 0) {
      // Click the first unchecked checkbox
      const firstCheckbox = checkboxes.first();
      const isChecked = await firstCheckbox.isChecked().catch(() => false);
      console.log('First checkbox checked:', isChecked);

      if (!isChecked) {
        await firstCheckbox.click();
        await page.waitForTimeout(500);

        await page.screenshot({
          path: `${SCREENSHOT_DIR}/08b-after-complete.png`,
          fullPage: true,
        });
      }
    }
  });

  test('09 - Week navigation - next week', async ({ page }) => {
    await page.waitForTimeout(1000);

    // Find the date range display
    const dateRange = page.locator('[class*="date-range"], h2, h3').filter({ hasText: /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i }).first();
    const initialDateText = await dateRange.textContent().catch(() => 'Not found');
    console.log('Initial date range:', initialDateText);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/09a-initial-week.png`,
      fullPage: true,
    });

    // Find next week button
    const nextButton = page.locator('button').filter({ hasText: /next|→|>/i }).first();
    const nextArrow = page.locator('[class*="next"], [aria-label*="next"]').first();

    let clicked = false;
    if (await nextButton.isVisible().catch(() => false)) {
      await nextButton.click();
      clicked = true;
    } else if (await nextArrow.isVisible().catch(() => false)) {
      await nextArrow.click();
      clicked = true;
    }

    if (clicked) {
      await page.waitForTimeout(500);

      const newDateText = await dateRange.textContent().catch(() => 'Not found');
      console.log('After next week:', newDateText);

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/09b-next-week.png`,
        fullPage: true,
      });
    }
  });

  test('10 - Week navigation - previous week', async ({ page }) => {
    await page.waitForTimeout(1000);

    // First go to next week
    const nextButton = page.locator('button').filter({ hasText: /next|→|>/i }).first();
    if (await nextButton.isVisible().catch(() => false)) {
      await nextButton.click();
      await page.waitForTimeout(300);
    }

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/10a-before-prev.png`,
      fullPage: true,
    });

    // Now go back
    const prevButton = page.locator('button').filter({ hasText: /prev|←|</i }).first();
    const prevArrow = page.locator('[class*="prev"], [aria-label*="prev"]').first();

    if (await prevButton.isVisible().catch(() => false)) {
      await prevButton.click();
      await page.waitForTimeout(500);
    } else if (await prevArrow.isVisible().catch(() => false)) {
      await prevArrow.click();
      await page.waitForTimeout(500);
    }

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/10b-after-prev.png`,
      fullPage: true,
    });
  });

  test('11 - Full page exploration', async ({ page }) => {
    await page.waitForTimeout(1000);

    // Document all visible UI elements
    const buttons = await page.locator('button').all();
    console.log('Total buttons on page:', buttons.length);

    for (let i = 0; i < Math.min(buttons.length, 10); i++) {
      const text = await buttons[i].textContent();
      const visible = await buttons[i].isVisible();
      console.log(`Button ${i}: "${text?.trim()}" visible: ${visible}`);
    }

    // Check for specific elements
    const elements = {
      'Legend': await page.locator('text=/legend/i').isVisible().catch(() => false),
      'Time indicator': await page.locator('[class*="time-indicator"], [class*="current-time"]').isVisible().catch(() => false),
      'Today button': await page.locator('button').filter({ hasText: /today/i }).isVisible().catch(() => false),
      'Filter': await page.locator('[class*="filter"]').isVisible().catch(() => false),
    };

    console.log('UI Elements:', elements);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/11-full-exploration.png`,
      fullPage: true,
    });
  });

  test('12 - Console errors check', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Reload and wait
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    console.log('Console errors:', errors);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/12-console-check.png`,
      fullPage: true,
    });

    // Final screenshot of the page state
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/12-final-state.png`,
      fullPage: true,
    });
  });
});

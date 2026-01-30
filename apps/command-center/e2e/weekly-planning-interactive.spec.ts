import { test, expect, type Page } from '@playwright/test';

const SCREENSHOT_DIR = 'screenshots/tauri-final-test';
const BASE_URL = 'http://localhost:5173';

/**
 * Weekly Planning Interactive Feature Test
 * Tests all interactive features with the live application
 */

test.describe('Weekly Planning Interactive Features', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Weekly Planning page
    await page.goto(`${BASE_URL}/weekly-planning`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test('Feature 1: Click-drag to create event', async ({ page }) => {
    console.log('=== Testing Click-Drag to Create Event ===');

    // Take initial screenshot
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/feature1-01-initial.png`,
      fullPage: true,
    });

    // Find the calendar area - look for the grid with time slots
    const calendarGrid = page.locator('.flex.flex-col.flex-1').first();
    const gridVisible = await calendarGrid.isVisible().catch(() => false);
    console.log('Calendar grid visible:', gridVisible);

    // Look for the TASKS columns - these are droppable areas
    const tasksColumns = page.locator('text=TASKS');
    const tasksCount = await tasksColumns.count();
    console.log('TASKS column headers found:', tasksCount);

    if (tasksCount > 0) {
      // Get the first TASKS column header position
      const firstTasksHeader = tasksColumns.first();
      const headerBox = await firstTasksHeader.boundingBox();

      if (headerBox) {
        // Click below the header in the tasks column area
        const clickX = headerBox.x + headerBox.width / 2;
        const startY = headerBox.y + 100; // Below header
        const endY = startY + 80; // Drag 80px down

        console.log(`Starting click-drag at (${clickX}, ${startY}) to (${clickX}, ${endY})`);

        // Start drag
        await page.mouse.move(clickX, startY);
        await page.waitForTimeout(100);

        await page.screenshot({
          path: `${SCREENSHOT_DIR}/feature1-02-before-drag.png`,
          fullPage: true,
        });

        await page.mouse.down();
        await page.waitForTimeout(200);

        // Drag down
        await page.mouse.move(clickX, endY, { steps: 10 });
        await page.waitForTimeout(300);

        await page.screenshot({
          path: `${SCREENSHOT_DIR}/feature1-03-during-drag.png`,
          fullPage: true,
        });

        await page.mouse.up();
        await page.waitForTimeout(500);

        await page.screenshot({
          path: `${SCREENSHOT_DIR}/feature1-04-after-drag.png`,
          fullPage: true,
        });

        // Check for popup/modal
        const modal = page.locator('[role="dialog"], [class*="modal"], [class*="popup"]');
        const modalVisible = await modal.first().isVisible().catch(() => false);
        console.log('Modal appeared:', modalVisible);

        // Check for "New Event" or "Schedule Task" tabs
        const newEventTab = page.locator('button, [role="tab"]').filter({ hasText: /new event/i });
        const scheduleTaskTab = page.locator('button, [role="tab"]').filter({ hasText: /schedule task/i });

        console.log('New Event tab visible:', await newEventTab.isVisible().catch(() => false));
        console.log('Schedule Task tab visible:', await scheduleTaskTab.isVisible().catch(() => false));

        if (modalVisible) {
          await page.screenshot({
            path: `${SCREENSHOT_DIR}/feature1-05-modal-visible.png`,
            fullPage: true,
          });

          // Try to create an event
          const titleInput = page.locator('input[placeholder*="title" i], input[type="text"]').first();
          if (await titleInput.isVisible().catch(() => false)) {
            await titleInput.fill('Test Event from Drag');
            await page.screenshot({
              path: `${SCREENSHOT_DIR}/feature1-06-filled-title.png`,
              fullPage: true,
            });

            // Click create button
            const createButton = page.locator('button').filter({ hasText: /create|save|add/i }).first();
            if (await createButton.isVisible().catch(() => false)) {
              await createButton.click();
              await page.waitForTimeout(500);
              await page.screenshot({
                path: `${SCREENSHOT_DIR}/feature1-07-after-create.png`,
                fullPage: true,
              });
            }
          }
        }
      }
    }
  });

  test('Feature 2: Add task to backlog', async ({ page }) => {
    console.log('=== Testing Add Task to Backlog ===');

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/feature2-01-initial.png`,
      fullPage: true,
    });

    // Find the "Add task" button
    const addTaskButton = page.locator('button').filter({ hasText: /add task/i }).first();
    const buttonVisible = await addTaskButton.isVisible().catch(() => false);
    console.log('Add task button visible:', buttonVisible);

    if (buttonVisible) {
      await addTaskButton.click();
      await page.waitForTimeout(300);

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/feature2-02-add-task-clicked.png`,
        fullPage: true,
      });

      // Look for input field
      const taskInput = page.locator('input[placeholder*="task" i], input[type="text"]').first();
      const inputVisible = await taskInput.isVisible().catch(() => false);
      console.log('Task input visible:', inputVisible);

      if (inputVisible) {
        await taskInput.fill('Test Task for Backlog');
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/feature2-03-task-typed.png`,
          fullPage: true,
        });

        // Press Enter to submit
        await taskInput.press('Enter');
        await page.waitForTimeout(500);

        await page.screenshot({
          path: `${SCREENSHOT_DIR}/feature2-04-task-submitted.png`,
          fullPage: true,
        });
      }
    }
  });

  test('Feature 3: Drag from backlog to calendar', async ({ page }) => {
    console.log('=== Testing Drag from Backlog to Calendar ===');

    // First, add a task to backlog
    const addTaskButton = page.locator('button').filter({ hasText: /add task/i }).first();
    if (await addTaskButton.isVisible().catch(() => false)) {
      await addTaskButton.click();
      await page.waitForTimeout(200);

      const taskInput = page.locator('input').first();
      if (await taskInput.isVisible().catch(() => false)) {
        await taskInput.fill('Drag Test Task');
        await taskInput.press('Enter');
        await page.waitForTimeout(500);
      }
    }

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/feature3-01-task-added.png`,
      fullPage: true,
    });

    // Find task items in backlog (look for draggable items)
    const backlogTasks = page.locator('[draggable="true"], [class*="backlog"] [class*="task"], [class*="draggable"]');
    const taskCount = await backlogTasks.count();
    console.log('Draggable tasks in backlog:', taskCount);

    // Also look for task cards/items
    const taskCards = page.locator('[class*="task-card"], [class*="task-item"]');
    const cardCount = await taskCards.count();
    console.log('Task cards found:', cardCount);

    // Try to find any clickable task item in backlog area
    const backlogArea = page.locator('[class*="backlog"]').first();
    if (await backlogArea.isVisible().catch(() => false)) {
      const backlogBox = await backlogArea.boundingBox();
      console.log('Backlog area:', backlogBox);
    }

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/feature3-02-backlog-state.png`,
      fullPage: true,
    });
  });

  test('Feature 4: Week navigation', async ({ page }) => {
    console.log('=== Testing Week Navigation ===');

    // Get initial date range
    const dateRange = page.locator('text=/Jan.*\\d{4}/i').first();
    const initialDate = await dateRange.textContent().catch(() => 'Not found');
    console.log('Initial date range:', initialDate);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/feature4-01-initial-week.png`,
      fullPage: true,
    });

    // Find navigation buttons - look for arrows or next/prev buttons
    const nextButton = page.locator('button svg, button').filter({ has: page.locator('svg') }).last();
    const prevButton = page.locator('button svg, button').filter({ has: page.locator('svg') }).first();

    // Or look for specific aria labels
    const rightArrow = page.locator('[aria-label*="next" i], button:has(svg):last-child');

    // Find all buttons near the date range
    const navButtons = page.locator('button').filter({ has: page.locator('svg') });
    const navCount = await navButtons.count();
    console.log('Navigation buttons with SVG:', navCount);

    // Click the right/next arrow (usually the last button with SVG in header area)
    if (navCount >= 2) {
      const rightNavButton = navButtons.last();
      console.log('Clicking next week button');
      await rightNavButton.click();
      await page.waitForTimeout(500);

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/feature4-02-next-week.png`,
        fullPage: true,
      });

      const newDate = await dateRange.textContent().catch(() => 'Not found');
      console.log('After next week:', newDate);

      // Now click previous (first nav button)
      const leftNavButton = navButtons.first();
      await leftNavButton.click();
      await page.waitForTimeout(500);

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/feature4-03-prev-week.png`,
        fullPage: true,
      });

      const backDate = await dateRange.textContent().catch(() => 'Not found');
      console.log('After previous week:', backDate);
    }
  });

  test('Feature 5: Current time indicator', async ({ page }) => {
    console.log('=== Testing Current Time Indicator ===');

    // Look for the current time indicator (usually a red/colored line)
    const timeIndicator = page.locator('[class*="current-time"], [class*="time-indicator"], [style*="red"], [style*="rgb(239"]');
    const indicatorVisible = await timeIndicator.first().isVisible().catch(() => false);
    console.log('Time indicator visible:', indicatorVisible);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/feature5-01-time-indicator.png`,
      fullPage: true,
    });

    // Look at the legend at the bottom
    const legend = page.locator('text=/Events:|Tasks:/i').first();
    const legendVisible = await legend.isVisible().catch(() => false);
    console.log('Legend visible:', legendVisible);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/feature5-02-legend.png`,
      fullPage: true,
    });
  });

  test('Feature 6: Right-click context menu', async ({ page }) => {
    console.log('=== Testing Right-Click Context Menu ===');

    // First we need a task on the calendar to right-click on
    // For now, right-click on the calendar area itself
    const calendarArea = page.locator('.grid, [class*="calendar"]').first();

    if (await calendarArea.isVisible().catch(() => false)) {
      const box = await calendarArea.boundingBox();
      if (box) {
        // Right-click in the middle of the calendar
        const clickX = box.x + box.width * 0.6;
        const clickY = box.y + 200;

        await page.screenshot({
          path: `${SCREENSHOT_DIR}/feature6-01-before-right-click.png`,
          fullPage: true,
        });

        await page.mouse.click(clickX, clickY, { button: 'right' });
        await page.waitForTimeout(500);

        await page.screenshot({
          path: `${SCREENSHOT_DIR}/feature6-02-after-right-click.png`,
          fullPage: true,
        });

        // Check for context menu
        const contextMenu = page.locator('[role="menu"], [class*="context-menu"], [class*="dropdown-menu"]');
        const menuVisible = await contextMenu.first().isVisible().catch(() => false);
        console.log('Context menu visible:', menuVisible);

        if (menuVisible) {
          await page.screenshot({
            path: `${SCREENSHOT_DIR}/feature6-03-context-menu.png`,
            fullPage: true,
          });
        }
      }
    }
  });

  test('Feature Summary: Full page with all elements', async ({ page }) => {
    console.log('=== Full Page Summary ===');

    // Count all key elements
    const buttons = await page.locator('button').count();
    const inputs = await page.locator('input').count();
    const svgs = await page.locator('svg').count();

    console.log(`Buttons: ${buttons}, Inputs: ${inputs}, SVGs: ${svgs}`);

    // Check for key text
    const hasWeeklyPlanning = await page.locator('text=Weekly Planning').isVisible().catch(() => false);
    const hasBacklog = await page.locator('text=Weekly Backlog').isVisible().catch(() => false);
    const hasEvents = await page.locator('text=EVENTS').first().isVisible().catch(() => false);
    const hasTasks = await page.locator('text=TASKS').first().isVisible().catch(() => false);

    console.log('Weekly Planning header:', hasWeeklyPlanning);
    console.log('Weekly Backlog panel:', hasBacklog);
    console.log('EVENTS columns:', hasEvents);
    console.log('TASKS columns:', hasTasks);

    // Full page screenshot
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/summary-full-page.png`,
      fullPage: true,
    });

    // Viewport screenshot
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/summary-viewport.png`,
    });
  });
});

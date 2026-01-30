import { test, expect, type Page } from '@playwright/test';

const SCREENSHOT_DIR = 'screenshots/tauri-final-test';
const BASE_URL = 'http://localhost:5173';

/**
 * Weekly Planning Context Menu and Task Completion Tests
 */

test.describe('Weekly Planning Context Menu & Task Actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/weekly-planning`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('Right-click on scheduled task shows context menu', async ({ page }) => {
    console.log('=== Testing Right-Click Context Menu ===');

    // Take initial screenshot
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/context-01-initial.png`,
      fullPage: true,
    });

    // Look for scheduled tasks in the TASKS column
    // Tasks are typically green blocks
    const greenTasks = page.locator('[class*="bg-green"], [style*="green"]');
    const greenCount = await greenTasks.count();
    console.log('Green task blocks found:', greenCount);

    // Also look for task blocks with checkbox
    const taskWithCheckbox = page.locator('[class*="task"]').filter({ has: page.locator('[type="checkbox"], [role="checkbox"]') });
    const checkboxTaskCount = await taskWithCheckbox.count();
    console.log('Tasks with checkboxes:', checkboxTaskCount);

    // Find any element that looks like a scheduled task
    // Looking at the screenshot, there's a green "Test Eve..." block on Sunday
    const scheduledBlocks = page.locator('.bg-green-500, .bg-emerald-500, [class*="emerald"], [class*="green-5"]');
    const blockCount = await scheduledBlocks.count();
    console.log('Scheduled blocks with green class:', blockCount);

    // Try to find by the visible text "Test Eve" or similar
    const testEventBlock = page.locator('text=/Test Eve/i').first();
    const testEventVisible = await testEventBlock.isVisible().catch(() => false);
    console.log('Test Event block visible:', testEventVisible);

    if (testEventVisible) {
      const box = await testEventBlock.boundingBox();
      if (box) {
        console.log('Test Event position:', box);

        // Right-click on the task
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
        await page.waitForTimeout(500);

        await page.screenshot({
          path: `${SCREENSHOT_DIR}/context-02-after-right-click.png`,
          fullPage: true,
        });

        // Check for context menu
        const contextMenu = page.locator('[role="menu"], [class*="context"], [class*="dropdown"], [class*="popover"]');
        const menuVisible = await contextMenu.first().isVisible().catch(() => false);
        console.log('Context menu appeared:', menuVisible);

        // Look for "Back to Backlog" option
        const backToBacklog = page.locator('text=/back to backlog/i, text=/remove from calendar/i, text=/unschedule/i');
        const backOptionVisible = await backToBacklog.first().isVisible().catch(() => false);
        console.log('Back to Backlog option visible:', backOptionVisible);

        if (menuVisible) {
          await page.screenshot({
            path: `${SCREENSHOT_DIR}/context-03-menu-visible.png`,
            fullPage: true,
          });
        }
      }
    }

    // Also try right-clicking on "meeti..." task on Monday (if visible)
    const meetingTask = page.locator('text=/meeti/i').first();
    const meetingVisible = await meetingTask.isVisible().catch(() => false);
    console.log('Meeting task visible:', meetingVisible);

    if (meetingVisible) {
      const box = await meetingTask.boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
        await page.waitForTimeout(500);

        await page.screenshot({
          path: `${SCREENSHOT_DIR}/context-04-meeting-right-click.png`,
          fullPage: true,
        });
      }
    }
  });

  test('Complete a task using checkbox', async ({ page }) => {
    console.log('=== Testing Task Completion ===');

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/complete-01-initial.png`,
      fullPage: true,
    });

    // Look for checkboxes in the calendar area (tasks have checkboxes, events don't)
    // The checkbox is inside task blocks
    const allCheckboxes = page.locator('input[type="checkbox"], [role="checkbox"]');
    const checkboxCount = await allCheckboxes.count();
    console.log('Total checkboxes found:', checkboxCount);

    // Look specifically for task checkboxes (not in backlog)
    // In the calendar, tasks have checkboxes while events don't
    const calendarArea = page.locator('.flex-1').last(); // Calendar grid area
    const calendarCheckboxes = calendarArea.locator('input[type="checkbox"], [role="checkbox"]');
    const calCheckCount = await calendarCheckboxes.count();
    console.log('Calendar checkboxes:', calCheckCount);

    // Also check for checkboxes in task blocks specifically
    const taskCheckboxes = page.locator('[class*="task"] input[type="checkbox"], [class*="task"] [role="checkbox"]');
    const taskCheckCount = await taskCheckboxes.count();
    console.log('Task checkboxes:', taskCheckCount);

    // Look for the "as" task which appears to have a checkbox in the screenshot
    const asTask = page.locator('text=/^as$/i').first();
    const asTaskVisible = await asTask.isVisible().catch(() => false);
    console.log('"as" task visible:', asTaskVisible);

    if (asTaskVisible) {
      // Find parent element that might contain the checkbox
      const asTaskParent = asTask.locator('..');
      const parentCheckbox = asTaskParent.locator('input[type="checkbox"]');
      const hasCheckbox = await parentCheckbox.isVisible().catch(() => false);
      console.log('"as" task has checkbox:', hasCheckbox);

      if (hasCheckbox) {
        const isChecked = await parentCheckbox.isChecked().catch(() => false);
        console.log('Checkbox is checked:', isChecked);

        if (!isChecked) {
          await parentCheckbox.click();
          await page.waitForTimeout(500);

          await page.screenshot({
            path: `${SCREENSHOT_DIR}/complete-02-after-check.png`,
            fullPage: true,
          });
        }
      }
    }

    // Try clicking on visible checkboxes if we found any
    if (checkboxCount > 0) {
      const firstCheckbox = allCheckboxes.first();
      const cbBox = await firstCheckbox.boundingBox();
      console.log('First checkbox position:', cbBox);

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/complete-03-checkbox-highlight.png`,
        fullPage: true,
      });
    }
  });

  test('Click on task shows detail modal', async ({ page }) => {
    console.log('=== Testing Task Detail Modal ===');

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/detail-01-initial.png`,
      fullPage: true,
    });

    // Click on a task (not right-click) to see if a detail modal appears
    const testEventBlock = page.locator('text=/Test Eve/i').first();
    const testEventVisible = await testEventBlock.isVisible().catch(() => false);

    if (testEventVisible) {
      await testEventBlock.click();
      await page.waitForTimeout(500);

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/detail-02-after-click.png`,
        fullPage: true,
      });

      // Check for modal
      const modal = page.locator('[role="dialog"], [class*="modal"]');
      const modalVisible = await modal.first().isVisible().catch(() => false);
      console.log('Detail modal appeared:', modalVisible);

      if (modalVisible) {
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/detail-03-modal.png`,
          fullPage: true,
        });
      }
    }
  });

  test('Drag task from backlog to calendar', async ({ page }) => {
    console.log('=== Testing Drag from Backlog ===');

    // First check if there are tasks in backlog
    const backlogTasks = page.locator('[class*="backlog"]').locator('[class*="task"], [draggable="true"]');
    const taskCount = await backlogTasks.count();
    console.log('Tasks in backlog:', taskCount);

    // Look for the "Test Task for Backlog" or "Drag Test Task"
    const testTask = page.locator('text=/Test Task for Backlog/i, text=/Drag Test Task/i').first();
    const testTaskVisible = await testTask.isVisible().catch(() => false);
    console.log('Test task in backlog visible:', testTaskVisible);

    await page.screenshot({
      path: `${SCREENSHOT_DIR}/drag-01-backlog.png`,
      fullPage: true,
    });

    if (testTaskVisible) {
      const taskBox = await testTask.boundingBox();

      // Find a drop target in the calendar
      // Look for TASKS column for Tuesday (should have TASKS (0))
      const tuesdayTaskCol = page.locator('text=TASKS (0)').first();
      const tuesdayColVisible = await tuesdayTaskCol.isVisible().catch(() => false);
      console.log('Tuesday tasks column (empty) visible:', tuesdayColVisible);

      if (taskBox && tuesdayColVisible) {
        const dropBox = await tuesdayTaskCol.boundingBox();

        if (dropBox) {
          console.log('Dragging from', taskBox, 'to', dropBox);

          // Perform drag and drop
          await page.mouse.move(taskBox.x + taskBox.width / 2, taskBox.y + taskBox.height / 2);
          await page.waitForTimeout(100);

          await page.screenshot({
            path: `${SCREENSHOT_DIR}/drag-02-before-drag.png`,
            fullPage: true,
          });

          await page.mouse.down();
          await page.waitForTimeout(200);

          // Move to drop target (below the header, into the time slots)
          const dropX = dropBox.x + dropBox.width / 2;
          const dropY = dropBox.y + 150; // Below the header

          await page.mouse.move(dropX, dropY, { steps: 20 });
          await page.waitForTimeout(300);

          await page.screenshot({
            path: `${SCREENSHOT_DIR}/drag-03-during-drag.png`,
            fullPage: true,
          });

          await page.mouse.up();
          await page.waitForTimeout(500);

          await page.screenshot({
            path: `${SCREENSHOT_DIR}/drag-04-after-drop.png`,
            fullPage: true,
          });

          // Check if task moved
          const backlogTasksAfter = page.locator('text=/Test Task for Backlog/i');
          const stillInBacklog = await backlogTasksAfter.isVisible().catch(() => false);
          console.log('Task still in backlog:', stillInBacklog);
        }
      }
    }
  });
});

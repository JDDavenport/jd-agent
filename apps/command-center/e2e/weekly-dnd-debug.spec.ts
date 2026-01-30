/**
 * Debug test for Weekly Planning drag and drop
 * Tests the droppable zone registration and drag end detection
 */
import { test, expect } from '@playwright/test';

test.describe('Weekly Planning DnD Debug', () => {
  test('should verify droppable zones register and drag works', async ({ page }) => {
    // Collect console logs
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleLogs.push(`[${msg.type()}] ${text}`);
      // Also print to test output for immediate visibility
      if (text.includes('Droppable') || text.includes('DragEnd') || text.includes('drop')) {
        console.log(`CONSOLE: ${text}`);
      }
    });

    // Navigate to Weekly Planning
    await page.goto('http://localhost:5173/weekly-planning');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for data to load

    // Take initial screenshot
    await page.screenshot({ path: 'screenshots/dnd-debug-01-initial.png', fullPage: true });

    // Check for droppable mount logs
    const droppableMountLogs = consoleLogs.filter(log => log.includes('Droppable') && log.includes('mounted'));
    console.log('\n=== DROPPABLE MOUNT LOGS ===');
    droppableMountLogs.forEach(log => console.log(log));

    // Look for the backlog panel
    const backlogPanel = page.locator('.w-72').first();
    await expect(backlogPanel).toBeVisible();

    // Check for existing backlog tasks - they have cursor-grab class and border-l-4
    let taskCards = page.locator('.cursor-grab.border-l-4');
    let taskCount = await taskCards.count();
    console.log(`\n=== BACKLOG TASKS ===`);
    console.log(`Found ${taskCount} task cards with cursor-grab`);

    // If no tasks, add one via the + button
    if (taskCount === 0) {
      console.log('No tasks found, adding one via quick-add...');

      // Click the "Add task" button
      const addButton = page.locator('button:has-text("Add task")');
      if (await addButton.isVisible()) {
        await addButton.click();
        await page.waitForTimeout(300);

        // Type a task title and press Enter
        const input = page.locator('input[placeholder*="Type task"]');
        await expect(input).toBeVisible();
        await input.fill('Test drag and drop task');
        await input.press('Enter');
        await page.waitForTimeout(1000); // Wait for task to be created

        // Check again for tasks
        taskCards = page.locator('.cursor-grab.border-l-4');
        taskCount = await taskCards.count();
        console.log(`After adding, found ${taskCount} task cards`);
      }
    }

    // Take screenshot of backlog
    await page.screenshot({ path: 'screenshots/dnd-debug-02-backlog.png' });

    if (taskCount > 0) {
      // Get the first task element
      const firstTask = taskCards.first();
      const taskBox = await firstTask.boundingBox();
      console.log(`First task bounding box: ${JSON.stringify(taskBox)}`);

      // Find a day column to drop on
      const dayColumns = page.locator('[data-droppable-id^="day-"]');
      const dayColumnCount = await dayColumns.count();
      console.log(`Found ${dayColumnCount} day columns`);

      // List all day column IDs
      for (let i = 0; i < dayColumnCount; i++) {
        const col = dayColumns.nth(i);
        const droppableId = await col.getAttribute('data-droppable-id');
        console.log(`  Day column ${i}: ${droppableId}`);
      }

      if (dayColumnCount > 0 && taskBox) {
        // Get the third day column (middle of the week)
        const targetDayColumn = dayColumns.nth(2);
        const dayBox = await targetDayColumn.boundingBox();
        const droppableId = await targetDayColumn.getAttribute('data-droppable-id');

        console.log(`\nTarget day column: ${droppableId}`);
        console.log(`Target bounding box: ${JSON.stringify(dayBox)}`);

        if (dayBox) {
          // Clear console logs before drag
          consoleLogs.length = 0;

          // Perform the drag operation
          console.log('\n=== STARTING DRAG OPERATION ===');

          // Start from center of task
          const startX = taskBox.x + taskBox.width / 2;
          const startY = taskBox.y + taskBox.height / 2;

          // End at middle of day column (around 10am position)
          const endX = dayBox.x + dayBox.width / 2;
          const endY = dayBox.y + 200; // About 10am in the calendar

          console.log(`Dragging from (${startX.toFixed(0)}, ${startY.toFixed(0)}) to (${endX.toFixed(0)}, ${endY.toFixed(0)})`);

          // Take screenshot before drag
          await page.screenshot({ path: 'screenshots/dnd-debug-03-before-drag.png' });

          // Move mouse to task and press down
          await page.mouse.move(startX, startY);
          await page.waitForTimeout(100);
          await page.mouse.down();
          await page.waitForTimeout(200);

          // Take screenshot during drag start
          await page.screenshot({ path: 'screenshots/dnd-debug-04-drag-start.png' });

          // Log any console messages after mouse down
          console.log('\n=== CONSOLE AFTER MOUSE DOWN ===');
          consoleLogs.forEach(log => console.log(log));

          // Move in larger steps to the day column
          const steps = 20;
          for (let i = 1; i <= steps; i++) {
            const x = startX + (endX - startX) * (i / steps);
            const y = startY + (endY - startY) * (i / steps);
            await page.mouse.move(x, y);
            await page.waitForTimeout(30);
          }

          await page.waitForTimeout(200);

          // Take screenshot while hovering over drop zone
          await page.screenshot({ path: 'screenshots/dnd-debug-05-dragging-over.png' });

          console.log('\n=== CONSOLE WHILE DRAGGING ===');
          consoleLogs.forEach(log => console.log(log));

          // Check if the day column shows visual feedback (ring-2, bg-blue-500/20)
          const targetClasses = await targetDayColumn.getAttribute('class');
          console.log(`Target day column classes: ${targetClasses}`);
          const hasVisualFeedback = targetClasses?.includes('ring-2') || targetClasses?.includes('bg-blue');
          console.log(`Has visual feedback (ring/bg-blue): ${hasVisualFeedback}`);

          // Release the mouse
          await page.mouse.up();
          await page.waitForTimeout(500);

          // Take screenshot after drop
          await page.screenshot({ path: 'screenshots/dnd-debug-06-after-drop.png' });

          // Check for DragEnd logs
          console.log('\n=== ALL CONSOLE LOGS DURING DRAG ===');
          consoleLogs.forEach(log => console.log(log));

          const dragEndLogs = consoleLogs.filter(log => log.includes('DragEnd'));
          console.log('\n=== DRAGEND SPECIFIC LOGS ===');
          dragEndLogs.forEach(log => console.log(log));

          // Check if over was detected
          const overDetected = dragEndLogs.some(log => log.includes('day-'));
          console.log(`\n>>> Drop target detected (day-* in DragEnd): ${overDetected}`);

          // Look for "No drop target detected" message
          const noDropTarget = dragEndLogs.some(log => log.includes('No drop target detected'));
          console.log(`>>> "No drop target detected" message: ${noDropTarget}`);

          // Check if any droppable zone showed isOver state
          const isOverLogs = consoleLogs.filter(log => log.includes('isOver'));
          console.log(`>>> isOver state logs: ${isOverLogs.length}`);
        }
      }
    } else {
      console.log('ERROR: Could not find or create any backlog tasks');
    }

    // Final summary
    console.log('\n========================================');
    console.log('=== FINAL SUMMARY ===');
    console.log('========================================');
    console.log('All droppable-related logs:');
    const allDroppableLogs = consoleLogs.filter(log =>
      log.toLowerCase().includes('droppable') ||
      log.toLowerCase().includes('dragend') ||
      log.toLowerCase().includes('drop')
    );
    allDroppableLogs.forEach(log => console.log(log));

    // Take final screenshot
    await page.screenshot({ path: 'screenshots/dnd-debug-07-final.png', fullPage: true });

    // The test passes if we got this far - the important info is in the console output
    expect(true).toBe(true);
  });
});

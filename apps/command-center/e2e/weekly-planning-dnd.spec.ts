import { test, expect } from '@playwright/test';

test.describe('Weekly Planning Drag-and-Drop Scheduling', () => {
  test('should schedule a task by dragging to a time slot and verify persistence', async ({ page }) => {
    // Collect console logs for debugging
    const consoleLogs: string[] = [];
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else {
        consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
      }
    });

    // Track network requests to scheduling endpoint
    const scheduleRequests: { url: string; method: string; status?: number; body?: string; response?: string }[] = [];
    page.on('request', request => {
      if (request.url().includes('/schedule')) {
        scheduleRequests.push({
          url: request.url(),
          method: request.method(),
          body: request.postData() || undefined,
        });
      }
    });
    page.on('response', async response => {
      if (response.url().includes('/schedule')) {
        const existing = scheduleRequests.find(r => r.url === response.url() && !r.status);
        if (existing) {
          existing.status = response.status();
          try {
            existing.response = await response.text();
          } catch {}
        }
      }
    });

    // Navigate to page
    await page.goto('http://localhost:5173/weekly-planning');
    await page.waitForTimeout(3000);

    // Take initial screenshot
    await page.screenshot({
      path: 'screenshots/dnd-01-initial.png',
      fullPage: true
    });

    // Verify backlog panel exists and has tasks
    const backlogPanel = page.locator('text=Weekly Backlog');
    await expect(backlogPanel).toBeVisible({ timeout: 10000 });

    // Find a draggable task card in the backlog
    const taskCards = page.locator('[class*="bg-slate-800"][class*="border-l-4"][class*="cursor-grab"]');
    const cardCount = await taskCards.count();
    console.log(`Found ${cardCount} draggable task cards in backlog`);

    if (cardCount === 0) {
      console.log('No tasks in backlog - creating one first');

      // Click Add button
      const addButton = page.locator('button:has-text("Add")');
      await addButton.click();
      await page.waitForTimeout(500);

      // Fill in task details
      const titleInput = page.locator('input[placeholder="Task title..."]');
      const testTaskTitle = `DnD Test ${Date.now()}`;
      await titleInput.fill(testTaskTitle);

      const minutesInput = page.locator('input[placeholder="Minutes"]');
      await minutesInput.fill('30');

      // Submit
      const submitButton = page.locator('button:has-text("Add Task")');
      await submitButton.click();
      await page.waitForTimeout(2000);

      // Verify task was created
      const newCards = await taskCards.count();
      console.log(`After adding: ${newCards} task cards`);
    }

    // Get the first task's text for verification
    const firstTask = taskCards.first();
    const taskTitle = await firstTask.locator('.font-medium').first().textContent();
    console.log(`Will drag task: "${taskTitle}"`);

    // Get the task's bounding box
    const taskBox = await firstTask.boundingBox();
    if (!taskBox) {
      throw new Error('Could not get task bounding box');
    }
    console.log(`Task position: x=${taskBox.x}, y=${taskBox.y}`);

    // Find droppable time slots in calendar
    // Time slots have format slot-YYYY-MM-DD-HH
    const calendarArea = page.locator('.flex-1.min-w-0'); // Right panel
    const droppableSlots = calendarArea.locator('[class*="border-b"][class*="transition-all"]');
    const slotCount = await droppableSlots.count();
    console.log(`Found ${slotCount} droppable time slots`);

    // Get the first visible slot in a reasonable time (like 9-10 AM area)
    // Each slot is 48px high (HOUR_HEIGHT), starting from 6 AM
    // To target 9 AM: (9-6) * 48 = 144px from top of time grid
    const targetSlot = droppableSlots.nth(3); // 9 AM slot (index 3 = hour 9)
    const slotBox = await targetSlot.boundingBox();

    if (!slotBox) {
      console.log('Could not find target slot - trying alternate approach');
      // Try to find any slot
      for (let i = 0; i < Math.min(slotCount, 10); i++) {
        const slot = droppableSlots.nth(i);
        const box = await slot.boundingBox();
        if (box) {
          console.log(`Found slot ${i} at: x=${box.x}, y=${box.y}`);
        }
      }
      return;
    }

    console.log(`Target slot position: x=${slotBox.x}, y=${slotBox.y}`);

    // Take screenshot before drag
    await page.screenshot({
      path: 'screenshots/dnd-02-before-drag.png',
      fullPage: true
    });

    // Perform drag and drop
    console.log('\nStarting drag operation...');
    const startX = taskBox.x + taskBox.width / 2;
    const startY = taskBox.y + taskBox.height / 2;
    const endX = slotBox.x + slotBox.width / 2;
    const endY = slotBox.y + slotBox.height / 2;

    console.log(`Dragging from (${startX}, ${startY}) to (${endX}, ${endY})`);

    // Use mouse actions for drag
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.waitForTimeout(100);

    // Screenshot during drag
    await page.screenshot({
      path: 'screenshots/dnd-03-drag-start.png',
      fullPage: true
    });

    await page.mouse.move(endX, endY, { steps: 10 });
    await page.waitForTimeout(100);

    // Screenshot before drop
    await page.screenshot({
      path: 'screenshots/dnd-04-drag-over.png',
      fullPage: true
    });

    await page.mouse.up();
    console.log('Drag completed');

    // Wait for API call and UI update
    await page.waitForTimeout(3000);

    // Screenshot after drop
    await page.screenshot({
      path: 'screenshots/dnd-05-after-drop.png',
      fullPage: true
    });

    // Report schedule API calls
    console.log('\n=== Schedule API Calls ===');
    if (scheduleRequests.length > 0) {
      scheduleRequests.forEach((r, i) => {
        console.log(`${i + 1}. ${r.method} ${r.url}`);
        console.log(`   Request body: ${r.body}`);
        console.log(`   Status: ${r.status}`);
        console.log(`   Response: ${r.response?.substring(0, 200)}`);
      });
    } else {
      console.log('NO SCHEDULE API CALLS MADE - This is the bug!');
    }

    // Report console errors
    console.log('\n=== Console Errors ===');
    if (consoleErrors.length > 0) {
      consoleErrors.forEach((e, i) => console.log(`${i + 1}. ${e}`));
    } else {
      console.log('No console errors');
    }

    // Check if task now appears in the calendar (scheduled tasks section)
    // The task should now appear in the "Tasks" column for the day it was dropped on
    const calendarTaskBlocks = page.locator('[class*="border-l-2"][class*="border-white"]');
    const scheduledTaskCount = await calendarTaskBlocks.count();
    console.log(`\nScheduled task blocks visible in calendar: ${scheduledTaskCount}`);

    // Verify the task title appears in the calendar
    if (taskTitle) {
      const taskInCalendar = page.locator('.flex-1.min-w-0').getByText(taskTitle, { exact: false });
      const isInCalendar = await taskInCalendar.count() > 0;
      console.log(`Task "${taskTitle}" visible in calendar: ${isInCalendar}`);
    }

    // Wait for query invalidation to complete and check if task was removed from backlog
    await page.waitForTimeout(2000); // Give time for query invalidation

    // Re-check if the task is still in the backlog after refetch
    const taskInBacklogAfterRefetch = await page.locator(`[class*="bg-slate-800"][class*="border-l-4"]:has-text("${taskTitle}")`).count();
    console.log(`Task "${taskTitle}" still in backlog after refetch: ${taskInBacklogAfterRefetch > 0}`);

    // Summary
    console.log('\n=== Drag-Drop Test Summary ===');
    if (scheduleRequests.length > 0 && scheduleRequests[0].status === 200) {
      console.log('SUCCESS: Schedule API was called and returned 200');
    } else if (scheduleRequests.length > 0) {
      console.log(`PARTIAL: Schedule API was called but returned status ${scheduleRequests[0].status}`);
    } else {
      console.log('FAILURE: Schedule API was never called - drag-drop may not be working');
    }
  });

  test('should verify scheduled tasks appear in calendar on page reload', async ({ page }) => {
    await page.goto('http://localhost:5173/weekly-planning');
    await page.waitForTimeout(3000);

    // Look for tasks that already have scheduled times
    // These should appear in the right "Tasks" column of each day

    // First, let's check what tasks are in the weekly-backlog with scheduled times via API
    const response = await page.request.get('http://localhost:3000/api/tasks?label=weekly-backlog&limit=50');
    const data = await response.json();

    console.log('\n=== Tasks with weekly-backlog label ===');
    const tasksWithLabel = data.data || [];
    tasksWithLabel.forEach((t: any, i: number) => {
      console.log(`${i + 1}. ${t.title}`);
      console.log(`   scheduledStart: ${t.scheduledStart}`);
      console.log(`   scheduledEnd: ${t.scheduledEnd}`);
    });

    const scheduledTasks = tasksWithLabel.filter((t: any) => t.scheduledStart);
    console.log(`\nTasks with scheduledStart: ${scheduledTasks.length}`);

    // Check if these scheduled tasks appear in the UI calendar
    await page.screenshot({
      path: 'screenshots/dnd-06-scheduled-check.png',
      fullPage: true
    });

    for (const task of scheduledTasks) {
      const taskInCalendar = page.getByText(task.title, { exact: false });
      const count = await taskInCalendar.count();
      console.log(`Task "${task.title}" visible in UI: ${count > 0}`);
    }
  });

  test('DEBUG: analyze droppable slot IDs', async ({ page }) => {
    await page.goto('http://localhost:5173/weekly-planning');
    await page.waitForTimeout(3000);

    // Log all elements that might be droppable
    const allDivs = await page.locator('div').all();
    let droppableCount = 0;

    console.log('\n=== Analyzing potential droppable elements ===');

    // Look for elements that have dnd-kit droppable data attributes
    for (const div of allDivs) {
      const dataDroppable = await div.getAttribute('data-droppable');
      const role = await div.getAttribute('role');
      const id = await div.getAttribute('id');

      if (dataDroppable || role === 'listitem' || id?.startsWith('slot-')) {
        droppableCount++;
        const box = await div.boundingBox();
        console.log(`Found: id=${id}, data-droppable=${dataDroppable}, role=${role}, box=${JSON.stringify(box)}`);
      }
    }

    console.log(`\nTotal potential droppables found: ${droppableCount}`);

    // Check if dnd-kit is properly initialized by looking for the DndContext
    const pageContent = await page.content();
    const hasDndContext = pageContent.includes('DndContext') || pageContent.includes('data-rbd');
    console.log(`Page has DnD context markers: ${hasDndContext}`);

    await page.screenshot({
      path: 'screenshots/dnd-07-debug-droppables.png',
      fullPage: true
    });
  });
});

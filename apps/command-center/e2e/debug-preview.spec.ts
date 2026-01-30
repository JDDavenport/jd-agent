import { test } from '@playwright/test';

test('debug preview visibility', async ({ page }) => {
  const logs: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    // Capture all debug logs we care about
    if (text.includes('[Preview]') || text.includes('[Column') || text.includes('[HoverPreview]') || text.includes('[YCalc]')) {
      logs.push(text);
    }
  });

  await page.goto('http://localhost:5173/weekly-planning');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);

  // Check if system is online
  const statusText = await page.locator('text=Online').count();
  if (statusText === 0) {
    console.log('WARNING: System appears to be offline!');
  }

  // First, screenshot to see page layout
  await page.screenshot({ path: 'screenshots/debug-preview-initial.png', fullPage: true });
  console.log('Screenshot saved to screenshots/debug-preview-initial.png');

  // Always try to add a backlog task for testing
  console.log('Adding a test task to backlog...');
  const addButton = page.locator('button:has-text("Add task")');
  if (await addButton.count() > 0) {
    await addButton.click();
    await page.waitForTimeout(300);

    const input = page.locator('input[placeholder*="Type task"]');
    if (await input.count() > 0) {
      await input.fill('Hover Preview Test ' + Date.now());
      await input.press('Enter');
      await page.waitForTimeout(1500);
      console.log('Added test task to backlog');

      // Take screenshot after adding
      await page.screenshot({ path: 'screenshots/debug-preview-after-add.png' });
    }
  }

  // Find ALL draggable tasks and report positions
  const allTasks = page.locator('.cursor-grab');
  const count = await allTasks.count();
  console.log('\n=== FOUND TASKS ===');
  console.log('Total draggable tasks:', count);

  const taskPositions: { index: number, x: number, y: number, text: string }[] = [];
  for (let i = 0; i < count && i < 10; i++) {
    const task = allTasks.nth(i);
    const box = await task.boundingBox();
    const text = await task.textContent();
    if (box) {
      taskPositions.push({ index: i, x: box.x, y: box.y, text: text?.slice(0, 30) || '' });
      console.log(`Task ${i}: x=${box.x.toFixed(0)}, y=${box.y.toFixed(0)}, text="${text?.slice(0, 30)}..."`);
    }
  }

  // Find a backlog task - look in the left panel with data attribute
  const backlogPanel = page.locator('[data-backlog-panel]');
  const hasBacklogPanel = await backlogPanel.count() > 0;
  console.log('\nBacklog panel exists:', hasBacklogPanel);

  // Also look for SortableContext items in backlog
  const sortableTasks = page.locator('[data-sortable-task]');
  const sortableCount = await sortableTasks.count();
  console.log('Sortable tasks in backlog:', sortableCount);

  // Try finding any task to drag - backlog preferred (x < 600) but scheduled tasks work too
  let taskToUse = null;
  let taskSource = '';

  // First try backlog tasks
  for (const t of taskPositions) {
    if (t.x < 600) {
      taskToUse = allTasks.nth(t.index);
      taskSource = 'backlog';
      console.log('\nUsing backlog task at index', t.index, ':', t.text);
      break;
    }
  }

  // If no backlog, use a scheduled task in the calendar body (y between 200-700)
  if (!taskToUse && count > 0) {
    for (const t of taskPositions) {
      // Pick a task in the main calendar body, not header/footer
      if (t.y > 200 && t.y < 700) {
        taskToUse = allTasks.nth(t.index);
        taskSource = 'scheduled';
        console.log('\nUsing scheduled task at index', t.index, ':', t.text, 'at y=', t.y);
        break;
      }
    }
    // Fallback to first task if none in body
    if (!taskToUse) {
      taskToUse = allTasks.first();
      taskSource = 'fallback';
      console.log('\nFallback to first task (no tasks in calendar body)');
    }
  }

  if (!taskToUse) {
    console.log('\nNO TASKS FOUND - cannot test drag');
    return;
  }

  const taskBox = await taskToUse.boundingBox();
  console.log('Task source:', taskSource);
  console.log('\n=== STARTING DRAG TEST ===');
  console.log('Task box:', JSON.stringify(taskBox));

  if (taskBox) {
    // Start drag
    const startX = taskBox.x + 30;
    const startY = taskBox.y + 10;
    console.log(`Starting drag at (${startX}, ${startY})`);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.waitForTimeout(150);

    // Move a little to trigger drag activation
    await page.mouse.move(startX + 10, startY + 5, { steps: 3 });
    await page.waitForTimeout(150);

    // Check if DragOverlay appeared (confirms dnd-kit drag started)
    const hasOverlay = await page.locator('[style*="pointer-events: none"]').count();
    console.log('Drag overlay elements:', hasOverlay);

    // Look for any element with transform style (drag indicator)
    const transformedEls = await page.evaluate(() => {
      const els = document.querySelectorAll('*');
      let count = 0;
      els.forEach(el => {
        const style = getComputedStyle(el);
        if (style.transform && style.transform !== 'none') {
          count++;
        }
      });
      return count;
    });
    console.log('Elements with transform:', transformedEls);

    // Get calendar area bounds
    const calendarGrid = page.locator('[class*="flex-1 overflow-auto"]').first();
    const calBox = await calendarGrid.boundingBox();
    console.log('Calendar/scroll area bounds:', JSON.stringify(calBox));

    // Move across the page toward the right side where calendar is
    const targetX = calBox ? calBox.x + calBox.width * 0.5 : 800;
    const targetY = calBox ? calBox.y + 200 : 400;

    console.log(`Dragging to (${targetX}, ${targetY})`);
    await page.mouse.move(targetX, targetY, { steps: 15 });
    await page.waitForTimeout(400);

    // Take screenshot during drag
    await page.screenshot({ path: 'screenshots/debug-preview-during-drag.png', fullPage: true });
    console.log('Screenshot saved to screenshots/debug-preview-during-drag.png');

    // Check again for overlay/transform
    const overlayAfter = await page.locator('[style*="pointer-events: none"]').count();
    console.log('Drag overlay elements after move:', overlayAfter);

    // Get scroll position
    const scrollPos = await page.evaluate(() => {
      const scrollEl = document.querySelector('.flex-1.overflow-auto');
      return scrollEl ? scrollEl.scrollTop : -1;
    });
    console.log('Calendar scroll position:', scrollPos);

    await page.mouse.up();
    await page.waitForTimeout(200);
  }

  console.log('\n=== CONSOLE LOGS ===');
  if (logs.length === 0) {
    console.log('WARNING: No [Preview] or [Column] logs captured!');
    console.log('This means useDndMonitor.onDragMove is not firing, or logs are filtered differently');
  } else {
    // Show first 20 logs
    logs.slice(0, 20).forEach(l => console.log(l));
    if (logs.length > 20) {
      console.log(`... and ${logs.length - 20} more logs`);
    }

    // Summary
    const previewLogs = logs.filter(l => l.includes('[Preview]'));
    const columnLogs = logs.filter(l => l.includes('[Column'));
    const matchLogs = logs.filter(l => l.includes('match=true'));

    console.log('\n=== SUMMARY ===');
    console.log('Total logs:', logs.length);
    console.log('[Preview] logs:', previewLogs.length);
    console.log('[Column] logs:', columnLogs.length);
    console.log('Columns with match=true:', matchLogs.length);

    if (matchLogs.length > 0) {
      console.log('\nMatched columns:');
      matchLogs.slice(0, 5).forEach(l => console.log(l));
    }
  }
});

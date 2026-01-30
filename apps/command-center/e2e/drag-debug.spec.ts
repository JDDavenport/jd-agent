import { test, expect } from '@playwright/test';

test('debug drag and drop console logs', async ({ page }) => {
  // Collect console logs
  const consoleLogs: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    consoleLogs.push('[' + type + '] ' + text);
  });

  console.log('Navigating to Weekly Planning...');
  await page.goto('http://localhost:5173/weekly-planning');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Take initial screenshot
  await page.screenshot({ path: 'screenshots/drag-debug-01-initial.png', fullPage: false });
  console.log('Screenshot 1: Initial state saved');

  // Check if there are tasks in the backlog - if not, add one
  const backlogText = await page.locator('text=No tasks in backlog').count();
  if (backlogText > 0) {
    console.log('No tasks in backlog - adding one via the add button');

    // Click the add button
    const addButton = page.locator('button:has-text("Add task")');
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(300);

      // Type a task title
      const input = page.locator('input[placeholder*="Type task"]');
      await input.fill('Test drag task');
      await input.press('Enter');
      await page.waitForTimeout(2000); // Wait longer for task to appear

      console.log('Task added via quick add');
      await page.screenshot({ path: 'screenshots/drag-debug-02-after-add.png' });
    }
  }

  // NOW find draggable elements (after adding task)
  const allDraggables = await page.evaluate(() => {
    const elements: any[] = [];
    document.querySelectorAll('[draggable="true"]').forEach(el => {
      const rect = el.getBoundingClientRect();
      elements.push({
        tag: el.tagName,
        id: el.id,
        classes: el.className,
        text: (el.textContent || '').substring(0, 50),
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      });
    });
    return elements;
  });
  console.log('Draggable elements:', JSON.stringify(allDraggables, null, 2));

  // Look for elements that look like task cards (even if not draggable)
  const taskCards = await page.evaluate(() => {
    const elements: any[] = [];
    // Look for elements with cursor-grab class or task-related classes
    document.querySelectorAll('.cursor-grab, [class*="task"], [class*="backlog"]').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 20 && rect.height < 200) {
        elements.push({
          tag: el.tagName,
          classes: el.className.substring(0, 100),
          text: (el.textContent || '').substring(0, 50),
          draggable: el.getAttribute('draggable'),
          role: el.getAttribute('role'),
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        });
      }
    });
    return elements;
  });
  console.log('Task-like elements:', JSON.stringify(taskCards, null, 2));

  // Find elements with data attributes that might be drop targets
  const dropTargets = await page.evaluate(() => {
    const elements: any[] = [];
    document.querySelectorAll('[data-droppable-id], [data-date]').forEach(el => {
      const rect = el.getBoundingClientRect();
      elements.push({
        tag: el.tagName,
        droppableId: (el as any).dataset.droppableId,
        date: (el as any).dataset.date,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      });
    });
    return elements;
  });
  console.log('Drop targets:', JSON.stringify(dropTargets, null, 2));

  // Look for dnd-kit specific attributes
  const dndElements = await page.evaluate(() => {
    const result: any = {
      sortableItems: document.querySelectorAll('[data-sortable-id]').length,
      draggableItems: document.querySelectorAll('[data-draggable-id]').length,
      droppableItems: document.querySelectorAll('[data-droppable-id]').length,
    };

    // Get more details about droppables
    result.droppableDetails = [];
    document.querySelectorAll('[data-droppable-id]').forEach(el => {
      const rect = el.getBoundingClientRect();
      result.droppableDetails.push({
        id: (el as any).dataset.droppableId,
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      });
    });

    return result;
  });
  console.log('DnD-kit elements:', JSON.stringify(dndElements, null, 2));

  // If still no draggable elements, try to find task cards by their visual structure
  if (allDraggables.length === 0) {
    console.log('Looking for task cards with cursor-grab style...');

    // Find the backlog panel first
    const backlogPanel = page.locator('text=Weekly Backlog').locator('..').locator('..');
    const panelBox = await backlogPanel.boundingBox();
    console.log('Backlog panel bounds:', panelBox);

    // Look for divs that could be task cards inside the backlog
    const taskLikeElements = await page.evaluate(() => {
      const elements: any[] = [];
      document.querySelectorAll('div').forEach(el => {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        // Task cards typically have a specific height range and cursor style
        if (rect.width > 100 && rect.height > 30 && rect.height < 150 &&
            (style.cursor === 'grab' || el.className.includes('grab') || el.className.includes('bg-slate-800'))) {
          elements.push({
            tag: el.tagName,
            classes: el.className.substring(0, 150),
            text: (el.textContent || '').substring(0, 60),
            cursor: style.cursor,
            draggable: el.getAttribute('draggable'),
            tabIndex: el.getAttribute('tabindex'),
            role: el.getAttribute('role'),
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          });
        }
      });
      return elements;
    });
    console.log('Task-like divs:', JSON.stringify(taskLikeElements, null, 2));

    // If we found task-like elements, try to drag one
    if (taskLikeElements.length > 0) {
      const taskToDrag = taskLikeElements.find((t: any) => t.text.includes('Test drag task')) || taskLikeElements[0];
      console.log('Will try to drag task-like element:', taskToDrag.text);

      const startX = taskToDrag.x + taskToDrag.width / 2;
      const startY = taskToDrag.y + taskToDrag.height / 2;
      const targetX = 800;
      const targetY = 300;

      console.log('Drag from (' + startX + ', ' + startY + ') to (' + targetX + ', ' + targetY + ')');

      await page.screenshot({ path: 'screenshots/drag-debug-03-before-drag.png' });

      const dragStartIndex = consoleLogs.length;

      // Perform drag
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.waitForTimeout(300);

      // Move slowly to trigger drag events
      const steps = 20;
      for (let i = 0; i <= steps; i++) {
        const x = startX + (targetX - startX) * i / steps;
        const y = startY + (targetY - startY) * i / steps;
        await page.mouse.move(x, y);
        await page.waitForTimeout(30);
      }

      await page.screenshot({ path: 'screenshots/drag-debug-04-during-drag.png' });

      await page.mouse.up();
      await page.waitForTimeout(500);

      await page.screenshot({ path: 'screenshots/drag-debug-05-after-drag.png' });

      // Print drag-related logs
      console.log('\n=== CONSOLE LOGS DURING DRAG ===');
      const dragLogs = consoleLogs.slice(dragStartIndex);
      dragLogs.forEach(log => console.log(log));
      console.log('=== END DRAG LOGS ===\n');

      // Specifically look for DragEnd logs
      const dragEndLogs = consoleLogs.filter(log => log.includes('DragEnd') || log.includes('dragEnd'));
      console.log('\n=== DragEnd SPECIFIC LOGS ===');
      dragEndLogs.forEach(log => console.log(log));
      console.log('=== END DragEnd LOGS ===\n');
    }
  } else {
    // Original code for when draggables are found
    const taskToDrag = allDraggables[0];
    console.log('Will try to drag:', taskToDrag.text);

    const startX = taskToDrag.x + taskToDrag.width / 2;
    const startY = taskToDrag.y + taskToDrag.height / 2;

    let targetX = 800;
    let targetY = 400;

    if (dndElements.droppableDetails && dndElements.droppableDetails.length > 0) {
      const droppable = dndElements.droppableDetails.find((d: any) =>
        d.x > startX + 100 || d.x < startX - 100
      ) || dndElements.droppableDetails[0];

      targetX = droppable.x + droppable.width / 2;
      targetY = droppable.y + 100;
      console.log('Target droppable:', droppable.id);
    }

    console.log('Drag from (' + startX + ', ' + startY + ') to (' + targetX + ', ' + targetY + ')');

    await page.screenshot({ path: 'screenshots/drag-debug-03-before-drag.png' });

    const dragStartIndex = consoleLogs.length;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.waitForTimeout(200);

    const steps = 10;
    for (let i = 0; i <= steps; i++) {
      const x = startX + (targetX - startX) * i / steps;
      const y = startY + (targetY - startY) * i / steps;
      await page.mouse.move(x, y);
      await page.waitForTimeout(50);
    }

    await page.screenshot({ path: 'screenshots/drag-debug-04-during-drag.png' });

    await page.mouse.up();
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'screenshots/drag-debug-05-after-drag.png' });

    console.log('\n=== CONSOLE LOGS DURING DRAG ===');
    const dragLogs = consoleLogs.slice(dragStartIndex);
    dragLogs.forEach(log => console.log(log));
    console.log('=== END DRAG LOGS ===\n');

    const dragEndLogs = consoleLogs.filter(log => log.includes('DragEnd') || log.includes('dragEnd'));
    console.log('\n=== DragEnd SPECIFIC LOGS ===');
    dragEndLogs.forEach(log => console.log(log));
    console.log('=== END DragEnd LOGS ===\n');
  }

  // Wait for any delayed logs
  await page.waitForTimeout(1000);

  // Inject console logs into the page for screenshot
  await page.evaluate((logs: string[]) => {
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:0;left:0;right:0;background:black;color:lime;font-family:monospace;font-size:11px;padding:10px;z-index:99999;max-height:400px;overflow:auto;white-space:pre-wrap;';
    div.innerHTML = '<strong>Console Logs (filtered for drag):</strong><br>' +
      logs.filter(l => l.toLowerCase().includes('drag') || l.toLowerCase().includes('drop'))
        .map(l => l.replace(/</g, '&lt;'))
        .join('<br>');
    document.body.prepend(div);
  }, consoleLogs);

  await page.screenshot({ path: 'screenshots/drag-debug-06-with-logs.png', fullPage: false });

  console.log('\n=== ALL CAPTURED CONSOLE LOGS ===');
  consoleLogs.forEach(log => console.log(log));
});

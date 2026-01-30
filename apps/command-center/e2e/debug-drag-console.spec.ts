import { test, expect } from '@playwright/test';

test('debug hover preview console logs', async ({ page }) => {
  const dragLogs: string[] = [];
  const allLogs: string[] = [];

  // Capture ALL console logs to see what's happening
  page.on('console', msg => {
    const text = msg.text();
    allLogs.push(`[${msg.type()}] ${text}`);
    if (text.includes('[DragMove]') || text.includes('[DragEnd]') ||
        text.includes('drag') || text.includes('Drag') ||
        text.includes('drop') || text.includes('Drop') ||
        text.includes('over') || text.includes('Over')) {
      dragLogs.push(text);
    }
  });

  await page.goto('/weekly-planning');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Take initial screenshot
  await page.screenshot({ path: 'screenshots/debug-drag-initial.png', fullPage: true });

  // Find scheduled tasks on the calendar (they have cursor-grab class)
  const scheduledTasks = page.locator('.cursor-grab');
  const taskCount = await scheduledTasks.count();
  console.log('Found scheduled tasks:', taskCount);

  if (taskCount > 0) {
    const task = scheduledTasks.first();
    const taskText = await task.textContent();
    console.log('First task text:', taskText?.trim());

    const taskBox = await task.boundingBox();
    console.log('Task bounding box:', taskBox);

    if (taskBox) {
      // Try using Playwright's built-in drag method
      const startX = taskBox.x + taskBox.width / 2;
      const startY = taskBox.y + taskBox.height / 2;
      const targetY = startY + 100;

      console.log('Attempting drag using dragTo...');

      // Use locator-based drag
      try {
        // Find a target element to drag to - let's use the calendar grid area
        // We'll create a target position
        await task.dragTo(task, {
          targetPosition: { x: taskBox.width / 2, y: taskBox.height / 2 + 100 },
          force: true,
        });
        console.log('dragTo completed');
      } catch (e) {
        console.log('dragTo failed:', e);
      }

      await page.screenshot({ path: 'screenshots/debug-drag-after-dragTo.png' });

      // Alternative: Try with pointer events directly via evaluate
      console.log('\nTrying via page.evaluate with PointerEvents...');

      await page.evaluate(async ({ startX, startY, targetY }) => {
        const element = document.elementFromPoint(startX, startY);
        if (!element) {
          console.log('No element at start position');
          return;
        }
        console.log('Found element:', element.className);

        // Create and dispatch pointer events
        const createPointerEvent = (type: string, x: number, y: number) => {
          return new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: 1,
            pointerType: 'mouse',
            clientX: x,
            clientY: y,
            screenX: x,
            screenY: y,
            button: 0,
            buttons: type === 'pointerup' ? 0 : 1,
            pressure: type === 'pointerup' ? 0 : 0.5,
            isPrimary: true,
          });
        };

        // Dispatch pointerdown
        element.dispatchEvent(createPointerEvent('pointerdown', startX, startY));
        console.log('Dispatched pointerdown');

        // Wait a bit
        await new Promise(r => setTimeout(r, 50));

        // Dispatch pointermove events
        for (let i = 0; i <= 10; i++) {
          const progress = i / 10;
          const currentY = startY + (targetY - startY) * progress;
          const targetEl = document.elementFromPoint(startX, currentY) || element;
          targetEl.dispatchEvent(createPointerEvent('pointermove', startX, currentY));
          await new Promise(r => setTimeout(r, 20));
        }
        console.log('Dispatched pointermove events');

        // Dispatch pointerup
        const finalEl = document.elementFromPoint(startX, targetY) || element;
        finalEl.dispatchEvent(createPointerEvent('pointerup', startX, targetY));
        console.log('Dispatched pointerup');

      }, { startX, startY, targetY });

      await page.waitForTimeout(500);
      await page.screenshot({ path: 'screenshots/debug-drag-after-pointer-events.png' });
    }
  } else {
    console.log('No tasks found to drag');
  }

  await page.waitForTimeout(500);

  // Output logs
  console.log('\n=== DRAG-RELATED LOGS ===');
  if (dragLogs.length === 0) {
    console.log('(none captured)');
  } else {
    dragLogs.forEach(log => console.log(log));
  }
  console.log('=== END DRAG LOGS ===');
  console.log('Total drag-related logs:', dragLogs.length);

  console.log('\n=== ALL CONSOLE LOGS ===');
  allLogs.forEach(log => console.log(log));
  console.log('=== END ALL LOGS ===');
  console.log('Total console logs:', allLogs.length);
});

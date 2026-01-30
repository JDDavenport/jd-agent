import { test, expect } from '@playwright/test';

test('debug hover preview console logs', async ({ page }) => {
  const logs: string[] = [];

  // Capture console logs
  page.on('console', msg => {
    if (msg.text().includes('[DragMove]') || msg.text().includes('[DragEnd]')) {
      logs.push(msg.text());
    }
  });

  await page.goto('/weekly-planning');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Find a backlog task
  const backlogTask = page.locator('[data-droppable-id]').first().or(
    page.locator('.cursor-grab').first()
  );

  // If no backlog tasks, check what's on the page
  const backlogPanel = page.locator('text=Weekly Backlog');
  const taskCount = await page.locator('.cursor-grab').count();
  console.log('Found tasks with cursor-grab:', taskCount);

  if (taskCount > 0) {
    const task = page.locator('.cursor-grab').first();
    const taskBox = await task.boundingBox();

    // Find a day column
    const dayColumn = page.locator('[class*="flex-1 relative"]').first();
    const dayBox = await dayColumn.boundingBox();

    if (taskBox && dayBox) {
      // Perform drag
      await page.mouse.move(taskBox.x + 50, taskBox.y + 10);
      await page.mouse.down();
      await page.waitForTimeout(100);

      // Move to day column
      await page.mouse.move(dayBox.x + 50, dayBox.y + 200, { steps: 10 });
      await page.waitForTimeout(500);

      // Move up and down
      await page.mouse.move(dayBox.x + 50, dayBox.y + 100, { steps: 5 });
      await page.waitForTimeout(300);
      await page.mouse.move(dayBox.x + 50, dayBox.y + 300, { steps: 5 });
      await page.waitForTimeout(300);

      await page.mouse.up();
    }
  }

  await page.waitForTimeout(500);

  // Output all captured logs
  console.log('=== CAPTURED CONSOLE LOGS ===');
  logs.forEach(log => console.log(log));
  console.log('=== END LOGS ===');
  console.log('Total DragMove logs captured:', logs.length);
});

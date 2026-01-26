/**
 * Debug test to understand hover preview positioning
 */

import { test, expect } from '@playwright/test';
import {
  navigateToWeeklyPlanning,
  createBacklogTask,
  deleteTask,
  takeScreenshot,
} from './test-helpers';

test.describe('Debug: Hover Preview Positioning', () => {
  const createdTaskIds: string[] = [];

  test.afterEach(async ({ page }) => {
    for (const taskId of createdTaskIds) {
      try {
        await deleteTask(page, taskId);
      } catch (e) {}
    }
    createdTaskIds.length = 0;
  });

  test('Debug: Find exact calendar grid coordinates', async ({ page }) => {
    const testTitle = `Debug Test ${Date.now()}`;
    const task = await createBacklogTask(page, testTitle, { timeEstimate: 30 });
    createdTaskIds.push(task.id);

    await navigateToWeeklyPlanning(page);

    // Find the task card
    const taskCard = page.locator(`text=${testTitle}`).locator('xpath=ancestor::div[contains(@class, "bg-slate-800")]').first();
    await expect(taskCard).toBeVisible();
    const taskBox = await taskCard.boundingBox();
    console.log('Task card box:', taskBox);

    // Get viewport size
    const viewportSize = page.viewportSize();
    console.log('Viewport size:', viewportSize);

    // Find the calendar container (outer)
    const calendarOuter = page.locator('[class*="bg-slate-900"][class*="rounded-lg"][class*="border-slate-700"]').first();
    const outerBox = await calendarOuter.boundingBox();
    console.log('Calendar outer box:', outerBox);

    // Find the scrollable area
    const scrollArea = page.locator('.flex-1.overflow-auto').first();
    const scrollBox = await scrollArea.boundingBox();
    console.log('Scroll area box:', scrollBox);

    // Find the time labels column
    const timeLabels = page.locator('.w-14.flex-shrink-0.bg-slate-900').first();
    const timeBox = await timeLabels.boundingBox();
    console.log('Time labels box:', timeBox);

    // Find the first day column
    const dayColumns = page.locator('[class*="border-r"][class*="border-slate-700"]').filter({ hasNot: page.locator('.w-14') });
    const firstDayBox = await dayColumns.first().boundingBox();
    console.log('First day column box:', firstDayBox);

    // Find day header to understand sticky offset (in the calendar)
    const dayHeader = page.locator('.sticky.top-0.z-10.flex.bg-slate-800');
    const headerBox = await dayHeader.boundingBox();
    console.log('Sticky day header box:', headerBox);

    // Now drag the task to a known position
    if (!taskBox) throw new Error('No task box');

    // Start drag
    await page.mouse.move(taskBox.x + taskBox.width / 2, taskBox.y + taskBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(200);

    // Calculate target: Sunday's Tasks column, around 10am
    // Time labels start at x=585, days follow from there
    // Day width is 140px, Tasks column is right half (70-140px within each day)

    if (!timeBox) throw new Error('No time labels box');
    if (!headerBox) throw new Error('No header box');

    // Target: First day (Sunday), Tasks column (right half), around 10am
    // X = time labels right edge (585+56=641) + right half of first day column (70px to 140px)
    // Let's aim for the middle of the Tasks column: x = 641 + 70 + 35 = 746
    const targetX = timeBox.x + timeBox.width + 70 + 35;

    // Y = header bottom + time offset for 10am
    // Header is at y=215, height=82.5, so content starts at ~297.5
    // 10am is 4 hours from 6am start, at 48px per hour = 192px
    const targetY = headerBox.y + headerBox.height + 192;

    console.log(`Moving to target: (${targetX}, ${targetY})`);

    await page.mouse.move(targetX, targetY, { steps: 20 });
    await page.waitForTimeout(500);

    await takeScreenshot(page, 'debug-hover-01-target');

    // Check for hover preview
    const hoverPreview = page.locator('[class*="bg-emerald"]');
    const previewCount = await hoverPreview.count();
    console.log('Hover preview count:', previewCount);

    if (previewCount > 0) {
      const previewBox = await hoverPreview.first().boundingBox();
      console.log('Hover preview box:', previewBox);
    }

    // Try moving more to the right (definitely in Tasks column)
    const targetX2 = timeBox.x + timeBox.width + 140 - 10; // Near right edge of first day
    console.log(`Moving to target2: (${targetX2}, ${targetY})`);

    await page.mouse.move(targetX2, targetY, { steps: 10 });
    await page.waitForTimeout(500);

    await takeScreenshot(page, 'debug-hover-02-right-edge');

    const previewCount2 = await hoverPreview.count();
    console.log('Hover preview count at right edge:', previewCount2);

    await page.mouse.up();
  });
});

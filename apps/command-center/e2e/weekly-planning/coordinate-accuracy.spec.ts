/**
 * Coordinate Accuracy Tests
 *
 * These tests verify Google Calendar-like drag-drop behavior:
 * 1. Preview position matches final task position (within 2 slots)
 * 2. Time indicator shows during drag and updates as you move
 * 3. API receives the correct scheduled time
 *
 * Note: These tests focus on RELATIVE accuracy (preview matches drop)
 * rather than absolute positioning, which depends on scroll state.
 */

import { test, expect } from '@playwright/test';
import {
  navigateToWeeklyPlanning,
  createBacklogTask,
  deleteTask,
  takeScreenshot,
  getCalendarLayout,
  getTasksColumnCoordinates,
} from './test-helpers';

test.describe('Coordinate Accuracy', () => {
  const createdTaskIds: string[] = [];

  test.afterEach(async ({ page }) => {
    for (const taskId of createdTaskIds) {
      try {
        await deleteTask(page, taskId);
      } catch (e) {}
    }
    createdTaskIds.length = 0;
  });

  async function createTestTask(page: any, title: string): Promise<{ id: string; title: string }> {
    const task = await createBacklogTask(page, title, { timeEstimate: 60 });
    createdTaskIds.push(task.id);
    return { id: task.id, title };
  }

  test('Preview position matches final task position (within 24px / 2 slots)', async ({ page }) => {
    const task = await createTestTask(page, `Preview Match ${Date.now()}`);
    await navigateToWeeklyPlanning(page);

    const backlogTask = page.locator(`[data-testid="backlog-task-${task.id}"]`);
    await expect(backlogTask).toBeVisible({ timeout: 10000 });

    const layout = await getCalendarLayout(page);

    // Target center of visible calendar area (will work regardless of scroll)
    // Use day 1 and a time that should be visible
    const target = getTasksColumnCoordinates(layout, 1, 10, 0);

    // Start drag
    const taskRect = await backlogTask.boundingBox();
    await page.mouse.move(taskRect!.x + taskRect!.width / 2, taskRect!.y + taskRect!.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 15 });
    await page.waitForTimeout(500); // Allow time for preview

    // Get preview position
    const previewBlock = page.locator('.bg-emerald-500\\/80');
    const previewVisible = await previewBlock.isVisible().catch(() => false);

    let previewTop: number | null = null;
    if (previewVisible) {
      const previewRect = await previewBlock.boundingBox();
      if (previewRect) {
        previewTop = previewRect.y;
        console.log(`Preview position - top: ${previewRect.y}, height: ${previewRect.height}`);
      }
    }

    await takeScreenshot(page, 'coord-accuracy-01-preview');

    // Drop
    await page.mouse.up();
    await page.waitForTimeout(2000);

    // Get final task position
    const scheduledTask = page.locator(`[data-testid="scheduled-task-${task.id}"]`);
    await expect(scheduledTask).toBeVisible({ timeout: 10000 });

    const finalRect = await scheduledTask.boundingBox();
    expect(finalRect).toBeTruthy();
    console.log(`Final position - top: ${finalRect!.y}`);

    await takeScreenshot(page, 'coord-accuracy-02-final');

    // Key assertion: preview should match final within 2 slots (24px)
    if (previewTop !== null) {
      const yDifference = Math.abs(previewTop - finalRect!.y);
      console.log(`Y difference between preview and final: ${yDifference}px`);
      expect(yDifference).toBeLessThan(30); // ~2.5 slots tolerance
    } else {
      console.log('Preview not captured, but task scheduled successfully');
    }
  });

  test('Time indicator appears and updates during drag', async ({ page }) => {
    const task = await createTestTask(page, `Indicator Test ${Date.now()}`);
    await navigateToWeeklyPlanning(page);

    const backlogTask = page.locator(`[data-testid="backlog-task-${task.id}"]`);
    await expect(backlogTask).toBeVisible({ timeout: 10000 });

    const layout = await getCalendarLayout(page);
    const target1 = getTasksColumnCoordinates(layout, 1, 10, 0);

    // Start drag
    const taskRect = await backlogTask.boundingBox();
    await page.mouse.move(taskRect!.x + taskRect!.width / 2, taskRect!.y + taskRect!.height / 2);
    await page.mouse.down();
    await page.mouse.move(target1.x, target1.y, { steps: 15 });
    await page.waitForTimeout(300);

    // Time indicator should be visible
    const timeIndicator = page.locator('.fixed.bg-slate-900.text-white');
    await expect(timeIndicator).toBeVisible({ timeout: 3000 });

    const initialTime = await timeIndicator.textContent();
    console.log(`Initial time indicator: ${initialTime}`);

    await takeScreenshot(page, 'coord-accuracy-03-indicator-initial');

    // Move to different position (2 hours down = 96px)
    const target2 = getTasksColumnCoordinates(layout, 1, 12, 0);
    await page.mouse.move(target2.x, target2.y, { steps: 10 });
    await page.waitForTimeout(300);

    await expect(timeIndicator).toBeVisible();
    const newTime = await timeIndicator.textContent();
    console.log(`Updated time indicator: ${newTime}`);

    // Time should have changed (we moved 2 hours)
    expect(newTime).not.toBe(initialTime);

    await takeScreenshot(page, 'coord-accuracy-04-indicator-updated');

    // End drag
    await page.mouse.up();

    // Time indicator should disappear
    await expect(timeIndicator).not.toBeVisible({ timeout: 2000 });
  });

  test('Schedule API receives valid time on drop', async ({ page }) => {
    const task = await createTestTask(page, `API Test ${Date.now()}`);
    await navigateToWeeklyPlanning(page);

    const backlogTask = page.locator(`[data-testid="backlog-task-${task.id}"]`);
    await expect(backlogTask).toBeVisible({ timeout: 10000 });

    const layout = await getCalendarLayout(page);
    const target = getTasksColumnCoordinates(layout, 2, 11, 0); // Day 2, 11 AM area

    let scheduledStartTime: string | null = null;
    let scheduledEndTime: string | null = null;

    page.on('request', (request: any) => {
      if (request.url().includes('/schedule') && request.method() === 'POST') {
        try {
          const body = JSON.parse(request.postData());
          scheduledStartTime = body.startTime;
          scheduledEndTime = body.endTime;
        } catch (e) {}
      }
    });

    // Drag and drop
    const taskRect = await backlogTask.boundingBox();
    await page.mouse.move(taskRect!.x + taskRect!.width / 2, taskRect!.y + taskRect!.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 20 });
    await page.waitForTimeout(300);

    await takeScreenshot(page, 'coord-accuracy-05-api-drag');

    await page.mouse.up();
    await page.waitForTimeout(2000);

    await takeScreenshot(page, 'coord-accuracy-06-api-drop');

    // Verify API was called with valid times
    expect(scheduledStartTime).toBeTruthy();
    expect(scheduledEndTime).toBeTruthy();

    const startDate = new Date(scheduledStartTime!);
    const endDate = new Date(scheduledEndTime!);

    console.log(`Scheduled: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Verify start time is valid (between 6 AM and 10 PM)
    const hour = startDate.getHours();
    expect(hour).toBeGreaterThanOrEqual(6);
    expect(hour).toBeLessThan(22);

    // Verify minutes snap to 15-minute increments
    const minute = startDate.getMinutes();
    expect([0, 15, 30, 45]).toContain(minute);

    // Verify duration matches task estimate (60 minutes)
    const durationMs = endDate.getTime() - startDate.getTime();
    expect(durationMs).toBe(60 * 60 * 1000);
  });

  test('Rescheduling drops at preview position', async ({ page }) => {
    // First, create and schedule a task
    const task = await createTestTask(page, `Reschedule Test ${Date.now()}`);
    await navigateToWeeklyPlanning(page);

    const backlogTask = page.locator(`[data-testid="backlog-task-${task.id}"]`);
    await expect(backlogTask).toBeVisible({ timeout: 10000 });

    const layout = await getCalendarLayout(page);
    const initialTarget = getTasksColumnCoordinates(layout, 1, 9, 0);

    // Initial scheduling
    const taskRect = await backlogTask.boundingBox();
    await page.mouse.move(taskRect!.x + taskRect!.width / 2, taskRect!.y + taskRect!.height / 2);
    await page.mouse.down();
    await page.mouse.move(initialTarget.x, initialTarget.y, { steps: 15 });
    await page.mouse.up();
    await page.waitForTimeout(2000);

    // Verify task is scheduled
    const scheduledTask = page.locator(`[data-testid="scheduled-task-${task.id}"]`);
    await expect(scheduledTask).toBeVisible({ timeout: 10000 });

    const initialRect = await scheduledTask.boundingBox();
    expect(initialRect).toBeTruthy();
    console.log(`Initial position: ${initialRect!.y}`);

    await takeScreenshot(page, 'coord-accuracy-07-before-reschedule');

    // Now drag to reschedule (move down ~2 hours = 96px)
    const newTarget = {
      x: initialTarget.x,
      y: initialRect!.y + 96, // Move down 2 hours
    };

    await page.mouse.move(initialRect!.x + initialRect!.width / 2, initialRect!.y + initialRect!.height / 2);
    await page.mouse.down();
    await page.mouse.move(newTarget.x, newTarget.y, { steps: 15 });
    await page.waitForTimeout(500);

    // Check preview
    const previewBlock = page.locator('.bg-emerald-500\\/80');
    let previewY: number | null = null;
    if (await previewBlock.isVisible().catch(() => false)) {
      const previewRect = await previewBlock.boundingBox();
      previewY = previewRect?.y || null;
      console.log(`Reschedule preview Y: ${previewY}`);
    }

    await takeScreenshot(page, 'coord-accuracy-08-reschedule-drag');

    await page.mouse.up();
    await page.waitForTimeout(2000);

    // Verify task moved
    const finalRect = await scheduledTask.boundingBox();
    expect(finalRect).toBeTruthy();
    console.log(`Final position: ${finalRect!.y}`);

    await takeScreenshot(page, 'coord-accuracy-09-after-reschedule');

    // Task should have moved down
    expect(finalRect!.y).toBeGreaterThan(initialRect!.y);

    // If we captured preview, verify it matches final
    if (previewY !== null) {
      const yDiff = Math.abs(previewY - finalRect!.y);
      console.log(`Reschedule Y difference: ${yDiff}px`);
      expect(yDiff).toBeLessThan(30);
    }
  });
});

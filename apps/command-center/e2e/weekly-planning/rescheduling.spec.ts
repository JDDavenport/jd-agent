/**
 * TS-3: Task Rescheduling Tests
 *
 * Tests:
 * 1. Drag a scheduled task to a different time on same day
 * 2. Verify hover preview appears at new location
 * 3. Drop - task moves to new time
 * 4. Drag a scheduled task to a different day
 * 5. Verify hover preview appears on new day
 * 6. Drop - task moves to new day and time
 *
 * PRD Requirements:
 * - FR-5.1: Scheduled tasks in the calendar should be draggable
 * - FR-5.2: Allow dragging to different time slots on the same day
 * - FR-5.3: Allow dragging to different days
 * - FR-5.4: Show hover preview when rescheduling
 * - FR-5.5: Original task position should show reduced opacity while dragging
 */

import { test, expect } from '@playwright/test';
import {
  navigateToWeeklyPlanning,
  createBacklogTask,
  scheduleTask,
  deleteTask,
  takeScreenshot,
  getCalendarLayout,
  getTasksColumnCoordinates,
  API_URL,
  getCurrentWeekRange,
} from './test-helpers';

test.describe('TS-3: Task Rescheduling', () => {
  const createdTaskIds: string[] = [];

  test.afterEach(async ({ page }) => {
    for (const taskId of createdTaskIds) {
      try {
        await deleteTask(page, taskId);
      } catch (e) {}
    }
    createdTaskIds.length = 0;
  });

  /**
   * Helper to create and schedule a task for testing
   */
  async function createScheduledTask(
    page: any,
    title: string,
    dayOffset: number,
    hour: number,
    duration: number = 60
  ): Promise<{ id: string; title: string }> {
    const task = await createBacklogTask(page, title, { timeEstimate: duration });
    createdTaskIds.push(task.id);

    const { start } = getCurrentWeekRange();
    const scheduleTime = new Date(start);
    scheduleTime.setDate(scheduleTime.getDate() + dayOffset);
    scheduleTime.setHours(hour, 0, 0, 0);
    const endTime = new Date(scheduleTime.getTime() + duration * 60 * 1000);

    await scheduleTask(page, task.id, scheduleTime.toISOString(), endTime.toISOString());

    return { id: task.id, title };
  }

  test('FR-5.1: Scheduled tasks are draggable', async ({ page }) => {
    // Create and schedule a task
    const task = await createScheduledTask(page, `Draggable Task ${Date.now()}`, 1, 10);

    await navigateToWeeklyPlanning(page);

    // Find the scheduled task
    const scheduledTask = page.locator(`[class*="border-l-2"][class*="border-white"]`).filter({ hasText: task.title });
    await expect(scheduledTask).toBeVisible();

    // Verify it has cursor-grab class (indicating draggability)
    await expect(scheduledTask).toHaveClass(/cursor-grab/);

    await takeScreenshot(page, 'rescheduling-01-draggable');
  });

  test('FR-5.2 & FR-5.4: Drag to different time on same day shows preview', async ({ page }) => {
    // Create and schedule a task at 10am
    const task = await createScheduledTask(page, `Same Day Reschedule ${Date.now()}`, 1, 10);

    await navigateToWeeklyPlanning(page);

    // Find the scheduled task
    const scheduledTask = page.locator(`[class*="border-l-2"][class*="border-white"]`).filter({ hasText: task.title });
    await expect(scheduledTask).toBeVisible();

    const taskBox = await scheduledTask.boundingBox();
    if (!taskBox) throw new Error('Could not get task bounding box');

    // Get calendar layout
    const layout = await getCalendarLayout(page);

    // Target: Same day (day 1), different time (12pm)
    const target = getTasksColumnCoordinates(layout, 1, 12, 0);

    // Start dragging
    await page.mouse.move(taskBox.x + taskBox.width / 2, taskBox.y + taskBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(200);

    // Move to new time
    await page.mouse.move(target.x, target.y, { steps: 15 });
    await page.waitForTimeout(300);

    await takeScreenshot(page, 'rescheduling-02-same-day-preview');

    // Verify hover preview is visible
    const hoverPreview = page.locator('[class*="bg-emerald"][class*="border-emerald"]');
    await expect(hoverPreview).toBeVisible();

    // Verify preview shows task title
    const previewText = await hoverPreview.first().textContent();
    expect(previewText).toContain(task.title);

    await page.mouse.up();
  });

  test('FR-5.2: Drop moves task to new time on same day', async ({ page }) => {
    // Create and schedule a task at 10am on day 1
    const task = await createScheduledTask(page, `Same Day Move ${Date.now()}`, 1, 10);

    await navigateToWeeklyPlanning(page);

    // Find the scheduled task
    const scheduledTask = page.locator(`[class*="border-l-2"][class*="border-white"]`).filter({ hasText: task.title });
    await expect(scheduledTask).toBeVisible();

    const taskBox = await scheduledTask.boundingBox();
    if (!taskBox) throw new Error('Could not get task bounding box');
    const originalY = taskBox.y;

    // Get calendar layout
    const layout = await getCalendarLayout(page);

    // Target: Same day (day 1), different time (12pm)
    const target = getTasksColumnCoordinates(layout, 1, 12, 0);

    // Track API calls
    let scheduleApiCalled = false;
    page.on('response', (response: any) => {
      if (response.url().includes('/schedule') && response.status() === 200) {
        scheduleApiCalled = true;
      }
    });

    // Start dragging
    await page.mouse.move(taskBox.x + taskBox.width / 2, taskBox.y + taskBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(200);

    // Move to new time
    await page.mouse.move(target.x, target.y, { steps: 15 });
    await page.waitForTimeout(200);

    // Drop
    await page.mouse.up();

    // Wait for API and UI update
    await page.waitForTimeout(3000);

    await takeScreenshot(page, 'rescheduling-03-same-day-dropped');

    // Verify API was called
    expect(scheduleApiCalled).toBe(true);

    // Verify task moved (y position changed)
    const movedTask = page.locator(`[class*="border-l-2"][class*="border-white"]`).filter({ hasText: task.title });
    await expect(movedTask).toBeVisible();
    const newBox = await movedTask.boundingBox();
    if (newBox) {
      console.log(`Original Y: ${originalY}, New Y: ${newBox.y}`);
      expect(newBox.y).toBeGreaterThan(originalY);
    }
  });

  test('FR-5.3 & FR-5.4: Drag to different day shows preview', async ({ page }) => {
    // Create and schedule a task at 10am on day 1
    const task = await createScheduledTask(page, `Different Day Preview ${Date.now()}`, 1, 10);

    await navigateToWeeklyPlanning(page);

    // Find the scheduled task
    const scheduledTask = page.locator(`[class*="border-l-2"][class*="border-white"]`).filter({ hasText: task.title });
    await expect(scheduledTask).toBeVisible();

    const taskBox = await scheduledTask.boundingBox();
    if (!taskBox) throw new Error('Could not get task bounding box');

    // Get calendar layout
    const layout = await getCalendarLayout(page);

    // Target: Different day (day 3), same time (10am)
    const target = getTasksColumnCoordinates(layout, 3, 10, 0);

    // Start dragging
    await page.mouse.move(taskBox.x + taskBox.width / 2, taskBox.y + taskBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(200);

    // Move to new day
    await page.mouse.move(target.x, target.y, { steps: 15 });
    await page.waitForTimeout(300);

    await takeScreenshot(page, 'rescheduling-04-different-day-preview');

    // Verify hover preview is visible on the new day (x position should be different)
    const hoverPreview = page.locator('[class*="bg-emerald"][class*="border-emerald"]');
    await expect(hoverPreview).toBeVisible();

    const previewBox = await hoverPreview.first().boundingBox();
    if (previewBox) {
      console.log(`Preview X: ${previewBox.x}, Task X: ${taskBox.x}`);
      // Preview should be significantly to the right (different day)
      expect(previewBox.x).toBeGreaterThan(taskBox.x + 100);
    }

    await page.mouse.up();
  });

  test('FR-5.3: Drop moves task to different day', async ({ page }) => {
    // Create and schedule a task at 10am on day 1
    const task = await createScheduledTask(page, `Different Day Move ${Date.now()}`, 1, 10);

    await navigateToWeeklyPlanning(page);

    // Find the scheduled task
    const scheduledTask = page.locator(`[class*="border-l-2"][class*="border-white"]`).filter({ hasText: task.title });
    await expect(scheduledTask).toBeVisible();

    const taskBox = await scheduledTask.boundingBox();
    if (!taskBox) throw new Error('Could not get task bounding box');
    const originalX = taskBox.x;

    // Get calendar layout
    const layout = await getCalendarLayout(page);

    // Target: Different day (day 3), same time (10am)
    const target = getTasksColumnCoordinates(layout, 3, 10, 0);

    // Track API calls
    let scheduleApiCalled = false;
    page.on('response', (response: any) => {
      if (response.url().includes('/schedule') && response.status() === 200) {
        scheduleApiCalled = true;
      }
    });

    // Start dragging
    await page.mouse.move(taskBox.x + taskBox.width / 2, taskBox.y + taskBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(200);

    // Move to new day
    await page.mouse.move(target.x, target.y, { steps: 15 });
    await page.waitForTimeout(200);

    // Drop
    await page.mouse.up();

    // Wait for API and UI update
    await page.waitForTimeout(3000);

    await takeScreenshot(page, 'rescheduling-05-different-day-dropped');

    // Verify API was called
    expect(scheduleApiCalled).toBe(true);

    // Verify task moved to different day (x position changed significantly)
    const movedTask = page.locator(`[class*="border-l-2"][class*="border-white"]`).filter({ hasText: task.title });
    await expect(movedTask).toBeVisible();
    const newBox = await movedTask.boundingBox();
    if (newBox) {
      console.log(`Original X: ${originalX}, New X: ${newBox.x}`);
      // Should have moved at least 2 day widths (280px)
      expect(newBox.x).toBeGreaterThan(originalX + 200);
    }
  });

  test('FR-5.5: Original task shows reduced opacity while dragging', async ({ page }) => {
    // Create and schedule a task
    const task = await createScheduledTask(page, `Opacity Test ${Date.now()}`, 1, 10);

    await navigateToWeeklyPlanning(page);

    // Find the scheduled task
    const scheduledTask = page.locator(`[class*="border-l-2"][class*="border-white"]`).filter({ hasText: task.title });
    await expect(scheduledTask).toBeVisible();

    const taskBox = await scheduledTask.boundingBox();
    if (!taskBox) throw new Error('Could not get task bounding box');

    // Get calendar layout
    const layout = await getCalendarLayout(page);
    const target = getTasksColumnCoordinates(layout, 2, 12, 0);

    // Start dragging
    await page.mouse.move(taskBox.x + taskBox.width / 2, taskBox.y + taskBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(200);

    // Move to target
    await page.mouse.move(target.x, target.y, { steps: 15 });
    await page.waitForTimeout(200);

    await takeScreenshot(page, 'rescheduling-06-opacity-during-drag');

    // Check that the original task has reduced opacity (opacity: 0.5)
    // The task should have style="opacity: 0.5" or similar when dragging
    const taskStyle = await scheduledTask.getAttribute('style');
    console.log(`Task style during drag: ${taskStyle}`);

    // In dnd-kit, the dragging item gets opacity applied
    // The test may need to check the CSS computed style
    const opacity = await scheduledTask.evaluate((el: Element) => {
      return window.getComputedStyle(el).opacity;
    });
    console.log(`Computed opacity: ${opacity}`);

    // Opacity should be reduced (0.5 based on isDragging ? 0.5 : 1 in code)
    expect(parseFloat(opacity)).toBeLessThan(1);

    await page.mouse.up();
  });
});

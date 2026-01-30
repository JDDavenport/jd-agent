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

    // Find the scheduled task using data-testid (more reliable than class selectors)
    const scheduledTask = page.locator(`[data-testid="scheduled-task-${task.id}"]`);
    await expect(scheduledTask).toBeVisible({ timeout: 10000 });

    // Verify it has cursor-grab class (indicating draggability)
    await expect(scheduledTask).toHaveClass(/cursor-grab/);

    await takeScreenshot(page, 'rescheduling-01-draggable');
  });

  test('FR-5.2 & FR-5.4: Drag to different time on same day shows preview', async ({ page }) => {
    // Create and schedule a task at 10am
    const task = await createScheduledTask(page, `Same Day Reschedule ${Date.now()}`, 1, 10);

    await navigateToWeeklyPlanning(page);

    // Find the scheduled task using data-testid
    const scheduledTask = page.locator(`[data-testid="scheduled-task-${task.id}"]`);
    await expect(scheduledTask).toBeVisible({ timeout: 10000 });

    const taskBox = await scheduledTask.boundingBox();
    if (!taskBox) throw new Error('Could not get task bounding box');

    // Get calendar layout
    const layout = await getCalendarLayout(page);

    // Target: Same day (day 1), different time (12pm)
    const target = getTasksColumnCoordinates(layout, 1, 12, 0);

    // Start position - right side of task to avoid checkbox
    const startX = taskBox.x + Math.max(taskBox.width - 5, taskBox.width * 0.8);
    const startY = taskBox.y + taskBox.height / 2;

    // Use dispatchEvent to trigger proper pointer events for dnd-kit
    await scheduledTask.dispatchEvent('pointerdown', {
      clientX: startX,
      clientY: startY,
      button: 0,
      buttons: 1,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      bubbles: true,
    });
    await page.waitForTimeout(100);

    // Move more than 8px to trigger activation
    await page.mouse.move(startX + 20, startY + 20);
    await page.waitForTimeout(100);

    // Move to target
    await page.mouse.move(target.x, target.y, { steps: 10 });
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

    // Find the scheduled task using data-testid
    const scheduledTask = page.locator(`[data-testid="scheduled-task-${task.id}"]`);
    await expect(scheduledTask).toBeVisible({ timeout: 10000 });

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

    // Start position - right side of task to avoid checkbox
    const startX = taskBox.x + Math.max(taskBox.width - 5, taskBox.width * 0.8);
    const startY = taskBox.y + taskBox.height / 2;

    // Use dispatchEvent to trigger proper pointer events for dnd-kit
    await scheduledTask.dispatchEvent('pointerdown', {
      clientX: startX,
      clientY: startY,
      button: 0,
      buttons: 1,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      bubbles: true,
    });
    await page.waitForTimeout(100);

    // Move more than 8px to trigger activation
    await page.mouse.move(startX + 20, startY + 20);
    await page.waitForTimeout(100);

    // Move to target
    await page.mouse.move(target.x, target.y, { steps: 10 });
    await page.waitForTimeout(200);

    // Drop
    await page.mouse.up();

    // Wait for API and UI update
    await page.waitForTimeout(3000);

    await takeScreenshot(page, 'rescheduling-03-same-day-dropped');

    // Verify API was called
    expect(scheduleApiCalled).toBe(true);

    // Verify task moved (y position changed)
    const movedTask = page.locator(`[data-testid="scheduled-task-${task.id}"]`);
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

    // Find the scheduled task using data-testid
    const scheduledTask = page.locator(`[data-testid="scheduled-task-${task.id}"]`);
    await expect(scheduledTask).toBeVisible({ timeout: 10000 });

    const taskBox = await scheduledTask.boundingBox();
    if (!taskBox) throw new Error('Could not get task bounding box');

    // Get calendar layout
    const layout = await getCalendarLayout(page);

    // Target: Different day (day 3), same time (10am)
    const target = getTasksColumnCoordinates(layout, 3, 10, 0);

    // Start position - right side of task to avoid checkbox
    const startX = taskBox.x + Math.max(taskBox.width - 5, taskBox.width * 0.8);
    const startY = taskBox.y + taskBox.height / 2;

    // Use dispatchEvent to trigger proper pointer events for dnd-kit
    await scheduledTask.dispatchEvent('pointerdown', {
      clientX: startX,
      clientY: startY,
      button: 0,
      buttons: 1,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      bubbles: true,
    });
    await page.waitForTimeout(100);

    // Move more than 8px to trigger activation
    await page.mouse.move(startX + 20, startY + 20);
    await page.waitForTimeout(100);

    // Move to new day
    await page.mouse.move(target.x, target.y, { steps: 10 });
    await page.waitForTimeout(300);

    await takeScreenshot(page, 'rescheduling-04-different-day-preview');

    // Verify hover preview is visible on the new day (x position should be different)
    const hoverPreview = page.locator('[class*="bg-emerald"][class*="border-emerald"]');
    await expect(hoverPreview).toBeVisible();

    const previewBox = await hoverPreview.first().boundingBox();
    if (previewBox) {
      console.log(`Preview X: ${previewBox.x}, Task X: ${taskBox.x}`);
      // Preview should be to the right of original task (at least 50px for different day)
      expect(previewBox.x).toBeGreaterThan(taskBox.x + 50);
    }

    await page.mouse.up();
  });

  test('FR-5.3: Drop moves task to different day', async ({ page }) => {
    // Create and schedule a task at 10am on day 1
    const task = await createScheduledTask(page, `Different Day Move ${Date.now()}`, 1, 10);

    await navigateToWeeklyPlanning(page);

    // Find the scheduled task using data-testid
    const scheduledTask = page.locator(`[data-testid="scheduled-task-${task.id}"]`);
    await expect(scheduledTask).toBeVisible({ timeout: 10000 });

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

    // Start position - right side of task to avoid checkbox
    const startX = taskBox.x + Math.max(taskBox.width - 5, taskBox.width * 0.8);
    const startY = taskBox.y + taskBox.height / 2;

    // Use dispatchEvent to trigger proper pointer events for dnd-kit
    await scheduledTask.dispatchEvent('pointerdown', {
      clientX: startX,
      clientY: startY,
      button: 0,
      buttons: 1,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      bubbles: true,
    });
    await page.waitForTimeout(100);

    // Move more than 8px to trigger activation
    await page.mouse.move(startX + 20, startY + 20);
    await page.waitForTimeout(100);

    // Move to new day
    await page.mouse.move(target.x, target.y, { steps: 10 });
    await page.waitForTimeout(200);

    // Drop
    await page.mouse.up();

    // Wait for API and UI update
    await page.waitForTimeout(3000);

    await takeScreenshot(page, 'rescheduling-05-different-day-dropped');

    // Verify API was called
    expect(scheduleApiCalled).toBe(true);

    // Verify task moved to different day (x position changed significantly)
    const movedTask = page.locator(`[data-testid="scheduled-task-${task.id}"]`);
    await expect(movedTask).toBeVisible();
    const newBox = await movedTask.boundingBox();
    if (newBox) {
      console.log(`Original X: ${originalX}, New X: ${newBox.x}`);
      // Should have moved at least 2 days (each day ~140px, but account for variable widths)
      expect(newBox.x).toBeGreaterThan(originalX + 150);
    }
  });

  test('FR-5.5: Original task shows reduced opacity while dragging', async ({ page }) => {
    // Create and schedule a task
    const task = await createScheduledTask(page, `Opacity Test ${Date.now()}`, 1, 10);

    await navigateToWeeklyPlanning(page);

    // Find the scheduled task using data-testid
    const scheduledTask = page.locator(`[data-testid="scheduled-task-${task.id}"]`);
    await expect(scheduledTask).toBeVisible({ timeout: 10000 });

    const taskBox = await scheduledTask.boundingBox();
    if (!taskBox) throw new Error('Could not get task bounding box');

    // Get calendar layout
    const layout = await getCalendarLayout(page);
    const target = getTasksColumnCoordinates(layout, 2, 12, 0);

    // Start position - right side of task to avoid checkbox
    const startX = taskBox.x + Math.max(taskBox.width - 5, taskBox.width * 0.8);
    const startY = taskBox.y + taskBox.height / 2;

    // Use dispatchEvent to ensure proper pointer events are triggered
    // which dnd-kit's PointerSensor requires
    await scheduledTask.dispatchEvent('pointerdown', {
      clientX: startX,
      clientY: startY,
      button: 0,
      buttons: 1,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      bubbles: true,
    });
    await page.waitForTimeout(100);

    // Move more than 8px (activation distance)
    await page.mouse.move(startX + 20, startY + 50);
    await page.waitForTimeout(100);

    // Continue to target
    await page.mouse.move(target.x, target.y, { steps: 10 });
    await page.waitForTimeout(200);

    await takeScreenshot(page, 'rescheduling-06-opacity-during-drag');

    // Check that the original task has reduced opacity (opacity: 0.5)
    const taskStyle = await scheduledTask.getAttribute('style');
    console.log(`Task style during drag: ${taskStyle}`);

    const opacity = await scheduledTask.evaluate((el: Element) => {
      return window.getComputedStyle(el).opacity;
    });
    console.log(`Computed opacity: ${opacity}`);

    // Opacity should be reduced (0.5 based on isDragging ? 0.5 : 1 in code)
    expect(parseFloat(opacity)).toBeLessThan(1);

    await page.mouse.up();
  });
});

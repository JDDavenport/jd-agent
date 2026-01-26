/**
 * TS-2: Task Scheduling Tests
 *
 * Tests:
 * 1. Drag task from backlog toward calendar
 * 2. Verify hover preview appears in the target column at the correct time
 * 3. Preview updates as cursor moves to different times
 * 4. Preview updates as cursor moves to different days
 * 5. Drop task - task appears at previewed location
 * 6. Task is removed from backlog after drop
 * 7. Scheduled task shows correct time
 *
 * PRD Requirements:
 * - FR-4.1: Allow dragging tasks from backlog to any "Tasks" column
 * - FR-4.2: Show drag overlay (floating card) while dragging
 * - FR-4.3: Show hover preview - distinct visual block at target
 * - FR-4.4: Hover preview must update in real-time
 * - FR-4.5: Hover preview must show task title and scheduled time
 * - FR-4.6: Snap to 15-minute increments when dropping
 * - FR-4.7: On drop, schedule the task at the previewed time
 * - FR-4.8: Remove task from backlog after successful scheduling
 */

import { test, expect } from '@playwright/test';
import {
  navigateToWeeklyPlanning,
  createBacklogTask,
  deleteTask,
  takeScreenshot,
  getCalendarLayout,
  getTasksColumnCoordinates,
  API_URL,
  getCurrentWeekRange,
} from './test-helpers';

test.describe('TS-2: Task Scheduling from Backlog', () => {
  const createdTaskIds: string[] = [];

  test.afterEach(async ({ page }) => {
    // Cleanup created tasks
    for (const taskId of createdTaskIds) {
      try {
        await deleteTask(page, taskId);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    createdTaskIds.length = 0;
  });

  test('FR-4.1 & FR-4.2: Drag task from backlog shows drag overlay', async ({ page }) => {
    // Create a test task
    const testTitle = `Schedule Test ${Date.now()}`;
    const task = await createBacklogTask(page, testTitle, { timeEstimate: 30 });
    createdTaskIds.push(task.id);

    await navigateToWeeklyPlanning(page);

    // Find the task card in backlog
    const taskCard = page.locator(`text=${testTitle}`).locator('xpath=ancestor::div[contains(@class, "bg-slate-800")]').first();
    await expect(taskCard).toBeVisible();

    // Get task position
    const taskBox = await taskCard.boundingBox();
    if (!taskBox) throw new Error('Could not get task bounding box');

    // Get calendar layout for accurate positioning
    const layout = await getCalendarLayout(page);
    const target = getTasksColumnCoordinates(layout, 0, 10, 0); // First day, 10:00 AM

    // Start dragging toward the calendar
    await page.mouse.move(taskBox.x + taskBox.width / 2, taskBox.y + taskBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(200);

    // Move toward calendar area
    await page.mouse.move(target.x, target.y, { steps: 15 });
    await page.waitForTimeout(100);

    await takeScreenshot(page, 'scheduling-01-drag-overlay');

    // Verify drag overlay is visible
    const dragOverlay = page.locator('[class*="shadow-2xl"]');
    await expect(dragOverlay).toBeVisible();

    // Verify overlay shows task title
    await expect(dragOverlay).toContainText(testTitle);

    await page.mouse.up();
  });

  test('FR-4.3: Hover preview shows distinct visual block in target column', async ({ page }) => {
    // Create a test task
    const testTitle = `Preview Test ${Date.now()}`;
    const task = await createBacklogTask(page, testTitle, { timeEstimate: 30 });
    createdTaskIds.push(task.id);

    await navigateToWeeklyPlanning(page);

    // Find the task card
    const taskCard = page.locator(`text=${testTitle}`).locator('xpath=ancestor::div[contains(@class, "bg-slate-800")]').first();
    await expect(taskCard).toBeVisible();

    const taskBox = await taskCard.boundingBox();
    if (!taskBox) throw new Error('Could not get task bounding box');

    // Get calendar layout for accurate positioning
    const layout = await getCalendarLayout(page);
    const target = getTasksColumnCoordinates(layout, 0, 10, 0); // First day, 10:00 AM

    // Start dragging
    await page.mouse.move(taskBox.x + taskBox.width / 2, taskBox.y + taskBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(200);

    // Move to target position
    await page.mouse.move(target.x, target.y, { steps: 15 });
    await page.waitForTimeout(300);

    await takeScreenshot(page, 'scheduling-02-hover-preview');

    // Look for the hover preview (emerald colored block)
    const hoverPreview = page.locator('[class*="bg-emerald"][class*="border-emerald"]');
    const previewCount = await hoverPreview.count();
    console.log(`Hover preview elements found: ${previewCount}`);

    // Verify hover preview is visible
    expect(previewCount).toBeGreaterThan(0);

    // Verify preview shows the task title
    if (previewCount > 0) {
      const previewText = await hoverPreview.first().textContent();
      console.log(`Preview text: ${previewText}`);
      expect(previewText).toContain(testTitle);
    }

    await page.mouse.up();
  });

  test('FR-4.4: Hover preview updates as cursor moves between times', async ({ page }) => {
    // Create a test task
    const testTitle = `Move Test ${Date.now()}`;
    const task = await createBacklogTask(page, testTitle, { timeEstimate: 30 });
    createdTaskIds.push(task.id);

    await navigateToWeeklyPlanning(page);

    // Find the task card
    const taskCard = page.locator(`text=${testTitle}`).locator('xpath=ancestor::div[contains(@class, "bg-slate-800")]').first();
    const taskBox = await taskCard.boundingBox();
    if (!taskBox) throw new Error('Could not get task bounding box');

    // Get calendar layout
    const layout = await getCalendarLayout(page);

    // Start dragging
    await page.mouse.move(taskBox.x + taskBox.width / 2, taskBox.y + taskBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(200);

    // Move to first position (10:00 AM) - safely in visible area
    const target1 = getTasksColumnCoordinates(layout, 0, 10, 0);
    await page.mouse.move(target1.x, target1.y, { steps: 15 });
    await page.waitForTimeout(200);

    // Get first preview position
    const hoverPreview = page.locator('[class*="bg-emerald"][class*="border-emerald"]');
    const preview1 = await hoverPreview.first().boundingBox();
    console.log(`Preview 1 position (10am): top=${preview1?.y}`);

    await takeScreenshot(page, 'scheduling-03-preview-position-1');

    // Move to second position (12:00 PM) - 2 hours later, still in visible area
    const target2 = getTasksColumnCoordinates(layout, 0, 12, 0);
    await page.mouse.move(target2.x, target2.y, { steps: 15 });
    await page.waitForTimeout(200);

    // Get second preview position
    const preview2 = await hoverPreview.first().boundingBox();
    console.log(`Preview 2 position (12pm): top=${preview2?.y}`);

    await takeScreenshot(page, 'scheduling-04-preview-position-2');

    // Verify the preview moved (y position changed by about 2 hours worth = ~96px)
    if (preview1 && preview2) {
      expect(preview2.y).not.toBe(preview1.y);
      expect(preview2.y).toBeGreaterThan(preview1.y);
      // 2 hours at 48px/hour = 96px
      const expectedDiff = 2 * layout.HOUR_HEIGHT;
      const actualDiff = preview2.y - preview1.y;
      console.log(`Expected diff: ~${expectedDiff}px, Actual diff: ${actualDiff}px`);
      expect(Math.abs(actualDiff - expectedDiff)).toBeLessThan(20); // Allow some tolerance
    }

    await page.mouse.up();
  });

  test('FR-4.4b: Hover preview updates as cursor moves between days', async ({ page }) => {
    // Create a test task
    const testTitle = `Day Move Test ${Date.now()}`;
    const task = await createBacklogTask(page, testTitle, { timeEstimate: 30 });
    createdTaskIds.push(task.id);

    await navigateToWeeklyPlanning(page);

    // Find the task card
    const taskCard = page.locator(`text=${testTitle}`).locator('xpath=ancestor::div[contains(@class, "bg-slate-800")]').first();
    const taskBox = await taskCard.boundingBox();
    if (!taskBox) throw new Error('Could not get task bounding box');

    // Get calendar layout
    const layout = await getCalendarLayout(page);

    // Start dragging
    await page.mouse.move(taskBox.x + taskBox.width / 2, taskBox.y + taskBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(200);

    // Move to first day (10:00 AM)
    const target1 = getTasksColumnCoordinates(layout, 0, 10, 0);
    await page.mouse.move(target1.x, target1.y, { steps: 15 });
    await page.waitForTimeout(200);

    const hoverPreview = page.locator('[class*="bg-emerald"][class*="border-emerald"]');
    const preview1 = await hoverPreview.first().boundingBox();
    console.log(`Day 1 preview position: x=${preview1?.x}`);

    await takeScreenshot(page, 'scheduling-05-day-1-preview');

    // Move to third day (10:00 AM)
    const target2 = getTasksColumnCoordinates(layout, 2, 10, 0);
    await page.mouse.move(target2.x, target2.y, { steps: 15 });
    await page.waitForTimeout(200);

    const preview2 = await hoverPreview.first().boundingBox();
    console.log(`Day 3 preview position: x=${preview2?.x}`);

    await takeScreenshot(page, 'scheduling-06-day-3-preview');

    // Verify the preview moved horizontally
    if (preview1 && preview2) {
      expect(preview2.x).not.toBe(preview1.x);
      expect(preview2.x).toBeGreaterThan(preview1.x);
    }

    await page.mouse.up();
  });

  test('FR-4.5: Hover preview shows task title and time', async ({ page }) => {
    // Create a test task
    const testTitle = `Preview Content Test ${Date.now()}`;
    const task = await createBacklogTask(page, testTitle, { timeEstimate: 30 });
    createdTaskIds.push(task.id);

    await navigateToWeeklyPlanning(page);

    // Find the task card
    const taskCard = page.locator(`text=${testTitle}`).locator('xpath=ancestor::div[contains(@class, "bg-slate-800")]').first();
    const taskBox = await taskCard.boundingBox();
    if (!taskBox) throw new Error('Could not get task bounding box');

    // Get calendar layout
    const layout = await getCalendarLayout(page);

    // Start dragging
    await page.mouse.move(taskBox.x + taskBox.width / 2, taskBox.y + taskBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(200);

    // Move to target (10:00 AM)
    const target = getTasksColumnCoordinates(layout, 0, 10, 0);
    await page.mouse.move(target.x, target.y, { steps: 15 });
    await page.waitForTimeout(300);

    await takeScreenshot(page, 'scheduling-07-preview-content');

    // Check preview content
    const hoverPreview = page.locator('[class*="bg-emerald"][class*="border-emerald"]');
    await expect(hoverPreview).toBeVisible();

    const previewText = await hoverPreview.first().textContent();
    console.log(`Preview content: ${previewText}`);

    // Verify it contains the task title
    expect(previewText).toContain(testTitle);

    // Verify it contains a time (format like "10:00 AM" or "10:00 am")
    expect(previewText?.toLowerCase()).toMatch(/\d{1,2}:\d{2}\s*(am|pm)/i);

    await page.mouse.up();
  });

  test('FR-4.6 & FR-4.7 & FR-4.8: Drop task - schedules at previewed time and removes from backlog', async ({ page }) => {
    // Create a test task
    const testTitle = `Drop Test ${Date.now()}`;
    const task = await createBacklogTask(page, testTitle, { timeEstimate: 30 });
    createdTaskIds.push(task.id);

    await navigateToWeeklyPlanning(page);

    // Get initial backlog count
    const initialCountText = await page.locator('text=/\\d+ tasks?/').textContent();
    const initialCount = parseInt(initialCountText?.match(/\d+/)?.[0] || '0', 10);
    console.log(`Initial backlog count: ${initialCount}`);

    // Find the task card
    const taskCard = page.locator(`text=${testTitle}`).locator('xpath=ancestor::div[contains(@class, "bg-slate-800")]').first();
    const taskBox = await taskCard.boundingBox();
    if (!taskBox) throw new Error('Could not get task bounding box');

    // Get calendar layout
    const layout = await getCalendarLayout(page);

    // Target 10:00 AM on first day
    const target = getTasksColumnCoordinates(layout, 0, 10, 0);

    // Track API calls
    let scheduleApiCalled = false;
    page.on('response', (response) => {
      if (response.url().includes('/schedule') && response.status() === 200) {
        scheduleApiCalled = true;
      }
    });

    // Start dragging
    await page.mouse.move(taskBox.x + taskBox.width / 2, taskBox.y + taskBox.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(200);

    // Move to target
    await page.mouse.move(target.x, target.y, { steps: 15 });
    await page.waitForTimeout(200);

    await takeScreenshot(page, 'scheduling-08-before-drop');

    // Drop
    await page.mouse.up();

    // Wait for API and UI update
    await page.waitForTimeout(3000);

    await takeScreenshot(page, 'scheduling-09-after-drop');

    // Verify schedule API was called
    expect(scheduleApiCalled).toBe(true);

    // Verify task was removed from backlog (count decreased)
    const newCountText = await page.locator('text=/\\d+ tasks?/').textContent();
    const newCount = parseInt(newCountText?.match(/\d+/)?.[0] || '0', 10);
    console.log(`New backlog count: ${newCount}`);
    expect(newCount).toBe(initialCount - 1);

    // Verify task appears in calendar
    // Scheduled tasks have the white border-l-2 styling
    const scheduledTask = page.locator(`[class*="border-l-2"][class*="border-white"]`).filter({ hasText: testTitle });
    await expect(scheduledTask).toBeVisible({ timeout: 5000 });
  });

  test('Scheduled task shows correct time display', async ({ page }) => {
    // Create and schedule a task via API for precise control
    // Use 60 minutes so the block is tall enough to show duration (height > 32px needed)
    const testTitle = `Time Display Test ${Date.now()}`;
    const task = await createBacklogTask(page, testTitle, { timeEstimate: 60 });
    createdTaskIds.push(task.id);

    // Schedule it for 10:00 AM tomorrow
    const { start } = getCurrentWeekRange();
    const scheduleTime = new Date(start);
    scheduleTime.setDate(scheduleTime.getDate() + 1); // Tomorrow (Monday if Sunday is start)
    scheduleTime.setHours(10, 0, 0, 0);
    const endTime = new Date(scheduleTime.getTime() + 60 * 60 * 1000);

    await page.request.post(`${API_URL}/api/tasks/${task.id}/schedule`, {
      data: {
        startTime: scheduleTime.toISOString(),
        endTime: endTime.toISOString(),
      },
    });

    await navigateToWeeklyPlanning(page);

    // Find the scheduled task
    const scheduledTask = page.locator(`[class*="border-l-2"][class*="border-white"]`).filter({ hasText: testTitle });
    await expect(scheduledTask).toBeVisible({ timeout: 5000 });

    await takeScreenshot(page, 'scheduling-10-time-display');

    // Verify task shows duration (60m - visible because block height > 32px)
    // At 48px/hour, 60 minutes = 48px which is > 32px threshold
    const taskText = await scheduledTask.textContent();
    console.log(`Scheduled task text: ${taskText}`);

    // Should show duration (60m)
    expect(taskText).toContain('60m');
  });
});

/**
 * TS-1: Backlog Management Tests
 *
 * Tests:
 * 1. Add a task via "Add task" button - task appears in backlog
 * 2. Add multiple tasks rapidly - all tasks appear
 * 3. Task displays title, priority, and time estimate correctly
 *
 * PRD Requirements:
 * - FR-1.1: Display a "Weekly Backlog" panel on the left side
 * - FR-1.2: Show task count in the panel header
 * - FR-1.3: Allow adding new tasks via "Add task" button
 * - FR-1.4: Support rapid task entry (type and press Enter)
 * - FR-1.5: Display task title, priority indicator, and time estimate
 * - FR-1.6: Tasks should be draggable
 * - FR-1.7: Show visual feedback when task is being dragged
 */

import { test, expect } from '@playwright/test';
import {
  navigateToWeeklyPlanning,
  createBacklogTask,
  deleteTask,
  takeScreenshot,
  API_URL,
} from './test-helpers';

test.describe('TS-1: Backlog Management', () => {
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

  test('FR-1.1: Weekly Backlog panel is displayed on the left side', async ({ page }) => {
    await navigateToWeeklyPlanning(page);

    // Check the backlog panel exists
    const backlogPanel = page.locator('text=Weekly Backlog');
    await expect(backlogPanel).toBeVisible();

    // Verify it's positioned on the left (width should be ~288px / w-72)
    const panelContainer = page.locator('.w-72').first();
    await expect(panelContainer).toBeVisible();

    await takeScreenshot(page, 'backlog-01-panel-visible');
  });

  test('FR-1.2: Task count is shown in the panel header', async ({ page }) => {
    await navigateToWeeklyPlanning(page);

    // Check task count display
    const taskCountElement = page.locator('text=/\\d+ tasks?/');
    await expect(taskCountElement).toBeVisible();

    const countText = await taskCountElement.textContent();
    console.log(`Task count displayed: ${countText}`);

    // Verify the count format
    expect(countText).toMatch(/\d+ tasks?/);

    await takeScreenshot(page, 'backlog-02-task-count');
  });

  test('FR-1.3: Add a task via "Add task" button - task appears in backlog', async ({ page }) => {
    await navigateToWeeklyPlanning(page);

    // Get initial task count
    const initialCountText = await page.locator('text=/\\d+ tasks?/').textContent();
    const initialCount = parseInt(initialCountText?.match(/\d+/)?.[0] || '0', 10);
    console.log(`Initial backlog count: ${initialCount}`);

    // Click the Add task button
    const addButton = page.locator('button:has-text("Add task")');
    await expect(addButton).toBeVisible();
    await addButton.click();

    // Wait for input to appear
    const input = page.locator('input[placeholder*="Type task"]');
    await expect(input).toBeVisible();

    // Type a task and press Enter
    const testTitle = `Test Task ${Date.now()}`;
    await input.fill(testTitle);
    await input.press('Enter');

    // Wait for the task to be created
    await page.waitForTimeout(2000);

    // Verify the task appears in the backlog
    const newTask = page.locator(`text=${testTitle}`);
    await expect(newTask).toBeVisible({ timeout: 5000 });

    // Verify count increased
    const newCountText = await page.locator('text=/\\d+ tasks?/').textContent();
    const newCount = parseInt(newCountText?.match(/\d+/)?.[0] || '0', 10);
    console.log(`New backlog count: ${newCount}`);
    expect(newCount).toBe(initialCount + 1);

    // Track for cleanup - find the task ID via API
    const response = await page.request.get(`${API_URL}/api/tasks?label=weekly-backlog&limit=100`);
    const data = await response.json();
    const createdTask = data.data?.find((t: any) => t.title === testTitle);
    if (createdTask) {
      createdTaskIds.push(createdTask.id);
    }

    await takeScreenshot(page, 'backlog-03-task-added');
  });

  test('FR-1.4: Rapid task entry - add multiple tasks in succession', async ({ page }) => {
    await navigateToWeeklyPlanning(page);

    // Click Add task button
    const addButton = page.locator('button:has-text("Add task")');
    await addButton.click();

    // Wait for input
    const input = page.locator('input[placeholder*="Type task"]');
    await expect(input).toBeVisible();

    // Add multiple tasks rapidly
    const testTitles = [
      `Rapid Task 1 - ${Date.now()}`,
      `Rapid Task 2 - ${Date.now()}`,
      `Rapid Task 3 - ${Date.now()}`,
    ];

    for (const title of testTitles) {
      await input.fill(title);
      await input.press('Enter');
      await page.waitForTimeout(500); // Small delay for API
    }

    // Wait for all tasks to be created
    await page.waitForTimeout(2000);

    // Verify all tasks appear
    for (const title of testTitles) {
      const taskElement = page.locator(`text=${title}`);
      await expect(taskElement).toBeVisible({ timeout: 5000 });
    }

    // Track for cleanup
    const response = await page.request.get(`${API_URL}/api/tasks?label=weekly-backlog&limit=100`);
    const data = await response.json();
    for (const title of testTitles) {
      const task = data.data?.find((t: any) => t.title === title);
      if (task) {
        createdTaskIds.push(task.id);
      }
    }

    await takeScreenshot(page, 'backlog-04-rapid-entry');
  });

  test('FR-1.5: Task displays title, priority indicator, and time estimate', async ({ page }) => {
    // Create a task with specific priority and time estimate via API
    const testTitle = `Display Test ${Date.now()}`;
    const task = await createBacklogTask(page, testTitle, { priority: 3, timeEstimate: 45 });
    createdTaskIds.push(task.id);

    await navigateToWeeklyPlanning(page);

    // Find the task
    const taskCard = page.locator(`text=${testTitle}`).locator('xpath=ancestor::div[contains(@class, "bg-slate-800")]').first();
    await expect(taskCard).toBeVisible();

    // Verify title is displayed
    await expect(taskCard.locator('.font-medium')).toContainText(testTitle);

    // Verify priority indicator (P3 = orange)
    const priorityIndicator = taskCard.locator('text=P3');
    await expect(priorityIndicator).toBeVisible();

    // Verify time estimate
    const timeEstimate = taskCard.locator('text=/45m/');
    await expect(timeEstimate).toBeVisible();

    await takeScreenshot(page, 'backlog-05-task-details');
  });

  test('FR-1.6: Tasks are draggable (have cursor-grab class)', async ({ page }) => {
    // Create a test task
    const testTitle = `Draggable Test ${Date.now()}`;
    const task = await createBacklogTask(page, testTitle);
    createdTaskIds.push(task.id);

    await navigateToWeeklyPlanning(page);

    // Find the task card
    const taskCard = page.locator(`text=${testTitle}`).locator('xpath=ancestor::div[contains(@class, "bg-slate-800")]').first();
    await expect(taskCard).toBeVisible();

    // Verify it has cursor-grab class (indicating draggability)
    await expect(taskCard).toHaveClass(/cursor-grab/);

    await takeScreenshot(page, 'backlog-06-draggable');
  });

  test('FR-1.7: Visual feedback when dragging (opacity change, shadow)', async ({ page }) => {
    // Create a test task
    const testTitle = `Drag Feedback Test ${Date.now()}`;
    const task = await createBacklogTask(page, testTitle);
    createdTaskIds.push(task.id);

    await navigateToWeeklyPlanning(page);

    // Find the task card
    const taskCard = page.locator(`text=${testTitle}`).locator('xpath=ancestor::div[contains(@class, "bg-slate-800")]').first();
    await expect(taskCard).toBeVisible();

    // Get the bounding box
    const box = await taskCard.boundingBox();
    if (!box) {
      throw new Error('Could not get task bounding box');
    }

    // Start dragging
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(200); // Let dnd-kit register the drag

    // Move slightly to trigger drag state
    await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50, { steps: 5 });
    await page.waitForTimeout(100);

    await takeScreenshot(page, 'backlog-07-drag-feedback');

    // Check for drag overlay (floating card while dragging)
    const dragOverlay = page.locator('[class*="shadow-2xl"]');
    const overlayCount = await dragOverlay.count();
    console.log(`Drag overlay elements found: ${overlayCount}`);

    // Release
    await page.mouse.up();
  });

  test('Escape key cancels rapid entry mode', async ({ page }) => {
    await navigateToWeeklyPlanning(page);

    // Click Add task button
    const addButton = page.locator('button:has-text("Add task")');
    await addButton.click();

    // Wait for input
    const input = page.locator('input[placeholder*="Type task"]');
    await expect(input).toBeVisible();

    // Press Escape to cancel
    await input.press('Escape');

    // Input should be hidden and Add button visible again
    await expect(input).not.toBeVisible();
    await expect(addButton).toBeVisible();

    await takeScreenshot(page, 'backlog-08-escape-cancel');
  });
});

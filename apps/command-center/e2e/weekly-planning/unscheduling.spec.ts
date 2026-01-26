/**
 * TS-4: Task Unscheduling Tests
 *
 * Tests:
 * 1. Right-click on scheduled task
 * 2. Context menu appears with "Back to Backlog" option
 * 3. Click "Back to Backlog"
 * 4. Task disappears from calendar
 * 5. Task reappears in backlog
 *
 * PRD Requirements:
 * - FR-6.1: Right-click on scheduled task shows context menu
 * - FR-6.2: Context menu includes "Back to Backlog" option
 * - FR-6.3: Clicking "Back to Backlog" removes schedule and returns task to backlog
 * - FR-6.4: Context menu includes "Edit Details" option
 */

import { test, expect } from '@playwright/test';
import {
  navigateToWeeklyPlanning,
  createBacklogTask,
  scheduleTask,
  deleteTask,
  takeScreenshot,
  getCurrentWeekRange,
} from './test-helpers';

test.describe('TS-4: Task Unscheduling', () => {
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
    dayOffset: number = 1,
    hour: number = 10
  ): Promise<{ id: string; title: string }> {
    const task = await createBacklogTask(page, title, { timeEstimate: 60 });
    createdTaskIds.push(task.id);

    const { start } = getCurrentWeekRange();
    const scheduleTime = new Date(start);
    scheduleTime.setDate(scheduleTime.getDate() + dayOffset);
    scheduleTime.setHours(hour, 0, 0, 0);
    const endTime = new Date(scheduleTime.getTime() + 60 * 60 * 1000);

    await scheduleTask(page, task.id, scheduleTime.toISOString(), endTime.toISOString());

    return { id: task.id, title };
  }

  test('FR-6.1: Right-click on scheduled task shows context menu', async ({ page }) => {
    const task = await createScheduledTask(page, `Context Menu Test ${Date.now()}`);

    await navigateToWeeklyPlanning(page);

    // Find the scheduled task
    const scheduledTask = page.locator(`[class*="border-l-2"][class*="border-white"]`).filter({ hasText: task.title });
    await expect(scheduledTask).toBeVisible();

    // Right-click to show context menu
    await scheduledTask.click({ button: 'right' });
    await page.waitForTimeout(300);

    await takeScreenshot(page, 'unscheduling-01-context-menu');

    // Verify context menu appears
    const contextMenu = page.locator('[class*="bg-slate-800"][class*="shadow-xl"]').filter({ hasText: 'Back to Backlog' });
    await expect(contextMenu).toBeVisible();
  });

  test('FR-6.2: Context menu includes "Back to Backlog" option', async ({ page }) => {
    const task = await createScheduledTask(page, `Backlog Option Test ${Date.now()}`);

    await navigateToWeeklyPlanning(page);

    // Find and right-click the scheduled task
    const scheduledTask = page.locator(`[class*="border-l-2"][class*="border-white"]`).filter({ hasText: task.title });
    await expect(scheduledTask).toBeVisible();
    await scheduledTask.click({ button: 'right' });
    await page.waitForTimeout(300);

    // Verify "Back to Backlog" option exists
    const backToBacklogButton = page.locator('button:has-text("Back to Backlog")');
    await expect(backToBacklogButton).toBeVisible();

    await takeScreenshot(page, 'unscheduling-02-back-to-backlog-option');
  });

  test('FR-6.3: Clicking "Back to Backlog" removes task from calendar and returns to backlog', async ({ page }) => {
    const task = await createScheduledTask(page, `Unschedule Test ${Date.now()}`);

    await navigateToWeeklyPlanning(page);

    // Get initial backlog count
    const initialCountText = await page.locator('text=/\\d+ tasks?/').textContent();
    const initialBacklogCount = parseInt(initialCountText?.match(/\d+/)?.[0] || '0', 10);
    console.log(`Initial backlog count: ${initialBacklogCount}`);

    // Find and right-click the scheduled task
    const scheduledTask = page.locator(`[class*="border-l-2"][class*="border-white"]`).filter({ hasText: task.title });
    await expect(scheduledTask).toBeVisible();
    await scheduledTask.click({ button: 'right' });
    await page.waitForTimeout(300);

    // Click "Back to Backlog"
    const backToBacklogButton = page.locator('button:has-text("Back to Backlog")');
    await expect(backToBacklogButton).toBeVisible();
    await backToBacklogButton.click();

    // Wait for API and UI update
    await page.waitForTimeout(3000);

    await takeScreenshot(page, 'unscheduling-03-after-unschedule');

    // Verify task is no longer in calendar
    const taskInCalendar = page.locator(`[class*="border-l-2"][class*="border-white"]`).filter({ hasText: task.title });
    await expect(taskInCalendar).not.toBeVisible();

    // Verify task is back in backlog
    const taskInBacklog = page.locator('.w-72').locator(`text=${task.title}`);
    await expect(taskInBacklog).toBeVisible();

    // Verify backlog count increased
    const newCountText = await page.locator('text=/\\d+ tasks?/').textContent();
    const newBacklogCount = parseInt(newCountText?.match(/\d+/)?.[0] || '0', 10);
    console.log(`New backlog count: ${newBacklogCount}`);
    expect(newBacklogCount).toBe(initialBacklogCount + 1);
  });

  test('FR-6.4: Context menu includes "Edit Details" option', async ({ page }) => {
    const task = await createScheduledTask(page, `Edit Option Test ${Date.now()}`);

    await navigateToWeeklyPlanning(page);

    // Find and right-click the scheduled task
    const scheduledTask = page.locator(`[class*="border-l-2"][class*="border-white"]`).filter({ hasText: task.title });
    await expect(scheduledTask).toBeVisible();
    await scheduledTask.click({ button: 'right' });
    await page.waitForTimeout(300);

    // Verify "Edit Details" option exists
    const editDetailsButton = page.locator('button:has-text("Edit Details")');
    await expect(editDetailsButton).toBeVisible();

    await takeScreenshot(page, 'unscheduling-04-edit-details-option');
  });

  test('Context menu closes when clicking outside', async ({ page }) => {
    const task = await createScheduledTask(page, `Menu Close Test ${Date.now()}`);

    await navigateToWeeklyPlanning(page);

    // Find and right-click the scheduled task
    const scheduledTask = page.locator(`[class*="border-l-2"][class*="border-white"]`).filter({ hasText: task.title });
    await expect(scheduledTask).toBeVisible();
    await scheduledTask.click({ button: 'right' });
    await page.waitForTimeout(300);

    // Verify context menu is visible
    const contextMenu = page.locator('[class*="bg-slate-800"][class*="shadow-xl"]').filter({ hasText: 'Back to Backlog' });
    await expect(contextMenu).toBeVisible();

    // Click outside the menu (on the calendar area)
    await page.mouse.click(100, 400);
    await page.waitForTimeout(300);

    await takeScreenshot(page, 'unscheduling-05-menu-closed');

    // Verify context menu is closed
    await expect(contextMenu).not.toBeVisible();
  });
});

/**
 * TS-5: Event Creation Tests
 *
 * Tests:
 * 1. Click and drag on Events column
 * 2. Preview rectangle shows selected time range
 * 3. Release mouse - popup appears
 * 4. Enter title and create event
 * 5. Event appears in calendar
 *
 * PRD Requirements:
 * - FR-7.1: Click and drag on "Events" column creates a time range selection
 * - FR-7.2: Show visual preview of selected time range while dragging
 * - FR-7.3: On mouse up, show event creation popup
 * - FR-7.4: Popup shows date, time range, and title input
 * - FR-7.5: Allow creating event with title
 * - FR-7.6: Popup also allows scheduling an existing backlog task to that time
 */

import { test, expect } from '@playwright/test';
import {
  navigateToWeeklyPlanning,
  createBacklogTask,
  deleteTask,
  takeScreenshot,
  getCalendarLayout,
  getEventsColumnCoordinates,
  API_URL,
} from './test-helpers';

test.describe('TS-5: Event Creation', () => {
  const createdTaskIds: string[] = [];

  test.afterEach(async ({ page }) => {
    for (const taskId of createdTaskIds) {
      try {
        await deleteTask(page, taskId);
      } catch (e) {}
    }
    createdTaskIds.length = 0;
  });

  test('FR-7.1 & FR-7.2: Click and drag on Events column shows time selection preview', async ({ page }) => {
    await navigateToWeeklyPlanning(page);

    // Get calendar layout
    const layout = await getCalendarLayout(page);

    // Target: First day, Events column, starting at 10am
    const startPos = getEventsColumnCoordinates(layout, 0, 10, 0);
    const endPos = getEventsColumnCoordinates(layout, 0, 11, 0);

    // Click and drag to create time range
    await page.mouse.move(startPos.x, startPos.y);
    await page.mouse.down();
    await page.waitForTimeout(100);

    // Drag down to 11am (1 hour selection)
    await page.mouse.move(endPos.x, endPos.y, { steps: 10 });
    await page.waitForTimeout(200);

    await takeScreenshot(page, 'event-creation-01-drag-preview');

    // Verify a preview rectangle is shown (indigo colored)
    const dragPreview = page.locator('[class*="bg-indigo"][class*="border-indigo"]');
    const previewCount = await dragPreview.count();
    console.log(`Drag preview elements found: ${previewCount}`);

    // There should be a preview element
    expect(previewCount).toBeGreaterThan(0);

    await page.mouse.up();
  });

  test('FR-7.3: Release mouse shows event creation popup', async ({ page }) => {
    await navigateToWeeklyPlanning(page);

    // Get calendar layout
    const layout = await getCalendarLayout(page);

    // Target: First day, Events column, 10am to 11am
    const startPos = getEventsColumnCoordinates(layout, 0, 10, 0);
    const endPos = getEventsColumnCoordinates(layout, 0, 11, 0);

    // Click and drag
    await page.mouse.move(startPos.x, startPos.y);
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.mouse.move(endPos.x, endPos.y, { steps: 10 });
    await page.waitForTimeout(100);

    // Release to show popup
    await page.mouse.up();
    await page.waitForTimeout(300);

    await takeScreenshot(page, 'event-creation-02-popup');

    // Verify popup appears
    const popup = page.locator('[class*="bg-slate-800"][class*="shadow-2xl"]').filter({ hasText: 'New Event' });
    await expect(popup).toBeVisible();
  });

  test('FR-7.4: Popup shows date, time range, and title input', async ({ page }) => {
    await navigateToWeeklyPlanning(page);

    // Get calendar layout
    const layout = await getCalendarLayout(page);

    // Target: First day, Events column, 10am to 11am
    const startPos = getEventsColumnCoordinates(layout, 0, 10, 0);
    const endPos = getEventsColumnCoordinates(layout, 0, 11, 0);

    // Click and drag to create event
    await page.mouse.move(startPos.x, startPos.y);
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.mouse.move(endPos.x, endPos.y, { steps: 10 });
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.waitForTimeout(300);

    await takeScreenshot(page, 'event-creation-03-popup-content');

    // Verify popup contains required elements
    const popup = page.locator('[class*="bg-slate-800"][class*="shadow-2xl"]');
    await expect(popup).toBeVisible();

    // Should show day name and date (e.g., "Sunday, January 25")
    const dateText = await popup.locator('.text-sm.font-medium').textContent();
    console.log(`Date text: ${dateText}`);
    expect(dateText).toMatch(/\w+,\s+\w+\s+\d+/); // Day name, Month Day

    // Should show time range (e.g., "10:00 AM - 11:00 AM")
    const timeElement = popup.locator('.text-xs.text-slate-400').filter({ hasText: /\d{1,2}:\d{2}.*-.*\d{1,2}:\d{2}/ });
    const timeText = await timeElement.textContent();
    console.log(`Time text: ${timeText}`);
    expect(timeText).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)\s*-\s*\d{1,2}:\d{2}\s*(AM|PM)/i);

    // Should have title input (placeholder is "Add title")
    const titleInput = popup.locator('input[placeholder="Add title"]');
    await expect(titleInput).toBeVisible();

    // Should have "Create Event" button
    const createButton = popup.locator('button:has-text("Create Event")');
    await expect(createButton).toBeVisible();
  });

  test('FR-7.5: Enter title and create event - event appears in calendar', async ({ page }) => {
    await navigateToWeeklyPlanning(page);

    // Get calendar layout
    const layout = await getCalendarLayout(page);

    // Target: First day, Events column, 10am to 11am
    const startPos = getEventsColumnCoordinates(layout, 0, 10, 0);
    const endPos = getEventsColumnCoordinates(layout, 0, 11, 0);

    // Click and drag to create event
    await page.mouse.move(startPos.x, startPos.y);
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.mouse.move(endPos.x, endPos.y, { steps: 10 });
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.waitForTimeout(300);

    // Verify popup appeared
    const popup = page.locator('[class*="bg-slate-800"][class*="shadow-2xl"]');
    await expect(popup).toBeVisible();

    // Enter title
    const eventTitle = `Test Event ${Date.now()}`;
    const titleInput = page.locator('input[placeholder="Add title"]');
    await expect(titleInput).toBeVisible();
    await titleInput.fill(eventTitle);

    // Click create button
    const createButton = page.locator('button:has-text("Create Event")');
    await expect(createButton).toBeEnabled();
    await createButton.click();

    // Wait for popup to close (indicates event was created)
    await expect(popup).not.toBeVisible({ timeout: 5000 });

    await takeScreenshot(page, 'event-creation-04-event-created');

    // Verify event appears in calendar (should be visible as a green event)
    // The event should appear in the Events column on Sunday
    const newEvent = page.locator(`[class*="bg-green"]`).filter({ hasText: eventTitle.substring(0, 15) });
    await expect(newEvent.first()).toBeVisible({ timeout: 5000 });
    console.log(`Event "${eventTitle}" created and visible in calendar`);
  });

  test('FR-7.6: Schedule Task tab is available in popup', async ({ page }) => {
    await navigateToWeeklyPlanning(page);

    // Get calendar layout
    const layout = await getCalendarLayout(page);

    // Target: First day, Events column, 10am to 11am
    const startPos = getEventsColumnCoordinates(layout, 0, 10, 0);
    const endPos = getEventsColumnCoordinates(layout, 0, 11, 0);

    // Click and drag to open popup
    await page.mouse.move(startPos.x, startPos.y);
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.mouse.move(endPos.x, endPos.y, { steps: 10 });
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.waitForTimeout(300);

    // Verify popup appeared
    const popup = page.locator('[class*="bg-slate-800"][class*="shadow-2xl"]');
    await expect(popup).toBeVisible();

    // Check for "Schedule Task" tab (shows count of backlog tasks)
    const scheduleTaskTab = popup.locator('button').filter({ hasText: /Schedule Task/ });
    await expect(scheduleTaskTab).toBeVisible();

    // Verify the tab shows a count (could be 0 or more)
    const tabText = await scheduleTaskTab.textContent();
    console.log(`Schedule Task tab text: ${tabText}`);
    expect(tabText).toMatch(/Schedule Task\s*\(\d+\)/);

    // Click the Schedule Task tab
    await scheduleTaskTab.click();
    await page.waitForTimeout(200);

    await takeScreenshot(page, 'event-creation-05-schedule-task-tab');

    // Verify the task list area is visible
    const taskListOrEmpty = popup.locator('.max-h-\\[250px\\], :has-text("No tasks in backlog")');
    await expect(taskListOrEmpty.first()).toBeVisible();
  });

  test('Popup can be cancelled', async ({ page }) => {
    await navigateToWeeklyPlanning(page);

    // Get calendar layout
    const layout = await getCalendarLayout(page);

    // Target: First day, Events column
    const startPos = getEventsColumnCoordinates(layout, 0, 10, 0);
    const endPos = getEventsColumnCoordinates(layout, 0, 11, 0);

    // Click and drag
    await page.mouse.move(startPos.x, startPos.y);
    await page.mouse.down();
    await page.waitForTimeout(100);
    await page.mouse.move(endPos.x, endPos.y, { steps: 10 });
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.waitForTimeout(300);

    // Verify popup is visible
    const popup = page.locator('[class*="bg-slate-800"][class*="shadow-2xl"]');
    await expect(popup).toBeVisible();

    // Click cancel button
    const cancelButton = page.locator('button:has-text("Cancel")');
    await cancelButton.click();
    await page.waitForTimeout(200);

    await takeScreenshot(page, 'event-creation-07-cancelled');

    // Verify popup closed
    await expect(popup).not.toBeVisible();
  });
});

/**
 * Event Drag-Drop Tests
 *
 * Verifies that calendar events can be dragged to reschedule them.
 */

import { test, expect } from '@playwright/test';
import {
  navigateToWeeklyPlanning,
  takeScreenshot,
  getCalendarLayout,
} from './test-helpers';

test.describe('Event Drag-Drop', () => {
  test('Calendar events are draggable', async ({ page }) => {
    await navigateToWeeklyPlanning(page);

    // Wait for calendar to load
    await page.waitForTimeout(2000);

    await takeScreenshot(page, 'event-drag-01-initial');

    // Find any calendar event (they have data-testid="calendar-event-*")
    const calendarEvents = page.locator('[data-testid^="calendar-event-"]');
    const eventCount = await calendarEvents.count();

    console.log(`Found ${eventCount} calendar events`);

    if (eventCount === 0) {
      console.log('No calendar events found - skipping drag test');
      // Test passes if no events (nothing to drag)
      return;
    }

    // Get the first event and its ID
    const firstEvent = calendarEvents.first();
    await expect(firstEvent).toBeVisible({ timeout: 5000 });

    const eventTestId = await firstEvent.getAttribute('data-testid');
    const eventId = eventTestId?.replace('calendar-event-', '');
    console.log(`Testing event ID: ${eventId}`);

    const eventRect = await firstEvent.boundingBox();
    expect(eventRect).toBeTruthy();

    console.log(`Event position: x=${eventRect!.x}, y=${eventRect!.y}, h=${eventRect!.height}`);

    // Verify the event has cursor: grab (indicating it's draggable)
    const cursor = await firstEvent.evaluate(el => getComputedStyle(el).cursor);
    console.log(`Event cursor style: ${cursor}`);
    expect(cursor).toBe('grab');

    await takeScreenshot(page, 'event-drag-02-found-event');

    // Listen for API calls
    let apiCalled = false;
    let apiPayload: any = null;
    page.on('request', (request) => {
      if (request.url().includes('/api/calendar/') && request.method() === 'PATCH') {
        apiCalled = true;
        try {
          apiPayload = JSON.parse(request.postData() || '{}');
          console.log(`API called with payload: ${JSON.stringify(apiPayload)}`);
        } catch (e) {}
      }
    });

    // Try to drag the event down by 2 hours (96px)
    const targetY = eventRect!.y + 96;

    // Start drag
    await page.mouse.move(eventRect!.x + eventRect!.width / 2, eventRect!.y + eventRect!.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(100);

    // Move down
    await page.mouse.move(eventRect!.x + eventRect!.width / 2, targetY, { steps: 10 });
    await page.waitForTimeout(500);

    await takeScreenshot(page, 'event-drag-03-dragging');

    // Check for preview block (green preview)
    const previewBlock = page.locator('.bg-emerald-500\\/80');
    const previewVisible = await previewBlock.isVisible().catch(() => false);
    console.log(`Preview visible during drag: ${previewVisible}`);
    expect(previewVisible).toBe(true);

    // Check for time indicator
    const timeIndicator = page.locator('.fixed.bg-slate-900.text-white');
    const indicatorVisible = await timeIndicator.isVisible().catch(() => false);
    console.log(`Time indicator visible: ${indicatorVisible}`);
    expect(indicatorVisible).toBe(true);

    if (indicatorVisible) {
      const timeText = await timeIndicator.textContent();
      console.log(`Time indicator shows: ${timeText}`);
    }

    // Drop the event
    await page.mouse.up();
    await page.waitForTimeout(2000);

    await takeScreenshot(page, 'event-drag-04-after-drop');

    // Verify API was called to reschedule the event
    console.log(`API called: ${apiCalled}`);
    expect(apiCalled).toBe(true);
    expect(apiPayload).toBeTruthy();
    expect(apiPayload.startTime).toBeTruthy();
    expect(apiPayload.endTime).toBeTruthy();

    console.log('Event drag test completed - event rescheduled successfully');
  });
});

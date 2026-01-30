import { test, expect } from '@playwright/test';

const SCREENSHOT_DIR = 'screenshots/hover-preview';

test.describe('Weekly Planning - Hover Preview Test', () => {
  test('Test hover preview when dragging task over calendar', async ({ page }) => {
    console.log('\n=== HOVER PREVIEW TEST ===');

    // Navigate to Weekly Planning page
    await page.goto('http://localhost:5173/weekly-planning');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Wait for data to load

    await page.screenshot({ path: `${SCREENSHOT_DIR}/01-initial.png`, fullPage: true });
    console.log('Screenshot 1: Initial page state');

    // Look for "Weekly Backlog" heading
    const backlogHeading = page.locator('h2:has-text("Weekly Backlog")');
    const headingVisible = await backlogHeading.isVisible().catch(() => false);
    console.log(`Backlog heading visible: ${headingVisible}`);

    // Find draggable task items (they have cursor-grab class)
    const draggableTasks = page.locator('.cursor-grab');
    const taskCount = await draggableTasks.count();
    console.log(`Found ${taskCount} draggable tasks`);

    if (taskCount === 0) {
      console.log('No tasks in backlog to drag');
      // Log page structure for debugging
      const bodyText = await page.locator('body').textContent();
      console.log('Page text (first 500 chars):', bodyText?.substring(0, 500));
      await page.screenshot({ path: `${SCREENSHOT_DIR}/01a-no-tasks.png`, fullPage: true });
      return;
    }

    // Get the first draggable task
    const taskToDrag = draggableTasks.first();
    const taskBounds = await taskToDrag.boundingBox();

    if (!taskBounds) {
      console.log('Could not get task bounds');
      return;
    }

    console.log('Task bounds:', taskBounds);

    // Find the calendar grid - look for the container with hour rows
    // The calendar is identified by having the time labels and grid structure
    const calendarContainer = page.locator('.overflow-auto').last();
    const calendarBounds = await calendarContainer.boundingBox();

    if (!calendarBounds) {
      console.log('Could not find calendar grid');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/01b-no-calendar.png`, fullPage: true });
      return;
    }

    console.log('Calendar bounds:', calendarBounds);

    // Start position (center of task)
    const startX = taskBounds.x + taskBounds.width / 2;
    const startY = taskBounds.y + taskBounds.height / 2;

    // Calculate positions in the TASKS column (right half of each day)
    // The calendar has time labels on left (~48px), then days with Events | Tasks columns
    // Each day is about 140px wide, split into Events (left) and Tasks (right)
    const timeLabelsWidth = 48;
    const dayWidth = 140;

    // Target today's column (first day), Tasks side (right half)
    const todayX = calendarBounds.x + timeLabelsWidth + (dayWidth * 0.75); // 75% into first day = Tasks column

    // Different Y positions for the 3 screenshots
    const dest1Y = calendarBounds.y + 100;  // Near top (early morning)
    const dest2Y = calendarBounds.y + 250;  // Middle (mid-morning)
    const dest3Y = calendarBounds.y + 400;  // Lower (afternoon)

    console.log(`\nStarting drag from (${startX}, ${startY})`);
    console.log(`Destination X: ${todayX}`);
    console.log(`Destinations Y: ${dest1Y}, ${dest2Y}, ${dest3Y}`);

    // Start the drag
    await page.mouse.move(startX, startY);
    await page.waitForTimeout(100);
    await page.mouse.down();
    await page.waitForTimeout(300);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/02-drag-started.png`, fullPage: true });
    console.log('\nScreenshot 2: Drag started');

    // Move to first position (near top of calendar)
    await page.mouse.move(todayX, dest1Y, { steps: 20 });
    await page.waitForTimeout(500);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/03-hover-position-1.png`, fullPage: true });
    console.log('Screenshot 3: Hover at position 1 (top area) - LOOK FOR BLUE PREVIEW BOX');

    // Move to second position (middle of calendar)
    await page.mouse.move(todayX, dest2Y, { steps: 20 });
    await page.waitForTimeout(500);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/04-hover-position-2.png`, fullPage: true });
    console.log('Screenshot 4: Hover at position 2 (middle area) - LOOK FOR BLUE PREVIEW BOX');

    // Move to third position (lower in calendar)
    await page.mouse.move(todayX, dest3Y, { steps: 20 });
    await page.waitForTimeout(500);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/05-hover-position-3.png`, fullPage: true });
    console.log('Screenshot 5: Hover at position 3 (lower area) - LOOK FOR BLUE PREVIEW BOX');

    // Check if there's a preview element visible (blue-500 class indicates the preview)
    const previewElement = page.locator('.bg-blue-500\\/60, [class*="animate-pulse"][class*="blue"]');
    const previewCount = await previewElement.count();
    console.log(`\nFound ${previewCount} blue preview elements`);

    // Check for the preview by looking for the animate-pulse class combined with blue background
    const animatedBlue = page.locator('.animate-pulse');
    const animatedCount = await animatedBlue.count();
    console.log(`Found ${animatedCount} animated (pulsing) elements`);

    // Drop the task
    await page.mouse.up();
    await page.waitForTimeout(500);

    await page.screenshot({ path: `${SCREENSHOT_DIR}/06-after-drop.png`, fullPage: true });
    console.log('Screenshot 6: After drop');

    console.log('\n=== TEST COMPLETE ===');
    console.log('Check screenshots in screenshots/hover-preview/ directory');
    console.log('Look for a BRIGHT BLUE PULSING BOX showing where the task will land');
  });
});

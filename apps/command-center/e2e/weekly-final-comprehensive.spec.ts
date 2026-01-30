/**
 * Weekly Planning - Final Comprehensive Verification
 * Tests ALL features with detailed evidence capture
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = '/Users/jddavenport/Projects/JD Agent/apps/command-center/screenshots/final-verification';

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Clear existing screenshots
const existingFiles = fs.readdirSync(SCREENSHOT_DIR);
existingFiles.forEach(f => {
  if (f.endsWith('.png')) {
    fs.unlinkSync(path.join(SCREENSHOT_DIR, f));
  }
});

interface ApiCall {
  method: string;
  url: string;
  body?: any;
  status?: number;
}

test.describe('Weekly Planning - Final Comprehensive Verification', () => {
  let apiCalls: ApiCall[] = [];

  test('Complete Feature Verification', async ({ page }) => {
    // Track API calls
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/')) {
        apiCalls.push({
          method: request.method(),
          url: url.replace('http://localhost:3000', ''),
          body: request.postData() ? JSON.parse(request.postData() || '{}') : undefined,
        });
      }
    });

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api/')) {
        const call = apiCalls.find(c => url.includes(c.url) && !c.status);
        if (call) {
          call.status = response.status();
        }
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log('WEEKLY PLANNING - FINAL COMPREHENSIVE VERIFICATION');
    console.log('='.repeat(60) + '\n');

    // Navigate to Weekly Planning
    await page.goto(`${BASE_URL}/weekly-planning`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // ========================================
    // TEST 1: Initial Page Load
    // ========================================
    console.log('TEST 1: Initial Page Load');
    console.log('-'.repeat(40));

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-initial-load.png'), fullPage: true });

    const header = await page.locator('h1:has-text("Weekly Planning")').isVisible();
    const backlogPanel = await page.locator('text=Weekly Backlog').isVisible();
    const dateRange = await page.locator('text=/Jan \\d+ - Jan \\d+/').first().isVisible();

    console.log(`  Header visible: ${header ? 'PASS' : 'FAIL'}`);
    console.log(`  Backlog panel visible: ${backlogPanel ? 'PASS' : 'FAIL'}`);
    console.log(`  Date range visible: ${dateRange ? 'PASS' : 'FAIL'}`);

    // Count elements
    const backlogTasks = page.locator('[class*="bg-slate-800"][class*="cursor-grab"]');
    const backlogCount = await backlogTasks.count();
    console.log(`  Backlog tasks found: ${backlogCount}`);

    // ========================================
    // TEST 2: Click-Drag to Create Event
    // ========================================
    console.log('\nTEST 2: Click-Drag to Create Event');
    console.log('-'.repeat(40));

    // Find the first day column's tasks area
    const dayColumns = page.locator('[class*="flex"][class*="border-r"][class*="border-slate-"]');
    const colCount = await dayColumns.count();
    console.log(`  Day columns found: ${colCount}`);

    // Get the calendar grid container
    const calendarContainer = page.locator('[class*="overflow-x-auto"]').first();
    const calendarBox = await calendarContainer.boundingBox();

    if (calendarBox) {
      // Click and drag in the tasks area (right side of a day column)
      const startX = calendarBox.x + 200; // Into Sunday's tasks column
      const startY = calendarBox.y + 250; // Around 10AM

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.waitForTimeout(100);

      // Drag down to create time block
      await page.mouse.move(startX, startY + 60, { steps: 5 });
      await page.waitForTimeout(200);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02a-drag-preview.png'), fullPage: true });

      // Check for blue preview
      const bluePreview = await page.locator('[class*="bg-blue-500"]').count();
      console.log(`  Blue preview visible: ${bluePreview > 0 ? 'PASS' : 'FAIL'}`);

      await page.mouse.up();
      await page.waitForTimeout(500);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02b-popup-after-drag.png'), fullPage: true });

      // Check for popup
      const popup = await page.locator('[class*="fixed"][class*="z-50"]').first();
      const popupVisible = await popup.isVisible().catch(() => false);
      console.log(`  Popup appeared: ${popupVisible ? 'PASS' : 'FAIL'}`);

      if (popupVisible) {
        const newEventTab = await page.locator('button:has-text("New Event")').isVisible();
        const scheduleTaskTab = await page.locator('button:has-text("Schedule Task")').isVisible();
        const titleInput = await page.locator('input[placeholder="Add title"]').isVisible();

        console.log(`  "New Event" tab: ${newEventTab ? 'PASS' : 'FAIL'}`);
        console.log(`  "Schedule Task" tab: ${scheduleTaskTab ? 'PASS' : 'FAIL'}`);
        console.log(`  Title input: ${titleInput ? 'PASS' : 'FAIL'}`);

        // Fill in event title and create
        if (titleInput) {
          await page.locator('input[placeholder="Add title"]').fill('Test Meeting Created');
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02c-filled-title.png'), fullPage: true });

          // Track API calls before clicking
          const callCountBefore = apiCalls.length;

          await page.locator('button:has-text("Create Event")').click();
          await page.waitForTimeout(1000);

          await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02d-after-create.png'), fullPage: true });

          // Check for calendar API calls
          const newCalls = apiCalls.slice(callCountBefore);
          const calendarCalls = newCalls.filter(c => c.url.includes('calendar') || c.url.includes('event'));
          console.log(`  API calls made: ${calendarCalls.length > 0 ? 'PASS' : 'FAIL'}`);
          calendarCalls.forEach(c => console.log(`    ${c.method} ${c.url}`));
        }
      }

      // Close popup if still visible
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // ========================================
    // TEST 3: Right-Click Context Menu
    // ========================================
    console.log('\nTEST 3: Right-Click Context Menu');
    console.log('-'.repeat(40));

    // Navigate back to weekly planning (in case we're elsewhere)
    await page.goto(`${BASE_URL}/weekly-planning`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Find scheduled tasks (white border-left indicates a task)
    const scheduledTasks = page.locator('[class*="border-l-2"][class*="border-white"]');
    const taskCount = await scheduledTasks.count();
    console.log(`  Scheduled tasks found: ${taskCount}`);

    if (taskCount > 0) {
      const firstTask = scheduledTasks.first();
      await firstTask.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03a-before-right-click.png'), fullPage: true });

      const taskBox = await firstTask.boundingBox();
      if (taskBox) {
        // Right-click on the task
        await page.mouse.click(taskBox.x + taskBox.width / 2, taskBox.y + taskBox.height / 2, { button: 'right' });
        await page.waitForTimeout(500);

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03b-context-menu.png'), fullPage: true });

        // Check for context menu items
        const backToBacklog = await page.locator('text=Back to Backlog').isVisible();
        const editDetails = await page.locator('text=Edit Details').isVisible();
        const deleteOption = await page.locator('text=Delete').isVisible();

        console.log(`  Context menu visible: ${backToBacklog || editDetails ? 'PASS' : 'FAIL'}`);
        console.log(`  "Back to Backlog" option: ${backToBacklog ? 'PASS' : 'FAIL'}`);
        console.log(`  "Edit Details" option: ${editDetails ? 'PASS' : 'FAIL'}`);

        // Test the "Back to Backlog" action
        if (backToBacklog) {
          const callCountBefore = apiCalls.length;

          await page.locator('text=Back to Backlog').click();
          await page.waitForTimeout(1000);

          await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03c-after-unschedule.png'), fullPage: true });

          const newCalls = apiCalls.slice(callCountBefore);
          const taskCalls = newCalls.filter(c => c.url.includes('task'));
          console.log(`  Unschedule API called: ${taskCalls.length > 0 ? 'PASS' : 'FAIL'}`);
          taskCalls.forEach(c => console.log(`    ${c.method} ${c.url}`));
        } else {
          // Close menu
          await page.keyboard.press('Escape');
        }
      }
    } else {
      console.log('  No scheduled tasks found to test context menu');
    }

    // ========================================
    // TEST 4: Drag from Backlog to Calendar
    // ========================================
    console.log('\nTEST 4: Drag from Backlog to Calendar');
    console.log('-'.repeat(40));

    // Refresh to get updated backlog
    await page.goto(`${BASE_URL}/weekly-planning`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04a-backlog-initial.png'), fullPage: true });

    // Find backlog tasks
    const backlogTasksNew = page.locator('[class*="bg-slate-800"][class*="cursor-grab"]');
    const backlogCountNew = await backlogTasksNew.count();
    console.log(`  Backlog tasks found: ${backlogCountNew}`);

    if (backlogCountNew > 0) {
      const taskToDrag = backlogTasksNew.first();
      const taskText = await taskToDrag.textContent();
      console.log(`  Task to drag: "${taskText?.substring(0, 30)}..."`);

      const taskBox = await taskToDrag.boundingBox();
      const calendarArea = page.locator('[class*="overflow-x-auto"]').first();
      const calendarAreaBox = await calendarArea.boundingBox();

      if (taskBox && calendarAreaBox) {
        // Start drag from backlog task
        const startX = taskBox.x + taskBox.width / 2;
        const startY = taskBox.y + taskBox.height / 2;

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.waitForTimeout(200);

        // Move enough to trigger drag activation (8px)
        await page.mouse.move(startX + 15, startY);
        await page.waitForTimeout(200);

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04b-drag-started.png'), fullPage: true });

        // Check for drag overlay
        const dragOverlay = await page.locator('[class*="shadow-2xl"]').count();
        console.log(`  Drag overlay visible: ${dragOverlay > 0 ? 'PASS' : 'FAIL'}`);

        // Move to calendar drop zone
        const dropX = calendarAreaBox.x + 200;
        const dropY = calendarAreaBox.y + 250;

        await page.mouse.move(dropX, dropY, { steps: 15 });
        await page.waitForTimeout(300);

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04c-drag-over-calendar.png'), fullPage: true });

        // Check for drop highlight
        const dropHighlight = await page.locator('[class*="bg-blue-500/30"]').count();
        console.log(`  Drop highlight visible: ${dropHighlight > 0 ? 'PASS' : 'FAIL'}`);

        // Drop the task
        const callCountBefore = apiCalls.length;

        await page.mouse.up();
        await page.waitForTimeout(1000);

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04d-after-drop.png'), fullPage: true });

        const newCalls = apiCalls.slice(callCountBefore);
        const scheduleCalls = newCalls.filter(c => c.url.includes('task') && c.method === 'PATCH');
        console.log(`  Schedule API called: ${scheduleCalls.length > 0 ? 'PASS' : 'FAIL'}`);
        scheduleCalls.forEach(c => console.log(`    ${c.method} ${c.url}`));
      }
    } else {
      console.log('  No backlog tasks available to drag');
    }

    // ========================================
    // TEST 5: Complete a Task
    // ========================================
    console.log('\nTEST 5: Complete a Task');
    console.log('-'.repeat(40));

    // Find task checkboxes
    const checkboxes = page.locator('input[type="checkbox"]');
    const checkboxCount = await checkboxes.count();
    console.log(`  Checkboxes found: ${checkboxCount}`);

    if (checkboxCount > 0) {
      // Find an unchecked checkbox
      for (let i = 0; i < Math.min(checkboxCount, 10); i++) {
        const checkbox = checkboxes.nth(i);
        const isChecked = await checkbox.isChecked().catch(() => true);

        if (!isChecked) {
          await checkbox.scrollIntoViewIfNeeded();
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05a-before-complete.png'), fullPage: true });

          const callCountBefore = apiCalls.length;

          await checkbox.click();
          await page.waitForTimeout(500);

          await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05b-after-complete.png'), fullPage: true });

          const nowChecked = await checkbox.isChecked().catch(() => false);
          console.log(`  Checkbox toggled: ${nowChecked ? 'PASS' : 'FAIL'}`);

          const newCalls = apiCalls.slice(callCountBefore);
          const completeCalls = newCalls.filter(c => c.url.includes('task'));
          console.log(`  Complete API called: ${completeCalls.length > 0 ? 'PASS' : 'FAIL'}`);
          completeCalls.forEach(c => console.log(`    ${c.method} ${c.url}`));
          break;
        }
      }
    }

    // ========================================
    // TEST 6: Week Navigation
    // ========================================
    console.log('\nTEST 6: Week Navigation');
    console.log('-'.repeat(40));

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06a-initial-week.png'), fullPage: true });

    // Get current date range text
    const dateText = await page.locator('text=/Jan \\d+ - Jan \\d+/').first().textContent();
    console.log(`  Initial date range: ${dateText}`);

    // Find navigation buttons - look for chevron buttons
    const allButtons = page.locator('button');
    const buttonCount = await allButtons.count();

    // Find next/prev by looking at button position or SVG content
    const navButtons = page.locator('button:has(svg)');
    const navCount = await navButtons.count();
    console.log(`  Navigation buttons found: ${navCount}`);

    // Click the "next" button (usually the second one, or the rightward arrow)
    if (navCount >= 2) {
      // The second nav button should be "next"
      await navButtons.nth(1).click();
      await page.waitForTimeout(500);

      const newDateText = await page.locator('text=/[A-Z][a-z]+ \\d+ - [A-Z][a-z]+ \\d+/').first().textContent();
      console.log(`  After next: ${newDateText}`);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06b-next-week.png'), fullPage: true });

      const dateChanged = newDateText !== dateText;
      console.log(`  Week changed: ${dateChanged ? 'PASS' : 'FAIL'}`);

      // Go back
      await navButtons.first().click();
      await page.waitForTimeout(500);

      const backDateText = await page.locator('text=/[A-Z][a-z]+ \\d+ - [A-Z][a-z]+ \\d+/').first().textContent();
      console.log(`  After prev: ${backDateText}`);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06c-prev-week.png'), fullPage: true });
    }

    // ========================================
    // FINAL SUMMARY
    // ========================================
    console.log('\n' + '='.repeat(60));
    console.log('VERIFICATION COMPLETE');
    console.log('='.repeat(60));

    // List all screenshots
    const screenshots = fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png'));
    console.log(`\nScreenshots saved (${screenshots.length} files):`);
    screenshots.forEach(f => console.log(`  - ${f}`));

    // Summary of API calls
    console.log(`\nTotal API calls tracked: ${apiCalls.length}`);
    const taskCalls = apiCalls.filter(c => c.url.includes('task'));
    const calendarCalls = apiCalls.filter(c => c.url.includes('calendar'));
    console.log(`  Task-related: ${taskCalls.length}`);
    console.log(`  Calendar-related: ${calendarCalls.length}`);
  });
});

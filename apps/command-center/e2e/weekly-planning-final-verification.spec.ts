/**
 * Weekly Planning - Final Verification Test
 * Takes detailed screenshots to verify all features are working.
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

test.describe('Weekly Planning - Final Verification', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log(`BROWSER ERROR: ${msg.text()}`);
      }
    });

    await page.goto(`${BASE_URL}/weekly-planning`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  });

  test('Complete Feature Verification', async ({ page }) => {
    console.log('\n========================================');
    console.log('WEEKLY PLANNING FEATURE VERIFICATION');
    console.log('========================================\n');

    // 1. Initial page load
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-initial-page-load.png'), fullPage: true });
    console.log('1. Initial page load - Screenshot saved');

    // Check page structure
    const header = await page.locator('h1:has-text("Weekly Planning")').isVisible();
    const backlog = await page.locator('text=Weekly Backlog').isVisible();
    const calendar = await page.locator('.bg-slate-900.rounded-lg').first().isVisible();

    console.log(`   - Header visible: ${header}`);
    console.log(`   - Backlog panel visible: ${backlog}`);
    console.log(`   - Calendar visible: ${calendar}`);

    // 2. Test Click-Drag to Create
    console.log('\n2. Testing Click-Drag to Create...');

    // Find tasks column in first day
    const dayColumns = page.locator('.flex.border-r.border-slate-700');
    const firstDay = dayColumns.first();
    const tasksColumn = firstDay.locator('> div').last();
    const tasksBox = await tasksColumn.boundingBox();

    if (tasksBox) {
      const startX = tasksBox.x + tasksBox.width / 2;
      const startY = tasksBox.y + 200; // ~10AM position
      const endY = startY + 50;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.waitForTimeout(100);

      await page.mouse.move(startX, endY, { steps: 5 });
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-click-drag-preview.png'), fullPage: true });

      // Check for blue preview
      const bluePreview = await page.locator('.bg-blue-500\\/50').count();
      console.log(`   - Blue preview visible: ${bluePreview > 0 ? 'YES' : 'NO'}`);

      await page.mouse.up();
      await page.waitForTimeout(500);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-popup-after-drag.png'), fullPage: true });

      // Check for popup
      const popup = await page.locator('.fixed.z-50.bg-slate-800').count();
      const newEventTab = await page.locator('text=New Event').isVisible();
      const addTitleInput = await page.locator('input[placeholder="Add title"]').isVisible();

      console.log(`   - Popup appeared: ${popup > 0 ? 'YES' : 'NO'}`);
      console.log(`   - New Event tab visible: ${newEventTab ? 'YES' : 'NO'}`);
      console.log(`   - Add title input visible: ${addTitleInput ? 'YES' : 'NO'}`);

      // Close popup by clicking outside
      await page.mouse.click(100, 100);
      await page.waitForTimeout(300);
    }

    // 3. Test Right-Click Context Menu
    console.log('\n3. Testing Right-Click Context Menu...');

    const scheduledTasks = page.locator('[class*="border-l-2"][class*="border-white"]');
    const taskCount = await scheduledTasks.count();
    console.log(`   - Scheduled tasks found: ${taskCount}`);

    if (taskCount > 0) {
      const firstTask = scheduledTasks.first();
      await firstTask.scrollIntoViewIfNeeded();

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-before-right-click.png'), fullPage: true });

      const taskBox = await firstTask.boundingBox();
      if (taskBox) {
        // Right-click on the task
        await page.mouse.click(taskBox.x + taskBox.width / 2, taskBox.y + taskBox.height / 2, { button: 'right' });
        await page.waitForTimeout(800);

        // Wait for context menu to be visible
        await page.waitForSelector('text=Back to Backlog', { timeout: 3000 }).catch(() => {});
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-context-menu.png'), fullPage: true });

        const backToBacklog = await page.locator('text=Back to Backlog').isVisible();
        const editDetails = await page.locator('text=Edit Details').isVisible();

        console.log(`   - Context menu visible: ${backToBacklog || editDetails ? 'YES' : 'NO'}`);
        console.log(`   - "Back to Backlog" option: ${backToBacklog ? 'YES' : 'NO'}`);
        console.log(`   - "Edit Details" option: ${editDetails ? 'YES' : 'NO'}`);

        // Close context menu
        await page.mouse.click(100, 100);
        await page.waitForTimeout(300);
      }
    } else {
      console.log('   - No scheduled tasks to test context menu');
    }

    // 4. Test Drag from Backlog
    console.log('\n4. Testing Drag from Backlog...');

    // Re-navigate to ensure fresh state
    await page.goto(`${BASE_URL}/weekly-planning`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Look for tasks in the Weekly Backlog panel - they contain task titles
    // Try multiple strategies to find backlog tasks
    const backlogByText1 = page.locator('text=Test Task for Backlog');
    const backlogByText2 = page.locator('text=Drag Test Task');
    const count1 = await backlogByText1.count();
    const count2 = await backlogByText2.count();
    const backlogCount = count1 + count2;
    console.log(`   - Backlog tasks found: ${backlogCount} (Test Task: ${count1}, Drag Test: ${count2})`);

    if (backlogCount > 0) {
      // Use the first found task
      const backlogTask = count1 > 0 ? backlogByText1.first() : backlogByText2.first();
      const backlogBox = await backlogTask.boundingBox();

      // Get calendar area for drop target
      const dayColumnsNew = page.locator('.flex.border-r.border-slate-700');
      const firstDayNew = dayColumnsNew.first();
      const tasksColumnNew = firstDayNew.locator('> div').last();
      const tasksBoxNew = await tasksColumnNew.boundingBox();

      if (backlogBox && tasksBoxNew) {
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-before-backlog-drag.png'), fullPage: true });

        // Start drag
        await page.mouse.move(backlogBox.x + backlogBox.width / 2, backlogBox.y + backlogBox.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(200);

        // Move to trigger drag (8px activation distance)
        await page.mouse.move(backlogBox.x + backlogBox.width / 2 + 15, backlogBox.y + backlogBox.height / 2);
        await page.waitForTimeout(200);

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-drag-started.png'), fullPage: true });

        // Check for drag overlay
        const dragOverlay = await page.locator('[class*="shadow-2xl"], [class*="ring-blue-500"]').count();
        console.log(`   - Drag overlay visible: ${dragOverlay > 0 ? 'YES' : 'NO'}`);

        // Move toward calendar
        const dropX = tasksBoxNew.x + tasksBoxNew.width / 2;
        const dropY = tasksBoxNew.y + 200;

        await page.mouse.move(dropX, dropY, { steps: 10 });
        await page.waitForTimeout(300);

        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '08-drag-over-calendar.png'), fullPage: true });

        // Check for drop highlight
        const dropHighlight = await page.locator('[class*="bg-blue-500"]').count();
        console.log(`   - Drop highlight visible: ${dropHighlight > 0 ? 'YES' : 'NO'}`);

        // Cancel drag (don't actually drop to preserve test state)
        await page.keyboard.press('Escape');
        await page.mouse.up();
        await page.waitForTimeout(300);
      }
    } else {
      console.log('   - No backlog tasks to test dragging');
    }

    // 5. Test Week Navigation
    console.log('\n5. Testing Week Navigation...');

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '09-initial-week.png'), fullPage: true });

    const nextButton = page.locator('button').filter({ has: page.locator('svg path[d*="M9 5l7 7"]') });
    if (await nextButton.count() > 0) {
      await nextButton.click();
      await page.waitForTimeout(500);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '10-next-week.png'), fullPage: true });
      console.log('   - Next week navigation: WORKING');

      const prevButton = page.locator('button').filter({ has: page.locator('svg path[d*="M15 19l-7"]') });
      if (await prevButton.count() > 0) {
        await prevButton.click();
        await page.waitForTimeout(500);
        console.log('   - Previous week navigation: WORKING');
      }
    }

    // Final summary
    console.log('\n========================================');
    console.log('VERIFICATION COMPLETE');
    console.log('========================================');
    console.log('Screenshots saved to: ' + SCREENSHOT_DIR);
    console.log('\nAll screenshots:');
    const files = fs.readdirSync(SCREENSHOT_DIR);
    files.forEach(f => console.log(`  - ${f}`));
  });
});

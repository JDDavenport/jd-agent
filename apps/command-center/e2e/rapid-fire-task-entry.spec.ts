import { test, expect } from '@playwright/test';

test.describe('Rapid-Fire Task Entry in Weekly Planning Backlog', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to weekly planning page and wait for it to load
    await page.goto('http://localhost:5173/weekly-planning');
    await page.waitForTimeout(2000);

    // Ensure the Weekly Backlog panel is visible
    await expect(page.locator('h2:has-text("Weekly Backlog")')).toBeVisible({ timeout: 10000 });
  });

  test('1. "+ Add task" button is visible at the bottom of the backlog', async ({ page }) => {
    // Look for the Add task button with the dashed border style
    const addButton = page.locator('button:has-text("Add task")');

    await expect(addButton).toBeVisible();

    // Verify it has the dashed border styling
    const buttonClasses = await addButton.getAttribute('class');
    expect(buttonClasses).toContain('border-dashed');

    // Take screenshot for verification
    await page.screenshot({
      path: 'screenshots/rapid-fire/01-add-task-button-visible.png',
      fullPage: false
    });

    console.log('+ Add task button is visible at the bottom of the backlog');
  });

  test('2. Clicking "+ Add task" shows an input field', async ({ page }) => {
    // Click the Add task button
    const addButton = page.locator('button:has-text("Add task")');
    await addButton.click();

    // Verify input field appears with the correct placeholder
    const inputField = page.locator('input[placeholder="Type task and press Enter..."]');
    await expect(inputField).toBeVisible({ timeout: 5000 });

    // Verify the input is focused
    await expect(inputField).toBeFocused();

    // Verify help text is displayed
    const helpText = page.locator('text=Press Enter to add, Esc to cancel');
    await expect(helpText).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'screenshots/rapid-fire/02-input-field-visible.png',
      fullPage: false
    });

    console.log('Input field appears after clicking Add task button');
  });

  test('3. Typing a task and pressing Enter creates the task', async ({ page }) => {
    // Get initial task count
    const countText = page.locator('p.text-\\[10px\\].text-slate-400');
    const initialCountText = await countText.textContent();
    const initialCount = parseInt(initialCountText?.match(/\d+/)?.[0] || '0');
    console.log(`Initial task count: ${initialCount}`);

    // Click Add task button
    await page.locator('button:has-text("Add task")').click();

    // Type a task title
    const taskTitle = `Rapid Fire Test Task ${Date.now()}`;
    const inputField = page.locator('input[placeholder="Type task and press Enter..."]');
    await inputField.fill(taskTitle);

    // Take screenshot before pressing Enter
    await page.screenshot({
      path: 'screenshots/rapid-fire/03a-task-typed.png',
      fullPage: false
    });

    // Press Enter to create the task
    await inputField.press('Enter');

    // Wait for the task to be created
    await page.waitForTimeout(2000);

    // Verify the task appears in the backlog list
    const newTask = page.locator(`text=${taskTitle}`);
    await expect(newTask).toBeVisible({ timeout: 10000 });

    // Verify count increased
    const newCountText = await countText.textContent();
    const newCount = parseInt(newCountText?.match(/\d+/)?.[0] || '0');
    console.log(`New task count: ${newCount}`);
    expect(newCount).toBeGreaterThan(initialCount);

    // Take screenshot after task creation
    await page.screenshot({
      path: 'screenshots/rapid-fire/03b-task-created.png',
      fullPage: false
    });

    console.log(`Task "${taskTitle}" was created successfully`);
  });

  test('4. Input stays open after creating a task (rapid-fire mode)', async ({ page }) => {
    // Click Add task button
    await page.locator('button:has-text("Add task")').click();

    // Type first task
    const firstTaskTitle = `Rapid Fire First ${Date.now()}`;
    const inputField = page.locator('input[placeholder="Type task and press Enter..."]');
    await inputField.fill(firstTaskTitle);
    await inputField.press('Enter');

    // Wait for task creation
    await page.waitForTimeout(1500);

    // Verify the input is STILL visible (not closed)
    await expect(inputField).toBeVisible({ timeout: 5000 });

    // Verify the input has been cleared (ready for next task)
    const inputValue = await inputField.inputValue();
    expect(inputValue).toBe('');

    // Verify input is still focused
    await expect(inputField).toBeFocused();

    // Take screenshot showing input still open
    await page.screenshot({
      path: 'screenshots/rapid-fire/04-input-stays-open.png',
      fullPage: false
    });

    console.log('Input stays open after creating first task - ready for rapid-fire entry');
  });

  test('5. Creating a second task works immediately after the first', async ({ page }) => {
    // Get initial count
    const countText = page.locator('p.text-\\[10px\\].text-slate-400');
    const initialCountText = await countText.textContent();
    const initialCount = parseInt(initialCountText?.match(/\d+/)?.[0] || '0');

    // Click Add task button
    await page.locator('button:has-text("Add task")').click();
    const inputField = page.locator('input[placeholder="Type task and press Enter..."]');

    // Create first task
    const firstTaskTitle = `Rapid Fire A ${Date.now()}`;
    await inputField.fill(firstTaskTitle);
    await inputField.press('Enter');
    await page.waitForTimeout(1500);

    // Create second task immediately (input should still be open)
    const secondTaskTitle = `Rapid Fire B ${Date.now()}`;
    await inputField.fill(secondTaskTitle);

    // Take screenshot with second task typed
    await page.screenshot({
      path: 'screenshots/rapid-fire/05a-second-task-typed.png',
      fullPage: false
    });

    await inputField.press('Enter');
    await page.waitForTimeout(1500);

    // Verify both tasks appear in the list
    await expect(page.locator(`text=${firstTaskTitle}`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${secondTaskTitle}`)).toBeVisible({ timeout: 10000 });

    // Verify count increased by 2
    const finalCountText = await countText.textContent();
    const finalCount = parseInt(finalCountText?.match(/\d+/)?.[0] || '0');
    expect(finalCount).toBe(initialCount + 2);

    // Take screenshot with both tasks visible
    await page.screenshot({
      path: 'screenshots/rapid-fire/05b-both-tasks-created.png',
      fullPage: false
    });

    console.log(`Successfully created two tasks in rapid-fire mode: "${firstTaskTitle}" and "${secondTaskTitle}"`);
  });

  test('6. Pressing Escape closes the input', async ({ page }) => {
    // Click Add task button
    await page.locator('button:has-text("Add task")').click();

    // Verify input is visible
    const inputField = page.locator('input[placeholder="Type task and press Enter..."]');
    await expect(inputField).toBeVisible();

    // Optionally type something (but don't submit)
    await inputField.fill('This will be cancelled');

    // Take screenshot before Escape
    await page.screenshot({
      path: 'screenshots/rapid-fire/06a-before-escape.png',
      fullPage: false
    });

    // Press Escape
    await inputField.press('Escape');

    // Wait a moment for the UI to update
    await page.waitForTimeout(300);

    // Verify input is no longer visible
    await expect(inputField).not.toBeVisible({ timeout: 5000 });

    // Verify the Add task button is visible again
    await expect(page.locator('button:has-text("Add task")')).toBeVisible();

    // Take screenshot after Escape
    await page.screenshot({
      path: 'screenshots/rapid-fire/06b-after-escape.png',
      fullPage: false
    });

    console.log('Pressing Escape closes the input and shows Add task button again');
  });

  test('7. Tasks appear in the backlog list with correct formatting', async ({ page }) => {
    // Click Add task button
    await page.locator('button:has-text("Add task")').click();

    // Create a task with a unique title
    const taskTitle = `Formatted Task ${Date.now()}`;
    const inputField = page.locator('input[placeholder="Type task and press Enter..."]');
    await inputField.fill(taskTitle);
    await inputField.press('Enter');

    // Wait for task to be created
    await page.waitForTimeout(2000);

    // Verify the task appears in a properly formatted card
    const taskCard = page.locator('[class*="bg-slate-800"][class*="border-l-4"]').filter({ hasText: taskTitle });
    await expect(taskCard).toBeVisible({ timeout: 10000 });

    // Verify it has the draggable cursor style
    const cardClasses = await taskCard.getAttribute('class');
    expect(cardClasses).toContain('cursor-grab');

    // Verify the task title is displayed
    const titleElement = taskCard.locator('.font-medium');
    await expect(titleElement).toContainText(taskTitle);

    // Take final screenshot
    await page.screenshot({
      path: 'screenshots/rapid-fire/07-task-in-backlog-list.png',
      fullPage: false
    });

    console.log(`Task "${taskTitle}" appears in backlog with proper formatting`);
  });

  test('Full rapid-fire workflow: Add multiple tasks quickly', async ({ page }) => {
    // This test demonstrates the complete rapid-fire workflow
    const tasks = [
      `Quick Task 1 - ${Date.now()}`,
      `Quick Task 2 - ${Date.now()}`,
      `Quick Task 3 - ${Date.now()}`,
    ];

    // Get initial count
    const countText = page.locator('p.text-\\[10px\\].text-slate-400');
    const initialCountText = await countText.textContent();
    const initialCount = parseInt(initialCountText?.match(/\d+/)?.[0] || '0');
    console.log(`Starting with ${initialCount} tasks`);

    // Start rapid-fire mode
    await page.locator('button:has-text("Add task")').click();
    const inputField = page.locator('input[placeholder="Type task and press Enter..."]');

    // Add all tasks in rapid succession
    for (const taskTitle of tasks) {
      await inputField.fill(taskTitle);
      await inputField.press('Enter');
      await page.waitForTimeout(1000); // Brief wait for API
      console.log(`Created: ${taskTitle}`);
    }

    // Exit rapid-fire mode
    await inputField.press('Escape');
    await page.waitForTimeout(500);

    // Verify all tasks were created
    for (const taskTitle of tasks) {
      await expect(page.locator(`text=${taskTitle}`)).toBeVisible({ timeout: 10000 });
    }

    // Verify final count
    const finalCountText = await countText.textContent();
    const finalCount = parseInt(finalCountText?.match(/\d+/)?.[0] || '0');
    expect(finalCount).toBe(initialCount + 3);
    console.log(`Final count: ${finalCount} (added ${finalCount - initialCount} tasks)`);

    // Take final screenshot
    await page.screenshot({
      path: 'screenshots/rapid-fire/08-full-workflow-complete.png',
      fullPage: false
    });

    console.log('Successfully completed full rapid-fire workflow!');
  });
});

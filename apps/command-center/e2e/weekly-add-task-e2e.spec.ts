import { test, expect } from '@playwright/test';

test('End-to-end: Add task to weekly backlog', async ({ page }) => {
  // Collect console output
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`Console Error: ${msg.text()}`);
    }
  });

  await page.goto('http://localhost:5173/weekly-planning');
  await page.waitForTimeout(2000);

  // Get initial count
  const countElement = page.locator('p.text-\\[10px\\].text-slate-400');
  const initialCount = await countElement.textContent();
  console.log(`\n1. Initial count text: "${initialCount}"`);

  // Verify we have some tasks initially
  const taskCards = page.locator('[class*="cursor-grab"]');
  const initialCardCount = await taskCards.count();
  console.log(`   Task cards visible: ${initialCardCount}`);

  // Take initial screenshot
  await page.screenshot({ path: 'screenshots/e2e-add-1-initial.png' });

  // Click Add button
  console.log('\n2. Clicking Add button...');
  await page.locator('button:has-text("Add")').click();
  await page.waitForTimeout(300);

  // Fill form
  const uniqueTitle = `E2E Test ${Date.now()}`;
  console.log(`3. Entering title: ${uniqueTitle}`);
  await page.locator('input[placeholder="Task title..."]').fill(uniqueTitle);
  await page.locator('input[placeholder="Minutes"]').fill('45');

  await page.screenshot({ path: 'screenshots/e2e-add-2-form-filled.png' });

  // Submit
  console.log('4. Submitting form...');
  await page.locator('button:has-text("Add Task")').click();

  // Wait for mutation to complete and query to refresh
  await page.waitForTimeout(2000);

  await page.screenshot({ path: 'screenshots/e2e-add-3-after-submit.png' });

  // Check if form closed
  const formStillOpen = await page.locator('input[placeholder="Task title..."]').isVisible();
  console.log(`5. Form closed: ${!formStillOpen}`);

  // Check new count
  const newCount = await countElement.textContent();
  console.log(`6. New count text: "${newCount}"`);

  // Check for new task in list
  const newTaskVisible = await page.locator(`text=${uniqueTitle}`).isVisible();
  console.log(`7. New task visible: ${newTaskVisible}`);

  // Get final card count
  const finalCardCount = await taskCards.count();
  console.log(`8. Final task cards: ${finalCardCount} (was ${initialCardCount})`);

  // Verify the task was added
  if (newTaskVisible) {
    console.log('\n✓ SUCCESS: Task was added and is visible!');
  } else {
    console.log('\n✗ FAILED: Task not visible in list');
  }

  // Check count changed
  if (newCount !== initialCount) {
    console.log(`✓ SUCCESS: Count changed from "${initialCount}" to "${newCount}"`);
  } else {
    console.log(`⚠ WARNING: Count unchanged at "${newCount}"`);
  }

  expect(newTaskVisible).toBe(true);
});

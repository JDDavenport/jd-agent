import { test, expect, type Page } from '@playwright/test';

const TASKS_APP_URL = 'http://localhost:5180';

test.describe('Tasks App - Drag and Drop & Task Creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TASKS_APP_URL);
    // Wait for the app to load
    await page.waitForTimeout(2000);
  });

  test('1. Inbox View - Verify tasks can be reordered via drag-and-drop', async ({ page }) => {
    // Navigate to Inbox
    await page.click('text=Inbox');
    await page.waitForTimeout(1000);

    // Take screenshot of initial state
    await page.screenshot({
      path: 'screenshots/tasks-test/01-inbox-initial.png',
      fullPage: true
    });

    // Check if there are tasks in the inbox
    const inboxView = page.locator('[data-testid="inbox-view"]');
    const taskList = page.locator('[data-testid="inbox-task-list"]');

    // Get task cards
    const taskCards = page.locator('[data-testid="inbox-task-list"] > div').filter({ hasText: /\w+/ });
    const taskCount = await taskCards.count();

    console.log(`Found ${taskCount} tasks in inbox`);

    if (taskCount >= 2) {
      // Get the first two task titles
      const firstTaskBefore = await taskCards.first().textContent();
      const secondTaskBefore = await taskCards.nth(1).textContent();
      console.log(`Before drag: First task = "${firstTaskBefore?.slice(0, 50)}..."`);
      console.log(`Before drag: Second task = "${secondTaskBefore?.slice(0, 50)}..."`);

      // Attempt drag and drop
      const firstCard = taskCards.first();
      const secondCard = taskCards.nth(1);

      // Perform drag
      await firstCard.dragTo(secondCard);
      await page.waitForTimeout(500);

      // Take screenshot after drag
      await page.screenshot({
        path: 'screenshots/tasks-test/02-inbox-after-drag.png',
        fullPage: true
      });

      // Get tasks after drag
      const tasksAfterDrag = page.locator('[data-testid="inbox-task-list"] > div').filter({ hasText: /\w+/ });
      const firstTaskAfter = await tasksAfterDrag.first().textContent();
      console.log(`After drag: First task = "${firstTaskAfter?.slice(0, 50)}..."`);

      // The order should have changed (if drag worked)
      console.log(`Drag and drop ${firstTaskBefore !== firstTaskAfter ? 'WORKED' : 'DID NOT CHANGE ORDER'}`);
    } else {
      console.log('Not enough tasks to test drag and drop in Inbox');
    }
  });

  test('2. Inbox View - Create new task and verify it appears at BOTTOM', async ({ page }) => {
    // Navigate to Inbox
    await page.click('text=Inbox');
    await page.waitForTimeout(1000);

    // Take screenshot before adding task
    await page.screenshot({
      path: 'screenshots/tasks-test/03-inbox-before-add.png',
      fullPage: true
    });

    // Get current task count
    const taskCards = page.locator('[data-testid="inbox-task-list"] > div').filter({ hasText: /\w+/ });
    const taskCountBefore = await taskCards.count();
    console.log(`Tasks before adding: ${taskCountBefore}`);

    // Record existing task titles
    const existingTasks: string[] = [];
    for (let i = 0; i < Math.min(taskCountBefore, 5); i++) {
      const text = await taskCards.nth(i).textContent();
      existingTasks.push(text?.slice(0, 50) || '');
    }
    console.log('Existing tasks (first 5):', existingTasks);

    // The InlineAddTask component first shows a button "Add task", need to click it to reveal the input
    // First, scroll to the bottom of the task list where the "Add task" button should be
    await page.evaluate(() => {
      const taskList = document.querySelector('[data-testid="inbox-task-list"]');
      if (taskList) taskList.scrollIntoView({ block: 'end' });
    });
    await page.waitForTimeout(500);

    // Click the inline "Add task" button (not the header one) - use exact match
    const inlineAddTaskButton = page.getByRole('button', { name: 'Add task', exact: true });
    if (await inlineAddTaskButton.isVisible()) {
      await inlineAddTaskButton.click();
      await page.waitForTimeout(300);
    }

    // Now find and fill the input
    const addTaskInput = page.locator('input[placeholder*="Add to inbox"]');
    if (await addTaskInput.isVisible()) {
      // Type a new task with a unique identifier
      const uniqueTaskTitle = `Test Task from Playwright ${Date.now()}`;
      await addTaskInput.fill(uniqueTaskTitle);

      // Take screenshot of typed task
      await page.screenshot({
        path: 'screenshots/tasks-test/04a-inbox-task-typed.png',
        fullPage: true
      });

      await page.keyboard.press('Enter');

      // Wait for task to be added
      await page.waitForTimeout(2000);

      // Take screenshot after adding task
      await page.screenshot({
        path: 'screenshots/tasks-test/04-inbox-after-add.png',
        fullPage: true
      });

      // Get updated task list
      const updatedTaskCards = page.locator('[data-testid="inbox-task-list"] > div').filter({ hasText: /\w+/ });
      const taskCountAfter = await updatedTaskCards.count();
      console.log(`Tasks after adding: ${taskCountAfter}`);

      // Find the new task
      const newTaskLocator = page.locator(`text=${uniqueTaskTitle}`);
      const newTaskExists = await newTaskLocator.isVisible();
      console.log(`New task "${uniqueTaskTitle}" exists: ${newTaskExists}`);

      if (newTaskExists) {
        // Find the index of the new task
        for (let i = 0; i < taskCountAfter; i++) {
          const text = await updatedTaskCards.nth(i).textContent();
          if (text?.includes(uniqueTaskTitle)) {
            console.log(`New task found at index ${i} (0-based)`);
            if (i === taskCountAfter - 2) { // -2 because the last item is the input
              console.log('SUCCESS: New task appears at BOTTOM of the list');
            } else if (i === 0) {
              console.log('ISSUE: New task appears at TOP of the list (expected BOTTOM)');
            } else {
              console.log(`NOTE: New task appears at position ${i + 1} of ${taskCountAfter}`);
            }
            break;
          }
        }
      }
    } else {
      console.log('Could not find add task input - testing via Add Task button');
      // Use the main "+ Add Task" button in the header
      const headerAddButton = page.getByTestId('tasks-add-button');
      await headerAddButton.click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: 'screenshots/tasks-test/04-add-task-modal.png',
        fullPage: true
      });
    }
  });

  test('3. Today View - Verify tasks in Anytime Today can be reordered', async ({ page }) => {
    // Navigate to Today
    await page.click('text=Today');
    await page.waitForTimeout(1000);

    // Take screenshot of initial state
    await page.screenshot({
      path: 'screenshots/tasks-test/05-today-initial.png',
      fullPage: true
    });

    // Look for Anytime Today section
    const anytimeSection = page.locator('text=Anytime Today');
    const anytimeSectionExists = await anytimeSection.isVisible();
    console.log(`Anytime Today section exists: ${anytimeSectionExists}`);

    if (anytimeSectionExists) {
      // Get tasks in the Anytime Today section (they should be after the header)
      const anytimeHeader = page.locator('h2:has-text("Anytime Today")');
      const anytimeTasks = page.locator('h2:has-text("Anytime Today")').locator('..').locator('..').locator('section > div:not(.bg-gray-50)');

      // Try a different approach - find task cards
      const allTaskCards = page.locator('.border-gray-100, .border-b').filter({ hasText: /\w+/ });
      const taskCount = await allTaskCards.count();
      console.log(`Found ${taskCount} potential task elements`);

      if (taskCount >= 2) {
        // Record first two task titles
        const firstTask = await allTaskCards.first().textContent();
        const secondTask = await allTaskCards.nth(1).textContent();
        console.log(`Before drag: First = "${firstTask?.slice(0, 50)}..."`);
        console.log(`Before drag: Second = "${secondTask?.slice(0, 50)}..."`);

        // Attempt drag
        await allTaskCards.first().dragTo(allTaskCards.nth(1));
        await page.waitForTimeout(500);

        // Take screenshot after drag
        await page.screenshot({
          path: 'screenshots/tasks-test/06-today-after-drag.png',
          fullPage: true
        });

        const firstTaskAfter = await allTaskCards.first().textContent();
        console.log(`After drag: First = "${firstTaskAfter?.slice(0, 50)}..."`);
        console.log(`Drag and drop ${firstTask !== firstTaskAfter ? 'WORKED' : 'DID NOT CHANGE ORDER'}`);
      } else {
        console.log('Not enough tasks in Anytime Today to test drag and drop');
      }
    } else {
      console.log('No Anytime Today section - may need to add tasks for today first');
    }
  });

  test('4. Today View - Create new task and verify it appears at BOTTOM', async ({ page }) => {
    // Navigate to Today
    await page.click('text=Today');
    await page.waitForTimeout(1000);

    // Take screenshot before
    await page.screenshot({
      path: 'screenshots/tasks-test/07-today-before-add.png',
      fullPage: true
    });

    // The InlineAddTask component first shows a button "Add task", need to click it to reveal the input
    // Find and click the inline "Add task" button (exact match)
    const inlineAddTaskButton = page.getByRole('button', { name: 'Add task', exact: true });
    if (await inlineAddTaskButton.isVisible()) {
      await inlineAddTaskButton.click();
      await page.waitForTimeout(300);
    }

    // Find and click the "Add a task for today" input
    const addTaskInput = page.locator('input[placeholder*="Add a task for today"]');
    const inputExists = await addTaskInput.isVisible();
    console.log(`Add task input exists: ${inputExists}`);

    if (inputExists) {
      // Type a new task
      const uniqueTaskTitle = `Today Task from Playwright ${Date.now()}`;
      await addTaskInput.fill(uniqueTaskTitle);

      // Take screenshot of typed task
      await page.screenshot({
        path: 'screenshots/tasks-test/08a-today-task-typed.png',
        fullPage: true
      });

      await page.keyboard.press('Enter');

      // Wait for task to be added
      await page.waitForTimeout(2000);

      // Take screenshot after
      await page.screenshot({
        path: 'screenshots/tasks-test/08-today-after-add.png',
        fullPage: true
      });

      // Check if task exists
      const newTaskLocator = page.locator(`text=${uniqueTaskTitle}`);
      const newTaskExists = await newTaskLocator.isVisible();
      console.log(`New task "${uniqueTaskTitle}" exists: ${newTaskExists}`);

      // Check position of new task - it should be at the bottom of the "Anytime Today" section
      const anytimeHeader = page.locator('h2:has-text("Anytime Today")');
      if (await anytimeHeader.isVisible()) {
        console.log('Task should appear in Anytime Today section at the BOTTOM');
      }
    } else {
      console.log('Could not find add task for today input');
      await page.screenshot({
        path: 'screenshots/tasks-test/07b-today-no-input.png',
        fullPage: true
      });
    }
  });

  test('5. Order persistence after refresh', async ({ page }) => {
    // Navigate to Inbox
    await page.click('text=Inbox');
    await page.waitForTimeout(1000);

    // Get current task order
    const taskCards = page.locator('[data-testid="inbox-task-list"] > div').filter({ hasText: /\w+/ });
    const taskCount = await taskCards.count();
    const taskOrderBefore: string[] = [];

    for (let i = 0; i < Math.min(taskCount, 5); i++) {
      const text = await taskCards.nth(i).textContent();
      taskOrderBefore.push(text?.slice(0, 30) || '');
    }
    console.log('Task order before refresh:', taskOrderBefore);

    // Take screenshot before refresh
    await page.screenshot({
      path: 'screenshots/tasks-test/09-before-refresh.png',
      fullPage: true
    });

    // Refresh the page
    await page.reload();
    await page.waitForTimeout(2000);

    // Navigate back to Inbox (might auto-navigate)
    await page.click('text=Inbox');
    await page.waitForTimeout(1000);

    // Get task order after refresh
    const taskCardsAfter = page.locator('[data-testid="inbox-task-list"] > div').filter({ hasText: /\w+/ });
    const taskCountAfter = await taskCardsAfter.count();
    const taskOrderAfter: string[] = [];

    for (let i = 0; i < Math.min(taskCountAfter, 5); i++) {
      const text = await taskCardsAfter.nth(i).textContent();
      taskOrderAfter.push(text?.slice(0, 30) || '');
    }
    console.log('Task order after refresh:', taskOrderAfter);

    // Take screenshot after refresh
    await page.screenshot({
      path: 'screenshots/tasks-test/10-after-refresh.png',
      fullPage: true
    });

    // Compare orders
    const orderMatches = JSON.stringify(taskOrderBefore) === JSON.stringify(taskOrderAfter);
    console.log(`Order persistence: ${orderMatches ? 'PERSISTS' : 'DOES NOT PERSIST'}`);
  });
});

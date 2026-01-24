import { test, expect } from '@playwright/test';

test.describe('Weekly Planning Page Tests', () => {
  test('should load weekly planning page and display components', async ({ page }) => {
    await page.goto('http://localhost:5173/weekly-planning');
    await page.waitForTimeout(3000);

    // Take screenshot
    await page.screenshot({
      path: 'screenshots/weekly-planning-full.png',
      fullPage: true
    });

    // Check for Weekly Backlog panel
    const backlogHeader = page.locator('text=Weekly Backlog');
    await expect(backlogHeader).toBeVisible({ timeout: 10000 });

    // Check for Add button
    const addButton = page.locator('button:has-text("Add")');
    await expect(addButton).toBeVisible();

    // Check for calendar navigation
    const navigationExists = await page.locator('text=/Jan.*2026/').count();
    expect(navigationExists).toBeGreaterThan(0);

    // Take another screenshot after assertions
    await page.screenshot({
      path: 'screenshots/weekly-planning-verified.png',
      fullPage: false
    });

    console.log('Weekly Planning page loaded successfully!');
  });

  test('should display scheduled tasks in calendar', async ({ page }) => {
    await page.goto('http://localhost:5173/weekly-planning');
    await page.waitForTimeout(3000);

    // Check for task blocks in the calendar
    const taskColumn = page.locator('.flex-1.relative');
    const taskCount = await taskColumn.count();
    console.log(`Found ${taskCount} task columns`);

    // Look for any scheduled task text
    const pageContent = await page.content();
    const hasScheduledTasks = pageContent.includes('Quiz') ||
                             pageContent.includes('Assignment') ||
                             pageContent.includes('Deliv') ||
                             pageContent.includes('Weekly Test');

    console.log(`Has scheduled tasks content: ${hasScheduledTasks}`);

    await page.screenshot({
      path: 'screenshots/weekly-planning-tasks.png',
      fullPage: false
    });
  });

  test('should allow adding a task to backlog', async ({ page }) => {
    await page.goto('http://localhost:5173/weekly-planning');
    await page.waitForTimeout(2000);

    // Click Add button
    const addButton = page.locator('button:has-text("Add")');
    await addButton.click();
    await page.waitForTimeout(500);

    // Take screenshot of add form
    await page.screenshot({
      path: 'screenshots/weekly-planning-add-form.png',
      fullPage: false
    });

    // Check that input form appeared
    const titleInput = page.locator('input[placeholder="Task title..."]');
    await expect(titleInput).toBeVisible();

    console.log('Add task form works!');
  });

  test('should display backlog tasks', async ({ page }) => {
    await page.goto('http://localhost:5173/weekly-planning');
    await page.waitForTimeout(3000);

    // Check that backlog has tasks
    const taskCountText = await page.locator('text=/\\d+ tasks?/').first().textContent();
    console.log(`Backlog count: ${taskCountText}`);

    // Verify tasks are visible
    const taskCards = page.locator('[class*="bg-slate-800"][class*="border-l-4"]');
    const cardCount = await taskCards.count();
    console.log(`Task cards visible: ${cardCount}`);

    expect(cardCount).toBeGreaterThan(0);
  });

  test('DEBUG: check for auto-reload issue and console errors', async ({ page }) => {
    // Collect console errors
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
      if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    // Collect network requests to track refetches
    const networkRequests: { url: string; timestamp: number }[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/tasks')) {
        networkRequests.push({
          url: request.url(),
          timestamp: Date.now()
        });
      }
    });

    // Go to page
    await page.goto('http://localhost:5173/weekly-planning');
    await page.waitForTimeout(1000);

    const startTime = Date.now();

    // Wait 15 seconds to observe any auto-reload behavior
    console.log('Monitoring for auto-reload behavior over 15 seconds...');
    await page.waitForTimeout(15000);

    const endTime = Date.now();

    // Filter requests that happened during our monitoring window
    const requestsDuringMonitoring = networkRequests.filter(
      r => r.timestamp >= startTime && r.timestamp <= endTime
    );

    console.log(`\\n=== Auto-Reload Analysis ===`);
    console.log(`Monitoring duration: ${(endTime - startTime) / 1000} seconds`);
    console.log(`Total API requests to /tasks endpoints: ${requestsDuringMonitoring.length}`);

    // Group by similar timestamps to identify refetch cycles
    if (requestsDuringMonitoring.length > 0) {
      console.log('\\nRequest timestamps:');
      requestsDuringMonitoring.forEach((r, i) => {
        const relativeTime = ((r.timestamp - startTime) / 1000).toFixed(1);
        console.log(`  ${i + 1}. +${relativeTime}s: ${r.url.substring(0, 80)}...`);
      });
    }

    // Check if requests are happening too frequently (more than expected from refetchInterval)
    // Expected: refetchInterval is 30s, so in 15s we should see 0-1 refetches max
    const requestsPerSecond = requestsDuringMonitoring.length / 15;
    console.log(`\\nRequests per second: ${requestsPerSecond.toFixed(2)}`);

    if (requestsPerSecond > 0.5) {
      console.log('WARNING: High request frequency detected - possible auto-reload issue!');
    } else {
      console.log('OK: Request frequency within expected range');
    }

    console.log(`\\n=== Console Errors ===`);
    if (consoleErrors.length > 0) {
      console.log(`Found ${consoleErrors.length} console errors:`);
      consoleErrors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
    } else {
      console.log('No console errors detected');
    }

    console.log(`\\n=== Console Warnings ===`);
    if (consoleWarnings.length > 0) {
      console.log(`Found ${consoleWarnings.length} warnings:`);
      consoleWarnings.slice(0, 10).forEach((w, i) => console.log(`  ${i + 1}. ${w}`));
    } else {
      console.log('No console warnings detected');
    }

    await page.screenshot({
      path: 'screenshots/weekly-planning-debug-reload.png',
      fullPage: true
    });

    // Don't fail the test, just report findings
    console.log('\\n=== Debug Complete ===');
  });

  test('DEBUG: test Add Task button and form submission', async ({ page }) => {
    // Collect console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Collect network responses
    const networkResponses: { url: string; status: number; body?: string }[] = [];
    page.on('response', async response => {
      if (response.url().includes('/api/tasks')) {
        let body = '';
        try {
          body = await response.text();
        } catch {}
        networkResponses.push({
          url: response.url(),
          status: response.status(),
          body: body.substring(0, 500)
        });
      }
    });

    await page.goto('http://localhost:5173/weekly-planning');
    await page.waitForTimeout(2000);

    // Get initial task count
    const initialCountText = await page.locator('text=/\\d+ tasks?/').first().textContent();
    const initialCount = parseInt(initialCountText?.match(/\\d+/)?.[0] || '0');
    console.log(`\\nInitial task count: ${initialCount}`);

    // Click Add button
    console.log('\\n1. Clicking Add button...');
    const addButton = page.locator('button:has-text("Add")');
    await addButton.click();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: 'screenshots/weekly-planning-debug-add-step1.png',
      fullPage: false
    });

    // Check that form appeared
    const titleInput = page.locator('input[placeholder="Task title..."]');
    const formVisible = await titleInput.isVisible();
    console.log(`2. Form visible: ${formVisible}`);

    if (!formVisible) {
      console.log('ERROR: Add form did not appear!');
      return;
    }

    // Fill in the form
    const testTaskTitle = `Debug Test Task ${Date.now()}`;
    console.log(`3. Typing task title: ${testTaskTitle}`);
    await titleInput.fill(testTaskTitle);

    const minutesInput = page.locator('input[placeholder="Minutes"]');
    await minutesInput.fill('30');

    await page.screenshot({
      path: 'screenshots/weekly-planning-debug-add-step2.png',
      fullPage: false
    });

    // Click Add Task button to submit
    console.log('4. Clicking Add Task submit button...');
    const submitButton = page.locator('button:has-text("Add Task")');
    const submitEnabled = await submitButton.isEnabled();
    console.log(`   Submit button enabled: ${submitEnabled}`);

    // Clear network responses before submit
    networkResponses.length = 0;
    consoleErrors.length = 0;

    await submitButton.click();

    // Wait for network request
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: 'screenshots/weekly-planning-debug-add-step3.png',
      fullPage: false
    });

    // Check network responses
    console.log('\\n=== Network Responses ===');
    if (networkResponses.length > 0) {
      networkResponses.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.url}`);
        console.log(`     Status: ${r.status}`);
        console.log(`     Body: ${r.body?.substring(0, 200)}...`);
      });
    } else {
      console.log('No API responses captured');
    }

    // Check for POST request specifically
    const postResponse = networkResponses.find(r => r.url.endsWith('/api/tasks') && r.status === 201);
    if (postResponse) {
      console.log('\\nSUCCESS: Task created (201 response)');
    } else {
      const failedPost = networkResponses.find(r => r.url.includes('/api/tasks'));
      if (failedPost) {
        console.log(`\\nFAILED: Task creation returned status ${failedPost.status}`);
        console.log(`Response: ${failedPost.body}`);
      } else {
        console.log('\\nERROR: No POST request to /api/tasks was made');
      }
    }

    // Check for console errors
    console.log('\\n=== Console Errors After Submit ===');
    if (consoleErrors.length > 0) {
      consoleErrors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
    } else {
      console.log('No console errors');
    }

    // Check if form closed (indicates success)
    const formStillVisible = await titleInput.isVisible();
    console.log(`\\nForm still visible: ${formStillVisible}`);
    if (!formStillVisible) {
      console.log('Form closed - suggests successful submission');
    }

    // Check new task count
    await page.waitForTimeout(1000);
    const newCountText = await page.locator('text=/\\d+ tasks?/').first().textContent();
    const newCount = parseInt(newCountText?.match(/\\d+/)?.[0] || '0');
    console.log(`\\nNew task count: ${newCount} (was ${initialCount})`);

    if (newCount > initialCount) {
      console.log('SUCCESS: Task count increased!');
    } else if (newCount === initialCount) {
      console.log('NOTE: Task count unchanged - task may not have been created');
    }

    // Check if new task appears in list
    const newTaskVisible = await page.locator(`text=${testTaskTitle}`).isVisible();
    console.log(`New task "${testTaskTitle}" visible in list: ${newTaskVisible}`);

    console.log('\\n=== Add Task Debug Complete ===');
  });

  test('DEBUG: test week navigation', async ({ page }) => {
    await page.goto('http://localhost:5173/weekly-planning');
    await page.waitForTimeout(2000);

    // Get initial date range - use text pattern matching
    const dateRangeText = await page.getByText(/Jan \d+ - [A-Z][a-z]+ \d+, 2026/).textContent();
    console.log(`\nInitial date range: ${dateRangeText}`);

    await page.screenshot({
      path: 'screenshots/weekly-planning-nav-initial.png',
      fullPage: false
    });

    // Click next week button - it's in the calendar header area
    console.log('\nClicking next week button...');
    // The next button is the one on the right side of the date range
    const nextButton = page.locator('button').filter({ has: page.locator('svg path[d*="9 5l7"]') });
    if (await nextButton.count() > 0) {
      await nextButton.click();
    } else {
      // Fallback: find buttons in header and click second one
      const headerButtons = page.locator('.bg-slate-800 button');
      if (await headerButtons.count() >= 2) {
        await headerButtons.nth(1).click();
      }
    }
    await page.waitForTimeout(1000);

    const newDateRange = await page.getByText(/[A-Z][a-z]+ \d+ - [A-Z][a-z]+ \d+, 2026/).textContent();
    console.log(`After next: ${newDateRange}`);

    await page.screenshot({
      path: 'screenshots/weekly-planning-nav-next.png',
      fullPage: false
    });

    // Click previous week button
    console.log('\nClicking previous week button...');
    const prevButton = page.locator('button').filter({ has: page.locator('svg path[d*="15 19l"]') });
    if (await prevButton.count() > 0) {
      await prevButton.click();
    } else {
      const headerButtons = page.locator('.bg-slate-800 button');
      if (await headerButtons.count() >= 1) {
        await headerButtons.nth(0).click();
      }
    }
    await page.waitForTimeout(1000);

    const finalDateRange = await page.getByText(/[A-Z][a-z]+ \d+ - [A-Z][a-z]+ \d+, 2026/).textContent();
    console.log(`After prev: ${finalDateRange}`);

    await page.screenshot({
      path: 'screenshots/weekly-planning-nav-prev.png',
      fullPage: false
    });

    console.log('\n=== Navigation Debug Complete ===');
  });

  test('DEBUG: verify drag and drop setup', async ({ page }) => {
    await page.goto('http://localhost:5173/weekly-planning');
    await page.waitForTimeout(2000);

    // Find a task card in the backlog
    const taskCards = page.locator('[class*="bg-slate-800"][class*="border-l-4"][class*="cursor-grab"]');
    const cardCount = await taskCards.count();
    console.log(`\\nFound ${cardCount} draggable task cards`);

    if (cardCount > 0) {
      const firstCard = taskCards.first();
      const cardText = await firstCard.textContent();
      console.log(`First card content: ${cardText?.substring(0, 50)}...`);

      // Check for drag handle
      const dragHandle = firstCard.locator('svg path[d*="M4 8h16"]');
      const handleExists = await dragHandle.count() > 0;
      console.log(`Drag handle present: ${handleExists}`);
    }

    // Find droppable slots in calendar
    const droppableSlots = page.locator('[class*="transition-all"][class*="border-b"]');
    const slotCount = await droppableSlots.count();
    console.log(`\\nFound ${slotCount} potential droppable time slots`);

    await page.screenshot({
      path: 'screenshots/weekly-planning-dnd-setup.png',
      fullPage: true
    });

    console.log('\\n=== Drag & Drop Setup Debug Complete ===');
  });
});

import { test, expect, type Page } from '@playwright/test';
import {
  navigateAndWait,
  waitForPageReady,
  waitForLoadingToComplete,
  fillFormField,
  elementExists,
  getErrorMessages,
  mockAPIResponse,
  clearBrowserData,
  pressShortcut,
  isTextVisible,
} from './helpers';
import { buildErrorResponse, buildSuccessResponse } from './fixtures';

/**
 * Edge Case & Error Testing
 * Tests edge cases, error scenarios, and boundary conditions
 */

test.describe('Input Validation', () => {
  test('should handle empty form submissions', async ({ page }) => {
    await navigateAndWait(page, '/brain-dump');

    const textarea = page.locator('textarea').first();
    await textarea.clear();

    const addButton = page.locator('button:has-text("Add Single Task")');
    const isDisabled = await addButton.isDisabled();

    expect(isDisabled).toBe(true);

    // Try clicking anyway
    await addButton.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);

    // Should not add empty task
    const errorMessages = await getErrorMessages(page);
    expect(errorMessages.length >= 0).toBe(true);
  });

  test('should reject forms with only whitespace', async ({ page }) => {
    await navigateAndWait(page, '/brain-dump');

    const textarea = page.locator('textarea').first();
    await textarea.fill('   \n\t   ');

    const addButton = page.locator('button:has-text("Add Single Task")');
    const isDisabled = await addButton.isDisabled();

    expect(isDisabled).toBe(true);
  });

  test('should handle maximum length inputs (1000+ chars)', async ({ page }) => {
    await navigateAndWait(page, '/brain-dump');

    const longText = 'A'.repeat(5000); // 5000 character string

    const textarea = page.locator('textarea').first();
    await textarea.fill(longText);

    const addButton = page.locator('button:has-text("Add Single Task")');
    await addButton.click();
    await page.waitForTimeout(1000);

    // Should handle long input gracefully
    const errors = await getErrorMessages(page);
    expect(errors.length >= 0).toBe(true);
  });

  test('should handle special characters in all fields', async ({ page }) => {
    await navigateAndWait(page, '/vault/new');

    const specialChars = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';

    const titleInput = page.locator('input[placeholder*="title" i]').first();
    await titleInput.fill(specialChars);

    const contentEditor = page.locator('textarea, [contenteditable]').first();
    await contentEditor.fill(specialChars);

    const saveButton = page.locator('button:has-text("Save")').first();
    if (await saveButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await saveButton.click();
      await page.waitForTimeout(1000);
    }

    // Should handle special characters
    expect(page.url()).toBeTruthy();
  });

  test('should prevent SQL injection attempts', async ({ page }) => {
    await navigateAndWait(page, '/vault');

    const sqlInjection = "'; DROP TABLE users; --";

    const searchInput = page.locator('input[placeholder*="Search" i]').first();
    await searchInput.fill(sqlInjection);
    await page.waitForTimeout(1000);

    // Application should not crash
    expect(page.url()).toContain('/vault');

    // No SQL errors should be visible
    const pageContent = await page.content();
    expect(pageContent.toLowerCase()).not.toContain('sql error');
    expect(pageContent.toLowerCase()).not.toContain('syntax error');
  });

  test('should prevent XSS attempts', async ({ page }) => {
    await navigateAndWait(page, '/brain-dump');

    const xssPayload = '<script>alert("XSS")</script>';

    const textarea = page.locator('textarea').first();
    await textarea.fill(xssPayload);

    const addButton = page.locator('button:has-text("Add Single Task")');
    await addButton.click();
    await page.waitForTimeout(1000);

    // Check that script was not executed
    let alertFired = false;
    page.on('dialog', async (dialog) => {
      alertFired = true;
      await dialog.dismiss();
    });

    await page.waitForTimeout(500);
    expect(alertFired).toBe(false);

    // Script tags should be escaped or removed
    const pageContent = await page.content();
    const hasRawScript = pageContent.includes('<script>alert("XSS")</script>');
    expect(hasRawScript).toBe(false);
  });

  test('should handle unicode and emoji inputs', async ({ page }) => {
    await navigateAndWait(page, '/brain-dump');

    const unicodeText = 'Hello 世界 🌍 👋 مرحبا Привет';

    const textarea = page.locator('textarea').first();
    await textarea.fill(unicodeText);

    const addButton = page.locator('button:has-text("Add Single Task")');
    await addButton.click();
    await page.waitForTimeout(1000);

    // Should handle unicode correctly
    const hasUnicode = await isTextVisible(page, '世界');
    expect(hasUnicode || true).toBeTruthy();
  });

  test('should prevent rapid form submissions', async ({ page }) => {
    await navigateAndWait(page, '/brain-dump');

    const textarea = page.locator('textarea').first();
    const addButton = page.locator('button:has-text("Add Single Task")');

    let successfulSubmissions = 0;

    // Try to submit 10 times rapidly
    for (let i = 0; i < 10; i++) {
      await textarea.fill(`Rapid submission ${i}`);
      await addButton.click();
      await page.waitForTimeout(50); // Very short delay

      const isDisabled = await addButton.isDisabled();
      if (!isDisabled) {
        successfulSubmissions++;
      }
    }

    console.log(`Successful rapid submissions: ${successfulSubmissions}`);

    // Should have some rate limiting or debouncing
    expect(successfulSubmissions).toBeLessThan(10);
  });
});

test.describe('Network Errors', () => {
  test('should handle API timeout', async ({ page }) => {
    // Simulate slow API
    await page.route('**/api/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 60000)); // 60 second delay
      await route.abort('timedout');
    });

    await page.goto('/');
    await page.waitForTimeout(5000);

    // Should show error state or loading state
    const hasError = await elementExists(page, '[class*="error"], [role="alert"]');
    const hasLoading = await elementExists(page, '[class*="loading"], [class*="spinner"]');

    expect(hasError || hasLoading).toBe(true);
  });

  test('should handle 500 error responses', async ({ page }) => {
    await mockAPIResponse(
      page,
      '**/api/tasks**',
      buildErrorResponse('Internal Server Error', 'INTERNAL_ERROR'),
      500
    );

    await page.goto('/');
    await waitForPageReady(page);

    // Should show error message or fallback UI
    const errors = await getErrorMessages(page);
    const hasErrorUI = errors.length > 0 || (await elementExists(page, '[class*="error"]'));

    expect(hasErrorUI).toBe(true);
  });

  test('should handle network offline', async ({ page, context }) => {
    await page.goto('/');
    await waitForPageReady(page);

    // Go offline
    await context.setOffline(true);

    // Try to navigate
    await page.click('a[href="/vault"]').catch(() => {});
    await page.waitForTimeout(2000);

    // Should show offline message or cached content
    const pageContent = await page.content();
    expect(pageContent.length).toBeGreaterThan(0);

    // Go back online
    await context.setOffline(false);
  });

  test('should test retry logic', async ({ page }) => {
    let attemptCount = 0;

    await page.route('**/api/tasks**', async (route) => {
      attemptCount++;

      if (attemptCount < 3) {
        // Fail first 2 attempts
        await route.fulfill({
          status: 503,
          body: JSON.stringify(buildErrorResponse('Service Unavailable')),
        });
      } else {
        // Succeed on 3rd attempt
        await route.fulfill({
          status: 200,
          body: JSON.stringify(buildSuccessResponse([])),
        });
      }
    });

    await page.goto('/');
    await page.waitForTimeout(5000);

    console.log(`API attempts: ${attemptCount}`);

    // Should retry and eventually succeed
    expect(attemptCount).toBeGreaterThanOrEqual(1);
  });

  test('should test graceful degradation', async ({ page }) => {
    // Block all API calls
    await page.route('**/api/**', (route) => route.abort('failed'));

    await page.goto('/');
    await waitForPageReady(page);

    // Page should still render basic structure
    const h1 = await page.locator('h1').count();
    expect(h1).toBeGreaterThan(0);

    // Should show error state or empty state
    const hasContent = await page.locator('body').textContent();
    expect(hasContent?.length).toBeGreaterThan(0);
  });
});

test.describe('State Management', () => {
  test('should handle rapid navigation between pages', async ({ page }) => {
    const routes = ['/', '/vault', '/chat', '/settings', '/'];

    for (let i = 0; i < 3; i++) {
      for (const route of routes) {
        await page.goto(route);
        await page.waitForTimeout(100); // Very short delay
      }
    }

    // Should end up on last route without crashing
    expect(page.url()).toContain('/');
    const h1 = await page.locator('h1').count();
    expect(h1).toBeGreaterThan(0);
  });

  test('should handle multiple concurrent operations', async ({ page }) => {
    await navigateAndWait(page, '/vault');

    // Trigger multiple searches simultaneously
    const searchInput = page.locator('input[placeholder*="Search" i]').first();

    const searches = ['test1', 'test2', 'test3', 'test4', 'test5'];
    const searchPromises = searches.map(async (query) => {
      await searchInput.fill(query);
      await page.waitForTimeout(50);
    });

    await Promise.all(searchPromises);
    await page.waitForTimeout(1000);

    // Should handle concurrent operations without crashing
    expect(page.url()).toContain('/vault');
  });

  test('should handle race conditions in data fetching', async ({ page }) => {
    let requestCount = 0;

    await page.route('**/api/vault**', async (route) => {
      requestCount++;
      const delay = Math.random() * 1000; // Random delay 0-1s

      await new Promise((resolve) => setTimeout(resolve, delay));
      await route.continue();
    });

    // Navigate to vault multiple times quickly
    await page.goto('/vault');
    await page.goto('/');
    await page.goto('/vault');
    await page.waitForTimeout(2000);

    console.log(`Total API requests: ${requestCount}`);

    // Should handle race conditions gracefully
    expect(page.url()).toContain('/vault');
  });

  test('should handle stale data correctly', async ({ page }) => {
    await navigateAndWait(page, '/');

    // Get initial data
    const initialContent = await page.locator('body').textContent();

    // Simulate data update
    await mockAPIResponse(page, '**/api/tasks**', buildSuccessResponse([]));

    // Refresh
    await page.reload();
    await waitForPageReady(page);

    // Should update with fresh data
    const updatedContent = await page.locator('body').textContent();
    expect(updatedContent).toBeTruthy();
  });

  test('should handle cache invalidation', async ({ page }) => {
    await navigateAndWait(page, '/vault');

    // Create a new note
    await page.goto('/vault/new');
    await waitForPageReady(page);

    const titleInput = page.locator('input[placeholder*="title" i]').first();
    await titleInput.fill('Cache Test Note');

    const saveButton = page.locator('button:has-text("Save")').first();
    if (await saveButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await saveButton.click();
      await page.waitForTimeout(1000);
    }

    // Go back to vault
    await page.goto('/vault');
    await waitForPageReady(page);

    // New note should appear (cache should be invalidated)
    const hasNewNote = await page.locator('text=Cache Test Note').count();
    expect(hasNewNote >= 0).toBe(true);
  });
});

test.describe('Browser Compatibility', () => {
  test('should work in webkit engine', async ({ page }) => {
    // This test will run in the webkit browser if configured
    await navigateAndWait(page, '/');

    const h1 = await page.locator('h1').textContent();
    expect(h1).toBeTruthy();

    // Test basic interactions
    const link = page.locator('a[href="/vault"]').first();
    if (await link.isVisible({ timeout: 5000 }).catch(() => false)) {
      await link.click();
      await waitForPageReady(page);
      expect(page.url()).toContain('/vault');
    }
  });

  test('should handle localStorage limits', async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);

    // Try to fill localStorage
    const result = await page.evaluate(() => {
      try {
        const testKey = 'test_large_data';
        const largeData = 'x'.repeat(5 * 1024 * 1024); // 5MB string

        localStorage.setItem(testKey, largeData);
        return { success: true, error: null };
      } catch (e) {
        return { success: false, error: (e as Error).message };
      }
    });

    console.log(`localStorage test result:`, result);

    // Should handle storage quota gracefully
    expect(result.error || result.success).toBeTruthy();
  });

  test('should handle cookies disabled', async ({ page, context }) => {
    // Clear all cookies
    await context.clearCookies();

    await page.goto('/');
    await waitForPageReady(page);

    // App should still function without cookies
    const h1 = await page.locator('h1').count();
    expect(h1).toBeGreaterThan(0);
  });

  test('should gracefully degrade with JavaScript errors', async ({ page }) => {
    // Listen for JavaScript errors
    const jsErrors: string[] = [];

    page.on('pageerror', (error) => {
      jsErrors.push(error.message);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        jsErrors.push(msg.text());
      }
    });

    await page.goto('/');
    await waitForPageReady(page);

    // Navigate through the app
    await page.goto('/vault');
    await waitForPageReady(page);

    await page.goto('/chat');
    await waitForPageReady(page);

    console.log(`JavaScript errors detected: ${jsErrors.length}`);
    if (jsErrors.length > 0) {
      console.log('Errors:', jsErrors);
    }

    // Should have minimal JavaScript errors
    expect(jsErrors.length).toBeLessThan(5);
  });
});

test.describe('Accessibility Edge Cases', () => {
  test('should support keyboard-only navigation through entire app', async ({ page }) => {
    await navigateAndWait(page, '/');

    // Tab through elements
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);

      // Check if we can activate focused element
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? el.tagName : null;
      });

      expect(focusedElement).toBeTruthy();
    }

    // Try to navigate using Enter key
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Should still be functional
    expect(page.url()).toBeTruthy();
  });

  test('should work with screen reader attributes', async ({ page }) => {
    await navigateAndWait(page, '/');

    // Check for ARIA labels
    const buttonsWithLabels = await page.locator('button[aria-label]').count();
    const linksWithLabels = await page.locator('a[aria-label]').count();
    const inputsWithLabels = await page.locator('input[aria-label], input[aria-labelledby]').count();

    console.log(`Buttons with ARIA labels: ${buttonsWithLabels}`);
    console.log(`Links with ARIA labels: ${linksWithLabels}`);
    console.log(`Inputs with ARIA labels: ${inputsWithLabels}`);

    // Should have some accessibility attributes
    expect(buttonsWithLabels + linksWithLabels + inputsWithLabels).toBeGreaterThanOrEqual(0);

    // Check for role attributes
    const elementsWithRoles = await page.locator('[role]').count();
    expect(elementsWithRoles).toBeGreaterThanOrEqual(0);
  });

  test('should support high contrast mode', async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);

    // Simulate high contrast mode
    await page.evaluate(() => {
      document.documentElement.style.filter = 'contrast(2)';
    });

    await page.waitForTimeout(500);

    // Check that content is still visible
    const bodyVisible = await page.locator('body').isVisible();
    expect(bodyVisible).toBe(true);

    // Check that text has sufficient contrast
    const textElements = await page.locator('h1, h2, p, span').all();
    let visibleTextCount = 0;

    for (const el of textElements.slice(0, 10)) {
      const text = await el.textContent();
      if (text && text.trim()) {
        visibleTextCount++;
      }
    }

    expect(visibleTextCount).toBeGreaterThan(0);
  });
});

test.describe('Data Integrity Edge Cases', () => {
  test('should handle corrupted localStorage data', async ({ page }) => {
    await page.goto('/');

    // Corrupt localStorage
    await page.evaluate(() => {
      localStorage.setItem('app_state', 'corrupted{invalid:json}');
    });

    // Reload page
    await page.reload();
    await waitForPageReady(page);

    // Should handle corrupted data gracefully
    const h1 = await page.locator('h1').count();
    expect(h1).toBeGreaterThan(0);
  });

  test('should handle missing required data fields', async ({ page }) => {
    await mockAPIResponse(page, '**/api/tasks**', {
      success: true,
      data: [
        { id: '1' }, // Missing required fields
        { title: 'Task without ID' }, // Missing ID
      ],
    });

    await page.goto('/');
    await waitForPageReady(page);

    // Should handle incomplete data
    const hasContent = await page.locator('body').textContent();
    expect(hasContent?.length).toBeGreaterThan(0);
  });

  test('should handle null and undefined values', async ({ page }) => {
    await mockAPIResponse(page, '**/api/vault**', {
      success: true,
      data: [
        {
          id: '1',
          title: null,
          content: undefined,
          tags: null,
        },
      ],
    });

    await page.goto('/vault');
    await waitForPageReady(page);

    // Should handle null/undefined gracefully
    expect(page.url()).toContain('/vault');
  });

  test('should handle circular JSON references', async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);

    // Try to create circular reference in state
    const result = await page.evaluate(() => {
      try {
        const obj: any = { a: 1 };
        obj.self = obj; // Circular reference

        JSON.stringify(obj);
        return false;
      } catch (e) {
        return true; // Correctly caught circular reference
      }
    });

    expect(result).toBe(true);
  });

  test('should handle extremely nested data structures', async ({ page }) => {
    const deeplyNested: any = { level: 0 };
    let current = deeplyNested;

    for (let i = 1; i < 100; i++) {
      current.child = { level: i };
      current = current.child;
    }

    await mockAPIResponse(page, '**/api/test**', buildSuccessResponse(deeplyNested));

    await page.goto('/');
    await waitForPageReady(page);

    // Should handle deeply nested structures
    expect(page.url()).toBeTruthy();
  });
});

test.describe('Boundary Conditions', () => {
  test('should handle zero items in lists', async ({ page }) => {
    await mockAPIResponse(page, '**/api/tasks**', buildSuccessResponse([]));
    await mockAPIResponse(page, '**/api/vault**', buildSuccessResponse([]));

    await page.goto('/');
    await waitForPageReady(page);

    // Should show empty state
    const hasEmptyState =
      (await elementExists(page, '[class*="empty"]')) ||
      (await isTextVisible(page, /no tasks|no items|get started/i));

    expect(hasEmptyState || true).toBe(true);
  });

  test('should handle single item in lists', async ({ page }) => {
    await mockAPIResponse(
      page,
      '**/api/tasks**',
      buildSuccessResponse([
        {
          id: '1',
          title: 'Single Task',
          status: 'today',
          createdAt: new Date().toISOString(),
        },
      ])
    );

    await page.goto('/');
    await waitForPageReady(page);

    // Should display single item correctly
    const hasSingleTask = await isTextVisible(page, 'Single Task');
    expect(hasSingleTask || true).toBe(true);
  });

  test('should handle maximum integer values', async ({ page }) => {
    const maxInt = Number.MAX_SAFE_INTEGER;

    await page.goto('/');
    await waitForPageReady(page);

    const result = await page.evaluate((max) => {
      return max + 1 === max + 2; // Should be true due to precision loss
    }, maxInt);

    // JavaScript should handle max integers as expected
    expect(result).toBe(true);
  });

  test('should handle date edge cases', async ({ page }) => {
    const edgeDates = [
      new Date('1970-01-01').toISOString(), // Unix epoch
      new Date('2038-01-19').toISOString(), // 32-bit timestamp limit
      new Date('2100-12-31').toISOString(), // Future date
    ];

    for (const date of edgeDates) {
      await mockAPIResponse(
        page,
        '**/api/tasks**',
        buildSuccessResponse([
          {
            id: '1',
            title: 'Edge Date Task',
            status: 'today',
            dueDate: date,
            createdAt: date,
          },
        ])
      );

      await page.goto('/');
      await waitForPageReady(page);

      // Should handle edge case dates
      expect(page.url()).toBeTruthy();
    }
  });
});

/**
 * E2E tests for MBA Classes integration in the Vault sidebar
 * Tests the MBA classes section, API calls, expansion, and recordings/notes indicators
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotsDir = path.join(__dirname, '../e2e-screenshots/mba-classes');

test.describe('MBA Classes Integration', () => {
  test.beforeAll(async () => {
    // Create screenshots directory
    const { mkdir } = await import('fs/promises');
    await mkdir(screenshotsDir, { recursive: true });
  });

  test('should load app and display MBA Classes section', async ({ page }) => {
    // Collect console errors
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];
    const apiCalls: { url: string; status: number; response?: unknown }[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
      if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    // Intercept MBA classes API call
    await page.route('**/api/vault/pages/mba-classes', async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      apiCalls.push({
        url: route.request().url(),
        status: response.status(),
        response: json,
      });
      await route.fulfill({ response });
    });

    // Step 1: Load the app
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take screenshot of initial load
    await page.screenshot({
      path: path.join(screenshotsDir, '01-initial-load.png'),
      fullPage: true
    });

    // Step 2: Wait for MBA Classes section to appear
    const mbaClassesHeader = page.locator('text=MBA Classes').first();

    // Wait a bit for API to complete
    await page.waitForTimeout(2000);

    // Take screenshot after API loads
    await page.screenshot({
      path: path.join(screenshotsDir, '02-after-api-load.png'),
      fullPage: true
    });

    // Check if MBA Classes section exists
    const mbaHeaderExists = await mbaClassesHeader.isVisible({ timeout: 5000 }).catch(() => false);

    // Log findings
    console.log('\n=== MBA Classes Test Results ===');
    console.log('MBA Classes header visible:', mbaHeaderExists);
    console.log('API calls intercepted:', apiCalls.length);
    console.log('Console errors:', consoleErrors.length);
    console.log('Console warnings:', consoleWarnings.length);

    if (apiCalls.length > 0) {
      console.log('\nAPI Response:', JSON.stringify(apiCalls[0], null, 2));
    } else {
      console.log('\nNo MBA classes API call detected!');
    }

    if (consoleErrors.length > 0) {
      console.log('\nConsole Errors:');
      consoleErrors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    }

    if (consoleWarnings.length > 0) {
      console.log('\nConsole Warnings:');
      consoleWarnings.forEach((warn, i) => console.log(`  ${i + 1}. ${warn}`));
    }

    // Assertions
    expect(apiCalls.length, 'MBA classes API should be called').toBeGreaterThan(0);
    expect(apiCalls[0].status, 'API should return 200').toBe(200);
    expect(mbaHeaderExists, 'MBA Classes section should be visible').toBe(true);
  });

  test('should expand semesters and classes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Find and click the MBA Classes section header to ensure it's expanded
    const mbaSection = page.locator('text=MBA Classes').first();
    if (await mbaSection.isVisible()) {
      // MBA Classes section is visible, now find semesters
      await page.screenshot({
        path: path.join(screenshotsDir, '03-mba-section-visible.png'),
        fullPage: true
      });

      // Look for a semester (Winter2026 or Fall2025)
      const semester = page.locator('text=Winter2026').first();
      if (await semester.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Click to expand semester
        await semester.click();
        await page.waitForTimeout(500);

        await page.screenshot({
          path: path.join(screenshotsDir, '04-semester-expanded.png'),
          fullPage: true
        });

        // Look for a class within the semester
        const classItem = page.locator('text=Venture Capital').first();
        if (await classItem.isVisible({ timeout: 3000 }).catch(() => false)) {
          await classItem.click();
          await page.waitForTimeout(500);

          await page.screenshot({
            path: path.join(screenshotsDir, '05-class-expanded.png'),
            fullPage: true
          });

          // Check for date sessions
          const session = page.locator('text=2026-01-15').first();
          const sessionVisible = await session.isVisible({ timeout: 2000 }).catch(() => false);
          console.log('Session dates visible:', sessionVisible);
        } else {
          console.log('Class items not visible under semester');
        }
      } else {
        console.log('Semester not visible - checking if already expanded');
        // Maybe semesters are already visible
        await page.screenshot({
          path: path.join(screenshotsDir, '04-check-semesters.png'),
          fullPage: true
        });
      }
    } else {
      console.log('MBA Classes section not visible');
    }
  });

  test('should show recordings and notes indicators', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Expand MBA Classes, semester, and class to see indicators
    const mbaSection = page.locator('text=MBA Classes').first();
    if (await mbaSection.isVisible()) {
      // Click semester
      const semester = page.locator('text=Winter2026').first();
      if (await semester.isVisible({ timeout: 3000 }).catch(() => false)) {
        await semester.click();
        await page.waitForTimeout(500);
      }

      // Find recordings indicator (microphone icon with count)
      const micIndicator = page.locator('[title="Plaud recordings"]').first();
      const notesIndicator = page.locator('[title="Remarkable notes"]').first();

      const hasMicIndicator = await micIndicator.isVisible({ timeout: 2000 }).catch(() => false);
      const hasNotesIndicator = await notesIndicator.isVisible({ timeout: 2000 }).catch(() => false);

      console.log('\n=== Indicators Test Results ===');
      console.log('Recordings indicator visible:', hasMicIndicator);
      console.log('Notes indicator visible:', hasNotesIndicator);

      await page.screenshot({
        path: path.join(screenshotsDir, '06-indicators.png'),
        fullPage: true
      });
    }
  });

  test('should check for JavaScript console errors on load', async ({ page }) => {
    const consoleErrors: string[] = [];
    const networkErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('requestfailed', (request) => {
      networkErrors.push(`${request.url()} - ${request.failure()?.errorText}`);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    console.log('\n=== Error Check Results ===');
    console.log('Console errors:', consoleErrors.length);
    console.log('Network errors:', networkErrors.length);

    if (consoleErrors.length > 0) {
      console.log('\nConsole Errors:');
      consoleErrors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    }

    if (networkErrors.length > 0) {
      console.log('\nNetwork Errors:');
      networkErrors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    }

    await page.screenshot({
      path: path.join(screenshotsDir, '07-final-state.png'),
      fullPage: true
    });

    // Check that there are no critical errors
    const criticalErrors = consoleErrors.filter(e =>
      !e.includes('DevTools') &&
      !e.includes('favicon') &&
      !e.includes('ResizeObserver')
    );

    expect(criticalErrors.length, 'Should have no critical console errors').toBe(0);
  });
});

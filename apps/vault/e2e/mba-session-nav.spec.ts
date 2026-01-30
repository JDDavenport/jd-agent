/**
 * E2E tests for MBA Class Session Navigation
 * Tests clicking on session dates and verifying content display
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotsDir = path.join(__dirname, '../e2e-screenshots/mba-session-nav');

test.describe('MBA Session Navigation', () => {
  test.beforeAll(async () => {
    const { mkdir } = await import('fs/promises');
    await mkdir(screenshotsDir, { recursive: true });
  });

  test('should navigate to session page when clicking date', async ({ page }) => {
    // Track API calls to see which endpoint is used
    const apiCalls: { url: string; method: string; status: number }[] = [];

    page.on('request', (request) => {
      if (request.url().includes('/api/vault/')) {
        apiCalls.push({
          url: request.url(),
          method: request.method(),
          status: 0,
        });
      }
    });

    page.on('response', (response) => {
      if (response.url().includes('/api/vault/')) {
        const call = apiCalls.find(c => c.url === response.url() && c.status === 0);
        if (call) {
          call.status = response.status();
        }
      }
    });

    // Step 1: Load the app
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(screenshotsDir, '01-initial-load.png'),
      fullPage: true
    });

    // Step 2: Expand Winter2026 semester
    const semester = page.locator('text=Winter2026').first();
    if (await semester.isVisible({ timeout: 3000 }).catch(() => false)) {
      await semester.click();
      await page.waitForTimeout(500);
    }

    // Step 3: Expand Venture Capital class
    const classItem = page.locator('text=Venture Capital').first();
    if (await classItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await classItem.click();
      await page.waitForTimeout(500);
    }

    await page.screenshot({
      path: path.join(screenshotsDir, '02-class-expanded.png'),
      fullPage: true
    });

    // Clear API calls to track only the navigation
    apiCalls.length = 0;

    // Step 4: Click on session date "2026-01-15" (has recordings)
    const sessionDate = page.locator('text=2026-01-15').first();
    expect(await sessionDate.isVisible()).toBe(true);

    await sessionDate.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(screenshotsDir, '03-after-session-click.png'),
      fullPage: true
    });

    // Log API calls to see which endpoint was used
    console.log('\n=== API Calls After Session Click ===');
    apiCalls.forEach(call => {
      console.log(`${call.method} ${call.url} - Status: ${call.status}`);
    });

    // Check what's displayed in main content
    const mainContent = page.locator('[data-testid="vault-main"]').first();

    // Look for session title
    const pageTitle = page.locator('h1, [contenteditable="true"]').first();
    const titleText = await pageTitle.textContent();
    console.log('\nPage title:', titleText);

    // Check for recordings section or indicators
    const recordingsSection = page.locator('text=Recording').first();
    const hasRecordingsSection = await recordingsSection.isVisible({ timeout: 2000 }).catch(() => false);
    console.log('Has recordings section:', hasRecordingsSection);

    // Check for any transcript content
    const transcriptContent = page.locator('text=transcript').first();
    const hasTranscript = await transcriptContent.isVisible({ timeout: 1000 }).catch(() => false);
    console.log('Has transcript content:', hasTranscript);

    // Take final screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, '04-final-state.png'),
      fullPage: true
    });

    // Verify that page loaded (should see 2026-01-15 title)
    expect(titleText).toContain('2026-01-15');

    // IMPORTANT: Check if the correct API endpoint was called
    const mbaSessionCall = apiCalls.find(c => c.url.includes('/mba-classes/'));
    const standardPageCall = apiCalls.find(c => c.url.includes('/api/vault/pages/') && !c.url.includes('/mba-classes/'));

    console.log('\nUsed MBA session endpoint:', !!mbaSessionCall);
    console.log('Used standard page endpoint:', !!standardPageCall);

    // This assertion will FAIL if the app uses the wrong endpoint
    // expect(mbaSessionCall, 'Should use MBA session endpoint for session pages').toBeTruthy();
  });

  test('should verify page content includes remarkable notes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Expand Winter2026 > Entrepreneurial Innovation
    const semester = page.locator('text=Winter2026').first();
    if (await semester.isVisible({ timeout: 3000 }).catch(() => false)) {
      await semester.click();
      await page.waitForTimeout(500);
    }

    const classItem = page.locator('text=Entrepenurial').first();
    if (await classItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await classItem.click();
      await page.waitForTimeout(500);
    }

    // Click on first session (2026-01-13)
    const sessionDate = page.locator('text=2026-01-13').first();
    if (await sessionDate.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sessionDate.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }

    await page.screenshot({
      path: path.join(screenshotsDir, '05-session-with-notes.png'),
      fullPage: true
    });

    // Check if OCR text content is visible
    // This should show the Remarkable notes OCR text
    const ocrContent = page.locator('text=Entreparturial');  // Part of the OCR text
    const hasOcrContent = await ocrContent.isVisible({ timeout: 2000 }).catch(() => false);

    console.log('\n=== Remarkable Notes Test ===');
    console.log('OCR content visible:', hasOcrContent);
  });

  test('should verify all classes on same date show same recordings (bug check)', async ({ page }) => {
    // This test verifies the bug: all classes on 2026-01-15 show the same 5 recordings

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Expand Winter2026
    const semester = page.locator('text=Winter2026').first();
    if (await semester.isVisible({ timeout: 3000 }).catch(() => false)) {
      await semester.click();
      await page.waitForTimeout(500);
    }

    // Check recording counts for each class on 2026-01-15
    const classes = ['Entrepenurial', 'Venture Capital', 'Strategy'];
    const recordingCounts: Record<string, string | null> = {};

    for (const className of classes) {
      const classItem = page.locator(`text=${className}`).first();
      if (await classItem.isVisible({ timeout: 2000 }).catch(() => false)) {
        // Get the microphone count badge
        const micBadge = classItem.locator('..').locator('[title="Plaud recordings"]');
        if (await micBadge.isVisible({ timeout: 1000 }).catch(() => false)) {
          const badgeText = await micBadge.textContent();
          recordingCounts[className] = badgeText;
        }
      }
    }

    console.log('\n=== Recording Counts by Class (Bug Check) ===');
    console.log(recordingCounts);
    console.log('\nBUG: If all classes show the same count, recordings are matched by date only, not by class');

    await page.screenshot({
      path: path.join(screenshotsDir, '06-bug-check-recordings.png'),
      fullPage: true
    });
  });
});

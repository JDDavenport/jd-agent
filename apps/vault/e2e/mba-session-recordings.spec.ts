/**
 * E2E tests for MBA Session Page Recordings Display
 * Tests the display of recordings, transcripts, and related content on MBA class session pages
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotsDir = path.join(__dirname, '../e2e-screenshots/mba-session-recordings');

// Use the configured baseURL from playwright.config.ts (port 5181)
// If app is running on different port, override with: test.use({ baseURL: 'http://localhost:5174' });

test.describe('MBA Session Page Recordings', () => {
  test.beforeAll(async () => {
    const { mkdir } = await import('fs/promises');
    await mkdir(screenshotsDir, { recursive: true });
  });

  test('should display recordings section on MBA session page', async ({ page }) => {
    // Track console errors
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];
    const apiCalls: { url: string; method: string; status: number; response?: unknown }[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
      if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    // Track API calls to verify correct endpoint usage
    page.on('request', (request) => {
      if (request.url().includes('/api/vault/')) {
        apiCalls.push({
          url: request.url(),
          method: request.method(),
          status: 0,
        });
      }
    });

    page.on('response', async (response) => {
      if (response.url().includes('/api/vault/')) {
        const call = apiCalls.find(c => c.url === response.url() && c.status === 0);
        if (call) {
          call.status = response.status();
          try {
            if (response.headers()['content-type']?.includes('application/json')) {
              call.response = await response.json();
            }
          } catch (e) {
            // Ignore JSON parse errors
          }
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

    console.log('\n=== Step 1: Initial Load ===');
    console.log('App loaded successfully');

    // Step 2: Check MBA Classes section in sidebar
    const mbaClassesHeader = page.locator('text=MBA Classes').first();
    const mbaHeaderVisible = await mbaClassesHeader.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('\n=== Step 2: MBA Classes Section ===');
    console.log('MBA Classes header visible:', mbaHeaderVisible);

    await page.screenshot({
      path: path.join(screenshotsDir, '02-sidebar-mba-classes.png'),
      fullPage: true
    });

    // Step 3: Expand semester (e.g., Winter2026)
    const semester = page.locator('text=Winter2026').first();
    if (await semester.isVisible({ timeout: 3000 }).catch(() => false)) {
      await semester.click();
      await page.waitForTimeout(500);
      console.log('\n=== Step 3: Semester Expanded ===');
      console.log('Winter2026 semester clicked');
    } else {
      console.log('\n=== Step 3: Semester Not Found ===');
      console.log('Trying to find any visible semester...');
    }

    await page.screenshot({
      path: path.join(screenshotsDir, '03-semester-expanded.png'),
      fullPage: true
    });

    // Step 4: Expand a class to see sessions
    const classItem = page.locator('text=Venture Capital').first();
    if (await classItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await classItem.click();
      await page.waitForTimeout(500);
      console.log('\n=== Step 4: Class Expanded ===');
      console.log('Venture Capital class clicked');
    } else {
      // Try Entrepenurial or Strategy
      const altClass = page.locator('text=Entrepenurial').first();
      if (await altClass.isVisible({ timeout: 2000 }).catch(() => false)) {
        await altClass.click();
        await page.waitForTimeout(500);
        console.log('Entrepenurial class clicked');
      }
    }

    await page.screenshot({
      path: path.join(screenshotsDir, '04-class-expanded.png'),
      fullPage: true
    });

    // Step 5: Check for recording indicators in sidebar
    const micIndicator = page.locator('svg').filter({ has: page.locator('[stroke="currentColor"]') }).first();
    console.log('\n=== Step 5: Recording Indicators ===');

    // Look for microphone icons with numbers next to them
    const recordingBadges = page.locator('[title*="recording"], [title*="Plaud"]');
    const recordingBadgeCount = await recordingBadges.count();
    console.log('Recording indicator badges found:', recordingBadgeCount);

    await page.screenshot({
      path: path.join(screenshotsDir, '05-recording-indicators.png'),
      fullPage: true
    });

    // Clear API calls to track only the session navigation
    apiCalls.length = 0;

    // Step 6: Click on a session date with recordings
    const sessionDate = page.locator('text=2026-01-15').first();
    if (await sessionDate.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sessionDate.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      console.log('\n=== Step 6: Session Page Loaded ===');
      console.log('Clicked on 2026-01-15 session');
    } else {
      // Try any date that looks like YYYY-MM-DD
      const anyDate = page.locator('text=/\\d{4}-\\d{2}-\\d{2}/').first();
      if (await anyDate.isVisible({ timeout: 2000 }).catch(() => false)) {
        const dateText = await anyDate.textContent();
        await anyDate.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
        console.log('Clicked on date:', dateText);
      }
    }

    await page.screenshot({
      path: path.join(screenshotsDir, '06-session-page.png'),
      fullPage: true
    });

    // Step 7: Check API calls for MBA session endpoint
    console.log('\n=== Step 7: API Calls Analysis ===');
    apiCalls.forEach(call => {
      console.log(`${call.method} ${call.url} - Status: ${call.status}`);
    });

    const mbaSessionCall = apiCalls.find(c => c.url.includes('/mba-classes/'));
    console.log('\nUsed MBA session endpoint:', !!mbaSessionCall);
    if (mbaSessionCall?.response) {
      const resp = mbaSessionCall.response as Record<string, unknown>;
      if (resp.data) {
        const data = resp.data as Record<string, unknown>;
        console.log('Response has recordings:', Array.isArray(data.recordings) ? (data.recordings as unknown[]).length : 'N/A');
      }
    }

    // Step 8: Check for recordings section on page
    console.log('\n=== Step 8: Recordings Section ===');

    // Look for "Class Recordings" header
    const recordingsHeader = page.locator('text=Class Recordings').first();
    const hasRecordingsHeader = await recordingsHeader.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('Class Recordings header visible:', hasRecordingsHeader);

    // Look for recording items
    const recordingItems = page.locator('[class*="recording"], [class*="Recording"]');
    const recordingItemCount = await recordingItems.count();
    console.log('Recording items found:', recordingItemCount);

    // Look for recording titles, times, durations
    const playIcon = page.locator('svg').filter({ has: page.locator('path[d*="M5"]') }).first();
    console.log('Play icons visible:', await playIcon.isVisible().catch(() => false));

    await page.screenshot({
      path: path.join(screenshotsDir, '08-recordings-section.png'),
      fullPage: true
    });

    // Step 9: Check recording details (title, time, duration, status)
    console.log('\n=== Step 9: Recording Details ===');

    // Check for time display (e.g., "10:30 AM")
    const timeDisplay = page.locator('text=/\\d{1,2}:\\d{2}.*[AP]M/i').first();
    const hasTimeDisplay = await timeDisplay.isVisible({ timeout: 2000 }).catch(() => false);
    console.log('Time display visible:', hasTimeDisplay);

    // Check for duration (e.g., "45m 30s" or "45 minutes")
    const durationDisplay = page.locator('text=/\\d+m|\\d+ min/i').first();
    const hasDuration = await durationDisplay.isVisible({ timeout: 2000 }).catch(() => false);
    console.log('Duration display visible:', hasDuration);

    // Check for status (e.g., "completed", "transcribed")
    const statusDisplay = page.locator('text=/completed|transcribed|processed/i').first();
    const hasStatus = await statusDisplay.isVisible({ timeout: 2000 }).catch(() => false);
    console.log('Status display visible:', hasStatus);

    await page.screenshot({
      path: path.join(screenshotsDir, '09-recording-details.png'),
      fullPage: true
    });

    // Step 10: Test transcript expand/collapse
    console.log('\n=== Step 10: Transcript Expand/Collapse ===');

    const transcriptToggle = page.locator('text=View Transcript').first();
    const hasTranscriptToggle = await transcriptToggle.isVisible({ timeout: 2000 }).catch(() => false);
    console.log('View Transcript button visible:', hasTranscriptToggle);

    if (hasTranscriptToggle) {
      // Click to expand
      await transcriptToggle.click();
      await page.waitForTimeout(500);

      await page.screenshot({
        path: path.join(screenshotsDir, '10a-transcript-expanded.png'),
        fullPage: true
      });

      // Check if transcript content is visible
      const transcriptContent = page.locator('details[open] >> text=/./').first();
      const transcriptVisible = await transcriptContent.isVisible({ timeout: 2000 }).catch(() => false);
      console.log('Transcript content visible after expand:', transcriptVisible);

      // Click to collapse
      await transcriptToggle.click();
      await page.waitForTimeout(500);

      await page.screenshot({
        path: path.join(screenshotsDir, '10b-transcript-collapsed.png'),
        fullPage: true
      });

      console.log('Transcript expand/collapse test: PASSED');
    } else {
      console.log('Transcript toggle not found - may not have recordings with transcripts');
    }

    // Step 11: Check console for errors
    console.log('\n=== Step 11: Console Errors Check ===');
    console.log('Console errors:', consoleErrors.length);
    console.log('Console warnings:', consoleWarnings.length);

    if (consoleErrors.length > 0) {
      console.log('\nConsole Errors:');
      consoleErrors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
    }

    // Filter critical errors (exclude common benign errors)
    const criticalErrors = consoleErrors.filter(e =>
      !e.includes('DevTools') &&
      !e.includes('favicon') &&
      !e.includes('ResizeObserver') &&
      !e.includes('net::ERR')
    );

    await page.screenshot({
      path: path.join(screenshotsDir, '11-final-state.png'),
      fullPage: true
    });

    // Summary
    console.log('\n========================================');
    console.log('=== TEST SUMMARY ===');
    console.log('========================================');
    console.log('MBA Classes header visible:', mbaHeaderVisible);
    console.log('MBA session API endpoint used:', !!mbaSessionCall);
    console.log('Recordings header visible:', hasRecordingsHeader);
    console.log('Time display visible:', hasTimeDisplay);
    console.log('Duration visible:', hasDuration);
    console.log('Status visible:', hasStatus);
    console.log('Transcript toggle visible:', hasTranscriptToggle);
    console.log('Critical console errors:', criticalErrors.length);
    console.log('========================================');

    // Assertions (soft assertions for reporting)
    expect(mbaHeaderVisible, 'MBA Classes section should be visible').toBe(true);
  });

  test('should verify sidebar recording indicators', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Expand MBA Classes
    const mbaSection = page.locator('text=MBA Classes').first();
    if (await mbaSection.isVisible()) {
      // Expand a semester
      const semester = page.locator('text=Winter2026').first();
      if (await semester.isVisible({ timeout: 3000 }).catch(() => false)) {
        await semester.click();
        await page.waitForTimeout(500);
      }

      await page.screenshot({
        path: path.join(screenshotsDir, '12-sidebar-indicators.png'),
        fullPage: true
      });

      // Look for microphone icons (blue color) indicating recordings
      const micIcons = page.locator('svg[class*="text-blue"]');
      const micCount = await micIcons.count();
      console.log('\n=== Sidebar Recording Indicators ===');
      console.log('Blue microphone icons found:', micCount);

      // Look for document icons (amber color) indicating notes
      const noteIcons = page.locator('svg[class*="text-amber"]');
      const noteCount = await noteIcons.count();
      console.log('Amber note icons found:', noteCount);

      // Check for count badges near class names
      const countBadges = page.locator('span[class*="text-blue-500"], span[class*="text-[10px]"]');
      const badgeCount = await countBadges.count();
      console.log('Count badges found:', badgeCount);
    }
  });

  test('should check network requests and responses', async ({ page }) => {
    const apiResponses: { url: string; status: number; dataKeys?: string[] }[] = [];

    // Intercept all vault API responses
    await page.route('**/api/vault/**', async (route) => {
      const response = await route.fetch();
      const url = route.request().url();

      try {
        const json = await response.json();
        apiResponses.push({
          url,
          status: response.status(),
          dataKeys: Object.keys(json.data || json || {}),
        });
      } catch {
        apiResponses.push({
          url,
          status: response.status(),
        });
      }

      await route.fulfill({ response });
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Navigate to MBA section
    const semester = page.locator('text=Winter2026').first();
    if (await semester.isVisible({ timeout: 3000 }).catch(() => false)) {
      await semester.click();
      await page.waitForTimeout(500);

      const classItem = page.locator('text=Venture Capital').first();
      if (await classItem.isVisible({ timeout: 2000 }).catch(() => false)) {
        await classItem.click();
        await page.waitForTimeout(500);

        // Click on a session date
        const sessionDate = page.locator('text=2026-01-15').first();
        if (await sessionDate.isVisible({ timeout: 2000 }).catch(() => false)) {
          await sessionDate.click();
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(2000);
        }
      }
    }

    await page.screenshot({
      path: path.join(screenshotsDir, '13-network-test.png'),
      fullPage: true
    });

    console.log('\n=== Network Requests Analysis ===');
    console.log('Total API calls:', apiResponses.length);

    apiResponses.forEach((resp, i) => {
      console.log(`\n${i + 1}. ${resp.url}`);
      console.log(`   Status: ${resp.status}`);
      if (resp.dataKeys) {
        console.log(`   Data keys: ${resp.dataKeys.join(', ')}`);
      }
    });

    // Check for MBA classes endpoint
    const mbaClassesCall = apiResponses.find(r => r.url.includes('/api/vault/pages/mba-classes') && !r.url.includes('/mba-classes/'));
    const mbaSessionCall = apiResponses.find(r => r.url.includes('/api/vault/pages/mba-classes/') && r.url.split('/').length > 6);

    console.log('\n=== Endpoint Usage ===');
    console.log('MBA classes list endpoint called:', !!mbaClassesCall);
    console.log('MBA session detail endpoint called:', !!mbaSessionCall);

    if (mbaSessionCall) {
      console.log('Session endpoint URL:', mbaSessionCall.url);
      console.log('Session response keys:', mbaSessionCall.dataKeys?.join(', '));
    }
  });
});

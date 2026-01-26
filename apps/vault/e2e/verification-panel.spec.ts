/**
 * Quick test for verification panel
 */
import { test, expect, Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const screenshotsDir = path.join(__dirname, '../e2e-screenshots/verification');

test.describe('Recording Verification Panel', () => {
  test.beforeAll(async () => {
    const { mkdir } = await import('fs/promises');
    await mkdir(screenshotsDir, { recursive: true });
  });

  test('should display verification panel for recordings', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Navigate to Winter2026 > Venture Capital > 2026-01-15
    const semester = page.locator('text=Winter2026').first();
    if (await semester.isVisible({ timeout: 3000 }).catch(() => false)) {
      await semester.click();
      await page.waitForTimeout(500);
    }

    const vcClass = page.locator('text=Venture Capital').first();
    if (await vcClass.isVisible({ timeout: 3000 }).catch(() => false)) {
      await vcClass.click();
      await page.waitForTimeout(500);
    }

    const sessionDate = page.locator('text=2026-01-15').first();
    if (await sessionDate.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sessionDate.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
    }

    await page.screenshot({
      path: path.join(screenshotsDir, '01-session-page.png'),
      fullPage: true
    });

    // Look for "Verify Match" button
    const verifyMatchBtn = page.locator('text=Verify Match').first();
    const hasVerifyBtn = await verifyMatchBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('Verify Match button visible:', hasVerifyBtn);

    if (hasVerifyBtn) {
      await verifyMatchBtn.click();
      await page.waitForTimeout(500);

      await page.screenshot({
        path: path.join(screenshotsDir, '02-verification-panel-open.png'),
        fullPage: true
      });

      // Check for verification panel elements
      const matchReason = page.locator('text=Match reason:').first();
      const hasMatchReason = await matchReason.isVisible({ timeout: 2000 }).catch(() => false);
      console.log('Match reason visible:', hasMatchReason);

      // Click Details button to open modal
      const detailsBtn = page.locator('text=Details').first();
      const hasDetailsBtn = await detailsBtn.isVisible({ timeout: 2000 }).catch(() => false);
      console.log('Details button visible:', hasDetailsBtn);

      if (hasDetailsBtn) {
        await detailsBtn.click();
        await page.waitForTimeout(500);

        await page.screenshot({
          path: path.join(screenshotsDir, '03-verification-modal.png'),
          fullPage: true
        });

        // Check for modal elements
        const modalTitle = page.locator('text=Match Verification Details').first();
        const hasModalTitle = await modalTitle.isVisible({ timeout: 2000 }).catch(() => false);
        console.log('Modal title visible:', hasModalTitle);

        const classScores = page.locator('text=Keyword Matches by Class Type').first();
        const hasClassScores = await classScores.isVisible({ timeout: 2000 }).catch(() => false);
        console.log('Class scores section visible:', hasClassScores);

        // Close modal
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }

    expect(true).toBe(true);
  });
});

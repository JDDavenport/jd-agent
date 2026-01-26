/**
 * TS-7: Week Navigation Tests
 *
 * Tests:
 * 1. Click next week button
 * 2. Calendar shows next week dates
 * 3. Click previous week button
 * 4. Calendar returns to current week
 * 5. Previous button disabled when on current week
 *
 * PRD Requirements:
 * - FR-9.1: Display current week date range in header
 * - FR-9.2: Previous/Next week navigation buttons
 * - FR-9.3: Cannot navigate to past weeks (previous button disabled for current week)
 * - FR-9.4: Show week offset indicator when viewing future weeks
 */

import { test, expect } from '@playwright/test';
import {
  navigateToWeeklyPlanning,
  takeScreenshot,
} from './test-helpers';

test.describe('TS-7: Week Navigation', () => {

  test('FR-9.1: Display current week date range in header', async ({ page }) => {
    await navigateToWeeklyPlanning(page);

    // Find the date range header
    const dateHeader = page.locator('.bg-slate-800.border-b .text-sm.font-medium');
    const dateText = await dateHeader.textContent();
    console.log(`Date range: ${dateText}`);

    await takeScreenshot(page, 'navigation-01-date-range');

    // Verify date format (e.g., "Jan 26 - Feb 1, 2026")
    expect(dateText).toMatch(/\w{3}\s+\d{1,2}\s*-\s*\w{3}\s+\d{1,2},\s*\d{4}/);

    // Verify it contains the current year
    const currentYear = new Date().getFullYear();
    expect(dateText).toContain(currentYear.toString());
  });

  test('FR-9.2: Previous/Next week navigation buttons exist', async ({ page }) => {
    await navigateToWeeklyPlanning(page);

    // Find navigation buttons
    const navButtons = page.locator('.bg-slate-800.border-b button');
    const buttonCount = await navButtons.count();
    console.log(`Navigation buttons found: ${buttonCount}`);

    // Should have at least 2 buttons (prev and next)
    expect(buttonCount).toBeGreaterThanOrEqual(2);

    // Check for prev button (left chevron)
    const prevButton = navButtons.filter({ has: page.locator('svg path[d*="M15"]') }).first();
    await expect(prevButton).toBeVisible();

    // Check for next button (right chevron)
    const nextButton = navButtons.filter({ has: page.locator('svg path[d*="M9"]') }).first();
    await expect(nextButton).toBeVisible();

    await takeScreenshot(page, 'navigation-02-buttons');
  });

  test('FR-9.2: Click next week button shows next week dates', async ({ page }) => {
    await navigateToWeeklyPlanning(page);

    // Get initial date range
    const dateHeader = page.locator('.bg-slate-800.border-b .text-sm.font-medium');
    const initialDateText = await dateHeader.textContent();
    console.log(`Initial date range: ${initialDateText}`);

    // Click next button
    const nextButton = page.locator('.bg-slate-800.border-b button').filter({ has: page.locator('svg path[d*="M9"]') }).first();
    await nextButton.click();
    await page.waitForTimeout(500);

    // Get new date range
    const newDateText = await dateHeader.textContent();
    console.log(`After next: ${newDateText}`);

    await takeScreenshot(page, 'navigation-03-next-week');

    // Dates should have changed
    expect(newDateText).not.toBe(initialDateText);
  });

  test('FR-9.2: Click previous week button after next returns to original', async ({ page }) => {
    await navigateToWeeklyPlanning(page);

    // Get initial date range
    const dateHeader = page.locator('.bg-slate-800.border-b .text-sm.font-medium');
    const initialDateText = await dateHeader.textContent();
    console.log(`Initial: ${initialDateText}`);

    // Click next
    const nextButton = page.locator('.bg-slate-800.border-b button').filter({ has: page.locator('svg path[d*="M9"]') }).first();
    await nextButton.click();
    await page.waitForTimeout(500);

    const afterNextText = await dateHeader.textContent();
    console.log(`After next: ${afterNextText}`);

    // Click previous
    const prevButton = page.locator('.bg-slate-800.border-b button').filter({ has: page.locator('svg path[d*="M15"]') }).first();
    await prevButton.click();
    await page.waitForTimeout(500);

    const afterPrevText = await dateHeader.textContent();
    console.log(`After prev: ${afterPrevText}`);

    await takeScreenshot(page, 'navigation-04-back-to-original');

    // Should be back to initial date range
    expect(afterPrevText).toBe(initialDateText);
  });

  test('FR-9.3: Previous button disabled when on current week', async ({ page }) => {
    await navigateToWeeklyPlanning(page);

    // Find previous button
    const prevButton = page.locator('.bg-slate-800.border-b button').filter({ has: page.locator('svg path[d*="M15"]') }).first();

    // Check if disabled
    const isDisabled = await prevButton.isDisabled();
    console.log(`Prev button disabled on current week: ${isDisabled}`);

    await takeScreenshot(page, 'navigation-05-prev-disabled');

    expect(isDisabled).toBe(true);

    // Also check for disabled styling (opacity-30 or cursor-not-allowed)
    const classes = await prevButton.getAttribute('class');
    console.log(`Prev button classes: ${classes}`);
    expect(classes).toMatch(/opacity-30|disabled|cursor-not-allowed/);
  });

  test('FR-9.3: Previous button enabled after navigating to future week', async ({ page }) => {
    await navigateToWeeklyPlanning(page);

    // Click next to go to future week
    const nextButton = page.locator('.bg-slate-800.border-b button').filter({ has: page.locator('svg path[d*="M9"]') }).first();
    await nextButton.click();
    await page.waitForTimeout(500);

    // Find previous button
    const prevButton = page.locator('.bg-slate-800.border-b button').filter({ has: page.locator('svg path[d*="M15"]') }).first();

    // Check if enabled
    const isDisabled = await prevButton.isDisabled();
    console.log(`Prev button disabled after next: ${isDisabled}`);

    await takeScreenshot(page, 'navigation-06-prev-enabled');

    expect(isDisabled).toBe(false);
  });

  test('FR-9.4: Show week offset indicator when viewing future weeks', async ({ page }) => {
    await navigateToWeeklyPlanning(page);

    // Get initial date range (should not have offset)
    const dateHeader = page.locator('.bg-slate-800.border-b .text-sm.font-medium');
    const initialText = await dateHeader.textContent();
    console.log(`Initial: ${initialText}`);

    // Should not have offset indicator initially
    expect(initialText).not.toContain('+1 week');

    // Click next
    const nextButton = page.locator('.bg-slate-800.border-b button').filter({ has: page.locator('svg path[d*="M9"]') }).first();
    await nextButton.click();
    await page.waitForTimeout(500);

    const afterNextText = await dateHeader.textContent();
    console.log(`After next: ${afterNextText}`);

    await takeScreenshot(page, 'navigation-07-week-offset');

    // Should show "+1 week" indicator
    expect(afterNextText).toContain('+1 week');

    // Click next again
    await nextButton.click();
    await page.waitForTimeout(500);

    const afterTwiceText = await dateHeader.textContent();
    console.log(`After 2x next: ${afterTwiceText}`);

    // Should show "+2 weeks" indicator
    expect(afterTwiceText).toContain('+2 weeks');
  });

  test('Day columns update when navigating', async ({ page }) => {
    await navigateToWeeklyPlanning(page);

    // Get initial day numbers
    const dayNumbers = page.locator('.text-lg.font-bold');
    const initialDays: string[] = [];
    for (let i = 0; i < 7; i++) {
      const dayText = await dayNumbers.nth(i).textContent();
      initialDays.push(dayText || '');
    }
    console.log(`Initial days: ${initialDays.join(', ')}`);

    // Click next
    const nextButton = page.locator('.bg-slate-800.border-b button').filter({ has: page.locator('svg path[d*="M9"]') }).first();
    await nextButton.click();
    await page.waitForTimeout(500);

    // Get new day numbers
    const newDays: string[] = [];
    for (let i = 0; i < 7; i++) {
      const dayText = await dayNumbers.nth(i).textContent();
      newDays.push(dayText || '');
    }
    console.log(`After next: ${newDays.join(', ')}`);

    await takeScreenshot(page, 'navigation-08-days-updated');

    // Days should be different (7 days later)
    expect(newDays).not.toEqual(initialDays);

    // First day should be 7 days after initial first day
    const initialFirst = parseInt(initialDays[0], 10);
    const newFirst = parseInt(newDays[0], 10);
    // Account for month rollover - the difference should be 7 or -23/-24 (if month changes)
    const diff = newFirst - initialFirst;
    expect(diff === 7 || diff < -20).toBe(true);
  });
});

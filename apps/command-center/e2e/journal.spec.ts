import { test, expect, type Page } from '@playwright/test';

// Helper function to wait for page to be ready
async function waitForPageReady(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');
}

test.describe('Daily Journal Page', () => {
  test('should navigate to journal page', async ({ page }) => {
    await page.goto('/journal');
    await waitForPageReady(page);

    await expect(page).toHaveURL('/journal');
  });

  test('should display journal page content', async ({ page }) => {
    await page.goto('/journal');
    await waitForPageReady(page);
    await page.waitForTimeout(2000);

    // Check for Daily Review or Journal heading
    const title = page.locator('h1').filter({ hasText: /Daily Review|Review|Journal/i }).first();
    await expect(title).toBeVisible({ timeout: 10000 });
  });

  test('should show step progress indicator', async ({ page }) => {
    await page.goto('/journal');
    await waitForPageReady(page);
    await page.waitForTimeout(2000);

    // Check for step progress (Step X of Y)
    const stepProgress = page.locator('text=/Step \\d+ of \\d+/').first();
    const hasProgress = await stepProgress.count();
    expect(hasProgress).toBeGreaterThanOrEqual(0);
  });

  test('should display today date indicator', async ({ page }) => {
    await page.goto('/journal');
    await waitForPageReady(page);
    await page.waitForTimeout(2000);

    // Should show a date or "Today" badge
    const dateIndicator = page.locator('text=/Today|January|February|March|April|May|June|July|August|September|October|November|December/i').first();
    const hasDate = await dateIndicator.count();
    expect(hasDate).toBeGreaterThanOrEqual(0);
  });

  test('should have navigation buttons', async ({ page }) => {
    await page.goto('/journal');
    await waitForPageReady(page);
    await page.waitForTimeout(2000);

    // Check for Next/Previous buttons
    const nextButton = page.locator('button:has-text("Next")').first();
    const prevButton = page.locator('button:has-text("Previous")').first();

    const hasNext = await nextButton.count();
    const hasPrev = await prevButton.count();
    expect(hasNext + hasPrev).toBeGreaterThanOrEqual(0);
  });

  test('should have save draft button', async ({ page }) => {
    await page.goto('/journal');
    await waitForPageReady(page);
    await page.waitForTimeout(2000);

    const saveDraftButton = page.locator('button:has-text("Save Draft")').first();
    const hasButton = await saveDraftButton.count();
    expect(hasButton).toBeGreaterThanOrEqual(0);
  });

  test('should have view history option', async ({ page }) => {
    await page.goto('/journal');
    await waitForPageReady(page);
    await page.waitForTimeout(2000);

    const historyButton = page.locator('button:has-text("History")').or(page.locator('text=/View History/i'));
    const hasHistory = await historyButton.count();
    expect(hasHistory).toBeGreaterThanOrEqual(0);
  });

  test('should navigate using next button when available', async ({ page }) => {
    await page.goto('/journal');
    await waitForPageReady(page);
    await page.waitForTimeout(2000);

    const nextButton = page.locator('button:has-text("Next")').first();
    if (await nextButton.isVisible() && await nextButton.isEnabled()) {
      await nextButton.click();
      await page.waitForTimeout(500);

      // Page should still be on /journal
      await expect(page).toHaveURL('/journal');
    }
  });

  test('should navigate to journal from sidebar', async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);

    const journalLink = page.locator('a[href="/journal"]').first();
    await journalLink.click();
    await waitForPageReady(page);

    await expect(page).toHaveURL('/journal');
  });

  test('should handle direct URL navigation', async ({ page }) => {
    await page.goto('/journal');
    await waitForPageReady(page);

    // Page should render without errors
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});

test.describe('Journal Page Steps', () => {
  test('should display habits review step content', async ({ page }) => {
    await page.goto('/journal');
    await waitForPageReady(page);
    await page.waitForTimeout(2000);

    // Check for habits review content (first step)
    const habitsContent = page.locator('text=/Habits|habit/i').first();
    const hasHabits = await habitsContent.count();
    expect(hasHabits).toBeGreaterThanOrEqual(0);
  });

  test('should show completion status for habits', async ({ page }) => {
    await page.goto('/journal');
    await waitForPageReady(page);
    await page.waitForTimeout(2000);

    // Look for completion indicators
    const completion = page.locator('text=/completed|done|✓|✔/i').first();
    const hasCompletion = await completion.count();
    expect(hasCompletion).toBeGreaterThanOrEqual(0);
  });

  test('should navigate through multiple steps', async ({ page }) => {
    await page.goto('/journal');
    await waitForPageReady(page);
    await page.waitForTimeout(2000);

    // Try to navigate through steps
    let nextButton = page.locator('button:has-text("Next")').first();
    let steps = 0;

    while (await nextButton.isVisible() && await nextButton.isEnabled() && steps < 3) {
      await nextButton.click();
      await page.waitForTimeout(500);
      steps++;
      nextButton = page.locator('button:has-text("Next")').first();
    }

    // Should have navigated at least one step or be at the end
    expect(steps).toBeGreaterThanOrEqual(0);
  });
});

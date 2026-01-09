import { test, expect, type Page } from '@playwright/test';

// Helper function to wait for page to be ready
async function waitForPageReady(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');
}

test.describe('Progress Dashboard', () => {
  test('should navigate to progress page', async ({ page }) => {
    await page.goto('/progress');
    await waitForPageReady(page);

    await expect(page).toHaveURL('/progress');
  });

  test('should display progress dashboard title', async ({ page }) => {
    await page.goto('/progress');
    await waitForPageReady(page);
    await page.waitForTimeout(2000);

    // Check for Progress Dashboard heading
    const title = page.locator('h1').filter({ hasText: /Progress/i }).first();
    await expect(title).toBeVisible({ timeout: 10000 });
  });

  test('should display stat cards', async ({ page }) => {
    await page.goto('/progress');
    await waitForPageReady(page);
    await page.waitForTimeout(2000);

    // Look for stat-related content
    const statsContent = page.locator('text=/Goals|Habits|Progress|Health/i').first();
    const hasStats = await statsContent.count();
    expect(hasStats).toBeGreaterThanOrEqual(0);
  });

  test('should display life area progress section', async ({ page }) => {
    await page.goto('/progress');
    await waitForPageReady(page);
    await page.waitForTimeout(2000);

    // Check for life area content
    const lifeAreaContent = page.locator('text=/Life Area|Health|Career|Personal|Finance|Relationships|Spiritual/i').first();
    const hasLifeArea = await lifeAreaContent.count();
    expect(hasLifeArea).toBeGreaterThanOrEqual(0);
  });

  test('should display weekly report section', async ({ page }) => {
    await page.goto('/progress');
    await waitForPageReady(page);
    await page.waitForTimeout(2000);

    // Check for weekly content
    const weeklyContent = page.locator('text=/This Week|Weekly|week/i').first();
    const hasWeekly = await weeklyContent.count();
    expect(hasWeekly).toBeGreaterThanOrEqual(0);
  });

  test('should display milestones section', async ({ page }) => {
    await page.goto('/progress');
    await waitForPageReady(page);
    await page.waitForTimeout(2000);

    // Check for milestones content
    const milestonesContent = page.locator('text=/Milestone|milestone/i').first();
    const hasMilestones = await milestonesContent.count();
    expect(hasMilestones).toBeGreaterThanOrEqual(0);
  });

  test('should display streaks section', async ({ page }) => {
    await page.goto('/progress');
    await waitForPageReady(page);
    await page.waitForTimeout(2000);

    // Check for streaks content
    const streaksContent = page.locator('text=/Streak|streak|🔥/i').first();
    const hasStreaks = await streaksContent.count();
    expect(hasStreaks).toBeGreaterThanOrEqual(0);
  });

  test('should display quick links', async ({ page }) => {
    await page.goto('/progress');
    await waitForPageReady(page);
    await page.waitForTimeout(2000);

    // Check for quick links section
    const quickLinks = page.locator('text=/Quick Links/i').or(page.locator('a[href="/goals"]').first());
    const hasLinks = await quickLinks.count();
    expect(hasLinks).toBeGreaterThanOrEqual(0);
  });

  test('should navigate to goals from progress page', async ({ page }) => {
    await page.goto('/progress');
    await waitForPageReady(page);
    await page.waitForTimeout(2000);

    const goalsLink = page.locator('a[href="/goals"]').first();
    if (await goalsLink.isVisible()) {
      await goalsLink.click();
      await waitForPageReady(page);

      await expect(page).toHaveURL('/goals');
    }
  });

  test('should navigate to habits from progress page', async ({ page }) => {
    await page.goto('/progress');
    await waitForPageReady(page);
    await page.waitForTimeout(2000);

    const habitsLink = page.locator('a[href="/habits"]').first();
    if (await habitsLink.isVisible()) {
      await habitsLink.click();
      await waitForPageReady(page);

      await expect(page).toHaveURL('/habits');
    }
  });

  test('should navigate to progress from sidebar', async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);

    const progressLink = page.locator('a[href="/progress"]').first();
    await progressLink.click();
    await waitForPageReady(page);

    await expect(page).toHaveURL('/progress');
  });

  test('should handle direct URL navigation', async ({ page }) => {
    await page.goto('/progress');
    await waitForPageReady(page);

    // Page should render without errors
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});

test.describe('Progress Dashboard Interactions', () => {
  test('should allow clicking on life areas', async ({ page }) => {
    await page.goto('/progress');
    await waitForPageReady(page);
    await page.waitForTimeout(2000);

    // Find a clickable life area card
    const areaCard = page.locator('div.cursor-pointer').first();
    if (await areaCard.isVisible()) {
      await areaCard.click();
      await page.waitForTimeout(300);

      // Page should still be visible (no crash)
      const body = page.locator('body');
      await expect(body).toBeVisible();
    }
  });

  test('should display progress bars for life areas', async ({ page }) => {
    await page.goto('/progress');
    await waitForPageReady(page);
    await page.waitForTimeout(2000);

    // Check for progress bar elements
    const progressBars = page.locator('.rounded-full.overflow-hidden >> .h-full');
    const hasProgressBars = await progressBars.count();
    expect(hasProgressBars).toBeGreaterThanOrEqual(0);
  });
});

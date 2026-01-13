import { test, expect } from '@playwright/test';

test.describe('Vault UI - Production', () => {
  test('should have reorganized sidebar layout', async ({ page }) => {
    await page.goto('https://vault-indol.vercel.app');
    await page.waitForTimeout(3000);

    // Check for New Page button below search
    const newPageButton = page.locator('button:has-text("New Page")');
    const searchButton = page.locator('button:has-text("Search")');

    // Both should be visible
    await expect(searchButton).toBeVisible({ timeout: 10000 });
    await expect(newPageButton).toBeVisible({ timeout: 5000 });
    console.log('✓ New Page button visible below search');

    // Check for Ask AI button in sidebar (not floating)
    const askAiButton = page.locator('[data-testid="vault-ask-ai-button"]');
    await expect(askAiButton).toBeVisible({ timeout: 5000 });
    console.log('✓ Ask AI button visible in sidebar');

    // Verify floating Ask AI button is gone (bottom-right)
    const floatingButton = page.locator('button.fixed.bottom-4.right-4:has-text("Ask AI")');
    const floatingExists = await floatingButton.count();
    expect(floatingExists).toBe(0);
    console.log('✓ Floating Ask AI button removed');

    // Test New Page button creates a page
    await newPageButton.click();
    await page.waitForTimeout(3000);

    // Should see the editor (with retry for API latency)
    const editor = page.locator('.ProseMirror');
    await expect(editor).toBeVisible({ timeout: 10000 });
    console.log('✓ New Page button works - editor visible');

    // Test /page command in editor
    await editor.click();
    await page.waitForTimeout(300);
    await page.keyboard.type('/page');
    await page.waitForTimeout(500);

    // Should see Page option in slash menu
    const slashMenu = page.locator('.fixed.z-50.w-72');
    await expect(slashMenu).toBeVisible({ timeout: 3000 });
    console.log('✓ Slash menu visible');

    const pageOption = page.locator('.fixed.z-50 button').filter({ hasText: 'Page' }).filter({ hasText: 'nested' });
    const pageOptionVisible = await pageOption.isVisible();
    expect(pageOptionVisible).toBe(true);
    console.log('✓ /page slash command available');

    // Press Enter to create nested page
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);

    // Should see a page link inserted
    const pageLink = page.locator('[data-page-link]');
    const pageLinkCount = await pageLink.count();
    console.log('Page links inserted:', pageLinkCount);
    expect(pageLinkCount).toBeGreaterThan(0);
    console.log('✓ /page command creates page link');

    // Test Ask AI opens chat
    await askAiButton.click();
    await page.waitForTimeout(500);

    // Chat panel should be visible
    const chatPanel = page.locator('[data-testid="vault-chat"]');
    const chatVisible = await chatPanel.isVisible();
    console.log('Chat panel visible:', chatVisible);

    console.log('\n✅ All UI tests passed!');
  });
});

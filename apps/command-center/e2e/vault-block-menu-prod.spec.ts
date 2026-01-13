import { test, expect } from '@playwright/test';

test.describe('Block Menu - Production', () => {
  test('should show block menu on hover and click', async ({ page }) => {
    // Go to production vault
    await page.goto('https://vault-indol.vercel.app');

    // Wait for the app to load
    await page.waitForTimeout(3000);

    // Check if we can see the app loaded
    const pageLoaded = await page.locator('.ProseMirror, [class*="sidebar"], button:has-text("New")').first().isVisible();

    if (!pageLoaded) {
      await page.screenshot({ path: 'vault-prod-load.png' });
      console.log('Page may not have loaded correctly - screenshot saved');
    }

    // Look for an existing page in sidebar or create new
    const newPageButton = page.locator('button:has-text("New Entry"), button:has-text("New"), [title*="New"]').first();
    if (await newPageButton.isVisible({ timeout: 5000 })) {
      await newPageButton.click();
      await page.waitForTimeout(2000);
    }

    // Find the editor
    const editor = page.locator('.ProseMirror');

    // Wait for editor with longer timeout for production
    try {
      await expect(editor).toBeVisible({ timeout: 10000 });
    } catch {
      await page.screenshot({ path: 'vault-prod-no-editor.png' });
      console.log('Editor not visible - screenshot saved');
      throw new Error('Editor not visible in production');
    }

    // Click in editor and type some content
    await editor.click();
    await page.keyboard.type('Test paragraph for block menu in production');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second paragraph');

    // Wait for content to be rendered
    await page.waitForTimeout(1000);

    // Find a paragraph block
    const paragraph = editor.locator('p').first();
    await expect(paragraph).toBeVisible();

    // Hover OVER the paragraph text to trigger mouseover event
    await paragraph.hover();
    await page.waitForTimeout(500);

    // Look for the block menu handle (the ⠿ button)
    const handle = page.locator('button:has-text("⠿")');

    // Check if handle is visible
    const handleVisible = await handle.isVisible();
    console.log('Handle visible in production:', handleVisible);

    if (handleVisible) {
      // Click the handle to open menu
      await handle.click();
      await page.waitForTimeout(300);

      // Check for menu items
      const deleteButton = page.locator('button:has-text("Delete")');
      const duplicateButton = page.locator('button:has-text("Duplicate")');
      const turnIntoButton = page.locator('button:has-text("Turn into")');

      await expect(deleteButton).toBeVisible({ timeout: 2000 });
      await expect(duplicateButton).toBeVisible();
      await expect(turnIntoButton).toBeVisible();

      console.log('✓ Block menu opened successfully in production');

      // Test duplicate action
      await duplicateButton.click();
      await page.waitForTimeout(500);

      const paragraphCount = await editor.locator('p').count();
      console.log('Paragraph count after duplicate:', paragraphCount);
      expect(paragraphCount).toBeGreaterThanOrEqual(3);

      console.log('✓ Duplicate action works in production');
      console.log('\n✅ Production block menu tests passed!');
    } else {
      // Take screenshot for debugging
      await page.screenshot({ path: 'vault-prod-no-handle.png' });
      console.log('Handle not visible in production - screenshot saved');
      console.log('This likely means the latest code has not been deployed to production yet.');
      throw new Error('Block menu handle not visible - deploy may be needed');
    }
  });
});

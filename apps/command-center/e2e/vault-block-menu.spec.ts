import { test, expect } from '@playwright/test';

test.describe('Block Menu', () => {
  test('should show block menu on hover and click', async ({ page }) => {
    // Go to vault
    await page.goto('http://localhost:5181');

    // Wait for the app to load
    await page.waitForTimeout(2000);

    // Look for an existing page in sidebar or create new
    const newPageButton = page.locator('button:has-text("New"), [title*="New"]').first();
    if (await newPageButton.isVisible()) {
      await newPageButton.click();
      await page.waitForTimeout(1000);
    }

    // Find the editor
    const editor = page.locator('.ProseMirror');
    await expect(editor).toBeVisible({ timeout: 5000 });

    // Click in editor and type some content
    await editor.click();
    await page.keyboard.type('Test paragraph for block menu');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second paragraph');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Third paragraph');

    // Wait for content to be rendered
    await page.waitForTimeout(500);

    // Find a paragraph block
    const paragraph = editor.locator('p').first();
    await expect(paragraph).toBeVisible();

    // Get paragraph position
    const box = await paragraph.boundingBox();
    if (!box) throw new Error('Could not get paragraph bounding box');

    // Hover OVER the paragraph text (not to the left) to trigger mouseover event
    await paragraph.hover();
    await page.waitForTimeout(500);

    // Look for the block menu handle (the ⠿ button)
    const handle = page.locator('button:has-text("⠿")');

    // Check if handle is visible
    const handleVisible = await handle.isVisible();
    console.log('Handle visible:', handleVisible);

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

      console.log('✓ Block menu opened successfully with all actions');

      // Test duplicate action
      await duplicateButton.click();
      await page.waitForTimeout(500);

      // Should now have more paragraphs
      const paragraphCount = await editor.locator('p').count();
      console.log('Paragraph count after duplicate:', paragraphCount);
      expect(paragraphCount).toBeGreaterThanOrEqual(4);

      console.log('✓ Duplicate action works');

      // Hover again to test Turn Into
      await paragraph.hover();
      await page.waitForTimeout(500);

      if (await handle.isVisible()) {
        await handle.click();
        await page.waitForTimeout(300);

        // Click Turn into
        const turnInto = page.locator('button:has-text("Turn into")');
        await turnInto.click();
        await page.waitForTimeout(300);

        // Should see submenu with block types
        const heading1 = page.locator('button:has-text("Heading 1")');
        await expect(heading1).toBeVisible({ timeout: 2000 });
        console.log('✓ Turn into submenu works');

        // Convert to heading
        await heading1.click();
        await page.waitForTimeout(500);

        // Check if there's now a heading
        const headingCount = await editor.locator('h1').count();
        console.log('H1 count after turn into:', headingCount);
        expect(headingCount).toBeGreaterThanOrEqual(1);

        console.log('✓ Turn into Heading 1 works');
      }

      // Test delete
      const h1 = editor.locator('h1').first();
      const h1CountBefore = await editor.locator('h1').count();
      if (await h1.isVisible()) {
        await h1.hover();
        await page.waitForTimeout(500);

        if (await handle.isVisible()) {
          await handle.click();
          await page.waitForTimeout(300);

          const deleteBtn = page.locator('button:has-text("Delete")');
          await deleteBtn.click();
          await page.waitForTimeout(500);

          const newHeadingCount = await editor.locator('h1').count();
          console.log('H1 count after delete:', newHeadingCount);
          expect(newHeadingCount).toBeLessThan(h1CountBefore);

          console.log('✓ Delete action works');
        }
      }

      console.log('\n✅ All block menu tests passed!');
    } else {
      // Take screenshot for debugging
      await page.screenshot({ path: 'block-menu-debug.png' });
      console.log('Handle not visible - screenshot saved to block-menu-debug.png');
      throw new Error('Block menu handle not visible on hover');
    }
  });
});

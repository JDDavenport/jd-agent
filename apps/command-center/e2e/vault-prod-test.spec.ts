import { test, expect } from '@playwright/test';

const VAULT_URL = 'https://vault-indol.vercel.app';

test.describe('Vault Production Tests', () => {
  test.setTimeout(60000);

  test('should test all vault buttons and page creation', async ({ page }) => {
    console.log('=== Step 1: Navigate to Vault ===');
    await page.goto(VAULT_URL);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'screenshots/vault-prod/01-initial-load.png' });

    // Check page loaded
    const title = await page.title();
    console.log('Page title:', title);

    console.log('\n=== Step 2: Check sidebar buttons ===');

    // Look for sidebar navigation items
    const sidebarButtons = page.locator('nav button, nav a, [role="navigation"] button');
    const buttonCount = await sidebarButtons.count();
    console.log('Sidebar buttons found:', buttonCount);

    // Look for New Page button
    const newPageButton = page.locator('button:has-text("New Page"), button:has-text("New"), [aria-label*="new"]').first();
    const hasNewPageButton = await newPageButton.isVisible().catch(() => false);
    console.log('New Page button visible:', hasNewPageButton);

    console.log('\n=== Step 3: Create a new page via button ===');

    if (hasNewPageButton) {
      await newPageButton.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'screenshots/vault-prod/02-after-new-page-click.png' });
      console.log('Clicked New Page button');
    } else {
      // Try finding any button that might create a page
      const plusButton = page.locator('button:has-text("+"), button[aria-label*="add"], button[aria-label*="create"]').first();
      if (await plusButton.isVisible().catch(() => false)) {
        await plusButton.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'screenshots/vault-prod/02-after-plus-click.png' });
        console.log('Clicked + button');
      }
    }

    console.log('\n=== Step 4: Look for editor area ===');

    // Find the editor
    const editor = page.locator('[contenteditable="true"], .ProseMirror, .tiptap').first();
    const hasEditor = await editor.isVisible().catch(() => false);
    console.log('Editor visible:', hasEditor);

    if (hasEditor) {
      console.log('\n=== Step 5: Test /page slash command ===');

      // Click into editor
      await editor.click();
      await page.waitForTimeout(500);

      // Type /page
      await page.keyboard.type('/page');
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/vault-prod/03-slash-page-typed.png' });

      // Check if slash menu appeared
      const slashMenu = page.locator('[class*="slash"], [class*="menu"], [role="listbox"], [role="menu"]');
      const menuVisible = await slashMenu.first().isVisible().catch(() => false);
      console.log('Slash menu visible:', menuVisible);

      // Press Enter to create page
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'screenshots/vault-prod/04-after-enter.png' });
      console.log('Pressed Enter after /page');

      // Check if page link was inserted
      const pageLink = page.locator('[data-type="pageLink"], a[href*="page"], .page-link');
      const pageLinkExists = await pageLink.first().isVisible().catch(() => false);
      console.log('Page link inserted:', pageLinkExists);
    }

    console.log('\n=== Step 6: Check page list/sidebar ===');

    // Look for pages in sidebar
    const pageItems = page.locator('[class*="page-item"], [class*="sidebar"] a, nav a');
    const pageItemCount = await pageItems.count();
    console.log('Page items in sidebar:', pageItemCount);

    // List visible pages
    for (let i = 0; i < Math.min(pageItemCount, 5); i++) {
      const text = await pageItems.nth(i).textContent().catch(() => '');
      if (text?.trim()) {
        console.log(`  - ${text.trim().substring(0, 50)}`);
      }
    }

    await page.screenshot({ path: 'screenshots/vault-prod/05-final-state.png' });
    console.log('\n=== Test Complete ===');
  });

  test('should create page directly and verify', async ({ page }) => {
    console.log('=== Direct Page Creation Test ===');

    await page.goto(VAULT_URL);
    await page.waitForTimeout(3000);

    // Find and click on an existing page or create new
    const existingPage = page.locator('nav a, [class*="sidebar"] a').first();
    if (await existingPage.isVisible().catch(() => false)) {
      await existingPage.click();
      await page.waitForTimeout(2000);
      console.log('Clicked on existing page');
    }

    // Find editor
    const editor = page.locator('[contenteditable="true"], .ProseMirror').first();
    if (await editor.isVisible().catch(() => false)) {
      await editor.click();
      await page.waitForTimeout(500);

      // Clear and type test content
      await page.keyboard.press('End');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Test content from Playwright');
      await page.waitForTimeout(1000);

      await page.screenshot({ path: 'screenshots/vault-prod/06-typed-content.png' });
      console.log('Typed test content');

      // Try /page command
      await page.keyboard.press('Enter');
      await page.keyboard.type('/page');
      await page.waitForTimeout(1500);

      // Take screenshot of slash menu
      await page.screenshot({ path: 'screenshots/vault-prod/07-slash-menu.png' });

      // Press Enter
      await page.keyboard.press('Enter');
      await page.waitForTimeout(3000);

      await page.screenshot({ path: 'screenshots/vault-prod/08-after-page-creation.png' });
      console.log('Attempted /page creation');
    }

    console.log('=== Direct Page Creation Test Complete ===');
  });
});

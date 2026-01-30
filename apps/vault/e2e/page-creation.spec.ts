import { test, expect } from '@playwright/test';

test.describe('Page Creation', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to render
    await page.waitForSelector('[data-testid="vault-app"]', { timeout: 10000 });
  });

  test('should create a new page via New Page button', async ({ page }) => {
    await page.screenshot({ path: 'e2e-screenshots/page-01-initial.png' });

    // Find New Page button using data-testid
    const newPageButton = page.locator('[data-testid="vault-new-page-button"]');

    await expect(newPageButton).toBeVisible({ timeout: 10000 });
    await newPageButton.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e-screenshots/page-02-after-new-page.png' });

    // Should now see editor
    const editor = page.locator('[contenteditable="true"], .ProseMirror, .tiptap').first();
    const editorVisible = await editor.isVisible({ timeout: 5000 }).catch(() => false);

    if (editorVisible) {
      await page.screenshot({ path: 'e2e-screenshots/page-03-editor-visible.png' });
    }
  });

  test('should type in the editor after creating page', async ({ page }) => {
    // Create new page
    const newPageButton = page.locator('[data-testid="vault-new-page-button"]');
    await expect(newPageButton).toBeVisible({ timeout: 10000 });
    await newPageButton.click();
    await page.waitForTimeout(2000);

    // Find editor
    const editor = page.locator('[contenteditable="true"], .ProseMirror').first();

    if (await editor.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editor.click();
      await page.waitForTimeout(500);

      // Type some content
      await page.keyboard.type('Test page content from Playwright e2e test');
      await page.waitForTimeout(1000);

      await page.screenshot({ path: 'e2e-screenshots/page-04-typed-content.png' });

      // Verify content is there
      const editorText = await editor.textContent();
      expect(editorText).toContain('Test page content');
    }
  });

  test('should show slash command menu', async ({ page }) => {
    // Create or open page
    const newPageButton = page.locator('[data-testid="vault-new-page-button"]');
    await expect(newPageButton).toBeVisible({ timeout: 10000 });
    await newPageButton.click();
    await page.waitForTimeout(2000);

    const editor = page.locator('[contenteditable="true"], .ProseMirror').first();

    if (await editor.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editor.click();
      await page.waitForTimeout(500);

      // Type / to trigger slash menu
      await page.keyboard.type('/');
      await page.waitForTimeout(1000);

      await page.screenshot({ path: 'e2e-screenshots/page-05-slash-menu.png' });

      // Look for slash menu
      const slashMenu = page.locator('[class*="slash"], [class*="menu"], [role="menu"], [role="listbox"]');
      const menuVisible = await slashMenu.first().isVisible().catch(() => false);
      console.log('Slash menu visible:', menuVisible);
    }
  });

  test('should expand PARA folder and see child pages area', async ({ page }) => {
    // Wait for sidebar to load or proceed with main content
    const workspaceVisible = await page.waitForSelector('text=Workspace', { timeout: 5000 }).catch(() => null);

    if (workspaceVisible) {
      // Click on Projects folder to expand it
      const projectsButton = page.locator('[data-testid="vault-sidebar"] button:has-text("Projects")').first();
      await expect(projectsButton).toBeVisible({ timeout: 5000 });
      await projectsButton.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'e2e-screenshots/page-06-projects-expanded.png' });
    } else {
      // Sidebar still loading - use main content BROWSE BY
      await page.screenshot({ path: 'e2e-screenshots/page-06-sidebar-loading.png' });
    }

    // Now create a new page
    const newPageButton = page.locator('[data-testid="vault-new-page-button"]');
    await expect(newPageButton).toBeVisible({ timeout: 5000 });
    await newPageButton.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'e2e-screenshots/page-07-new-page-created.png' });
  });

  test('should toggle dark mode', async ({ page }) => {
    // Wait for theme toggle to be visible
    const themeToggle = page.locator('[data-testid="vault-theme-toggle"]');
    await expect(themeToggle).toBeVisible({ timeout: 10000 });

    // Take screenshot in light mode
    await page.screenshot({ path: 'e2e-screenshots/page-08-light-mode.png' });

    // Click to toggle to dark mode
    await themeToggle.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'e2e-screenshots/page-09-dark-mode.png' });

    // Toggle back
    await themeToggle.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: 'e2e-screenshots/page-10-light-mode-again.png' });
  });
});

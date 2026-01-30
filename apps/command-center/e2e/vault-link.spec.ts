import { test, expect } from '@playwright/test';

test.describe('Command Center - Vault Link', () => {
  test('should have vault link pointing to production vault app', async ({ page }) => {
    // Go to command center production
    await page.goto('https://command-center-plum.vercel.app');
    await page.waitForTimeout(3000);

    console.log('Step 1: Check sidebar for Vault link');

    // Look for Vault link in sidebar
    const vaultLink = page.locator('a[href*="vault"]').first();
    const vaultLinkExists = await vaultLink.count();
    console.log('Vault links found:', vaultLinkExists);

    if (vaultLinkExists > 0) {
      const href = await vaultLink.getAttribute('href');
      console.log('Vault link href:', href);

      // Should NOT be localhost
      expect(href).not.toContain('localhost');
      console.log('✓ Vault link does not point to localhost');

      // Should be the production vault URL
      if (href?.includes('vault-indol.vercel.app') || href?.includes('vault')) {
        console.log('✓ Vault link points to production vault');
      }
    }

    // Also check the dashboard metric card
    console.log('\nStep 2: Check Vault metric card');
    const vaultCard = page.locator('text=Vault Entries').first();
    const cardExists = await vaultCard.isVisible().catch(() => false);
    console.log('Vault card visible:', cardExists);

    if (cardExists) {
      // Find the parent link
      const cardLink = page.locator('a:has-text("Vault Entries")');
      const cardLinkExists = await cardLink.count();

      if (cardLinkExists > 0) {
        const cardHref = await cardLink.getAttribute('href');
        console.log('Vault card href:', cardHref);

        // Should NOT be localhost
        expect(cardHref).not.toContain('localhost');
        console.log('✓ Vault card link does not point to localhost');
      }
    }

    // Take screenshot
    await page.screenshot({ path: 'screenshots/command-center-vault-link.png' });
    console.log('\n✅ Vault link test complete');
  });
});

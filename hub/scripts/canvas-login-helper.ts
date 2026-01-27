/**
 * Canvas Login Helper
 *
 * Simple script to help you log in to Canvas and save the session.
 * Run this once to enable automatic Canvas reading detection.
 *
 * Usage:
 *   bun run scripts/canvas-login-helper.ts
 *
 * What this does:
 * 1. Opens a browser window
 * 2. Navigates to Canvas
 * 3. Waits for you to log in (SSO or regular)
 * 4. Saves the session for 7 days
 * 5. Verifies login worked
 */

import { BrowserManager } from '../src/agents/canvas-integrity/browser-manager';

async function loginToCanvas() {
  console.log('🌐 Canvas Login Helper\n');
  console.log('This will open a browser window for you to log in to Canvas.');
  console.log('Your session will be saved for 7 days.\n');

  // Use visible browser (headless: false) so user can log in
  const browserManager = new BrowserManager({ headless: false });

  try {
    console.log('[1/4] Initializing browser...');
    await browserManager.initialize();

    console.log('[2/4] Opening Canvas login page...');
    console.log('\n⚠️  IMPORTANT: A browser window will open.');
    console.log('    Please log in to Canvas using your SSO or regular credentials.\n');

    const loginResult = await browserManager.login();

    if (loginResult.success) {
      console.log('\n✅ [3/4] Login successful!');
      console.log(`   Session saved to: ${loginResult.sessionPath || 'default location'}`);
      console.log('   Session expires in: 7 days\n');

      console.log('[4/4] Verifying session...');
      // Try to navigate to Canvas home to verify
      const page = await browserManager.getPage();
      await page.goto(process.env.CANVAS_BASE_URL || 'https://canvas.instructure.com');
      await page.waitForTimeout(2000);

      const currentUrl = page.url();
      if (currentUrl.includes('canvas')) {
        console.log('✅ Session verified - you are logged in!\n');
        console.log('🎉 Setup complete! Canvas reading detection is now enabled.\n');
        console.log('Next steps:');
        console.log('  1. The agent will run automatically tomorrow at 7:00 AM');
        console.log('  2. Or run a test now: bun run scripts/test-canvas-integrity-agent.ts');
        console.log('  3. Check task list tomorrow for 📖 reading tasks\n');
      } else {
        console.log('⚠️  Warning: Session may not be valid. Try logging in again.\n');
      }
    } else {
      console.log('\n❌ [3/4] Login failed or was cancelled.');
      console.log(`   Error: ${loginResult.error}\n`);
      console.log('Please try again or check your Canvas credentials.\n');
    }

    await browserManager.close();

  } catch (error) {
    console.error('\n❌ Error during login:', error);
    console.log('\nTroubleshooting:');
    console.log('  1. Make sure Playwright is installed: cd hub && bun install');
    console.log('  2. Install browser: npx playwright install chromium');
    console.log('  3. Check .env file has CANVAS_BASE_URL set');
    console.log('  4. Check your Canvas login credentials\n');

    try {
      await browserManager.close();
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    process.exit(1);
  }
}

loginToCanvas()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

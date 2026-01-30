/**
 * Plaud Login Script
 *
 * Opens a browser for manual Google OAuth login to Plaud.
 * Saves session for automated syncs.
 */

import { chromium } from 'playwright';
import * as readline from 'readline';

const USER_DATA_DIR = '/Users/jddavenport/Documents/PlaudSync/.plaud-browser';
const STORAGE_PATH = '/Users/jddavenport/Documents/PlaudSync/.plaud-auth.json';

async function waitForEnter(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question('Press ENTER when you see the Plaud dashboard...', () => {
      rl.close();
      resolve();
    });
  });
}

async function main() {
  console.log('===========================================');
  console.log('  PLAUD LOGIN');
  console.log('===========================================');
  console.log('');
  console.log('1. A browser window will open');
  console.log('2. Click "Continue with Google"');
  console.log('3. Complete the Google sign-in');
  console.log('4. Come back here and press ENTER');
  console.log('');

  // Use persistent context to save browser state
  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    headless: false,
    viewport: { width: 1280, height: 800 },
  });

  const page = context.pages()[0] || await context.newPage();
  await page.goto('https://web.plaud.ai');

  console.log('Browser opened. Complete the login...');
  console.log('');

  await waitForEnter();

  // Check if logged in
  const url = page.url();
  console.log('Current URL:', url);

  const isLoggedIn = url.indexOf('/login') === -1;

  if (isLoggedIn) {
    console.log('Login successful! Saving session...');
    await page.screenshot({ path: '/tmp/plaud-dashboard.png', fullPage: true });
    await context.storageState({ path: STORAGE_PATH });
    console.log('Session saved to:', STORAGE_PATH);
    console.log('');
    console.log('You can now run automated syncs!');
  } else {
    console.log('Still on login page - login may have failed');
  }

  await context.close();
}

main().catch(console.error);

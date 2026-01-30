#!/usr/bin/env bun
/**
 * Outlook Login Script
 *
 * Opens a browser for manual Outlook.com authentication.
 * Saves the session for use by the automated scraper.
 *
 * Usage: bun run scripts/outlook-login.ts
 */

import { OutlookScraper } from '../src/integrations/outlook-scraper';

async function main() {
  console.log('='.repeat(60));
  console.log('Outlook.com Login Helper');
  console.log('='.repeat(60));
  console.log('');
  console.log('A browser window will open for you to log into Outlook.');
  console.log('Complete the login process, including any 2FA if required.');
  console.log('Once you reach your inbox, the session will be saved.');
  console.log('');
  console.log('Press Ctrl+C to cancel at any time.');
  console.log('');

  // Create scraper with non-headless mode for manual login
  const scraper = new OutlookScraper({
    headless: false,
  });

  try {
    const success = await scraper.login(true);

    if (success) {
      console.log('');
      console.log('='.repeat(60));
      console.log('SUCCESS! Session saved.');
      console.log('='.repeat(60));
      console.log('');
      console.log('The Outlook scraper will now use this session for automated');
      console.log('email checking. The session will expire after 7 days.');
      console.log('');
      console.log('You can close this script now.');
    } else {
      console.log('');
      console.log('Login was not completed. Please try again.');
    }
  } catch (error) {
    console.error('Login failed:', error);
    process.exit(1);
  } finally {
    await scraper.close();
  }
}

main();

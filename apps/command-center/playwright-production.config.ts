import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for testing against production environment.
 * Use this to verify production deployments are working correctly.
 *
 * Run with: npx playwright test --config=playwright-production.config.ts
 */
export default defineConfig({
  testDir: './e2e',

  /* Run tests sequentially against production */
  fullyParallel: false,

  /* Always fail on test.only in source code */
  forbidOnly: true,

  /* Retry failed tests */
  retries: 2,

  /* Run one test at a time to avoid overwhelming production */
  workers: 1,

  /* Reporter configuration */
  reporter: [
    ['html', { outputFolder: 'playwright-report-production' }],
    ['list'],
    ['json', { outputFile: 'production-test-results.json' }],
  ],

  /* Shared settings for all projects */
  use: {
    /* Production Command Center URL */
    baseURL: 'https://command-center-plum.vercel.app',

    /* Collect trace when retrying the failed test */
    trace: 'retain-on-failure',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video recording on failure */
    video: 'retain-on-failure',

    /* Longer timeouts for production (network latency) */
    actionTimeout: 15000,
    navigationTimeout: 45000,
  },

  /* Test in Chromium only for production smoke tests */
  projects: [
    {
      name: 'chromium-production',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],

  /* No local server needed - we're testing against production */
  // webServer: undefined,

  /* Global timeout for each test */
  timeout: 60000,

  /* Expect timeout */
  expect: {
    timeout: 10000,
  },
});

import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Test Configuration
 *
 * By default, tests run in HEADLESS mode on a separate port (5174)
 * so they don't interfere with your development workflow.
 *
 * To run tests visually (headed mode):
 *   bun run test:e2e --headed
 *
 * To run against your existing dev server (port 5173):
 *   TEST_USE_DEV_SERVER=1 bun run test:e2e
 */

const TEST_PORT = 5174;
const DEV_PORT = 5173;

// Use existing dev server if TEST_USE_DEV_SERVER is set
const useDevServer = !!process.env.TEST_USE_DEV_SERVER;
const baseURL = useDevServer
  ? `http://localhost:${DEV_PORT}`
  : `http://localhost:${TEST_PORT}`;

export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 3 : 2,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ['json', { outputFile: 'test-results.json' }],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,

    /* Run headless by default - won't open browser windows */
    headless: true,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'retain-on-failure',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video recording on failure */
    video: 'retain-on-failure',

    /* Maximum time each action such as `click()` can take. Defaults to 0 (no limit). */
    actionTimeout: 10000,

    /* Maximum time each navigation can take */
    navigationTimeout: 30000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],

  /* Run a dedicated test server on port 5174 (separate from dev server) */
  webServer: useDevServer ? undefined : {
    command: `bun run dev -- --port ${TEST_PORT}`,
    url: `http://localhost:${TEST_PORT}`,
    reuseExistingServer: false,
    timeout: 120000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});

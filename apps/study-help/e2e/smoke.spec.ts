import { test, expect } from '@playwright/test';

/**
 * Study-Help App Smoke Tests
 * 
 * These tests verify core functionality is working:
 * 1. App loads without errors
 * 2. API data is being fetched
 * 3. Dashboard shows tasks and courses
 * 4. Navigation works
 */

const BASE_URL = 'http://localhost:5177';
const API_URL = 'http://localhost:3000';

test.describe('Study-Help Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Catch console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log('CONSOLE ERROR:', msg.text());
      }
    });
    
    // Catch network failures
    page.on('requestfailed', (request) => {
      console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText);
    });
  });

  test('API is responding', async ({ request }) => {
    // Test tasks API
    const tasksResponse = await request.get(`${API_URL}/api/tasks?limit=3`);
    expect(tasksResponse.ok()).toBeTruthy();
    const tasksData = await tasksResponse.json();
    expect(tasksData.success).toBe(true);
    console.log(`Tasks API: ${tasksData.data?.length || 0} tasks returned`);

    // Test books API
    const booksResponse = await request.get(`${API_URL}/api/read-help/books`);
    expect(booksResponse.ok()).toBeTruthy();
    const booksData = await booksResponse.json();
    expect(booksData.success).toBe(true);
    console.log(`Books API: ${booksData.data?.length || 0} books returned`);
  });

  test('Frontend proxy works', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/tasks?limit=3`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    console.log(`Proxy: ${data.data?.length || 0} tasks via proxy`);
  });

  test('App loads without crash', async ({ page }) => {
    await page.goto(BASE_URL);
    
    // Wait for React to hydrate
    await page.waitForTimeout(2000);
    
    // Check for fatal errors in page content
    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('RENDER ERROR');
    expect(bodyText).not.toContain('Something went wrong');
    
    // Check page title/header exists
    const header = page.locator('text=Study Help');
    await expect(header.first()).toBeVisible({ timeout: 10000 });
    
    console.log('App loaded successfully');
  });

  test('Dashboard shows course data', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000); // Wait for data to load
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/dashboard.png', fullPage: true });
    
    // Check for course cards or task counts
    const courseLinks = page.locator('a[href^="/course/"]');
    const courseCount = await courseLinks.count();
    console.log(`Found ${courseCount} course links`);
    
    // Check for task counts (numbers in the UI)
    const numberElements = page.locator('text=/\\d+ (tasks|active|Active)/');
    const taskIndicators = await numberElements.count();
    console.log(`Found ${taskIndicators} task indicators`);
    
    // At minimum, the course sidebar should be visible
    expect(courseCount).toBeGreaterThan(0);
  });

  test('Course view loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/course/mba580`);
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'test-results/course-view.png', fullPage: true });
    
    // Should show course name
    const heading = page.locator('text=Business Strategy');
    await expect(heading.first()).toBeVisible({ timeout: 10000 });
    
    // Check for tabs
    const tabs = page.locator('button, [role="tab"]');
    const tabCount = await tabs.count();
    console.log(`Found ${tabCount} tabs/buttons`);
  });

  test('Data flow debugging', async ({ page }) => {
    // Intercept API calls to log them
    const apiCalls: string[] = [];
    
    page.on('request', (request) => {
      if (request.url().includes('/api/')) {
        apiCalls.push(`→ ${request.method()} ${request.url()}`);
      }
    });
    
    page.on('response', (response) => {
      if (response.url().includes('/api/')) {
        apiCalls.push(`← ${response.status()} ${response.url()}`);
      }
    });
    
    await page.goto(BASE_URL);
    await page.waitForTimeout(5000);
    
    console.log('\n=== API CALLS ===');
    apiCalls.forEach(call => console.log(call));
    console.log('=================\n');
    
    // Log the final DOM state
    const htmlContent = await page.content();
    console.log('Page HTML length:', htmlContent.length);
    
    // Check if loading states are stuck
    const loadingElements = page.locator('.animate-pulse, text=Loading');
    const loadingCount = await loadingElements.count();
    console.log(`Loading indicators still visible: ${loadingCount}`);
    
    if (loadingCount > 0) {
      console.log('WARNING: Page appears to be stuck in loading state!');
    }
  });
});

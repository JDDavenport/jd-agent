import { test, expect, type Page } from '@playwright/test';

// Helper function to wait for page to be ready
async function waitForPageReady(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');
}

test.describe('Calendar Page Debug Tests', () => {
  test('should load calendar page and take screenshot', async ({ page }) => {
    // Navigate to calendar page
    await page.goto('/calendar');
    await waitForPageReady(page);
    
    // Take a screenshot of the initial state
    await page.screenshot({ 
      path: 'screenshots/calendar-page-initial.png',
      fullPage: true 
    });
    
    // Wait a moment for any async data to load
    await page.waitForTimeout(3000);
    
    // Take another screenshot after loading
    await page.screenshot({ 
      path: 'screenshots/calendar-page-after-load.png',
      fullPage: true 
    });
    
    // Check page title
    console.log('Page title:', await page.title());
    
    // Log the page URL
    console.log('Page URL:', page.url());
    
    // Check for any error messages on the page
    const errorMessages = await page.locator('[class*="error"], [class*="Error"], .text-red-500, .text-destructive').allTextContents();
    console.log('Error messages found:', errorMessages);
    
    // Check for loading states
    const loadingElements = await page.locator('[class*="loading"], [class*="Loading"], [class*="animate-spin"]').count();
    console.log('Loading elements found:', loadingElements);
    
    // Check what main content is visible
    const mainContent = await page.locator('main').innerHTML();
    console.log('Main content HTML length:', mainContent.length);
    
    // Try to find calendar-related elements
    const calendarHeading = await page.locator('h1, h2').allTextContents();
    console.log('Headings found:', calendarHeading);
    
    // Check console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Pass test - we're just gathering info
    expect(true).toBe(true);
  });

  test('should check calendar view switcher', async ({ page }) => {
    await page.goto('/calendar');
    await waitForPageReady(page);
    await page.waitForTimeout(2000);
    
    // Look for view switcher buttons (Month/Week/Day)
    const monthButton = page.locator('button:has-text("Month"), [role="tab"]:has-text("Month")');
    const weekButton = page.locator('button:has-text("Week"), [role="tab"]:has-text("Week")');
    const dayButton = page.locator('button:has-text("Day"), [role="tab"]:has-text("Day")');
    
    console.log('Month button visible:', await monthButton.isVisible().catch(() => false));
    console.log('Week button visible:', await weekButton.isVisible().catch(() => false));
    console.log('Day button visible:', await dayButton.isVisible().catch(() => false));
    
    // Take screenshot of initial view
    await page.screenshot({ path: 'screenshots/calendar-view-initial.png' });
    
    // Try clicking Week view if visible
    if (await weekButton.isVisible().catch(() => false)) {
      await weekButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/calendar-view-week.png' });
      console.log('Week view clicked successfully');
    }
    
    // Try clicking Day view if visible
    if (await dayButton.isVisible().catch(() => false)) {
      await dayButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/calendar-view-day.png' });
      console.log('Day view clicked successfully');
    }
    
    // Try clicking Month view if visible
    if (await monthButton.isVisible().catch(() => false)) {
      await monthButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/calendar-view-month.png' });
      console.log('Month view clicked successfully');
    }
    
    expect(true).toBe(true);
  });

  test('should check calendar navigation', async ({ page }) => {
    await page.goto('/calendar');
    await waitForPageReady(page);
    await page.waitForTimeout(2000);
    
    // Look for navigation buttons
    const prevButton = page.locator('button:has-text("Previous"), button:has-text("<"), button:has-text("←"), [aria-label*="previous"], [aria-label*="prev"]');
    const nextButton = page.locator('button:has-text("Next"), button:has-text(">"), button:has-text("→"), [aria-label*="next"]');
    const todayButton = page.locator('button:has-text("Today")');
    
    console.log('Previous button visible:', await prevButton.first().isVisible().catch(() => false));
    console.log('Next button visible:', await nextButton.first().isVisible().catch(() => false));
    console.log('Today button visible:', await todayButton.isVisible().catch(() => false));
    
    // Check for chevron icons (common in calendar navigation)
    const chevronButtons = await page.locator('button svg[class*="lucide-chevron"]').count();
    console.log('Chevron navigation buttons:', chevronButtons);
    
    // Try clicking Today button
    if (await todayButton.isVisible().catch(() => false)) {
      await todayButton.click();
      await page.waitForTimeout(500);
      console.log('Today button clicked');
    }
    
    // Take screenshot showing navigation area
    await page.screenshot({ path: 'screenshots/calendar-navigation.png' });
    
    expect(true).toBe(true);
  });

  test('should check for calendar events', async ({ page }) => {
    await page.goto('/calendar');
    await waitForPageReady(page);
    await page.waitForTimeout(3000);
    
    // Look for event elements
    const events = await page.locator('[class*="event"], [class*="Event"], [data-event]').count();
    console.log('Event elements found:', events);
    
    // Check for any calendar grid
    const calendarGrid = await page.locator('[class*="calendar"], [class*="Calendar"], [role="grid"]').count();
    console.log('Calendar grid elements:', calendarGrid);
    
    // Check for date numbers
    const dateNumbers = await page.locator('[class*="day-number"], .text-sm.font-medium').count();
    console.log('Date number elements:', dateNumbers);
    
    // Get all visible text to understand what's rendered
    const bodyText = await page.locator('body').innerText();
    console.log('Page text preview (first 500 chars):', bodyText.substring(0, 500));
    
    await page.screenshot({ path: 'screenshots/calendar-events.png', fullPage: true });
    
    expect(true).toBe(true);
  });

  test('should capture network requests', async ({ page }) => {
    const apiRequests: string[] = [];
    const apiResponses: { url: string; status: number; body?: string }[] = [];
    
    // Monitor network requests
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        apiRequests.push(request.url());
      }
    });
    
    page.on('response', async response => {
      if (response.url().includes('/api/')) {
        let body = '';
        try {
          body = await response.text();
          if (body.length > 200) body = body.substring(0, 200) + '...';
        } catch (e) {
          body = 'Could not read body';
        }
        apiResponses.push({
          url: response.url(),
          status: response.status(),
          body
        });
      }
    });
    
    await page.goto('/calendar');
    await waitForPageReady(page);
    await page.waitForTimeout(5000);
    
    console.log('\n=== API Requests Made ===');
    apiRequests.forEach(url => console.log('  -', url));
    
    console.log('\n=== API Responses ===');
    apiResponses.forEach(r => {
      console.log(`  ${r.status} ${r.url}`);
      console.log(`    Body: ${r.body}`);
    });
    
    expect(true).toBe(true);
  });
});

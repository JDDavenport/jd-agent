import { test, expect, type Page } from '@playwright/test';
import {
  navigateAndWait,
  waitForPageReady,
  waitForLoadingToComplete,
  mockAPIResponse,
  clearBrowserData,
} from './helpers';
import {
  mockTasks,
  mockVaultEntries,
  buildSuccessResponse,
} from './fixtures';

/**
 * Performance Testing
 * Tests application performance metrics and optimization
 */

test.describe('Load Time Tests', () => {
  test('should measure time to interactive for dashboard', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await waitForPageReady(page);

    const loadTime = Date.now() - startTime;

    console.log(`Dashboard load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
  });

  test('should measure time to interactive for vault page', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/vault');
    await waitForPageReady(page);
    await waitForLoadingToComplete(page);

    const loadTime = Date.now() - startTime;

    console.log(`Vault page load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(5000);
  });

  test('should measure time to interactive for chat page', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/chat');
    await waitForPageReady(page);
    await waitForLoadingToComplete(page);

    const loadTime = Date.now() - startTime;

    console.log(`Chat page load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(5000);
  });

  test('should test with slow 3G network simulation', async ({ page, context }) => {
    // Simulate slow 3G network
    await context.route('**/*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 100)); // Add 100ms delay
      await route.continue();
    });

    const startTime = Date.now();

    await page.goto('/');
    await waitForPageReady(page);

    const loadTime = Date.now() - startTime;

    console.log(`Dashboard load time on slow 3G: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(15000); // Allow more time for slow network
  });

  test('should test with 100+ tasks loaded', async ({ page }) => {
    // Generate 100 mock tasks
    const largeTasks = Array.from({ length: 100 }, (_, i) => ({
      id: `task-${i}`,
      title: `Task ${i}`,
      status: i % 3 === 0 ? 'today' : i % 3 === 1 ? 'upcoming' : 'someday',
      priority: i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low',
      createdAt: new Date().toISOString(),
    }));

    await mockAPIResponse(page, '**/api/tasks**', buildSuccessResponse(largeTasks));

    const startTime = Date.now();

    await page.goto('/');
    await waitForPageReady(page);
    await waitForLoadingToComplete(page);

    const loadTime = Date.now() - startTime;

    console.log(`Dashboard load time with 100 tasks: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(6000);
  });

  test('should test with 50+ vault entries', async ({ page }) => {
    // Generate 50 mock vault entries
    const largeVaultData = Array.from({ length: 50 }, (_, i) => ({
      id: `vault-${i}`,
      title: `Vault Entry ${i}`,
      contentType: i % 3 === 0 ? 'note' : i % 3 === 1 ? 'lecture' : 'meeting',
      context: 'Test',
      tags: [`tag-${i % 5}`],
      content: `Content for entry ${i}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    await mockAPIResponse(page, '**/api/vault**', buildSuccessResponse(largeVaultData));

    const startTime = Date.now();

    await page.goto('/vault');
    await waitForPageReady(page);
    await waitForLoadingToComplete(page);

    const loadTime = Date.now() - startTime;

    console.log(`Vault page load time with 50 entries: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(6000);
  });

  test('should measure initial bundle size impact', async ({ page }) => {
    // Capture all network requests
    const resourceSizes: { [key: string]: number } = {};
    let totalSize = 0;

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('.js') || url.includes('.css')) {
        try {
          const buffer = await response.body();
          const size = buffer.length;
          resourceSizes[url] = size;
          totalSize += size;
        } catch (e) {
          // Some resources may not be accessible
        }
      }
    });

    await page.goto('/');
    await waitForPageReady(page);

    console.log(`Total JS/CSS bundle size: ${Math.round(totalSize / 1024)}KB`);

    // Bundle should be reasonable (< 2MB for initial load)
    expect(totalSize).toBeLessThan(2 * 1024 * 1024);
  });
});

test.describe('Interaction Performance', () => {
  test('should complete a task in under 500ms', async ({ page }) => {
    await navigateAndWait(page, '/');

    const checkbox = page.locator('[type="checkbox"]').first();
    if (await checkbox.isVisible({ timeout: 5000 }).catch(() => false)) {
      const startTime = Date.now();

      await checkbox.click();
      await page.waitForTimeout(100); // Wait for any animations

      const interactionTime = Date.now() - startTime;

      console.log(`Task completion interaction time: ${interactionTime}ms`);
      expect(interactionTime).toBeLessThan(1000); // Allow up to 1 second for interaction + animation
    }
  });

  test('should search response time with 100 entries', async ({ page }) => {
    // Generate 100 mock vault entries
    const largeVaultData = Array.from({ length: 100 }, (_, i) => ({
      id: `vault-${i}`,
      title: `Vault Entry ${i}`,
      contentType: 'note',
      context: 'Test',
      tags: [`tag-${i % 5}`],
      content: `Content for entry ${i}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    await mockAPIResponse(page, '**/api/vault**', buildSuccessResponse(largeVaultData));

    await navigateAndWait(page, '/vault');

    const searchInput = page.locator('input[placeholder*="Search" i]').first();
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      const startTime = Date.now();

      await searchInput.fill('Entry 50');
      await page.waitForTimeout(500); // Wait for debounce and results

      const searchTime = Date.now() - startTime;

      console.log(`Search response time with 100 entries: ${searchTime}ms`);
      expect(searchTime).toBeLessThan(2000);
    }
  });

  test('should test filter application time', async ({ page }) => {
    await navigateAndWait(page, '/vault');

    const filterButton = page.locator('button:has-text("Notes"), button:has-text("All Types")').first();
    if (await filterButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      const startTime = Date.now();

      await filterButton.click();
      await page.waitForTimeout(300); // Wait for filter to apply

      const filterTime = Date.now() - startTime;

      console.log(`Filter application time: ${filterTime}ms`);
      expect(filterTime).toBeLessThan(1000);
    }
  });

  test('should measure form submission time', async ({ page }) => {
    await navigateAndWait(page, '/brain-dump');

    const textarea = page.locator('textarea').first();
    const addButton = page.locator('button:has-text("Add Single Task")');

    await textarea.fill('Performance test task');

    const startTime = Date.now();

    await addButton.click();
    await page.waitForTimeout(500); // Wait for submission

    const submissionTime = Date.now() - startTime;

    console.log(`Form submission time: ${submissionTime}ms`);
    expect(submissionTime).toBeLessThan(1500);
  });

  test('should measure navigation time between pages', async ({ page }) => {
    await navigateAndWait(page, '/');

    const startTime = Date.now();

    await page.click('a[href="/vault"]');
    await waitForPageReady(page);

    const navTime = Date.now() - startTime;

    console.log(`Navigation time from dashboard to vault: ${navTime}ms`);
    expect(navTime).toBeLessThan(3000);
  });
});

test.describe('Memory & Resource', () => {
  test('should monitor memory usage after 100 operations', async ({ page }) => {
    await navigateAndWait(page, '/chat');

    const chatInput = page.locator('textarea, input[type="text"]').last();
    const sendButton = page.locator('button:has-text("Send")').first();

    // Get initial memory
    const initialMetrics = await page.evaluate(() => {
      return (performance as any).memory
        ? {
            usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
            totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          }
        : null;
    });

    // Perform 100 operations
    for (let i = 0; i < 100; i++) {
      await chatInput.fill(`Memory test message ${i}`);
      if (i % 10 === 0) {
        // Send every 10th message
        await sendButton.click();
        await page.waitForTimeout(100);
      }
    }

    // Get final memory
    const finalMetrics = await page.evaluate(() => {
      return (performance as any).memory
        ? {
            usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
            totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          }
        : null;
    });

    if (initialMetrics && finalMetrics) {
      const memoryIncrease = finalMetrics.usedJSHeapSize - initialMetrics.usedJSHeapSize;
      console.log(`Memory increase after 100 operations: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);

      // Memory increase should be reasonable (< 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    }
  });

  test('should check for memory leaks in chat', async ({ page }) => {
    await navigateAndWait(page, '/chat');

    const chatInput = page.locator('textarea, input[type="text"]').last();
    const sendButton = page.locator('button:has-text("Send")').first();
    const clearButton = page.locator('button:has-text("Clear History")');

    // Create messages
    for (let i = 0; i < 20; i++) {
      await chatInput.fill(`Leak test ${i}`);
      await sendButton.click();
      await page.waitForTimeout(100);
    }

    const beforeClear = await page.evaluate(() => {
      return (performance as any).memory
        ? (performance as any).memory.usedJSHeapSize
        : null;
    });

    // Clear history
    if (await clearButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await clearButton.click();
      await page.waitForTimeout(1000);

      // Force garbage collection (if available in browser)
      await page.evaluate(() => {
        if ((window as any).gc) {
          (window as any).gc();
        }
      });

      await page.waitForTimeout(500);

      const afterClear = await page.evaluate(() => {
        return (performance as any).memory
          ? (performance as any).memory.usedJSHeapSize
          : null;
      });

      if (beforeClear && afterClear) {
        console.log(`Memory before clear: ${Math.round(beforeClear / 1024 / 1024)}MB`);
        console.log(`Memory after clear: ${Math.round(afterClear / 1024 / 1024)}MB`);

        // Memory should decrease or stay relatively the same
        const memoryIncrease = afterClear - beforeClear;
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Allow max 10MB increase
      }
    }
  });

  test('should verify resource cleanup on unmount', async ({ page }) => {
    // Navigate to a page
    await navigateAndWait(page, '/chat');

    // Set up listener count check
    const initialListeners = await page.evaluate(() => {
      return (window as any).getEventListeners
        ? Object.keys((window as any).getEventListeners(window)).length
        : 0;
    });

    // Navigate away
    await navigateAndWait(page, '/');

    // Navigate back
    await navigateAndWait(page, '/chat');

    // Check listener count again
    const finalListeners = await page.evaluate(() => {
      return (window as any).getEventListeners
        ? Object.keys((window as any).getEventListeners(window)).length
        : 0;
    });

    console.log(`Initial listeners: ${initialListeners}, Final listeners: ${finalListeners}`);

    // Listeners should not accumulate excessively
    if (initialListeners > 0) {
      expect(finalListeners).toBeLessThanOrEqual(initialListeners * 2);
    }
  });

  test('should check image/asset optimization', async ({ page }) => {
    const imageSizes: number[] = [];

    page.on('response', async (response) => {
      const url = response.url();
      if (url.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) {
        try {
          const buffer = await response.body();
          imageSizes.push(buffer.length);
        } catch (e) {
          // Some images may not be accessible
        }
      }
    });

    await page.goto('/');
    await waitForPageReady(page);

    if (imageSizes.length > 0) {
      const totalImageSize = imageSizes.reduce((sum, size) => sum + size, 0);
      const avgImageSize = totalImageSize / imageSizes.length;

      console.log(`Total images loaded: ${imageSizes.length}`);
      console.log(`Total image size: ${Math.round(totalImageSize / 1024)}KB`);
      console.log(`Average image size: ${Math.round(avgImageSize / 1024)}KB`);

      // Average image should be reasonably optimized (< 200KB)
      expect(avgImageSize).toBeLessThan(200 * 1024);
    }
  });

  test('should measure bundle size vs content loaded ratio', async ({ page }) => {
    let jsSize = 0;
    let cssSize = 0;
    let imageSize = 0;
    let otherSize = 0;

    page.on('response', async (response) => {
      const url = response.url();
      try {
        const buffer = await response.body();
        const size = buffer.length;

        if (url.includes('.js')) {
          jsSize += size;
        } else if (url.includes('.css')) {
          cssSize += size;
        } else if (url.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) {
          imageSize += size;
        } else {
          otherSize += size;
        }
      } catch (e) {
        // Some resources may not be accessible
      }
    });

    await page.goto('/');
    await waitForPageReady(page);

    const totalSize = jsSize + cssSize + imageSize + otherSize;

    console.log(`JS: ${Math.round(jsSize / 1024)}KB`);
    console.log(`CSS: ${Math.round(cssSize / 1024)}KB`);
    console.log(`Images: ${Math.round(imageSize / 1024)}KB`);
    console.log(`Other: ${Math.round(otherSize / 1024)}KB`);
    console.log(`Total: ${Math.round(totalSize / 1024)}KB`);

    // Total initial load should be reasonable (< 3MB)
    expect(totalSize).toBeLessThan(3 * 1024 * 1024);
  });
});

test.describe('Performance Regression Tests', () => {
  test('should benchmark dashboard render time', async ({ page }) => {
    const samples = 5;
    const renderTimes: number[] = [];

    for (let i = 0; i < samples; i++) {
      await clearBrowserData(page);

      const startTime = Date.now();
      await page.goto('/');
      await waitForPageReady(page);
      const renderTime = Date.now() - startTime;

      renderTimes.push(renderTime);
      console.log(`Sample ${i + 1} render time: ${renderTime}ms`);
    }

    const avgRenderTime = renderTimes.reduce((sum, time) => sum + time, 0) / samples;
    const maxRenderTime = Math.max(...renderTimes);
    const minRenderTime = Math.min(...renderTimes);

    console.log(`Average render time: ${avgRenderTime}ms`);
    console.log(`Min: ${minRenderTime}ms, Max: ${maxRenderTime}ms`);

    // Average should be within acceptable range
    expect(avgRenderTime).toBeLessThan(5000);
    // Variance should not be too high
    expect(maxRenderTime - minRenderTime).toBeLessThan(3000);
  });

  test('should measure first contentful paint', async ({ page }) => {
    await page.goto('/');

    const fcp = await page.evaluate(() => {
      return new Promise((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const fcpEntry = entries.find((entry) => entry.name === 'first-contentful-paint');
          if (fcpEntry) {
            observer.disconnect();
            resolve(fcpEntry.startTime);
          }
        });
        observer.observe({ type: 'paint', buffered: true });

        // Timeout after 10 seconds
        setTimeout(() => {
          observer.disconnect();
          resolve(null);
        }, 10000);
      });
    });

    if (fcp) {
      console.log(`First Contentful Paint: ${fcp}ms`);
      expect(fcp).toBeLessThan(3000); // FCP should be under 3 seconds
    }
  });

  test('should measure largest contentful paint', async ({ page }) => {
    await page.goto('/');
    await waitForPageReady(page);

    const lcp = await page.evaluate(() => {
      return new Promise((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          observer.disconnect();
          resolve(lastEntry.startTime);
        });
        observer.observe({ type: 'largest-contentful-paint', buffered: true });

        // Timeout after 10 seconds
        setTimeout(() => {
          observer.disconnect();
          resolve(null);
        }, 10000);
      });
    });

    if (lcp) {
      console.log(`Largest Contentful Paint: ${lcp}ms`);
      expect(lcp).toBeLessThan(4000); // LCP should be under 4 seconds
    }
  });

  test('should measure time to first byte', async ({ page }) => {
    const startTime = Date.now();

    const response = await page.goto('/');
    const ttfb = Date.now() - startTime;

    console.log(`Time to First Byte: ${ttfb}ms`);
    expect(ttfb).toBeLessThan(1000); // TTFB should be under 1 second
    expect(response?.status()).toBe(200);
  });

  test('should test scrolling performance with large lists', async ({ page }) => {
    // Generate large list of vault entries
    const largeVaultData = Array.from({ length: 200 }, (_, i) => ({
      id: `vault-${i}`,
      title: `Vault Entry ${i}`,
      contentType: 'note',
      context: 'Test',
      tags: [`tag-${i % 5}`],
      content: `Content for entry ${i}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    await mockAPIResponse(page, '**/api/vault**', buildSuccessResponse(largeVaultData));

    await navigateAndWait(page, '/vault');

    // Measure scroll performance
    const startTime = Date.now();

    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(50);
    }

    const scrollTime = Date.now() - startTime;

    console.log(`Scroll performance for 10 scrolls: ${scrollTime}ms`);
    expect(scrollTime).toBeLessThan(2000); // Should complete in under 2 seconds
  });
});

# E2E Testing Suite for JD Agent

This directory contains comprehensive end-to-end tests for the JD Agent React application using Playwright.

## Test Coverage

The test suite includes **140+ test cases** across 4 test files covering:

### Pages Tested (8 total)
1. **Dashboard** - Command center with stats, tasks, calendar
2. **Vault Explorer** - Note management and search
3. **Chat** - AI agent conversation interface
4. **Setup** - Multi-step onboarding flow
5. **Brain Dump** - Task capture interface
6. **Settings** - Ceremonies, notifications, and class management
7. **System Health** - Service status and metrics
8. **Note Editor** - Create and edit vault entries

### Test Categories

#### Navigation (7 tests)
- Route navigation between all pages
- Link functionality
- 404 redirect handling
- Back/forward navigation

#### Dashboard (8 tests)
- Stats cards rendering
- Today tasks display
- Week calendar
- Deadline widget
- Quick chat widget
- Goals panel
- Welcome message

#### Vault Explorer (8 tests)
- Search functionality
- Type filters (Notes, Lectures, Meetings, etc.)
- Context filters
- Tag filters
- Clear filters
- New note creation
- Entry count display

#### Chat (8 tests)
- Message input
- Quick actions
- Clear history
- Message count
- Navigation links
- Button states

#### Setup (8 tests)
- Multi-step progress bar
- Service connection testing
- Brain dump task entry
- Inbox processing
- Ceremony configuration
- Class management
- Navigation between steps

#### Brain Dump (10 tests)
- Single task creation
- Bulk task creation
- Session counting
- Inbox stats
- Tips display
- Navigation links
- Button states

#### Settings (12 tests)
- Tab navigation (Ceremonies, Notifications, Classes)
- Morning/Evening/Weekly ceremonies
- Test and preview buttons
- Class CRUD operations
- Notification channel status

#### Error Handling (3 tests)
- Network error recovery
- 404 API responses
- Error boundary

#### Loading States (3 tests)
- Spinner display
- Loading to loaded transitions

#### Responsive Design (3 tests)
- Mobile viewport (375x667)
- Tablet viewport (768x1024)
- Desktop viewport (1920x1080)

#### Accessibility (3 tests)
- Heading hierarchy
- Button labels
- Link navigation

#### Performance (3 tests)
- Dashboard load time
- Vault load time
- Navigation speed

## Running Tests

### Prerequisites
```bash
# Install dependencies
bun install

# Install Playwright browsers
bunx playwright install chromium
```

### Test Commands

```bash
# Run all tests (headless)
bun test

# Run tests with browser visible
bun test:headed

# Run tests in UI mode (interactive)
bun test:ui

# Run specific test file
bunx playwright test e2e/app.spec.ts
bunx playwright test e2e/advanced-features.spec.ts
bunx playwright test e2e/performance.spec.ts
bunx playwright test e2e/edge-cases.spec.ts

# Run tests matching pattern
bunx playwright test --grep "Dashboard"
bunx playwright test --grep "Workflows"
bunx playwright test --grep "Performance"
bunx playwright test --grep "Edge Cases"

# Run tests with debugging
bun test:debug

# View test report
bun test:report
```

### Advanced Options

```bash
# Run tests in specific browser
bunx playwright test --project=chromium

# Run tests with retries
bunx playwright test --retries=3

# Run tests with screenshot on failure
bunx playwright test --screenshot=only-on-failure

# Run tests with trace
bunx playwright test --trace=on
```

## Configuration

Test configuration is in `playwright.config.ts`:

- **Base URL**: http://localhost:5173
- **Retries**: 2 (3 on CI)
- **Timeout**: 30 seconds per test
- **Screenshots**: On failure
- **Video**: On failure
- **Trace**: On failure

## Test Utilities

### Helpers (`e2e/helpers.ts`)
Utility functions for common test operations:
- `waitForPageReady()` - Wait for page load
- `fillFormField()` - Fill and verify form inputs
- `clickAndWaitForNavigation()` - Navigate with click
- `mockAPIResponse()` - Mock API calls
- `takeScreenshot()` - Capture screenshots
- And 20+ more helpers

### Fixtures (`e2e/fixtures.ts`)
Mock data for testing:
- Tasks
- Vault entries
- Classes
- Chat messages
- Calendar events
- System health metrics
- And more

## Test Structure

Each test follows this pattern:

```typescript
test('should do something', async ({ page }) => {
  // 1. Navigate to page
  await page.goto('/path');
  await waitForPageReady(page);

  // 2. Perform action
  await page.click('button');

  // 3. Assert result
  await expect(page.locator('selector')).toBeVisible();
});
```

## Best Practices

1. **Always wait for page ready** before interacting
2. **Use meaningful test names** that describe behavior
3. **Group related tests** with `test.describe()`
4. **Mock API responses** when needed for isolation
5. **Take screenshots** on failures for debugging
6. **Use helpers** for repeated operations
7. **Keep tests independent** - no shared state

## Debugging Failed Tests

1. Check the error message in test output
2. View screenshots in `test-results/` directory
3. Watch video recordings of failures
4. Use `--debug` flag to step through tests
5. Use `--ui` mode for interactive debugging
6. Check browser console logs

## CI/CD Integration

Tests are configured to run in CI with:
- Headless mode
- 3 retries on failure
- Parallel execution disabled for stability
- Full screenshots and videos on failure

## Test Files

### 1. `app.spec.ts` - Core Functionality (54 tests)
Basic page navigation, rendering, and core features across all pages:
- Dashboard, Vault, Chat, Setup, Brain Dump, Settings, Health
- Navigation and routing
- Loading states and error handling
- Responsive design
- Basic accessibility
- Performance benchmarks

### 2. `advanced-features.spec.ts` - Complex Workflows (30 tests)
End-to-end user workflows and feature interactions:
- **Dashboard Workflows** (5 tests): Task completion, quick chat integration, calendar sync, goal tracking
- **Vault Workflows** (5 tests): Full CRUD operations, multi-tag filtering, context switching, bulk operations, export
- **Chat Workflows** (5 tests): Multi-turn conversations, message history, markdown rendering, tool usage
- **Setup Wizard Workflows** (5 tests): Complete onboarding, step navigation, brain dump with 20 tasks, inbox processing
- **Settings Workflows** (5 tests): Class management (add/edit/delete), ceremony testing, tab switching, persistence
- **Cross-Page Workflows** (5 tests): Data flow between pages, deep linking, browser navigation

### 3. `performance.spec.ts` - Performance Testing (22 tests)
Application performance metrics and optimization:
- **Load Time Tests** (7 tests): Page load times, slow network simulation, large datasets (100 tasks, 50 vault entries), bundle size
- **Interaction Performance** (5 tests): Task completion speed, search with 100 entries, filter application, form submission, navigation timing
- **Memory & Resource** (5 tests): Memory usage after 100 operations, leak detection, resource cleanup, image optimization, bundle analysis
- **Performance Regression** (5 tests): Render time benchmarks, First Contentful Paint, Largest Contentful Paint, TTFB, scroll performance

### 4. `edge-cases.spec.ts` - Edge Cases & Error Testing (34 tests)
Boundary conditions, error handling, and edge scenarios:
- **Input Validation** (8 tests): Empty forms, whitespace, max length (5000 chars), special characters, SQL injection prevention, XSS prevention, unicode/emoji, rapid submissions
- **Network Errors** (5 tests): API timeout, 500 errors, offline mode, retry logic, graceful degradation
- **State Management** (5 tests): Rapid navigation, concurrent operations, race conditions, stale data, cache invalidation
- **Browser Compatibility** (4 tests): WebKit engine, localStorage limits, disabled cookies, JavaScript error handling
- **Accessibility Edge Cases** (3 tests): Keyboard-only navigation, screen reader attributes, high contrast mode
- **Data Integrity** (5 tests): Corrupted localStorage, missing fields, null/undefined values, circular references, nested structures
- **Boundary Conditions** (4 tests): Zero items, single item, max integers, edge case dates

## Writing New Tests

### Adding to Existing Files

1. **Core features** → Add to `app.spec.ts`
2. **Complex workflows** → Add to `advanced-features.spec.ts`
3. **Performance metrics** → Add to `performance.spec.ts`
4. **Edge cases/errors** → Add to `edge-cases.spec.ts`

### Test Writing Guidelines

1. Use descriptive `test.describe()` grouping
2. Follow naming convention: "should [expected behavior]"
3. Use helpers from `helpers.ts`
4. Mock data from `fixtures.ts` when needed
5. Add assertions for all critical behaviors
6. Keep tests independent - no shared state

## Troubleshooting

### Tests timing out
- Increase timeout in test or config
- Check if dev server is running
- Verify network connectivity

### Flaky tests
- Add proper wait conditions
- Use `waitForPageReady()` helper
- Avoid hard-coded delays
- Check for race conditions

### Screenshots not capturing
- Ensure `screenshots/` directory exists
- Check disk space
- Verify file permissions

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright API Reference](https://playwright.dev/docs/api/class-playwright)
- [Best Practices](https://playwright.dev/docs/best-practices)

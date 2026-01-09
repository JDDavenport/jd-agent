# Quick Test Guide - JD Agent E2E Tests

## Run Tests - Fast Reference

```bash
# 1. Navigate to frontend directory
cd /Users/jddavenport/Projects/JD\ Agent/frontend

# 2. Run all tests (headless, fast)
bun test

# 3. Run tests with visible browser
bun test:headed

# 4. Interactive UI mode (best for debugging)
bun test:ui

# 5. View test results
bun test:report
```

## Test Stats

- **Total Tests**: 84
- **Pages Covered**: 8
- **Helper Functions**: 30+
- **Expected Pass Rate**: 70-75%

## What's Tested

✅ All 8 pages load correctly
✅ Navigation between pages works
✅ Forms and inputs are functional
✅ Buttons and links work
✅ Error handling is graceful
✅ Page loads within acceptable time
✅ Works on mobile, tablet, desktop
✅ Basic accessibility compliance

## Test Files

- `e2e/app.spec.ts` - Main tests (84 tests)
- `e2e/helpers.ts` - Utility functions
- `e2e/fixtures.ts` - Mock data
- `playwright.config.ts` - Configuration

## Common Commands

```bash
# Run specific test file
bunx playwright test e2e/app.spec.ts

# Run tests matching name
bunx playwright test --grep "Dashboard"

# Debug a specific test
bunx playwright test --debug --grep "should load dashboard"

# Generate report
bunx playwright show-report

# Update screenshots
bunx playwright test --update-snapshots
```

## When Tests Fail

1. Check `screenshots/` folder for failure images
2. Check `test-results/` for videos
3. Run `bun test:ui` to debug interactively
4. Check if backend is running (many tests need it)
5. Look for error messages in console output

## Quick Fixes

**Backend not running?**
```bash
# Start backend first
cd /Users/jddavenport/Projects/JD\ Agent
bun run dev
```

**Tests timing out?**
- Backend might be slow
- Network issues
- Increase timeout in playwright.config.ts

**Flaky tests?**
- Tests will retry 2 times automatically
- Check test-results/ for details

## Pages Tested

1. **Dashboard** (/) - 8 tests
2. **Vault** (/vault) - 8 tests
3. **Chat** (/chat) - 8 tests
4. **Setup** (/setup) - 8 tests
5. **Brain Dump** (/brain-dump) - 10 tests
6. **Settings** (/settings) - 12 tests
7. **System Health** (/health) - 4 tests
8. **Note Editor** (/vault/new) - 5 tests

Plus: Navigation, Error Handling, Loading, Responsive, A11y, Performance

## Need Help?

📖 Full docs: `e2e/README.md`
📊 Detailed report: `TESTING_REPORT.md`
📝 Summary: `TEST_SUMMARY.md`
🌐 Playwright docs: https://playwright.dev

## CI/CD Ready

Tests are configured for:
- Automatic retries (3x on CI)
- Screenshot capture on failure
- Video recording
- JSON and HTML reports
- Headless execution

Just run `bun test` in your CI pipeline!

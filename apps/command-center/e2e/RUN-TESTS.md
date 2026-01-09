# Quick Test Execution Guide

## Run All New Tests

```bash
# Run all new test files
bunx playwright test e2e/advanced-features.spec.ts e2e/performance.spec.ts e2e/edge-cases.spec.ts

# Run with UI mode (recommended for first run)
bunx playwright test e2e/advanced-features.spec.ts e2e/performance.spec.ts e2e/edge-cases.spec.ts --ui

# Run with headed browser (see what's happening)
bunx playwright test e2e/advanced-features.spec.ts e2e/performance.spec.ts e2e/edge-cases.spec.ts --headed
```

## Run Individual Test Files

### Advanced Features (30 tests)
```bash
# All workflows
bunx playwright test e2e/advanced-features.spec.ts

# Specific workflow
bunx playwright test e2e/advanced-features.spec.ts --grep "Dashboard Workflows"
bunx playwright test e2e/advanced-features.spec.ts --grep "Vault Workflows"
bunx playwright test e2e/advanced-features.spec.ts --grep "Chat Workflows"
bunx playwright test e2e/advanced-features.spec.ts --grep "Setup Wizard"
bunx playwright test e2e/advanced-features.spec.ts --grep "Settings Workflows"
bunx playwright test e2e/advanced-features.spec.ts --grep "Cross-Page"
```

### Performance Tests (22 tests)
```bash
# All performance tests
bunx playwright test e2e/performance.spec.ts

# Specific category
bunx playwright test e2e/performance.spec.ts --grep "Load Time"
bunx playwright test e2e/performance.spec.ts --grep "Interaction Performance"
bunx playwright test e2e/performance.spec.ts --grep "Memory & Resource"
bunx playwright test e2e/performance.spec.ts --grep "Performance Regression"
```

### Edge Cases (34 tests)
```bash
# All edge case tests
bunx playwright test e2e/edge-cases.spec.ts

# Specific category
bunx playwright test e2e/edge-cases.spec.ts --grep "Input Validation"
bunx playwright test e2e/edge-cases.spec.ts --grep "Network Errors"
bunx playwright test e2e/edge-cases.spec.ts --grep "State Management"
bunx playwright test e2e/edge-cases.spec.ts --grep "Browser Compatibility"
bunx playwright test e2e/edge-cases.spec.ts --grep "Accessibility Edge"
bunx playwright test e2e/edge-cases.spec.ts --grep "Data Integrity"
bunx playwright test e2e/edge-cases.spec.ts --grep "Boundary Conditions"
```

## Debug Failing Tests

```bash
# Run in debug mode (pauses at each step)
bunx playwright test e2e/advanced-features.spec.ts --debug

# Run specific test
bunx playwright test e2e/advanced-features.spec.ts:42

# Run with trace viewer
bunx playwright test e2e/advanced-features.spec.ts --trace on
bunx playwright show-trace trace.zip
```

## Generate Reports

```bash
# Run tests and generate HTML report
bunx playwright test e2e/advanced-features.spec.ts e2e/performance.spec.ts e2e/edge-cases.spec.ts --reporter=html

# View report
bunx playwright show-report
```

## Test Verification Checklist

Before running tests, ensure:
- [ ] Dev server is running on http://localhost:5173
- [ ] Backend API is accessible (if needed)
- [ ] Browsers are installed (`bunx playwright install chromium`)
- [ ] Dependencies are installed (`bun install`)

## Expected Results

### Advanced Features (30 tests)
- ✅ All dashboard workflow tests should pass
- ✅ Full vault CRUD cycle should work
- ✅ Multi-turn chat conversations
- ✅ Complete setup wizard
- ✅ Class management operations
- ✅ Cross-page navigation

### Performance Tests (22 tests)
- ✅ All pages load within performance budgets
- ✅ No memory leaks detected
- ✅ Bundle sizes within limits
- ✅ Web Vitals metrics meet targets

### Edge Cases (34 tests)
- ✅ Input validation prevents invalid data
- ✅ XSS and SQL injection blocked
- ✅ Network errors handled gracefully
- ✅ Keyboard navigation works
- ✅ Data integrity maintained

## Troubleshooting

### Tests timing out
```bash
# Increase timeout
bunx playwright test --timeout=60000
```

### Tests are flaky
```bash
# Run with retries
bunx playwright test --retries=3
```

### Want to see what's happening
```bash
# Run in headed mode with slow motion
bunx playwright test --headed --slow-mo=1000
```

### Need detailed logs
```bash
# Enable debug logging
DEBUG=pw:api bunx playwright test
```

## CI/CD Integration

For continuous integration, use:
```bash
# Full test suite with retries
bunx playwright test --retries=3 --reporter=json,html

# Only new tests
bunx playwright test e2e/advanced-features.spec.ts e2e/performance.spec.ts e2e/edge-cases.spec.ts --retries=3
```

## Performance Benchmarks

Expected execution times (approximate):
- `advanced-features.spec.ts`: 3-5 minutes
- `performance.spec.ts`: 2-4 minutes
- `edge-cases.spec.ts`: 4-6 minutes
- **Total**: 9-15 minutes for all new tests

## Next Steps

1. Run tests locally first
2. Fix any failing tests
3. Review test coverage reports
4. Add tests to CI/CD pipeline
5. Monitor test execution over time
6. Update tests as features change

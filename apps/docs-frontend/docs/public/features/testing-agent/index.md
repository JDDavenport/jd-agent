---
title: Testing Agent
description: Autonomous AI-powered testing agent using GPT-4 Vision to explore and test applications like a human would
---

# Testing Agent

The Testing Agent is an autonomous, AI-powered testing system that uses OpenAI's GPT-4 Vision capabilities to explore and test applications the way a human would. It can see your UI, interact with elements, and intelligently discover issues without pre-written test scripts.

## Overview

Unlike traditional testing frameworks that require explicit test cases, the Testing Agent:

- **Sees your UI** using GPT-4 Vision to analyze screenshots
- **Explores autonomously** making intelligent decisions about what to test
- **Logs findings** including bugs, warnings, and passed scenarios
- **Generates reports** with screenshots and recommendations

## How It Works

1. The agent launches a browser and navigates to your application
2. It takes screenshots and uses GPT-4 Vision to understand the UI
3. Based on what it sees, it decides what actions to take
4. It interacts with elements, fills forms, and navigates pages
5. It logs findings and generates a comprehensive report

## Getting Started

### Running a Test

```typescript
import { createTestingAgent } from './agents/testing/testing-agent';

const agent = createTestingAgent({
  baseUrl: 'http://localhost:5173',
  apiBaseUrl: 'http://localhost:3000',
  testScope: 'full',
  headless: false, // Set to true for CI
});

const result = await agent.runTests();
console.log(`Found ${result.findings.length} issues`);
```

### Test Scopes

| Scope | Description |
|-------|-------------|
| `smoke` | Quick test of major pages for obvious issues |
| `full` | Comprehensive testing of all features |
| `specific` | Test specific pages only |

## Available Tools

The Testing Agent has **18 tools** organized by category:

### Navigation Tools
| Tool | Description |
|------|-------------|
| `navigate_to_page` | Navigate to a specific URL path |
| `click_element` | Click on an element by selector |
| `fill_input` | Fill a form input field |
| `scroll` | Scroll the page or element |
| `wait` | Wait for a specified duration |

### Vision Tools
| Tool | Description |
|------|-------------|
| `take_screenshot` | Capture the current viewport |
| `analyze_screenshot` | Use GPT-4 Vision to analyze what's visible |

### Verification Tools
| Tool | Description |
|------|-------------|
| `verify_text_visible` | Check if specific text is visible |
| `verify_element_exists` | Check if an element exists in the DOM |
| `verify_url` | Verify the current URL matches expected |
| `verify_element_state` | Check element state (visible, enabled, etc.) |
| `get_element_text` | Extract text content from an element |

### API Tools
| Tool | Description |
|------|-------------|
| `api_request` | Make HTTP requests to test APIs |
| `verify_api_response` | Validate API response data |

### Test Control Tools
| Tool | Description |
|------|-------------|
| `log_finding` | Log a bug, warning, or passed check |
| `start_test_scenario` | Begin a named test scenario |
| `end_test_scenario` | Complete a test scenario with result |
| `complete_testing` | Mark testing session as complete |

## Finding Types

The agent categorizes findings by type:

| Type | Description |
|------|-------------|
| `bug` | Definite issue that needs fixing |
| `warning` | Potential issue or concern |
| `suggestion` | Improvement recommendation |
| `pass` | Verified working correctly |

### Severity Levels

For bugs and warnings:
- **Critical** - Application broken, blocking issue
- **High** - Significant problem affecting functionality
- **Medium** - Noticeable issue with workaround
- **Low** - Minor issue or cosmetic problem

## Test Scenarios

The agent organizes tests into scenarios:

```
[TestingAgent] Started scenario: Dashboard Load Test
[TestingAgent] Executing tool: take_screenshot
[TestingAgent] Executing tool: analyze_screenshot
[TestingAgent] Executing tool: verify_text_visible
[TestingAgent] Ended scenario: Dashboard Load Test - PASSED
```

Each scenario captures:
- Name and description
- Start and end times
- All findings within the scenario
- Pass/fail status
- Summary notes

## Generated Reports

After testing completes, the agent generates:

### HTML Report
A visual report with:
- Executive summary
- All findings with screenshots
- Scenario breakdown
- Recommendations

### JSON Report
Machine-readable data for CI integration:
```json
{
  "findings": [...],
  "scenarios": [...],
  "duration": 45000,
  "summary": "Testing complete. Found 3 issues.",
  "recommendations": [...]
}
```

## Configuration

```typescript
interface TestingConfig {
  baseUrl: string;           // Frontend URL to test
  apiBaseUrl?: string;       // API URL for backend tests
  testScope?: 'smoke' | 'full' | 'specific';
  specificPages?: string[];  // Pages to test (for 'specific' scope)
  maxIterations?: number;    // Max agent iterations (default: 50)
  screenshotDir?: string;    // Screenshot output directory
  headless?: boolean;        // Run browser headless (default: true)
  viewport?: {
    width: number;           // Default: 1024
    height: number;          // Default: 768
  };
}
```

### Environment Variables

```bash
OPENAI_API_KEY    # Required for GPT-4 Vision analysis
```

## Architecture

### Components

| Component | Description |
|-----------|-------------|
| `TestingAgent` | Main orchestrator that runs the testing loop |
| `PlaywrightBridge` | Browser automation via Playwright |
| `ScreenshotAnalyzer` | GPT-4 Vision integration for UI analysis |
| `ReportGenerator` | HTML and JSON report generation |

### Testing Loop

```
┌─────────────────────────────────────────────────────┐
│                   Testing Loop                       │
├─────────────────────────────────────────────────────┤
│  1. Take screenshot                                  │
│  2. Send to GPT-4 Vision with system prompt         │
│  3. Receive tool calls from model                   │
│  4. Execute tools (click, fill, verify, etc.)       │
│  5. Return tool results to model                    │
│  6. Repeat until complete or max iterations         │
└─────────────────────────────────────────────────────┘
```

### Rate Limiting

The agent includes retry logic with exponential backoff:
- Initial wait: 5 seconds
- Second retry: 10 seconds
- Third retry: 20 seconds

## Best Practices

### 1. Start with Smoke Tests
Run quick smoke tests first to catch obvious issues before comprehensive testing.

### 2. Use Headless Mode in CI
```typescript
const agent = createTestingAgent({
  ...config,
  headless: true,
});
```

### 3. Set Appropriate Max Iterations
- Smoke test: 15-20 iterations
- Full test: 50+ iterations
- Specific pages: 10-15 per page

### 4. Review Screenshots
Always review the captured screenshots to understand what the agent saw when it found issues.

### 5. Iterate on Findings
Use findings to improve your application, then re-run tests to verify fixes.

## Example Output

```
[TestingAgent] Initializing browser...
[TestingAgent] Starting testing loop...
[TestingAgent] Iteration 1/50
[TestingAgent] Executing tool: take_screenshot
[TestingAgent] Executing tool: analyze_screenshot
[TestingAgent] Started scenario: Dashboard Functionality
[TestingAgent] Executing tool: click_element
[TestingAgent] Executing tool: verify_text_visible
[TestingAgent] Logged bug: Task count not updating
[TestingAgent] Ended scenario: Dashboard Functionality - FAILED
[TestingAgent] Testing complete, generating report...
[TestingAgent] HTML Report: ./test-screenshots/report.html
[TestingAgent] JSON Report: ./test-screenshots/report.json
```

## Limitations

1. **API Rate Limits** - GPT-4 Vision has rate limits; testing may pause during high usage
2. **Dynamic Content** - Rapidly changing content may cause false positives
3. **Authentication** - Complex auth flows may require manual setup
4. **External Services** - Cannot test integrations with third-party services

## Integration with CI/CD

```yaml
# Example GitHub Actions workflow
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    - name: Install dependencies
      run: bun install
    - name: Start application
      run: bun run dev &
    - name: Run Testing Agent
      run: bun run test:agent
      env:
        OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
    - name: Upload Report
      uses: actions/upload-artifact@v3
      with:
        name: test-report
        path: test-screenshots/
```

## API Reference

### Run Tests Programmatically

```typescript
import { createTestingAgent } from './agents/testing/testing-agent';

const agent = createTestingAgent(config);
const result = await agent.runTests();

// Access results
console.log(result.findings);
console.log(result.scenarios);
console.log(result.summary);
console.log(result.recommendations);
```

### TestResult Interface

```typescript
interface TestResult {
  findings: Finding[];
  scenarios: TestScenario[];
  duration: number;
  screenshots: string[];
  summary: string;
  recommendations: string[];
}
```

## Next Steps

- [Configure your first test](/docs/features/testing-agent/configuration)
- [Understanding reports](/docs/features/testing-agent/reports)
- [CI/CD integration](/docs/features/testing-agent/ci-cd)

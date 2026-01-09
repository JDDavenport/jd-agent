/**
 * JD Agent - Testing Agent API Routes
 *
 * API endpoints for running and managing AI-powered tests.
 */

import { Hono } from 'hono';
import { createTestingAgent } from '../../agents/testing';
import type { TestingConfig } from '../../agents/testing';

const testing = new Hono();

// Default configuration
const DEFAULT_CONFIG: Partial<TestingConfig> = {
  baseUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
  screenshotDir: './test-screenshots',
  maxIterations: 50,
  headless: true,
};

/**
 * POST /api/testing/run
 *
 * Run the AI testing agent
 */
testing.post('/run', async (c) => {
  try {
    interface TestRunBody {
      scope?: 'full' | 'smoke' | 'specific';
      pages?: string[];
      maxIterations?: number;
      headless?: boolean;
    }

    const body: TestRunBody = await c.req.json<TestRunBody>().catch(() => ({}));

    const config: TestingConfig = {
      ...DEFAULT_CONFIG,
      baseUrl: DEFAULT_CONFIG.baseUrl!,
      apiBaseUrl: DEFAULT_CONFIG.apiBaseUrl!,
      testScope: body.scope || 'smoke',
      specificPages: body.pages,
      maxIterations: body.maxIterations || DEFAULT_CONFIG.maxIterations,
      headless: body.headless ?? DEFAULT_CONFIG.headless,
    };

    console.log('[Testing API] Starting test run with config:', {
      scope: config.testScope,
      pages: config.specificPages,
      maxIterations: config.maxIterations,
    });

    const agent = createTestingAgent(config);
    const result = await agent.runTests();

    return c.json({
      success: true,
      data: {
        summary: result.summary,
        passed: result.passed,
        failed: result.failed,
        warnings: result.warnings,
        totalFindings: result.findings.length,
        scenarios: result.scenarios.length,
        duration: result.duration,
        recommendations: result.recommendations,
      },
    });
  } catch (error) {
    console.error('[Testing API] Error running tests:', error);
    return c.json(
      {
        success: false,
        error: String(error),
      },
      500
    );
  }
});

/**
 * POST /api/testing/smoke
 *
 * Quick smoke test endpoint
 */
testing.post('/smoke', async (c) => {
  try {
    const config: TestingConfig = {
      ...DEFAULT_CONFIG,
      baseUrl: DEFAULT_CONFIG.baseUrl!,
      apiBaseUrl: DEFAULT_CONFIG.apiBaseUrl!,
      testScope: 'smoke',
      maxIterations: 20, // Fewer iterations for smoke test
    };

    const agent = createTestingAgent(config);
    const result = await agent.runTests();

    return c.json({
      success: true,
      data: {
        summary: result.summary,
        passed: result.passed,
        failed: result.failed,
        findings: result.findings.filter(
          (f) => f.type === 'bug' || f.type === 'fail'
        ),
        duration: result.duration,
      },
    });
  } catch (error) {
    console.error('[Testing API] Error running smoke test:', error);
    return c.json(
      {
        success: false,
        error: String(error),
      },
      500
    );
  }
});

/**
 * GET /api/testing/status
 *
 * Check if testing agent is configured
 */
testing.get('/status', async (c) => {
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

  return c.json({
    success: true,
    data: {
      configured: hasAnthropicKey,
      frontendUrl: DEFAULT_CONFIG.baseUrl,
      apiUrl: DEFAULT_CONFIG.apiBaseUrl,
      screenshotDir: DEFAULT_CONFIG.screenshotDir,
    },
  });
});

export default testing;

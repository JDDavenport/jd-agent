/**
 * JD Agent - Testing Agent API Routes
 *
 * API endpoints for running and managing AI-powered test sessions.
 * Supports parallel execution with session tracking and progress polling.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { testingSessionService } from '../../services/testing-session-service';

const testing = new Hono();

// ============================================
// Validation Schemas
// ============================================

const createSessionSchema = z.object({
  testScope: z.enum(['full', 'smoke', 'specific']).default('smoke'),
  specificPages: z.array(z.string()).optional(),
  maxIterations: z.number().min(1).max(200).optional(),
  headless: z.boolean().optional(),
  baseUrl: z.string().url().optional(),
  apiBaseUrl: z.string().url().optional(),
});

const listSessionsSchema = z.object({
  status: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

// ============================================
// Session Management Routes
// ============================================

/**
 * POST /api/testing/sessions
 * Start one or more test sessions
 */
testing.post('/sessions', async (c) => {
  try {
    const body = await c.req.json();

    // Handle both single session and batch creation
    const sessions = Array.isArray(body) ? body : [body];

    if (sessions.length > 3) {
      return c.json(
        {
          success: false,
          error: 'Maximum 3 sessions can be created at once',
        },
        400
      );
    }

    const results = [];
    const errors = [];

    for (const sessionData of sessions) {
      try {
        const parseResult = createSessionSchema.safeParse(sessionData);
        if (!parseResult.success) {
          errors.push({
            input: sessionData,
            error: parseResult.error.errors.map((e) => e.message).join(', '),
          });
          continue;
        }

        const session = await testingSessionService.create(parseResult.data);
        results.push({
          id: session.id,
          status: session.status,
          testScope: session.testScope,
          jobId: session.jobId,
          createdAt: session.createdAt,
        });
      } catch (err) {
        errors.push({
          input: sessionData,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return c.json(
      {
        success: results.length > 0,
        data: {
          created: results,
          errors: errors.length > 0 ? errors : undefined,
        },
      },
      results.length > 0 ? 201 : 400
    );
  } catch (error) {
    console.error('[Testing API] Error creating sessions:', error);
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
 * GET /api/testing/sessions
 * List all test sessions
 */
testing.get('/sessions', async (c) => {
  try {
    const query = c.req.query();
    const parseResult = listSessionsSchema.safeParse(query);

    if (!parseResult.success) {
      return c.json(
        {
          success: false,
          error: parseResult.error.errors.map((e) => e.message).join(', '),
        },
        400
      );
    }

    const { status, limit, offset } = parseResult.data;

    const sessions = await testingSessionService.list({
      status: status?.split(','),
      limit: limit || 20,
      offset: offset || 0,
    });

    // Get running count for concurrency info
    const runningCount = await testingSessionService.getRunningCount();
    const maxConcurrent = testingSessionService.getMaxConcurrentSessions();

    return c.json({
      success: true,
      data: sessions,
      meta: {
        runningCount,
        maxConcurrent,
        availableSlots: Math.max(0, maxConcurrent - runningCount),
      },
    });
  } catch (error) {
    console.error('[Testing API] Error listing sessions:', error);
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
 * GET /api/testing/sessions/:id
 * Get a specific session's status and results
 */
testing.get('/sessions/:id', async (c) => {
  try {
    const id = c.req.param('id');

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return c.json(
        {
          success: false,
          error: 'Invalid session ID format',
        },
        400
      );
    }

    const session = await testingSessionService.getById(id);

    if (!session) {
      return c.json(
        {
          success: false,
          error: 'Session not found',
        },
        404
      );
    }

    return c.json({
      success: true,
      data: session,
    });
  } catch (error) {
    console.error('[Testing API] Error getting session:', error);
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
 * DELETE /api/testing/sessions/:id
 * Cancel or delete a session
 */
testing.delete('/sessions/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const force = c.req.query('force') === 'true';

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return c.json(
        {
          success: false,
          error: 'Invalid session ID format',
        },
        400
      );
    }

    const session = await testingSessionService.getById(id);
    if (!session) {
      return c.json(
        {
          success: false,
          error: 'Session not found',
        },
        404
      );
    }

    if (force) {
      // Force delete (remove from DB and cleanup files)
      await testingSessionService.delete(id);
      return c.json({
        success: true,
        message: 'Session deleted',
      });
    } else {
      // Cancel if still running
      if (session.status === 'pending' || session.status === 'running') {
        await testingSessionService.cancel(id);
        return c.json({
          success: true,
          message: 'Session cancelled',
        });
      } else {
        return c.json(
          {
            success: false,
            error: `Cannot cancel a ${session.status} session. Use ?force=true to delete.`,
          },
          400
        );
      }
    }
  } catch (error) {
    console.error('[Testing API] Error deleting session:', error);
    return c.json(
      {
        success: false,
        error: String(error),
      },
      500
    );
  }
});

// ============================================
// Legacy Routes (backward compatibility)
// ============================================

/**
 * POST /api/testing/run
 * Legacy: Run tests synchronously (blocks until complete)
 * Deprecated - use /sessions for async execution
 */
testing.post('/run', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));

    // Create session and wait for completion (polling)
    const session = await testingSessionService.create({
      testScope: body.scope || 'smoke',
      specificPages: body.pages,
      maxIterations: body.maxIterations,
      headless: body.headless,
    });

    // Poll for completion (with timeout)
    const timeout = 30 * 60 * 1000; // 30 minutes
    const pollInterval = 2000; // 2 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const current = await testingSessionService.getById(session.id);

      if (!current) {
        return c.json({ success: false, error: 'Session disappeared' }, 500);
      }

      if (current.status === 'completed') {
        return c.json({
          success: true,
          data: {
            summary: current.summary,
            passed: current.passed,
            failed: current.failed,
            warnings: current.warnings,
            totalFindings: current.totalFindings,
            duration: current.durationMs,
            recommendations: current.recommendations,
          },
        });
      }

      if (current.status === 'failed') {
        return c.json(
          {
            success: false,
            error: current.errorMessage || 'Test session failed',
          },
          500
        );
      }

      if (current.status === 'cancelled') {
        return c.json(
          {
            success: false,
            error: 'Test session was cancelled',
          },
          400
        );
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    return c.json(
      {
        success: false,
        error: 'Test session timed out',
        sessionId: session.id, // Return ID so user can check later
      },
      504
    );
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
 * Legacy: Quick smoke test (blocks until complete)
 * Deprecated - use /sessions for async execution
 */
testing.post('/smoke', async (c) => {
  try {
    // Create smoke test session and wait for completion
    const session = await testingSessionService.create({
      testScope: 'smoke',
      maxIterations: 20,
      headless: true,
    });

    // Poll for completion (with timeout)
    const timeout = 10 * 60 * 1000; // 10 minutes for smoke test
    const pollInterval = 2000;
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const current = await testingSessionService.getById(session.id);

      if (!current) {
        return c.json({ success: false, error: 'Session disappeared' }, 500);
      }

      if (current.status === 'completed') {
        // Filter to only bugs and failures for smoke test response
        const result = current.result as any;
        const criticalFindings = result?.findings?.filter(
          (f: any) => f.type === 'bug' || f.type === 'fail'
        );

        return c.json({
          success: true,
          data: {
            summary: current.summary,
            passed: current.passed,
            failed: current.failed,
            findings: criticalFindings || [],
            duration: current.durationMs,
          },
        });
      }

      if (current.status === 'failed') {
        return c.json(
          {
            success: false,
            error: current.errorMessage || 'Smoke test failed',
          },
          500
        );
      }

      if (current.status === 'cancelled') {
        return c.json(
          {
            success: false,
            error: 'Smoke test was cancelled',
          },
          400
        );
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    return c.json(
      {
        success: false,
        error: 'Smoke test timed out',
        sessionId: session.id,
      },
      504
    );
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
 * Check if testing agent is configured
 */
testing.get('/status', async (c) => {
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
  const runningCount = await testingSessionService.getRunningCount();
  const maxConcurrent = testingSessionService.getMaxConcurrentSessions();

  return c.json({
    success: true,
    data: {
      configured: hasOpenAIKey,
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
      apiUrl: process.env.API_BASE_URL || 'http://localhost:3000',
      screenshotDir: './test-screenshots',
      runningSessionCount: runningCount,
      maxConcurrentSessions: maxConcurrent,
      availableSlots: Math.max(0, maxConcurrent - runningCount),
    },
  });
});

export default testing;

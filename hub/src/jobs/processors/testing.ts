/**
 * JD Agent - Testing Session Job Processor
 *
 * Processes AI-powered test sessions in the background.
 * Each job runs a TestingAgent with isolated browser and screenshot storage.
 */

import { Job } from 'bullmq';
import type { TestingSessionJobData } from '../queue';
import { testingSessionService } from '../../services/testing-session-service';
import { TestingAgent } from '../../agents/testing';
import type { TestingConfig, TestResult } from '../../agents/testing';

/**
 * Process a testing session job
 */
export async function processTestingSessionJob(
  job: Job<TestingSessionJobData>
): Promise<TestResult> {
  const { sessionId } = job.data;

  console.log(`[TestingProcessor] Starting session ${sessionId}`);

  // Get session from DB
  const session = await testingSessionService.getById(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }

  // Check if already cancelled
  if (session.status === 'cancelled') {
    console.log(`[TestingProcessor] Session ${sessionId} was cancelled, skipping`);
    throw new Error('Session was cancelled');
  }

  // Mark as running
  await testingSessionService.updateStatus(sessionId, 'running');
  const startedAt = new Date();

  try {
    // Create testing agent with session config
    const config = session.config as TestingConfig;

    // Prefer Ollama (local, free, no rate limits)
    const agent = new TestingAgent({
      ...config,
      visionConfig: {
        preferredProvider: 'ollama',
        fallbackOrder: ['ollama', 'openai', 'anthropic', 'google'],
      },
    });

    // Run the tests
    console.log(`[TestingProcessor] Running tests for session ${sessionId}`);
    console.log(`[TestingProcessor] Config: scope=${config.testScope}, maxIterations=${config.maxIterations}`);

    const result = await agent.runTests();

    // Store results
    await testingSessionService.storeResults(sessionId, result, startedAt);

    console.log(
      `[TestingProcessor] Session ${sessionId} completed: ` +
        `${result.passed} passed, ${result.failed} failed, ${result.warnings} warnings`
    );

    return result;
  } catch (error) {
    console.error(`[TestingProcessor] Session ${sessionId} failed:`, error);

    await testingSessionService.markFailed(
      sessionId,
      error instanceof Error ? error : String(error),
      startedAt
    );

    throw error;
  }
}

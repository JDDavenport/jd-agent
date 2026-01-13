/**
 * JD Agent - Testing Session Service
 *
 * Service for managing AI-powered test sessions.
 * Supports parallel execution with isolated browser instances and screenshot storage.
 */

import { db } from '../db/client';
import { testSessions } from '../db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { addTestingSessionJob } from '../jobs/queue';
import type { TestingConfig, TestResult } from '../agents/testing';
import * as path from 'path';
import * as fs from 'fs';

const MAX_CONCURRENT_SESSIONS = 3;
const SCREENSHOT_BASE_DIR = './test-screenshots';

// ============================================
// Types
// ============================================

export interface CreateSessionInput {
  testScope: 'full' | 'smoke' | 'specific';
  specificPages?: string[];
  maxIterations?: number;
  headless?: boolean;
  baseUrl?: string;
  apiBaseUrl?: string;
}

export interface SessionProgress {
  currentIteration: number;
  maxIterations: number;
  currentPage?: string;
  scenariosCompleted: number;
  findingsCount: number;
}

export type TestSessionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

// ============================================
// Service
// ============================================

export const testingSessionService = {
  /**
   * Create a new test session and queue it for execution
   */
  async create(input: CreateSessionInput) {
    // Check concurrent session limit
    const runningCount = await this.getRunningCount();
    if (runningCount >= MAX_CONCURRENT_SESSIONS) {
      throw new Error(
        `Maximum concurrent sessions reached (${MAX_CONCURRENT_SESSIONS}). ` +
          `Please wait for existing sessions to complete.`
      );
    }

    // Create isolated screenshot directory
    const sessionId = crypto.randomUUID();
    const screenshotDir = path.join(SCREENSHOT_BASE_DIR, `session-${sessionId}`);

    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    // Build config
    const config: TestingConfig = {
      baseUrl: input.baseUrl || process.env.FRONTEND_URL || 'http://localhost:5173',
      apiBaseUrl: input.apiBaseUrl || process.env.API_BASE_URL || 'http://localhost:3000',
      testScope: input.testScope,
      specificPages: input.specificPages,
      maxIterations: input.maxIterations || 50,
      headless: input.headless ?? true,
      screenshotDir,
    };

    // Insert session record
    const [session] = await db
      .insert(testSessions)
      .values({
        id: sessionId,
        status: 'pending',
        config,
        baseUrl: config.baseUrl,
        apiBaseUrl: config.apiBaseUrl,
        testScope: input.testScope,
        specificPages: input.specificPages,
        maxIterations: config.maxIterations,
        headless: config.headless,
        screenshotDir,
        progress: {
          currentIteration: 0,
          maxIterations: config.maxIterations,
          scenariosCompleted: 0,
          findingsCount: 0,
        },
      })
      .returning();

    // Queue the job
    const job = await addTestingSessionJob({ sessionId });

    // Update with job ID
    await db
      .update(testSessions)
      .set({ jobId: job.id })
      .where(eq(testSessions.id, sessionId));

    return { ...session, jobId: job.id };
  },

  /**
   * Get a session by ID
   */
  async getById(id: string) {
    const [session] = await db
      .select()
      .from(testSessions)
      .where(eq(testSessions.id, id))
      .limit(1);
    return session;
  },

  /**
   * List sessions with optional status filter
   */
  async list(options?: { status?: string | string[]; limit?: number; offset?: number }) {
    let query = db.select().from(testSessions);

    if (options?.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      query = query.where(inArray(testSessions.status, statuses)) as typeof query;
    }

    query = query.orderBy(desc(testSessions.createdAt)) as typeof query;

    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }
    if (options?.offset) {
      query = query.offset(options.offset) as typeof query;
    }

    return query;
  },

  /**
   * Get count of running sessions
   */
  async getRunningCount(): Promise<number> {
    const running = await db
      .select()
      .from(testSessions)
      .where(inArray(testSessions.status, ['pending', 'running']));
    return running.length;
  },

  /**
   * Update session status
   */
  async updateStatus(
    id: string,
    status: TestSessionStatus,
    updates?: Partial<typeof testSessions.$inferInsert>
  ) {
    const statusUpdates: Partial<typeof testSessions.$inferInsert> = {
      status,
      ...updates,
    };

    if (status === 'running') {
      statusUpdates.startedAt = new Date();
    }

    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      statusUpdates.completedAt = new Date();
    }

    await db.update(testSessions).set(statusUpdates).where(eq(testSessions.id, id));
  },

  /**
   * Update session progress
   */
  async updateProgress(id: string, progress: SessionProgress) {
    await db
      .update(testSessions)
      .set({
        progress,
        currentIteration: progress.currentIteration,
      })
      .where(eq(testSessions.id, id));
  },

  /**
   * Store completed results
   */
  async storeResults(id: string, result: TestResult, startedAt: Date) {
    const durationMs = Date.now() - startedAt.getTime();

    await db
      .update(testSessions)
      .set({
        status: 'completed',
        completedAt: new Date(),
        durationMs,
        result,
        passed: result.passed,
        failed: result.failed,
        warnings: result.warnings,
        totalFindings: result.findings.length,
        summary: result.summary,
        recommendations: result.recommendations,
        screenshotPaths: result.screenshots,
      })
      .where(eq(testSessions.id, id));
  },

  /**
   * Mark session as failed
   */
  async markFailed(id: string, error: Error | string, startedAt?: Date) {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorStack = typeof error === 'string' ? undefined : error.stack;

    await db
      .update(testSessions)
      .set({
        status: 'failed',
        completedAt: new Date(),
        durationMs: startedAt ? Date.now() - startedAt.getTime() : undefined,
        errorMessage,
        errorStack,
      })
      .where(eq(testSessions.id, id));
  },

  /**
   * Cancel a session
   */
  async cancel(id: string) {
    const session = await this.getById(id);
    if (!session) {
      throw new Error(`Session ${id} not found`);
    }

    if (session.status === 'completed' || session.status === 'failed') {
      throw new Error(`Cannot cancel a ${session.status} session`);
    }

    await this.updateStatus(id, 'cancelled');

    return { cancelled: true };
  },

  /**
   * Delete a session and its screenshots
   */
  async delete(id: string) {
    const session = await this.getById(id);
    if (!session) {
      throw new Error(`Session ${id} not found`);
    }

    // Clean up screenshot directory
    if (session.screenshotDir && fs.existsSync(session.screenshotDir)) {
      fs.rmSync(session.screenshotDir, { recursive: true, force: true });
    }

    await db.delete(testSessions).where(eq(testSessions.id, id));
    return { deleted: true };
  },

  /**
   * Get the maximum concurrent sessions limit
   */
  getMaxConcurrentSessions(): number {
    return MAX_CONCURRENT_SESSIONS;
  },
};

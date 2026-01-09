/**
 * Goal Vault Integration API Routes
 *
 * Endpoints for integrating goals with the vault.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { goalVaultIntegration } from '../../services/goal-vault-integration';
import { ValidationError, NotFoundError } from '../middleware/error-handler';

const goalVaultRouter = new Hono();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const createNoteSchema = z.object({
  goalId: z.string().uuid('Invalid goal ID'),
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  tags: z.array(z.string()).optional(),
});

// ============================================
// ROUTES
// ============================================

/**
 * POST /api/goal-vault/export/journey/:goalId
 * Export a goal's complete journey to the vault
 */
goalVaultRouter.post('/export/journey/:goalId', async (c) => {
  const goalId = c.req.param('goalId');
  const result = await goalVaultIntegration.exportGoalJourney(goalId);

  if (!result) {
    throw new NotFoundError('Goal');
  }

  return c.json({
    success: true,
    data: result,
    message: 'Goal journey exported to vault',
  });
});

/**
 * POST /api/goal-vault/export/reflection/:reflectionId
 * Export a single reflection to the vault
 */
goalVaultRouter.post('/export/reflection/:reflectionId', async (c) => {
  const reflectionId = c.req.param('reflectionId');
  const result = await goalVaultIntegration.exportReflection(reflectionId);

  if (!result) {
    throw new NotFoundError('Reflection');
  }

  return c.json({
    success: true,
    data: result,
    message: 'Reflection exported to vault',
  });
});

/**
 * POST /api/goal-vault/export/completed
 * Export all completed goals to vault
 */
goalVaultRouter.post('/export/completed', async (c) => {
  const result = await goalVaultIntegration.exportCompletedGoals();

  return c.json({
    success: true,
    data: result,
    message: `Exported ${result.exported} completed goals to vault`,
  });
});

/**
 * GET /api/goal-vault/entries/:goalId
 * Get vault entries related to a goal
 */
goalVaultRouter.get('/entries/:goalId', async (c) => {
  const goalId = c.req.param('goalId');
  const entries = await goalVaultIntegration.getVaultEntriesForGoal(goalId);

  return c.json({
    success: true,
    data: entries,
    count: entries.length,
  });
});

/**
 * POST /api/goal-vault/note
 * Create a quick note linked to a goal
 */
goalVaultRouter.post('/note', async (c) => {
  const body = await c.req.json();
  const parseResult = createNoteSchema.safeParse(body);

  if (!parseResult.success) {
    throw new ValidationError(parseResult.error.errors.map((e) => e.message).join(', '));
  }

  const { goalId, title, content, tags } = parseResult.data;

  try {
    const result = await goalVaultIntegration.createGoalNote(goalId, title, content, tags);
    return c.json(
      {
        success: true,
        data: result,
        message: 'Note created and linked to goal',
      },
      201
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Goal not found') {
      throw new NotFoundError('Goal');
    }
    throw error;
  }
});

/**
 * GET /api/goal-vault/from-entry/:vaultEntryId
 * Get goal from vault entry reference
 */
goalVaultRouter.get('/from-entry/:vaultEntryId', async (c) => {
  const vaultEntryId = c.req.param('vaultEntryId');
  const goal = await goalVaultIntegration.getGoalFromVaultEntry(vaultEntryId);

  if (!goal) {
    return c.json({
      success: true,
      data: null,
      message: 'No goal linked to this vault entry',
    });
  }

  return c.json({
    success: true,
    data: goal,
  });
});

export { goalVaultRouter };

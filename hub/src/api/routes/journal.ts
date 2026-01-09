import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { dailyJournalService } from '../../services/daily-journal-service';

const journalRouter = new Hono();

// ============================================
// VALIDATION SCHEMAS
// ============================================

const saveReviewSchema = z.object({
  id: z.string().uuid(),
  journalText: z.string().optional(),
  mood: z.enum(['great', 'good', 'okay', 'difficult', 'terrible']).optional(),
  tags: z.array(z.string()).optional(),
  tasksReviewed: z
    .array(
      z.object({
        taskId: z.string().uuid(),
        taskTitle: z.string(),
        completedAt: z.string().optional(),
        projectName: z.string().optional(),
        reflectionNote: z.string().optional(),
      })
    )
    .optional(),
  classesReviewed: z
    .array(
      z.object({
        classId: z.string().uuid(),
        className: z.string(),
        pageId: z.string().uuid().optional(),
        reflectionNote: z.string().optional(),
      })
    )
    .optional(),
  currentStep: z.number().min(1).max(7).optional(),
});

const completeReviewSchema = z.object({
  id: z.string().uuid(),
  journalText: z.string(),
  mood: z.enum(['great', 'good', 'okay', 'difficult', 'terrible']),
  tags: z.array(z.string()),
  reviewDurationSeconds: z.number().min(0),
});

const toggleHabitSchema = z.object({
  date: z.string().optional(),
});

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/journal/daily-review
 * Get all data needed for a daily review (habits, goals, tasks, etc.)
 * Query params:
 *   - date: YYYY-MM-DD (defaults to today)
 */
journalRouter.get('/daily-review', async (c) => {
  const date = c.req.query('date') || new Date().toISOString().split('T')[0];

  try {
    const data = await dailyJournalService.getReviewData(date);
    return c.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching daily review data:', error);
    return c.json(
      { success: false, error: { message: 'Failed to fetch review data' } },
      500
    );
  }
});

/**
 * POST /api/journal/daily-review/save
 * Auto-save review draft
 */
journalRouter.post(
  '/daily-review/save',
  zValidator('json', saveReviewSchema),
  async (c) => {
    const input = c.req.valid('json');

    try {
      const review = await dailyJournalService.saveReviewDraft(input);
      return c.json({ success: true, data: review });
    } catch (error) {
      console.error('Error saving review draft:', error);
      return c.json(
        { success: false, error: { message: 'Failed to save review' } },
        500
      );
    }
  }
);

/**
 * POST /api/journal/daily-review/complete
 * Complete a review and save to vault
 */
journalRouter.post(
  '/daily-review/complete',
  zValidator('json', completeReviewSchema),
  async (c) => {
    const input = c.req.valid('json');

    try {
      const result = await dailyJournalService.completeReview(input);
      return c.json({ success: true, data: result });
    } catch (error) {
      console.error('Error completing review:', error);
      return c.json(
        { success: false, error: { message: 'Failed to complete review' } },
        500
      );
    }
  }
);

/**
 * GET /api/journal/daily-review/history
 * Get paginated review history
 * Query params:
 *   - page: Page number (default 1)
 *   - limit: Items per page (default 20)
 */
journalRouter.get('/daily-review/history', async (c) => {
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = parseInt(c.req.query('limit') || '20', 10);

  try {
    const history = await dailyJournalService.getReviewHistory(page, limit);
    return c.json({ success: true, data: history });
  } catch (error) {
    console.error('Error fetching review history:', error);
    return c.json(
      { success: false, error: { message: 'Failed to fetch history' } },
      500
    );
  }
});

/**
 * GET /api/journal/daily-review/search
 * Search through journal entries
 * Query params:
 *   - q: Search query
 */
journalRouter.get('/daily-review/search', async (c) => {
  const query = c.req.query('q');

  if (!query) {
    return c.json(
      { success: false, error: { message: 'Search query required' } },
      400
    );
  }

  try {
    const results = await dailyJournalService.searchReviews(query);
    return c.json({ success: true, data: results });
  } catch (error) {
    console.error('Error searching reviews:', error);
    return c.json(
      { success: false, error: { message: 'Failed to search reviews' } },
      500
    );
  }
});

/**
 * POST /api/journal/habits/:habitId/toggle
 * Toggle habit completion during review
 * Query params:
 *   - date: YYYY-MM-DD (defaults to today)
 */
journalRouter.post('/habits/:habitId/toggle', async (c) => {
  const habitId = c.req.param('habitId');
  const date = c.req.query('date') || new Date().toISOString().split('T')[0];

  try {
    const result = await dailyJournalService.toggleHabitCompletion(habitId, date);
    return c.json({ success: true, data: result });
  } catch (error) {
    console.error('Error toggling habit:', error);
    return c.json(
      { success: false, error: { message: 'Failed to toggle habit' } },
      500
    );
  }
});

/**
 * POST /api/journal/daily-review/:id/update-metrics
 * Update habit/goal metrics for a review
 */
journalRouter.post('/daily-review/:id/update-metrics', async (c) => {
  const id = c.req.param('id');
  const date = c.req.query('date') || new Date().toISOString().split('T')[0];

  try {
    await dailyJournalService.updateReviewMetrics(id, date);
    return c.json({ success: true, message: 'Metrics updated' });
  } catch (error) {
    console.error('Error updating metrics:', error);
    return c.json(
      { success: false, error: { message: 'Failed to update metrics' } },
      500
    );
  }
});

export { journalRouter };

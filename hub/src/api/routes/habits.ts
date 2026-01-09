import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { habitService, parseHabitInput } from '../../services/habit-service';

const habitsRouter = new Hono();

// Validation schemas
const createHabitSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  goalId: z.string().uuid().optional(),
  frequency: z.enum(['daily', 'weekly', 'specific_days']).optional(),
  frequencyDays: z.array(z.number().min(0).max(6)).optional(),
  timesPerWeek: z.number().min(1).max(7).optional(),
  timeOfDay: z.enum(['morning', 'afternoon', 'evening', 'anytime']).optional(),
  cueHabit: z.string().optional(),
  specificTime: z.string().optional(),
  area: z.string().optional(),
  lifeArea: z.enum(['spiritual', 'personal', 'fitness', 'family', 'professional', 'school']).optional(),
  context: z.string().optional(),
  targetPerDay: z.number().min(1).optional(),
  autoCreateTask: z.boolean().optional(),
  taskTemplate: z.string().optional(),
});

const updateHabitSchema = createHabitSchema.partial().extend({
  isActive: z.boolean().optional(),
  pausedUntil: z.string().nullable().optional(),
});

const completeHabitSchema = z.object({
  date: z.string().optional(),
  notes: z.string().optional(),
});

const skipHabitSchema = z.object({
  date: z.string().optional(),
  reason: z.enum(['rest_day', 'sick', 'travel', 'other']).optional(),
});

const naturalLanguageSchema = z.object({
  input: z.string().min(1),
  goalId: z.string().uuid().optional(),
});

// ============================================
// ROUTES
// ============================================

/**
 * GET /api/habits
 * List all habits with optional filters
 */
habitsRouter.get('/', async (c) => {
  const isActive = c.req.query('isActive');
  const goalId = c.req.query('goalId');
  const area = c.req.query('area') || c.req.query('lifeArea');

  const habits = await habitService.list({
    isActive: isActive !== undefined ? isActive === 'true' : undefined,
    goalId,
    area,
  });

  // Add lifeArea field for frontend compatibility
  const habitsWithLifeArea = habits.map(h => ({ ...h, lifeArea: h.area }));
  return c.json({ success: true, data: habitsWithLifeArea });
});

/**
 * GET /api/habits/today
 * Get today's habits with completion status
 */
habitsRouter.get('/today', async (c) => {
  const habits = await habitService.getTodaysHabits();
  // Add lifeArea field for frontend compatibility
  const habitsWithLifeArea = habits.map(h => ({ ...h, lifeArea: h.area }));
  return c.json({ success: true, data: habitsWithLifeArea });
});

/**
 * GET /api/habits/stats
 * Get overall habit statistics
 */
habitsRouter.get('/stats', async (c) => {
  const stats = await habitService.getOverallStats();
  return c.json({ success: true, data: stats });
});

/**
 * POST /api/habits/parse
 * Parse natural language input without creating (preview)
 */
habitsRouter.post('/parse', zValidator('json', z.object({ input: z.string() })), async (c) => {
  const { input } = c.req.valid('json');
  const parsed = parseHabitInput(input);
  return c.json({ success: true, data: parsed });
});

/**
 * POST /api/habits/natural
 * Create habit from natural language input
 * Example: "Upper body every monday and tuesday @gym #health"
 */
habitsRouter.post('/natural', zValidator('json', naturalLanguageSchema), async (c) => {
  const { input, goalId } = c.req.valid('json');
  const habit = await habitService.createFromNaturalLanguage(input, goalId);
  return c.json({ success: true, data: { ...habit, lifeArea: habit.area } }, 201);
});

/**
 * GET /api/habits/:id
 * Get single habit by ID
 */
habitsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  const habit = await habitService.getById(id);

  if (!habit) {
    return c.json({ success: false, error: 'Habit not found' }, 404);
  }

  return c.json({ success: true, data: { ...habit, lifeArea: habit.area } });
});

/**
 * GET /api/habits/:id/stats
 * Get weekly stats for a habit
 */
habitsRouter.get('/:id/stats', async (c) => {
  const id = c.req.param('id');
  const stats = await habitService.getWeeklyStats(id);
  return c.json({ success: true, data: stats });
});

/**
 * GET /api/habits/:id/streak
 * Get streak info for a habit
 */
habitsRouter.get('/:id/streak', async (c) => {
  const id = c.req.param('id');
  const habit = await habitService.getById(id);

  if (!habit) {
    return c.json({ success: false, error: 'Habit not found' }, 404);
  }

  // Get most recent completion for lastCompletedAt
  const completions = await habitService.getCompletions(id, 1);
  const lastCompletion = completions.length > 0 ? completions[0] : null;

  return c.json({
    success: true,
    data: {
      currentStreak: habit.currentStreak,
      longestStreak: habit.longestStreak,
      lastCompletedAt: lastCompletion?.completedAt || null,
    },
  });
});

/**
 * GET /api/habits/:id/completions
 * Get completions for a habit
 */
habitsRouter.get('/:id/completions', async (c) => {
  const id = c.req.param('id');
  const limit = parseInt(c.req.query('limit') || '30', 10);

  const completions = await habitService.getCompletions(id, limit);

  return c.json({
    success: true,
    data: completions,
    count: completions.length,
  });
});

/**
 * POST /api/habits
 * Create a new habit
 */
habitsRouter.post('/', zValidator('json', createHabitSchema), async (c) => {
  const { lifeArea, ...rest } = c.req.valid('json');
  // Map lifeArea to area for the service
  const input = {
    ...rest,
    area: lifeArea || rest.area,
  };
  const habit = await habitService.create(input);
  // Return with lifeArea field for frontend compatibility
  return c.json({ success: true, data: { ...habit, lifeArea: habit.area } }, 201);
});

/**
 * PATCH /api/habits/:id
 * Update a habit
 */
habitsRouter.patch('/:id', zValidator('json', updateHabitSchema), async (c) => {
  const id = c.req.param('id');
  const { lifeArea, ...rest } = c.req.valid('json');
  const input = {
    ...rest,
    area: lifeArea || rest.area,
  };
  const habit = await habitService.update(id, input);

  if (!habit) {
    return c.json({ success: false, error: 'Habit not found' }, 404);
  }

  return c.json({ success: true, data: { ...habit, lifeArea: habit.area } });
});

/**
 * DELETE /api/habits/:id
 * Delete a habit
 */
habitsRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const deleted = await habitService.delete(id);

  if (!deleted) {
    return c.json({ success: false, error: 'Habit not found' }, 404);
  }

  return c.json({ success: true });
});

/**
 * POST /api/habits/:id/complete
 * Mark habit as completed for today (or specified date)
 */
habitsRouter.post('/:id/complete', zValidator('json', completeHabitSchema), async (c) => {
  const id = c.req.param('id');
  const { date, notes } = c.req.valid('json');

  const habit = await habitService.getById(id);
  if (!habit) {
    return c.json({ success: false, error: 'Habit not found' }, 404);
  }

  const completion = await habitService.complete(id, date, notes);

  // Get updated habit with new streak
  const updatedHabit = await habitService.getById(id);

  return c.json({
    success: true,
    data: {
      completion,
      habit: updatedHabit ? { ...updatedHabit, lifeArea: updatedHabit.area } : null,
    },
    message: `Completed! Current streak: ${updatedHabit?.currentStreak || 0} days`,
  });
});

/**
 * POST /api/habits/:id/skip
 * Skip habit for today (intentional skip doesn't break streak)
 */
habitsRouter.post('/:id/skip', zValidator('json', skipHabitSchema), async (c) => {
  const id = c.req.param('id');
  const { date, reason } = c.req.valid('json');

  const habit = await habitService.getById(id);
  if (!habit) {
    return c.json({ success: false, error: 'Habit not found' }, 404);
  }

  const completion = await habitService.skip(id, date, reason);

  return c.json({
    success: true,
    data: { completion },
    message: 'Habit skipped - streak preserved',
  });
});

/**
 * GET /api/habits/goal/:goalId
 * Get all habits linked to a specific goal
 */
habitsRouter.get('/goal/:goalId', async (c) => {
  const goalId = c.req.param('goalId');
  const habits = await habitService.getHabitsForGoal(goalId);
  const habitsWithLifeArea = habits.map(h => ({ ...h, lifeArea: h.area }));
  return c.json({ success: true, data: habitsWithLifeArea });
});

export { habitsRouter };

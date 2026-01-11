# Goals & Habits System - Implementation Plan

> **Created:** January 8, 2026
> **Status:** Ready for Implementation
> **PRD Reference:** See `goals-habits-prd.md`

---

## Executive Summary

This plan details the implementation of an enhanced Goals & Habits system that builds on the existing foundation. The system will:
1. Standardize on 6 fixed life areas with color-coding
2. Add milestones and reflections for goal tracking
3. Enable habit-to-task generation
4. Create a unified progress dashboard
5. Add AI coaching capabilities
6. Enhance ceremony integration

---

## Gap Analysis: What Exists vs. What's Needed

### Currently Implemented

| Component | Status | Location |
|-----------|--------|----------|
| Goals table | Partial | `hub/src/db/schema.ts:788-813` |
| Goals service | Basic CRUD | `hub/src/services/goals-service.ts` |
| Goals routes | Basic CRUD | `hub/src/api/routes/goals.ts` |
| Habits table | Good | `hub/src/db/schema.ts:845-889` |
| HabitCompletions table | Good | `hub/src/db/schema.ts:891-911` |
| Habits service | Comprehensive | `hub/src/services/habit-service.ts` (679 lines) |
| Habits routes | Basic | `hub/src/api/routes/habits.ts` |
| Ceremony integration | Partial | `hub/src/services/ceremony-service.ts` |

### What Needs to Be Added

| Component | Priority | Complexity |
|-----------|----------|------------|
| Life areas standardization | High | Low |
| Goals schema enhancements | High | Medium |
| Milestones table | High | Medium |
| Goal tasks linking table | Medium | Low |
| Habit tasks linking table | Medium | Low |
| Goal reflections table | Medium | Low |
| Progress service | High | Medium |
| AI Coach service | Medium | High |
| Habit task generator job | High | Medium |
| Enhanced ceremony integration | Medium | Low |
| Dashboard widget data | Medium | Medium |

---

## Implementation Phases

### Phase 1: Schema & Data Layer

**Objective:** Extend database schema with new tables and fields

#### 1.1 Life Areas Constants
Create a shared constants file for the 6 fixed life areas:

```typescript
// hub/src/constants/life-areas.ts
export const LIFE_AREAS = {
  spiritual: { name: 'Spiritual', icon: '🙏', color: '#8B5CF6' },
  personal: { name: 'Personal', icon: '🧠', color: '#3B82F6' },
  fitness: { name: 'Fitness', icon: '💪', color: '#10B981' },
  family: { name: 'Family', icon: '👨‍👩‍👧‍👦', color: '#F59E0B' },
  professional: { name: 'Professional', icon: '💼', color: '#6366F1' },
  school: { name: 'School', icon: '🎓', color: '#EC4899' },
} as const;

export type LifeArea = keyof typeof LIFE_AREAS;
```

#### 1.2 Goals Schema Enhancements
Add new fields to the existing goals table:

```sql
-- New columns for goals table
ALTER TABLE goals ADD COLUMN goal_type TEXT DEFAULT 'achievement';
ALTER TABLE goals ADD COLUMN motivation TEXT;
ALTER TABLE goals ADD COLUMN vision TEXT;
ALTER TABLE goals ADD COLUMN progress_percentage REAL DEFAULT 0;
ALTER TABLE goals ADD COLUMN vault_entry_id UUID REFERENCES vault_entries(id);

-- Update area column to use life_area enum
-- (keep backward compatible - migrate existing values)
```

#### 1.3 New Tables

**milestones:**
```typescript
export const milestones = pgTable('milestones', {
  id: uuid('id').primaryKey().defaultRandom(),
  goalId: uuid('goal_id').references(() => goals.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  targetDate: date('target_date'),
  orderIndex: integer('order_index').notNull().default(0),
  status: text('status').default('pending').notNull(), // pending, in_progress, completed, skipped
  completedAt: timestamp('completed_at', { withTimezone: true }),
  evidence: text('evidence'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('milestones_goal_idx').on(table.goalId),
  index('milestones_status_idx').on(table.status),
]);
```

**goal_tasks:**
```typescript
export const goalTasks = pgTable('goal_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  goalId: uuid('goal_id').references(() => goals.id, { onDelete: 'cascade' }),
  milestoneId: uuid('milestone_id').references(() => milestones.id, { onDelete: 'cascade' }),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('goal_tasks_goal_idx').on(table.goalId),
  index('goal_tasks_milestone_idx').on(table.milestoneId),
  index('goal_tasks_task_idx').on(table.taskId),
]);
```

**habit_tasks:**
```typescript
export const habitTasks = pgTable('habit_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  habitId: uuid('habit_id').references(() => habits.id, { onDelete: 'cascade' }).notNull(),
  taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }).notNull(),
  scheduledDate: date('scheduled_date').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('habit_tasks_habit_idx').on(table.habitId),
  index('habit_tasks_date_idx').on(table.scheduledDate),
]);
```

**goal_reflections:**
```typescript
export const goalReflections = pgTable('goal_reflections', {
  id: uuid('id').primaryKey().defaultRandom(),
  goalId: uuid('goal_id').references(() => goals.id, { onDelete: 'cascade' }).notNull(),
  content: text('content').notNull(),
  reflectionType: text('reflection_type').default('progress').notNull(), // progress, obstacle, win, adjustment
  sentiment: text('sentiment'), // positive, neutral, negative, mixed
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('goal_reflections_goal_idx').on(table.goalId),
  index('goal_reflections_type_idx').on(table.reflectionType),
]);
```

#### 1.4 Migration Script
Create: `hub/src/db/migrations/0001_goals_habits_v2.sql`

**Tasks:**
- [ ] Create `hub/src/constants/life-areas.ts`
- [ ] Update `hub/src/db/schema.ts` with new tables
- [ ] Create migration file
- [ ] Run `bun run db:push`
- [ ] Verify tables exist in database

---

### Phase 2: Service Layer Enhancements

#### 2.1 Enhanced Goals Service

**File:** `hub/src/services/goals-service.ts`

New methods to add:
```typescript
// Get goal with all relations (habits, milestones, reflections)
async getByIdWithRelations(id: string): Promise<GoalWithRelations | null>

// Get goals grouped by life area with stats
async getByLifeArea(): Promise<LifeAreaProgress[]>

// Calculate progress from milestones/habits
async recalculateProgress(id: string): Promise<Goal>

// Get goal health score
async calculateHealthScore(goal: GoalWithRelations): Promise<number>

// Get goals needing attention (behind schedule, low health)
async getNeedingAttention(): Promise<Goal[]>
```

#### 2.2 Milestones Service

**File:** `hub/src/services/milestones-service.ts` (NEW)

```typescript
class MilestonesService {
  async create(input: CreateMilestoneInput): Promise<Milestone>
  async getById(id: string): Promise<Milestone | null>
  async listByGoal(goalId: string): Promise<Milestone[]>
  async update(id: string, input: UpdateMilestoneInput): Promise<Milestone | null>
  async delete(id: string): Promise<boolean>
  async complete(id: string, evidence?: string): Promise<Milestone>
  async reorder(goalId: string, milestoneIds: string[]): Promise<void>
  async linkTask(milestoneId: string, taskId: string): Promise<void>
  async getLinkedTasks(milestoneId: string): Promise<Task[]>
}
```

#### 2.3 Progress Service

**File:** `hub/src/services/progress-service.ts` (NEW)

```typescript
class ProgressService {
  // Dashboard overview data
  async getOverview(): Promise<ProgressOverview>

  // Weekly report
  async getWeeklyReport(): Promise<WeeklyReport>

  // Progress by life area
  async getByLifeArea(area: LifeArea): Promise<LifeAreaDetail>

  // Aggregate habit stats for dashboard
  async getHabitDashboard(): Promise<HabitDashboard>

  // Get streak leaderboard
  async getTopStreaks(limit?: number): Promise<HabitStreak[]>

  // Get upcoming milestones
  async getUpcomingMilestones(days?: number): Promise<Milestone[]>
}

interface ProgressOverview {
  todaysHabits: { completed: number; total: number; percentage: number }
  byArea: Array<{
    area: LifeArea
    name: string
    icon: string
    color: string
    progressPercentage: number
    activeGoals: number
    completedGoals: number
  }>
  topStreaks: Array<{ habitTitle: string; streak: number }>
  needsAttention: Array<{ goalTitle: string; reason: string }>
}
```

#### 2.4 Reflections Service

**File:** `hub/src/services/reflections-service.ts` (NEW)

```typescript
class ReflectionsService {
  async create(goalId: string, input: CreateReflectionInput): Promise<Reflection>
  async listByGoal(goalId: string): Promise<Reflection[]>
  async delete(id: string): Promise<boolean>
  async getRecentByArea(area: LifeArea, days?: number): Promise<Reflection[]>
}
```

#### 2.5 AI Goal Coach Service

**File:** `hub/src/services/ai-goal-coach.ts` (NEW)

```typescript
class AIGoalCoachService {
  // Decompose a goal into suggested habits and milestones
  async decomposeGoal(goal: Goal): Promise<GoalDecomposition>

  // Review goal progress and suggest adjustments
  async reviewGoal(goalId: string): Promise<GoalReview>

  // Suggest habits for a life area
  async suggestHabits(area: LifeArea, context?: string): Promise<HabitSuggestion[]>
}

interface GoalDecomposition {
  suggestedHabits: CreateHabitInput[]
  suggestedMilestones: CreateMilestoneInput[]
  timelineAssessment: string
  recommendations: string[]
}
```

**Tasks:**
- [ ] Enhance `goals-service.ts` with new methods
- [ ] Create `milestones-service.ts`
- [ ] Create `progress-service.ts`
- [ ] Create `reflections-service.ts`
- [ ] Create `ai-goal-coach.ts`
- [ ] Add types to `hub/src/types/index.ts`

---

### Phase 3: API Routes

#### 3.1 Enhanced Goals Routes

**File:** `hub/src/api/routes/goals.ts`

Add endpoints:
```typescript
// GET /api/goals/:id?relations=true - Get goal with all relations
// GET /api/goals/:id/report - Detailed goal report with health score
// POST /api/goals/:id/recalculate - Recalculate progress
// POST /api/goals/:id/reflections - Add a reflection
// GET /api/goals/:id/reflections - Get reflections for goal
```

#### 3.2 Milestones Routes

**File:** `hub/src/api/routes/milestones.ts` (NEW)

```typescript
GET    /api/milestones?goal_id=X     // List milestones for a goal
GET    /api/milestones/:id            // Get single milestone
POST   /api/milestones                // Create milestone
PATCH  /api/milestones/:id            // Update milestone
DELETE /api/milestones/:id            // Delete milestone
POST   /api/milestones/:id/complete   // Mark complete with evidence
POST   /api/milestones/:id/link-task  // Link task to milestone
POST   /api/milestones/reorder        // Reorder milestones
```

#### 3.3 Progress Routes

**File:** `hub/src/api/routes/progress.ts` (NEW)

```typescript
GET /api/progress/overview        // Full dashboard data
GET /api/progress/weekly          // Weekly report
GET /api/progress/area/:area      // Detailed progress for one life area
GET /api/progress/streaks         // Top habit streaks
```

#### 3.4 AI Coaching Routes

**File:** `hub/src/api/routes/ai-coaching.ts` (NEW)

```typescript
POST /api/goals/ai/decompose      // AI breaks goal into habits + milestones
POST /api/goals/ai/review         // AI reviews goal progress
POST /api/habits/ai/suggest       // AI suggests habits for an area
```

#### 3.5 Register Routes

Update `hub/src/index.ts`:
```typescript
import { milestonesRouter } from './api/routes/milestones';
import { progressRouter } from './api/routes/progress';
import { aiCoachingRouter } from './api/routes/ai-coaching';

app.route('/api/milestones', milestonesRouter);
app.route('/api/progress', progressRouter);
app.route('/api/goals/ai', aiCoachingRouter);
```

**Tasks:**
- [ ] Enhance goals.ts routes
- [ ] Create milestones.ts routes
- [ ] Create progress.ts routes
- [ ] Create ai-coaching.ts routes
- [ ] Register all routes in index.ts

---

### Phase 4: Integration Layer

#### 4.1 Habit Task Generator Job

**File:** `hub/src/jobs/habit-task-generator.ts` (NEW)

```typescript
/**
 * Scheduled job that runs at midnight (or configurable time)
 * Creates tasks from habits that have autoCreateTask=true
 */
async function generateHabitTasks() {
  const habitsWithAutoTask = await habitService.list({
    isActive: true,
    autoCreateTask: true
  });

  for (const habit of habitsWithAutoTask) {
    if (habitService.isHabitDueOnDate(habit, new Date())) {
      // Check if task already exists for today
      const existingTask = await getHabitTaskForDate(habit.id, today);
      if (!existingTask) {
        const task = await taskService.create({
          title: habit.taskTemplate || `[Habit] ${habit.title}`,
          status: 'today',
          source: 'habit',
          sourceRef: habit.id,
          context: habit.context,
          timeEstimate: habit.durationMinutes,
          energyLevel: determineEnergyLevel(habit),
        });

        await linkHabitTask(habit.id, task.id, today);
      }
    }
  }
}
```

Add to scheduler in `hub/src/scheduler.ts`:
```typescript
// Run at 12:05 AM daily
cron.schedule('5 0 * * *', generateHabitTasks);
```

#### 4.2 Task Completion → Habit Completion Hook

When a task linked to a habit is completed, auto-complete the habit:

```typescript
// In task-service.ts complete method
async complete(id: string): Promise<Task> {
  const task = await this.update(id, { status: 'done', completedAt: new Date() });

  // Check if this task is linked to a habit
  if (task.source === 'habit' && task.sourceRef) {
    await habitService.complete(task.sourceRef);
  }

  return task;
}
```

#### 4.3 Enhanced Ceremony Integration

Update `ceremony-service.ts` to include:

**Morning Ceremony:**
- Today's habits with streak info
- Goals needing attention alerts
- Upcoming milestone deadlines

**Evening Ceremony:**
- Habit completion summary with streak impact
- Goal progress updates
- Missed habits with streak risk warnings

**Weekly Review:**
- Goal progress by life area
- Habit completion rates
- Top streaks celebration
- Goals at risk

#### 4.4 Vault Integration

When creating a goal, optionally create a vault entry:
```typescript
// In goals-service.ts create method
if (input.createVaultEntry) {
  const vaultEntry = await vaultService.create({
    title: input.title,
    contentType: 'goal',
    source: 'goals',
    sourceRef: goal.id,
    content: `# ${input.title}\n\n## Motivation\n${input.motivation || ''}\n\n## Vision\n${input.vision || ''}`,
    context: input.lifeArea,
    tags: ['goal', input.lifeArea],
  });

  await this.update(goal.id, { vaultEntryId: vaultEntry.id });
}
```

**Tasks:**
- [ ] Create habit-task-generator.ts job
- [ ] Add to scheduler
- [ ] Update task completion to trigger habit completion
- [ ] Enhance ceremony-service.ts with new sections
- [ ] Add Vault integration for goals

---

### Phase 5: Frontend Integration Points

#### 5.1 Tasks App Integration

Add to Tasks app sidebar or views:
- "Habits" section showing today's habits
- Visual indicator on habit-generated tasks
- Quick complete habit action

#### 5.2 Vault App Integration

Add to Vault app:
- "Goals" folder showing goal vault entries
- Link from goal entry to progress dashboard

#### 5.3 Command Center Dashboard Widget

Create new component:
```tsx
// apps/command-center/src/components/GoalsHabitsWidget.tsx
function GoalsHabitsWidget() {
  // Fetch from /api/progress/overview
  // Display:
  // - Today's habits completion bar
  // - Life areas progress bars
  // - Top streaks
  // - Needs attention alerts
}
```

**Tasks:**
- [ ] Add habits view/section to Tasks app
- [ ] Add goals folder to Vault app
- [ ] Create GoalsHabitsWidget for Command Center
- [ ] Wire up API calls

---

### Phase 6: Testing & Documentation

#### 6.1 Unit Tests

**File:** `hub/src/tests/goals-habits/`

- `goals.test.ts` - Goal CRUD + progress calculation
- `habits.test.ts` - Already exists, enhance with new features
- `milestones.test.ts` - Milestone CRUD + ordering + linking
- `progress.test.ts` - Dashboard aggregation
- `streak-calculation.test.ts` - Edge cases for streak logic

#### 6.2 Integration Tests

- Goal → Habit → Completion flow
- Habit → Task generation
- Milestone → Task linking
- Progress API aggregation
- Cascade deletes

#### 6.3 Documentation Updates

- [ ] Update FEATURES.md with new capabilities
- [ ] Update roadmap
- [ ] Add feature docs to /docs/public/features/goals-habits/
- [ ] Add changelog entry

**Tasks:**
- [ ] Write unit tests for all new services
- [ ] Write integration tests
- [ ] Update FEATURES.md
- [ ] Create feature documentation
- [ ] Add API documentation

---

## Implementation Order (Recommended)

### Sprint 1: Foundation (Days 1-3)
1. Create life areas constants
2. Update schema with new tables
3. Run migration
4. Create milestones service
5. Create milestones routes

### Sprint 2: Core Services (Days 4-6)
1. Enhance goals service with new methods
2. Create progress service
3. Create progress routes
4. Create reflections service

### Sprint 3: Integration (Days 7-9)
1. Create habit task generator job
2. Update task completion hook
3. Enhance ceremony service
4. Add Vault integration

### Sprint 4: AI & Dashboard (Days 10-12)
1. Create AI coach service
2. Create AI coaching routes
3. Create dashboard widget data endpoints
4. Frontend widget integration

### Sprint 5: Testing & Polish (Days 13-15)
1. Write comprehensive tests
2. Fix bugs
3. Update documentation
4. Final testing

---

## Verification Checkpoints

### After Phase 1
```bash
# Verify tables exist
bun run db:studio
# Check: milestones, goal_tasks, habit_tasks, goal_reflections tables exist
```

### After Phase 2
```bash
# Test services
curl http://localhost:3000/api/health
# Run: bun test (if tests exist)
```

### After Phase 3
```bash
# Test API endpoints
curl http://localhost:3000/api/goals
curl http://localhost:3000/api/milestones?goal_id=test
curl http://localhost:3000/api/progress/overview
```

### After Phase 4
```bash
# Verify habit task generation
# Create habit with autoCreateTask=true
# Check that task is created next day

# Verify ceremony includes goals/habits
curl http://localhost:3000/api/ceremonies/preview?type=morning
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Schema migration breaks existing data | Use ALTER TABLE ADD COLUMN with defaults |
| Habit task duplication | Unique constraint on habit_tasks(habit_id, scheduled_date) |
| Performance with many completions | Indexes on habitId and date columns |
| AI coach rate limits | Implement caching and throttling |
| Frontend complexity | Start with API-only, add frontend incrementally |

---

## Success Criteria

The implementation is complete when:

1. [ ] User can create goals in any of 6 life areas
2. [ ] User can add habits linked to goals (or standalone)
3. [ ] User can mark habits complete with optional notes/rating
4. [ ] Streaks are tracked accurately (existing - verify)
5. [ ] User can add milestones to goals
6. [ ] Progress auto-calculates based on measurement type
7. [ ] Dashboard shows progress by life area
8. [ ] Today's habits endpoint returns due habits with status
9. [ ] Weekly report shows habit completion rates
10. [ ] Habits can auto-generate tasks
11. [ ] Ceremonies include goals/habits data
12. [ ] All tests pass
13. [ ] Documentation is updated

---

## Files to Create/Modify

### New Files
- `hub/src/constants/life-areas.ts`
- `hub/src/services/milestones-service.ts`
- `hub/src/services/progress-service.ts`
- `hub/src/services/reflections-service.ts`
- `hub/src/services/ai-goal-coach.ts`
- `hub/src/api/routes/milestones.ts`
- `hub/src/api/routes/progress.ts`
- `hub/src/api/routes/ai-coaching.ts`
- `hub/src/jobs/habit-task-generator.ts`
- `hub/src/tests/goals-habits/*.test.ts`

### Modified Files
- `hub/src/db/schema.ts` - Add new tables
- `hub/src/services/goals-service.ts` - Add methods
- `hub/src/services/habit-service.ts` - Add autoCreateTask logic
- `hub/src/services/task-service.ts` - Add habit completion hook
- `hub/src/services/ceremony-service.ts` - Enhanced integration
- `hub/src/api/routes/goals.ts` - Add endpoints
- `hub/src/index.ts` - Register new routes
- `hub/src/types/index.ts` - Add new types
- `FEATURES.md` - Document new features

---

**Ready to begin implementation. Start with Phase 1: Schema & Data Layer.**

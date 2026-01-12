-- Performance indexes to fix production query issues
-- These indexes address N+1 queries and full table scans in dashboard service

-- Composite index for task queries that filter on both status and due_date
-- Used by: getGroupedTodayTasks(), getGroupedDeadlines(), getTasksMetric()
CREATE INDEX CONCURRENTLY IF NOT EXISTS tasks_status_due_idx ON tasks (status, due_date);--> statement-breakpoint

-- Index for vault entries queried by created_at (recent entries)
-- Used by: getVaultMetric() which scans for entries in last 24 hours
CREATE INDEX CONCURRENTLY IF NOT EXISTS vault_entries_created_at_idx ON vault_entries (created_at);--> statement-breakpoint

-- Composite index for goal reflections lookups
-- Used by: getGoalsNeedingAttention() to find latest reflection per goal
-- The DESC on created_at optimizes the ORDER BY ... LIMIT 1 pattern
CREATE INDEX CONCURRENTLY IF NOT EXISTS goal_reflections_goal_created_idx ON goal_reflections (goal_id, created_at DESC);--> statement-breakpoint

-- Composite index for habit completions by habit and date
-- Used by: getWeekCompletionCalendar(), habit streak calculations
CREATE INDEX CONCURRENTLY IF NOT EXISTS habit_completions_habit_date_idx ON habit_completions (habit_id, date DESC);--> statement-breakpoint

-- Index for goals health score (used in AI insights generation)
CREATE INDEX CONCURRENTLY IF NOT EXISTS goals_health_score_idx ON goals (health_score) WHERE status = 'active';

-- Phase 2: Multi-user database scoping
-- Adds clerk_id to study_help_users and user_id FK to read-help tables

-- 1. Add clerk_id column to study_help_users
ALTER TABLE "study_help_users" ADD COLUMN IF NOT EXISTS "clerk_id" text;
CREATE UNIQUE INDEX IF NOT EXISTS "study_help_users_clerk_id_idx" ON "study_help_users" ("clerk_id");

-- Backfill clerk_id from email field (existing records use 'clerk:user_xxx' pattern)
UPDATE "study_help_users" 
SET "clerk_id" = REPLACE("email", 'clerk:', '')
WHERE "email" LIKE 'clerk:%' AND "clerk_id" IS NULL;

-- 2. Add user_id to read-help tables
ALTER TABLE "read_help_books" ADD COLUMN IF NOT EXISTS "user_id" uuid REFERENCES "study_help_users"("id") ON DELETE CASCADE;
ALTER TABLE "read_help_conversations" ADD COLUMN IF NOT EXISTS "user_id" uuid REFERENCES "study_help_users"("id") ON DELETE CASCADE;
ALTER TABLE "read_help_highlights" ADD COLUMN IF NOT EXISTS "user_id" uuid REFERENCES "study_help_users"("id") ON DELETE CASCADE;
ALTER TABLE "read_help_quizzes" ADD COLUMN IF NOT EXISTS "user_id" uuid REFERENCES "study_help_users"("id") ON DELETE CASCADE;
ALTER TABLE "read_help_progress" ADD COLUMN IF NOT EXISTS "user_id" uuid REFERENCES "study_help_users"("id") ON DELETE CASCADE;
ALTER TABLE "read_help_flashcards" ADD COLUMN IF NOT EXISTS "user_id" uuid REFERENCES "study_help_users"("id") ON DELETE CASCADE;
ALTER TABLE "read_help_videos" ADD COLUMN IF NOT EXISTS "user_id" uuid REFERENCES "study_help_users"("id") ON DELETE CASCADE;

-- Indexes for user_id lookups
CREATE INDEX IF NOT EXISTS "read_help_books_user_id_idx" ON "read_help_books" ("user_id");
CREATE INDEX IF NOT EXISTS "read_help_conversations_user_id_idx" ON "read_help_conversations" ("user_id");
CREATE INDEX IF NOT EXISTS "read_help_highlights_user_id_idx" ON "read_help_highlights" ("user_id");
CREATE INDEX IF NOT EXISTS "read_help_quizzes_user_id_idx" ON "read_help_quizzes" ("user_id");
CREATE INDEX IF NOT EXISTS "read_help_progress_user_id_idx" ON "read_help_progress" ("user_id");
CREATE INDEX IF NOT EXISTS "read_help_flashcards_user_id_idx" ON "read_help_flashcards" ("user_id");
CREATE INDEX IF NOT EXISTS "read_help_videos_user_id_idx" ON "read_help_videos" ("user_id");

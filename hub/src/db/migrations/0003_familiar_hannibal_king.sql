CREATE TABLE "class_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"calendar_event_id" uuid NOT NULL,
	"vault_page_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"transcript_content" text,
	"summary_content" text,
	"key_takeaways" text[],
	"action_items" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "extracted_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"segment_id" uuid NOT NULL,
	"item_type" text NOT NULL,
	"content" text NOT NULL,
	"priority" integer DEFAULT 0,
	"due_date" timestamp with time zone,
	"assigned_to" text,
	"task_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_reflections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"content" text NOT NULL,
	"reflection_type" text DEFAULT 'progress' NOT NULL,
	"sentiment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid,
	"milestone_id" uuid,
	"task_id" uuid NOT NULL,
	"link_type" text DEFAULT 'action',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habit_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"habit_id" uuid NOT NULL,
	"date" date NOT NULL,
	"completed_count" integer DEFAULT 1,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"quality_rating" integer,
	"duration_minutes" integer,
	"skipped" boolean DEFAULT false,
	"skip_reason" text
);
--> statement-breakpoint
CREATE TABLE "habit_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"habit_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"scheduled_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"goal_id" uuid,
	"frequency" text DEFAULT 'daily' NOT NULL,
	"frequency_days" integer[],
	"times_per_week" integer,
	"time_of_day" text,
	"cue_habit" text,
	"specific_time" text,
	"life_area" text,
	"area" text,
	"context" text,
	"target_per_day" integer DEFAULT 1,
	"current_streak" integer DEFAULT 0,
	"longest_streak" integer DEFAULT 0,
	"total_completions" integer DEFAULT 0,
	"auto_create_task" boolean DEFAULT false,
	"task_template" text,
	"is_active" boolean DEFAULT true,
	"paused_until" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"target_date" date,
	"order_index" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp with time zone,
	"evidence" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recording_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_date" date NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"total_files" integer DEFAULT 0 NOT NULL,
	"processed_files" integer DEFAULT 0 NOT NULL,
	"total_duration_seconds" integer DEFAULT 0,
	"calendar_events_matched" integer DEFAULT 0,
	"segments_created" integer DEFAULT 0,
	"transcripts_created" integer DEFAULT 0,
	"vault_pages_created" integer DEFAULT 0,
	"tasks_created" integer DEFAULT 0,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recording_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"recording_id" uuid NOT NULL,
	"start_time_seconds" real NOT NULL,
	"end_time_seconds" real NOT NULL,
	"segment_type" text NOT NULL,
	"calendar_event_id" uuid,
	"class_name" text,
	"confidence_score" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"parent_block_id" uuid,
	"type" text NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"title" text DEFAULT 'Untitled' NOT NULL,
	"icon" text,
	"cover_image" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"legacy_entry_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_viewed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vault_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"block_id" uuid,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "life_area" text;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "goal_type" text DEFAULT 'achievement';--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "unit" text;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "level" text DEFAULT 'quarterly';--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "parent_goal_id" uuid;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "priority" integer DEFAULT 2;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "motivation" text;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "vision" text;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "progress_percentage" real DEFAULT 0;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "review_frequency" text DEFAULT 'weekly';--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "last_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "vault_entry_id" uuid;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "class_pages" ADD CONSTRAINT "class_pages_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_pages" ADD CONSTRAINT "class_pages_vault_page_id_vault_pages_id_fk" FOREIGN KEY ("vault_page_id") REFERENCES "public"."vault_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_pages" ADD CONSTRAINT "class_pages_batch_id_recording_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."recording_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_items" ADD CONSTRAINT "extracted_items_batch_id_recording_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."recording_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_items" ADD CONSTRAINT "extracted_items_segment_id_recording_segments_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."recording_segments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_items" ADD CONSTRAINT "extracted_items_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_reflections" ADD CONSTRAINT "goal_reflections_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_tasks" ADD CONSTRAINT "goal_tasks_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_tasks" ADD CONSTRAINT "goal_tasks_milestone_id_milestones_id_fk" FOREIGN KEY ("milestone_id") REFERENCES "public"."milestones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_tasks" ADD CONSTRAINT "goal_tasks_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_completions" ADD CONSTRAINT "habit_completions_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_tasks" ADD CONSTRAINT "habit_tasks_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_tasks" ADD CONSTRAINT "habit_tasks_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recording_segments" ADD CONSTRAINT "recording_segments_batch_id_recording_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."recording_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recording_segments" ADD CONSTRAINT "recording_segments_recording_id_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."recordings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recording_segments" ADD CONSTRAINT "recording_segments_calendar_event_id_calendar_events_id_fk" FOREIGN KEY ("calendar_event_id") REFERENCES "public"."calendar_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_blocks" ADD CONSTRAINT "vault_blocks_page_id_vault_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."vault_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_pages" ADD CONSTRAINT "vault_pages_legacy_entry_id_vault_entries_id_fk" FOREIGN KEY ("legacy_entry_id") REFERENCES "public"."vault_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_references" ADD CONSTRAINT "vault_references_page_id_vault_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."vault_pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_references" ADD CONSTRAINT "vault_references_block_id_vault_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."vault_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "class_pages_calendar_idx" ON "class_pages" USING btree ("calendar_event_id");--> statement-breakpoint
CREATE INDEX "class_pages_vault_idx" ON "class_pages" USING btree ("vault_page_id");--> statement-breakpoint
CREATE INDEX "class_pages_batch_idx" ON "class_pages" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "extracted_items_batch_idx" ON "extracted_items" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "extracted_items_segment_idx" ON "extracted_items" USING btree ("segment_id");--> statement-breakpoint
CREATE INDEX "extracted_items_type_idx" ON "extracted_items" USING btree ("item_type");--> statement-breakpoint
CREATE INDEX "extracted_items_task_idx" ON "extracted_items" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "goal_reflections_goal_idx" ON "goal_reflections" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "goal_reflections_type_idx" ON "goal_reflections" USING btree ("reflection_type");--> statement-breakpoint
CREATE INDEX "goal_reflections_created_idx" ON "goal_reflections" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "goal_tasks_goal_idx" ON "goal_tasks" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "goal_tasks_milestone_idx" ON "goal_tasks" USING btree ("milestone_id");--> statement-breakpoint
CREATE INDEX "goal_tasks_task_idx" ON "goal_tasks" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "habit_completions_habit_idx" ON "habit_completions" USING btree ("habit_id");--> statement-breakpoint
CREATE INDEX "habit_completions_date_idx" ON "habit_completions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "habit_completions_unique_idx" ON "habit_completions" USING btree ("habit_id","date");--> statement-breakpoint
CREATE INDEX "habit_tasks_habit_idx" ON "habit_tasks" USING btree ("habit_id");--> statement-breakpoint
CREATE INDEX "habit_tasks_task_idx" ON "habit_tasks" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "habit_tasks_date_idx" ON "habit_tasks" USING btree ("scheduled_date");--> statement-breakpoint
CREATE INDEX "habits_goal_idx" ON "habits" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "habits_active_idx" ON "habits" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "habits_area_idx" ON "habits" USING btree ("area");--> statement-breakpoint
CREATE INDEX "habits_life_area_idx" ON "habits" USING btree ("life_area");--> statement-breakpoint
CREATE INDEX "milestones_goal_idx" ON "milestones" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "milestones_status_idx" ON "milestones" USING btree ("status");--> statement-breakpoint
CREATE INDEX "milestones_target_date_idx" ON "milestones" USING btree ("target_date");--> statement-breakpoint
CREATE INDEX "recording_batches_date_idx" ON "recording_batches" USING btree ("batch_date");--> statement-breakpoint
CREATE INDEX "recording_batches_status_idx" ON "recording_batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "recording_batches_date_status_idx" ON "recording_batches" USING btree ("batch_date","status");--> statement-breakpoint
CREATE INDEX "recording_segments_batch_idx" ON "recording_segments" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "recording_segments_recording_idx" ON "recording_segments" USING btree ("recording_id");--> statement-breakpoint
CREATE INDEX "recording_segments_type_idx" ON "recording_segments" USING btree ("segment_type");--> statement-breakpoint
CREATE INDEX "recording_segments_calendar_idx" ON "recording_segments" USING btree ("calendar_event_id");--> statement-breakpoint
CREATE INDEX "vault_blocks_page_idx" ON "vault_blocks" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "vault_blocks_parent_idx" ON "vault_blocks" USING btree ("parent_block_id");--> statement-breakpoint
CREATE INDEX "vault_blocks_order_idx" ON "vault_blocks" USING btree ("page_id","parent_block_id","sort_order");--> statement-breakpoint
CREATE INDEX "vault_pages_parent_idx" ON "vault_pages" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "vault_pages_favorite_idx" ON "vault_pages" USING btree ("is_favorite");--> statement-breakpoint
CREATE INDEX "vault_pages_archived_idx" ON "vault_pages" USING btree ("is_archived");--> statement-breakpoint
CREATE INDEX "vault_pages_sort_idx" ON "vault_pages" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "vault_references_page_idx" ON "vault_references" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "vault_references_block_idx" ON "vault_references" USING btree ("block_id");--> statement-breakpoint
CREATE INDEX "vault_references_target_idx" ON "vault_references" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "goals_life_area_idx" ON "goals" USING btree ("life_area");--> statement-breakpoint
CREATE INDEX "goals_level_idx" ON "goals" USING btree ("level");--> statement-breakpoint
CREATE INDEX "goals_parent_idx" ON "goals" USING btree ("parent_goal_id");--> statement-breakpoint
CREATE INDEX "goals_priority_idx" ON "goals" USING btree ("priority");
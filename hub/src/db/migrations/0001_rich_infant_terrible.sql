CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"action" text NOT NULL,
	"changes" jsonb,
	"actor" text DEFAULT 'user',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contexts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text,
	"icon" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contexts_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "daily_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"tasks_planned" integer,
	"tasks_completed" integer,
	"tasks_added" integer,
	"inbox_start" integer,
	"inbox_end" integer,
	"reflection" text,
	"mood" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_reviews_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "filters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"query" text NOT NULL,
	"color" text,
	"icon" text,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"target_date" date,
	"metric_type" text,
	"target_value" real,
	"current_value" real DEFAULT 0,
	"area" text,
	"status" text DEFAULT 'active',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#808080',
	"is_favorite" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "labels_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_collapsed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"content" text NOT NULL,
	"author" text DEFAULT 'user',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"target_id" uuid NOT NULL,
	"connection_type" text DEFAULT 'reference',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "color" text DEFAULT '#808080';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "icon" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "parent_project_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "area" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "is_favorite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "default_view" text DEFAULT 'list';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "target_completion_date" date;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "vault_folder_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "section_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "task_contexts" text[];--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "task_labels" text[];--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "waiting_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "recurrence_rule" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "recurrence_parent_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "completed_by" text;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "vault_entry_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vault_entries" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "vault_entries" ADD COLUMN "project_id" uuid;--> statement-breakpoint
ALTER TABLE "vault_entries" ADD COLUMN "original_task_id" uuid;--> statement-breakpoint
ALTER TABLE "vault_entries" ADD COLUMN "task_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vault_entries" ADD COLUMN "task_project" text;--> statement-breakpoint
ALTER TABLE "vault_entries" ADD COLUMN "task_contexts" text[];--> statement-breakpoint
ALTER TABLE "vault_entries" ADD COLUMN "recording_duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "vault_entries" ADD COLUMN "recording_transcript" text;--> statement-breakpoint
ALTER TABLE "vault_entries" ADD COLUMN "recording_summary" text;--> statement-breakpoint
ALTER TABLE "vault_entries" ADD COLUMN "file_path" text;--> statement-breakpoint
ALTER TABLE "vault_entries" ADD COLUMN "file_type" text;--> statement-breakpoint
ALTER TABLE "vault_entries" ADD COLUMN "file_size_bytes" bigint;--> statement-breakpoint
ALTER TABLE "sections" ADD CONSTRAINT "sections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_connections" ADD CONSTRAINT "vault_connections_source_id_vault_entries_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."vault_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_connections" ADD CONSTRAINT "vault_connections_target_id_vault_entries_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."vault_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_log_entity_idx" ON "activity_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "activity_log_created_idx" ON "activity_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "daily_reviews_date_idx" ON "daily_reviews" USING btree ("date");--> statement-breakpoint
CREATE INDEX "goals_status_idx" ON "goals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "goals_area_idx" ON "goals" USING btree ("area");--> statement-breakpoint
CREATE INDEX "sections_project_idx" ON "sections" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "task_comments_task_idx" ON "task_comments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "vault_connections_source_idx" ON "vault_connections" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "vault_connections_target_idx" ON "vault_connections" USING btree ("target_id");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_section_id_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."sections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_entries" ADD CONSTRAINT "vault_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "projects_area_idx" ON "projects" USING btree ("area");--> statement-breakpoint
CREATE INDEX "projects_parent_idx" ON "projects" USING btree ("parent_project_id");--> statement-breakpoint
CREATE INDEX "tasks_project_idx" ON "tasks" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "tasks_section_idx" ON "tasks" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "vault_project_idx" ON "vault_entries" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "vault_parent_idx" ON "vault_entries" USING btree ("parent_id");
CREATE TABLE "application_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"action" text NOT NULL,
	"previous_value" text,
	"new_value" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canvas_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audit_type" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"status" text NOT NULL,
	"courses_audited" integer,
	"pages_visited" integer,
	"screenshots_captured" integer,
	"items_discovered" integer,
	"tasks_verified" integer,
	"tasks_created" integer,
	"tasks_updated" integer,
	"discrepancies_found" integer,
	"integrity_score" integer,
	"findings" jsonb,
	"errors" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canvas_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canvas_id" text NOT NULL,
	"canvas_type" text NOT NULL,
	"course_id" uuid,
	"course_name" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"url" text,
	"due_at" timestamp with time zone,
	"available_from" timestamp with time zone,
	"available_until" timestamp with time zone,
	"points_possible" real,
	"submission_types" text[],
	"is_quiz" boolean DEFAULT false NOT NULL,
	"is_discussion" boolean DEFAULT false NOT NULL,
	"is_graded" boolean DEFAULT true NOT NULL,
	"discovered_via" text NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_verified_at" timestamp with time zone,
	"task_id" uuid,
	"project_id" uuid,
	"sync_status" text DEFAULT 'pending' NOT NULL,
	"browser_verified" boolean DEFAULT false NOT NULL,
	"api_verified" boolean DEFAULT false NOT NULL,
	"last_browser_check" timestamp with time zone,
	"last_api_check" timestamp with time zone,
	"verification_screenshot" text,
	"canvas_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "canvas_items_canvas_id_unique" UNIQUE("canvas_id")
);
--> statement-breakpoint
CREATE TABLE "canvas_schedule_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canvas_item_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"is_scheduled" boolean DEFAULT false NOT NULL,
	"scheduled_start" timestamp with time zone,
	"scheduled_end" timestamp with time zone,
	"calendar_event_id" text,
	"reminder_sent" boolean DEFAULT false NOT NULL,
	"reminder_sent_at" timestamp with time zone,
	"reminder_count" integer DEFAULT 0 NOT NULL,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_project_mapping" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canvas_course_id" text NOT NULL,
	"canvas_course_name" text NOT NULL,
	"canvas_course_code" text,
	"project_id" uuid NOT NULL,
	"professor_name" text,
	"semester" text,
	"credits" integer,
	"meeting_days" text[],
	"meeting_time_start" text,
	"meeting_time_end" text,
	"location" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "class_project_mapping_canvas_course_id_unique" UNIQUE("canvas_course_id")
);
--> statement-breakpoint
CREATE TABLE "job_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_titles" text[],
	"target_companies" text[],
	"exclude_companies" text[],
	"min_salary" integer,
	"max_salary" integer,
	"preferred_locations" text[],
	"remote_preference" text,
	"willing_to_relocate" boolean DEFAULT false NOT NULL,
	"years_experience" integer,
	"skills" text[],
	"industries" text[],
	"auto_apply_enabled" boolean DEFAULT false NOT NULL,
	"auto_apply_threshold" integer DEFAULT 85,
	"daily_application_limit" integer DEFAULT 10,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company" text NOT NULL,
	"title" text NOT NULL,
	"location" text,
	"location_type" text,
	"salary_min" integer,
	"salary_max" integer,
	"salary_type" text,
	"description" text,
	"requirements" text[],
	"benefits" text[],
	"url" text,
	"platform" text,
	"platform_job_id" text,
	"status" text DEFAULT 'discovered' NOT NULL,
	"match_score" real,
	"match_reason" text,
	"applied_at" timestamp with time zone,
	"applied_via" text,
	"resume_used_id" uuid,
	"cover_letter" text,
	"notes" text,
	"next_follow_up" timestamp with time zone,
	"contacts" jsonb,
	"interviews" jsonb,
	"vault_entry_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"variant" text,
	"file_path" text NOT NULL,
	"file_type" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"extracted_skills" text[],
	"extracted_experience" jsonb,
	"last_used" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "screening_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_pattern" text NOT NULL,
	"answer" text NOT NULL,
	"category" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "calendar_events" ADD COLUMN "attendees" text[];--> statement-breakpoint
ALTER TABLE "application_history" ADD CONSTRAINT "application_history_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_items" ADD CONSTRAINT "canvas_items_course_id_classes_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_items" ADD CONSTRAINT "canvas_items_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_items" ADD CONSTRAINT "canvas_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_schedule_tracking" ADD CONSTRAINT "canvas_schedule_tracking_canvas_item_id_canvas_items_id_fk" FOREIGN KEY ("canvas_item_id") REFERENCES "public"."canvas_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "canvas_schedule_tracking" ADD CONSTRAINT "canvas_schedule_tracking_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_project_mapping" ADD CONSTRAINT "class_project_mapping_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_resume_used_id_resume_metadata_id_fk" FOREIGN KEY ("resume_used_id") REFERENCES "public"."resume_metadata"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "app_history_job_idx" ON "application_history" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "app_history_created_idx" ON "application_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "canvas_audits_type_idx" ON "canvas_audits" USING btree ("audit_type");--> statement-breakpoint
CREATE INDEX "canvas_audits_status_idx" ON "canvas_audits" USING btree ("status");--> statement-breakpoint
CREATE INDEX "canvas_audits_started_idx" ON "canvas_audits" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "canvas_items_course_idx" ON "canvas_items" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "canvas_items_due_idx" ON "canvas_items" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "canvas_items_type_idx" ON "canvas_items" USING btree ("canvas_type");--> statement-breakpoint
CREATE INDEX "canvas_items_sync_idx" ON "canvas_items" USING btree ("sync_status");--> statement-breakpoint
CREATE INDEX "canvas_items_task_idx" ON "canvas_items" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "canvas_schedule_item_idx" ON "canvas_schedule_tracking" USING btree ("canvas_item_id");--> statement-breakpoint
CREATE INDEX "canvas_schedule_task_idx" ON "canvas_schedule_tracking" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "canvas_schedule_is_scheduled_idx" ON "canvas_schedule_tracking" USING btree ("is_scheduled");--> statement-breakpoint
CREATE INDEX "class_project_mapping_project_idx" ON "class_project_mapping" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "class_project_mapping_active_idx" ON "class_project_mapping" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_company_idx" ON "jobs" USING btree ("company");--> statement-breakpoint
CREATE INDEX "jobs_platform_idx" ON "jobs" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "jobs_applied_at_idx" ON "jobs" USING btree ("applied_at");--> statement-breakpoint
CREATE INDEX "jobs_match_score_idx" ON "jobs" USING btree ("match_score");--> statement-breakpoint
CREATE INDEX "resume_variant_idx" ON "resume_metadata" USING btree ("variant");--> statement-breakpoint
CREATE INDEX "screening_category_idx" ON "screening_answers" USING btree ("category");
CREATE TABLE "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"google_event_id" text,
	"title" text NOT NULL,
	"description" text,
	"location" text,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"event_type" text,
	"context" text,
	"alert_sent" boolean DEFAULT false NOT NULL,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_events_google_event_id_unique" UNIQUE("google_event_id")
);
--> statement-breakpoint
CREATE TABLE "ceremonies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ceremony_type" text NOT NULL,
	"scheduled_at" timestamp with time zone,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"skipped" boolean DEFAULT false NOT NULL,
	"skip_reason" text,
	"notes" text,
	"content" jsonb,
	"delivery_status" text,
	"delivery_channel" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"professor" text,
	"canvas_course_id" text,
	"schedule" jsonb,
	"agent_system_prompt" text,
	"status" text DEFAULT 'active' NOT NULL,
	"semester" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" text NOT NULL,
	"thread_id" text,
	"from_email" text,
	"from_name" text,
	"subject" text,
	"snippet" text,
	"received_at" timestamp with time zone,
	"priority" text DEFAULT 'normal',
	"category" text,
	"summary" text,
	"action_items" text[],
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_messages_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
CREATE TABLE "integrity_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"check_type" text NOT NULL,
	"passed" boolean NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"interaction_date" timestamp with time zone NOT NULL,
	"interaction_type" text,
	"summary" text,
	"recording_id" uuid,
	"vault_entry_id" uuid,
	"commitments_by_them" text[],
	"commitments_by_me" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"how_met" text,
	"where_met" text,
	"first_met_date" date,
	"relationship_type" text,
	"key_facts" text[],
	"notes" text,
	"last_interaction_date" date,
	"interaction_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"linear_id" text,
	"name" text NOT NULL,
	"description" text,
	"context" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_linear_id_unique" UNIQUE("linear_id")
);
--> statement-breakpoint
CREATE TABLE "recording_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recording_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"key_points" text[],
	"decisions" text[],
	"commitments" jsonb,
	"questions" text[],
	"deadlines_mentioned" jsonb,
	"topics_covered" text[],
	"model_used" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_path" text NOT NULL,
	"original_filename" text,
	"duration_seconds" integer,
	"file_size_bytes" bigint,
	"recording_type" text NOT NULL,
	"context" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"recorded_at" timestamp with time zone,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"last_sync_at" timestamp with time zone NOT NULL,
	"last_cursor" text,
	"last_modified_time" timestamp with time zone,
	"status" text DEFAULT 'idle' NOT NULL,
	"error_message" text,
	"items_processed" integer DEFAULT 0 NOT NULL,
	"items_added" integer DEFAULT 0 NOT NULL,
	"items_updated" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_state_source_unique" UNIQUE("source")
);
--> statement-breakpoint
CREATE TABLE "system_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"log_type" text NOT NULL,
	"component" text,
	"message" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"linear_id" text,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'inbox' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"due_date" timestamp with time zone,
	"due_date_is_hard" boolean DEFAULT false NOT NULL,
	"scheduled_start" timestamp with time zone,
	"scheduled_end" timestamp with time zone,
	"calendar_event_id" text,
	"source" text NOT NULL,
	"source_ref" text,
	"context" text NOT NULL,
	"time_estimate_minutes" integer,
	"energy_level" text,
	"blocked_by" uuid,
	"waiting_for" text,
	"project_id" uuid,
	"parent_task_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"synced_at" timestamp with time zone,
	"sync_status" text DEFAULT 'pending',
	CONSTRAINT "tasks_linear_id_unique" UNIQUE("linear_id")
);
--> statement-breakpoint
CREATE TABLE "time_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid,
	"title" text,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"block_type" text DEFAULT 'focus' NOT NULL,
	"google_event_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_tracking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"total_screen_time_minutes" integer,
	"productive_minutes" integer,
	"waste_minutes" integer,
	"app_breakdown" jsonb,
	"category_breakdown" jsonb,
	"tasks_planned" integer,
	"tasks_completed" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recording_id" uuid NOT NULL,
	"full_text" text NOT NULL,
	"segments" jsonb,
	"word_count" integer,
	"speaker_count" integer,
	"confidence_score" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" bigint NOT NULL,
	"storage_path" text NOT NULL,
	"extracted_text" text,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"chunk_index" integer DEFAULT 0 NOT NULL,
	"content_chunk" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"content_type" text NOT NULL,
	"context" text NOT NULL,
	"tags" text[],
	"category" text,
	"source" text NOT NULL,
	"source_ref" text,
	"source_id" text,
	"source_url" text,
	"source_path" text,
	"recording_id" uuid,
	"related_entries" uuid[],
	"is_processed" boolean DEFAULT false NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"is_duplicate" boolean DEFAULT false NOT NULL,
	"duplicate_of" uuid,
	"source_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"imported_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_recording_id_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."recordings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_vault_entry_id_vault_entries_id_fk" FOREIGN KEY ("vault_entry_id") REFERENCES "public"."vault_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recording_summaries" ADD CONSTRAINT "recording_summaries_recording_id_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."recordings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "time_blocks" ADD CONSTRAINT "time_blocks_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_recording_id_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."recordings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_attachments" ADD CONSTRAINT "vault_attachments_entry_id_vault_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."vault_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_embeddings" ADD CONSTRAINT "vault_embeddings_entry_id_vault_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."vault_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_entries" ADD CONSTRAINT "vault_entries_recording_id_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."recordings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "calendar_start_idx" ON "calendar_events" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "email_processed_idx" ON "email_messages" USING btree ("processed");--> statement-breakpoint
CREATE INDEX "email_received_idx" ON "email_messages" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "people_name_idx" ON "people" USING btree ("name");--> statement-breakpoint
CREATE INDEX "recordings_status_idx" ON "recordings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "recordings_type_idx" ON "recordings" USING btree ("recording_type");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_due_date_idx" ON "tasks" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "tasks_context_idx" ON "tasks" USING btree ("context");--> statement-breakpoint
CREATE INDEX "time_blocks_start_idx" ON "time_blocks" USING btree ("start_time");--> statement-breakpoint
CREATE INDEX "vault_context_idx" ON "vault_entries" USING btree ("context");--> statement-breakpoint
CREATE INDEX "vault_type_idx" ON "vault_entries" USING btree ("content_type");--> statement-breakpoint
CREATE INDEX "vault_category_idx" ON "vault_entries" USING btree ("category");--> statement-breakpoint
CREATE INDEX "vault_source_idx" ON "vault_entries" USING btree ("source");--> statement-breakpoint
CREATE INDEX "vault_source_id_idx" ON "vault_entries" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "vault_is_processed_idx" ON "vault_entries" USING btree ("is_processed");--> statement-breakpoint
CREATE INDEX "vault_needs_review_idx" ON "vault_entries" USING btree ("needs_review");
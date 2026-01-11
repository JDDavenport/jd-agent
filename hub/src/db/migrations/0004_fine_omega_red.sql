CREATE TABLE "ai_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insight_type" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"actionable" boolean DEFAULT true NOT NULL,
	"action_label" text,
	"action_target" text,
	"data" jsonb,
	"is_dismissed" boolean DEFAULT false NOT NULL,
	"dismissed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"token_type" text,
	"expires_at" timestamp with time zone,
	"scope" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_credentials_integration_unique" UNIQUE("integration")
);
--> statement-breakpoint
CREATE TABLE "remarkable_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"remarkable_file_id" text NOT NULL,
	"original_filename" text NOT NULL,
	"upload_timestamp" timestamp with time zone NOT NULL,
	"classification_type" text NOT NULL,
	"semester" text,
	"class_code" text,
	"note_date" date,
	"pdf_path" text NOT NULL,
	"ocr_text" text,
	"ocr_confidence" real,
	"page_id" uuid,
	"vault_entry_id" uuid,
	"processed_at" timestamp with time zone,
	"sync_status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"file_size_bytes" bigint,
	"page_count" integer,
	"has_merged_content" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "remarkable_notes_remarkable_file_id_unique" UNIQUE("remarkable_file_id")
);
--> statement-breakpoint
CREATE TABLE "remarkable_sync_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"last_sync_at" timestamp with time zone NOT NULL,
	"last_sync_window_start" timestamp with time zone,
	"last_sync_window_end" timestamp with time zone,
	"items_processed" integer DEFAULT 0 NOT NULL,
	"items_added" integer DEFAULT 0 NOT NULL,
	"items_skipped" integer DEFAULT 0 NOT NULL,
	"items_failed" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'idle' NOT NULL,
	"error_message" text,
	"ocr_success_count" integer DEFAULT 0 NOT NULL,
	"ocr_failure_count" integer DEFAULT 0 NOT NULL,
	"average_ocr_confidence" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "speaker_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transcript_id" uuid NOT NULL,
	"deepgram_speaker_id" integer NOT NULL,
	"voice_profile_id" uuid,
	"confidence" real,
	"manually_assigned" boolean DEFAULT false NOT NULL,
	"assigned_at" timestamp with time zone,
	"assigned_by" text,
	"auto_matched" boolean DEFAULT false NOT NULL,
	"needs_verification" boolean DEFAULT false NOT NULL,
	"match_score" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_health_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration" text NOT NULL,
	"status" text NOT NULL,
	"latency_ms" integer,
	"error_message" text,
	"error_count" integer DEFAULT 0 NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"config" jsonb NOT NULL,
	"base_url" text NOT NULL,
	"api_base_url" text NOT NULL,
	"test_scope" text NOT NULL,
	"specific_pages" text[],
	"max_iterations" integer DEFAULT 50,
	"headless" boolean DEFAULT true,
	"progress" jsonb,
	"current_iteration" integer DEFAULT 0,
	"result" jsonb,
	"passed" integer,
	"failed" integer,
	"warnings" integer,
	"total_findings" integer,
	"summary" text,
	"recommendations" text[],
	"screenshot_dir" text NOT NULL,
	"screenshot_paths" text[],
	"error_message" text,
	"error_stack" text,
	"job_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE "vault_entry_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"tags" text[],
	"category" text,
	"change_description" text,
	"changed_by" text DEFAULT 'user',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"person_id" uuid,
	"category" text NOT NULL,
	"sample_count" integer DEFAULT 0 NOT NULL,
	"total_duration_seconds" integer DEFAULT 0 NOT NULL,
	"embedding_updated_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"confidence_threshold" real DEFAULT 0.75 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_samples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voice_profile_id" uuid NOT NULL,
	"transcript_id" uuid,
	"recording_id" uuid,
	"deepgram_speaker_id" integer,
	"start_time_seconds" real NOT NULL,
	"end_time_seconds" real NOT NULL,
	"duration_seconds" real NOT NULL,
	"audio_path" text,
	"embedding_model" text DEFAULT 'pyannote-embedding',
	"quality" text,
	"signal_to_noise" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_reviews" ADD COLUMN "journal_text" text;--> statement-breakpoint
ALTER TABLE "daily_reviews" ADD COLUMN "word_count" integer;--> statement-breakpoint
ALTER TABLE "daily_reviews" ADD COLUMN "tasks_reviewed" jsonb;--> statement-breakpoint
ALTER TABLE "daily_reviews" ADD COLUMN "classes_reviewed" jsonb;--> statement-breakpoint
ALTER TABLE "daily_reviews" ADD COLUMN "habits_completed_count" integer;--> statement-breakpoint
ALTER TABLE "daily_reviews" ADD COLUMN "habits_total_count" integer;--> statement-breakpoint
ALTER TABLE "daily_reviews" ADD COLUMN "goals_reviewed_count" integer;--> statement-breakpoint
ALTER TABLE "daily_reviews" ADD COLUMN "tomorrow_events_count" integer;--> statement-breakpoint
ALTER TABLE "daily_reviews" ADD COLUMN "tomorrow_tasks_count" integer;--> statement-breakpoint
ALTER TABLE "daily_reviews" ADD COLUMN "tags" text[];--> statement-breakpoint
ALTER TABLE "daily_reviews" ADD COLUMN "current_step" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "daily_reviews" ADD COLUMN "review_completed" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "daily_reviews" ADD COLUMN "review_duration_seconds" integer;--> statement-breakpoint
ALTER TABLE "daily_reviews" ADD COLUMN "vault_page_id" uuid;--> statement-breakpoint
ALTER TABLE "daily_reviews" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "daily_reviews" ADD COLUMN "completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "daily_reviews" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "remarkable_notes" ADD CONSTRAINT "remarkable_notes_page_id_vault_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."vault_pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "remarkable_notes" ADD CONSTRAINT "remarkable_notes_vault_entry_id_vault_entries_id_fk" FOREIGN KEY ("vault_entry_id") REFERENCES "public"."vault_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speaker_mappings" ADD CONSTRAINT "speaker_mappings_transcript_id_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."transcripts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "speaker_mappings" ADD CONSTRAINT "speaker_mappings_voice_profile_id_voice_profiles_id_fk" FOREIGN KEY ("voice_profile_id") REFERENCES "public"."voice_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_entry_versions" ADD CONSTRAINT "vault_entry_versions_entry_id_vault_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."vault_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_profiles" ADD CONSTRAINT "voice_profiles_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_samples" ADD CONSTRAINT "voice_samples_voice_profile_id_voice_profiles_id_fk" FOREIGN KEY ("voice_profile_id") REFERENCES "public"."voice_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_samples" ADD CONSTRAINT "voice_samples_transcript_id_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."transcripts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_samples" ADD CONSTRAINT "voice_samples_recording_id_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."recordings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_insights_type_idx" ON "ai_insights" USING btree ("insight_type");--> statement-breakpoint
CREATE INDEX "ai_insights_category_idx" ON "ai_insights" USING btree ("category");--> statement-breakpoint
CREATE INDEX "ai_insights_severity_idx" ON "ai_insights" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "ai_insights_dismissed_idx" ON "ai_insights" USING btree ("is_dismissed");--> statement-breakpoint
CREATE INDEX "ai_insights_expires_idx" ON "ai_insights" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "integration_credentials_integration_idx" ON "integration_credentials" USING btree ("integration");--> statement-breakpoint
CREATE INDEX "remarkable_notes_class_date_idx" ON "remarkable_notes" USING btree ("class_code","note_date");--> statement-breakpoint
CREATE INDEX "remarkable_notes_sync_status_idx" ON "remarkable_notes" USING btree ("sync_status");--> statement-breakpoint
CREATE INDEX "remarkable_notes_classification_idx" ON "remarkable_notes" USING btree ("classification_type");--> statement-breakpoint
CREATE INDEX "remarkable_notes_semester_idx" ON "remarkable_notes" USING btree ("semester");--> statement-breakpoint
CREATE INDEX "remarkable_notes_page_idx" ON "remarkable_notes" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "remarkable_notes_remarkable_id_idx" ON "remarkable_notes" USING btree ("remarkable_file_id");--> statement-breakpoint
CREATE INDEX "speaker_mappings_transcript_idx" ON "speaker_mappings" USING btree ("transcript_id");--> statement-breakpoint
CREATE INDEX "speaker_mappings_profile_idx" ON "speaker_mappings" USING btree ("voice_profile_id");--> statement-breakpoint
CREATE INDEX "speaker_mappings_speaker_idx" ON "speaker_mappings" USING btree ("transcript_id","deepgram_speaker_id");--> statement-breakpoint
CREATE INDEX "speaker_mappings_auto_matched_idx" ON "speaker_mappings" USING btree ("auto_matched");--> statement-breakpoint
CREATE INDEX "speaker_mappings_needs_verification_idx" ON "speaker_mappings" USING btree ("needs_verification");--> statement-breakpoint
CREATE INDEX "system_health_integration_idx" ON "system_health_logs" USING btree ("integration");--> statement-breakpoint
CREATE INDEX "system_health_status_idx" ON "system_health_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "system_health_created_idx" ON "system_health_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "test_sessions_status_idx" ON "test_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "test_sessions_created_idx" ON "test_sessions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "test_sessions_job_idx" ON "test_sessions" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "vault_entry_versions_entry_idx" ON "vault_entry_versions" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "vault_entry_versions_version_idx" ON "vault_entry_versions" USING btree ("entry_id","version_number");--> statement-breakpoint
CREATE INDEX "voice_profiles_person_idx" ON "voice_profiles" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "voice_profiles_category_idx" ON "voice_profiles" USING btree ("category");--> statement-breakpoint
CREATE INDEX "voice_profiles_active_idx" ON "voice_profiles" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "voice_samples_profile_idx" ON "voice_samples" USING btree ("voice_profile_id");--> statement-breakpoint
CREATE INDEX "voice_samples_transcript_idx" ON "voice_samples" USING btree ("transcript_id");--> statement-breakpoint
CREATE INDEX "voice_samples_recording_idx" ON "voice_samples" USING btree ("recording_id");--> statement-breakpoint
ALTER TABLE "daily_reviews" ADD CONSTRAINT "daily_reviews_vault_page_id_vault_pages_id_fk" FOREIGN KEY ("vault_page_id") REFERENCES "public"."vault_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_reviews_completed_idx" ON "daily_reviews" USING btree ("review_completed");--> statement-breakpoint
CREATE INDEX "daily_reviews_vault_page_idx" ON "daily_reviews" USING btree ("vault_page_id");
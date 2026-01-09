-- Enable pgvector extension for voice embeddings
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
-- Create voice_samples table
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
	"embedding" vector(512),
	"embedding_model" text DEFAULT 'pyannote-embedding',
	"quality" text,
	"signal_to_noise" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Add embedding column to voice_profiles
ALTER TABLE "voice_profiles" ADD COLUMN "embedding" vector(512);
--> statement-breakpoint
ALTER TABLE "voice_profiles" ADD COLUMN "embedding_updated_at" timestamp with time zone;
--> statement-breakpoint
-- Add auto-matching columns to speaker_mappings
ALTER TABLE "speaker_mappings" ADD COLUMN "auto_matched" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "speaker_mappings" ADD COLUMN "needs_verification" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "speaker_mappings" ADD COLUMN "match_score" real;
--> statement-breakpoint
-- Add foreign keys for voice_samples
ALTER TABLE "voice_samples" ADD CONSTRAINT "voice_samples_voice_profile_id_voice_profiles_id_fk" FOREIGN KEY ("voice_profile_id") REFERENCES "public"."voice_profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "voice_samples" ADD CONSTRAINT "voice_samples_transcript_id_transcripts_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."transcripts"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "voice_samples" ADD CONSTRAINT "voice_samples_recording_id_recordings_id_fk" FOREIGN KEY ("recording_id") REFERENCES "public"."recordings"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- Create indexes for voice_samples
CREATE INDEX "voice_samples_profile_idx" ON "voice_samples" USING btree ("voice_profile_id");
--> statement-breakpoint
CREATE INDEX "voice_samples_transcript_idx" ON "voice_samples" USING btree ("transcript_id");
--> statement-breakpoint
CREATE INDEX "voice_samples_recording_idx" ON "voice_samples" USING btree ("recording_id");
--> statement-breakpoint
-- Create vector indexes for fast similarity search
CREATE INDEX "voice_profiles_embedding_idx" ON "voice_profiles" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
--> statement-breakpoint
CREATE INDEX "voice_samples_embedding_idx" ON "voice_samples" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
--> statement-breakpoint
-- Create indexes for speaker_mappings auto-matching
CREATE INDEX "speaker_mappings_auto_matched_idx" ON "speaker_mappings" USING btree ("auto_matched");
--> statement-breakpoint
CREATE INDEX "speaker_mappings_needs_verification_idx" ON "speaker_mappings" USING btree ("needs_verification");

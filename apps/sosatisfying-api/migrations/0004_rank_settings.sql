CREATE TABLE "sos_rank_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hot_decay_hours" integer DEFAULT 24 NOT NULL,
	"vote_weight" integer DEFAULT 1 NOT NULL,
	"comment_weight" real DEFAULT 0.2 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sos_rank_settings_updated_idx" ON "sos_rank_settings" ("updated_at");

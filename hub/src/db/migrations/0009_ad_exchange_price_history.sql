CREATE TABLE IF NOT EXISTS "ad_space_price_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ad_space_id" uuid NOT NULL REFERENCES "ad_spaces"("id") ON DELETE cascade,
  "price_type" text NOT NULL,
  "price" real NOT NULL,
  "recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
  "metadata" jsonb
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "ad_space_price_history_space_idx" ON "ad_space_price_history" ("ad_space_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_space_price_history_recorded_idx" ON "ad_space_price_history" ("recorded_at");

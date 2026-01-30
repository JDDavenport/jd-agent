CREATE TABLE IF NOT EXISTS "roadmap_phases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "phase_number" integer NOT NULL,
  "title" text NOT NULL,
  "subtitle" text,
  "timeline" text NOT NULL,
  "status" text DEFAULT 'not_started' NOT NULL,
  "progress" integer DEFAULT 0 NOT NULL,
  "color" text NOT NULL,
  "icon" text NOT NULL,
  "goal" text NOT NULL,
  "strategy" text NOT NULL,
  "outcome" text NOT NULL,
  "key_metrics" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "roadmap_phases_phase_number_unique" ON "roadmap_phases" ("phase_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roadmap_phases_status_idx" ON "roadmap_phases" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roadmap_phases_number_idx" ON "roadmap_phases" ("phase_number");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "roadmap_milestones" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "phase_id" uuid NOT NULL REFERENCES "roadmap_phases"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "description" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "target_date" date,
  "completed_date" date,
  "metrics" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "roadmap_milestones_phase_idx" ON "roadmap_milestones" ("phase_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roadmap_milestones_status_idx" ON "roadmap_milestones" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roadmap_milestones_sort_idx" ON "roadmap_milestones" ("phase_id", "sort_order");

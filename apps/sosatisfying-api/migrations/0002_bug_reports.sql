CREATE TABLE "sos_bug_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"severity" text DEFAULT 'medium' NOT NULL,
	"page_url" text,
	"user_email" text,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sos_bug_reports" ADD CONSTRAINT "sos_bug_reports_reporter_id_sos_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."sos_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "sos_bug_reports_status_idx" ON "sos_bug_reports" ("status");
--> statement-breakpoint
CREATE INDEX "sos_bug_reports_created_idx" ON "sos_bug_reports" ("created_at");

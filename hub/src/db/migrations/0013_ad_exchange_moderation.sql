ALTER TABLE "ad_spaces" ADD COLUMN IF NOT EXISTS "is_adult_allowed" boolean DEFAULT false;--> statement-breakpoint

ALTER TABLE "advertiser_allocations" ADD COLUMN IF NOT EXISTS "content_category" text;--> statement-breakpoint
ALTER TABLE "advertiser_allocations" ADD COLUMN IF NOT EXISTS "is_adult" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "advertiser_allocations" ADD COLUMN IF NOT EXISTS "moderation_status" text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "advertiser_allocations" ADD COLUMN IF NOT EXISTS "moderation_reason" text;--> statement-breakpoint
ALTER TABLE "advertiser_allocations" ADD COLUMN IF NOT EXISTS "flagged_at" timestamp with time zone;

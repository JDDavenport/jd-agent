ALTER TABLE "ad_spaces" ADD COLUMN IF NOT EXISTS "creator_address_encrypted" text;--> statement-breakpoint
ALTER TABLE "ad_spaces" ADD COLUMN IF NOT EXISTS "current_owner_address_encrypted" text;--> statement-breakpoint
ALTER TABLE "ad_spaces" ADD COLUMN IF NOT EXISTS "previous_owner_address_encrypted" text;--> statement-breakpoint

ALTER TABLE "advertiser_allocations" ADD COLUMN IF NOT EXISTS "current_owner_address_encrypted" text;--> statement-breakpoint
ALTER TABLE "advertiser_allocations" ADD COLUMN IF NOT EXISTS "previous_owner_address_encrypted" text;--> statement-breakpoint

ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "payer_address_encrypted" text;--> statement-breakpoint

ALTER TABLE "ownership_transfers" ADD COLUMN IF NOT EXISTS "from_address_encrypted" text;--> statement-breakpoint
ALTER TABLE "ownership_transfers" ADD COLUMN IF NOT EXISTS "to_address_encrypted" text;--> statement-breakpoint

ALTER TABLE "market_listings" ADD COLUMN IF NOT EXISTS "seller_address_encrypted" text;

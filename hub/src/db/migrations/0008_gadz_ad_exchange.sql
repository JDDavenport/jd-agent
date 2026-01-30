-- Gadz.io ad exchange core tables

CREATE TABLE IF NOT EXISTS "ad_spaces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "creator_address" text NOT NULL,
  "current_owner_address" text NOT NULL,
  "previous_owner_address" text,
  "weekly_impressions" bigint NOT NULL,
  "current_reserve_price" real NOT NULL,
  "ownership_transfer_price" real,
  "weekly_holding_fee" real NOT NULL,
  "creator_sale_share_percent" real NOT NULL,
  "creator_fee_share_percent" real NOT NULL,
  "custom_contract_terms" jsonb,
  "name" text NOT NULL,
  "description" text,
  "category" text,
  "tags" text[],
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ownership_acquired_at" timestamp with time zone,
  "last_payment_at" timestamp with time zone,
  "next_payment_due" timestamp with time zone
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "advertiser_allocations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ad_space_id" uuid NOT NULL REFERENCES "ad_spaces"("id") ON DELETE cascade,
  "current_owner_address" text NOT NULL,
  "previous_owner_address" text,
  "allocation_units" integer NOT NULL CHECK ("allocation_units" >= 1 AND "allocation_units" <= 8),
  "impressions_per_week" bigint NOT NULL,
  "acquisition_price" real,
  "weekly_fee" real NOT NULL,
  "creative_asset_urls" text[],
  "click_through_url" text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "allocation_acquired_at" timestamp with time zone,
  "last_payment_at" timestamp with time zone,
  "next_payment_due" timestamp with time zone
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "payment_type" text NOT NULL CHECK ("payment_type" IN ('ad_space_ownership', 'ad_space_weekly_fee', 'allocation_acquisition', 'allocation_weekly_fee')),
  "ad_space_id" uuid REFERENCES "ad_spaces"("id") ON DELETE set null,
  "allocation_id" uuid REFERENCES "advertiser_allocations"("id") ON DELETE set null,
  "payer_address" text NOT NULL,
  "amount" real NOT NULL,
  "transaction_hash" text,
  "revenue_distribution" jsonb,
  "status" text NOT NULL CHECK ("status" IN ('pending', 'completed', 'failed', 'reverted')),
  "due_date" timestamp with time zone NOT NULL,
  "paid_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "ownership_transfers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "transfer_type" text NOT NULL CHECK ("transfer_type" IN ('ad_space', 'allocation')),
  "ad_space_id" uuid REFERENCES "ad_spaces"("id") ON DELETE set null,
  "allocation_id" uuid REFERENCES "advertiser_allocations"("id") ON DELETE set null,
  "from_address" text NOT NULL,
  "to_address" text NOT NULL,
  "transfer_price" real,
  "reason" text NOT NULL CHECK ("reason" IN ('sale', 'non_payment_reversion', 'initial_creation')),
  "transaction_hash" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "performance_metrics" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ad_space_id" uuid REFERENCES "ad_spaces"("id") ON DELETE cascade,
  "allocation_id" uuid REFERENCES "advertiser_allocations"("id") ON DELETE cascade,
  "period_start" timestamp with time zone NOT NULL,
  "period_end" timestamp with time zone NOT NULL,
  "impressions_delivered" bigint DEFAULT 0,
  "clicks" bigint DEFAULT 0,
  "ctr" real,
  "revenue_generated" real,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "market_listings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "listing_type" text NOT NULL CHECK ("listing_type" IN ('ad_space', 'allocation')),
  "ad_space_id" uuid REFERENCES "ad_spaces"("id") ON DELETE set null,
  "allocation_id" uuid REFERENCES "advertiser_allocations"("id") ON DELETE set null,
  "seller_address" text NOT NULL,
  "ask_price" real NOT NULL,
  "min_price" real,
  "status" text NOT NULL CHECK ("status" IN ('active', 'sold', 'cancelled', 'expired')),
  "listed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone,
  "sold_at" timestamp with time zone
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "ad_spaces_owner_idx" ON "ad_spaces" ("current_owner_address");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_spaces_creator_idx" ON "ad_spaces" ("creator_address");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_spaces_active_idx" ON "ad_spaces" ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_spaces_category_idx" ON "ad_spaces" ("category");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "advertiser_allocations_ad_space_idx" ON "advertiser_allocations" ("ad_space_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "advertiser_allocations_owner_idx" ON "advertiser_allocations" ("current_owner_address");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "advertiser_allocations_active_idx" ON "advertiser_allocations" ("is_active");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "ad_payments_due_idx" ON "payments" ("due_date", "status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_payments_space_idx" ON "payments" ("ad_space_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ad_payments_allocation_idx" ON "payments" ("allocation_id");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "ownership_transfers_space_idx" ON "ownership_transfers" ("ad_space_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ownership_transfers_allocation_idx" ON "ownership_transfers" ("allocation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ownership_transfers_type_idx" ON "ownership_transfers" ("transfer_type");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "performance_metrics_space_idx" ON "performance_metrics" ("ad_space_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "performance_metrics_allocation_idx" ON "performance_metrics" ("allocation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "performance_metrics_period_idx" ON "performance_metrics" ("period_start", "period_end");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "performance_metrics_unique_idx" ON "performance_metrics" ("ad_space_id", "allocation_id", "period_start");--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "market_listings_status_idx" ON "market_listings" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "market_listings_space_idx" ON "market_listings" ("ad_space_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "market_listings_allocation_idx" ON "market_listings" ("allocation_id");

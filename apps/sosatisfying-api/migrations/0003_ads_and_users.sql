ALTER TABLE "sos_users" ADD COLUMN "wallet_address" text;
--> statement-breakpoint
ALTER TABLE "sos_users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "sos_users" ADD COLUMN "karma" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE "sos_ad_spaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"placement" text NOT NULL,
	"group_id" uuid,
	"owner_user_id" uuid,
	"allow_self_serve" boolean DEFAULT true NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sos_ads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ad_space_id" uuid NOT NULL,
	"owner_user_id" uuid,
	"title" text NOT NULL,
	"image_url" text,
	"click_url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"is_adult" boolean DEFAULT false NOT NULL,
	"moderation_status" text DEFAULT 'pending' NOT NULL,
	"moderation_reason" text,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sos_ad_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ad_space_id" uuid NOT NULL,
	"buyer_user_id" uuid,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sos_ad_spaces" ADD CONSTRAINT "sos_ad_spaces_group_id_sos_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."sos_groups"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sos_ad_spaces" ADD CONSTRAINT "sos_ad_spaces_owner_user_id_sos_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."sos_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sos_ads" ADD CONSTRAINT "sos_ads_ad_space_id_sos_ad_spaces_id_fk" FOREIGN KEY ("ad_space_id") REFERENCES "public"."sos_ad_spaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sos_ads" ADD CONSTRAINT "sos_ads_owner_user_id_sos_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."sos_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sos_ad_orders" ADD CONSTRAINT "sos_ad_orders_ad_space_id_sos_ad_spaces_id_fk" FOREIGN KEY ("ad_space_id") REFERENCES "public"."sos_ad_spaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sos_ad_orders" ADD CONSTRAINT "sos_ad_orders_buyer_user_id_sos_users_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."sos_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "sos_ad_spaces_placement_idx" ON "sos_ad_spaces" ("placement");
--> statement-breakpoint
CREATE INDEX "sos_ad_spaces_group_idx" ON "sos_ad_spaces" ("group_id");
--> statement-breakpoint
CREATE INDEX "sos_ad_spaces_owner_idx" ON "sos_ad_spaces" ("owner_user_id");
--> statement-breakpoint
CREATE INDEX "sos_ads_space_idx" ON "sos_ads" ("ad_space_id");
--> statement-breakpoint
CREATE INDEX "sos_ads_status_idx" ON "sos_ads" ("status");
--> statement-breakpoint
CREATE INDEX "sos_ads_moderation_idx" ON "sos_ads" ("moderation_status");
--> statement-breakpoint
CREATE INDEX "sos_ad_orders_space_idx" ON "sos_ad_orders" ("ad_space_id");
--> statement-breakpoint
CREATE INDEX "sos_ad_orders_status_idx" ON "sos_ad_orders" ("status");

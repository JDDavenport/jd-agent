CREATE TABLE "sos_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"avatar_url" text,
	"bio" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"is_banned" boolean DEFAULT false NOT NULL,
	"age_verified_21plus" boolean DEFAULT false NOT NULL,
	CONSTRAINT "sos_users_username_unique" UNIQUE("username"),
	CONSTRAINT "sos_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "sos_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"display_title" text NOT NULL,
	"description" text,
	"category" text,
	"is_21plus" boolean DEFAULT false NOT NULL,
	"banner_url" text,
	"icon_url" text,
	"creator_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"subscriber_count" integer DEFAULT 0 NOT NULL,
	"rules" jsonb,
	CONSTRAINT "sos_groups_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "sos_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"author_id" uuid,
	"title" text NOT NULL,
	"content_type" text NOT NULL,
	"content_url" text,
	"content_text" text,
	"thumbnail_url" text,
	"is_21plus" boolean DEFAULT false NOT NULL,
	"is_original_content" boolean DEFAULT false NOT NULL,
	"flair" text,
	"upvotes" integer DEFAULT 0 NOT NULL,
	"downvotes" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sos_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"author_id" uuid,
	"parent_comment_id" uuid,
	"content" text NOT NULL,
	"upvotes" integer DEFAULT 0 NOT NULL,
	"downvotes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"depth" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sos_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"post_id" uuid,
	"comment_id" uuid,
	"vote_type" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sos_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"subscribed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sos_moderators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"permissions" jsonb
);
--> statement-breakpoint
CREATE TABLE "sos_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid,
	"post_id" uuid,
	"comment_id" uuid,
	"reason" text NOT NULL,
	"details" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sos_ad_revenue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"date" date NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"revenue_cents" integer DEFAULT 0 NOT NULL,
	"creator_share_cents" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sos_groups" ADD CONSTRAINT "sos_groups_creator_id_sos_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."sos_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sos_posts" ADD CONSTRAINT "sos_posts_group_id_sos_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."sos_groups"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sos_posts" ADD CONSTRAINT "sos_posts_author_id_sos_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."sos_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sos_comments" ADD CONSTRAINT "sos_comments_post_id_sos_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."sos_posts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sos_comments" ADD CONSTRAINT "sos_comments_author_id_sos_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."sos_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sos_comments" ADD CONSTRAINT "sos_comments_parent_comment_id_sos_comments_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."sos_comments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sos_votes" ADD CONSTRAINT "sos_votes_user_id_sos_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sos_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sos_votes" ADD CONSTRAINT "sos_votes_post_id_sos_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."sos_posts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sos_votes" ADD CONSTRAINT "sos_votes_comment_id_sos_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."sos_comments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sos_subscriptions" ADD CONSTRAINT "sos_subscriptions_user_id_sos_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sos_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sos_subscriptions" ADD CONSTRAINT "sos_subscriptions_group_id_sos_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."sos_groups"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sos_moderators" ADD CONSTRAINT "sos_moderators_user_id_sos_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."sos_users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sos_moderators" ADD CONSTRAINT "sos_moderators_group_id_sos_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."sos_groups"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sos_reports" ADD CONSTRAINT "sos_reports_reporter_id_sos_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."sos_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sos_reports" ADD CONSTRAINT "sos_reports_post_id_sos_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."sos_posts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sos_reports" ADD CONSTRAINT "sos_reports_comment_id_sos_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."sos_comments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sos_reports" ADD CONSTRAINT "sos_reports_reviewed_by_sos_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."sos_users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sos_ad_revenue" ADD CONSTRAINT "sos_ad_revenue_group_id_sos_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."sos_groups"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "sos_users_username_idx" ON "sos_users" ("username");
--> statement-breakpoint
CREATE INDEX "sos_users_email_idx" ON "sos_users" ("email");
--> statement-breakpoint
CREATE INDEX "sos_groups_name_idx" ON "sos_groups" ("name");
--> statement-breakpoint
CREATE INDEX "sos_groups_category_idx" ON "sos_groups" ("category");
--> statement-breakpoint
CREATE INDEX "sos_groups_creator_idx" ON "sos_groups" ("creator_id");
--> statement-breakpoint
CREATE INDEX "sos_posts_group_idx" ON "sos_posts" ("group_id");
--> statement-breakpoint
CREATE INDEX "sos_posts_created_idx" ON "sos_posts" ("created_at");
--> statement-breakpoint
CREATE INDEX "sos_posts_group_created_idx" ON "sos_posts" ("group_id", "created_at");
--> statement-breakpoint
CREATE INDEX "sos_comments_post_idx" ON "sos_comments" ("post_id");
--> statement-breakpoint
CREATE INDEX "sos_comments_post_created_idx" ON "sos_comments" ("post_id", "created_at");
--> statement-breakpoint
CREATE INDEX "sos_votes_user_idx" ON "sos_votes" ("user_id");
--> statement-breakpoint
CREATE INDEX "sos_votes_post_idx" ON "sos_votes" ("post_id");
--> statement-breakpoint
CREATE INDEX "sos_votes_comment_idx" ON "sos_votes" ("comment_id");
--> statement-breakpoint
CREATE INDEX "sos_subscriptions_user_idx" ON "sos_subscriptions" ("user_id");
--> statement-breakpoint
CREATE INDEX "sos_subscriptions_group_idx" ON "sos_subscriptions" ("group_id");
--> statement-breakpoint
CREATE INDEX "sos_moderators_user_idx" ON "sos_moderators" ("user_id");
--> statement-breakpoint
CREATE INDEX "sos_moderators_group_idx" ON "sos_moderators" ("group_id");
--> statement-breakpoint
CREATE INDEX "sos_reports_status_idx" ON "sos_reports" ("status");
--> statement-breakpoint
CREATE INDEX "sos_reports_post_idx" ON "sos_reports" ("post_id");
--> statement-breakpoint
CREATE INDEX "sos_reports_comment_idx" ON "sos_reports" ("comment_id");
--> statement-breakpoint
CREATE INDEX "sos_ad_revenue_group_idx" ON "sos_ad_revenue" ("group_id");
--> statement-breakpoint
CREATE INDEX "sos_ad_revenue_date_idx" ON "sos_ad_revenue" ("date");

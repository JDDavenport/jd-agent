CREATE TABLE "finance_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"period_type" text DEFAULT 'monthly',
	"start_date" date,
	"end_date" date,
	"rollover_enabled" boolean DEFAULT false,
	"rollover_amount_cents" integer DEFAULT 0,
	"alert_threshold" integer DEFAULT 80,
	"alerts_enabled" boolean DEFAULT true,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"insight_type" text NOT NULL,
	"category" text,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"severity" text DEFAULT 'info',
	"related_transaction_ids" uuid[],
	"data" jsonb,
	"actionable" boolean DEFAULT false,
	"action_type" text,
	"action_payload" jsonb,
	"is_dismissed" boolean DEFAULT false,
	"dismissed_at" timestamp with time zone,
	"is_actioned" boolean DEFAULT false,
	"actioned_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_recurring" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_name" text NOT NULL,
	"category" text,
	"average_amount_cents" integer NOT NULL,
	"last_amount_cents" integer,
	"frequency" text NOT NULL,
	"predicted_next_date" date,
	"first_occurrence" date,
	"last_occurrence" date,
	"occurrence_count" integer DEFAULT 0,
	"transaction_ids" uuid[],
	"is_active" boolean DEFAULT true,
	"user_label" text,
	"reminder_enabled" boolean DEFAULT false,
	"reminder_days_before" integer DEFAULT 3,
	"last_task_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plaid_account_id" uuid NOT NULL,
	"plaid_transaction_id" text,
	"amount_cents" integer NOT NULL,
	"iso_currency_code" text DEFAULT 'USD',
	"date" date NOT NULL,
	"datetime" timestamp with time zone,
	"merchant_name" text,
	"merchant_entity_id" text,
	"name" text NOT NULL,
	"plaid_category" text[],
	"plaid_category_id" text,
	"category" text,
	"subcategory" text,
	"ai_categorized" boolean DEFAULT false,
	"pending" boolean DEFAULT false,
	"location" jsonb,
	"payment_channel" text,
	"payment_meta" jsonb,
	"user_category" text,
	"user_note" text,
	"is_excluded" boolean DEFAULT false,
	"receipt_vault_page_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_transactions_plaid_transaction_id_unique" UNIQUE("plaid_transaction_id")
);
--> statement-breakpoint
CREATE TABLE "plaid_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" text NOT NULL,
	"account_id" text NOT NULL,
	"institution_id" text,
	"institution_name" text NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"access_token_iv" text NOT NULL,
	"account_mask" text,
	"account_name" text,
	"account_type" text,
	"account_subtype" text,
	"current_balance_cents" integer,
	"available_balance_cents" integer,
	"limit_cents" integer,
	"iso_currency_code" text DEFAULT 'USD',
	"last_sync_at" timestamp with time zone,
	"last_sync_cursor" text,
	"sync_status" text DEFAULT 'active',
	"error_code" text,
	"error_message" text,
	"is_hidden" boolean DEFAULT false,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plaid_accounts_account_id_unique" UNIQUE("account_id")
);
--> statement-breakpoint
CREATE TABLE "tag_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text DEFAULT '#808080',
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tag_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "labels" ADD COLUMN "category_id" uuid;--> statement-breakpoint
ALTER TABLE "labels" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "labels" ADD COLUMN "aliases" text[];--> statement-breakpoint
ALTER TABLE "labels" ADD COLUMN "is_system" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "labels" ADD COLUMN "usage_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_recurring" ADD CONSTRAINT "finance_recurring_last_task_id_tasks_id_fk" FOREIGN KEY ("last_task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_plaid_account_id_plaid_accounts_id_fk" FOREIGN KEY ("plaid_account_id") REFERENCES "public"."plaid_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_receipt_vault_page_id_vault_pages_id_fk" FOREIGN KEY ("receipt_vault_page_id") REFERENCES "public"."vault_pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "finance_budgets_category_idx" ON "finance_budgets" USING btree ("category");--> statement-breakpoint
CREATE INDEX "finance_budgets_active_idx" ON "finance_budgets" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "finance_insights_type_idx" ON "finance_insights" USING btree ("insight_type");--> statement-breakpoint
CREATE INDEX "finance_insights_dismissed_idx" ON "finance_insights" USING btree ("is_dismissed");--> statement-breakpoint
CREATE INDEX "finance_insights_expires_idx" ON "finance_insights" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "finance_recurring_merchant_idx" ON "finance_recurring" USING btree ("merchant_name");--> statement-breakpoint
CREATE INDEX "finance_recurring_next_date_idx" ON "finance_recurring" USING btree ("predicted_next_date");--> statement-breakpoint
CREATE INDEX "finance_recurring_active_idx" ON "finance_recurring" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "finance_transactions_account_idx" ON "finance_transactions" USING btree ("plaid_account_id");--> statement-breakpoint
CREATE INDEX "finance_transactions_date_idx" ON "finance_transactions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "finance_transactions_category_idx" ON "finance_transactions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "finance_transactions_plaid_id_idx" ON "finance_transactions" USING btree ("plaid_transaction_id");--> statement-breakpoint
CREATE INDEX "finance_transactions_pending_idx" ON "finance_transactions" USING btree ("pending");--> statement-breakpoint
CREATE INDEX "plaid_accounts_item_idx" ON "plaid_accounts" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "plaid_accounts_status_idx" ON "plaid_accounts" USING btree ("sync_status");--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_category_id_tag_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."tag_categories"("id") ON DELETE set null ON UPDATE no action;
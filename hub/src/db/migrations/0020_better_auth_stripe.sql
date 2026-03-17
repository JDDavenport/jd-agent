-- Migration: Better Auth + Stripe tables
-- Adds Better Auth core tables and Stripe subscription table
-- Also links study_help_users to Better Auth users

-- ============================================
-- Better Auth: user table
-- ============================================
CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "email_verified" boolean NOT NULL DEFAULT false,
  "image" text,
  "stripe_customer_id" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

-- ============================================
-- Better Auth: session table
-- ============================================
CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY,
  "expires_at" timestamp NOT NULL,
  "token" text NOT NULL UNIQUE,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "session_user_id_idx" ON "session" ("user_id");
CREATE INDEX IF NOT EXISTS "session_token_idx" ON "session" ("token");

-- ============================================
-- Better Auth: account table (OAuth providers)
-- ============================================
CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp,
  "refresh_token_expires_at" timestamp,
  "scope" text,
  "password" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "account_user_id_idx" ON "account" ("user_id");

-- ============================================
-- Better Auth: verification table
-- ============================================
CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp,
  "updated_at" timestamp
);

-- ============================================
-- Better Auth + Stripe: subscription table
-- ============================================
CREATE TABLE IF NOT EXISTS "subscription" (
  "id" text PRIMARY KEY,
  "plan" text NOT NULL,
  "reference_id" text NOT NULL,
  "stripe_customer_id" text,
  "stripe_subscription_id" text,
  "status" text,
  "period_start" timestamp,
  "period_end" timestamp,
  "cancel_at_period_end" boolean DEFAULT false,
  "seats" integer,
  "trial_start" timestamp,
  "trial_end" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "subscription_reference_id_idx" ON "subscription" ("reference_id");
CREATE INDEX IF NOT EXISTS "subscription_stripe_customer_idx" ON "subscription" ("stripe_customer_id");
CREATE INDEX IF NOT EXISTS "subscription_stripe_sub_idx" ON "subscription" ("stripe_subscription_id");

-- ============================================
-- Link study_help_users to Better Auth
-- ============================================
ALTER TABLE "study_help_users" ADD COLUMN IF NOT EXISTS "better_auth_user_id" text REFERENCES "user"("id");
CREATE INDEX IF NOT EXISTS "study_help_users_ba_id_idx" ON "study_help_users" ("better_auth_user_id");

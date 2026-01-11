ALTER TABLE "vault_pages" ADD COLUMN "para_type" text;--> statement-breakpoint
ALTER TABLE "vault_pages" ADD COLUMN "is_system" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "vault_pages_para_type_idx" ON "vault_pages" USING btree ("para_type");
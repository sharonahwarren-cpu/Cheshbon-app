ALTER TABLE "mitzvot" ADD COLUMN "primary_domain" text;--> statement-breakpoint
ALTER TABLE "mitzvot" ADD COLUMN "subdomain" text;--> statement-breakpoint
ALTER TABLE "mitzvot" ADD COLUMN "tags" jsonb;--> statement-breakpoint
ALTER TABLE "mitzvot" ADD COLUMN "mode" jsonb;
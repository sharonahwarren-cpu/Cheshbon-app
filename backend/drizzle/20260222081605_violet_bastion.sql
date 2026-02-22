ALTER TABLE "goals" ADD COLUMN "start_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;
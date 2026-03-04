ALTER TABLE "goals" ADD COLUMN "current_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "best_streak" integer DEFAULT 0 NOT NULL;
ALTER TABLE "goals" ADD COLUMN "monthly_use_alternative_calendar" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "monthly_calendar_type" text;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "monthly_calendar_event" text;--> statement-breakpoint
ALTER TABLE "mitzvot" ADD COLUMN "monthly_use_alternative_calendar" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "mitzvot" ADD COLUMN "monthly_calendar_type" text;--> statement-breakpoint
ALTER TABLE "mitzvot" ADD COLUMN "monthly_calendar_event" text;
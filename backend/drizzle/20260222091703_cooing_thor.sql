ALTER TABLE "goals" ADD COLUMN "schedule_recurrence_type" text DEFAULT 'daily';--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "schedule_times_per_day_details" jsonb;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "schedule_weekends_only" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "schedule_weekdays_only" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "schedule_fortnight_even_odd" text;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "schedule_monthly_range" jsonb;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "schedule_monthly_random_count" integer;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "schedule_exclusions" jsonb;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "schedule_date_of_year_months" integer[];
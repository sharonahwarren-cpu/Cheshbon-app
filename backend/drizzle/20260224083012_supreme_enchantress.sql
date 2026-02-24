ALTER TABLE "goals" ADD COLUMN "schedule_yearly_dates" jsonb;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "schedule_yearly_ranges" jsonb;--> statement-breakpoint
ALTER TABLE "mitzvot" ADD COLUMN "schedule_yearly_dates" jsonb;--> statement-breakpoint
ALTER TABLE "mitzvot" ADD COLUMN "schedule_yearly_ranges" jsonb;--> statement-breakpoint
ALTER TABLE "goals" DROP COLUMN "schedule_period_of_year";--> statement-breakpoint
ALTER TABLE "goals" DROP COLUMN "schedule_dates_of_year";--> statement-breakpoint
ALTER TABLE "goals" DROP COLUMN "schedule_date_of_year_months";--> statement-breakpoint
ALTER TABLE "mitzvot" DROP COLUMN "schedule_period_of_year";--> statement-breakpoint
ALTER TABLE "mitzvot" DROP COLUMN "schedule_dates_of_year";--> statement-breakpoint
ALTER TABLE "mitzvot" DROP COLUMN "schedule_date_of_year_months";
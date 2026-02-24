-- Complete rebuild of yearly schedule system
-- Replace old yearly columns with new structured approach

-- For goals table
ALTER TABLE "goals" DROP COLUMN IF EXISTS "schedule_period_of_year";
ALTER TABLE "goals" DROP COLUMN IF EXISTS "schedule_date_of_year_months";

-- Add new yearly columns if they don't exist
ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "schedule_yearly_dates" jsonb;
ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "schedule_yearly_ranges" jsonb;

-- For mitzvot table
ALTER TABLE "mitzvot" DROP COLUMN IF EXISTS "schedule_period_of_year";
ALTER TABLE "mitzvot" DROP COLUMN IF EXISTS "schedule_date_of_year_months";

-- Add new yearly columns if they don't exist
ALTER TABLE "mitzvot" ADD COLUMN IF NOT EXISTS "schedule_yearly_dates" jsonb;
ALTER TABLE "mitzvot" ADD COLUMN IF NOT EXISTS "schedule_yearly_ranges" jsonb;

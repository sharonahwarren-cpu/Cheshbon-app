-- Drop and recreate schedule_dates_of_year as JSONB
-- This safely handles the migration without data transformation issues

-- For goals table
ALTER TABLE "goals" DROP COLUMN "schedule_dates_of_year";
ALTER TABLE "goals" ADD COLUMN "schedule_dates_of_year" jsonb;

-- For mitzvot table
ALTER TABLE "mitzvot" DROP COLUMN "schedule_dates_of_year";
ALTER TABLE "mitzvot" ADD COLUMN "schedule_dates_of_year" jsonb;

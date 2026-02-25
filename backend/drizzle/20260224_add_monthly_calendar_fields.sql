-- Add Hebrew calendar support for monthly schedules

-- For goals table
ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "monthly_use_alternative_calendar" boolean DEFAULT false;
ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "monthly_calendar_type" text;
ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "monthly_calendar_event" text;

-- For mitzvot table
ALTER TABLE "mitzvot" ADD COLUMN IF NOT EXISTS "monthly_use_alternative_calendar" boolean DEFAULT false;
ALTER TABLE "mitzvot" ADD COLUMN IF NOT EXISTS "monthly_calendar_type" text;
ALTER TABLE "mitzvot" ADD COLUMN IF NOT EXISTS "monthly_calendar_event" text;

-- Add new fields to mitzvot table for CSV import support
ALTER TABLE mitzvot
ADD COLUMN IF NOT EXISTS primary_domain text,
ADD COLUMN IF NOT EXISTS subdomain text,
ADD COLUMN IF NOT EXISTS tags jsonb,
ADD COLUMN IF NOT EXISTS mode jsonb;

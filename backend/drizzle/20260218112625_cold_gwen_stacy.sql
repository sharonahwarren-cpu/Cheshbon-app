CREATE TYPE "public"."currency_type" AS ENUM('reward', 'consequence');--> statement-breakpoint
ALTER TABLE "currencies" ADD COLUMN "type" "currency_type" DEFAULT 'consequence' NOT NULL;
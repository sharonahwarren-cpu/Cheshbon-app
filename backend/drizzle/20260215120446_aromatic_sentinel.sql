CREATE TABLE "gains_losses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"category" text,
	"sub_category" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goals" ALTER COLUMN "schedule_times_per_day" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "schedule_days_of_week" integer[];--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "schedule_dates_of_month" integer[];--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "schedule_nth_day_of_month" jsonb;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "schedule_times_per_month" integer;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "schedule_period_of_year" jsonb;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "schedule_dates_of_year" text[];--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "reflections" ADD COLUMN "gained_ids" uuid[];--> statement-breakpoint
ALTER TABLE "reflections" ADD COLUMN "lost_ids" uuid[];--> statement-breakpoint
ALTER TABLE "reflections" ADD COLUMN "was_worth_it" boolean;--> statement-breakpoint
ALTER TABLE "reflections" ADD COLUMN "additional_thoughts" text;--> statement-breakpoint
ALTER TABLE "reflections" ADD COLUMN "strategy_effectiveness" jsonb;--> statement-breakpoint
ALTER TABLE "strategies" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "strategies" ADD COLUMN "success_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "strategies" ADD COLUMN "failure_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "strategies" ADD COLUMN "times_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "gains_losses" ADD CONSTRAINT "gains_losses_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reflections" DROP COLUMN "lookup_field_1";--> statement-breakpoint
ALTER TABLE "reflections" DROP COLUMN "lookup_field_2";
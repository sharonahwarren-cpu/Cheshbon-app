CREATE TABLE "reflection_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reflection_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "schedule_period_of_year" jsonb;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "schedule_dates_of_year" jsonb;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "schedule_date_of_year_months" integer[];--> statement-breakpoint
ALTER TABLE "mitzvot" ADD COLUMN "schedule_period_of_year" jsonb;--> statement-breakpoint
ALTER TABLE "mitzvot" ADD COLUMN "schedule_dates_of_year" jsonb;--> statement-breakpoint
ALTER TABLE "mitzvot" ADD COLUMN "schedule_date_of_year_months" text[];--> statement-breakpoint
ALTER TABLE "reflection_conversations" ADD CONSTRAINT "reflection_conversations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reflection_messages" ADD CONSTRAINT "reflection_messages_conversation_id_reflection_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."reflection_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" DROP COLUMN "schedule_yearly_dates";--> statement-breakpoint
ALTER TABLE "goals" DROP COLUMN "schedule_yearly_ranges";--> statement-breakpoint
ALTER TABLE "mitzvot" DROP COLUMN "schedule_yearly_dates";--> statement-breakpoint
ALTER TABLE "mitzvot" DROP COLUMN "schedule_yearly_ranges";
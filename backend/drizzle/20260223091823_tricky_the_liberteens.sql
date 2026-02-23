CREATE TABLE "cheshbon_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cheshbon_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"session_date" date NOT NULL,
	"audio_url" text,
	"transcription" text,
	"ai_suggestions" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mitzvot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category_id" uuid,
	"type" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"schedule_type" text DEFAULT 'always_active' NOT NULL,
	"schedule_days_of_week" integer[],
	"schedule_dates_of_month" integer[],
	"schedule_nth_day_of_month" jsonb,
	"schedule_times_per_month" integer,
	"schedule_period_of_year" jsonb,
	"schedule_dates_of_year" text[],
	"schedule_recurrence_type" text,
	"schedule_times_per_day_details" jsonb,
	"schedule_weekends_only" boolean DEFAULT false,
	"schedule_weekdays_only" boolean DEFAULT false,
	"schedule_fortnight_even_odd" text,
	"schedule_monthly_range" jsonb,
	"schedule_monthly_random_count" integer,
	"schedule_exclusions" jsonb,
	"schedule_date_of_year_months" text[],
	"calendar_type" text,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"reward_currency_id" uuid,
	"reward_successes" integer,
	"reward_amount" integer,
	"consequence_currency_id" uuid,
	"consequence_failures" integer,
	"consequence_amount" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mitzvot_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mitzvot_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mitzvah_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"is_success" boolean NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "use_ai_cheshbon" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cheshbon_messages" ADD CONSTRAINT "cheshbon_messages_session_id_cheshbon_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."cheshbon_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheshbon_messages" ADD CONSTRAINT "cheshbon_messages_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cheshbon_sessions" ADD CONSTRAINT "cheshbon_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mitzvot" ADD CONSTRAINT "mitzvot_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mitzvot" ADD CONSTRAINT "mitzvot_category_id_mitzvot_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."mitzvot_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mitzvot" ADD CONSTRAINT "mitzvot_reward_currency_id_currencies_id_fk" FOREIGN KEY ("reward_currency_id") REFERENCES "public"."currencies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mitzvot" ADD CONSTRAINT "mitzvot_consequence_currency_id_currencies_id_fk" FOREIGN KEY ("consequence_currency_id") REFERENCES "public"."currencies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mitzvot_categories" ADD CONSTRAINT "mitzvot_categories_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mitzvot_completions" ADD CONSTRAINT "mitzvot_completions_mitzvah_id_mitzvot_id_fk" FOREIGN KEY ("mitzvah_id") REFERENCES "public"."mitzvot"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mitzvot_completions" ADD CONSTRAINT "mitzvot_completions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
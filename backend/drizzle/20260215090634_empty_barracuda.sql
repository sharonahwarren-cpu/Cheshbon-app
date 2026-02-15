CREATE TABLE "currencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"symbol" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "life_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"level" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "parent_goal_id" uuid;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "life_area_id" uuid;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "behavior_categories" text[];--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "type" text DEFAULT 'Proactive' NOT NULL;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "strategy_ids" text[];--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "schedule_type" text DEFAULT 'Always Active' NOT NULL;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "schedule_times_per_day" integer;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "reward_currency_id" uuid;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "reward_successes" integer;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "reward_amount" integer;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "consequence_currency_id" uuid;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "consequence_failures" integer;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "consequence_amount" integer;--> statement-breakpoint
ALTER TABLE "currencies" ADD CONSTRAINT "currencies_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_areas" ADD CONSTRAINT "life_areas_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_areas" ADD CONSTRAINT "life_areas_parent_id_life_areas_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."life_areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_parent_goal_id_goals_id_fk" FOREIGN KEY ("parent_goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_life_area_id_life_areas_id_fk" FOREIGN KEY ("life_area_id") REFERENCES "public"."life_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_reward_currency_id_currencies_id_fk" FOREIGN KEY ("reward_currency_id") REFERENCES "public"."currencies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_consequence_currency_id_currencies_id_fk" FOREIGN KEY ("consequence_currency_id") REFERENCES "public"."currencies"("id") ON DELETE set null ON UPDATE no action;
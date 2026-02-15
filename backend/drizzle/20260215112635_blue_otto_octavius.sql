CREATE TABLE "reflections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"entry_date" date NOT NULL,
	"category" text,
	"type" text NOT NULL,
	"description" text NOT NULL,
	"linked_goal_id" uuid,
	"outcome" text,
	"currency_change" jsonb,
	"lookup_field_1" text,
	"lookup_field_2" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "journal_entries" ADD COLUMN "entry_date" date NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "reflection_categories_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "reflection_categories" jsonb;--> statement-breakpoint
ALTER TABLE "reflections" ADD CONSTRAINT "reflections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reflections" ADD CONSTRAINT "reflections_linked_goal_id_goals_id_fk" FOREIGN KEY ("linked_goal_id") REFERENCES "public"."goals"("id") ON DELETE set null ON UPDATE no action;
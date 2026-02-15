CREATE TABLE "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"notifications_enabled" boolean DEFAULT false NOT NULL,
	"notification_frequency" text,
	"notification_time" text,
	"notification_days" text[],
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "currencies" ADD COLUMN "on_success" text DEFAULT 'NONE';--> statement-breakpoint
ALTER TABLE "currencies" ADD COLUMN "on_failure" text DEFAULT 'NONE';--> statement-breakpoint
ALTER TABLE "strategies" ADD COLUMN "is_successful" boolean;--> statement-breakpoint
ALTER TABLE "strategies" ADD COLUMN "linked_goal_ids" uuid[];--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
CREATE TABLE "alarms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"calendar_type" text,
	"event_type" text,
	"triggers" jsonb NOT NULL,
	"recurring" boolean DEFAULT false NOT NULL,
	"location" jsonb,
	"timezone" text NOT NULL,
	"next_trigger_time_utc" integer,
	"notification_id" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alarms" ADD CONSTRAINT "alarms_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
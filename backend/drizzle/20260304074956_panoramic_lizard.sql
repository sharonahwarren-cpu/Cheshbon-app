CREATE TABLE "reflection_motivations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reflections" ADD COLUMN "motivation_ids" uuid[];--> statement-breakpoint
ALTER TABLE "reflection_motivations" ADD CONSTRAINT "reflection_motivations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reflection_motivations_user_id_name_unique" ON "reflection_motivations" USING btree ("user_id","name");
ALTER TABLE "life_areas" DROP CONSTRAINT "life_areas_parent_id_life_areas_id_fk";
--> statement-breakpoint
ALTER TABLE "life_areas" ADD COLUMN "icon" text;--> statement-breakpoint
ALTER TABLE "life_areas" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "life_areas" ADD COLUMN "display_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "life_areas" ADD COLUMN "show_progress" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "life_areas" ADD CONSTRAINT "life_areas_parent_id_life_areas_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."life_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_areas" DROP COLUMN "level";
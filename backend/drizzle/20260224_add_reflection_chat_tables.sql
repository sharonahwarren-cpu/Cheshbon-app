-- Create reflection conversation and messages tables for AI reflection chat

CREATE TABLE IF NOT EXISTS "reflection_conversations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "title" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "reflection_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" uuid NOT NULL REFERENCES "reflection_conversations"("id") ON DELETE CASCADE,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS "reflection_conversations_user_id_idx" ON "reflection_conversations"("user_id");
CREATE INDEX IF NOT EXISTS "reflection_conversations_updated_at_idx" ON "reflection_conversations"("updated_at");
CREATE INDEX IF NOT EXISTS "reflection_messages_conversation_id_idx" ON "reflection_messages"("conversation_id");
CREATE INDEX IF NOT EXISTS "reflection_messages_created_at_idx" ON "reflection_messages"("created_at");
